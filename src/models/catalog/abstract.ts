import type { Profile, ProfileType } from "#profile";

/** Every profile of the machine, already checked: the folders of `local/profiles/`. */
interface CatalogType {
    profiles: ProfileType[];
}

abstract class CatalogAbstract {
    /**
     * Builds the catalog from the profiles' folder names and the content of their profile.json (`undefined` when the
     * folder has none). Every problem of every profile goes to `errors`; the profiles with a problem are left out.
     * @param files - one entry per profile folder
     * @param errors - the list that collects the problems
     */
    public static fromFiles: (files: { name: string; content: string | undefined }[], errors: string[]) => CatalogType;

    /**
     * Reads every folder of the profiles folder and builds the catalog (see {@link CatalogAbstract.fromFiles}). A
     * missing folder is an empty catalog.
     * @param dir - the profiles folder
     * @param errors - the list that collects the problems
     */
    public static read: (dir: string, errors: string[]) => CatalogType;

    /** The profiles, in name order. */
    public abstract getProfiles(): Profile[];

    /**
     * The profile with a name, if there is one.
     * @param name - the profile's folder name
     */
    public abstract find(name: string): Profile | undefined;
}

export { CatalogAbstract, type CatalogType };
