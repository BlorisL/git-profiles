import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { AgentFiles } from "#agentFiles";
import { Catalog } from "#catalog";
import { Editor } from "#editor";
import { GitConfig } from "#gitConfig";
import { Probe } from "#probe";
import { Profile, ProfileIdentity } from "#profile";
import { Repository } from "#repository";
import { CliAbstract, type CliType } from "./abstract.ts";

class Cli extends CliAbstract {
    protected layout!: CliType["layout"];
    protected runCommand!: CliType["run"];
    protected ask!: CliType["ask"];
    protected interactive!: CliType["interactive"];
    protected env!: CliType["env"];
    protected out!: CliType["out"];
    protected err!: CliType["err"];

    /**
     * @param data.layout - where local/ is, for the container and for the host
     * @param data.run - runs a command for the checks
     * @param data.ask - asks a question in the terminal
     * @param data.interactive - runs a command attached to the terminal
     * @param data.env - the process environment
     * @param data.out - normal output
     * @param data.err - problems
     */
    constructor(data: CliType) {
        super();
        this.layout = data.layout;
        this.runCommand = data.run;
        this.ask = data.ask;
        this.interactive = data.interactive;
        this.env = data.env;
        this.out = data.out;
        this.err = data.err;
    }

    public static override readonly USAGE: string = [
        "Usage: node src/cli.ts <command>      (in the container: bash scripts/run.sh node src/cli.ts <command>)",
        "",
        "  apply                          generate the git config of every profile in local/profiles",
        "  list                           show the profiles and their repositories",
        "  clone [profile] [url] [name]   clone a repository into the profile's repositories/ folder (asks what is missing)",
        "  check [profile]                test the profiles' keys and their repositories' remotes",
        "  open [profile/repository]      open a repository in a new VS Code window (asks which, if not given)",
        "  init                           create a profile, step by step (asks in the terminal)",
        "  help                           show this text",
    ].join("\n");

    /** The permission bits ssh accepts on a private key: anything readable by others is refused as unprotected. */
    protected static readonly PRIVATE_KEY_MODE: number = 0o600;

    /** The environment variable that VS Code sets in its terminals, where the `code` command reaches the window. */
    protected static readonly VSCODE_CLI_VARIABLE: string = "VSCODE_IPC_HOOK_CLI";

    /** The environment variable with this container's name, set by the compose file for the attach links of `open`. */
    protected static readonly CONTAINER_VARIABLE: string = "GIT_PROFILES_CONTAINER";

    /**
     * Reads the profiles and prints their problems. `undefined` when there is any: no command works on half a
     * catalog, because a profile left out silently would leave its repositories with the container's own identity.
     */
    protected readCatalog(): Catalog | undefined {
        const errors: string[] = [];
        const data = Catalog.read(this.layout.getProfilesDir(), errors);
        let result: Catalog | undefined;
        if (errors.length > 0) {
            errors.forEach((error) => this.err(error));
            this.err(`${errors.length} problem(s) in ${this.layout.getProfilesDir()}: nothing was changed.`);
        } else {
            result = new Catalog(data);
        }
        return result;
    }

    /**
     * Checks the key files of every profile, and restricts a private key readable by others to its owner: ssh refuses
     * it otherwise ("UNPROTECTED PRIVATE KEY FILE"), and a key copied from another machine usually arrives as 644.
     * @param profiles - the profiles
     */
    protected checkKeys(profiles: Profile[]): string[] {
        const errors: string[] = [];
        for (const profile of profiles) {
            const name = profile.getName();
            const key = this.layout.getSshPath(name, profile.getKey());
            const signing = profile.getSigning();
            if (!existsSync(key)) {
                errors.push(`${name}: the ssh key ${key} does not exist`);
            } else if ((statSync(key).mode & 0o077) !== 0) {
                chmodSync(key, Cli.PRIVATE_KEY_MODE);
                this.out(`Restricted ${key} to its owner (600): ssh refuses a private key others can read.`);
            }
            if (signing?.isFile() === true && !existsSync(this.layout.getSshPath(name, signing.getKey()))) {
                errors.push(
                    `${name}: the signing key ${this.layout.getSshPath(name, signing.getKey())} does not exist`
                );
            }
            if (signing?.getFormat() === "openpgp" && !existsSync(this.layout.getGpgPath(name, "private-key.gpg"))) {
                errors.push(`${name}: signing with openpgp needs the exported key in ${this.layout.getGpgPath(name)}`);
            }
        }
        return errors;
    }

