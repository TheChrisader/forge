import js from "@eslint/js";
import tseslint from "typescript-eslint";
import prettier from "eslint-plugin-prettier";
import prettierConfig from "eslint-config-prettier";
import globals from "globals";

/** @type {import('eslint').Linter.Config[]} */
export default [
  // Ignore patterns
  {
    ignores: [
      "**/node_modules/**",
      "**/dist/**",
      "**/build/**",
      "**/coverage/**",
      "**/.turbo/**",
      "**/*.d.ts",
    ],
  },

  // Base JS rules
  js.configs.recommended,

  // TypeScript configuration (without type-aware rules)
  ...tseslint.configs.recommended,

  // Apply Prettier and custom rules to all TS files
  {
    files: ["**/*.ts", "**/*.tsx"],
    plugins: {
      prettier,
    },
    rules: {
      ...prettierConfig.rules,
      "prettier/prettier": ["error", { endOfLine: "lf" }],
      "@typescript-eslint/explicit-function-return-type": "error",
      "@typescript-eslint/no-explicit-any": "warn",
      "@typescript-eslint/no-unused-vars": [
        "error",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
        },
      ],
      "no-console": ["warn", { allow: ["warn", "error"] }],
    },
  },

  // Type-aware linting for packages/**/src
  ...tseslint.configs.recommendedTypeChecked.map((config) => ({
    ...config,
    files: ["packages/*/src/**/*.ts"],
    languageOptions: {
      ...config.languageOptions,
      parserOptions: {
        projectService: true,
      },
    },
    rules: {
      ...config.rules,
      "@typescript-eslint/no-floating-promises": "error",
      "@typescript-eslint/no-misused-promises": "error",
    },
  })),

  // Type-aware linting for apps/cli
  ...tseslint.configs.recommendedTypeChecked.map((config) => ({
    ...config,
    files: ["apps/cli/src/**/*.ts"],
    languageOptions: {
      ...config.languageOptions,
      parserOptions: {
        project: "./apps/cli/tsconfig.json",
      },
      globals: {
        ...globals.node,
      },
    },
    rules: {
      ...config.rules,
      "@typescript-eslint/no-floating-promises": "error",
      "@typescript-eslint/no-misused-promises": "error",
      "no-console": "off", // CLI tool uses console for output
      // Relax some strict rules for CLI where external libs return any
      "@typescript-eslint/no-unsafe-return": "off",
      "@typescript-eslint/no-unsafe-call": "off",
      "@typescript-eslint/no-unsafe-member-access": "off",
      "@typescript-eslint/no-unsafe-argument": "off",
      "@typescript-eslint/no-unsafe-assignment": "off",
    },
  })),

  // Type-aware linting for apps/web
  ...tseslint.configs.recommendedTypeChecked.map((config) => ({
    ...config,
    files: ["apps/web/**/*.{ts,tsx}"],
    languageOptions: {
      ...config.languageOptions,
      parserOptions: {
        project: "./apps/web/tsconfig.json",
      },
      globals: {
        ...globals.browser,
        ...globals.node,
      },
    },
    rules: {
      ...config.rules,
      "@typescript-eslint/no-floating-promises": "error",
      "@typescript-eslint/no-misused-promises": "error",
    },
  })),

  // Type-aware linting for apps/api
  ...tseslint.configs.recommendedTypeChecked.map((config) => ({
    ...config,
    files: ["apps/api/src/**/*.ts"],
    languageOptions: {
      ...config.languageOptions,
      parserOptions: {
        project: "./apps/api/tsconfig.json",
      },
      globals: {
        ...globals.node,
      },
    },
    rules: {
      ...config.rules,
      "@typescript-eslint/no-floating-promises": "error",
      "@typescript-eslint/no-misused-promises": "error",
    },
  })),

  {
    files: ["**/__tests__/**/*.ts", "**/*.test.ts", "**/*.spec.ts"],
    rules: {
      "@typescript-eslint/unbound-method": "off",
      "@typescript-eslint/no-unsafe-assignment": "off",
      "@typescript-eslint/no-unsafe-member-access": "off",
      "@typescript-eslint/no-unsafe-call": "off",
      "@typescript-eslint/no-explicit-any": "off",
    },
  },
];
