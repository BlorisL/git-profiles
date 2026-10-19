# The toolchain image: node, plus the Claude Code and Codex CLIs for the terminal. A rebuild installs the latest
# versions of both; their logins are not here but in the folders of local/ the compose file mounts.
FROM node:24-trixie

# Claude Code usa bubblewrap per isolare il filesystem e socat per il proxy di rete del sandbox Linux.
# Installarli nell'immagine evita il warning sulle dipendenze mancanti anche dopo la ricostruzione del container.
RUN apt-get update \
    && apt-get install -y --no-install-recommends bubblewrap socat \
    && rm -rf /var/lib/apt/lists/*

# Solo i pacchetti di sistema vengono installati come root durante la build; le CLI npm e i comandi del container
# usano node. NPM_CONFIG_PREFIX sposta le installazioni globali da /usr/local, di root, a ~/.npm-global:
# npm install --global funziona così sia nella build sia nel container avviato, dove entrambe le CLI si aggiornano.
# Non usare ~/.local: l'installer nativo di Claude Code mette il launcher in ~/.local/bin/claude e
# claude doctor segnalerebbe due installazioni.
USER node
ENV NPM_CONFIG_PREFIX=/home/node/.npm-global
ENV PATH="/home/node/.npm-global/bin:${PATH}"

# Both from their official npm packages, which bring the same native binaries as the install scripts. Not Codex's
# script: it keeps the binaries under ~/.codex/packages, where local/codex is mounted for the login and would hide
# them. With the prefix owned by node, Claude Code updates itself in the running container.
RUN npm install --global --no-audit --no-fund @anthropic-ai/claude-code @openai/codex && npm cache clean --force
