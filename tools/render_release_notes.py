#!/usr/bin/env python3
"""Render deterministic Markdown review notes from a validated release diff."""

from __future__ import annotations

import argparse
import json
from pathlib import Path
from typing import Any

from validate_release_diff import DEFAULT_SCHEMA, validate_file


DOMAIN_LABELS = {"monster": "Monster", "map": "Map", "drop": "Drop", "equipment": "Equipment"}


def records(domain: dict[str, Any], keys: tuple[str, ...]) -> list[dict[str, Any]]:
    return sorted((item for key in keys for item in domain[key]), key=lambda item: item["changeId"])


def line(record: dict[str, Any]) -> str:
    return f"- `{record['entityType']}:{record['entityId']}` — `{record['changeType']}`（{record['reviewStatus']}）"


def render(value: dict[str, Any]) -> bytes:
    summary = value["summary"]
    lines = [
        f"# Release Diff Review: {value['approvedVersion']} → {value['candidateVersion']}", "",
        "## Source revisions", "",
        f"- Approved: `{value['approvedSourceRevision']}`",
        f"- Candidate: `{value['candidateSourceRevision']}`", "",
        "## 更新摘要", "",
        f"- 新增：{summary['totalAdded']}", f"- 移除候選：{summary['totalRemoved']}",
        f"- 修改候選：{summary['totalModified']}", f"- 關聯變更：{summary['totalRelationChanged']}",
        f"- 尚待解析新增：{summary['totalUnresolvedAdded']}", f"- 衝突：{summary['totalConflicts']}", "",
    ]
    for domain in value["domains"]:
        lines.extend([f"## {DOMAIN_LABELS[domain['domain']]}", ""])
        publishable = [item for item in records(domain, ("added", "removed", "modified")) if not item["blocking"] and item["changeType"] not in {"technical_only", "unresolved_added", "conflict"}]
        if publishable:
            lines.extend(line(item) for item in publishable)
        else:
            lines.append("- 無可直接發布的變更。")
        lines.append("")
    pending = [item for domain in value["domains"] for item in records(domain, ("unresolvedAdded", "unresolvedResolved", "conflicts"))]
    lines.extend(["## 尚待人工確認", ""])
    if pending:
        lines.extend(line(item) for item in pending)
    else:
        lines.append("- 無。")
    lines.append("")
    blocked = [item for domain in value["domains"] for item in records(domain, ("added", "removed", "modified", "unresolvedAdded", "conflicts")) if item["blocking"]]
    lines.extend(["## Blocking conflicts", ""])
    if blocked:
        lines.extend(line(item) for item in blocked)
    else:
        lines.append("- 無。")
    lines.append("")
    technical = [item for domain in value["domains"] for item in domain["technicalOnly"]]
    lines.extend(["## Technical-only changes", ""])
    if technical:
        lines.extend(line(item) for item in sorted(technical, key=lambda item: item["changeId"]))
    else:
        lines.append("- 無。")
    lines.append("")
    return ("\n".join(lines)).encode("utf-8")


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--input", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--schema", type=Path, default=DEFAULT_SCHEMA)
    args = parser.parse_args()
    try:
        source = args.input.resolve()
        output = args.output.resolve()
        if source == output:
            raise ValueError("output_matches_input")
        validate_file(source, args.schema.resolve())
        value = json.loads(source.read_text(encoding="utf-8"))
        output.parent.mkdir(parents=True, exist_ok=True)
        output.write_bytes(render(value))
    except (OSError, ValueError, json.JSONDecodeError, RuntimeError) as error:
        print(f"FAILED: {error}")
        return 1
    print(json.dumps({"output": output.name}, sort_keys=True))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
