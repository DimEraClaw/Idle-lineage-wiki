#!/usr/bin/env python3
"""Generate deterministic, non-authoritative Equipment view payloads from the canonical Dataset."""

from __future__ import annotations

import argparse
import hashlib
from pathlib import Path
from typing import Any

from generate_equipment_data import canonical_bytes, load, write

ROOT = Path(__file__).resolve().parents[1]
DEFAULT_CANONICAL = ROOT / "data" / "equipment" / "equipments.json"
DEFAULT_OUTPUT = ROOT / "data" / "equipment"
SCHEMA_VERSION = "1.0.0"
VIEW_PAYLOAD_VERSION = "1.0.0"
BUCKETS = tuple("0123456789abcdef")
INDEX_FILE = "equipment-index.json"


def detail_filename(equipment_id: str) -> str:
    bucket = hashlib.sha256(equipment_id.encode("utf-8")).hexdigest()[0]
    return f"equipment-details-{bucket}.json"


def detail_locator(equipment_id: str) -> str:
    return f"data/equipment/{detail_filename(equipment_id)}"


def build_index_record(record: dict[str, Any]) -> dict[str, Any]:
    stats = {
        key: {"value": field["value"], "valueState": field["valueState"]}
        for key, field in sorted(record["baseStats"].items())
        if field["valueState"] in {"explicit", "explicit_zero"}
    }
    return {
        "baseStats": stats,
        "classRequirements": {"baseClasses": record["classRequirements"]["baseClasses"]},
        "description": {"canonicalText": record["description"]["canonicalText"]},
        "detailLocator": detail_locator(record["equipmentId"]),
        "displayName": record["displayName"],
        "entityRef": record["entityRef"],
        "equipmentGroup": record["equipmentGroup"],
        "equipmentId": record["equipmentId"],
        "equipmentType": record["equipmentType"],
        "itemType": record["itemType"],
        "price": {"amount": record["price"]["amount"]},
        "rarity": record["rarity"],
        "safeEnhance": {
            "enhanceable": record["safeEnhance"]["enhanceable"],
            "safeLevel": record["safeEnhance"]["safeLevel"],
        },
        "slot": record["slot"],
        "status": record["status"],
    }


def build_documents(canonical_document: dict[str, Any]) -> dict[str, dict[str, Any]]:
    records = sorted(canonical_document["records"], key=lambda row: row["equipmentId"])
    documents: dict[str, dict[str, Any]] = {
        INDEX_FILE: {
            "dataset": "equipment_view_index",
            "records": [build_index_record(record) for record in records],
            "schemaVersion": SCHEMA_VERSION,
            "viewPayloadVersion": VIEW_PAYLOAD_VERSION,
        }
    }
    for bucket in BUCKETS:
        name = f"equipment-details-{bucket}.json"
        documents[name] = {
            "bucket": bucket,
            "dataset": "equipment_view_details",
            "records": [record for record in records if detail_filename(record["equipmentId"]) == name],
            "schemaVersion": SCHEMA_VERSION,
            "viewPayloadVersion": VIEW_PAYLOAD_VERSION,
        }
    return documents


def generate(canonical_path: Path = DEFAULT_CANONICAL, output_dir: Path = DEFAULT_OUTPUT) -> dict[str, Any]:
    canonical_document = load(canonical_path)
    documents = build_documents(canonical_document)
    for name, document in documents.items():
        write(output_dir / name, document)
    sizes = {name: len(canonical_bytes(document)) for name, document in sorted(documents.items())}
    return {"details": len(documents) - 1, "index": len(documents[INDEX_FILE]["records"]), "sizes": sizes}


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--canonical", type=Path, default=DEFAULT_CANONICAL)
    parser.add_argument("--output-dir", type=Path, default=DEFAULT_OUTPUT)
    args = parser.parse_args()
    result = generate(args.canonical, args.output_dir)
    print(result)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
