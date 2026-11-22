import subprocess
import sys
import tempfile
import tomllib
import unittest
from pathlib import Path


class CodexConfigTest(unittest.TestCase):
    script = Path(__file__).with_name("setup-codex-config.py")

    def run_setup(self, file: Path) -> subprocess.CompletedProcess:
        return subprocess.run(
            [sys.executable, str(self.script), str(file)], capture_output=True, timeout=5
        )

    def test_defaults_on_a_new_profile(self):
        with tempfile.TemporaryDirectory() as folder:
            file = Path(folder) / "codex" / "config.toml"
            self.assertEqual(self.run_setup(file).returncode, 0)
            self.assertEqual(tomllib.loads(file.read_text()), {
                "model": "gpt-6.2-sol",
                "model_reasoning_effort": "medium",
                "model_auto_compact_token_limit": 120000,
            })

    def test_existing_model_and_tables_remain_intact(self):
        with tempfile.TemporaryDirectory() as folder:
            file = Path(folder) / "config.toml"
            original = b'"model" = "my-model"\n\n[features]\n# User setting\nhooks = true\n'
            file.write_bytes(original)
            self.assertEqual(self.run_setup(file).returncode, 0)
            self.assertEqual(
                file.read_bytes(), b"model_auto_compact_token_limit = 120000\n\n" + original
            )
            mtime = file.stat().st_mtime_ns
            self.assertEqual(self.run_setup(file).returncode, 0)
            self.assertEqual(file.stat().st_mtime_ns, mtime)

    def test_user_threshold_and_effort_take_precedence(self):
        with tempfile.TemporaryDirectory() as folder:
            file = Path(folder) / "config.toml"
            original = 'model_auto_compact_token_limit = 80000\nmodel_reasoning_effort = "high"\n'
            file.write_text(original)
            self.assertEqual(self.run_setup(file).returncode, 0)
            self.assertEqual(file.read_text(), 'model = "gpt-6.2-sol"\n\n' + original)

    def test_invalid_toml_is_left_intact(self):
        with tempfile.TemporaryDirectory() as folder:
            file = Path(folder) / "config.toml"
            file.write_text("[bad\n")
            self.assertNotEqual(self.run_setup(file).returncode, 0)
            self.assertEqual(file.read_text(), "[bad\n")


if __name__ == "__main__":
    unittest.main()
