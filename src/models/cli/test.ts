import { strictEqual } from "node:assert/strict";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { afterEach, beforeEach, describe, it } from "node:test";
import { Layout } from "#layout";
import { Cli } from "./entity.ts";

/** A checkout in a temporary folder, with one profile and its key, and what the commands did. */
interface SandboxType {
    repository: string;
    out: string[];
    err: string[];
    calls: { command: string; args: string[]; env: Record<string, string> }[];
}

let sandbox: SandboxType;

/** Writes a profile's profile.json into the sandbox. */
function profile(name: string, content: Record<string, unknown>): void {
    mkdirSync(join(sandbox.repository, "local", "profiles", name, "secrets", "ssh"), { recursive: true });
    writeFileSync(join(sandbox.repository, "local", "profiles", name, "profile.json"), JSON.stringify(content));
}

/** Makes a folder look like a cloned repository of a profile. */
function cloned(profileName: string, name: string, devcontainer: boolean = false): string {
    const path = join(sandbox.repository, "local", "profiles", profileName, "repositories", name);
    mkdirSync(join(path, ".git"), { recursive: true });
    if (devcontainer) {
        mkdirSync(join(path, ".devcontainer"));
        writeFileSync(join(path, ".devcontainer", "devcontainer.json"), "{}");
    }
    return path;
}

/** The command line over the sandbox, in a container whose checkout the host sees at /host/gp on WSL. */
function cli(
    options: {
        inContainer?: boolean;
        status?: number;
        env?: Record<string, string>;
        interactive?: (command: string, args: string[]) => number;
        answers?: (string | undefined)[];
        output?: string;
        distro?: string | null;
    } = {}
): Cli {
    return new Cli({
        layout: new Layout(
            Layout.detect({
                repository: sandbox.repository,
                hostRepository: "/host/gp",
                inContainer: options.inContainer ?? true,
                distro: options.distro === null ? undefined : (options.distro ?? "Debian"),
            })
        ),
        run: (command, args, env): { status: number; output: string } => {
            sandbox.calls.push({ command, args, env });
            return { status: options.status ?? 0, output: options.output ?? "Hi Ada!" };
        },
        interactive: (command, args, env): number => {
            sandbox.calls.push({ command, args, env });
            return options.interactive !== undefined ? options.interactive(command, args) : (options.status ?? 0);
        },
        ask: (question): string | undefined => {
            sandbox.out.push(question);
            return options.answers?.shift();
        },
        env: options.env ?? {},
        out: (text): void => {
            sandbox.out.push(text);
        },
        err: (text): void => {
            sandbox.err.push(text);
        },
    });
}

beforeEach(() => {
    sandbox = { repository: join(mkdtempSync(join(tmpdir(), "git-profiles-cli-")), "gp"), out: [], err: [], calls: [] };
    profile("work", { identity: { name: "Ada", email: "ada@example.com" } });
    writeFileSync(join(sandbox.repository, "local", "profiles", "work", "secrets", "ssh", "id"), "key", {
        mode: 0o644,
    });
});

afterEach(() => rmSync(dirname(sandbox.repository), { recursive: true, force: true }));

describe("Cli outside a container", () => {
    it("refuses every command but help: the host is never configured", () => {
        strictEqual(cli({ inContainer: false }).run(["apply"]), 1);
        strictEqual(existsSync(join(sandbox.repository, "local", "git.config")), false);
        strictEqual(cli({ inContainer: false }).run(["help"]), 0);
    });
});

