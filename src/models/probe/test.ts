import { deepStrictEqual, strictEqual } from "node:assert/strict";
import { describe, it } from "node:test";
import { Probe } from "./entity.ts";

/** A recorded command. */
interface CallType {
    command: string;
    args: string[];
    env: Record<string, string>;
}

/** A probe whose commands answer with a fixed status, recording what was run. */
function probe(status: number | null, output: string = ""): { probe: Probe; calls: CallType[] } {
    const calls: CallType[] = [];
    return {
        calls,
        probe: new Probe({
            run: (command, args, env): { status: number | null; output: string } => {
                calls.push({ command, args, env });
                return { status, output };
            },
            knownHosts: "/gp/local/known_hosts",
        }),
    };
}

const server = { key: "/gp/id", user: "git", host: "github.com", port: 22 };

describe("Probe.greet", () => {
    it("GitHub's greeting with status 1 is a success: only ssh's 255 means the key did not open the server", () => {
        strictEqual(probe(1, "Hi Me! You've successfully authenticated").probe.greet(server).ok, true);
        strictEqual(probe(255, "Permission denied (publickey).").probe.greet(server).ok, false);
    });

    it("offers only the profile's key, never asking for input", () => {
        const { probe: subject, calls } = probe(1);
        subject.greet(server);
        deepStrictEqual(calls[0]!.args.slice(0, 4), ["-i", "/gp/id", "-o", "IdentitiesOnly=yes"]);
        strictEqual(calls[0]!.args.includes("BatchMode=yes"), true);
    });
});

describe("Probe.reach", () => {
    it("asks origin with the profile's key, and never prompts", () => {
        const { probe: subject, calls } = probe(0);
        strictEqual(subject.reach("/gp/repo", "/gp/id").ok, true);
        strictEqual(calls[0]!.args.join(" ").includes("core.sshCommand=ssh -i '/gp/id'"), true);
        strictEqual(calls[0]!.env.GIT_TERMINAL_PROMPT, "0");
    });
});
