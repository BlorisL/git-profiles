import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { RepositoryAbstract, type RepositoryType } from "./abstract.ts";

class Repository extends RepositoryAbstract {
    protected profile!: RepositoryType["profile"];
    protected name!: RepositoryType["name"];
    protected path!: RepositoryType["path"];
    protected devcontainer!: RepositoryType["devcontainer"];

    /**
     * @param data.profile - the profile it was cloned with
     * @param data.name - the folder name
     * @param data.path - the folder
     * @param data.devcontainer - whether it has its own devcontainer
     */
    constructor(data: RepositoryType) {
        super();
        this.profile = data.profile;
        this.name = data.name;
        this.path = data.path;
        this.devcontainer = data.devcontainer;
    }

    public static override readonly DEVCONTAINER_FILES: readonly string[] = [
        ".devcontainer/devcontainer.json",
        ".devcontainer.json",
    ];

    public static override readonly NAME_PATTERN: RegExp = /^[A-Za-z0-9._-]+$/;

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
            .map((path) => ({
                profile,
                name: path.slice(dir.length + 1),
                path,
                devcontainer: Repository.DEVCONTAINER_FILES.some((file) => existsSync(join(path, file))),
            }))
            .sort((a, b) => a.name.localeCompare(b.name));
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

    public getId(): string {
        return `${this.profile}/${this.name}`;
    }
}

export { Repository };
