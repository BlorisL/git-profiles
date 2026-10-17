#!/usr/bin/env bash
# Runs a repository command inside the toolchain container, wherever it is launched from.
#
#   bash scripts/run.sh <command> [arguments...]      e.g. bash scripts/run.sh npm test
#
# Inside a container (the devcontainer, CI) it just runs the command. On the host it goes to the devcontainer of THIS
# checkout when VS Code has it open, otherwise to a throwaway container from the same image with the same mounts
# (.devcontainer/docker-compose.yml): lint, tests and `apply` never need Node on the host, nor VS Code. Signing a
# commit does need the devcontainer: the GPG passphrase lives in its agent, which a throwaway container does not keep.
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
IMAGE="node:24-trixie"
WORKDIR="/workspaces/git-profiles"

if [ -f /.dockerenv ]; then
    cd "$ROOT_DIR"
    exec "$@"
fi

# The devcontainer is found by the label the Dev Containers extension puts on it, not by name. On WSL the label is
# the folder as Windows sees it (UNC path with backslashes and the distro name), not the Linux path.
if [ -n "${WSL_DISTRO_NAME:-}" ]; then
    LABEL="\\\\wsl.localhost\\$WSL_DISTRO_NAME$(printf '%s' "$ROOT_DIR" | tr '/' '\\')"
else
    LABEL="$ROOT_DIR"
fi
CONTAINER="$(docker ps -q --filter "label=devcontainer.local_folder=$LABEL" | head -1)"

TTY=()
if [ -t 0 ] && [ -t 1 ]; then
    TTY=(-t -e "TERM=${TERM:-xterm-256color}")
fi

if [ -n "$CONTAINER" ]; then
    # `-u node`, never root: the workspace belongs to node (uid 1000, the same as the user on the host), and a root
    # command would leave files that neither VS Code nor the host can modify any more.
    exec docker exec -i "${TTY[@]}" -u node -w "$WORKDIR" "$CONTAINER" "$@"
fi

# The same environment as the devcontainer: where this checkout lives on the host and in which WSL distribution (for the
# links of `open`), and the generated git config loaded by every git (see .devcontainer/docker-compose.yml).
exec docker run --rm -i "${TTY[@]}" -u node \
    -v "$ROOT_DIR:$WORKDIR" -w "$WORKDIR" \
    -v "$ROOT_DIR/secrets/ssh:/home/node/.ssh" -v "$ROOT_DIR/secrets/gpg:/home/node/.devcontainer-gpg:ro" \
    -e "GIT_PROFILES_HOST_ROOT=$ROOT_DIR" -e "WSL_DISTRO_NAME=${WSL_DISTRO_NAME:-}" -e NPM_CONFIG_UPDATE_NOTIFIER=false \
    -e GIT_CONFIG_COUNT=1 -e GIT_CONFIG_KEY_0=include.path \
    -e "GIT_CONFIG_VALUE_0=$WORKDIR/local/git.config" \
    -e PROMPT_DIRTRIM=2 \
    "$IMAGE" "$@"
