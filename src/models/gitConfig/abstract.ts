import type { Layout } from "#layout";
import type { Profile } from "#profile";

/** What the generated git config is made from: the profiles, and where their folders are. */
interface GitConfigType {
    profiles: Profile[];
    layout: Layout;
}

abstract class GitConfigAbstract {
    /**
     * The generated git config of the container. `main` has one `includeIf "gitdir:…"` per profile, which loads the
     * profile's file in every repository under its `repositories/` folder; `profiles` are those files: the ssh key
     * through `core.sshCommand`, the identity, and the signing setup.
     * @param input - profiles and layout
     */
    public static render: (input: GitConfigType) => { main: string; profiles: { profile: string; content: string }[] };

    /**
     * Where `apply` writes the allowed signers of a profile that signs with ssh, next to its key in secrets/ssh: the file git needs to verify those
     * signatures (`git log --show-signature`), which otherwise show as unverified even on the commits it just signed.
     * @param layout - where the profiles' folders are
     * @param profile - the profile's name
     */
    public static allowedSignersPath: (layout: Layout, profile: string) => string;

    /**
     * The line of an allowed signers file: the email the key signs for, then the public key.
     * @param email - the profile's email
     * @param publicKey - the content of the public key file
     */
    public static allowedSigner: (email: string, publicKey: string) => string;

    /**
     * The ssh command a profile's git uses, for its repositories and for the clone that creates them.
     * @param key - the private key file
     * @param knownHosts - the known_hosts file of the profiles
     */
    public static sshCommand: (key: string, knownHosts: string) => string;

    /**
     * A git config value or subsection name in double quotes, with `\` and `"` escaped: unquoted, a `#` or `;` in a
     * name or path would start a comment and silently cut the value.
     * @param value - the raw value
     */
    public static quote: (value: string) => string;
}

export { GitConfigAbstract, type GitConfigType };
