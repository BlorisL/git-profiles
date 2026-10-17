#!/bin/bash
# Commit signing with GnuPG inside the container, for this repository and for the profiles' repositories.
#
#   bash scripts/setup-gpg.sh      (from the host or the container: from the host it re-runs itself in the container)
#
# Two kinds of keys, in one keyring of the container:
#   - secrets/gpg, mounted read-only in ~/.devcontainer-gpg: the key that signs this repository's own commits, as in
#     every project of the same author. It also gives the container's global git identity;
#   - local/profiles/<profile>/secrets/gpg, for the profiles that sign with openpgp: their repositories pick the key through
#     the user.signingkey of the generated config.
# Each key is an armored export: private-key.gpg and public-key.gpg.
#
# VS Code runs it when the folder opens (the hidden task in .vscode/tasks.json), and it can be run again from
# "🐳 Devcontainer". It imports the keys that are missing and asks the passphrase of each key once; the agent keeps it
# until the container stops, and git signs from places without a terminal too (the Git panel, tasks, agents).
set -e

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
if [ ! -f /.dockerenv ]; then
    exec bash "$ROOT_DIR/scripts/run.sh" bash scripts/setup-gpg.sh "$@"
fi

OWN_PRIV="$HOME/.devcontainer-gpg/private-key.gpg"
OWN_PUB="$HOME/.devcontainer-gpg/public-key.gpg"
# A keyring for signing only, which is neither ~/.gnupg nor $GNUPGHOME: there the Dev Containers extension copies the
# host's public keyring and connects the host's gpg-agent at every VS Code connection, and that agent does not know the
# container's keys (seen live: the key looked imported and signing failed). git reaches it through GPG_PROGRAM, the
# command it is given as gpg.program.
export GNUPGHOME="$HOME/.gnupg-sign"
GPG_PROGRAM="$HOME/.local/bin/gpg-sign"
export GPG_TTY="$(tty 2>/dev/null || true)"
FAILED=0

# A keyring from scratch the first time: with files of the wrong permissions (pubring.kbx 644) GnuPG 2.4 refuses a key
# ("Forbidden").
if [ ! -d "$GNUPGHOME/private-keys-v1.d" ]; then
    gpgconf --kill all 2>/dev/null || true
    rm -rf "$GNUPGHOME"
    install -d -m 700 "$GNUPGHOME" "$GNUPGHOME/private-keys-v1.d"
    # The passphrases stay in the agent while the container runs (at most a year).
    printf 'default-cache-ttl 31536000\nmax-cache-ttl 31536000\n' > "$GNUPGHOME/gpg-agent.conf"
    # loopback: gpg asks for the passphrase in the terminal itself, without the pinentry window (tasks included).
    echo 'pinentry-mode loopback' > "$GNUPGHOME/gpg.conf"
    chmod 600 "$GNUPGHOME/gpg-agent.conf" "$GNUPGHOME/gpg.conf"
fi

# The fingerprint of the key in an exported file, without importing it.
fingerprint_of() {
    gpg --batch --with-colons --import-options show-only --import "$1" 2>/dev/null | awk -F: '/^fpr/ { print $10; exit }'
}

# The keygrips of a key's secret parts in the keyring: the names of its files in private-keys-v1.d.
keygrips_of() {
    gpg --batch --with-colons --with-keygrip --list-secret-keys "$1" 2>/dev/null | awk -F: '/^grp/ { print $10 }'
}

# Whether the secret material of a key is in the keyring: a listing with "sec" is not enough, because a key that lives
# only in an agent connected from outside gives it too.
has_secret() {
    local grip
    for grip in $(keygrips_of "$1"); do
        [ -f "$GNUPGHOME/private-keys-v1.d/$grip.key" ] && return 0
    done
    return 1
}

# Whether the agent has the passphrase of a key in cache (seventh field of KEYINFO).
is_unlocked() {
    local grip
    for grip in $(keygrips_of "$1"); do
        gpg-connect-agent "KEYINFO $grip" /bye 2>/dev/null | awk '$2 == "KEYINFO" && $7 == "1" { found = 1 } END { exit !found }' && return 0
    done
    return 1
}