    /**
     * Writes the main git config and every profile's git.config, and creates every profile's `repositories/` folder,
     * which the includeIf of the main config points to. A removed profile takes its git.config with its folder, and
     * the main config, rewritten here, no longer names it.
     * @param profiles - the profiles
     */
    protected writeGenerated(profiles: Profile[]): void {
        const git = GitConfig.render({ profiles, layout: this.layout });
        mkdirSync(this.layout.getRoot(), { recursive: true });
        writeFileSync(this.layout.getMainConfigPath(), git.main);
        for (const profile of git.profiles) {
            writeFileSync(this.layout.getProfileConfigPath(profile.profile), profile.content);
        }
        for (const profile of profiles) {
            const signing = profile.getSigning();
            mkdirSync(this.layout.getProfilePath(profile.getName(), "repositories"), { recursive: true });
            if (signing?.isFile() === true) {
                const publicKey = this.layout.getSshPath(profile.getName(), signing.getKey());
                writeFileSync(
                    GitConfig.allowedSignersPath(this.layout, profile.getName()),
                    GitConfig.allowedSigner(profile.getIdentity().getEmail(), readFileSync(publicKey, "utf8"))
                );
            }
        }
    }

    /**
     * Every repository of every profile.
     * @param catalog - the profiles
     */
    protected repositories(catalog: Catalog): Repository[] {
        return catalog
            .getProfiles()
            .flatMap((profile) =>
                Repository.list(profile.getName(), this.layout.getProfilePath(profile.getName(), "repositories"))
            )
            .map((data) => new Repository(data));
    }

    /**
     * Checks the keys and writes the generated config. `undefined` when a key is missing: then nothing is written.
     */
    protected prepare(): Catalog | undefined {
        const catalog = this.readCatalog();
        const errors = catalog !== undefined ? this.checkKeys(catalog.getProfiles()) : [];
        let result: Catalog | undefined;
        if (errors.length > 0) {
            errors.forEach((error) => this.err(error));
            this.err("Nothing was changed.");
        } else if (catalog !== undefined) {
            this.writeGenerated(catalog.getProfiles());
            result = catalog;
        }
        return result;
    }

    protected apply(): number {
        const catalog = this.prepare();
        if (catalog !== undefined && catalog.getProfiles().length === 0) {
            this.out(`No profiles in ${this.layout.getProfilesDir()}: add one (see README.md), then run apply again.`);
        } else if (catalog !== undefined) {
            const names = catalog.getProfiles().map((profile) => profile.getName());
            this.out(`Applied ${names.length} profile(s): ${names.join(", ")}.`);
            this.out(`Every git in this container now loads ${this.layout.getMainConfigPath()}.`);
        }
        return catalog !== undefined ? 0 : 1;
    }

    protected list(): number {
        const catalog = this.readCatalog();
        const repositories = catalog !== undefined ? this.repositories(catalog) : [];
        if (catalog !== undefined && catalog.getProfiles().length === 0) {
            this.out(`No profiles in ${this.layout.getProfilesDir()}.`);
        }
        for (const profile of catalog?.getProfiles() ?? []) {
            const identity = profile.getIdentity();
            const signing = profile.getSigning();
            this.out(`${profile.getName()}  ${identity.getName()} <${identity.getEmail()}>`);
            this.out(`    server    ${profile.getUser()}@${profile.getHost()}:${profile.getPort()}`);
            this.out(`    key       ssh/${profile.getKey()}`);
            if (signing !== undefined) {
                this.out(`    signing   ${signing.getFormat()} ${signing.getKey()}`);
            }
            const own = repositories.filter((repository) => repository.getProfile() === profile.getName());
            this.out(`    repositories${own.length === 0 ? "  none yet" : ""}`);
            for (const repository of own) {
                this.out(
                    `        ${repository.getName()}${repository.hasDevcontainer() ? "  (own devcontainer)" : ""}`
                );
            }
        }
        return catalog !== undefined ? 0 : 1;
    }

