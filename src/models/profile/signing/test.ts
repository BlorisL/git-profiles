import { deepStrictEqual, strictEqual } from "node:assert/strict";
import { describe, it } from "node:test";
import { ProfileSigning } from "./entity.ts";

describe("ProfileSigning.parse", () => {
    it("reads an openpgp key id", () => {
        deepStrictEqual(ProfileSigning.parse({ format: "openpgp", key: "C21E21553B18B07E" }, "a", []), {
            format: "openpgp",
            key: "C21E21553B18B07E",
        });
    });

    it("an ssh signature without key uses the public half of the profile's ssh key", () => {
        deepStrictEqual(ProfileSigning.parse({ format: "ssh" }, "a", []), { format: "ssh", key: "id.pub" });
    });

    it("an openpgp signature needs its key id: GnuPG has no default to guess", () => {
        const errors: string[] = [];
        strictEqual(ProfileSigning.parse({ format: "openpgp" }, "a", errors), undefined);
        deepStrictEqual(errors, ['a: "key" is missing']);
    });

    it("refuses an unknown format instead of letting git fail at the first commit", () => {
        const errors: string[] = [];
        strictEqual(ProfileSigning.parse({ format: "x509", key: "k" }, "a", errors), undefined);
        deepStrictEqual(errors, ['a: "format" must be one of openpgp, ssh']);
    });
});

describe("ProfileSigning.isFileName", () => {
    it("accepts a file of the profile's folder, refuses one outside it", () => {
        strictEqual(ProfileSigning.isFileName("work.pub"), true);
        strictEqual(ProfileSigning.isFileName("../other/id.pub"), false);
        strictEqual(ProfileSigning.isFileName("/home/me/.ssh/id.pub"), false);
    });
});
