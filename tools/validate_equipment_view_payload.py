#!/usr/bin/env python3
"""Validate Equipment E3-D2 view payload identity, parity, safety, and reproducibility."""

from __future__ import annotations

import argparse
import hashlib
import json
import re
import tempfile
from pathlib import Path
from typing import Any

from jsonschema import Draft202012Validator

from generate_equipment_data import canonical_bytes, load
from generate_equipment_view_payload import (
    BUCKETS,
    DEFAULT_CANONICAL,
    DEFAULT_OUTPUT,
    INDEX_FILE,
    build_index_record,
    detail_filename,
    generate,
)

ROOT = Path(__file__).resolve().parents[1]
DEFAULT_SCHEMAS = ROOT / "schemas"
DETAIL_FILES = tuple(f"equipment-details-{bucket}.json" for bucket in BUCKETS)
FILES = (INDEX_FILE, *DETAIL_FILES)
SEARCH_FIXTURES = ("傳送控制戒指", "傳送控制", "acc_116", "武器", "防具", "戒指", "盾牌", "雙手劍", "弓", "魔杖")
WINDOWS_ABSOLUTE = re.compile(r"(?:^|[\"'\s])[A-Za-z]:[\\/]")
SAFE_LOCATOR = re.compile(r"^data/equipment/equipment-details-([0-9a-f])\.json$")
LABELS = {
    "weapon": "武器", "armor": "防具", "accessory": "飾品", "one_hand_sword": "單手劍",
    "two_hand_sword": "雙手劍", "dagger": "短劍 匕首", "blunt": "單手鈍器", "two_hand_blunt": "雙手鈍器",
    "spear": "單手矛", "two_hand_spear": "雙手矛", "bow": "弓", "crossbow": "十字弓", "staff": "魔杖",
    "claw": "鋼爪", "dual_blade": "雙刀", "chain_sword": "鎖鏈劍", "kiringku": "奇古獸",
    "other_weapon": "其他武器", "helmet": "頭盔", "cloak": "斗篷", "gloves": "手套", "boots": "靴子",
    "tshirt": "T恤", "greaves": "脛甲", "shield": "盾牌", "necklace": "項鍊", "earring": "耳環",
    "belt": "皮帶", "ring": "戒指", "arrow": "箭矢", "pet_weapon": "寵物武器", "pet_armor": "寵物防具",
}


class ValidationError(RuntimeError):
    pass


def require(condition: bool, code: str, detail: str = "") -> None:
    if not condition:
        raise ValidationError(f"{code}: {detail}" if detail else code)


def schema_validate(value: dict[str, Any], schema: dict[str, Any], code: str) -> None:
    errors = sorted(Draft202012Validator(schema).iter_errors(value), key=lambda error: list(error.path))
    require(not errors, code, errors[0].message if errors else "")


def legacy_records(source_root: Path) -> dict[str, dict[str, Any]]:
    text = (source_root / "wiki.html").read_text(encoding="utf-8")
    match = re.search(r"const EQUIP_DATA = (\[.*?\]);\r?\n", text, re.S)
    require(bool(match), "search_fixture_parity", "EQUIP_DATA literal missing")
    return {row["id"]: row for row in json.loads(match.group(1)) if row.get("category") == "equipment"}


def legacy_search_text(record: dict[str, Any] | None) -> str:
    if not record:
        return ""
    sources = re.sub(r"<[^>]*>", " ", " ".join(record.get("sources", [])))
    values = " ".join(str(value) for value in (record.get("stats") or {}).values())
    return " ".join([record.get("name", ""), record.get("desc", ""), record.get("slot_cn", ""), sources, values]).lower()


def searchable_text(record: dict[str, Any], legacy: dict[str, Any] | None) -> str:
    description = record["description"]["canonicalText"] or ""
    values = [
        record["displayName"], record["equipmentId"], LABELS.get(record["equipmentGroup"], ""),
        LABELS.get(record["equipmentType"], ""), LABELS.get(record["slot"], ""), record["equipmentGroup"],
        record["equipmentType"], record["slot"], description, legacy_search_text(legacy),
    ]
    return " ".join(values).lower()