    /**
     * @param args - profile, URL and optional folder name
     */
    protected clone(args: string[]): number {
        const catalog = this.prepare();
        const profiles = catalog?.getProfiles() ?? [];
        // What the command line does not say is asked in the terminal: one task in the menu covers every clone.
        const name =
            args[0] ??
            (profiles.length > 0
                ? this.choose(
                      "Clone with which profile?",
                      profiles.map((candidate) => ({
                          value: candidate.getName(),
                          label: `${candidate.getIdentity().getName()} <${candidate.getIdentity().getEmail()}>`,
                      }))
                  )
                : undefined);
        const url =
            args[1] ??
            (name !== undefined ? this.text("Repository URL (git@…, ssh://…, https://…)", undefined) : undefined);
        const profile = catalog?.find(name ?? "");
        const repository = args[2] ?? (url !== undefined ? Repository.nameFromUrl(url) : undefined);
        let status = 1;
        if (catalog !== undefined && profiles.length === 0) {
            this.err("No profiles yet: create one first (🔐 Profiles → Create, or init).");
        } else if (name === undefined || url === undefined) {
            this.err("Stopped: nothing was cloned.");
        } else if (catalog === undefined) {
            status = 1;
        } else if (profile === undefined) {
            const names = catalog.getProfiles().map((candidate) => candidate.getName());
            this.err(`No profile "${name}". Profiles: ${names.length > 0 ? names.join(", ") : "none yet"}.`);
        } else if (repository === undefined || !Repository.NAME_PATTERN.test(repository)) {
            this.err(`Cannot use a folder name from ${url}: give one, as in clone ${name} ${url} <name>.`);
        } else if (existsSync(this.layout.getProfilePath(name, "repositories", repository))) {
            this.err(`${this.layout.getProfilePath(name, "repositories", repository)} already exists.`);
        } else {
            const target = this.layout.getProfilePath(name, "repositories", repository);
            // The generated config reaches the repository only once it exists: the clone itself gets the profile's key
            // through GIT_SSH_COMMAND, and from the first fetch on the includeIf takes over.
            const ssh = GitConfig.sshCommand(
                this.layout.getSshPath(name, profile.getKey()),
                this.layout.getKnownHostsPath()
            );
            const result = this.interactive("git", ["clone", url, target], { GIT_SSH_COMMAND: ssh });
            if (result === 0) {
                this.out(`Cloned into ${target}.`);
                // What the clone lacks of the files for the AI agents, so a new project needs no step by hand.
                const agents = AgentFiles.scaffold(target);
                if (agents.created.length > 0) {
                    this.out(`Agent files created: ${agents.created.join(", ")}.`);
                }
                agents.notes.forEach((note) => this.out(note));
                this.out(`Open it with: open ${name}/${repository}`);
                status = 0;
            }
        }
        return status;
    }

    /**
     * @param args - optionally the one profile to check
     */
    protected check(args: string[]): number {
        const catalog = this.readCatalog();
        const only = args[0];
        const profiles =
            catalog?.getProfiles().filter((profile) => only === undefined || profile.getName() === only) ?? [];
        const probe = new Probe({ run: this.runCommand, knownHosts: this.layout.getKnownHostsPath() });
        let failures = catalog === undefined ? 1 : 0;
        if (catalog !== undefined && only !== undefined && profiles.length === 0) {
            this.err(`No profile "${only}".`);
            failures = 1;
        }
        const repositories = catalog !== undefined ? this.repositories(catalog) : [];
        for (const profile of profiles) {
            const key = this.layout.getSshPath(profile.getName(), profile.getKey());
            const greeting = probe.greet({
                key,
                user: profile.getUser(),
                host: profile.getHost(),
                port: profile.getPort(),
            });
            this.out(`${greeting.ok ? "✔" : "✘"} ${profile.getName()} (${profile.getHost()}): ${greeting.output}`);
            failures += greeting.ok ? 0 : 1;
            for (const repository of repositories.filter((candidate) => candidate.getProfile() === profile.getName())) {
                const reach = probe.reach(repository.getPath(), key);
                this.out(`    ${reach.ok ? "✔" : "✘"} ${repository.getName()}${reach.ok ? "" : `: ${reach.output}`}`);
                failures += reach.ok ? 0 : 1;
            }
        }
        return failures === 0 ? 0 : 1;
    }

