# git-profiles

A container that holds your git accounts. Each account is a folder with its ssh key, its commit identity and its
signing key, and the repositories you clone with it live in that same folder. Git inside the container picks the
account from where a repository lives, so two accounts on the same server never get mixed up, and the host is never
configured: no keys in `~/.ssh`, no lines in `~/.gitconfig`, not even git itself. Docker is enough.

```
local/profiles/work/
    profile.json          name, email, signing
    git.config            written by apply: the account's key, identity and signing, for its repositories
    secrets/
        ssh/              id, id.pub: the account's ssh key
        gpg/              private-key.gpg, public-key.gpg: its GnuPG key, if it signs with openpgp
    repositories/
        app/              cloned with this account: pulls, pushes and commits as Ada <ada@example.com>
        game/
```

## Why

GitHub and GitLab recognize you by your ssh key, and one key belongs to one account. With two accounts the usual
fixes all leak into the host and into the repositories: ssh aliases in every URL (`git@github-work:example/app.git`),
rewrite rules in `~/.gitconfig`, keys scattered in `~/.ssh`, and an identity that is right in one repository and wrong
in the next.

Here everything of an account is in one folder, and the container does the rest:

- every repository under `local/profiles/<profile>/repositories/` uses that profile's key (`core.sshCommand` with
  `IdentitiesOnly`), name, email and signature, through an `includeIf "gitdir:…"` that `apply` writes into `local/git.config`, pointing to the profile's own `git.config`;
- URLs stay the standard ones, copied from the website as they are;
- the generated config reaches every git of the container through environment variables (`GIT_CONFIG_*` in the
  compose file): terminals, the Git panel of VS Code, tasks. Nothing is written to any home folder.

## Requirements

- Docker
- VS Code with the Dev Containers extension, recommended; without it every command runs from a shell through
  `scripts/run.sh`, in a throwaway container

## Quick start

1. Clone this repository wherever it should stay: your accounts and the repositories cloned with them will live
   inside it.

    ```bash
    git clone https://github.com/BlorisL/git-profiles.git ~/git-profiles
    ```

2. Open the folder in VS Code and choose **Reopen in Container**. The first time it pulls the `node:24-trixie` image
   and installs the dev dependencies.

