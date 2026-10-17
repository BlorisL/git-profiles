import { strictEqual } from "node:assert/strict";
import { describe, it } from "node:test";
import { Editor } from "./entity.ts";

describe("Editor.uri", () => {
    it("on WSL goes through the wsl+<distro> authority, in a new window", () => {
        strictEqual(
            Editor.uri({ hostPath: "/home/me/gp/local/profiles/work/repositories/app", distro: "Debian" }),
            "vscode://vscode-remote/wsl+Debian/home/me/gp/local/profiles/work/repositories/app?windowId=_blank"
        );
    });

    it("elsewhere opens the folder as a local file", () => {
        strictEqual(Editor.uri({ hostPath: "/Users/me/app" }), "vscode://file/Users/me/app?windowId=_blank");
    });

    it("a Windows path gets the leading slash the file authority wants, and spaces are encoded", () => {
        strictEqual(
            Editor.uri({ hostPath: "C:/Users/me/my app" }),
            "vscode://file/C:/Users/me/my%20app?windowId=_blank"
        );
    });
});

describe("Editor.attachUri", () => {
    it("attaches to the running container by name, in a new window", () => {
        const hex = Buffer.from('{"containerName":"/git-profiles-dev"}', "utf8").toString("hex");
        strictEqual(
            Editor.attachUri({
                container: "git-profiles-dev",
                path: "/workspaces/gp/local/profiles/work/repositories/lib",
            }),
            `vscode://vscode-remote/attached-container+${hex}/workspaces/gp/local/profiles/work/repositories/lib?windowId=_blank`
        );
    });
});

describe("Editor.folderUri", () => {
    it("a folder of this container is an attached-container URI, for code --folder-uri", () => {
        strictEqual(
            Editor.folderUri({ container: "gp-dev", path: "/w/lib" }),
            `vscode-remote://attached-container+${Buffer.from('{"containerName":"/gp-dev"}').toString("hex")}/w/lib`
        );
    });

    it("a folder of the host on WSL goes through wsl+<distro>", () => {
        strictEqual(
            Editor.folderUri({ hostPath: "/home/me/game", distro: "Debian" }),
            "vscode-remote://wsl+Debian/home/me/game"
        );
    });
});
