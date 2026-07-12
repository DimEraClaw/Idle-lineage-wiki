#!/usr/bin/env python3
"""Generate deterministic Phase 1 craft JSON without executing JavaScript."""

from __future__ import annotations

import argparse
import json
import math
from collections import Counter, defaultdict
from pathlib import Path
from typing import Any


ROOT = Path(__file__).resolve().parents[1]
DEFAULT_SOURCE = ROOT / "wiki.html"
DEFAULT_OUTPUT = ROOT / "data" / "craft"

EXPECTED = {
    "npc_count": 47,
    "recipe_count": 279,
    "unique_results": 272,
    "unique_requirements_ex_gold": 278,
    "skillbook_results": 14,
    "equipment_results": 213,
    "requirements_with_drops": 193,
    "requirements_without_drops": 85,
    "non_unit_yield_recipes": 4,
    "missing_result_items": 9,
    "missing_requirement_items": 18,
    "missing_npc_info": 1,
    "recipe_npcs_outside_order": 18,
}


class GenerationError(RuntimeError):
    pass


def find_assignment_value_start(text: str, constant_name: str) -> int:
    """Find a top-level `const NAME =` assignment with a small lexical scanner."""
    i = 0
    length = len(text)
    state = "code"
    quote = ""
    while i < length:
        ch = text[i]
        nxt = text[i + 1] if i + 1 < length else ""
        if state == "line_comment":
            if ch in "\r\n":
                state = "code"
            i += 1
            continue
        if state == "block_comment":
            if ch == "*" and nxt == "/":
                state = "code"
                i += 2
            else:
                i += 1
            continue
        if state == "string":
            if ch == "\\":
                i += 2
            elif ch == quote:
                state = "code"
                i += 1
            else:
                i += 1
            continue
        if ch == "/" and nxt == "/":
            state = "line_comment"
            i += 2
            continue
        if ch == "/" and nxt == "*":
            state = "block_comment"
            i += 2
            continue
        if ch in "'\"`":
            state = "string"
            quote = ch
            i += 1
            continue
        if text.startswith("const", i) and (i == 0 or not (text[i - 1].isalnum() or text[i - 1] in "_$")):
            j = i + 5
            if j < length and (text[j].isalnum() or text[j] in "_$"):
                i += 1
                continue
            while j < length and text[j].isspace():
                j += 1
            start = j
            while j < length and (text[j].isalnum() or text[j] in "_$"):
                j += 1
            if text[start:j] != constant_name:
                i = j
                continue
            while j < length and text[j].isspace():
                j += 1
            if j >= length or text[j] != "=":
                raise GenerationError(f"Malformed assignment for {constant_name}")
            j += 1
            while j < length and text[j].isspace():
                j += 1
            return j
        i += 1
    raise GenerationError(f"Constant not found: {constant_name}")


def extract_json_constant(text: str, constant_name: str) -> Any:
    start = find_assignment_value_start(text, constant_name)
    try:
        value, end = json.JSONDecoder().raw_decode(text, start)
    except json.JSONDecodeError as exc:
        raise GenerationError(f"{constant_name} is not a valid JSON literal: {exc}") from exc
    tail = text[end:].lstrip()
    if not tail.startswith(";"):
        raise GenerationError(f"{constant_name} literal is not followed by a semicolon")
    return value


def parse_restricted_string_array(text: str, constant_name: str) -> list[str]:
    """Parse only a JavaScript array of quoted strings; no expressions are accepted."""
    i = find_assignment_value_start(text, constant_name)
    if i >= len(text) or text[i] != "[":
        raise GenerationError(f"{constant_name} must be an array")
    i += 1
    result: list[str] = []
    expect_value = True
    while i < len(text):
        while i < len(text) and text[i].isspace():
            i += 1
        if text[i] == "]":
            return result
        if not expect_value or text[i] not in "'\"":
            raise GenerationError(f"{constant_name} contains a non-string expression")
        quote = text[i]
        i += 1
        chars: list[str] = []
        while i < len(text) and text[i] != quote:
            if text[i] == "\\":
                i += 1
                if i >= len(text):
                    raise GenerationError(f"Unterminated escape in {constant_name}")
                escapes = {"n": "\n", "r": "\r", "t": "\t", "\\": "\\", "'": "'", '"': '"'}
                chars.append(escapes.get(text[i], text[i]))
            else:
                chars.append(text[i])
            i += 1
        if i >= len(text):
            raise GenerationError(f"Unterminated string in {constant_name}")
        i += 1
        result.append("".join(chars))
        while i < len(text) and text[i].isspace():
            i += 1
        if text[i] == ",":
            i += 1
            expect_value = True
        elif text[i] == "]":
            return result
        else:
            raise GenerationError(f"Unexpected token in {constant_name}")
    raise GenerationError(f"Unterminated array: {constant_name}")


