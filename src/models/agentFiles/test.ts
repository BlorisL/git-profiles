import { deepStrictEqual, strictEqual } from "node:assert/strict";
import {
    existsSync,
    lstatSync,
    mkdirSync,
    mkdtempSync,
    readFileSync,
    readlinkSync,
    symlinkSync,
    writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { beforeEach, describe, it } from "node:test";
import { AgentFiles } from "./entity.ts";

let repository: string;

beforeEach(() => {
    repository = join(mkdtempSync(join(tmpdir(), "git-profiles-agents-")), "app");
    mkdirSync(repository);
});

describe("AgentFiles.scaffold", () => {
    it("gives a bare repository the whole shape", () => {
        const result = AgentFiles.scaffold(repository);
        deepStrictEqual(result, {
            created: [".agents/skills/", ".claude/skills -> ../.agents/skills", "AGENTS.md"],
            notes: [],
        });
        strictEqual(existsSync(join(repository, ".agents", "skills", ".gitkeep")), true);
        strictEqual(lstatSync(join(repository, ".claude", "skills")).isSymbolicLink(), true);
        // Relative: an absolute link would point to this machine's path, not to the clone on the next one.
        strictEqual(readlinkSync(join(repository, ".claude", "skills")), join("..", ".agents", "skills"));
        strictEqual(readFileSync(join(repository, "AGENTS.md"), "utf8").startsWith("# app\n"), true);
    });

    it("a second run creates nothing and changes nothing", () => {
        AgentFiles.scaffold(repository);
        writeFileSync(join(repository, "AGENTS.md"), "# mine\n");
        deepStrictEqual(AgentFiles.scaffold(repository), { created: [], notes: [] });
        strictEqual(readFileSync(join(repository, "AGENTS.md"), "utf8"), "# mine\n");
    });

    it("leaves skills that are real files in .claude/skills/ where they are, and says how to move them", () => {
        mkdirSync(join(repository, ".claude", "skills", "run-godot"), { recursive: true });
        const result = AgentFiles.scaffold(repository);
        strictEqual(existsSync(join(repository, ".agents")), false);
        strictEqual(lstatSync(join(repository, ".claude", "skills")).isDirectory(), true);
        strictEqual(result.notes.length, 1);
        strictEqual(result.notes[0]!.includes("standard:agent-files §3"), true);
    });

    it("never writes AGENTS.md next to a CLAUDE.md: Claude would load both", () => {
        writeFileSync(join(repository, "CLAUDE.md"), "# app\n");
        const result = AgentFiles.scaffold(repository);
        strictEqual(existsSync(join(repository, "AGENTS.md")), false);
        strictEqual(
            result.notes.some((note) => note.startsWith("CLAUDE.md holds the instructions")),
            true
        );
    });

    it("keeps a .claude/skills link that already exists, even to another folder", () => {
        mkdirSync(join(repository, ".claude"));
        symlinkSync("../elsewhere", join(repository, ".claude", "skills"));
        AgentFiles.scaffold(repository);
        strictEqual(readlinkSync(join(repository, ".claude", "skills")), "../elsewhere");
    });

    it("leaves a folder that does not exist alone", () => {
        deepStrictEqual(AgentFiles.scaffold(join(repository, "missing")), { created: [], notes: [] });
        strictEqual(existsSync(join(repository, "missing")), false);
    });
});
