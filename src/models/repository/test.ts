import { deepStrictEqual, strictEqual } from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, describe, it } from "node:test";
import { Repository } from "./entity.ts";

describe("Repository.nameFromUrl", () => {
    it("takes the last segment without .git, as git clone does", () => {
        strictEqual(Repository.nameFromUrl("git@github.com:example/app.git"), "app");
        strictEqual(Repository.nameFromUrl("https://gitlab.example.com/team/sub/tool/"), "tool");
        strictEqual(Repository.nameFromUrl("ssh://git@host:2222/team/app.git"), "app");
    });

    it("gives nothing for a URL without a usable name, so clone asks for one", () => {
        strictEqual(Repository.nameFromUrl("git@github.com:"), undefined);
    });
});

describe("Repository.list", () => {
    const dir = mkdtempSync(join(tmpdir(), "git-profiles-repositories-"));
    after(() => rmSync(dir, { recursive: true, force: true }));

    it("lists only git work trees, and tells which have their own devcontainer", () => {
        mkdirSync(join(dir, "app", ".git"), { recursive: true });
        mkdirSync(join(dir, "game", ".git"), { recursive: true });
        mkdirSync(join(dir, "game", ".devcontainer"));
        writeFileSync(join(dir, "game", ".devcontainer", "devcontainer.json"), "{}");
        mkdirSync(join(dir, "half-clone"));
        deepStrictEqual(
            Repository.list("work", dir).map((repository) => [repository.name, repository.devcontainer]),
            [
                ["app", false],
                ["game", true],
            ]
        );
    });
});

describe("Repository.workspaceOf", () => {
    const dir = mkdtempSync(join(tmpdir(), "git-profiles-workspace-"));
    after(() => rmSync(dir, { recursive: true, force: true }));

    it("reads workspaceFolder through comments and trailing commas, keeping // inside strings", () => {
        mkdirSync(join(dir, "mc", ".devcontainer"), { recursive: true });
        writeFileSync(
            join(dir, "mc", ".devcontainer", "devcontainer.json"),
            '{\n  // the service\n  "image": "http://x/y", /* inline */\n  "workspaceFolder": "/workspace",\n}\n'
        );
        strictEqual(Repository.workspaceOf(join(dir, "mc"), "mc"), "/workspace");
    });

    it("replaces the basename variable, and without workspaceFolder takes /workspaces/<name> as VS Code does", () => {
        mkdirSync(join(dir, "a"));
        writeFileSync(
            join(dir, "a", ".devcontainer.json"),
            '{"workspaceFolder": "/w/${localWorkspaceFolderBasename}"}'
        );
        mkdirSync(join(dir, "b"));
        writeFileSync(join(dir, "b", ".devcontainer.json"), "{}");
        strictEqual(Repository.workspaceOf(join(dir, "a"), "a"), "/w/a");
        strictEqual(Repository.workspaceOf(join(dir, "b"), "b"), "/workspaces/b");
    });
});
