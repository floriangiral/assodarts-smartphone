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


def safe_path(path: Path, base: Path = ROOT) -> Path:
    resolved_base = base.resolve()
    resolved_path = path.resolve()
    if resolved_path != resolved_base and resolved_base not in resolved_path.parents:
        raise ValueError(f"Refusing to access path outside repository: {path}")
    return resolved_path


def read_repo_text(path: Path) -> str:
    return safe_path(path).read_text(encoding="utf-8")


def write_repo_text(path: Path, text: str) -> None:
    repository_root = ROOT.resolve()
    resolved_path = path.resolve()
    if not resolved_path.is_relative_to(repository_root):
        raise ValueError(f"Refusing to write outside repository: {path}")
    resolved_path.write_text(text, encoding="utf-8")


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


def skip_spacing_and_concat(expression: str, index: int) -> int:
    while index < len(expression) and expression[index].isspace():
        index += 1
    return index + 1 if index < len(expression) and expression[index] == "+" else index


def parse_interpolation(expression: str, start: int) -> tuple[str, int] | None:
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
    return expression[start : cursor - 1].strip(), cursor


def escaped_character(char: str) -> str:
    escapes = {"n": "\n", "r": "\r", "t": "\t", '"': '"', "\\": "\\"}
    return escapes.get(char, char)


def parse_literal_content(
    expression: str,
    index: int,
    result: list[str],
    interpolations: list[str],
) -> int | None:
    while index < len(expression):
        char = expression[index]
        if char == '"':
            return index + 1
        if char != "\\" or index + 1 >= len(expression):
            result.append(char)
            index += 1
            continue
        if expression[index + 1] == "(":
            parsed = parse_interpolation(expression, index + 2)
            if not parsed:
                return None
            value, index = parsed
            interpolations.append(value)
            result.append("{{INTERPOLATION}}")
            continue
        result.append(escaped_character(expression[index + 1]))
        index += 2
    return None


def parse_literal_expression(expression: str) -> tuple[str, list[str]] | None:
    """Parse a concatenation of Swift string literals into text and expressions."""
    index = 0
    result: list[str] = []
    interpolations: list[str] = []
    saw_literal = False
    while index < len(expression):
        index = skip_spacing_and_concat(expression, index)
        if index >= len(expression):
            break
        if expression[index] != '"':
            return None
        saw_literal = True
        index = parse_literal_content(expression, index + 1, result, interpolations)
        if index is None:
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


def parsed_call_failure(path: Path, text: str, match: re.Match[str], reason: str) -> str:
    line = text.count(chr(10), 0, match.start()) + 1
    return f"{path.relative_to(ROOT)}:{line}: {reason}"


def parse_tr_call(
    path: Path,
    text: str,
    match: re.Match[str],
) -> tuple[ParsedCall | None, str | None]:
    parsed = split_arguments(text, match.end() - 1)
    if parsed is None:
        return None, parsed_call_failure(path, text, match, "unclosed tr()")

    args, end = parsed
    if len(args) != 2:
        return None, None

    french_data = parse_literal_expression(args[0])
    english_data = parse_literal_expression(args[1])
    if not french_data or not english_data:
        return None, parsed_call_failure(path, text, match, "non-literal tr()")

    french, french_interpolations = french_data
    english, english_interpolations = english_data
    if len(french_interpolations) != len(english_interpolations):
        return None, parsed_call_failure(path, text, match, "interpolation count differs")

    key = slug(english)
    return ParsedCall(
        match.start(), end, french, english,
        with_placeholders(french, french_interpolations),
        with_placeholders(english, english_interpolations),
        english_interpolations,
        f'tr("{key}")',
    ), None


def parse_file(path: Path) -> tuple[list[ParsedCall], list[str]]:
    path = safe_path(path, SOURCE_ROOT)
    text = read_repo_text(path)
    calls: list[ParsedCall] = []
    failures: list[str] = []
    for match in TR_CALL.finditer(text):
        call, failure = parse_tr_call(path, text, match)
        if failure:
            failures.append(failure)
        if call:
            calls.append(call)
    return calls, failures


def unique_catalog_key(base_key: str, pair: tuple[str, str], entries: dict[str, Entry]) -> str:
    key = base_key
    suffix = 2
    while key in entries and (entries[key].french, entries[key].english) != pair:
        key = f"{base_key}_{suffix}"
        suffix += 1
    return key


def register_catalog_entry(
    path: Path,
    call: ParsedCall,
    entries: dict[str, Entry],
    pair_to_key: dict[tuple[str, str], str],
    english_to_pair: dict[str, tuple[str, str]],
) -> bool:
    """Assign a catalog key to `call`. Returns True if it duplicates an existing entry."""
    pair = (call.french_catalog, call.english_catalog)
    if pair in pair_to_key:
        return True
    key = slug(call.english_catalog)
    if key in english_to_pair and english_to_pair[key] != pair:
        key = f"{key}_{slug(path.stem)}"
    key = unique_catalog_key(key, pair, entries)
    pair_to_key[pair] = key
    english_to_pair[key] = pair
    placeholders = re.findall(r"%(?:[a-z]+|@)", call.english_catalog)
    catalog_key = key + (" " + " ".join(placeholders) if placeholders else "")
    entries[key] = Entry(key, call.french_catalog, call.english_catalog, catalog_key)
    return False


def apply_call_replacement(call: ParsedCall, pair_to_key: dict[tuple[str, str], str]) -> None:
    pair = (call.french_catalog, call.english_catalog)
    key = pair_to_key[pair]
    interpolation = "".join(f" \\({expression})" for expression in call.interpolations)
    call.replacement = f'tr("{key}{interpolation}")'


