import { JsonObject } from "#jsonObject";
import { ProfileAbstract, type ProfileType } from "./abstract.ts";
import { ProfileIdentity } from "./identity/index.ts";
import { ProfileSigning } from "./signing/index.ts";

class Profile extends ProfileAbstract {
    protected name!: ProfileType["name"];
    protected host!: ProfileType["host"];
    protected port!: ProfileType["port"];
    protected user!: ProfileType["user"];
    protected key!: ProfileType["key"];
    protected identity!: ProfileIdentity;
    protected signing?: ProfileSigning;

    /**
     * @param data - a profile already checked by {@link Profile.parse}
     */
    constructor(data: ProfileType) {
        super();
        this.name = data.name;
        this.host = data.host;
        this.port = data.port;
        this.user = data.user;
        this.key = data.key;
        this.identity = new ProfileIdentity(data.identity);
        this.signing = data.signing !== undefined ? new ProfileSigning(data.signing) : undefined;
    }

    public static override readonly DEFAULT_HOST: string = "github.com";
    public static override readonly DEFAULT_PORT: number = 22;
    public static override readonly DEFAULT_USER: string = "git";
    public static override readonly DEFAULT_KEY: string = "id";
    public static override readonly NAME_PATTERN: RegExp = /^[a-z0-9][a-z0-9._-]*$/;

    /** A host name only: a port or a user written here would make `check` connect to a host that does not exist. */
    protected static readonly HOST_PATTERN: RegExp = /^[A-Za-z0-9.-]+$/;

    public static override parse(name: string, raw: unknown, errors: string[]): ProfileType | undefined {
        const where = `${name}/profile.json`;
        const before = errors.length;
        let result: ProfileType | undefined;
        if (!Profile.NAME_PATTERN.test(name)) {
            errors.push(`${name}: a profile folder name may contain only lowercase letters, digits, ".", "_" and "-"`);
        } else if (!JsonObject.isObject(raw)) {
            errors.push(`${where}: the content must be a JSON object`);
        } else {
            const host = JsonObject.text(raw, "host", where, errors, true) ?? Profile.DEFAULT_HOST;
            const port = JsonObject.integer(raw, "port", where, errors, {
                min: 1,
                max: 65535,
                fallback: Profile.DEFAULT_PORT,
            });
            const user = JsonObject.text(raw, "user", where, errors, true) ?? Profile.DEFAULT_USER;
            const key = JsonObject.text(raw, "key", where, errors, true) ?? Profile.DEFAULT_KEY;
            if (!Profile.HOST_PATTERN.test(host)) {
                errors.push(`${where}: "host" is a host name only, like github.com: port and user have their fields`);
            }
            if (!ProfileSigning.isFileName(key)) {
                errors.push(`${where}: "key" is a file name inside the profile's secrets/ssh/ folder, like "id"`);
            }
            let identity: ProfileType["identity"] | undefined;
            if (JsonObject.isObject(raw.identity)) {
                identity = ProfileIdentity.parse(raw.identity, `${where}: identity`, errors);
            } else {
                // Required: without it the repositories of the account would commit as the container's global
                // identity, which is the one of git-profiles itself, and the commits would go out under the wrong name.
                errors.push(`${where}: "identity" must be an object with name and email`);
            }
            let signing: ProfileType["signing"];
            if (JsonObject.isObject(raw.signing)) {
                signing = ProfileSigning.parse(raw.signing, `${where}: signing`, errors);
            } else if (raw.signing !== undefined) {
                errors.push(`${where}: "signing" must be an object`);
            }
            if (errors.length === before && identity !== undefined) {
                result = { name, host, port, user, key, identity, ...(signing !== undefined ? { signing } : {}) };
            }
        }
        return result;
    }

    public getName(): ProfileType["name"] {
        return this.name;
    }

    public getHost(): ProfileType["host"] {
        return this.host;
    }

    public getPort(): ProfileType["port"] {
        return this.port;
    }

    public getUser(): ProfileType["user"] {
        return this.user;
    }

    public getKey(): ProfileType["key"] {
        return this.key;
    }

    public getIdentity(): ProfileIdentity {
        return this.identity;
    }

    public getSigning(): ProfileSigning | undefined {
        return this.signing;
    }
}

export { Profile };
