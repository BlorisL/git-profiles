import { existsSync, lstatSync, mkdirSync, readdirSync, symlinkSync, writeFileSync } from "node:fs";
import { basename, join } from "node:path";
import { AgentFilesAbstract, type AgentFilesType } from "./abstract.ts";

class AgentFiles extends AgentFilesAbstract {
    public static override readonly INSTRUCTIONS: string = "AGENTS.md";

    public static override readonly CLAUDE_INSTRUCTIONS: string = "CLAUDE.md";

    public static override readonly SKILLS: string = ".agents/skills";

    public static override readonly CLAUDE_SKILLS: string = ".claude/skills";

    public static override scaffold(path: string): AgentFilesType {
        const result: AgentFilesType = { created: [], notes: [] };
        if (existsSync(path)) {
            AgentFiles.scaffoldSkills(path, result);
            AgentFiles.scaffoldInstructions(path, result);
        }
        return result;
    }

    public static override template(name: string): string {
        return [
            `# ${name}`,
            "",
            "<Cos'è il progetto, in un paragrafo.>",
            "",
            "Ogni sessione e ogni subagent rileggono questo file a ogni chiamata: resta sotto i 10 KB, e ciò che serve a",
            "un lavoro solo va in una skill (skill `standard:agent-files`).",
            "",
            "## Mappa",
            "",
            "- `<cartella>/`: <cosa contiene>",
            "",
            "## Invarianti",
            "",
            "- <un fatto sempre vero del codice che, violato, dà un bug che nessun controllo vede subito>",
            "",
            "## Comandi",
            "",
            "- `<comando>`: <cosa controlla>",
            "",
            "## Skill",
            "",
            "- `standard:model-routing`: smistare ogni richiesta fra i modelli, prima di cominciare",
            "- `standard:agent-files`: questi file, e come si tiene leggero AGENTS.md",
            "",
        ].join("\n");
    }

    /**
     * .agents/skills/ with a .gitkeep (git keeps no empty folder), and .claude/skills linking to it. Skills that are
     * real files in .claude/skills/ stay there: moving them is a commit of the project's, not a side effect of a clone.
     */
    protected static scaffoldSkills(path: string, result: AgentFilesType): void {
        const claudeSkills = join(path, AgentFiles.CLAUDE_SKILLS);
        const claudeKind = AgentFiles.kind(claudeSkills);
        if (claudeKind === "folder") {
            result.notes.push(
                `${AgentFiles.CLAUDE_SKILLS}/ holds the skills: move them to ${AgentFiles.SKILLS}/ and link it (skill standard:agent-files §3).`
            );
        } else {
            const skills = join(path, AgentFiles.SKILLS);
            if (!existsSync(skills)) {
                mkdirSync(skills, { recursive: true });
                result.created.push(`${AgentFiles.SKILLS}/`);
            }
            if (readdirSync(skills).length === 0) {
                writeFileSync(join(skills, ".gitkeep"), "");
            }
            if (claudeKind === "missing") {
                mkdirSync(join(path, ".claude"), { recursive: true });
                // Relative, so the link holds wherever the repository is: on the host, in this container, in its own.
                symlinkSync(join("..", AgentFiles.SKILLS), claudeSkills, "dir");
                result.created.push(`${AgentFiles.CLAUDE_SKILLS} -> ../${AgentFiles.SKILLS}`);
            }
        }
    }

    /** AGENTS.md from the template, only for a repository with no instructions at all. */
    protected static scaffoldInstructions(path: string, result: AgentFilesType): void {
        const instructions = join(path, AgentFiles.INSTRUCTIONS);
        const claudeInstructions = join(path, AgentFiles.CLAUDE_INSTRUCTIONS);
        if (existsSync(instructions)) {
            // Already in the shape: nothing to say.
        } else if (existsSync(claudeInstructions)) {
            result.notes.push(
                `${AgentFiles.CLAUDE_INSTRUCTIONS} holds the instructions, which Codex does not read: rename it to ${AgentFiles.INSTRUCTIONS} (skill standard:agent-files §3).`
            );
        } else {
            writeFileSync(instructions, AgentFiles.template(basename(path)));
            result.created.push(AgentFiles.INSTRUCTIONS);
        }
    }

    /** What is at a path, without following a link: a link to a missing folder still counts as there. */
    protected static kind(path: string): "missing" | "link" | "folder" | "file" {
        const stat = lstatSync(path, { throwIfNoEntry: false });
        return stat === undefined ? "missing" : stat.isSymbolicLink() ? "link" : stat.isDirectory() ? "folder" : "file";
    }
}

export { AgentFiles };
