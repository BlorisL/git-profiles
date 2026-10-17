/**
 * The link that opens a repository in a NEW VS Code window on the host. The container cannot start VS Code on the
 * host, but VS Code makes a `vscode://` link in its terminal clickable and opens it with the host's VS Code, the same
 * way docker-manager hands its links to the browser.
 */
interface EditorType {
    /** The folder, as the host sees it. */
    hostPath: string;
    /** The WSL distribution the folder lives in, when the host is WSL. */
    distro?: string;
}

abstract class EditorAbstract {
    /**
     * Makes the protocol handler open a new window instead of reusing the one in front: without it the link replaced
     * the project already open there.
     */
    public static readonly NEW_WINDOW: string;

    /**
     * The `vscode://` link that opens a host folder in a new window. On WSL it goes through the remote authority
     * `wsl+<distro>`: the VS Code that receives the link is the Windows one, which cannot open a bare Linux path ("does
     * not exist on this computer").
     * @param target - the folder and its WSL distribution
     */
    public static uri: (target: EditorType) => string;

    /**
     * The `vscode://` link that opens a folder of a RUNNING container in a new window, attached to it: VS Code reads
     * no devcontainer.json for such a window, so it never offers a rebuild. Opening the same folder as one more
     * window of the devcontainer did: VS Code evaluated git-profiles' devcontainer.json for it, offered to rebuild, and
     * rebuilding restarted the git-profiles window too, since it is the same container. The form is the one the
     * protocol handler accepts (as docker-manager uses it): the remote authority is `attached-container+<hex>`, with
     * the hex of `{"containerName":"/<name>"}`.
     * @param target - the container's name and the folder inside it
     */
    public static attachUri: (target: { container: string; path: string }) => string;

    /**
     * The same two targets as remote folder URIs, for `code --folder-uri` in a VS Code terminal, which opens them
     * without a click: `vscode-remote://attached-container+<hex><path>` for a folder of this container, and
     * `vscode-remote://wsl+<distro><path>` (or `file://` off WSL) for a folder of the host. A `vscode://` link is a
     * different thing, for the protocol handler: its authority is the first path segment after `vscode://`.
     * @param target - a folder of a container (`container` and `path`) or of the host (`hostPath`, `distro`)
     */
    public static folderUri: (target: { container: string; path: string } | EditorType) => string;

    /**
     * The remote folder URI that opens a host folder straight in its own devcontainer, for `code --folder-uri`:
     * `vscode-remote://dev-container+<hex of the host path><workspace>`. From a terminal of this container a
     * `file://` URI names a folder of the container, where the host's path does not exist ("Workspace does not
     * exist"); the dev-container authority is resolved by the Dev Containers extension on the host, which builds or
     * starts that container and opens its workspace, with no "Reopen in Container" to click.
     * @param target - the folder as the host sees it, and the folder its devcontainer opens
     */
    public static devcontainerUri: (target: { hostPath: string; workspace: string }) => string;
}

export { EditorAbstract, type EditorType };
