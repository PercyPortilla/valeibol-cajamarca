import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

export default defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    /**
     * React 19 / eslint-plugin-react-hooks now ships compiler-oriented rules
     * that flag existing, intentional application patterns (server page
     * try/catch fallbacks and one-time client hydration initialization).
     *
     * We keep the correctness rules enabled (rules-of-hooks, exhaustive-deps)
     * and disable only these advisory compiler rules until those components
     * are incrementally refactored.
     */
    rules: {
      "react-hooks/error-boundaries": "off",
      "react-hooks/set-state-in-effect": "off",
    },
  },
  globalIgnores([".next/**", "out/**", "build/**", "next-env.d.ts", "preview/**"]),
]);
