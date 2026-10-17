#!/bin/bash
# Prepares the devcontainer after creation: git trusting the mounted workspace, the ssh key for pull and push, the dev
# dependencies, and the profiles applied (the generated git config that every git in the container loads).
set -e
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

# The workspace is a bind mount from the host: when the owner uid differs from the container's, git calls it
# "dubious ownership" and refuses every command.
git config --global --add safe.directory "$ROOT"

# Without the key in secrets/ssh the devcontainer opens anyway: pull and push are set up later, running it again.
bash "$ROOT/scripts/setup-keys.sh" || echo "ssh key not configured: see scripts/setup-keys.sh."

(cd "$ROOT" && npm install --no-audit --no-fund) || echo "npm install failed: lint and typecheck will not work."

# The skills of agent-standard for Claude Code and Codex, through the ssh key: without it the container opens anyway,
# and running the script again installs them.
bash "$ROOT/scripts/setup-agents.sh" || echo "Skills not installed: see scripts/setup-agents.sh."
# Without profiles in local/profiles the container opens anyway: add them and run `npm run gp -- apply`. GPG signing
# is not prepared here: it needs the passphrases, so the task that runs when the folder opens asks for them.
(cd "$ROOT" && node src/cli.ts apply) || echo "Profiles not applied: see the README, then run npm run gp -- apply."
