
#!/usr/bin/env bash
set -euo pipefail
shopt -s nullglob

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
CONFIG="$ROOT/.devcontainer/devcontainer.json"
SERVER_ROOT="${VSCODE_AGENT_FOLDER:-$HOME/.vscode-server}"

# Find the real VS Code Server CLI, not the remote 'code' wrapper.
SERVER=""

candidates=(
    "$SERVER_ROOT"/cli/servers/Stable-*/server/bin/code-server
    "$SERVER_ROOT"/bin/*/bin/code-server
)

for candidate in "${candidates[@]}"; do
    if [[ -x "$candidate" ]]; then
        if [[ -z "$SERVER" || "$candidate" -nt "$SERVER" ]]; then
            SERVER="$candidate"
        fi
    fi
done

if [[ -z "$SERVER" ]]; then
    echo "[ERROR] VS Code Server CLI not found." >&2
    exit 1
fi

echo "Using VS Code Server: $SERVER"

# Read the extension IDs from the existing devcontainer.json.
# Supports the current JSONC layout with one ID per line.
mapfile -t extensions < <(
    awk '
        /"extensions"[[:space:]]*:[[:space:]]*\[/ {
            inside=1
            next
        }
        inside && /^[[:space:]]*\]/ {
            exit
        }
        inside && /^[[:space:]]*"/ {
            line=$0
            sub(/^[[:space:]]*"/, "", line)
            sub(/".*$/, "", line)
            print line
        }
    ' "$CONFIG"
)

if [[ ${#extensions[@]} -eq 0 ]]; then
    echo "[ERROR] No extensions found in $CONFIG" >&2
    exit 1
fi

echo "Checking ${#extensions[@]} VS Code extensions..."

installed="$("$SERVER" --list-extensions)"

failed=0

for extension in "${extensions[@]}"; do
    [[ "$extension" == -* ]] && continue

    if grep -Fxiq -- "$extension" <<< "$installed"; then
        echo "[OK] $extension"
        continue
    fi

    echo "[INSTALL] $extension"

    if ! "$SERVER" --install-extension "$extension"; then
        echo "[ERROR] Installation failed: $extension" >&2
        failed=1
        continue
    fi

    installed="$("$SERVER" --list-extensions)"

    if grep -Fxiq -- "$extension" <<< "$installed"; then
        echo "[OK] $extension installed"
    else
        echo "[ERROR] Extension not detected: $extension" >&2
        failed=1
    fi
done

if [[ "$failed" -ne 0 ]]; then
    echo "[ERROR] Some extensions could not be installed." >&2
    exit 1
fi

echo "All requested VS Code extensions are installed."
