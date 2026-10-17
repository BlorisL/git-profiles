import { deepStrictEqual, strictEqual } from "node:assert/strict";
import { describe, it } from "node:test";
import { Profile } from "./entity.ts";

/** The smallest valid profile file: only the identity. */
function raw(extra: Record<string, unknown> = {}): Record<string, unknown> {
    return { identity: { name: "Ada", email: "ada@example.com" }, ...extra };
}

describe("Profile.parse", () => {
    it("fills GitHub, port 22, user git and the key ssh/id", () => {
        const data = Profile.parse("work", raw(), []);
        deepStrictEqual([data?.host, data?.port, data?.user, data?.key], ["github.com", 22, "git", "id"]);
    });

    it("requires the identity: without it the commits would go out as git-profiles' own identity", () => {
        const errors: string[] = [];
        strictEqual(Profile.parse("work", {}, errors), undefined);
        deepStrictEqual(errors, ['work/profile.json: "identity" must be an object with name and email']);
    });

    it("collects every problem of the file at once, not just the first", () => {
        const errors: string[] = [];
        Profile.parse("work", raw({ port: 0, key: "../id", identity: { name: "Ada" } }), errors);
        strictEqual(errors.length, 3);
    });

    it("refuses a key outside the profile's secrets/ssh/ folder", () => {
        const errors: string[] = [];
        Profile.parse("work", raw({ key: "/home/me/.ssh/id" }), errors);
        strictEqual(errors.length, 1);
    });

    it("refuses a host with a port: check would connect to a host that does not exist", () => {
        const errors: string[] = [];
        Profile.parse("work", raw({ host: "gitlab.example.com:2222" }), errors);
        strictEqual(errors.length, 1);
    });

    it("refuses an uppercase folder name: two names differing by case would collide in the menus", () => {
        const errors: string[] = [];
        Profile.parse("Work", raw(), errors);
        strictEqual(errors.length, 1);
    });

    it("keeps the signing when present", () => {
        const profile = new Profile(Profile.parse("work", raw({ signing: { format: "ssh" } }), [])!);
        strictEqual(profile.getSigning()?.getKey(), "id.pub");
        strictEqual(profile.getIdentity().getEmail(), "ada@example.com");
    });
});
