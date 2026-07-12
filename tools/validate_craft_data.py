#!/usr/bin/env python3
"""Validate Phase 1 craft JSON, indexes, graph safety, yields, and baselines."""

from __future__ import annotations

import argparse
import hashlib
import json
import math
from collections import Counter, defaultdict
from pathlib import Path
from typing import Any

from jsonschema import Draft202012Validator


ROOT = Path(__file__).resolve().parents[1]
DEFAULT_DATA = ROOT / "data" / "craft"
DEFAULT_SCHEMAS = ROOT / "schemas"
FILES = ("recipes.json", "items.json", "npcs.json", "drops.json", "unresolved.json")
EXPECTED = {
    "npcs": 47,
    "recipes": 279,
    "unique_results": 272,
    "unique_requirements": 278,
    "skillbook_results": 14,
    "equipment_results": 213,
    "requirements_with_drops": 193,
    "requirements_without_drops": 85,
    "non_unit_yields": 4,
    "stub_result_items": 9,
    "stub_requirement_items": 18,
    "stub_npcs": 1,
    "npcs_outside_legacy_order": 18,
}
NON_UNIT_CASES = {
    ("npc_narupa", "wpn_30"): 10,
    ("npc_narupa", "wpn_5"): 100,
    ("npc_elf", "new_item_169"): 20,
    ("npc_elf", "new_item_170"): 20,
}


class ValidationError(RuntimeError):
    pass


def require(condition: bool, message: str) -> None:
    if not condition:
        raise ValidationError(message)


def load_json(path: Path) -> Any:
    return json.loads(path.read_text(encoding="utf-8"))


def ensure_unique(records: list[dict[str, Any]], key: str, label: str) -> dict[str, dict[str, Any]]:
    result: dict[str, dict[str, Any]] = {}
    for record in records:
        value = record[key]
        require(value not in result, f"Duplicate {label}: {value}")
        result[value] = record
    return result


def validate_schema(instance: Any, schema_path: Path) -> None:
    schema = load_json(schema_path)
    errors = sorted(Draft202012Validator(schema).iter_errors(instance), key=lambda error: list(error.path))
    if errors:
        details = "\n".join(f"{list(error.path)}: {error.message}" for error in errors[:20])
        raise ValidationError(f"Schema validation failed for {schema_path.name}:\n{details}")


def check_cycle_guard(recipes_by_result: dict[str, list[dict[str, Any]]]) -> None:
    graph: dict[str, set[str]] = defaultdict(set)
    for result_id, recipes in recipes_by_result.items():
        for recipe in recipes:
            for requirement in recipe["requirements"]:
                if requirement["itemId"] in recipes_by_result:
                    graph[result_id].add(requirement["itemId"])
    visiting: set[str] = set()
    visited: set[str] = set()

    def visit(node: str, path: list[str]) -> None:
        if node in visiting:
            raise ValidationError("Recipe graph cycle: " + " -> ".join(path + [node]))
        if node in visited:
            return
        visiting.add(node)
        for child in sorted(graph.get(node, set())):
            visit(child, path + [node])
        visiting.remove(node)
        visited.add(node)

    for node in sorted(graph):
        visit(node, [])


