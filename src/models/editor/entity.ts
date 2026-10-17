import { EditorAbstract, type EditorType } from "./abstract.ts";

class Editor extends EditorAbstract {
    public static override readonly NEW_WINDOW: string = "?windowId=_blank";

    public static override uri(target: EditorType): string {
        const path = target.hostPath.startsWith("/") ? target.hostPath : `/${target.hostPath}`;
        const encoded = encodeURI(path);
        return target.distro !== undefined
            ? `vscode://vscode-remote/wsl+${target.distro}${encoded}${Editor.NEW_WINDOW}`
            : `vscode://file${encoded}${Editor.NEW_WINDOW}`;
    }

    public static override attachUri(target: { container: string; path: string }): string {
        return `vscode://vscode-remote/attached-container+${Editor.containerHex(target.container)}${encodeURI(target.path)}${Editor.NEW_WINDOW}`;
    }

    public static override folderUri(target: { container: string; path: string } | EditorType): string {
        let result: string;
        if ("container" in target) {
            result = `vscode-remote://attached-container+${Editor.containerHex(target.container)}${encodeURI(target.path)}`;
        } else {
            const path = encodeURI(target.hostPath.startsWith("/") ? target.hostPath : `/${target.hostPath}`);
            result = target.distro !== undefined ? `vscode-remote://wsl+${target.distro}${path}` : `file://${path}`;
        }
        return result;
    }

    public static override devcontainerUri(target: { hostPath: string; workspace: string }): string {
        return `vscode-remote://dev-container+${Buffer.from(target.hostPath, "utf8").toString("hex")}${encodeURI(target.workspace)}`;
    }

    /**
     * How the attached-container authority names a container: the hex of `{"containerName":"/<name>"}`.
     * @param container - the container's name
     */
    protected static containerHex(container: string): string {
        return Buffer.from(JSON.stringify({ containerName: `/${container}` }), "utf8").toString("hex");
    }
}

export { Editor };
