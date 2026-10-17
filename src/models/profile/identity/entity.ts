import { JsonObject, type JsonObjectType } from "#jsonObject";
import { ProfileIdentityAbstract, type ProfileIdentityType } from "./abstract.ts";

class ProfileIdentity extends ProfileIdentityAbstract {
    protected name!: ProfileIdentityType["name"];
    protected email!: ProfileIdentityType["email"];

    /**
     * @param data.name - the name commits are made by
     * @param data.email - the email commits are made by
     */
    constructor(data: ProfileIdentityType) {
        super();
        this.name = data.name;
        this.email = data.email;
    }

    public static override parse(
        object: JsonObjectType,
        where: string,
        errors: string[]
    ): ProfileIdentityType | undefined {
        const before = errors.length;
        const name = JsonObject.text(object, "name", where, errors);
        const email = JsonObject.text(object, "email", where, errors);
        let result: ProfileIdentityType | undefined;
        // Only the shape that matters to git: an address with an @. A full check would refuse valid addresses and
        // protect nothing, since the hosting service is the one that decides whether it belongs to the account.
        if (email !== undefined && !email.includes("@")) {
            errors.push(`${where}: "email" is not an email address`);
        }
        if (errors.length === before && name !== undefined && email !== undefined) {
            result = { name, email };
        }
        return result;
    }

    public static override fromUid(uid: string): Partial<ProfileIdentityType> {
        const match = /^(.*?)\s*(?:\([^)]*\))?\s*<([^>]+)>\s*$/.exec(uid.trim());
        let result: Partial<ProfileIdentityType> = {};
        if (match !== null) {
            result = { ...(match[1] !== "" ? { name: match[1]! } : {}), email: match[2]! };
        } else if (uid.includes("@")) {
            result = { email: uid.trim() };
        }
        return result;
    }

    public static override fromSshPublicKey(publicKey: string): Partial<ProfileIdentityType> {
        // "<type> <base64> <comment>": the comment is free text, and only an email is worth proposing.
        const comment = publicKey.trim().split(/\s+/).slice(2).join(" ");
        return /^[^\s@]+@[^\s@]+$/.test(comment) ? { email: comment } : {};
    }

    public getName(): ProfileIdentityType["name"] {
        return this.name;
    }

    public getEmail(): ProfileIdentityType["email"] {
        return this.email;
    }
}

export { ProfileIdentity };
