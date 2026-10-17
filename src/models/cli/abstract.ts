import type { Layout } from "#layout";
import type { ProbeType } from "#probe";

/**
 * Everything the command line works with, passed in rather than read from the process, so every command runs in a
 * test against a temporary folder and fake commands.
 */
interface CliType {
    layout: Layout;
    /** Runs a command to completion and gives its output: for checks. */
    run: ProbeType["run"];
    /**
     * Runs a command attached to this terminal, so it can show progress and ask for a passphrase: for `clone` and
     * for ssh-keygen. Gives the exit status.
     */
    interactive: (command: string, args: string[], env: Record<string, string>) => number | null;
    /** Asks a question in the terminal and gives the answer, `undefined` when the input ends: for `init`. */
    ask: (question: string) => string | undefined;
    /** The process environment: `open` reads the container's name from it. */
    env: Record<string, string | undefined>;
    /** Writes a line of normal output. */
    out: (text: string) => void;
    /** Writes a line about a problem. */
    err: (text: string) => void;
}

abstract class CliAbstract {
    /** The usage text, printed by `help` and after an unknown command. */
    public static readonly USAGE: string;

    /**
     * Runs one command and gives the process exit status: 0 when everything worked.
     * @param args - the command line after `node src/cli.ts`
     */
    public abstract run(args: string[]): number;
}

export { CliAbstract, type CliType };
