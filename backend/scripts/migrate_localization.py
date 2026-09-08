#!/usr/bin/env python3
"""Migrate Assodarts tr("French", "English") calls to a String Catalog.

Usage:
    python3 backend/scripts/migrate_localization.py --dry-run
    python3 backend/scripts/migrate_localization.py

The default mode rewrites Swift call sites and writes Localizable.xcstrings.
The dry run only writes the report, which is useful before accepting a large
mechanical diff. The parser deliberately reports calls it cannot prove are
made exclusively from Swift string literals instead of guessing.
"""

from __future__ import annotations

import argparse
import json
import re
import unicodedata
from dataclasses import dataclass
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
SOURCE_ROOT = ROOT / "ios-assodarts" / "Assodarts"
CATALOG_PATH = SOURCE_ROOT / "Localizable.xcstrings"
REPORT_PATH = ROOT / "backend" / "scripts" / "localization_migration_report.txt"

TR_CALL = re.compile(r"\btr\s*\(")


@dataclass(frozen=True)
class Entry:
    key: str
    french: str
    english: str
    catalog_key: str


@dataclass
class ParsedCall:
    start: int
    end: int
    french: str
    english: str
    french_catalog: str
    english_catalog: str
    interpolations: list[str]
    replacement: str


def skip_string(text: str, index: int) -> int:
    """Return the index after a normal Swift string literal."""
    index += 1
    while index < len(text):
        if text[index] == "\\":
            index += 2
            continue
        if text[index] == '"':
            return index + 1
        index += 1
    return len(text)


def split_arguments(text: str, opening: int) -> tuple[list[str], int] | None:
    """Split a call's top-level arguments and return the closing parenthesis."""
    args: list[str] = []
    start = opening + 1
    index = start
    depth = 0
    while index < len(text):
        char = text[index]
        if char == '"':
            index = skip_string(text, index)
            continue
        if char == "(" or char == "[" or char == "{":
            depth += 1
        elif char == ")":
            if depth == 0:
                args.append(text[start:index].strip())
                return args, index + 1
            depth -= 1
        elif char in "]}":
            depth = max(0, depth - 1)
        elif char == "," and depth == 0:
            args.append(text[start:index].strip())
            start = index + 1
        index += 1
    return None


def parse_literal_expression(expression: str) -> tuple[str, list[str]] | None:
    """Parse a concatenation of Swift string literals into text and expressions."""
    index = 0
    result: list[str] = []
    interpolations: list[str] = []
    saw_literal = False
    while index < len(expression):
        while index < len(expression) and expression[index].isspace():
            index += 1
        if index >= len(expression):
            break
        if expression[index] == "+":
            index += 1
            continue
        if expression[index] != '"':
            return None
        saw_literal = True
        index += 1
        while index < len(expression):
            char = expression[index]
            if char == '"':
                index += 1
                break
            if char == "\\" and index + 1 < len(expression):
                if expression[index + 1] == "(":
                    start = index + 2
                    cursor = start
                    depth = 1
                    while cursor < len(expression) and depth:
                        if expression[cursor] == '"':
                            cursor = skip_string(expression, cursor)
                            continue
                        if expression[cursor] == "(":
                            depth += 1
                        elif expression[cursor] == ")":
                            depth -= 1
                        cursor += 1
                    if depth:
                        return None
                    value = expression[start : cursor - 1].strip()
                    interpolations.append(value)
                    result.append("{{INTERPOLATION}}")
                    index = cursor
                    continue
                escapes = {"n": "\n", "r": "\r", "t": "\t", '"': '"', "\\": "\\"}
                result.append(escapes.get(expression[index + 1], expression[index + 1]))
                index += 2
                continue
            result.append(char)
            index += 1
        else:
            return None
    if not saw_literal:
        return None
    return "".join(result), interpolations


def placeholder_for(expression: str) -> str:
    return "%lld" if re.search(r"\b(count|number|total|index|value|n)\b|\.count\b", expression) else "%@"


def with_placeholders(template: str, interpolations: list[str]) -> str:
    result = template
    for expression in interpolations:
        result = result.replace("{{INTERPOLATION}}", placeholder_for(expression), 1)
    return result


def slug(value: str) -> str:
    value = re.sub(r"%[a-z]+", "", value.lower())
    value = unicodedata.normalize("NFKD", value).encode("ascii", "ignore").decode()
    value = re.sub(r"[^a-z0-9]+", "_", value).strip("_")
    return value[:56] or "localized_string"


