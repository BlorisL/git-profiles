import { strictEqual } from "node:assert/strict";
import { describe, it } from "node:test";
import { Layout } from "./entity.ts";

/** The devcontainer of a checkout that VS Code reports as a WSL UNC path. */
function container(): Layout {
    return new Layout(
        Layout.detect({
            repository: "/workspaces/git-profiles",
            hostRepository: "\\\\wsl.localhost\\Debian\\home\\me\\git-profiles",
            inContainer: true,
            distro: undefined,
        })
    );
}

describe("Layout.normalizeHostPath", () => {
    it("turns the WSL UNC path the Dev Containers extension reports into the Linux path inside WSL", () => {
        strictEqual(
            Layout.normalizeHostPath("\\\\wsl.localhost\\Debian\\home\\me\\git-profiles"),
            "/home/me/git-profiles"
        );
        strictEqual(Layout.normalizeHostPath("\\\\wsl$\\Ubuntu\\home\\me"), "/home/me");
    });

    it("keeps a Linux path, without the trailing slash", () => {
        strictEqual(Layout.normalizeHostPath("/home/me/git-profiles/"), "/home/me/git-profiles");
    });

    it("writes a Windows path with forward slashes", () => {
        strictEqual(Layout.normalizeHostPath("C:\\Users\\me\\git-profiles"), "C:/Users/me/git-profiles");
    });
});

describe("Layout.detect", () => {
    it("reads the WSL distribution from the UNC path when the environment does not say it", () => {
        strictEqual(container().getDistro(), "Debian");
    });

    it("prefers the distribution the environment says", () => {
        const data = Layout.detect({
            repository: "/workspaces/gp",
            hostRepository: "/home/me/gp",
            inContainer: true,
            distro: "Ubuntu",
        });
        strictEqual(data.distro, "Ubuntu");
    });

    it("an empty host path counts as unknown, not as the filesystem root", () => {
        const data = Layout.detect({ repository: "/workspaces/gp", hostRepository: "", inContainer: true, distro: "" });
        strictEqual(data.hostRoot, "/workspaces/gp/local");
        strictEqual(data.distro, undefined);
    });
});

describe("Layout paths", () => {
    it("everything of a profile lives in its folder", () => {
        strictEqual(
            container().getProfilePath("work", "repositories", "app"),
            "/workspaces/git-profiles/local/profiles/work/repositories/app"
        );
    });

    it("turns a path under local/ into the host's, for VS Code on the host", () => {
        strictEqual(
            container().toHostPath("/workspaces/git-profiles/local/profiles/work/repositories/app"),
            "/home/me/git-profiles/local/profiles/work/repositories/app"
        );
    });

    it("leaves a path that only starts like local/ as it is", () => {
        strictEqual(container().toHostPath("/workspaces/git-profiles/localx"), "/workspaces/git-profiles/localx");
    });
});
