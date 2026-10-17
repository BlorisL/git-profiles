import { deepStrictEqual, strictEqual } from "node:assert/strict";
import { describe, it } from "node:test";
import { Catalog } from "./entity.ts";

/** A profile folder whose profile.json has only the identity. */
function folder(name: string): { name: string; content: string } {
    return { name, content: JSON.stringify({ identity: { name: "Ada", email: "ada@example.com" } }) };
}

describe("Catalog.fromFiles", () => {
    it("keeps the valid profiles, in name order, and reports the broken ones", () => {
        const errors: string[] = [];
        const data = Catalog.fromFiles([folder("work"), { name: "bad", content: "{" }, folder("home")], errors);
        deepStrictEqual(
            data.profiles.map((profile) => profile.name),
            ["home", "work"]
        );
        strictEqual(errors.length, 1);
        strictEqual(errors[0]!.startsWith("bad/profile.json: not valid JSON"), true);
    });

    it("reports a folder without profile.json instead of skipping it: a typo in the file name would hide a profile", () => {
        const errors: string[] = [];
        Catalog.fromFiles([{ name: "work", content: undefined }], errors);
        deepStrictEqual(errors, ["work: the folder has no profile.json"]);
    });
});

describe("Catalog.find", () => {
    it("finds a profile by name", () => {
        const catalog = new Catalog(Catalog.fromFiles([folder("work")], []));
        strictEqual(catalog.find("work")?.getName(), "work");
        strictEqual(catalog.find("home"), undefined);
    });
});
