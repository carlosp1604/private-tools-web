import eslintJs from "@eslint/js";
import tseslint from "typescript-eslint";
import eslintReact from "@eslint-react/eslint-plugin";
import unusedImports from "eslint-plugin-unused-imports";
import stylistic from '@stylistic/eslint-plugin'

const SEVERITY_OFF = 0;
const SEVERITY_ERROR = 2;

export default [
  {
    ignores: [
      ".next/**",
      "out/**",
      ".wrangler/**",
      "build/**",
      "next-env.d.ts",
      "scripts",
      "jest.config.js",
    ],
  },

  eslintJs.configs.recommended,
  ...tseslint.configs.recommended,
  eslintReact.configs["recommended-typescript"],

  {
    files: ["**/*.{ts,tsx}"],
    plugins: {
      "unused-imports": unusedImports,
      '@stylistic': stylistic
    },
    languageOptions: {
      parser: tseslint.parser,
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      '@stylistic/indent': [SEVERITY_ERROR, 2],
      "@stylistic/padding-line-between-statements": [
        SEVERITY_ERROR,
        { blankLine: "always", prev: "import", next: "*" },
        { blankLine: "never", prev: "import", next: "import" },
        { blankLine: "always", prev: ["let", "const", "var"], next: "*" },
        { blankLine: "any", prev: ["let", "const", "var"], next: ["let", "const", "var"] },
        { blankLine: "always", prev: "*", next: "return" },
      ],
      "@stylistic/comma-dangle": [
        SEVERITY_ERROR,
        {
          arrays: "always-multiline",
          objects: "always-multiline",
        },
      ],
      "@stylistic/max-len": [
        SEVERITY_ERROR,
        {
          code: 136,
        },
      ],
      "@stylistic/quotes": [
        SEVERITY_ERROR,
        'single'
      ],
      "@stylistic/jsx-quotes": [
        SEVERITY_ERROR,
        'prefer-double'
      ],
      "@stylistic/semi": [SEVERITY_ERROR, "never"],
      "@stylistic/member-delimiter-style": [
        SEVERITY_ERROR,
        {
          multiline: {
            delimiter: "none",
          },
        },
      ],
      "@stylistic/object-curly-spacing": [SEVERITY_ERROR, "always"],

      "@stylistic/jsx-curly-spacing": [
        SEVERITY_ERROR,
        {
          when: "always",
          children: true,
        },
      ],
      "@stylistic/jsx-wrap-multilines": SEVERITY_ERROR,

      "@typescript-eslint/consistent-type-definitions": [
        SEVERITY_ERROR,
        "interface",
      ],
      "@typescript-eslint/naming-convention": [
        SEVERITY_ERROR,
        {
          selector: "typeLike",
          format: ["PascalCase"],
        },
      ],
      "prefer-arrow-callback": SEVERITY_ERROR,
      "no-console": SEVERITY_ERROR,

      "unused-imports/no-unused-imports": SEVERITY_ERROR,
      "@typescript-eslint/no-unused-vars": SEVERITY_OFF,
      "unused-imports/no-unused-vars": [
        "warn",
        {
          vars: "all",
          varsIgnorePattern: "^_",
          args: "after-used",
          argsIgnorePattern: "^_",
        },
      ],
    },
  },
];
