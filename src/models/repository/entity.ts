import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { RepositoryAbstract, type RepositoryType } from "./abstract.ts";

class Repository extends RepositoryAbstract {
    protected profile!: RepositoryType["profile"];
    protected name!: RepositoryType["name"];
    protected path!: RepositoryType["path"];
    protected devcontainer!: RepositoryType["devcontainer"];
    protected workspace?: RepositoryType["workspace"];

    /**
     * @param data.profile - the profile it was cloned with
     * @param data.name - the folder name
     * @param data.path - the folder
     * @param data.devcontainer - whether it has its own devcontainer
     * @param data.workspace - the folder its devcontainer opens
     */
    constructor(data: RepositoryType) {
        super();
        this.profile = data.profile;
        this.name = data.name;
        this.path = data.path;
        this.devcontainer = data.devcontainer;
        this.workspace = data.workspace;
    }

    public static override readonly DEVCONTAINER_FILES: readonly string[] = [
        ".devcontainer/devcontainer.json",
        ".devcontainer.json",
    ];

    public static override readonly NAME_PATTERN: RegExp = /^[A-Za-z0-9._-]+$/;

    /** A string (kept), a comment or a trailing comma (dropped): one pass, so "//" inside a string stays. */
    protected static readonly JSONC_PATTERN: RegExp = /("(?:\\.|[^"\\])*")|\/\/[^\n]*|\/\*[\s\S]*?\*\/|,(?=\s*[}\]])/g;

    public static override nameFromUrl(url: string): string | undefined {
        // Both separators: `git@host:owner/app.git` has the name after "/", `git@host:app.git` after ":".
        const last = url.replace(/\/+$/, "").split(/[/:]/).pop() ?? "";
        const name = last.replace(/\.git$/, "");
        return Repository.NAME_PATTERN.test(name) && name !== "." && name !== ".." ? name : undefined;
    }

    public static override list(profile: string, dir: string): RepositoryType[] {
        const folders = existsSync(dir)
            ? readdirSync(dir, { withFileTypes: true }).filter((entry) => entry.isDirectory())
            : [];
        return folders
            .map((folder) => join(dir, folder.name))
            .filter((path) => existsSync(join(path, ".git")))
            .map((path) => {
                const name = path.slice(dir.length + 1);
                const devcontainer = Repository.DEVCONTAINER_FILES.some((file) => existsSync(join(path, file)));
                return {
                    profile,
                    name,
                    path,
                    devcontainer,
                    ...(devcontainer ? { workspace: Repository.workspaceOf(path, name) } : {}),
                };
            })
            .sort((a, b) => a.name.localeCompare(b.name));
    }

    public static override workspaceOf(path: string, name: string): string {
        const file = Repository.DEVCONTAINER_FILES.map((candidate) => join(path, candidate)).find(existsSync);
        let folder: unknown;
        try {
            const text = readFileSync(file!, "utf8").replace(
                Repository.JSONC_PATTERN,
                (_, kept?: string) => kept ?? ""
            );
            folder = (JSON.parse(text) as { workspaceFolder?: unknown }).workspaceFolder;
        } catch {
            // Unreadable or not JSON: VS Code would refuse it too, and the default at least opens the window.
            folder = undefined;
        }
        return typeof folder === "string" && folder !== ""
            ? folder.replaceAll("${localWorkspaceFolderBasename}", name)
            : `/workspaces/${name}`;
    }

    public getProfile(): RepositoryType["profile"] {
        return this.profile;
    }

    public getName(): RepositoryType["name"] {
        return this.name;
    }

    public getPath(): RepositoryType["path"] {
        return this.path;
    }

    public hasDevcontainer(): RepositoryType["devcontainer"] {
        return this.devcontainer;
    }

    public getWorkspace(): RepositoryType["workspace"] {
        return this.workspace;
    }

    public getId(): string {
        return `${this.profile}/${this.name}`;
    }
}

export { Repository };
