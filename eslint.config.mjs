import js from "@eslint/js";
import tseslint from "typescript-eslint";
import stylistic from "@stylistic/eslint-plugin";

// A function has a single exit point, at the end of its body: never a `return` inside a nested if/for/try.
// A breakpoint on the final `return` always sees the real result whatever path was taken, and a reader never has
// to remember an unwritten "from here on it holds that...". The pattern is always the same: declare the result
// variable, assign it in every branch of an if/else, return it once at the end.
const flowStylePlugin = {
    rules: {
        "no-early-return": {
            meta: {
                type: "suggestion",
                docs: {
                    description:
                        "Avoid return statements inside nested blocks: a function has a single exit point, at the end of its body.",
                },
                schema: [],
                messages: {
                    noEarlyReturn:
                        "Avoid `return` inside nested blocks. Assign to a result variable and return once, at the end of the function.",
                },
            },
            create(context) {
                const FUNCTION_TYPES = new Set([
                    "FunctionDeclaration",
                    "FunctionExpression",
                    "ArrowFunctionExpression",
                ]);
                return {
                    ReturnStatement(node) {
                        const parent = node.parent;
                        if (parent.type === "BlockStatement" && !FUNCTION_TYPES.has(parent.parent.type)) {
                            context.report({ node, messageId: "noEarlyReturn" });
                        }
                    },
                };
            },
        },
    },
};

const stylisticConfig = stylistic.configs.customize({
    indent: 4,
    quotes: "double",
    quoteProps: "as-needed",
    semi: true,
    commaDangle: {
        arrays: "always-multiline",
        objects: "always-multiline",
        imports: "always-multiline",
        exports: "always-multiline",
        functions: "never",
        // prettier (`trailingComma: "es5"`) runs last in lint-staged and puts the trailing comma in multiline enums
        // and type parameter lists too: without these two keys the rules would chase each other on every commit.
        enums: "always-multiline",
        generics: "always-multiline",
    },
    braceStyle: "1tbs",
    jsx: false,
});

export default tseslint.config(
    {
        ignores: ["node_modules/**", "local/**", "eslint.config.mjs", "commitlint.config.cjs"],
    },
    js.configs.recommended,
    ...tseslint.configs.recommended,
    stylisticConfig,
    {
        plugins: {
            flowstyle: flowStylePlugin,
        },
        rules: {
            "no-var": "error",
            "prefer-const": "error",
            curly: ["error", "all"],

            // Formatting belongs to prettier, which runs after eslint in lint-staged and has the last word: a rule
            // that the formatter undoes is a permanent error nobody can close. These four are off for that reason.
            "@stylistic/brace-style": "off",
            "@stylistic/operator-linebreak": "off",
            "@stylistic/indent-binary-ops": "off",
            "@stylistic/indent": "off",

            // Double quotes, except when the string contains them: escaping would be undone by prettier.
            "@stylistic/quotes": ["error", "double", { avoidEscape: true }],
            "@stylistic/arrow-parens": ["error", "always"],

            "flowstyle/no-early-return": "error",

            // The public surface of a class reads at the bottom, after the pieces it is built from.
            "@typescript-eslint/member-ordering": [
                "error",
                {
                    default: [
                        "instance-field",
                        "constructor",
                        "static-field",
                        "static-method",
                        "private-method",
                        "protected-method",
                        "public-method",
                    ],
                },
            ],

            "@typescript-eslint/no-explicit-any": "error",
            "@typescript-eslint/explicit-function-return-type": "error",
            "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_" }],
            "@typescript-eslint/no-unused-expressions": "error",

            "no-undef": "off",
            "no-empty": "error",
            "no-case-declarations": "error",
            "no-useless-assignment": "error",
        },
    },
    {
        // Constants and helpers are members of the class that applies them: a module-level const sits outside the
        // contract (it is not in the abstract class and a subclass cannot redefine it), and a reader of a method has
        // to scroll back to the top of the file to know the value of the threshold it uses.
        files: ["src/models/**/entity.ts", "src/models/**/abstract.ts"],
        rules: {
            "no-restricted-syntax": [
                "error",
                {
                    selector: "Program > VariableDeclaration",
                    message: "No module-level constants here: make it a static member of the class.",
                },
                {
                    selector: "Program > FunctionDeclaration",
                    message: "No loose functions here: make it a static method of the class.",
                },
                {
                    selector: "Program > ExportNamedDeclaration > VariableDeclaration",
                    message: "No module-level constants here: make it a static member of the class.",
                },
                {
                    selector: "Program > ExportNamedDeclaration > FunctionDeclaration",
                    message: "No loose functions here: make it a static method of the class.",
                },
            ],
        },
    }
);
