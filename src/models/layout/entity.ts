import { join } from "node:path/posix";
import { LayoutAbstract, type LayoutType } from "./abstract.ts";

class Layout extends LayoutAbstract {
    protected root!: LayoutType["root"];
    protected hostRoot!: LayoutType["hostRoot"];
    protected inContainer!: LayoutType["inContainer"];
    protected distro?: LayoutType["distro"];

    /**
     * @param data.root - `local/` as this process sees it
     * @param data.hostRoot - `local/` as the host sees it
     * @param data.inContainer - whether this process runs in a container
     * @param data.distro - the WSL distribution of the host folder, if any
     */
    constructor(data: LayoutType) {
        super();
        this.root = data.root;
        this.hostRoot = data.hostRoot;
        this.inContainer = data.inContainer;
        this.distro = data.distro;
    }

    public static override readonly HOST_ROOT_VARIABLE: string = "GIT_PROFILES_HOST_ROOT";
    public static override readonly DISTRO_VARIABLE: string = "WSL_DISTRO_NAME";
    public static override readonly PROFILE_FILE: string = "profile.json";

    /** The name of a generated git config: the main one in local/, and one in every profile's folder. */
    protected static readonly GIT_CONFIG: string = "git.config";

    /** The folder of the checkout that holds everything of the machine, and nothing of the repository. */
    protected static readonly LOCAL: string = "local";

    /** `\\wsl.localhost\<distro>\rest` or `\\wsl$\<distro>\rest`. */
    protected static readonly WSL_UNC: RegExp = /^\\\\wsl(?:\.localhost|\$)\\([^\\]+)(\\.*)?$/i;

    public static override normalizeHostPath(path: string): string {
        const unc = Layout.WSL_UNC.exec(path);
        const result = unc !== null ? (unc[2] ?? "\\").replaceAll("\\", "/") : path.replaceAll("\\", "/");
        return result.length > 1 ? result.replace(/\/+$/, "") : result;
    }

    public static override distroOf(path: string): string | undefined {
        return Layout.WSL_UNC.exec(path)?.[1];
    }

    public static override detect(context: {
        repository: string;
        hostRepository: string | undefined;
        inContainer: boolean;
        distro: string | undefined;
    }): LayoutType {
        const root = join(context.repository, Layout.LOCAL);
        const host =
            context.hostRepository !== undefined && context.hostRepository !== "" ? context.hostRepository : undefined;
        const distro = context.distro !== undefined && context.distro !== "" ? context.distro : undefined;
        const fromPath = host !== undefined ? Layout.distroOf(host) : undefined;
        const known = distro ?? fromPath;
        return {
            root,
            hostRoot: host !== undefined ? join(Layout.normalizeHostPath(host), Layout.LOCAL) : root,
            inContainer: context.inContainer,
            ...(known !== undefined ? { distro: known } : {}),
        };
    }

    public getRoot(): LayoutType["root"] {
        return this.root;
    }

    public getHostRoot(): LayoutType["hostRoot"] {
        return this.hostRoot;
    }

    public isInContainer(): LayoutType["inContainer"] {
        return this.inContainer;
    }

    public getDistro(): LayoutType["distro"] {
        return this.distro;
    }

    public getProfilesDir(): string {
        return join(this.root, "profiles");
    }

    public getProfilePath(profile: string, ...parts: string[]): string {
        return join(this.getProfilesDir(), profile, ...parts);
    }

    public getSshPath(profile: string, ...parts: string[]): string {
        return this.getProfilePath(profile, "secrets", "ssh", ...parts);
    }

    public getGpgPath(profile: string, ...parts: string[]): string {
        return this.getProfilePath(profile, "secrets", "gpg", ...parts);
    }

    public getProfileConfigPath(profile: string): string {
        return this.getProfilePath(profile, Layout.GIT_CONFIG);
    }

    public getMainConfigPath(): string {
        return join(this.root, Layout.GIT_CONFIG);
    }

    public getKnownHostsPath(): string {
        return join(this.root, "known_hosts");
    }

    public toHostPath(path: string): string {
        let result = path;
        if (path === this.root || path.startsWith(`${this.root}/`)) {
            result = this.hostRoot + path.slice(this.root.length);
        }
        return result;
    }
}

export { Layout };
