/**
 * Configures the Codex hook for agent-standard, the plugin with rules shared across projects.
 * scripts/setup-agents.sh calls this script with the hooks.json path and the local agent-standard checkout.
 * The hook runs hooks/model-routing.sh before each user message (UserPromptSubmit) to remind the agent
 * of the criteria for choosing a model and delegating work.
 *
 * Updates the JSON structure instead of replacing the file with a fixed template: replacing it also
 * removed Caveman's SessionStart hook, preventing automatic activation. Other settings stay intact,
 * and an existing hook is neither rewritten nor duplicated, preserving the definition the user approved
 * in Codex. A parsing error stops the script without writing to the file.
 */
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

const [file, checkout] = process.argv.slice(2);
if (!file || !checkout) {
    throw new Error("Usage: node scripts/setup-codex-hooks.ts <hooks.json> <checkout>");
}
type HookType = { type?: string; command?: string; timeout?: number };
type HookGroupType = { hooks?: HookType[] };
type HooksDocumentType = { hooks?: { UserPromptSubmit?: HookGroupType[] } };

const document: HooksDocumentType = existsSync(file) ? JSON.parse(readFileSync(file, "utf8")) : {};
if (
    document === null ||
    typeof document !== "object" ||
    Array.isArray(document) ||
    (document.hooks !== undefined &&
        (document.hooks === null || typeof document.hooks !== "object" || Array.isArray(document.hooks)))
) {
    throw new Error(`Unexpected hooks document in ${file}; left untouched.`);
}
document.hooks ??= {};
document.hooks.UserPromptSubmit ??= [];
if (!Array.isArray(document.hooks.UserPromptSubmit)) {
    throw new Error(`Unexpected UserPromptSubmit in ${file}; left untouched.`);
}
const command = `bash '${join(checkout, "hooks/model-routing.sh").replaceAll("'", "'\\''")}' codex`;
const existing = document.hooks.UserPromptSubmit.some((entry) =>
    entry.hooks?.some((hook) => hook.type === "command" && hook.command === command)
);
// Recognize the unquoted command from earlier installations too: rewriting it would change the hook
// definition and could require the user to approve it again in Codex.
const legacy = `bash ${join(checkout, "hooks/model-routing.sh")} codex`;
const hasLegacy = document.hooks.UserPromptSubmit.some((entry) =>
    entry.hooks?.some((hook) => hook.type === "command" && hook.command === legacy)
);
if (!existing && !hasLegacy) {
    document.hooks.UserPromptSubmit.push({ hooks: [{ type: "command", command, timeout: 5 }] });
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(`${file}.tmp`, `${JSON.stringify(document, null, 4)}\n`);
    renameSync(`${file}.tmp`, file);
}
