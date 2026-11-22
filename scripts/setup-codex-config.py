"""Fill in Codex defaults while preserving the user configuration and its formatting."""

import os
from pathlib import Path
import sys
import tempfile
import tomllib


def configure(file: Path) -> None:
    file = file.resolve()
    original = file.read_bytes() if file.exists() else b""
    settings = tomllib.loads(original.decode("utf-8"))
    defaults = {}
    if "model" not in settings:
        defaults["model"] = '"gpt-6.2-sol"'
        if "model_reasoning_effort" not in settings:
            defaults["model_reasoning_effort"] = '"medium"'
    if "model_auto_compact_token_limit" not in settings:
        defaults["model_auto_compact_token_limit"] = "120000"
    if defaults:
        # TOML root settings end at the first table, so insert them before the original content.
        prefix = "\n".join(f"{key} = {value}" for key, value in defaults.items()).encode()
        file.parent.mkdir(parents=True, exist_ok=True)
        with tempfile.NamedTemporaryFile(dir=file.parent, delete=False) as output:
            path = Path(output.name)
            try:
                output.write(prefix + (b"\n\n" + original if original else b"\n"))
                output.close()
                os.replace(path, file)
            finally:
                path.unlink(missing_ok=True)


if __name__ == "__main__":
    configure(Path(sys.argv[1]))