def assert_equal(label: str, actual: int) -> None:
    expected = EXPECTED[label]
    if actual != expected:
        raise GenerationError(f"Regression assertion failed: {label}: expected={expected}, actual={actual}")


def source_location(npc_id: str, result_id: str, field: str) -> str:
    return f"CRAFT_DATA.CRAFT_RECIPES.{npc_id}[result={result_id}].{field}"


def build_data(text: str) -> tuple[dict[str, Any], dict[str, int]]:
    craft = extract_json_constant(text, "CRAFT_DATA")
    equip = extract_json_constant(text, "EQUIP_DATA")
    npc_order = parse_restricted_string_array(text, "NPC_ORDER")

    recipes_by_npc = craft["CRAFT_RECIPES"]
    items_db = craft["ITEMS_DB"]
    drops_db = craft["DROPS_DB"]
    npc_info = craft["NPC_INFO"]
    equip_by_id: dict[str, dict[str, Any]] = {}
    for entity in equip:
        entity_id = entity["id"]
        if entity_id in equip_by_id:
            raise GenerationError(f"Duplicate EQUIP_DATA id: {entity_id}")
        equip_by_id[entity_id] = entity

    raw_rows: list[tuple[str, dict[str, Any]]] = []
    result_ids: set[str] = set()
    requirement_ids: set[str] = set()
    missing_result_items: set[str] = set()
    missing_requirement_items: set[str] = set()
    recipe_pair_counts: Counter[tuple[str, str]] = Counter()

    for npc_id, npc_recipes in recipes_by_npc.items():
        for raw in npc_recipes:
            result_id = raw["result"]
            raw_rows.append((npc_id, raw))
            result_ids.add(result_id)
            recipe_pair_counts[(npc_id, result_id)] += 1
            if result_id not in items_db:
                missing_result_items.add(result_id)
            seen_requirements: set[str] = set()
            gold_count = 0
            for requirement in raw["req"]:
                item_id = requirement["id"]
                quantity = requirement["cnt"]
                if not isinstance(quantity, int) or isinstance(quantity, bool) or quantity <= 0:
                    raise GenerationError(f"Invalid requirement quantity: {npc_id}/{result_id}/{item_id}")
                if item_id == "gold":
                    gold_count += 1
                    continue
                if item_id in seen_requirements:
                    raise GenerationError(f"Duplicate requirement itemId: {npc_id}/{result_id}/{item_id}")
                seen_requirements.add(item_id)
                requirement_ids.add(item_id)
                if item_id not in items_db:
                    missing_requirement_items.add(item_id)
            if gold_count > 1:
                raise GenerationError(f"Multiple gold requirements: {npc_id}/{result_id}")

    duplicate_pairs = sorted(pair for pair, count in recipe_pair_counts.items() if count > 1)
    if duplicate_pairs:
        raise GenerationError(
            "Same NPC/result requires a version-controlled variant mapping: " + repr(duplicate_pairs)
        )

    recipe_npc_ids = set(recipes_by_npc)
    order_set = set(npc_order)
    missing_npc_info = recipe_npc_ids - set(npc_info)
    outside_order = recipe_npc_ids - order_set
    skillbook_results = {
        item_id for item_id in result_ids
        if equip_by_id.get(item_id, {}).get("category") == "skillbook"
    }
    equipment_results = {
        item_id for item_id in result_ids
        if equip_by_id.get(item_id, {}).get("category") == "equipment"
    }
    requirements_with_drops = {item_id for item_id in requirement_ids if drops_db.get(item_id)}
    requirements_without_drops = requirement_ids - requirements_with_drops
    non_unit_yield = [(npc_id, raw) for npc_id, raw in raw_rows if raw.get("yield") != 1]

    assertions = {
        "npc_count": len(recipe_npc_ids),
        "recipe_count": len(raw_rows),
        "unique_results": len(result_ids),
        "unique_requirements_ex_gold": len(requirement_ids),
        "skillbook_results": len(skillbook_results),
        "equipment_results": len(equipment_results),
        "requirements_with_drops": len(requirements_with_drops),
        "requirements_without_drops": len(requirements_without_drops),
        "non_unit_yield_recipes": len(non_unit_yield),
        "missing_result_items": len(missing_result_items),
        "missing_requirement_items": len(missing_requirement_items),
        "missing_npc_info": len(missing_npc_info),
        "recipe_npcs_outside_order": len(outside_order),
    }
    for label, actual in assertions.items():
        assert_equal(label, actual)

    recipes: list[dict[str, Any]] = []
    for npc_id, raw in raw_rows:
        result_id = raw["result"]
        requirements = []
        gold_amount = 0
        for requirement in raw["req"]:
            if requirement["id"] == "gold":
                gold_amount = requirement["cnt"]
            else:
                requirements.append({"itemId": requirement["id"], "quantity": requirement["cnt"]})
        requirements.sort(key=lambda value: value["itemId"])
        recipe_id = f"recipe_{npc_id}_{result_id}_01"
        recipes.append({
            "id": recipe_id,
            "npcId": npc_id,
            "result": {"itemId": result_id, "quantity": raw["yield"]},
            "requirements": requirements,
            "currencyCost": {"currency": "gold", "amount": gold_amount},
            "description": raw.get("desc") or None,
            "isSpecial": bool(raw.get("is_special", False)),
            "specialNote": raw.get("spec_note") or None,
        })
    recipes.sort(key=lambda value: value["id"])
    if len({recipe["id"] for recipe in recipes}) != len(recipes):
        raise GenerationError("Duplicate generated recipe ID")

    closure = sorted(result_ids | requirement_ids)
    items: list[dict[str, Any]] = []
    for item_id in closure:
        source = items_db.get(item_id)
        if source is None:
            items.append({
                "id": item_id,
                "name": None,
                "itemType": "unknown",
                "entityRef": None,
                "linkStatus": "unresolved",
                "dataStatus": "stub",
            })
            continue
        entity = equip_by_id.get(item_id)
        category = entity.get("category") if entity else None
        if category == "equipment":
            item_type = "equipment"
            entity_ref = {"entityType": "equipment", "entityId": item_id}
            link_status = "resolved"
        elif category == "skillbook":
            item_type = "skillbook"
            entity_ref = None
            link_status = "unresolved"
        elif source.get("type") == "etc":
            item_type = "material"
            entity_ref = None
            link_status = "unresolved"
        else:
            item_type = "misc"
            entity_ref = None
            link_status = "unresolved"
        items.append({
            "id": item_id,
            "name": source.get("name"),
            "itemType": item_type,
            "entityRef": entity_ref,
            "linkStatus": link_status,
            "dataStatus": "complete",
        })

    ordered_recipe_npcs = [npc_id for npc_id in npc_order if npc_id in recipe_npc_ids]
    ordered_recipe_npcs.extend(sorted(outside_order))
    if len(ordered_recipe_npcs) != len(recipe_npc_ids) or len(set(ordered_recipe_npcs)) != len(recipe_npc_ids):
        raise GenerationError("NPC deterministic ordering is incomplete or duplicated")
    npcs: list[dict[str, Any]] = []
    for sort_order, npc_id in enumerate(ordered_recipe_npcs):
        info = npc_info.get(npc_id)
        if info is None:
            npcs.append({
                "id": npc_id,
                "name": None,
                "locationText": None,
                "regionId": None,
                "description": None,
                "linkStatus": "unresolved",
                "dataStatus": "stub",
                "sortOrder": sort_order,
            })
        else:
            npcs.append({
                "id": npc_id,
                "name": info.get("name"),
                "locationText": info.get("loc"),
                "regionId": None,
                "description": info.get("desc") or None,
                "linkStatus": "unresolved",
                "dataStatus": "complete",
                "sortOrder": sort_order,
            })

    drops: list[dict[str, Any]] = []
    monster_names: set[str] = set()
    for item_id in closure:
        legacy_sources = drops_db.get(item_id) or []
        sources = []
        for legacy in legacy_sources:
            monster_name = legacy["mob"]
            monster_names.add(monster_name)
            sources.append({
                "sourceType": "monster_drop",
                "monsterId": None,
                "monsterNameText": monster_name,
                "rate": legacy["rate"],
                "rateUnit": "percent",
                "locationTexts": sorted(legacy.get("maps") or []),
            })
        sources.sort(key=lambda value: (value["monsterNameText"], value["rate"], value["locationTexts"]))
        drops.append({
            "itemId": item_id,
            "sourceStatus": "unresolved" if sources else "unknown",
            "sources": sources,
        })

    unresolved: list[dict[str, Any]] = []
    for item_id in sorted(missing_result_items):
        contexts = [source_location(npc_id, raw["result"], "result") for npc_id, raw in raw_rows if raw["result"] == item_id]
        unresolved.append({"type": "missing_result_item", "id": item_id, "reason": "Recipe result has no ITEMS_DB record; unresolved Item stub created.", "sourceLocation": contexts[0], "severity": "warning", "blocking": False})
    for item_id in sorted(missing_requirement_items):
        contexts = [source_location(npc_id, raw["result"], "requirements") for npc_id, raw in raw_rows if any(req["id"] == item_id for req in raw["req"])]
        unresolved.append({"type": "missing_requirement_item", "id": item_id, "reason": "Recipe requirement has no ITEMS_DB record; unresolved Item stub created.", "sourceLocation": contexts[0], "severity": "warning", "blocking": False})
    for npc_id in sorted(missing_npc_info):
        unresolved.append({"type": "unresolved_npc", "id": npc_id, "reason": "Recipe NPC has no NPC_INFO record; unresolved Npc stub created.", "sourceLocation": f"CRAFT_DATA.CRAFT_RECIPES.{npc_id}", "severity": "warning", "blocking": False})
    for item_id in sorted(skillbook_results):
        unresolved.append({"type": "unresolved_skill_mapping", "id": item_id, "reason": "Skillbook item exists but no verified skill entity ID is available.", "sourceLocation": f"EQUIP_DATA[id={item_id}]", "severity": "info", "blocking": False})
    for npc_id in sorted(recipe_npc_ids):
        unresolved.append({"type": "unresolved_region_mapping", "id": npc_id, "reason": "NPC location is display text only; no verified region ID is available.", "sourceLocation": f"CRAFT_DATA.NPC_INFO.{npc_id}" if npc_id in npc_info else f"CRAFT_DATA.CRAFT_RECIPES.{npc_id}", "severity": "info", "blocking": False})
    for monster_name in sorted(monster_names):
        unresolved.append({"type": "unresolved_monster_mapping", "id": monster_name, "reason": "Legacy source uses monsterNameText; no verified monster ID is available.", "sourceLocation": "CRAFT_DATA.DROPS_DB", "severity": "info", "blocking": False})
    for item_id in sorted(requirements_without_drops):
        unresolved.append({"type": "unknown_material_source", "id": item_id, "reason": "No verifiable acquisition source exists in current DROPS_DB; no source type inferred.", "sourceLocation": f"CRAFT_DATA.DROPS_DB.{item_id}", "severity": "info", "blocking": False})
    unresolved.sort(key=lambda value: (value["type"], value["id"], value["sourceLocation"]))

    return {
        "recipes.json": recipes,
        "items.json": items,
        "npcs.json": npcs,
        "drops.json": drops,
        "unresolved.json": unresolved,
    }, assertions


def write_json(path: Path, value: Any) -> None:
    payload = json.dumps(value, ensure_ascii=False, indent=2, sort_keys=True, allow_nan=False) + "\n"
    path.write_text(payload, encoding="utf-8", newline="\n")


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--source", type=Path, default=DEFAULT_SOURCE)
    parser.add_argument("--output-dir", type=Path, default=DEFAULT_OUTPUT)
    args = parser.parse_args()
    text = args.source.read_text(encoding="utf-8")
    outputs, assertions = build_data(text)
    args.output_dir.mkdir(parents=True, exist_ok=True)
    for filename in sorted(outputs):
        write_json(args.output_dir / filename, outputs[filename])
    print(json.dumps({"written": sorted(outputs), "assertions": assertions}, ensure_ascii=False, sort_keys=True))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