def validate(
    data_dir: Path = DEFAULT_OUTPUT,
    canonical_path: Path = DEFAULT_CANONICAL,
    schema_dir: Path = DEFAULT_SCHEMAS,
    source_root: Path = ROOT,
    check_deterministic: bool = True,
) -> dict[str, Any]:
    canonical_raw_before = canonical_path.read_bytes()
    canonical_document = load(canonical_path)
    canonical_records = sorted(canonical_document["records"], key=lambda row: row["equipmentId"])
    canonical_by_id = {row["equipmentId"]: row for row in canonical_records}
    require(len(canonical_records) == len(canonical_by_id) == 786, "invalid_equipment_count")

    index_schema = load(schema_dir / "equipment-view-index.schema.json")
    equipment_schema = load(schema_dir / "equipment.schema.json")
    index_document = load(data_dir / INDEX_FILE)
    schema_validate(index_document, index_schema, "view_index_schema_failed")
    index_records = index_document["records"]
    require(index_records == sorted(index_records, key=lambda row: row["equipmentId"]), "unstable_view_output", "index order")
    index_by_id = {row["equipmentId"]: row for row in index_records}
    require(len(index_records) == len(index_by_id) == 786, "duplicate_equipment_id")
    require(set(index_by_id) == set(canonical_by_id), "identity_parity_failed")

    for equipment_id, summary in index_by_id.items():
        canonical = canonical_by_id[equipment_id]
        require(summary == build_index_record(canonical), "summary_parity_failed", equipment_id)
        require((summary["equipmentGroup"], summary["equipmentType"], summary["slot"]) == (canonical["equipmentGroup"], canonical["equipmentType"], canonical["slot"]), "classification_parity_failed", equipment_id)
        require("verification" not in summary and "relations" not in summary and "version" not in summary, "forbidden_index_payload", equipment_id)
        locator_match = SAFE_LOCATOR.fullmatch(summary["detailLocator"])
        require(bool(locator_match) and ".." not in summary["detailLocator"] and "\\" not in summary["detailLocator"], "invalid_detail_locator", equipment_id)
        require(detail_filename(equipment_id) == Path(summary["detailLocator"]).name, "invalid_detail_locator", equipment_id)

    detail_by_id: dict[str, dict[str, Any]] = {}
    detail_file_by_id: dict[str, str] = {}
    for name in DETAIL_FILES:
        document = load(data_dir / name)
        bucket = name[-6]
        require(document.get("dataset") == "equipment_view_details" and document.get("schemaVersion") == "1.0.0" and document.get("viewPayloadVersion") == "1.0.0" and document.get("bucket") == bucket and isinstance(document.get("records"), list), "invalid_detail_envelope", name)
        require(document["records"] == sorted(document["records"], key=lambda row: row["equipmentId"]), "unstable_view_output", name)
        for record in document["records"]:
            schema_validate(record, equipment_schema, "detail_schema_failed")
            equipment_id = record["equipmentId"]
            require(equipment_id not in detail_by_id, "duplicate_equipment_id", equipment_id)
            require(detail_filename(equipment_id) == name, "invalid_detail_locator", equipment_id)
            detail_by_id[equipment_id] = record
            detail_file_by_id[equipment_id] = name

    require(set(detail_by_id) <= set(canonical_by_id), "orphan_detail")
    require(set(detail_by_id) >= set(canonical_by_id), "missing_detail")
    for equipment_id, canonical in canonical_by_id.items():
        require(detail_by_id[equipment_id] == canonical, "detail_parity_failed", equipment_id)
        require(Path(index_by_id[equipment_id]["detailLocator"]).name == detail_file_by_id[equipment_id], "invalid_detail_locator", equipment_id)

    legacy_by_id = legacy_records(source_root)
    expected = [build_index_record(record) for record in canonical_records]
    search_results: dict[str, int] = {}
    for fixture in SEARCH_FIXTURES:
        query = fixture.lower()
        actual_ids = [row["equipmentId"] for row in index_records if query in searchable_text(row, legacy_by_id.get(row["equipmentId"]))]
        expected_ids = [row["equipmentId"] for row in expected if query in searchable_text(row, legacy_by_id.get(row["equipmentId"]))]
        require(actual_ids == expected_ids and actual_ids, "search_fixture_parity", fixture)
        search_results[fixture] = len(actual_ids)

    hashes: dict[str, str] = {}
    sizes: dict[str, int] = {}
    for name in FILES:
        raw = (data_dir / name).read_bytes()
        raw.decode("utf-8")
        require(not raw.startswith(b"\xef\xbb\xbf") and b"\r\n" not in raw and raw.endswith(b"\n") and not raw.endswith(b"\n\n"), "unstable_view_output", name)
        require(raw == canonical_bytes(load(data_dir / name)), "unstable_view_output", name)
        text = raw.decode("utf-8")
        require(not WINDOWS_ABSOLUTE.search(text) and "file://" not in text.lower() and "localhost" not in text.lower() and "127.0.0.1" not in text, "local_path_leak", name)
        hashes[name] = hashlib.sha256(raw).hexdigest()
        sizes[name] = len(raw)

    if check_deterministic:
        with tempfile.TemporaryDirectory() as first, tempfile.TemporaryDirectory() as second:
            generate(canonical_path, Path(first))
            generate(canonical_path, Path(second))
            for name in FILES:
                require((Path(first) / name).read_bytes() == (Path(second) / name).read_bytes() == (data_dir / name).read_bytes(), "unstable_view_output", f"checked-in parity: {name}")

    require(canonical_path.read_bytes() == canonical_raw_before, "canonical_dataset_modified")
    return {
        "byteStable": check_deterministic,
        "detailCoverage": len(detail_by_id),
        "detailFiles": len(DETAIL_FILES),
        "hashes": hashes,
        "index": len(index_records),
        "searchFixtures": search_results,
        "sizes": sizes,
        "validator": "passed",
    }


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--data-dir", type=Path, default=DEFAULT_OUTPUT)
    parser.add_argument("--canonical", type=Path, default=DEFAULT_CANONICAL)
    parser.add_argument("--schema-dir", type=Path, default=DEFAULT_SCHEMAS)
    parser.add_argument("--source-root", type=Path, default=ROOT)
    parser.add_argument("--skip-deterministic", action="store_true")
    args = parser.parse_args()
    try:
        result = validate(args.data_dir, args.canonical, args.schema_dir, args.source_root, not args.skip_deterministic)
    except (ValidationError, OSError, ValueError, KeyError, json.JSONDecodeError) as error:
        print(f"FAILED: {error}")
        return 1
    print(json.dumps(result, ensure_ascii=False, sort_keys=True))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
