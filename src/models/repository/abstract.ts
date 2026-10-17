/**
 * A repository cloned with a profile, in `local/profiles/<profile>/repositories/<name>`. Where it lives decides which
 * account it uses: the generated git config gives every repository under a profile's folder that profile's key and
 * identity.
 */
interface RepositoryType {
    /** The profile it was cloned with. */
    profile: string;
    /** The folder name. */
    name: string;
    /** The folder, as this process sees it. */
    path: string;
    /** Whether it has its own devcontainer, and so is meant to be opened in its own container. */
    devcontainer: boolean;
    /** The folder its devcontainer opens (`workspaceFolder`), when it has one. */
    workspace?: string;
}

abstract class RepositoryAbstract {
    /** Where a repository declares its devcontainer: either file makes VS Code offer "Reopen in Container". */
    public static readonly DEVCONTAINER_FILES: readonly string[];

    /** What a repository folder name may contain: it ends up in task menus and in links. */
    public static readonly NAME_PATTERN: RegExp;

    /**
     * The folder name a clone gets by default: the last segment of the URL without `.git`, as `git clone` does.
     * `undefined` when that segment is not a usable folder name.
     * @param url - the repository URL
     */
    public static nameFromUrl: (url: string) => string | undefined;

    /**
     * The repositories of a profile: the folders of its `repositories/` that are git work trees.
     * @param profile - the profile's name
     * @param dir - its `repositories/` folder
     */
    public static list: (profile: string, dir: string) => RepositoryType[];

    /**
     * The folder a repository's devcontainer opens: its `workspaceFolder`, with `${localWorkspaceFolderBasename}`
     * replaced, or `/workspaces/<name>`, the one VS Code picks when the file does not say. devcontainer.json is JSONC:
     * comments and trailing commas are dropped before parsing, outside strings only, since a URL holds "//".
     * @param path - the repository folder
     * @param name - its folder name
     */
    public static workspaceOf: (path: string, name: string) => string;

    /** The profile it was cloned with. */
    public abstract getProfile(): RepositoryType["profile"];

    /** The folder name. */
    public abstract getName(): RepositoryType["name"];

    /** The folder, as this process sees it. */
    public abstract getPath(): RepositoryType["path"];

    /** Whether it has its own devcontainer. */
    public abstract hasDevcontainer(): RepositoryType["devcontainer"];

    /** The folder its devcontainer opens, when it has one. */
    public abstract getWorkspace(): RepositoryType["workspace"];

    /** `<profile>/<name>`: how the commands and the task menus name it. */
    public abstract getId(): string;
}

export { RepositoryAbstract, type RepositoryType };
