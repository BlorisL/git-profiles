#!/bin/bash
# Installs agent-standard (the author's skills and hooks common to every project) into the container's Claude Code
# and Codex. post-create.sh runs it at every creation of the devcontainer, so a new machine gets them with no step by
# hand; run it again to bring a newer push of agent-standard in.
#
#   - Claude Code: the plugin `standard` from the marketplace agent-standard, user scope, so it is active in every
#     repository opened in this container. Claude Code clones it into its own cache, in local/claude: it survives
#     rebuilds, and this script only updates it.
#   - Codex: the same plugin, from the same marketplace (Codex reads .claude-plugin/marketplace.json), so its skills
#     are standard:<name> there too. Codex does not run a plugin's hooks, so model-routing's hook goes in
#     ~/.codex/hooks.json, run from a checkout in ~/.local/share/agent-standard; and the session model it is
#     written for goes in ~/.codex/config.toml. Both live in local/codex and survive rebuilds.
#
# Nothing of the user's own is overwritten: hooks.json is merged without removing other hooks, and
# the session model only if config.toml names none.
#
# The repository is private: it is reached with the container's ssh key, through the alias setup-keys.sh writes.
# AGENT_STANDARD_URL points elsewhere, e.g. a local checkout to try a change before pushing it.
set -e

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
if [ ! -f /.dockerenv ]; then
    exec bash "$ROOT_DIR/scripts/run.sh" bash scripts/setup-agents.sh "$@"
fi

URL="${AGENT_STANDARD_URL:-git@github.com:BlorisL/agent-standard.git}"
MARKETPLACE="agent-standard"
PLUGIN="standard@$MARKETPLACE"
CHECKOUT="$HOME/.local/share/agent-standard"
CODEX_DIR="${CODEX_HOME:-$HOME/.codex}"
HOOKS="$CODEX_DIR/hooks.json"
CONFIG="$CODEX_DIR/config.toml"

echo "=== Claude Code: $PLUGIN ==="
# By its name, the line "❯ <name>": the source line under it names the URL, which contains the name too.
if claude plugin marketplace list 2> /dev/null | grep -q "❯ $MARKETPLACE$"; then
    claude plugin marketplace update "$MARKETPLACE"
else
    claude plugin marketplace add "$URL"
fi
if claude plugin list 2> /dev/null | grep -q "$PLUGIN"; then
    claude plugin update "$PLUGIN" --scope user
else
    claude plugin install "$PLUGIN" --scope user
fi

echo "=== Codex: $PLUGIN ==="
if [ -d "$CHECKOUT/.git" ]; then
    git -C "$CHECKOUT" remote set-url origin "$URL"
    git -C "$CHECKOUT" fetch --quiet origin
    git -C "$CHECKOUT" reset --quiet --hard "@{upstream}"
else
    rm -rf "$CHECKOUT"
    git clone --quiet "$URL" "$CHECKOUT"
fi
if codex plugin marketplace list 2> /dev/null | grep -q "^$MARKETPLACE "; then
    # Only a git marketplace has a snapshot to refresh: one added from a folder (AGENT_STANDARD_URL) is read in place.
    codex plugin marketplace upgrade "$MARKETPLACE" || echo "$MARKETPLACE is read from its folder: nothing to upgrade."
else
    codex plugin marketplace add "$URL"
fi
codex plugin add "$PLUGIN"

# Keep Caveman's SessionStart and user hooks when refreshing model-routing.
node "$ROOT_DIR/scripts/setup-codex-hooks.ts" "$HOOKS" "$CHECKOUT"
echo "hook in $HOOKS (approve it once in Codex with /hooks)"

# The top-level keys of a TOML file must come before its first table, so they go at the top.
if ! grep -q '^model *=' "$CONFIG" 2> /dev/null; then
    { printf 'model = "gpt-6.1-sol"\nmodel_reasoning_effort = "medium"\n\n'; cat "$CONFIG" 2> /dev/null || true; } > "$CONFIG.tmp"
    mv "$CONFIG.tmp" "$CONFIG"
    echo "session model in $CONFIG: gpt-6.1-sol, medium"
fi

echo "Done."
