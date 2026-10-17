import type { JsonObjectType } from "#jsonObject";

/** Who the commits of a profile's repositories are made by: git's `user.name` and `user.email`. */
interface ProfileIdentityType {
    name: string;
    email: string;
}

abstract class ProfileIdentityAbstract {
    /**
     * Reads the `identity` field of a profile file. Problems go to `errors`, and the result is `undefined` then.
     * @param object - the parsed `identity` object
     * @param where - where it comes from, prefixed to every message
     * @param errors - the list that collects the problems
     */
    public static parse: (object: JsonObjectType, where: string, errors: string[]) => ProfileIdentityType | undefined;

    /**
     * What a GnuPG user id says of its owner: `Name (comment) <email>` gives the name without the comment, and the
     * email. A key's identity is the one to commit with, or the hosting service does not verify its signatures.
     * @param uid - the user id, as `gpg --with-colons` lists it
     */
    public static fromUid: (uid: string) => Partial<ProfileIdentityType>;

    /**
     * What an ssh public key says of its owner: its comment, when it is an email (ssh-keygen -C ada@example.com).
     * @param publicKey - the content of the .pub file
     */
    public static fromSshPublicKey: (publicKey: string) => Partial<ProfileIdentityType>;

    /** The name commits are made by. */
    public abstract getName(): ProfileIdentityType["name"];

    /** The email commits are made by: the one the hosting service links to the account and to the signing key. */
    public abstract getEmail(): ProfileIdentityType["email"];
}

export { ProfileIdentityAbstract, type ProfileIdentityType };
