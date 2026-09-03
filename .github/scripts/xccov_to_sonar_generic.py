#!/usr/bin/env python3
"""Convert an Xcode .xcresult bundle into SonarQube's generic coverage XML format.

Usage: xccov_to_sonar_generic.py <result.xcresult> <output.xml> <repo_root>

For each source file covered by any target in the report, this walks the
per-line `xcrun xccov view --file` output (a line number, a colon, and either
nothing for non-executable lines or an execution count) and emits one
<lineToCover> element per executable line.
"""

import json
import subprocess
import sys
import xml.etree.ElementTree as ET


def xccov_json(xcresult_path: str) -> dict:
    output = subprocess.run(
        ["xcrun", "xccov", "view", "--report", "--json", xcresult_path],
        check=True,
        capture_output=True,
        text=True,
    ).stdout
    return json.loads(output)


def covered_file_paths(report: dict) -> set:
    paths = set()
    for target in report.get("targets", []):
        for file_entry in target.get("files", []):
            paths.add(file_entry["path"])
    return paths


def file_line_coverage(xcresult_path: str, file_path: str) -> list:
    """Returns a list of (line_number, covered) tuples for executable lines."""
    output = subprocess.run(
        ["xcrun", "xccov", "view", "--file", file_path, xcresult_path],
        check=True,
        capture_output=True,
        text=True,
    ).stdout

    lines = []
    for raw_line in output.splitlines():
        if ":" not in raw_line:
            continue
        line_number_str, _, rest = raw_line.partition(":")
        line_number_str = line_number_str.strip()
        if not line_number_str.isdigit():
            continue
        rest = rest.strip()
        if rest == "" or rest.lower() == "*":
            # Not an executable line (comment, blank line, or unreachable marker).
            continue
        try:
            execution_count = int(rest)
        except ValueError:
            # Some lines report a percentage or symbol instead of a raw count;
            # treat anything we can't parse as executable-but-unknown coverage.
            continue
        lines.append((int(line_number_str), execution_count > 0))
    return lines


def relative_path(file_path: str, repo_root: str) -> str:
    if file_path.startswith(repo_root):
        return file_path[len(repo_root):].lstrip("/")
    return file_path


def main() -> int:
    if len(sys.argv) != 4:
        print(__doc__, file=sys.stderr)
        return 2

    xcresult_path, output_path, repo_root = sys.argv[1:4]
    report = xccov_json(xcresult_path)

    coverage = ET.Element("coverage", {"version": "1"})
    for file_path in sorted(covered_file_paths(report)):
        lines = file_line_coverage(xcresult_path, file_path)
        if not lines:
            continue
        file_elem = ET.SubElement(
            coverage, "file", {"path": relative_path(file_path, repo_root)}
        )
        for line_number, covered in lines:
            ET.SubElement(
                file_elem,
                "lineToCover",
                {
                    "lineNumber": str(line_number),
                    "covered": "true" if covered else "false",
                },
            )

    ET.ElementTree(coverage).write(output_path, encoding="UTF-8", xml_declaration=True)
    return 0


if __name__ == "__main__":
    sys.exit(main())
