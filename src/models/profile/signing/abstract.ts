import type { JsonObjectType } from "#jsonObject";

/**
 * How the commits of a profile's repositories are signed. With `openpgp` the key is a GnuPG key id or fingerprint,
 * of the key exported in the profile's `secrets/gpg/` folder; with `ssh` it is a public key file in the profile's
 * `secrets/ssh/` folder, `id.pub` unless the profile says otherwise.
 */
interface ProfileSigningType {
    format: "openpgp" | "ssh";
    key: string;
}

abstract class ProfileSigningAbstract {
    /** The accepted values of `format`, in the order the error message lists them. */
    public static readonly FORMATS: readonly ProfileSigningType["format"][];

    /** The public key file in `secrets/ssh/` that signs with the `ssh` format when the profile does not say. */
    public static readonly DEFAULT_SSH_KEY: string;

    /**
     * Reads the `signing` field of a profile file. Problems go to `errors`, and the result is `undefined` then.
     * @param object - the parsed `signing` object
     * @param where - where it comes from, prefixed to every message
     * @param errors - the list that collects the problems
     */
    public static parse: (object: JsonObjectType, where: string, errors: string[]) => ProfileSigningType | undefined;

    /**
     * Whether a value is a plain file name or a path inside a profile's folder: no absolute path, no `..`. A key
     * outside the profile's folder would be one more place where the account lives.
     * @param value - the value from the profile
     */
    public static isFileName: (value: string) => boolean;

    /** `openpgp` (GnuPG) or `ssh`: git's `gpg.format`. */
    public abstract getFormat(): ProfileSigningType["format"];

    /** The key id (`openpgp`) or the public key file in `secrets/ssh/` (`ssh`). */
    public abstract getKey(): ProfileSigningType["key"];

    /** Whether the key is a file in `secrets/ssh/`, rather than an id for GnuPG. */
    public abstract isFile(): boolean;
}

export { ProfileSigningAbstract, type ProfileSigningType };
