import { strictEqual } from "node:assert/strict";
import { describe, it } from "node:test";
import { Layout } from "#layout";
import { Profile } from "#profile";
import { GitConfig } from "./entity.ts";

const layout = new Layout(
    Layout.detect({ repository: "/workspaces/gp", hostRepository: undefined, inContainer: true, distro: undefined })
);

/** A profile with the extra fields of the test. */
function profile(extra: Record<string, unknown> = {}): Profile {
    return new Profile(Profile.parse("work", { identity: { name: "Ada", email: "ada@example.com" }, ...extra }, [])!);
}

describe("GitConfig.render", () => {
    it("loads the profile's file in every repository under its folder", () => {
        const { main } = GitConfig.render({ profiles: [profile()], layout });
        strictEqual(
            main.includes(
                [
                    '[includeIf "gitdir:/workspaces/gp/local/profiles/work/repositories/"]',
                    '\tpath = "/workspaces/gp/local/profiles/work/git.config"',
                ].join("\n")
            ),
            true
        );
    });

    it("gives the profile's repositories its identity and its key", () => {
        const content = GitConfig.render({ profiles: [profile()], layout }).profiles[0]!.content;
        strictEqual(content.includes('\temail = "ada@example.com"'), true);
        strictEqual(
            content.includes("ssh -i '/workspaces/gp/local/profiles/work/secrets/ssh/id' -o IdentitiesOnly=yes"),
            true
        );
    });

    it("without signing does not turn on gpgsign", () => {
        strictEqual(
            GitConfig.render({ profiles: [profile()], layout }).profiles[0]!.content.includes("gpgsign"),
            false
        );
    });

    it("an ssh signing key is the public key file in the profile's secrets/ssh/ folder", () => {
        const content = GitConfig.render({ profiles: [profile({ signing: { format: "ssh" } })], layout }).profiles[0]!
            .content;
        strictEqual(content.includes('signingkey = "/workspaces/gp/local/profiles/work/secrets/ssh/id.pub"'), true);
        strictEqual(content.includes("format = ssh"), true);
        strictEqual(
            content.includes('allowedSignersFile = "/workspaces/gp/local/profiles/work/secrets/ssh/allowed_signers"'),
            true
        );
        strictEqual(content.includes("gpgsign = true"), true);
    });

    it("an openpgp signing key stays the id GnuPG knows it by", () => {
        const content = GitConfig.render({
            profiles: [profile({ signing: { format: "openpgp", key: "C21E21553B18B07E" } })],
            layout,
        }).profiles[0]!.content;
        strictEqual(content.includes('signingkey = "C21E21553B18B07E"'), true);
    });
});

describe("GitConfig.allowedSigner", () => {
    it("pairs the email with the public key, without the trailing newline of the key file", () => {
        strictEqual(
            GitConfig.allowedSigner("ada@example.com", "ssh-ed25519 AAAA ada\n"),
            "ada@example.com ssh-ed25519 AAAA ada\n"
        );
    });
});

describe("GitConfig.sshCommand", () => {
    it("keeps the profiles' known hosts under local/, out of the container's ~/.ssh", () => {
        strictEqual(
            GitConfig.sshCommand("/k/id", "/gp/local/known_hosts").includes(
                "UserKnownHostsFile='/gp/local/known_hosts'"
            ),
            true
        );
    });

    it("quotes a path with a single quote for the shell git runs it with", () => {
        strictEqual(GitConfig.sshCommand("/k/it's/id", "/kh").startsWith("ssh -i '/k/it'\\''s/id'"), true);
    });
});

describe("GitConfig.quote", () => {
    it('escapes quotes and backslashes, so a name like Ada "the" Dev survives', () => {
        strictEqual(GitConfig.quote('Ada "the" Dev \\'), '"Ada \\"the\\" Dev \\\\"');
    });
});
