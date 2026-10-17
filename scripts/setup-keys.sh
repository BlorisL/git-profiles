#!/bin/bash
# Prepares git in the container for pull and push over ssh. The key lives in secrets/ssh (outside git), and
# .devcontainer/docker-compose.yml mounts it in ~/.ssh. post-create.sh runs it at every creation of the devcontainer,
# and it can be run again by hand: it asks nothing.
#
# It needs secrets/ssh/id and id.pub: the key GitHub recognizes the pusher by. The ssh host is the one of the
# remote (origin = "git@github.com:<user>/<repo>" or "<alias>:<user>/<repo>"), so the name lives in one place only:
# the script writes its block in ~/.ssh/config.d/, pointing to github.com with the key of secrets/ssh.
#
# This is the container's own access to this repository, as in every project of the same author. The profiles in
# local/ are what the tool generates for the host, and the container does not use them for its own git.
set -e

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
if [ ! -f /.dockerenv ]; then
    exec bash "$ROOT_DIR/scripts/run.sh" bash scripts/setup-keys.sh "$@"
fi
cd "$ROOT_DIR"

SSH_PRIV="$HOME/.ssh/id"
SSH_PUB="$HOME/.ssh/id.pub"

REMOTE="$(git remote get-url origin)"
# "git@github.com:..." gives "github.com": ssh matches a Host block on the host name, never on "user@host", so a
# block named "git@github.com" would never be used and ssh would not try the key, which is not named id_*.
SSH_ALIAS="${REMOTE%%:*}"
SSH_ALIAS="${SSH_ALIAS#*@}"

echo "=== ssh: $SSH_ALIAS ==="
for file in "$SSH_PRIV" "$SSH_PUB"; do
    if [ ! -f "$file" ]; then
        echo "$file is missing: put the ssh key in secrets/ssh/ (id and id.pub)." >&2
        exit 1
    fi
done
chmod 600 "$SSH_PRIV"
chmod 644 "$SSH_PUB"
mkdir -p "$HOME/.ssh/config.d"
chmod 700 "$HOME/.ssh/config.d"
# ~/.ssh/config includes the blocks of config.d/ as its first line: a block written by hand below stays as it is.
INCLUDE_LINE="Include $HOME/.ssh/config.d/*"
if [ ! -f "$HOME/.ssh/config" ] || ! grep -Fxq "$INCLUDE_LINE" "$HOME/.ssh/config"; then
    { echo "$INCLUDE_LINE"; cat "$HOME/.ssh/config" 2>/dev/null || true; } > "$HOME/.ssh/config.tmp"
    mv "$HOME/.ssh/config.tmp" "$HOME/.ssh/config"
fi
chmod 600 "$HOME/.ssh/config"
# known_hosts outside secrets/: the first connection accepts GitHub's key, and a new container accepts it again.
cat > "$HOME/.ssh/config.d/$SSH_ALIAS.conf" <<CONF_EOF
Host $SSH_ALIAS
    HostName github.com
    User git
    IdentityFile $SSH_PRIV
    IdentitiesOnly yes
    UserKnownHostsFile $HOME/.ssh_known_hosts_cache
    StrictHostKeyChecking accept-new
CONF_EOF
chmod 600 "$HOME/.ssh/config.d/$SSH_ALIAS.conf"

echo "Done: pull and push on $SSH_ALIAS."
ssh -T "$SSH_ALIAS" 2>&1 || true
