#!/usr/bin/env python3
"""Validate Monster C2-A schemas, identities, references, ordering and bytes."""

from __future__ import annotations

import argparse
import hashlib
import json
import tempfile
from pathlib import Path
from typing import Any

from jsonschema import Draft202012Validator

from generate_monster_data import DEFAULT_OUTPUT, ROOT, extract, generate

DEFAULT_SCHEMAS = ROOT / "schemas"
FILES = ("monsters.json", "maps.json", "drop_tables.json", "unresolved.json")


class ValidationError(RuntimeError):
    pass


def require(condition: bool, message: str) -> None:
    if not condition:
        raise ValidationError(message)


def load(path: Path) -> Any:
    return json.loads(path.read_text(encoding="utf-8"))


def schema_validate(value: Any, path: Path) -> None:
    errors = sorted(Draft202012Validator(load(path)).iter_errors(value), key=lambda e: list(e.path))
    if errors:
        details = "\n".join(f"{list(e.path)}: {e.message}" for e in errors[:20])
        raise ValidationError(f"Schema validation failed for {path.name}:\n{details}")


def unique(records: list[dict[str, Any]], key: str, label: str) -> dict[str, dict[str, Any]]:
    result = {}
    for record in records:
        value = record[key]
        require(value not in result, f"Duplicate {label}: {value}")
        result[value] = record
    return result


def ref_key(value: dict[str, str]) -> tuple[str, str]:
    return value["entityType"], value["entityId"]


def require_sorted(values: list[Any], key, label: str) -> None:
    require(values == sorted(values, key=key), f"Non-deterministic ordering: {label}")