    /**
     * @param args - the repository as `<profile>/<name>`
     */
    protected open(args: string[]): number {
        const catalog = this.readCatalog();
        const all = catalog !== undefined ? this.repositories(catalog) : [];
        const id =
            args[0] ??
            (all.length > 0
                ? this.choose(
                      "Open which repository?",
                      all.map((candidate) => ({
                          value: candidate.getId(),
                          label: candidate.hasDevcontainer() ? "its own devcontainer" : "this container",
                      }))
                  )
                : undefined);
        const repository = all.find((candidate) => candidate.getId() === id);
        let status = 1;
        if (catalog !== undefined && all.length === 0) {
            this.err("No repositories yet: clone one first (📂 Repositories → Clone, or clone).");
        } else if (id === undefined) {
            this.err("Stopped: nothing was opened.");
        } else if (catalog === undefined) {
            status = 1;
        } else if (repository === undefined) {
            this.err(`No repository "${id}": see list, or clone it first.`);
        } else {
            const host = {
                hostPath: this.layout.toHostPath(repository.getPath()),
                ...(this.layout.getDistro() !== undefined ? { distro: this.layout.getDistro()! } : {}),
            };
            const container = this.env[Cli.CONTAINER_VARIABLE];
            // A repository with its own devcontainer opens on the host, where VS Code offers its own container: its
            // toolchain, services and keys are there. Any other opens in a window attached to this running container,
            // where git already uses the profiles: attached, the window reads no devcontainer.json, so it never offers
            // to rebuild the container git-profiles runs in.
            const attached = !repository.hasDevcontainer() && container !== undefined && container !== "";
            const target = attached ? { container: container!, path: repository.getPath() } : host;
            let where = "on the host";
            if (repository.hasDevcontainer()) {
                where = 'on the host, then choose "Reopen in Container"';
            } else if (attached) {
                where = "of this container";
            }
            // In a VS Code terminal (tasks included) `code` reaches the window and opens the folder without a click;
            // anywhere else, or if it fails, the link is printed to click. From a terminal of this container `code`
            // reads a `file://` URI as a folder of the container, where the host's path does not exist (VS Code said
            // "Workspace does not exist"): a host folder off WSL gets the link, which the host's VS Code opens.
            const reachable = attached || !this.layout.isInContainer() || this.layout.getDistro() !== undefined;
            const opened =
                this.env[Cli.VSCODE_CLI_VARIABLE] !== undefined &&
                reachable &&
                this.interactive("code", ["--new-window", "--folder-uri", Editor.folderUri(target)], {}) === 0;
            if (opened) {
                this.out(`Opening ${id} in a new VS Code window ${where}.`);
            } else {
                this.out(`Click to open ${id} in a new VS Code window ${where}:`);
                this.out(
                    attached
                        ? Editor.attachUri({ container: container!, path: repository.getPath() })
                        : Editor.uri(host)
                );
            }
            status = 0;
        }
        return status;
    }

    /**
     * Asks a question until the answer is one of the options, shown numbered; Enter picks the first. `undefined`
     * when the input ends (Ctrl+D), which stops the wizard.
     * @param question - what to choose
     * @param options - the values and their explanations
     */
    protected choose(question: string, options: { value: string; label: string }[]): string | undefined {
        this.out(question);
        options.forEach((option, index) => this.out(`  ${index + 1}) ${option.value}: ${option.label}`));
        let result: string | undefined;
        let answered = false;
        while (!answered) {
            const answer = this.ask("Choice [1]: ");
            const index = answer === "" ? 0 : Number(answer) - 1;
            if (answer === undefined) {
                answered = true;
            } else if (Number.isInteger(index) && options[index] !== undefined) {
                result = options[index].value;
                answered = true;
            } else {
                this.err(`Type a number from 1 to ${options.length}.`);
            }
        }
        return result;
    }

    /**
     * Asks for a text with a proposed value, which Enter accepts. `undefined` when the input ends.
     * @param question - what to type
     * @param proposal - the value Enter accepts, if any
     */
    protected text(question: string, proposal: string | undefined): string | undefined {
        const answer = this.ask(proposal !== undefined ? `${question} [${proposal}]: ` : `${question}: `);
        return answer === undefined ? undefined : answer.trim() === "" ? proposal : answer.trim();
    }

    /**
     * Waits until files exist, telling where to copy them: the container sees only this repository, so a key from
     * elsewhere on the host has to be copied into the profile's folder first. `false` when the person gives up.
     * @param files - the files to wait for
     * @param how - the commands that put them there, run on the host
     */
    protected waitFor(files: string[], how: string[]): boolean {
        let present = files.every((file) => existsSync(file));
        let stopped = false;
        if (!present) {
            this.out("Copy them from a terminal on the host, for example:");
            how.forEach((line) => this.out(`    ${line}`));
        }
        while (!present && !stopped) {
            const answer = this.ask("Press Enter when they are there (q to stop): ");
            present = files.every((file) => existsSync(file));
            stopped = answer === undefined || answer.trim() === "q";
            if (!present && !stopped) {
                this.err(`Still missing: ${files.filter((file) => !existsSync(file)).join(", ")}`);
            }
        }
        return present;
    }

