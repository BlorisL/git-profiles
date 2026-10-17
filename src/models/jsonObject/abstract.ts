/** A parsed JSON object whose fields are still unchecked, as read from a profile file. */
interface JsonObjectType {
    [key: string]: unknown;
}

abstract class JsonObjectAbstract {
    /**
     * Whether a parsed JSON value is an object with fields (not null, not an array).
     * @param value - the parsed value
     */
    public static isObject: (value: unknown) => value is JsonObjectType;

    /**
     * Reads a non-empty string field. A missing or invalid field adds a message to `errors` and gives `undefined`.
     * @param object - the object to read from
     * @param key - the field name
     * @param where - where the object comes from, prefixed to every message (`"work.json: identity"`)
     * @param errors - the list that collects the problems
     * @param optional - when true a missing field is not a problem
     */
    public static text: (
        object: JsonObjectType,
        key: string,
        where: string,
        errors: string[],
        optional?: boolean
    ) => string | undefined;

    /**
     * Reads a non-empty array of non-empty strings.
     * @param object - the object to read from
     * @param key - the field name
     * @param where - where the object comes from, prefixed to every message
     * @param errors - the list that collects the problems
     */
    public static texts: (object: JsonObjectType, key: string, where: string, errors: string[]) => string[];

    /**
     * Reads an optional integer field within a range, or gives `fallback` when it is missing.
     * @param object - the object to read from
     * @param key - the field name
     * @param where - where the object comes from, prefixed to every message
     * @param errors - the list that collects the problems
     * @param range - the smallest and largest accepted values, the fallback when missing
     */
    public static integer: (
        object: JsonObjectType,
        key: string,
        where: string,
        errors: string[],
        range: { min: number; max: number; fallback: number }
    ) => number;
}

export { JsonObjectAbstract, type JsonObjectType };
