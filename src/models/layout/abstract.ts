/**
 * Where the `local/` folder is, seen from this process (the container) and from the host. The tool works only in the
 * container, but `open` hands VS Code on the host a link to a repository, and that link must name the host path of the
 * same folder (`/home/me/projects/git-profiles/local/...`), not `/workspaces/git-profiles/local/...`.
 */
interface LayoutType {
    /** `local/` as this process sees it: where files are read and written. */
    root: string;
    /** `local/` as the host sees it. Equal to `root` when the host path is unknown. */
    hostRoot: string;
    /** Whether this process runs in a container: the tool refuses to run anywhere else. */
    inContainer: boolean;
    /** The WSL distribution the host folder lives in, when the host is WSL: VS Code links need it. */
    distro?: string;
}

abstract class LayoutAbstract {
    /** The environment variable with the checkout's host path, set by devcontainer.json and scripts/run.sh. */
    public static readonly HOST_ROOT_VARIABLE: string;

    /** The environment variable with the WSL distribution, set by WSL itself and passed on to the container. */
    public static readonly DISTRO_VARIABLE: string;

    /** The file of a profile's folder with its settings. */
    public static readonly PROFILE_FILE: string;

    /**
     * Turns the host path that Docker or VS Code reports into the path the host's own tools use. On WSL the Dev
     * Containers extension reports `\\wsl.localhost\<distro>\home\me\...` (or `\\wsl$\...`), which tools inside WSL
     * know as `/home/me/...`; on Windows a `C:\...` path becomes `C:/...`.
     * @param path - the reported host path
     */
    public static normalizeHostPath: (path: string) => string;

    /**
     * The WSL distribution named in a UNC host path (`\\wsl.localhost\Debian\...` → `Debian`), if any.
     * @param path - the reported host path
     */
    public static distroOf: (path: string) => string | undefined;

    /**
     * The layout of a checkout, from what the process knows about itself.
     * @param context.repository - the checkout's root as this process sees it
     * @param context.hostRepository - the checkout's root as the host reports it, when known
     * @param context.inContainer - whether the process runs in a container
     * @param context.distro - the WSL distribution, when the environment says it
     */
    public static detect: (context: {
        repository: string;
        hostRepository: string | undefined;
        inContainer: boolean;
        distro: string | undefined;
    }) => LayoutType;

    /** `local/` as this process sees it. */
    public abstract getRoot(): LayoutType["root"];

    /** `local/` as the host sees it. */
    public abstract getHostRoot(): LayoutType["hostRoot"];

    /** Whether this process runs in a container. */
    public abstract isInContainer(): LayoutType["inContainer"];

    /** The WSL distribution of the host folder, if the host is WSL. */
    public abstract getDistro(): LayoutType["distro"];

    /** The folder with one subfolder per profile. */
    public abstract getProfilesDir(): string;

    /**
     * A path inside a profile's folder.
     * @param profile - the profile's name
     * @param parts - the path inside it (`profile.json`, `ssh/id`, `repositories/app`)
     */
    public abstract getProfilePath(profile: string, ...parts: string[]): string;

    /**
     * A path in a profile's ssh keys folder, `<profile>/secrets/ssh/`.
     * @param profile - the profile's name
     * @param parts - the file inside it, if any
     */
    public abstract getSshPath(profile: string, ...parts: string[]): string;

    /**
     * A path in a profile's GnuPG folder, `<profile>/secrets/gpg/`, with the exported key when it signs with openpgp.
     * @param profile - the profile's name
     * @param parts - the file inside it, if any
     */
    public abstract getGpgPath(profile: string, ...parts: string[]): string;

    /**
     * A profile's own git config, `<profile>/git.config`, written by `apply`: removing the profile's folder removes it
     * too.
     * @param profile - the profile's name
     */
    public abstract getProfileConfigPath(profile: string): string;

    /**
     * The git config with the `includeIf` of every profile, `local/git.config`: the one file every git of the
     * container loads (GIT_CONFIG_* in .devcontainer/docker-compose.yml).
     */
    public abstract getMainConfigPath(): string;

    /** The known_hosts file of the profiles' ssh connections. */
    public abstract getKnownHostsPath(): string;

    /**
     * The host path of a path under `local/`, for links that the host's VS Code opens. A path outside `local/` stays
     * as it is.
     * @param path - a path as this process sees it
     */
    public abstract toHostPath(path: string): string;
}

export { LayoutAbstract, type LayoutType };