    /**
     * Reads the fingerprint and the user id of an exported GnuPG public key, without importing it anywhere.
     * @param file - the armored public key
     */
    protected readGpgKey(file: string): { fingerprint?: string; uid?: string } {
        const home = mkdtempSync(join(tmpdir(), "git-profiles-gnupg-"));
        const listing = this.runCommand("gpg", ["--batch", "--with-colons", "--show-keys", file], { GNUPGHOME: home });
        rmSync(home, { recursive: true, force: true });
        const field = (type: string): string | undefined =>
            listing.output
                .split("\n")
                .find((line) => line.startsWith(`${type}:`))
                ?.split(":")[9];
        const fingerprint = field("fpr");
        const uid = field("uid");
        return { ...(fingerprint !== undefined ? { fingerprint } : {}), ...(uid !== undefined ? { uid } : {}) };
    }

    /**
     * Creates a profile step by step: first the key the account already has, because a GnuPG key gives name and
     * email and an ssh key may give the email, then the identity, the signing and the ssh key to authenticate with.
     * It writes profile.json last and applies; stopped halfway, it resumes from the folder already there, and it
     * never touches a profile that has its profile.json.
     */
    protected init(): number {
        let status = 1;
        let profile = this.text("Profile name (a folder: lowercase letters, digits, . _ -, e.g. work)", undefined);
        while (
            profile !== undefined &&
            (!Profile.NAME_PATTERN.test(profile) || existsSync(this.layout.getProfilePath(profile, "profile.json")))
        ) {
            this.err(
                Profile.NAME_PATTERN.test(profile)
                    ? `${profile} already exists: edit its profile.json instead.`
                    : "Not a valid name."
            );
            profile = this.text("Profile name", undefined);
        }
        const source =
            profile !== undefined
                ? this.choose("Does the account already have a key?", [
                      { value: "gpg", label: "a GnuPG key: name and email come from it, and it signs the commits" },
                      { value: "ssh", label: "an ssh key: it authenticates, and its comment may give the email" },
                      { value: "none", label: "no: generate a new ssh key" },
                  ])
                : undefined;
        let proposal: Partial<{ name: string; email: string }> = {};
        let gpgKey: string | undefined;
        let ready = profile !== undefined && source !== undefined;
        if (ready && profile !== undefined) {
            mkdirSync(this.layout.getSshPath(profile), { recursive: true });
        }
        if (ready && profile !== undefined && source === "gpg") {
            const gpg = this.layout.getGpgPath(profile);
            mkdirSync(gpg, { recursive: true });
            this.out(`The exported key goes in ${this.layout.toHostPath(gpg)}: private-key.gpg and public-key.gpg.`);
            ready = this.waitFor(
                [join(gpg, "private-key.gpg"), join(gpg, "public-key.gpg")],
                [
                    `gpg --export-secret-keys --armor <key id> > ${this.layout.toHostPath(gpg)}/private-key.gpg`,
                    `gpg --export --armor <key id> > ${this.layout.toHostPath(gpg)}/public-key.gpg`,
                ]
            );
            const key = ready ? this.readGpgKey(join(gpg, "public-key.gpg")) : {};
            gpgKey = key.fingerprint;
            proposal = key.uid !== undefined ? ProfileIdentity.fromUid(key.uid) : {};
            if (ready && gpgKey === undefined) {
                this.err(`${join(gpg, "public-key.gpg")} is not an exported GnuPG key.`);
                ready = false;
            }
        } else if (ready && profile !== undefined && source === "ssh") {
            ready = this.copySshKey(profile);
            const pub = this.layout.getSshPath(profile, `${Profile.DEFAULT_KEY}.pub`);
            proposal = ready && existsSync(pub) ? ProfileIdentity.fromSshPublicKey(readFileSync(pub, "utf8")) : {};
        }
        const name = ready ? this.text("Commit name", proposal.name) : undefined;
        const email = name !== undefined ? this.text("Commit email (one of the account's)", proposal.email) : undefined;
        const signing =
            email !== undefined
                ? this.choose("Sign the commits with", [
                      ...(gpgKey !== undefined ? [{ value: "openpgp", label: `the GnuPG key ${gpgKey}` }] : []),
                      { value: "ssh", label: "the profile's ssh key (add it to the account as a Signing key too)" },
                      { value: "none", label: "nothing: commits are not signed" },
                  ])
                : undefined;
        if (profile === undefined || signing === undefined || name === undefined || email === undefined) {
            this.err("Stopped: run init again to go on, nothing of the profile is used until its profile.json exists.");
        } else {
            const content = {
                identity: { name, email },
                ...(signing === "openpgp" ? { signing: { format: "openpgp", key: gpgKey } } : {}),
                ...(signing === "ssh" ? { signing: { format: "ssh" } } : {}),
            };
            const errors: string[] = [];
            const key = this.layout.getSshPath(profile, Profile.DEFAULT_KEY);
            if (Profile.parse(profile, content, errors) === undefined) {
                errors.forEach((error) => this.err(error));
            } else if (existsSync(key) || this.chooseSshKey(profile, email)) {
                writeFileSync(
                    this.layout.getProfilePath(profile, "profile.json"),
                    `${JSON.stringify(content, null, 4)}\n`
                );
                this.out(`Created ${this.layout.getProfilePath(profile, "profile.json")}.`);
                this.out("");
                status = this.apply();
            } else {
                this.err("No ssh key: run init again when it is there.");
            }
        }
        return status;
    }

