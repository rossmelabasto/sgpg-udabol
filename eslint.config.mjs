import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const config = [
  ...nextVitals,
  ...nextTs,
  {
    ignores: [".next/**", "node_modules/**", "public/**", "scripts/fixtures/**", "next-env.d.ts"],
  },
  {
    rules: {
      // El código usa `any` en puntos de integración con pdf.js y Firebase.
      "@typescript-eslint/no-explicit-any": "off",
    },
  },
];

export default config;