def parse_file(path: Path) -> tuple[list[ParsedCall], list[str]]:
    text = path.read_text(encoding="utf-8")
    calls: list[ParsedCall] = []
    failures: list[str] = []
    for match in TR_CALL.finditer(text):
        parsed = split_arguments(text, match.end() - 1)
        if parsed is None:
            failures.append(f"{path.relative_to(ROOT)}:{text.count(chr(10), 0, match.start()) + 1}: unclosed tr()")
            continue
        args, end = parsed
        if len(args) != 2:
            continue
        french_data = parse_literal_expression(args[0])
        english_data = parse_literal_expression(args[1])
        if not french_data or not english_data:
            failures.append(f"{path.relative_to(ROOT)}:{text.count(chr(10), 0, match.start()) + 1}: non-literal tr()")
            continue
        french, french_interpolations = french_data
        english, english_interpolations = english_data
        if len(french_interpolations) != len(english_interpolations):
            failures.append(f"{path.relative_to(ROOT)}:{text.count(chr(10), 0, match.start()) + 1}: interpolation count differs")
            continue
        key = slug(english)
        calls.append(ParsedCall(
            match.start(), end, french, english,
            with_placeholders(french, french_interpolations),
            with_placeholders(english, english_interpolations),
            english_interpolations,
            f'tr("{key}")',
        ))
    return calls, failures


def build_catalog(calls_by_file: dict[Path, list[ParsedCall]]) -> tuple[dict[str, Entry], int]:
    entries: dict[str, Entry] = {}
    pair_to_key: dict[tuple[str, str], str] = {}
    english_to_pair: dict[str, tuple[str, str]] = {}
    duplicates = 0
    for path, calls in calls_by_file.items():
        for call in calls:
            pair = (call.french_catalog, call.english_catalog)
            if pair in pair_to_key:
                duplicates += 1
                continue
            key = slug(call.english_catalog)
            if key in english_to_pair and english_to_pair[key] != pair:
                key = f"{key}_{slug(path.stem)}"
            suffix = 2
            base = key
            while key in entries and (entries[key].french, entries[key].english) != pair:
                key = f"{base}_{suffix}"
                suffix += 1
            pair_to_key[pair] = key
            english_to_pair[key] = pair
            placeholders = re.findall(r"%(?:[a-z]+|@)", call.english_catalog)
            catalog_key = key + (" " + " ".join(placeholders) if placeholders else "")
            entries[key] = Entry(key, call.french_catalog, call.english_catalog, catalog_key)
    for calls in calls_by_file.values():
        for call in calls:
            pair = (call.french_catalog, call.english_catalog)
            key = pair_to_key[pair]
            interpolation = "".join(f" \\({expression})" for expression in call.interpolations)
            call.replacement = f'tr("{key}{interpolation}")'
    return entries, duplicates


def catalog_json(entries: dict[str, Entry]) -> dict:
    strings = {}
    for entry in sorted(entries.values(), key=lambda item: item.catalog_key):
        strings[entry.catalog_key] = {
            "localizations": {
                "fr": {"stringUnit": {"state": "translated", "value": entry.french}},
                "en": {"stringUnit": {"state": "translated", "value": entry.english}},
            }
        }
    return {"sourceLanguage": "fr", "strings": strings, "version": "1.0"}