    /**
     * Waits for an existing ssh key copied into the profile's secrets/ssh/ folder.
     * @param profile - the profile's name
     */
    protected copySshKey(profile: string): boolean {
        const ssh = this.layout.toHostPath(this.layout.getSshPath(profile));
        this.out(`The key goes in ${ssh}, as id and id.pub.`);
        return this.waitFor(
            [
                this.layout.getSshPath(profile, Profile.DEFAULT_KEY),
                this.layout.getSshPath(profile, `${Profile.DEFAULT_KEY}.pub`),
            ],
            [`install -m 600 ~/.ssh/<key> ${ssh}/id`, `cp ~/.ssh/<key>.pub ${ssh}/id.pub`]
        );
    }

    /**
     * Gets the ssh key a GnuPG or new profile authenticates with: a new one, or one to copy.
     * @param profile - the profile's name
     * @param email - the comment of a new key
     */
    protected chooseSshKey(profile: string, email: string): boolean {
        const how = this.choose("The ssh key the account authenticates with", [
            { value: "generate", label: "a new ed25519 key, whose public key you add to the account" },
            { value: "copy", label: "an existing key, copied into the profile's secrets/ssh/ folder" },
        ]);
        let result = false;
        if (how === "generate") {
            result = this.generateKey(profile, email) === 0;
        } else if (how === "copy") {
            result = this.copySshKey(profile);
        }
        return result;
    }

    /**
     * Makes a new ed25519 key for a profile with ssh-keygen, which asks for its passphrase, and prints the public key
     * with where it goes: an empty passphrase lets git work without asking at every fetch, since this container has
     * no ssh agent.
     * @param profile - the profile's name
     * @param email - the comment of the key, so the hosting service shows whose it is
     */
    protected generateKey(profile: string, email: string): number {
        const key = this.layout.getSshPath(profile, Profile.DEFAULT_KEY);
        this.out("Generating the ssh key (an empty passphrase lets git work without asking at every fetch):");
        const status = this.interactive("ssh-keygen", ["-t", "ed25519", "-C", email, "-f", key], {});
        if (status === 0) {
            this.out("");
            this.out("Add this public key to the account, as an Authentication key and, to sign, as a Signing key");
            this.out("(GitHub: Settings → SSH and GPG keys → New SSH key):");
            this.out("");
            this.out(readFileSync(`${key}.pub`, "utf8").trim());
        }
        return status === 0 ? 0 : 1;
    }

    public run(args: string[]): number {
        const [command, ...rest] = args;
        let status: number;
        if (command === undefined || command === "help" || command === "--help" || command === "-h") {
            this.out(Cli.USAGE);
            status = 0;
        } else if (!this.layout.isInContainer()) {
            // The host is never configured: every key and every repository is handled in the container.
            this.err("git-profiles runs only in its container: bash scripts/run.sh node src/cli.ts " + args.join(" "));
            status = 1;
        } else if (command === "apply") {
            status = this.apply();
        } else if (command === "list") {
            status = this.list();
        } else if (command === "clone") {
            status = this.clone(rest);
        } else if (command === "check") {
            status = this.check(rest);
        } else if (command === "open") {
            status = this.open(rest);
        } else if (command === "init") {
            status = this.init();
        } else {
            this.err(`Unknown command "${command}".`);
            this.err(Cli.USAGE);
            status = 1;
        }
        return status;
    }
}

export { Cli };