describe("Cli apply", () => {
    it("generates the includeIf of every profile and creates its repositories/ folder", () => {
        strictEqual(cli().run(["apply"]), 0);
        const main = readFileSync(join(sandbox.repository, "local", "git.config"), "utf8");
        strictEqual(
            main.includes(`gitdir:${join(sandbox.repository, "local", "profiles", "work", "repositories")}/`),
            true
        );
        strictEqual(existsSync(join(sandbox.repository, "local", "profiles", "work", "repositories")), true);
    });

    it("restricts a private key readable by others to its owner", () => {
        cli().run(["apply"]);
        strictEqual(
            statSync(join(sandbox.repository, "local", "profiles", "work", "secrets", "ssh", "id")).mode & 0o777,
            0o600
        );
    });

    it("a removed profile is gone from the main config", () => {
        profile("home", { identity: { name: "Ada", email: "ada@home.org" } });
        writeFileSync(join(sandbox.repository, "local", "profiles", "home", "secrets", "ssh", "id"), "key");
        cli().run(["apply"]);
        rmSync(join(sandbox.repository, "local", "profiles", "home"), { recursive: true });
        cli().run(["apply"]);
        strictEqual(
            readFileSync(join(sandbox.repository, "local", "git.config"), "utf8").includes("profiles/home/"),
            false
        );
    });

    it("with a broken profile writes nothing, not even the valid ones", () => {
        profile("broken", {});
        strictEqual(cli().run(["apply"]), 1);
        strictEqual(existsSync(join(sandbox.repository, "local", "git.config")), false);
    });

    it("with a missing key writes nothing", () => {
        rmSync(join(sandbox.repository, "local", "profiles", "work", "secrets", "ssh", "id"));
        strictEqual(cli().run(["apply"]), 1);
        strictEqual(existsSync(join(sandbox.repository, "local", "git.config")), false);
    });

    it("an openpgp signing without the exported key is a problem, found before the first commit", () => {
        profile("work", {
            identity: { name: "Ada", email: "ada@example.com" },
            signing: { format: "openpgp", key: "C21E" },
        });
        strictEqual(cli().run(["apply"]), 1);
    });
});

describe("Cli clone", () => {
    it("clones into the profile's repositories/ folder with the profile's key", () => {
        strictEqual(cli().run(["clone", "work", "git@github.com:example/app.git"]), 0);
        const call = sandbox.calls.at(-1)!;
        strictEqual(call.args[2], join(sandbox.repository, "local", "profiles", "work", "repositories", "app"));
        strictEqual(call.env.GIT_SSH_COMMAND!.includes(join("work", "secrets", "ssh", "id")), true);
    });

    it("gives the clone the files for the AI agents it lacks", () => {
        const target = join(sandbox.repository, "local", "profiles", "work", "repositories", "app");
        const clone = (): number => {
            mkdirSync(join(target, ".git"), { recursive: true });
            return 0;
        };
        strictEqual(cli({ interactive: clone }).run(["clone", "work", "git@github.com:example/app.git"]), 0);
        strictEqual(existsSync(join(target, "AGENTS.md")), true);
        strictEqual(existsSync(join(target, ".agents", "skills")), true);
        strictEqual(
            sandbox.out.some((line) => line.startsWith("Agent files created: ")),
            true
        );
    });

    it("refuses an unknown profile and names the existing ones", () => {
        strictEqual(cli().run(["clone", "wrok", "git@github.com:example/app.git"]), 1);
        strictEqual(sandbox.err.at(-1), 'No profile "wrok". Profiles: work.');
    });

    it("never clones over an existing folder", () => {
        cloned("work", "app");
        strictEqual(cli().run(["clone", "work", "git@github.com:example/app.git"]), 1);
        strictEqual(sandbox.calls.length, 0);
    });
});

describe("Cli clone, asking", () => {
    it("asks the profile and the URL that the command line does not give", () => {
        strictEqual(cli({ answers: ["", "git@github.com:example/tool.git"] }).run(["clone"]), 0);
        strictEqual(
            sandbox.calls.at(-1)!.args[2],
            join(sandbox.repository, "local", "profiles", "work", "repositories", "tool")
        );
    });

    it("stopped with Ctrl+D clones nothing", () => {
        strictEqual(cli({ answers: [undefined] }).run(["clone"]), 1);
        strictEqual(sandbox.calls.length, 0);
    });
});

