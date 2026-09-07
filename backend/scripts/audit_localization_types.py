#!/usr/bin/env python3
"""Audit Swift interpolation types against Localizable.xcstrings.

This is intentionally a heuristic audit, not a Swift type checker. It knows
explicit local declarations/signatures, common numeric properties and the
Fmt formatter helpers; complex inferred expressions are reported as unknown
rather than guessed. It covers one-argument tr("key \\(value)") calls.
"""

from __future__ import annotations

import json
import re
from pathlib import Path

from migrate_localization import parse_literal_expression, split_arguments

ROOT = Path(__file__).resolve().parents[2]
SOURCE_ROOT = ROOT / "ios-assodarts" / "Assodarts"
CATALOG_PATH = SOURCE_ROOT / "Localizable.xcstrings"
REPORT_PATH = ROOT / "backend" / "scripts" / "localization_migration_report.txt"
TR_CALL = re.compile(r"\btr\s*\(")
DECLARATION = re.compile(
    r"(?:@\w+(?:\([^\n]*\))?\s+)*(?:var|let)\s+(\w+)\s*(?::\s*(Int|Double|Float|String))?"
)
PARAMETER = re.compile(r"\b(\w+)\s*:\s*(Int|Double|Float|String)\b")

NUMERIC_PROPERTIES = re.compile(
    r"(?:\.count\b|\.memberCount\b|\.seedMemberCount\b|\.paidCount\b|"
    r"\.pendingCount\b|\.lateCount\b|\.attendeeIds\.count\b)"
)
STRING_EXPRESSION = re.compile(
    r"^(?:Fmt\.(?:money|euros|shortDate|mediumDate|number|count|time)|"
    r"String\(|.*\.(?:label|name|title|body|email)\b)"
)


def inferred_type(expression: str, declared: dict[str, str]) -> str | None:
    expression = expression.strip()
    if NUMERIC_PROPERTIES.search(expression):
        return "Int"
    if STRING_EXPRESSION.match(expression):
        return "String"
    if re.search(r"\b(?:Int|Double|Float)\s*\(", expression):
        return expression.split("(", 1)[0].strip()
    if re.search(r"[+\-*/]", expression) and NUMERIC_PROPERTIES.search(expression):
        return "Int"
    identifier = re.fullmatch(r"\w+", expression)
    if identifier:
        return declared.get(identifier.group())
    return None


def declared_types(text: str) -> dict[str, str]:
    declared: dict[str, str] = {}
    for match in DECLARATION.finditer(text):
        if match.group(2):
            declared[match.group(1)] = match.group(2)
    for match in PARAMETER.finditer(text):
        declared[match.group(1)] = match.group(2)
    return declared


def expected_spec(kind: str) -> str:
    return "%lld" if kind in {"Int", "Double", "Float"} else "%@"


def audit_file(path: Path, catalog: dict[str, object]) -> list[str]:
    text = path.read_text(encoding="utf-8")
    declared = declared_types(text)
    findings: list[str] = []
    for match in TR_CALL.finditer(text):
        parsed = split_arguments(text, match.end() - 1)
        if not parsed:
            continue
        args, _ = parsed
        if len(args) != 1:
            continue
        literal = parse_literal_expression(args[0])
        if not literal:
            continue
        template, expressions = literal
        if not expressions:
            continue
        line = text.count("\n", 0, match.start()) + 1
        key = template.split("{{INTERPOLATION}}", 1)[0].strip()
        kinds = [inferred_type(expression, declared) for expression in expressions]
        if any(kind is None for kind in kinds):
            continue
        expected = [expected_spec(kind) for kind in kinds if kind is not None]
        candidates = [
            catalog_key
            for catalog_key in catalog.get("strings", {})
            if catalog_key == key or catalog_key.startswith(f"{key} ")
        ]
        if not candidates:
            findings.append(
                f"{path.relative_to(ROOT)}:{line}: {key}: catalog key missing"
            )
            continue
        stored = candidates[0]
        stored_specs = re.findall(r"%(?:lld|@|f|d)", stored)
        if stored_specs != expected:
            findings.append(
                f"{path.relative_to(ROOT)}:{line}: {key}: "
                f"deduced {', '.join(kinds)} expects {' '.join(expected)}, "
                f"stored {stored_specs or '(none)'} in {stored}"
            )
    return findings


def main() -> None:
    catalog = json.loads(CATALOG_PATH.read_text(encoding="utf-8"))
    findings: list[str] = []
    for path in sorted(SOURCE_ROOT.rglob("*.swift")):
        findings.extend(audit_file(path, catalog))

    known_keys = {
        "score_a", "score_b", "localized_string", "localized_string_newcouponsheet",
        "members_year", "renewals_first_subscriptions",
    }
    new_findings = [line for line in findings if not any(f": {key}:" in line for key in known_keys)]
    lines = [
        "Localization type audit",
        "========================",
        f"Findings: {len(findings)}",
        f"New findings beyond the seven known cases: {len(new_findings)}",
        "",
    ]
    lines.extend(findings or ["No placeholder/type disagreements found."])
    REPORT_PATH.write_text("\n".join(lines) + "\n", encoding="utf-8")
    print("\n".join(lines))


if __name__ == "__main__":
    main()