def validate(data_dir: Path, schema_dir: Path, source_root: Path, check_deterministic: bool = True, source_revision: str | None = None) -> dict[str, Any]:
    monsters_doc, maps_doc, drops_doc, unresolved_doc = (load(data_dir / f) for f in FILES)
    schema_validate(monsters_doc, schema_dir / "monster.schema.json")
    schema_validate(maps_doc, schema_dir / "map.schema.json")
    schema_validate(drops_doc, schema_dir / "drop-table.schema.json")

    monsters = monsters_doc["records"]
    maps = maps_doc["records"]
    tables = drops_doc["records"]
    monster_by_id = unique(monsters, "monsterId", "monster ID")
    map_by_id = unique(maps, "mapId", "map ID")
    table_by_id = unique(tables, "dropTableId", "drop table ID")
    entry_by_id: dict[str, dict[str, Any]] = {}
    item_ids = set(extract(source_root)["itemIds"])

    require_sorted(monsters, lambda x: x["monsterId"], "monsters")
    require_sorted(maps, lambda x: x["mapId"], "maps")
    require_sorted(tables, lambda x: x["dropTableId"], "drop tables")
    require_sorted(unresolved_doc["records"], lambda x: (x["code"], x["entityRef"]["entityType"], x["entityRef"]["entityId"]), "unresolved")

    for monster in monsters:
        mid = monster["monsterId"]
        require(ref_key(monster["entityRef"]) == ("monster", mid), f"Invalid monster entityRef: {mid}")
        require(monster["stats"]["goldMin"] <= monster["stats"]["goldMax"], f"Invalid gold range: {mid}")
        require_sorted(monster["mapRef"], ref_key, f"monster mapRef {mid}")
        for map_ref in monster["mapRef"]:
            require(ref_key(map_ref)[0] == "map" and map_ref["entityId"] in map_by_id, f"Invalid MapRef for {mid}: {map_ref}")
        table_ref = monster["dropTableRef"]
        if table_ref is not None:
            require(ref_key(table_ref)[0] == "dropTable" and table_ref["entityId"] in table_by_id, f"Invalid DropRef for {mid}: {table_ref}")
        require(monster["cardRef"] is None, f"CardRef cannot resolve before Card contract: {mid}")

    for map_record in maps:
        map_id = map_record["mapId"]
        require(ref_key(map_record["entityRef"]) == ("map", map_id), f"Invalid map entityRef: {map_id}")
        for field in ("monsterRefs", "bossRefs"):
            require_sorted(map_record[field], ref_key, f"map {field} {map_id}")
            for monster_ref in map_record[field]:
                require(ref_key(monster_ref)[0] == "monster" and monster_ref["entityId"] in monster_by_id, f"Invalid MonsterRef for {map_id}: {monster_ref}")
        require(set(x["entityId"] for x in map_record["monsterRefs"]).isdisjoint(x["entityId"] for x in map_record["bossRefs"]), f"Boss/normal overlap: {map_id}")

    entry_schema = schema_dir / "drop-entry.schema.json"
    for table in tables:
        table_id = table["dropTableId"]
        require(ref_key(table["entityRef"]) == ("dropTable", table_id), f"Invalid drop table entityRef: {table_id}")
        owner = table["owner"]
        if owner is None:
            require(table["ownerType"] == "unknown" and table["status"] == "unresolved" and bool(table["ownerNameText"]), f"Invalid unresolved DropOwner: {table_id}")
        else:
            require(ref_key(owner)[0] == "monster" and owner["entityId"] in monster_by_id and table["ownerType"] == "monster", f"Invalid DropOwner: {table_id}")
        require_sorted(table["entries"], lambda x: x["dropEntryId"], f"drop entries {table_id}")
        for entry in table["entries"]:
            schema_validate(entry, entry_schema)
            entry_id = entry["dropEntryId"]
            require(entry_id not in entry_by_id, f"Duplicate drop entry ID: {entry_id}")
            entry_by_id[entry_id] = entry
            require(ref_key(entry["entityRef"]) == ("dropEntry", entry_id), f"Invalid drop entry entityRef: {entry_id}")
            require(ref_key(entry["dropTableRef"]) == ("dropTable", table_id), f"Invalid dropTableRef: {entry_id}")
            require(ref_key(entry["itemRef"])[0] == "item" and entry["itemRef"]["entityId"] in item_ids, f"Invalid ItemRef: {entry_id}")

    for monster in monsters:
        mid = monster["monsterId"]
        for map_ref in monster["mapRef"]:
            target = map_by_id[map_ref["entityId"]]
            pool = {x["entityId"] for x in target["monsterRefs"] + target["bossRefs"]}
            require(mid in pool, f"Monster/map reverse relation mismatch: {mid} -> {map_ref['entityId']}")

    byte_hashes = {name: hashlib.sha256((data_dir / name).read_bytes()).hexdigest() for name in FILES}
    if check_deterministic:
        with tempfile.TemporaryDirectory() as first, tempfile.TemporaryDirectory() as second:
            generate(source_root, Path(first), source_revision)
            generate(source_root, Path(second), source_revision)
            for name in FILES:
                a, b, current = (Path(first) / name).read_bytes(), (Path(second) / name).read_bytes(), (data_dir / name).read_bytes()
                require(a == b, f"Generator is not byte stable: {name}")
                require(a == current, f"Checked-in output is stale: {name}")

    return {"monsters": len(monsters), "maps": len(maps), "dropTables": len(tables), "dropEntries": len(entry_by_id), "unresolved": len(unresolved_doc["records"]), "schema": "passed", "deterministic": check_deterministic, "byteHashes": byte_hashes}


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--data-dir", type=Path, default=DEFAULT_OUTPUT)
    parser.add_argument("--schema-dir", type=Path, default=DEFAULT_SCHEMAS)
    parser.add_argument("--source-root", type=Path, default=ROOT)
    parser.add_argument("--source-revision")
    parser.add_argument("--skip-deterministic", action="store_true")
    args = parser.parse_args()
    try:
        result = validate(args.data_dir, args.schema_dir, args.source_root, not args.skip_deterministic, args.source_revision)
    except (ValidationError, OSError, ValueError) as error:
        print(f"FAILED: {error}")
        return 1
    print(json.dumps(result, ensure_ascii=False, sort_keys=True))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
