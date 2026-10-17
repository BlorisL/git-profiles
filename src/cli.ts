// The command line: everything the commands need from the process is gathered here and handed to Cli, which never
// reads the process itself (see src/models/cli/abstract.ts).
import { spawnSync } from "node:child_process";
import { existsSync, readSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { Cli } from "#cli";
import { Layout } from "#layout";

const repository = join(dirname(fileURLToPath(import.meta.url)), "..");
// /.dockerenv in Docker, /run/.containerenv in Podman.
const inContainer = existsSync("/.dockerenv") || existsSync("/run/.containerenv");

const cli = new Cli({
    layout: new Layout(
        Layout.detect({
            repository,
            hostRepository: process.env[Layout.HOST_ROOT_VARIABLE],
            inContainer,
            distro: process.env[Layout.DISTRO_VARIABLE],
        })
    ),
    run: (command, args, env): { status: number | null; output: string } => {
        const result = spawnSync(command, args, { encoding: "utf8", env: { ...process.env, ...env }, timeout: 30_000 });
        return { status: result.status, output: `${result.stdout ?? ""}${result.stderr ?? ""}` };
    },
    interactive: (command, args, env): number | null =>
        spawnSync(command, args, { stdio: "inherit", env: { ...process.env, ...env } }).status,
    // Synchronous on purpose: the commands are synchronous, and init is a short dialogue in a terminal. A terminal in
    // non-blocking mode answers EAGAIN until a key is pressed, so the read waits a moment and tries again.
    ask: (question): string | undefined => {
        process.stdout.write(question);
        const bytes: number[] = [];
        const buffer = Buffer.alloc(1);
        let state: "reading" | "line" | "ended" = "reading";
        while (state === "reading") {
            let read: number;
            try {
                read = readSync(0, buffer, 0, 1, null);
            } catch (error) {
                read = (error as NodeJS.ErrnoException).code === "EAGAIN" ? -1 : 0;
            }
            if (read === -1) {
                Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 50);
            } else if (read === 0) {
                state = bytes.length > 0 ? "line" : "ended";
            } else if (buffer[0] === 0x0a) {
                state = "line";
            } else {
                bytes.push(buffer[0]!);
            }
        }
        return state === "ended" ? undefined : Buffer.from(bytes).toString("utf8").replace(/\r$/, "");
    },
    env: process.env,
    out: (text): void => {
        process.stdout.write(`${text}\n`);
    },
    err: (text): void => {
        process.stderr.write(`${text}\n`);
    },
});

process.exitCode = cli.run(process.argv.slice(2));
