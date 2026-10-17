# The toolchain image: node, plus the Claude Code and Codex CLIs for the terminal. A rebuild installs the latest
# versions of both; their logins are not here but in the folders of local/ the compose file mounts.
FROM node:24-trixie

# Nothing in this container runs as root, the installs included. npm's global prefix moves from the root-owned
# /usr/local to ~/.npm-global, so `npm install --global` works as node, here and in the running container (where
# both CLIs update). Not ~/.local: ~/.local/bin/claude is where Claude Code's native installer puts its launcher, and
# `claude doctor` would report two installations.
USER node
ENV NPM_CONFIG_PREFIX=/home/node/.npm-global
ENV PATH="/home/node/.npm-global/bin:${PATH}"

# Both from their official npm packages, which bring the same native binaries as the install scripts. Not Codex's
# script: it keeps the binaries under ~/.codex/packages, where local/codex is mounted for the login and would hide
# them. With the prefix owned by node, Claude Code updates itself in the running container.
RUN npm install --global --no-audit --no-fund @anthropic-ai/claude-code @openai/codex && npm cache clean --force
