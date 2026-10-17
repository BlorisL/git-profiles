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
