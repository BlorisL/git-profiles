import { JsonObjectAbstract, type JsonObjectType } from "./abstract.ts";

/**
 * The field readers shared by every part of a profile file. They collect problems instead of throwing, so one run of
 * `apply` reports every mistake of every profile at once, not the first one only.
 */
class JsonObject extends JsonObjectAbstract {
    public static override isObject(value: unknown): value is JsonObjectType {
        return typeof value === "object" && value !== null && !Array.isArray(value);
    }

    public static override text(
        object: JsonObjectType,
        key: string,
        where: string,
        errors: string[],
        optional: boolean = false
    ): string | undefined {
        const value = object[key];
        let result: string | undefined;
        if (typeof value === "string" && value.trim() !== "") {
            result = value.trim();
        } else if (value === undefined && optional) {
            result = undefined;
        } else if (value === undefined) {
            errors.push(`${where}: "${key}" is missing`);
        } else {
            errors.push(`${where}: "${key}" must be a non-empty string`);
        }
        return result;
    }

    public static override texts(object: JsonObjectType, key: string, where: string, errors: string[]): string[] {
        const value = object[key];
        let result: string[] = [];
        if (value === undefined) {
            errors.push(`${where}: "${key}" is missing`);
        } else if (
            !Array.isArray(value) ||
            value.length === 0 ||
            !value.every((item) => typeof item === "string" && item.trim() !== "")
        ) {
            errors.push(`${where}: "${key}" must be a non-empty array of non-empty strings`);
        } else {
            result = value.map((item: string) => item.trim());
        }
        return result;
    }

    public static override integer(
        object: JsonObjectType,
        key: string,
        where: string,
        errors: string[],
        range: { min: number; max: number; fallback: number }
    ): number {
        const value = object[key];
        let result = range.fallback;
        if (typeof value === "number" && Number.isInteger(value) && value >= range.min && value <= range.max) {
            result = value;
        } else if (value !== undefined) {
            errors.push(`${where}: "${key}" must be an integer between ${range.min} and ${range.max}`);
        }
        return result;
    }
}

export { JsonObject };
