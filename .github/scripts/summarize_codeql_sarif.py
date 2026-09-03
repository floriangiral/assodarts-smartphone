#!/usr/bin/env python3
"""Summarize local CodeQL SARIF output and enforce the error threshold."""

import json
import os
import shutil
import sys
from collections import Counter
from pathlib import Path


def severity(result):
    level = result.get("level", "").lower()
    if level in {"error", "warning", "note"}:
        return level

    value = result.get("properties", {}).get("security-severity")
    try:
        score = float(value)
    except (TypeError, ValueError):
        return "note"

    if score >= 8:
        return "error"
    if score >= 4:
        return "warning"
    return "note"


def main():
    if len(sys.argv) != 4:
        print(__doc__, file=sys.stderr)
        return 2

    sarif_dir = Path(sys.argv[1])
    output_path = Path(sys.argv[2])
    label = sys.argv[3]
    files = sorted(sarif_dir.glob("*.sarif"))

    if not files:
        print(f"CodeQL {label}: no SARIF file produced", file=sys.stderr)
        return 1

    runs = []
    version = "2.1.0"
    schema = "https://json.schemastore.org/sarif-2.1.0.json"
    for source_path in files:
        document = json.loads(source_path.read_text(encoding="utf-8"))
        version = document.get("version", version)
        schema = document.get("$schema", schema)
        runs.extend(document.get("runs", []))

    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(
        json.dumps({"$schema": schema, "version": version, "runs": runs}, indent=2)
        + "\n",
        encoding="utf-8",
    )

    results = [result for run in runs for result in run.get("results", [])]
    levels = Counter(severity(result) for result in results)
    rules = Counter(result.get("ruleId", "unknown") for result in results)

    print(f"CodeQL {label}: {len(results)} alert(s)")
    print(f"- error: {levels['error']}")
    print(f"- warning: {levels['warning']}")
    print(f"- note: {levels['note']}")
    print("- top rules:")
    for rule_id, count in rules.most_common(5):
        print(f"  - {rule_id}: {count}")

    summary_path = os.environ.get("GITHUB_STEP_SUMMARY")
    if summary_path:
        with open(summary_path, "a", encoding="utf-8") as summary:
            summary.write(f"## CodeQL {label}\n\n")
            summary.write(f"- Total alerts: **{len(results)}**\n")
            summary.write(f"- Error: **{levels['error']}**\n")
            summary.write(f"- Warning: **{levels['warning']}**\n")
            summary.write(f"- Note: **{levels['note']}**\n\n")
            summary.write("### Top rules\n\n")
            summary.write("| Rule ID | Count |\n| --- | ---: |\n")
            for rule_id, count in rules.most_common(5):
                summary.write(f"| `{rule_id}` | {count} |\n")

    return 1 if levels["error"] else 0


if __name__ == "__main__":
    raise SystemExit(main())