describe("Cli check", () => {
    it("greets the profile's server and asks every repository's origin", () => {
        cloned("work", "app");
        strictEqual(cli({ status: 1 }).run(["check"]), 1);
        strictEqual(sandbox.calls[0]!.command, "ssh");
        strictEqual(sandbox.calls[1]!.command, "git");
    });
});

describe("Cli open", () => {
    it("a repository with its own devcontainer gets the link for a new window, never this container", () => {
        cloned("work", "game", true);
        strictEqual(cli({ env: { GIT_PROFILES_CONTAINER: "git-profiles-dev" } }).run(["open", "work/game"]), 0);
        strictEqual(
            sandbox.out.at(-1),
            "vscode://vscode-remote/wsl+Debian/host/gp/local/profiles/work/repositories/game?windowId=_blank"
        );
        strictEqual(sandbox.calls.length, 0);
    });

    it("a plain repository gets the link that attaches a new window to this container", () => {
        cloned("work", "lib");
        strictEqual(cli({ env: { GIT_PROFILES_CONTAINER: "git-profiles-dev" } }).run(["open", "work/lib"]), 0);
        strictEqual(sandbox.out.at(-1)!.startsWith("vscode://vscode-remote/attached-container+"), true);
        strictEqual(sandbox.calls.length, 0);
    });

    it("a plain repository gets the host link when the container has no name", () => {
        cloned("work", "lib");
        cli().run(["open", "work/lib"]);
        strictEqual(sandbox.out.at(-1)!.startsWith("vscode://vscode-remote/wsl+Debian/host/gp/"), true);
    });
});

describe("Cli open, asking", () => {
    it("asks which repository when the command line does not say", () => {
        cloned("work", "app");
        cloned("work", "game", true);
        strictEqual(cli({ answers: ["2"] }).run(["open"]), 0);
        strictEqual(sandbox.out.at(-1)!.endsWith("/repositories/game?windowId=_blank"), true);
    });

    it("without repositories says to clone one first", () => {
        strictEqual(cli().run(["open"]), 1);
        strictEqual(sandbox.err.at(-1)!.startsWith("No repositories yet"), true);
    });
});

describe("Cli open from a VS Code terminal", () => {
    it("opens the window itself with code --folder-uri, attached to this container", () => {
        cloned("work", "lib");
        const env = { GIT_PROFILES_CONTAINER: "git-profiles-dev", VSCODE_IPC_HOOK_CLI: "/tmp/x" };
        strictEqual(cli({ env }).run(["open", "work/lib"]), 0);
        strictEqual(sandbox.calls[0]!.command, "code");
        strictEqual(sandbox.calls[0]!.args[2]!.startsWith("vscode-remote://attached-container+"), true);
        strictEqual(sandbox.out.at(-1), "Opening work/lib in a new VS Code window of this container.");
    });

    it("a repository with its own devcontainer opens on the host, through WSL", () => {
        cloned("work", "game", true);
        cli({ env: { GIT_PROFILES_CONTAINER: "git-profiles-dev", VSCODE_IPC_HOOK_CLI: "/tmp/x" } }).run([
            "open",
            "work/game",
        ]);
        strictEqual(
            sandbox.calls[0]!.args[2],
            "vscode-remote://wsl+Debian/host/gp/local/profiles/work/repositories/game"
        );
    });

    it("a repository with its own devcontainer off WSL gets the link: code would look for the host's path here", () => {
        cloned("work", "game", true);
        const env = { GIT_PROFILES_CONTAINER: "git-profiles-dev", VSCODE_IPC_HOOK_CLI: "/tmp/x" };
        cli({ env, distro: null }).run(["open", "work/game"]);
        strictEqual(sandbox.calls.length, 0);
        strictEqual(sandbox.out.at(-1), "vscode://file/host/gp/local/profiles/work/repositories/game?windowId=_blank");
    });

    it("when code fails, prints the link to click", () => {
        cloned("work", "lib");
        const env = { GIT_PROFILES_CONTAINER: "git-profiles-dev", VSCODE_IPC_HOOK_CLI: "/tmp/x" };
        cli({ env, status: 1 }).run(["open", "work/lib"]);
        strictEqual(sandbox.out.at(-1)!.startsWith("vscode://vscode-remote/attached-container+"), true);
    });
});

