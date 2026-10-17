import type { ProfileIdentityType } from "./identity/abstract.ts";
import type { ProfileIdentity } from "./identity/entity.ts";
import type { ProfileSigningType } from "./signing/abstract.ts";
import type { ProfileSigning } from "./signing/entity.ts";

/**
 * One git account, read from `local/profiles/<name>/profile.json`. Its folder holds everything of the account: the keys
 * in `secrets/` (ssh, and GnuPG when it signs with openpgp), its own `git.config` written by `apply`, and in
 * `repositories/` the repositories cloned with it. Every repository under that folder uses this account's key, name,
 * email and signature, whatever its URL.
 */
interface ProfileType {
    /** The folder name: it names the generated files too. */
    name: string;
    /** The server `check` connects to, to test the key: `github.com` unless the profile says otherwise. */
    host: string;
    /** The ssh port of that server. */
    port: number;
    /** The ssh user of that server: `git` on GitHub and GitLab. */
    user: string;
    /** The private key, a file in the profile's `secrets/ssh/` folder: `id` unless the profile says otherwise. */
    key: string;
    identity: ProfileIdentityType;
    signing?: ProfileSigningType;
}

abstract class ProfileAbstract {
    /** The server when the profile does not say. */
    public static readonly DEFAULT_HOST: string;

    /** The ssh port when the profile does not say. */
    public static readonly DEFAULT_PORT: number;

    /** The ssh user when the profile does not say. */
    public static readonly DEFAULT_USER: string;

    /** The private key file in `secrets/ssh/` when the profile does not say. */
    public static readonly DEFAULT_KEY: string;

    /** What a profile name (its folder) may contain: it becomes part of file names and of the task menus. */
    public static readonly NAME_PATTERN: RegExp;

    /**
     * Reads a profile file. Every problem goes to `errors`, and the result is `undefined` when there is any.
     * @param name - the profile's folder name
     * @param raw - the parsed JSON content of its profile.json
     * @param errors - the list that collects the problems
     */
    public static parse: (name: string, raw: unknown, errors: string[]) => ProfileType | undefined;

    /** The folder name. */
    public abstract getName(): ProfileType["name"];

    /** The server `check` connects to. */
    public abstract getHost(): ProfileType["host"];

    /** The ssh port of that server. */
    public abstract getPort(): ProfileType["port"];

    /** The ssh user of that server. */
    public abstract getUser(): ProfileType["user"];

    /** The private key file in `secrets/ssh/`. */
    public abstract getKey(): ProfileType["key"];

    /** Who the commits are made by. */
    public abstract getIdentity(): ProfileIdentity;

    /** The commit signing, when the profile has one. */
    public abstract getSigning(): ProfileSigning | undefined;
}

export { ProfileAbstract, type ProfileType };
