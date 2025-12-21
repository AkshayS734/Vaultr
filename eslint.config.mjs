import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Next.js build output
    ".next/**",
    "out/**",
    "build/**",

    // Tooling / deps
    "node_modules/**",
    "coverage/**",

    // Generated files
    "next-env.d.ts",

    // Scripts & experiments
    "scripts/**",

    // Optional
    "*.config.js",
    "*.config.ts",
  ]),
]);

export default eslintConfig;