def build_catalog(calls_by_file: dict[Path, list[ParsedCall]]) -> tuple[dict[str, Entry], int]:
    entries: dict[str, Entry] = {}
    pair_to_key: dict[tuple[str, str], str] = {}
    english_to_pair: dict[str, tuple[str, str]] = {}
    duplicates = 0
    for path, calls in calls_by_file.items():
        for call in calls:
            if register_catalog_entry(path, call, entries, pair_to_key, english_to_pair):
                duplicates += 1
    for calls in calls_by_file.values():
        for call in calls:
            apply_call_replacement(call, pair_to_key)
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


def unit(value: str) -> dict:
    return {"stringUnit": {"state": "translated", "value": value}}


def plural_entry(fr_one: str, fr_other: str, en_one: str, en_other: str) -> dict:
    return {
        "localizations": {
            "fr": {"variations": {"plural": {
                "one": unit(fr_one), "other": unit(fr_other),
            }}},
            "en": {"variations": {"plural": {
                "one": unit(en_one), "other": unit(en_other),
            }}},
        }
    }


def add_plural(
    strings: dict,
    key: str,
    fr_one: str,
    fr_other: str,
    en_one: str,
    en_other: str,
) -> None:
    strings[f"{key} %lld"] = plural_entry(fr_one, fr_other, en_one, en_other)


def fixed_final_entries() -> dict:
    return {
        "french": {"localizations": {"fr": unit("Français"), "en": unit("Français")}},
        "english": {"localizations": {"fr": unit("English"), "en": unit("English")}},
        "expiring_trials_count %lld": plural_entry(
            "%lld essai expire sous 7 jours",
            "%lld essais expirent sous 7 jours",
            "%lld trial expiring within 7 days",
            "%lld trials expiring within 7 days",
        ),
        "grace_subscriptions_count %lld": plural_entry(
            "%lld abonnement en délai de grâce",
            "%lld abonnements en délai de grâce",
            "%lld subscription in grace period",
            "%lld subscriptions in grace period",
        ),
        "selected_clubs_count %lld": plural_entry(
            "Clubs ciblés · %lld sélectionné",
            "Clubs ciblés · %lld sélectionnés",
            "Targeted clubs · %lld selected",
            "Targeted clubs · %lld selected",
        ),
    }


def add_final_entries() -> None:
    catalog = json.loads(read_repo_text(CATALOG_PATH))
    strings = catalog.setdefault("strings", {})
    strings.update(fixed_final_entries())
    add_plural(strings, "count_clubs", "%lld club", "%lld clubs", "%lld club", "%lld clubs")
    add_plural(strings, "count_targeted_clubs", "club ciblé : %lld", "clubs ciblés : %lld", "%lld club targeted", "%lld clubs targeted")
    add_plural(strings, "count_open_calls", "%lld appel en cours", "%lld appels en cours", "%lld open request", "%lld open requests")
    add_plural(strings, "count_attendees", "%lld présent", "%lld présents", "%lld attending", "%lld attending")
    add_plural(strings, "count_committee_members", "%lld membre du bureau", "%lld membres du bureau", "%lld committee member", "%lld committee members")
    add_plural(strings, "count_pending_payments", "%lld paiement en attente", "%lld paiements en attente", "%lld pending payment", "%lld pending payments")
    add_plural(strings, "count_results", "%lld résultat saisi", "%lld résultats saisis", "%lld result recorded", "%lld results recorded")
    add_plural(strings, "count_payments_to_confirm", "%lld paiement à valider", "%lld paiements à valider", "%lld payment to confirm", "%lld payments to confirm")
    add_plural(strings, "count_member_declarations", "%lld déclaration de membre", "%lld déclarations de membres", "%lld member declaration", "%lld member declarations")
    add_plural(strings, "count_club_members", "%lld membre du club", "%lld membres du club", "%lld club member", "%lld club members")
    add_plural(strings, "count_members", "%lld membre", "%lld membres", "%lld member", "%lld members")
    add_plural(strings, "count_due_payments", "%lld paiement en attente", "%lld paiements en attente", "%lld pending payment", "%lld pending payments")
    write_repo_text(CATALOG_PATH, json.dumps(catalog, ensure_ascii=False, indent=2) + "\n")


def repair_catalog_placeholders() -> None:
    catalog = json.loads(read_repo_text(CATALOG_PATH))
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
        tokens = key.split(" ")
        while tokens and tokens[-1] in ("%lld", "%@"):
            tokens.pop()
        base_key = " ".join(tokens)
        repaired[base_key + " " + " ".join(placeholders)] = entry
    catalog["strings"] = repaired
    write_repo_text(CATALOG_PATH, json.dumps(catalog, ensure_ascii=False, indent=2) + "\n")


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
    for path in sorted(safe_path(SOURCE_ROOT).rglob("*.swift")):
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
    write_repo_text(REPORT_PATH, "\n".join(lines) + "\n")
    print("\n".join(lines))

    if args.dry_run:
        return

    generated = catalog_json(entries)
    if CATALOG_PATH.exists():
        existing = json.loads(read_repo_text(CATALOG_PATH))
        existing.setdefault("strings", {}).update(generated["strings"])
        generated = existing
    write_repo_text(CATALOG_PATH, json.dumps(generated, ensure_ascii=False, indent=2) + "\n")
    for path, calls in calls_by_file.items():
        path = safe_path(path, SOURCE_ROOT)
        text = read_repo_text(path)
        for call in reversed(calls):
            text = text[: call.start] + call.replacement + text[call.end :]
        write_repo_text(path, text)


if __name__ == "__main__":
    main()
