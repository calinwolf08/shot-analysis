import js from "@eslint/js";
import ts from "typescript-eslint";
import svelte from "eslint-plugin-svelte";
import globals from "globals";

export default ts.config(
  js.configs.recommended,
  ...ts.configs.recommended,
  ...svelte.configs.recommended,
  {
    languageOptions: {
      globals: { ...globals.browser, ...globals.node },
    },
    rules: {
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
      // `any` requires a justifying comment per project rules; keep the rule on.
      "@typescript-eslint/no-explicit-any": "error",
      // Guards apps deployed under a base path; this SPA always mounts at /
      // (Capacitor webview + adapter-static fallback), so plain hrefs/goto
      // are correct and resolve() would be noise.
      "svelte/no-navigation-without-resolve": "off",
    },
  },
  {
    files: ["**/*.svelte", "**/*.svelte.ts"],
    languageOptions: {
      parserOptions: {
        parser: ts.parser,
        extraFileExtensions: [".svelte"],
        svelteConfig: undefined,
      },
    },
  },
  {
    ignores: [
      "build/",
      ".svelte-kit/",
      "dist/",
      "node_modules/",
      "android/",
      "ios/",
      "coverage/",
      "playwright-report/",
      "test-results/",
      "static/",
    ],
  },
);
