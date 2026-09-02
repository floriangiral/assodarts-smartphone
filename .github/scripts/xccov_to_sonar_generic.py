#!/usr/bin/env python3
"""Convert an xcresult code coverage report into SonarQube's generic coverage XML format.

Usage: xccov_to_sonar_generic.py <xcresult-path> <output-xml-path> <workspace-root>
"""
import json
import os
import subprocess
import sys
import xml.sax.saxutils as sax


def covered_lines(xcresult_path: str, file_path: str) -> list[tuple[str, str]]:
    report = subprocess.check_output(
        ["xcrun", "xccov", "view", "--file", file_path, "--report", xcresult_path],
        text=True,
    )
    lines = []
    for raw_line in report.splitlines():
        line_number, sep, rest = raw_line.partition(":")
        line_number = line_number.strip()
        if not sep or not line_number.isdigit():
            continue
        hits = rest.strip().split()[0] if rest.strip() else ""
        if hits in ("", "*"):
            continue  # line is not executable
        lines.append((line_number, "false" if hits == "0" else "true"))
    return lines


def main() -> int:
    if len(sys.argv) != 4:
        print("usage: xccov_to_sonar_generic.py <xcresult-path> <output-xml-path> <workspace-root>", file=sys.stderr)
        return 1

    xcresult_path, output_path, workspace_root = sys.argv[1], sys.argv[2], sys.argv[3]

    report = json.loads(
        subprocess.check_output(["xcrun", "xccov", "view", "--report", "--json", xcresult_path])
    )
    file_paths = sorted({f["path"] for target in report.get("targets", []) for f in target.get("files", [])})

    with open(output_path, "w") as out:
        out.write('<coverage version="1">\n')
        for path in file_paths:
            relative_path = os.path.relpath(path, workspace_root)
            if relative_path.startswith(".."):
                continue  # outside the repository (e.g. system frameworks)
            lines = covered_lines(xcresult_path, path)
            if not lines:
                continue
            out.write(f'  <file path="{sax.escape(relative_path)}">\n')
            for line_number, covered in lines:
                out.write(f'    <lineToCover lineNumber="{line_number}" covered="{covered}"/>\n')
            out.write("  </file>\n")
        out.write("</coverage>\n")

    return 0


if __name__ == "__main__":
    sys.exit(main())
