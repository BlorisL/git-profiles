/**
 * Checks profiles and repositories against the real servers, never asking for anything: a check runs from a task or
 * a script, with no terminal to type a passphrase in.
 */
interface ProbeType {
    /** Runs a command to completion: the exit status (`null` when killed) and stdout and stderr together. */
    run: (command: string, args: string[], env: Record<string, string>) => { status: number | null; output: string };
    /** The profiles' known_hosts file. */
    knownHosts: string;
}

abstract class ProbeAbstract {
    /** The exit status with which ssh reports that it could not connect or authenticate. */
    public static readonly SSH_FAILURE: number;

    /**
     * Whether a key opens a server: `ssh -T`. GitHub and GitLab close the session with a greeting (and status 1 on
     * GitHub), so only ssh's own failure status counts as a failure.
     * @param server - the private key, and user, host and port of the server
     */
    public abstract greet(server: { key: string; user: string; host: string; port: number }): {
        ok: boolean;
        output: string;
    };

    /**
     * Whether a repository's `origin` answers with a key: `git ls-remote origin HEAD`.
     * @param path - the repository folder
     * @param key - the private key of its profile
     */
    public abstract reach(path: string, key: string): { ok: boolean; output: string };
}

export { ProbeAbstract, type ProbeType };
