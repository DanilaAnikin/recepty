import nextVitals from "eslint-config-next/core-web-vitals";

export default [
  {
    ignores: [
      "lib/app/**",
      "lib/core/**",
      "lib/data/**",
      "lib/features/**",
      "lib/shared/**",
      "build/**",
      ".next/**",
    ],
  },
  ...nextVitals,
];