def add_final_entries() -> None:
    catalog = json.loads(CATALOG_PATH.read_text(encoding="utf-8"))
    strings = catalog.setdefault("strings", {})

    def unit(value: str) -> dict:
        return {"stringUnit": {"state": "translated", "value": value}}

    def plural(key: str, fr_one: str, fr_other: str, en_one: str, en_other: str) -> None:
        strings[f"{key} %lld"] = {
            "localizations": {
                "fr": {"variations": {"plural": {
                    "one": unit(fr_one), "other": unit(fr_other),
                }}},
                "en": {"variations": {"plural": {
                    "one": unit(en_one), "other": unit(en_other),
                }}},
            }
        }

    strings.update({
        "french": {"localizations": {"fr": unit("Français"), "en": unit("Français")}},
        "english": {"localizations": {"fr": unit("English"), "en": unit("English")}},
        "expiring_trials_count %lld": {
            "localizations": {
                "fr": {"variations": {"plural": {
                    "one": unit("%lld essai expire sous 7 jours"),
                    "other": unit("%lld essais expirent sous 7 jours"),
                }}},
                "en": {"variations": {"plural": {
                    "one": unit("%lld trial expiring within 7 days"),
                    "other": unit("%lld trials expiring within 7 days"),
                }}},
            }
        },
        "grace_subscriptions_count %lld": {
            "localizations": {
                "fr": {"variations": {"plural": {
                    "one": unit("%lld abonnement en délai de grâce"),
                    "other": unit("%lld abonnements en délai de grâce"),
                }}},
                "en": {"variations": {"plural": {
                    "one": unit("%lld subscription in grace period"),
                    "other": unit("%lld subscriptions in grace period"),
                }}},
            }
        },
        "selected_clubs_count %lld": {
            "localizations": {
                "fr": {"variations": {"plural": {
                    "one": unit("Clubs ciblés · %lld sélectionné"),
                    "other": unit("Clubs ciblés · %lld sélectionnés"),
                }}},
                "en": {"variations": {"plural": {
                    "one": unit("Targeted clubs · %lld selected"),
                    "other": unit("Targeted clubs · %lld selected"),
                }}},
            }
        },
    })
    plural("count_clubs", "%lld club", "%lld clubs", "%lld club", "%lld clubs")
    plural("count_targeted_clubs", "club ciblé : %lld", "clubs ciblés : %lld", "%lld club targeted", "%lld clubs targeted")
    plural("count_open_calls", "%lld appel en cours", "%lld appels en cours", "%lld open request", "%lld open requests")
    plural("count_attendees", "%lld présent", "%lld présents", "%lld attending", "%lld attending")
    plural("count_committee_members", "%lld membre du bureau", "%lld membres du bureau", "%lld committee member", "%lld committee members")
    plural("count_pending_payments", "%lld paiement en attente", "%lld paiements en attente", "%lld pending payment", "%lld pending payments")
    plural("count_results", "%lld résultat saisi", "%lld résultats saisis", "%lld result recorded", "%lld results recorded")
    plural("count_payments_to_confirm", "%lld paiement à valider", "%lld paiements à valider", "%lld payment to confirm", "%lld payments to confirm")
    plural("count_member_declarations", "%lld déclaration de membre", "%lld déclarations de membres", "%lld member declaration", "%lld member declarations")
    plural("count_club_members", "%lld membre du club", "%lld membres du club", "%lld club member", "%lld club members")
    plural("count_members", "%lld membre", "%lld membres", "%lld member", "%lld members")
    plural("count_due_payments", "%lld paiement en attente", "%lld paiements en attente", "%lld pending payment", "%lld pending payments")
    CATALOG_PATH.write_text(json.dumps(catalog, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def repair_catalog_placeholders() -> None:
    catalog = json.loads(CATALOG_PATH.read_text(encoding="utf-8"))
    repaired = {}
    for key, entry in catalog.get("strings", {}).items():
        values = []
        for localization in entry.get("localizations", {}).values():
            string_unit = localization.get("stringUnit")
            if string_unit:
                values.append(string_unit.get("value", ""))
        placeholders = re.findall(r"%(?:lld|@)", values[0] if values else "")
        if not placeholders:
            repaired[key] = entry
            continue
        base_key = re.sub(r"(?: (?:%lld|%@))+$", "", key)
        repaired[base_key + " " + " ".join(placeholders)] = entry
    catalog["strings"] = repaired
    CATALOG_PATH.write_text(json.dumps(catalog, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--finalize", action="store_true")
    parser.add_argument("--repair-placeholders", action="store_true")
    args = parser.parse_args()

    if args.finalize:
        add_final_entries()
        return
    if args.repair_placeholders:
        repair_catalog_placeholders()
        return

    calls_by_file: dict[Path, list[ParsedCall]] = {}
    failures: list[str] = []
    for path in sorted(SOURCE_ROOT.rglob("*.swift")):
        calls, file_failures = parse_file(path)
        if calls:
            calls_by_file[path] = calls
        failures.extend(file_failures)

    entries, duplicates = build_catalog(calls_by_file)
    total = sum(len(calls) for calls in calls_by_file.values())
    lines = [
        f"Parsed calls: {total}",
        f"Unique catalog keys: {len(entries)}",
        f"Duplicate calls merged: {duplicates}",
        f"Unparsed calls: {len(failures)}",
        *failures,
    ]
    REPORT_PATH.write_text("\n".join(lines) + "\n", encoding="utf-8")
    print("\n".join(lines))

    if args.dry_run:
        return

    generated = catalog_json(entries)
    if CATALOG_PATH.exists():
        existing = json.loads(CATALOG_PATH.read_text(encoding="utf-8"))
        existing.setdefault("strings", {}).update(generated["strings"])
        generated = existing
    CATALOG_PATH.write_text(json.dumps(generated, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    for path, calls in calls_by_file.items():
        text = path.read_text(encoding="utf-8")
        for call in reversed(calls):
            text = text[: call.start] + call.replacement + text[call.end :]
        path.write_text(text, encoding="utf-8")


if __name__ == "__main__":
    main()
