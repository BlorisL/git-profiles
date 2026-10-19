#!/usr/bin/env bash
# Install inside the container, using the upstream installer for skills and the Codex SessionStart hook.
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
if [ ! -f /.dockerenv ]; then
    exec bash "$ROOT_DIR/scripts/run.sh" bash scripts/setup-caveman.sh "$@"
fi

echo "=== Caveman: Codex ==="
# Pin the package, skills and hook payload to the same release. The installer merges hooks.json on every run.
NPX_FLAGS=(-y)
if [ "$(npm --version | cut -d. -f1)" -ge 12 ]; then
    NPX_FLAGS+=(--allow-git=root)
fi
npx "${NPX_FLAGS[@]}" github:JuliusBrussee/caveman#v4.0.1 -- --only codex --non-interactive

echo "=== Caveman: Claude Code ==="
# An account-synced plugin already provides the skills and hooks: a second install would activate them twice.
if claude plugin list 2>/dev/null | grep -Eq 'caveman@(synced|caveman)([[:space:]]|$)'; then
    echo "Caveman is already installed or synced from the Claude account."
else
    claude plugin marketplace add JuliusBrussee/caveman
    claude plugin install caveman@caveman --scope user
fi

echo "Caveman installed. In Codex, trust its SessionStart hook once with /hooks, then start a new session."
