import { GitConfig } from "#gitConfig";
import { ProbeAbstract, type ProbeType } from "./abstract.ts";

class Probe extends ProbeAbstract {
    protected run!: ProbeType["run"];
    protected knownHosts!: ProbeType["knownHosts"];

    /**
     * @param data.run - runs a command to completion
     * @param data.knownHosts - the profiles' known_hosts file
     */
    constructor(data: ProbeType) {
        super();
        this.run = data.run;
        this.knownHosts = data.knownHosts;
    }

    public static override readonly SSH_FAILURE: number = 255;

    /**
     * BatchMode: a key with a passphrase and no agent fails at once instead of waiting for input. LogLevel: without
     * it the first line of the answer is "Permanently added ... to the list of known hosts", not the server's.
     */
    protected static readonly QUIET: readonly string[] = ["-o", "BatchMode=yes", "-o", "LogLevel=ERROR"];

    public greet(server: { key: string; user: string; host: string; port: number }): { ok: boolean; output: string } {
        const result = this.run(
            "ssh",
            [
                "-i",
                server.key,
                "-o",
                "IdentitiesOnly=yes",
                "-o",
                `UserKnownHostsFile=${this.knownHosts}`,
                "-o",
                "StrictHostKeyChecking=accept-new",
                ...Probe.QUIET,
                "-p",
                String(server.port),
                "-T",
                `${server.user}@${server.host}`,
            ],
            {}
        );
        return {
            ok: result.status !== null && result.status !== Probe.SSH_FAILURE,
            output: result.output.trim().split("\n")[0] ?? "",
        };
    }

    public reach(path: string, key: string): { ok: boolean; output: string } {
        // The profile's own ssh command plus BatchMode, given on the command line: it wins over core.sshCommand.
        const ssh = [GitConfig.sshCommand(key, this.knownHosts), ...Probe.QUIET].join(" ");
        const result = this.run("git", ["-C", path, "-c", `core.sshCommand=${ssh}`, "ls-remote", "origin", "HEAD"], {
            GIT_TERMINAL_PROMPT: "0",
        });
        return { ok: result.status === 0, output: result.output.trim().split("\n")[0] ?? "" };
    }
}

export { Probe };