def validate(data_dir: Path, schema_dir: Path) -> dict[str, Any]:
    recipes = load_json(data_dir / "recipes.json")
    items = load_json(data_dir / "items.json")
    npcs = load_json(data_dir / "npcs.json")
    drops = load_json(data_dir / "drops.json")
    unresolved = load_json(data_dir / "unresolved.json")

    validate_schema(recipes, schema_dir / "craft-recipe.schema.json")
    validate_schema(items, schema_dir / "craft-item.schema.json")
    validate_schema(npcs, schema_dir / "craft-npc.schema.json")
    validate_schema(drops, schema_dir / "craft-source.schema.json")

    recipes_by_id = ensure_unique(recipes, "id", "recipe ID")
    items_by_id = ensure_unique(items, "id", "item ID")
    npcs_by_id = ensure_unique(npcs, "id", "NPC ID")
    sources_by_item_id = ensure_unique(drops, "itemId", "source item ID")
    recipes_by_npc_id: dict[str, list[dict[str, Any]]] = defaultdict(list)
    recipes_by_result_id: dict[str, list[dict[str, Any]]] = defaultdict(list)
    recipes_by_requirement_id: dict[str, list[dict[str, Any]]] = defaultdict(list)

    # Keep every NPC data key in the formal index, including the contracted
    # npc_mystic_mage stub whose legacy recipe array is currently empty.
    for npc_id in npcs_by_id:
        recipes_by_npc_id[npc_id] = []

    for recipe in recipes:
        require(recipe["id"].endswith("_01"), f"Recipe variant is not contract-backed: {recipe['id']}")
        require(recipe["npcId"] in npcs_by_id, f"Missing NPC/stub: {recipe['npcId']}")
        result_id = recipe["result"]["itemId"]
        require(result_id in items_by_id, f"Missing result Item/stub: {result_id}")
        require(isinstance(recipe["result"]["quantity"], int) and recipe["result"]["quantity"] > 0, f"Invalid result quantity: {recipe['id']}")
        cost = recipe["currencyCost"]
        require(cost["currency"] == "gold", f"Unsupported currency: {recipe['id']}")
        require(isinstance(cost["amount"], (int, float)) and not isinstance(cost["amount"], bool) and math.isfinite(cost["amount"]) and cost["amount"] >= 0, f"Invalid currency amount: {recipe['id']}")
        seen: set[str] = set()
        for requirement in recipe["requirements"]:
            item_id = requirement["itemId"]
            require(item_id != "gold", f"Gold remains in requirements: {recipe['id']}")
            require(item_id not in seen, f"Duplicate requirement: {recipe['id']}/{item_id}")
            seen.add(item_id)
            require(item_id in items_by_id, f"Missing requirement Item/stub: {item_id}")
            require(isinstance(requirement["quantity"], int) and requirement["quantity"] > 0, f"Invalid requirement quantity: {recipe['id']}/{item_id}")
            recipes_by_requirement_id[item_id].append(recipe)
        recipes_by_npc_id[recipe["npcId"]].append(recipe)
        recipes_by_result_id[result_id].append(recipe)

    for values in (recipes_by_npc_id, recipes_by_result_id, recipes_by_requirement_id):
        for records in values.values():
            records.sort(key=lambda recipe: recipe["id"])
    require(all(isinstance(value, list) for value in recipes_by_result_id.values()), "recipesByResultId values must be arrays")

    for item in items:
        entity_ref = item["entityRef"]
        if item["linkStatus"] == "resolved":
            require(entity_ref is not None, f"Resolved item lacks entityRef: {item['id']}")
            require(entity_ref["entityId"] == item["id"], f"EntityRef ID mismatch: {item['id']}")
        else:
            require(entity_ref is None, f"Unresolved item has entityRef: {item['id']}")
    require(set(sources_by_item_id) == set(items_by_id), "drops.json must cover the complete Phase 1 item closure")
    for record in drops:
        for source in record["sources"]:
            require(source["monsterId"] is None, f"Unverified monster ID present: {record['itemId']}")
            require(source["rateUnit"] == "percent", f"Unknown rate unit: {record['itemId']}")

    check_cycle_guard(recipes_by_result_id)

    result_ids = set(recipes_by_result_id)
    requirement_ids = set(recipes_by_requirement_id)
    skillbook_results = {item_id for item_id in result_ids if items_by_id[item_id]["itemType"] == "skillbook"}
    equipment_results = {item_id for item_id in result_ids if items_by_id[item_id]["itemType"] == "equipment"}
    with_drops = {item_id for item_id in requirement_ids if sources_by_item_id[item_id]["sources"]}
    without_drops = requirement_ids - with_drops
    missing_result = {entry["id"] for entry in unresolved if entry["type"] == "missing_result_item"}
    missing_requirement = {entry["id"] for entry in unresolved if entry["type"] == "missing_requirement_item"}
    outside_order = {entry["id"] for entry in unresolved if entry["type"] == "unresolved_npc"}
    stub_npcs = {npc["id"] for npc in npcs if npc["dataStatus"] == "stub"}

    actual = {
        "npcs": len(npcs),
        "recipes": len(recipes),
        "unique_results": len(result_ids),
        "unique_requirements": len(requirement_ids),
        "skillbook_results": len(skillbook_results),
        "equipment_results": len(equipment_results),
        "requirements_with_drops": len(with_drops),
        "requirements_without_drops": len(without_drops),
        "non_unit_yields": sum(recipe["result"]["quantity"] != 1 for recipe in recipes),
        "stub_result_items": len(missing_result),
        "stub_requirement_items": len(missing_requirement),
        "stub_npcs": len(stub_npcs),
        "npcs_outside_legacy_order": sum(npc["sortOrder"] >= 29 for npc in npcs),
    }
    for key, expected in EXPECTED.items():
        require(actual[key] == expected, f"Regression assertion failed: {key}: expected={expected}, actual={actual[key]}")

    yield_tests = []
    for (npc_id, result_id), expected_yield in NON_UNIT_CASES.items():
        matches = [recipe for recipe in recipes_by_result_id[result_id] if recipe["npcId"] == npc_id]
        require(len(matches) == 1, f"Yield case recipe mismatch: {npc_id}/{result_id}")
        recipe = matches[0]
        require(recipe["result"]["quantity"] == expected_yield, f"Yield mismatch: {recipe['id']}")
        target = expected_yield + 1
        craft_count = math.ceil(target / expected_yield)
        actual_output = craft_count * expected_yield
        required_gold = recipe["currencyCost"]["amount"] * craft_count
        materials = {requirement["itemId"]: requirement["quantity"] * craft_count for requirement in recipe["requirements"]}
        require(craft_count == 2 and actual_output >= target, f"Yield ceil formula failed: {recipe['id']}")
        yield_tests.append({"recipeId": recipe["id"], "targetQuantity": target, "craftCount": craft_count, "actualOutput": actual_output, "requiredGold": required_gold, "requiredMaterials": materials})

    hashes = {filename: hashlib.sha256((data_dir / filename).read_bytes()).hexdigest() for filename in FILES}
    unresolved_counts = dict(sorted(Counter(entry["type"] for entry in unresolved).items()))
    return {
        "counts": actual,
        "indexes": {
            "recipesById": len(recipes_by_id),
            "recipesByNpcId": len(recipes_by_npc_id),
            "recipesByResultId": len(recipes_by_result_id),
            "recipesByRequirementId": len(recipes_by_requirement_id),
            "itemsById": len(items_by_id),
            "npcsById": len(npcs_by_id),
            "sourcesByItemId": len(sources_by_item_id),
        },
        "cycleCheck": "passed",
        "yieldTests": yield_tests,
        "unresolved": unresolved_counts,
        "hashes": hashes,
    }


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--data-dir", type=Path, default=DEFAULT_DATA)
    parser.add_argument("--schema-dir", type=Path, default=DEFAULT_SCHEMAS)
    args = parser.parse_args()
    result = validate(args.data_dir, args.schema_dir)
    print(json.dumps(result, ensure_ascii=False, indent=2, sort_keys=True))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
