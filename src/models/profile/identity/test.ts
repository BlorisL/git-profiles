import { deepStrictEqual, strictEqual } from "node:assert/strict";
import { describe, it } from "node:test";
import { ProfileIdentity } from "./entity.ts";

describe("ProfileIdentity.parse", () => {
    it("reads name and email", () => {
        const errors: string[] = [];
        deepStrictEqual(ProfileIdentity.parse({ name: "Ada", email: "ada@example.com" }, "a.json", errors), {
            name: "Ada",
            email: "ada@example.com",
        });
        deepStrictEqual(errors, []);
    });

    it("refuses an email without @: GitHub would never match it to the account, and signatures stay unverified", () => {
        const errors: string[] = [];
        strictEqual(ProfileIdentity.parse({ name: "Ada", email: "ada" }, "a.json", errors), undefined);
        strictEqual(errors.length, 1);
    });

    it("gives nothing when a field is missing, so a half identity never reaches the generated config", () => {
        strictEqual(ProfileIdentity.parse({ name: "Ada" }, "a.json", []), undefined);
    });
});

describe("ProfileIdentity.fromUid", () => {
    it("takes name and email from a GnuPG user id, without its comment", () => {
        deepStrictEqual(ProfileIdentity.fromUid("Loris Salvi (GPG Key for GitHub) <loris@example.com>"), {
            name: "Loris Salvi",
            email: "loris@example.com",
        });
    });

    it("an id with the email only gives the email", () => {
        deepStrictEqual(ProfileIdentity.fromUid("<ada@example.com>"), { email: "ada@example.com" });
    });
});

describe("ProfileIdentity.fromSshPublicKey", () => {
    it("proposes the comment when it is an email", () => {
        deepStrictEqual(ProfileIdentity.fromSshPublicKey("ssh-ed25519 AAAA ada@example.com\n"), {
            email: "ada@example.com",
        });
    });

    it("proposes nothing for a comment that is not an email, like user@host is not always", () => {
        deepStrictEqual(ProfileIdentity.fromSshPublicKey("ssh-ed25519 AAAA my laptop"), {});
    });
});
