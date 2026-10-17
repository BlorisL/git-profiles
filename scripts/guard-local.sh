#!/bin/sh
# Refuses a commit that would publish anything from local/ or secrets/, or anything that looks like a private key.
#
# local/ holds the profiles, their private keys and the repositories cloned with them, secrets/ the keys of this
# repository's own git, and this repository is public: .gitignore keeps them out, but a `git add -f` or an edited
# .gitignore would push a key to GitHub, where it may be cached or indexed even after deletion, and then it has to be
# revoked and replaced. The only files allowed there are the .gitkeep ones.
status=0

forbidden="$(git diff --cached --name-only --diff-filter=ACMR -- local secrets \
    | grep -v -x -e 'local/profiles/.gitkeep' -e 'secrets/ssh/.gitkeep' -e 'secrets/gpg/.gitkeep' \
    -e 'secrets/npm/.gitkeep' || true)"
if [ -n "$forbidden" ]; then
    echo "pre-commit: files under local/ and secrets/ never go into the repository:" >&2
    echo "$forbidden" | sed 's/^/  /' >&2
    echo "Unstage them with: git restore --staged <file>" >&2
    status=1
fi

# The added lines of the whole staged diff, so a key pasted into any file is caught too. [Y] and [K] keep this line
# from matching itself: written out in full, the patterns would be key headers and the guard would refuse itself.
if git diff --cached --diff-filter=ACMR -U0 | grep '^+' | grep -q -e '-----BEGIN [A-Z ]*PRIVATE KE[Y]-----' -e '-----BEGIN PGP PRIVATE KEY BLOC[K]-----'; then
    echo "pre-commit: the staged changes contain a private key." >&2
    status=1
fi

exit $status