3. Create a profile, one folder per account: run **🔐 Profiles → Create** (or `node src/cli.ts init` in the
   container's terminal). It asks, step by step:

    - the profile's name;
    - whether the account already has a key. A **GnuPG key** (exported into the profile's `secrets/gpg/` folder) gives the
      name and the email of its user id and signs the commits; an **ssh key** (copied into `secrets/ssh/`) authenticates and
      may give the email from its comment; with **none** it generates a new ssh key. For a key on the host it shows
      the commands that copy it there, and waits;
    - the commit name and email, with what the key gave already filled in;
    - how to sign the commits;
    - the ssh key to authenticate with, when the account had only a GnuPG key: a new one or one to copy.

    Then it writes `profile.json` and applies. A new ssh key is printed, to add to the account (GitHub: Settings → SSH
    and GPG keys, as an Authentication key and, to sign with it, as a Signing key).

    Or by hand: copy [`profile.example.json`](profile.example.json) into `local/profiles/work/profile.json`, put the
    key in `local/profiles/work/secrets/ssh/` as `id` and `id.pub`, and run **🔐 Profiles → Apply**.

4. Clone with the profile: **📂 Repositories → Clone** (it asks the profile and the URL), or in the container's
   terminal

    ```bash
    node src/cli.ts clone work git@github.com:example/app.git
    ```

    The clone also gets what it lacks of the files for the AI agents, the same for Claude Code and Codex (skill
    `standard:agent-files`): `AGENTS.md` from a template if it has no instructions at all, `.agents/skills/` for the
    project's skills, and `.claude/skills` linking to it. Nothing is moved or overwritten: a repository that still has
    `CLAUDE.md` or skills in `.claude/skills/` is left as it is, and the clone says how to migrate it.

5. Check that the keys work: **🔐 Profiles → Check**, or `node src/cli.ts check`.

From a shell on the host, without VS Code, the same commands are `bash scripts/run.sh node src/cli.ts <command>`.

## Profiles

A profile is a folder `local/profiles/<name>/` (lowercase letters, digits, `.`, `_`, `-`) with a `profile.json`:

| field                  | required | meaning                                                                                                                                                                                                                                        |
| ---------------------- | -------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `identity`             | yes      | `{ "name": …, "email": … }`: who the commits are made by. Use an email of the account, or the hosting service will not verify the signatures                                                                                                   |
| `key`                  | no       | the private key file in the profile's `secrets/ssh/` folder, default `id`                                                                                                                                                                      |
| `signing`              | no       | `{ "format": "ssh" }` signs with `secrets/ssh/id.pub` (or `"key": "<file in secrets/ssh/>"`); `{ "format": "openpgp", "key": "<key id>" }` signs with the GnuPG key exported in `secrets/gpg/private-key.gpg` and `secrets/gpg/public-key.gpg` |
| `host`, `port`, `user` | no       | the server `check` connects to, to test the key: default `github.com`, `22`, `git`                                                                                                                                                             |

The key decides which account a repository uses, so a profile works for any server that knows the key: GitHub,
GitLab, a self-hosted instance on another port (the port is in the URL you clone).

## Commands

| command                        | what it does                                                                                                                             |
| ------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------- |
| `apply`                        | checks every profile and its keys, and rewrites `local/git.config` and every profile's `git.config`. With any problem it changes nothing |
| `init`                         | creates a profile step by step, in the terminal; then applies                                                                            |
| `list`                         | shows the profiles and their repositories                                                                                                |
| `clone [profile] [url] [name]` | clones into `local/profiles/<profile>/repositories/<name>`, with the profile's key                                                       |
| `check [profile]`              | connects to every profile's server with its key, and asks every repository's `origin`                                                    |
| `open [profile/repository]`    | opens a repository in a new VS Code window (see below); without it, asks which                                                           |

In VS Code the same commands are in **Terminal → Run Task**: `🔐 Profiles` (create, list, apply, check),
`📂 Repositories` (open, clone, list), `🧪 Checks` and `🐳 Devcontainer`. What a command needs (a profile, a URL, a
repository) it asks in the terminal.

## Opening a repository

A repository cloned here can be opened from this container or from the host, but a repository that has its own
devcontainer belongs in its own container, with its toolchain and services. `open` (or **📂 Repositories → Open**)
picks the right place and, run from a VS Code terminal or task, opens the new window itself through VS Code's `code`
command; from anywhere else it prints a `vscode://` link to click:

- **it has a devcontainer** (`.devcontainer/devcontainer.json`): the folder opens on the host (through WSL on
  Windows), and VS Code offers **Reopen in Container**;
- **it has none**: the window attaches to this running container, where git already uses the profile. An attached
  window reads no `devcontainer.json`, so it never offers to rebuild the container git-profiles runs in. The
  container gets a stable name for this, `<checkout folder>-dev` (`.devcontainer/initialize.sh`).

Commits of a repository with its own devcontainer can be made from here (the files are the same) or from its own
container with its own keys. Its git hooks run where the commit is made: if they need the project's toolchain, commit
from its container.

## Signing

Signing with ssh needs nothing more. For openpgp, export the key into the profile:

```bash
gpg --export-secret-keys --armor <key id> > local/profiles/work/secrets/gpg/private-key.gpg
gpg --export --armor <key id> > local/profiles/work/secrets/gpg/public-key.gpg
```

When the folder opens in the devcontainer, a task asks the passphrase of every key once (`scripts/setup-gpg.sh`), and
the container's agent keeps them until the container stops.

## The devcontainer

Besides this repository, the container mounts:

- `local/vscode-server` as `~/.vscode-server`: VS Code Server and its extensions are not downloaded again at every
  rebuild, and Intelephense keeps its index instead of rebuilding it at every opening;
- `local/claude` as `~/.claude`, with `CLAUDE_CONFIG_DIR` pointing to it: the container's own Claude Code login and
  settings. Log in once in the container, and the login survives every rebuild. Nothing of the host's `~/.claude` is
  used: the container mounts nothing of the host but this repository;
- `local/codex` as `~/.codex`: the same for Codex, its login and settings.

`.devcontainer/initialize.sh` creates these folders on the host before every start, owned by you rather than by root.
The image (`.devcontainer/Dockerfile`) adds the `claude` and `codex` CLIs for the terminal from their npm packages,
installed as `node` (nothing in the container runs as root), sharing their logins with the VS Code extensions. At
every creation the post-create installs the author's common skills (`BlorisL/agent-standard`, private, reached with
the ssh key) into both (`scripts/setup-agents.sh`): the plugin `standard`, from the same marketplace, so its skills
are `standard:<name>` in both; for Codex also the hook in `~/.codex/hooks.json` (approve it once with `/hooks`) and
the session model in `~/.codex/config.toml` if it names none. Run it again to get a newer push. The extensions installed in the container are ESLint, Prettier, Vue,
Claude Code, Codex, Container Tools and PHP Intelephense; the Dev Containers extension itself runs in the host's VS
Code.

## Security

`local/` holds private keys and your repositories inside a clone of a public repository:

- `.gitignore` ignores everything under `local/` except `local/profiles/.gitkeep`;
- the pre-commit hook (`scripts/guard-local.sh`) refuses any other file under `local/` and `secrets/`, even one
  added with `git add -f`, and any staged change containing a private key;
- `apply` restricts private keys readable by others to their owner (`600`), as ssh requires.

**Deleting the clone deletes your profiles and the repositories cloned in them.** Push your work, or back up
`local/`, before removing it.

## Development

TypeScript runs directly on Node 24 (type stripping): no build and no runtime dependency.

```bash
bash scripts/run.sh npm install
bash scripts/run.sh npm run check     # typecheck, eslint, prettier, tests
```

The code follows a few deliberate rules, enforced by eslint where possible: one concept per folder under
`src/models/<name>/` (`abstract.ts`, `entity.ts`, `index.ts`, `test.ts`), classes instead of loose functions, a single
`return` per function, explicit return types, and the context (paths, environment, process runners) passed in as data,
so every command is tested against a temporary folder. Commits follow
[Conventional Commits](https://www.conventionalcommits.org/).

This repository's own commits, pulls and pushes are made from its devcontainer with the keys of whoever works on it,
in `secrets/` (ignored by git and refused by the same guard), as in every project of the same author:

```
secrets/
    ssh/   id, id.pub                        pull and push (scripts/setup-keys.sh, run by the post-create)
    gpg/   private-key.gpg, public-key.gpg   the key that signs the commits (scripts/setup-gpg.sh)
```

## License

[MIT](LICENSE)
