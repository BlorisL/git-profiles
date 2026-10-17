import { JsonObject, type JsonObjectType } from "#jsonObject";
import { ProfileSigningAbstract, type ProfileSigningType } from "./abstract.ts";

class ProfileSigning extends ProfileSigningAbstract {
    protected format!: ProfileSigningType["format"];
    protected key!: ProfileSigningType["key"];

    /**
     * @param data.format - `openpgp` or `ssh`
     * @param data.key - the key id or the public key file
     */
    constructor(data: ProfileSigningType) {
        super();
        this.format = data.format;
        this.key = data.key;
    }

    public static override readonly FORMATS: readonly ProfileSigningType["format"][] = ["openpgp", "ssh"];
    public static override readonly DEFAULT_SSH_KEY: string = "id.pub";

    /** Path segments of letters, digits, `.`, `_` and `-`: no leading `/`, and `..` is refused separately. */
    protected static readonly FILE_PATTERN: RegExp = /^[A-Za-z0-9._-]+(\/[A-Za-z0-9._-]+)*$/;

    public static override parse(
        object: JsonObjectType,
        where: string,
        errors: string[]
    ): ProfileSigningType | undefined {
        const before = errors.length;
        const format = JsonObject.text(object, "format", where, errors);
        const known = ProfileSigning.FORMATS.find((candidate) => candidate === format);
        // An ssh signature has an obvious key, the public half of the profile's ssh key; a GnuPG one has not.
        const key = JsonObject.text(object, "key", where, errors, known === "ssh");
        let result: ProfileSigningType | undefined;
        if (format !== undefined && known === undefined) {
            errors.push(`${where}: "format" must be one of ${ProfileSigning.FORMATS.join(", ")}`);
        }
        if (known === "ssh" && key !== undefined && !ProfileSigning.isFileName(key)) {
            errors.push(`${where}: "key" is a public key file inside the profile's secrets/ssh/ folder, like "id.pub"`);
        }
        if (errors.length === before && known !== undefined) {
            result = { format: known, key: key ?? ProfileSigning.DEFAULT_SSH_KEY };
        }
        return result;
    }

    public static override isFileName(value: string): boolean {
        return ProfileSigning.FILE_PATTERN.test(value) && !value.split("/").includes("..");
    }

    public getFormat(): ProfileSigningType["format"] {
        return this.format;
    }

    public getKey(): ProfileSigningType["key"] {
        return this.key;
    }

    public isFile(): boolean {
        return this.format === "ssh";
    }
}

export { ProfileSigning };
