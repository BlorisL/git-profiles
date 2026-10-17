import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { Layout } from "#layout";
import { Profile, type ProfileType } from "#profile";
import { CatalogAbstract, type CatalogType } from "./abstract.ts";

class Catalog extends CatalogAbstract {
    protected profiles!: Profile[];

    /**
     * @param data.profiles - profiles already checked by {@link Catalog.fromFiles}
     */
    constructor(data: CatalogType) {
        super();
        this.profiles = data.profiles.map((profile) => new Profile(profile));
    }

    public static override fromFiles(
        files: { name: string; content: string | undefined }[],
        errors: string[]
    ): CatalogType {
        const profiles: ProfileType[] = [];
        for (const file of [...files].sort((a, b) => a.name.localeCompare(b.name))) {
            let raw: unknown;
            if (file.content === undefined) {
                errors.push(`${file.name}: the folder has no ${Layout.PROFILE_FILE}`);
            } else {
                try {
                    raw = JSON.parse(file.content);
                } catch (error) {
                    errors.push(`${file.name}/${Layout.PROFILE_FILE}: not valid JSON (${(error as Error).message})`);
                }
            }
            const profile = raw !== undefined ? Profile.parse(file.name, raw, errors) : undefined;
            if (profile !== undefined) {
                profiles.push(profile);
            }
        }
        return { profiles };
    }

    public static override read(dir: string, errors: string[]): CatalogType {
        const folders = existsSync(dir)
            ? readdirSync(dir, { withFileTypes: true }).filter((entry) => entry.isDirectory())
            : [];
        return Catalog.fromFiles(
            folders.map((folder) => {
                const file = join(dir, folder.name, Layout.PROFILE_FILE);
                return { name: folder.name, content: existsSync(file) ? readFileSync(file, "utf8") : undefined };
            }),
            errors
        );
    }

    public getProfiles(): Profile[] {
        return this.profiles;
    }

    public find(name: string): Profile | undefined {
        return this.profiles.find((profile) => profile.getName() === name);
    }
}

export { Catalog };
