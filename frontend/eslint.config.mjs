import { dirname } from "path";
import { fileURLToPath } from "url";
import { FlatCompat } from "@eslint/eslintrc";
import unusedImports from "eslint-plugin-unused-imports";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

const eslintConfig = [
  ...compat.extends("next/core-web-vitals", "next/typescript"),

  {
    ignores: [
  "**/.next/**",
  ".next/**",
  "node_modules/**",
  "**/node_modules/**",
  "dist/**",
  "build/**",
  "out/**",
  "next-env.d.ts",
],

    plugins: {
      "unused-imports": unusedImports,
    },

    rules: {
      "@typescript-eslint/no-explicit-any": "off",
      "react/prop-types": "off",
      "react-hooks/exhaustive-deps": "warn",

      // 🔥 auto remove unused imports
      "unused-imports/no-unused-imports": "error",

      // better unused vars handling
      "@typescript-eslint/no-unused-vars": [
        "warn",
        { argsIgnorePattern: "^_" }
      ],

      // disable annoying ones
      "react/no-unescaped-entities": "off",
      "@typescript-eslint/triple-slash-reference": "off",

      "@typescript-eslint/no-unused-expressions": "warn",
      "@typescript-eslint/triple-slash-reference": "off",
    },
  },
  {
  files: ["next-env.d.ts"],
  rules: {
    "@typescript-eslint/triple-slash-reference": "off",
  },
}
];

export default eslintConfig;