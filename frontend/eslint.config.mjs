import { dirname } from "path";
import { fileURLToPath } from "url";
import { FlatCompat } from "@eslint/eslintrc";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

const eslintConfig = [
  // Extend Next.js defaults
  ...compat.extends("next/core-web-vitals", "next/typescript"),

  {
    // 🔒 Ignore generated and build folders
    ignores: [
      "node_modules/**",
      ".next/**",
      "out/**",
      "build/**",
      "next-env.d.ts",
    ],

    // ✅ Custom rule overrides
    rules: {
      // Disable "no explicit any" globally — harmless and common for dynamic data
      "@typescript-eslint/no-explicit-any": "off",

      // Optional: reduce noise from prop spreading, unused vars, etc.
      "react/prop-types": "off",
      "no-unused-vars": "warn",
      "react-hooks/exhaustive-deps": "warn",
    },
  },
];

export default eslintConfig;