describe("Cli run", () => {
    it("an unknown command fails with the usage", () => {
        strictEqual(cli().run(["aply"]), 1);
        strictEqual(sandbox.err.includes(Cli.USAGE), true);
    });
});

describe("Cli init", () => {
    /** A fake ssh-keygen that writes a key pair where it is asked to. */
    function keygen(_command: string, args: string[]): number {
        const key = args[args.length - 1]!;
        writeFileSync(key, "private");
        writeFileSync(`${key}.pub`, "ssh-ed25519 AAAA ada@home.org\n");
        return 0;
    }

    /** The profile.json init wrote. */
    function written(name: string): {
        identity: { name: string; email: string };
        signing?: { format: string; key?: string };
    } {
        return JSON.parse(
            readFileSync(join(sandbox.repository, "local", "profiles", name, "profile.json"), "utf8")
        ) as {
            identity: { name: string; email: string };
            signing?: { format: string; key?: string };
        };
    }

    it("without a key: asks name and email, generates the ssh key, signs with it, and applies", () => {
        const answers = ["home", "3", "Ada", "ada@home.org", "", ""];
        strictEqual(cli({ answers, interactive: keygen }).run(["init"]), 0);
        strictEqual(written("home").identity.email, "ada@home.org");
        strictEqual(written("home").signing?.format, "ssh");
        strictEqual(existsSync(join(sandbox.repository, "local", "profiles", "home", "git.config")), true);
    });

    it("with an ssh key: proposes the email of its comment, which Enter accepts", () => {
        mkdirSync(join(sandbox.repository, "local", "profiles", "home", "secrets", "ssh"), { recursive: true });
        keygen("ssh-keygen", [join(sandbox.repository, "local", "profiles", "home", "secrets", "ssh", "id")]);
        strictEqual(cli({ answers: ["home", "2", "Ada", "", "2"] }).run(["init"]), 0);
        strictEqual(written("home").identity.email, "ada@home.org");
        strictEqual(written("home").signing, undefined);
    });

    it("with a GnuPG key: name and email come from its user id, and it signs", () => {
        const gpg = join(sandbox.repository, "local", "profiles", "home", "secrets", "gpg");
        mkdirSync(gpg, { recursive: true });
        writeFileSync(join(gpg, "private-key.gpg"), "secret");
        writeFileSync(join(gpg, "public-key.gpg"), "public");
        const output =
            "pub:u:255:22:K::::::::\nfpr:::::::::ABCDEF0123:\nuid:u::::::::Ada Lovelace (work) <ada@example.com>:\n";
        strictEqual(cli({ answers: ["home", "1", "", "", "", "1"], output, interactive: keygen }).run(["init"]), 0);
        strictEqual(written("home").identity.name, "Ada Lovelace");
        strictEqual(written("home").identity.email, "ada@example.com");
        strictEqual(written("home").signing?.key, "ABCDEF0123");
    });

    it("stopped with Ctrl+D writes no profile.json, so the profile is not used", () => {
        strictEqual(cli({ answers: ["home", undefined] }).run(["init"]), 1);
        strictEqual(existsSync(join(sandbox.repository, "local", "profiles", "home", "profile.json")), false);
    });

    it("never touches a profile that already has its profile.json", () => {
        strictEqual(cli({ answers: ["work", undefined] }).run(["init"]), 1);
        strictEqual(sandbox.err[0], "work already exists: edit its profile.json instead.");
    });
});
