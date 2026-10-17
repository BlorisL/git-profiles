/**
 * The files a repository speaks to the AI agents with, the same for Claude Code and Codex: AGENTS.md (both read it,
 * Codex does not read CLAUDE.md), the project's skills in .agents/skills/ (where Codex looks), and .claude/skills as
 * a link to it (Claude only looks there). `clone` creates what a repository lacks of this, so a new project needs no
 * step by hand; the shape and how to keep AGENTS.md small are in the skill standard:agent-files.
 */
interface AgentFilesType {
    /** What was created, relative to the repository. */
    created: string[];
    /** What was found in the old shape and left as it is, with what to do about it. */
    notes: string[];
}

abstract class AgentFilesAbstract {
    /** The instructions both agents read. */
    public static readonly INSTRUCTIONS: string;

    /** The instructions only Claude reads: never written, and never next to AGENTS.md (Claude would load both). */
    public static readonly CLAUDE_INSTRUCTIONS: string;

    /** The project's skills, one folder with its SKILL.md each. */
    public static readonly SKILLS: string;

    /** Where Claude looks for the project's skills: a link to SKILLS. */
    public static readonly CLAUDE_SKILLS: string;

    /**
     * Creates in a repository what it lacks of the shape, and never moves or overwrites anything: skills already in
     * .claude/skills/, or a CLAUDE.md, are reported in `notes` (the migration is the skill's §3). A folder that does
     * not exist is left alone.
     * @param path - the repository's folder
     */
    public static scaffold: (path: string) => AgentFilesType;

    /**
     * The AGENTS.md of a repository that has no instructions yet: the sections the skill asks for, to fill in.
     * @param name - the repository's folder name, for the title
     */
    public static template: (name: string) => string;
}

export { AgentFilesAbstract, type AgentFilesType };
