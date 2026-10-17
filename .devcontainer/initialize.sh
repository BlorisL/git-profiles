#!/bin/bash
# Runs on the HOST before the container is created or rebuilt (initializeCommand in devcontainer.json): it needs only
# bash.
#
# It creates the folders of local/ that the compose file mounts besides this repository, owned by the user: a folder
# Docker creates for a bind mount belongs to root, and nothing in the container could write it.
#   - local/vscode-server: VS Code Server, its extensions and their storage (Intelephense's index among them);
#   - local/claude: the container's own Claude Code login and settings. Nothing of the host's ~/.claude: the container
#     never mounts the host, on purpose. The login is made once in the container and survives every rebuild;
#   - local/codex: the same for Codex, its login and settings.
#
# It writes .devcontainer/.env, which docker compose reads from the folder of its compose file, with the
# container's name: `open` attaches new VS Code windows to the running container by name, and Docker's own name
# would change with the compose project. `<checkout folder>-dev`, as docker-manager-dev: a second checkout gets a
# container of its own.
set -e
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
mkdir -p "$ROOT/local/vscode-server" "$ROOT/local/claude" "$ROOT/local/codex"
NAME="$(basename "$ROOT" | tr -c 'A-Za-z0-9_.-' '-' | sed 's/-*$//')-dev"
echo "GIT_PROFILES_CONTAINER=$NAME" > "$ROOT/.devcontainer/.env"

# And it builds the image, which the devcontainer then uses as it is (docker-compose.devcontainer.yml says why): with
# the Dockerfile inside .devcontainer/ the build needs no extra permission, and Docker's cache makes it take seconds
# when nothing changed.
docker compose -f "$ROOT/.devcontainer/docker-compose.yml" build dev
