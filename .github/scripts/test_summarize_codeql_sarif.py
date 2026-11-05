import contextlib
import importlib.util
import io
import json
import os
import sys
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch


spec = importlib.util.spec_from_file_location(
    "summarize_codeql_sarif",
    Path(__file__).with_name("summarize_codeql_sarif.py"),
)
summarizer = importlib.util.module_from_spec(spec)
spec.loader.exec_module(summarizer)


class SummarizeCodeQLTests(unittest.TestCase):
    def run_summary(self, workspace, label):
        source = workspace / "codeql-results" / "input"
        with (
            patch.dict(
                os.environ,
                {"GITHUB_WORKSPACE": str(workspace), "GITHUB_STEP_SUMMARY": ""},
            ),
            patch.object(sys, "argv", ["summarize", str(source), label]),
            contextlib.redirect_stdout(io.StringIO()),
            contextlib.redirect_stderr(io.StringIO()),
        ):
            return summarizer.main()

    def test_missing_sarif_fails_closed_for_both_languages(self):
        for label in ("iOS", "Backend"):
            with self.subTest(label=label), tempfile.TemporaryDirectory() as root:
                workspace = Path(root)
                self.assertEqual(self.run_summary(workspace, label), 1)
                self.assertFalse((workspace / "codeql-results" / "ios.sarif").exists())
                self.assertFalse((workspace / "codeql-results" / "backend.sarif").exists())

    def test_valid_reports_are_written_and_error_results_fail(self):
        for label, name in (("iOS", "ios"), ("Backend", "backend")):
            for results, expected in (([], 0), ([{"level": "error", "ruleId": "test"}], 1)):
                with (
                    self.subTest(label=label, results=results),
                    tempfile.TemporaryDirectory() as root,
                ):
                    workspace = Path(root)
                    source = workspace / "codeql-results" / "input"
                    source.mkdir(parents=True)
                    report = {"version": "2.1.0", "runs": [{"results": results}]}
                    (source / "result.sarif").write_text(
                        json.dumps(report), encoding="utf-8"
                    )
                    self.assertEqual(self.run_summary(workspace, label), expected)
                    output = workspace / "codeql-results" / f"{name}.sarif"
                    self.assertEqual(
                        json.loads(output.read_text(encoding="utf-8"))["runs"],
                        report["runs"],
                    )


if __name__ == "__main__":
    unittest.main()