# Imports (when missing) and unlocks (when not in cache) one key. The passphrase is read once and goes both to the
# import and to the unlock, through a descriptor and never on the command line: on its own gpg would ask twice.
prepare_key() {
    local priv="$1" pub="$2" label="$3" fpr passphrase=""
    fpr="$(fingerprint_of "$priv")"
    if [ -z "$fpr" ]; then
        echo "$priv is not an exported GPG key ($label)." >&2
        return 1
    fi
    if ! has_secret "$fpr"; then
        echo "=== GPG: importing the key of $label ==="
        [ -f "$pub" ] && gpg --batch --quiet --import "$pub"
        read -rsp "Passphrase of the GPG key of $label: " passphrase || true
        echo
        if [ -z "$passphrase" ] || ! gpg --batch --quiet --passphrase-fd 3 --import "$priv" 3<<<"$passphrase" || ! has_secret "$fpr"; then
            echo "Key of $label not imported (wrong passphrase?)." >&2
            return 1
        fi
        # One's own key: full trust, so git log --show-signature does not mark it as unknown.
        echo "$fpr:6:" | gpg --batch --quiet --import-ownertrust
        gpg --batch --quiet --check-trustdb 2>/dev/null || true
    fi
    if ! is_unlocked "$fpr"; then
        if [ -z "$passphrase" ]; then
            echo "=== GPG: unlocking the key of $label ==="
            read -rsp "Passphrase of the GPG key of $label: " passphrase || true
            echo
        fi
        if [ -z "$passphrase" ] || ! echo sign | gpg --batch --passphrase-fd 3 --local-user "$fpr" --clearsign 3<<<"$passphrase" >/dev/null; then
            echo "Key of $label not unlocked: its commits are not signed." >&2
            return 1
        fi
    fi
    echo "GPG signing ready: $label ($fpr)."
    PREPARED_FPR="$fpr"
}

# git reaches the keyring through a small wrapper, for this repository and for the profiles alike.
install -d "$(dirname "$GPG_PROGRAM")"
printf '#!/bin/sh\nGNUPGHOME="%s" exec gpg "$@"\n' "$GNUPGHOME" > "$GPG_PROGRAM"
chmod 755 "$GPG_PROGRAM"
git config --global gpg.program "$GPG_PROGRAM"

if [ -f "$OWN_PRIV" ]; then
    if prepare_key "$OWN_PRIV" "$OWN_PUB" "secrets/gpg (this repository)"; then
        UID_LINE="$(gpg --list-secret-keys --with-colons "$PREPARED_FPR" | awk -F: '/^uid/ { print $10; exit }')"
        # The uid is "Name (comment) <email>": git gets only the name and the email. GitHub marks a signature as
        # verified only if the committer's email is one of the key's, so the identity comes from the key.
        NAME="${UID_LINE% <*}"
        git config --global user.name "${NAME% (*}"
        git config --global user.email "$(echo "$UID_LINE" | sed -n 's/.*<\(.*\)>.*/\1/p')"
        git config --global user.signingkey "$PREPARED_FPR"
        git config --global commit.gpgsign true
    else
        FAILED=1
    fi
else
    echo "No key in secrets/gpg: this repository's own commits are not signed (see README.md, Development)."
fi

for priv in "$ROOT_DIR"/local/profiles/*/secrets/gpg/private-key.gpg; do
    [ -f "$priv" ] || continue
    profile="$(basename "$(dirname "$(dirname "$(dirname "$priv")")")")"
    prepare_key "$priv" "$(dirname "$priv")/public-key.gpg" "profile $profile" || FAILED=1
done

if [ "$FAILED" -ne 0 ]; then
    echo "Some keys are not ready: run the task \"GPG signing: unlock\" again." >&2
fi
exit "$FAILED"
