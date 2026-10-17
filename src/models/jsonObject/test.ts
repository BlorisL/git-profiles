import { deepStrictEqual, strictEqual } from "node:assert/strict";
import { describe, it } from "node:test";
import { JsonObject } from "./entity.ts";

describe("JsonObject.text", () => {
    it("trims the value, so a stray space in the JSON does not end up in an ssh or git config", () => {
        strictEqual(JsonObject.text({ host: " github.com " }, "host", "a.json", []), "github.com");
    });

    it("reports a missing required field with the file it comes from", () => {
        const errors: string[] = [];
        JsonObject.text({}, "host", "a.json", errors);
        deepStrictEqual(errors, ['a.json: "host" is missing']);
    });

    it("accepts a missing optional field without a problem", () => {
        const errors: string[] = [];
        strictEqual(JsonObject.text({}, "user", "a.json", errors, true), undefined);
        deepStrictEqual(errors, []);
    });

    it("refuses an empty string: an empty host would generate a block that matches nothing", () => {
        const errors: string[] = [];
        JsonObject.text({ host: "  " }, "host", "a.json", errors);
        strictEqual(errors.length, 1);
    });
});

describe("JsonObject.texts", () => {
    it("refuses an empty array: a profile without owners would never be used", () => {
        const errors: string[] = [];
        deepStrictEqual(JsonObject.texts({ owners: [] }, "owners", "a.json", errors), []);
        strictEqual(errors.length, 1);
    });

    it("refuses an array with a non-string item", () => {
        const errors: string[] = [];
        JsonObject.texts({ owners: ["a", 3] }, "owners", "a.json", errors);
        strictEqual(errors.length, 1);
    });
});

describe("JsonObject.integer", () => {
    const range = { min: 1, max: 65535, fallback: 22 };

    it("gives the fallback when the field is missing", () => {
        strictEqual(JsonObject.integer({}, "port", "a.json", [], range), 22);
    });

    it("refuses a value out of range and keeps the fallback", () => {
        const errors: string[] = [];
        strictEqual(JsonObject.integer({ port: 70000 }, "port", "a.json", errors, range), 22);
        strictEqual(errors.length, 1);
    });

    it('refuses a numeric string: JSON has numbers, and "2222" is a typo worth reporting', () => {
        const errors: string[] = [];
        JsonObject.integer({ port: "2222" }, "port", "a.json", errors, range);
        strictEqual(errors.length, 1);
    });
});
