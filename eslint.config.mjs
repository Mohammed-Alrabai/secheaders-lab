import { defineConfig, globalIgnores } from 'eslint/config'
import nextVitals from 'eslint-config-next/core-web-vitals'
import nextTs from 'eslint-config-next/typescript'
import security from 'eslint-plugin-security'
import tseslint from 'typescript-eslint'

// Physical-direction Tailwind utilities break RTL; use logical ones (`06` §4).
const PHYSICAL_DIRECTION_CLASS = String.raw`(^|[\s:"'\x60])-?(ml|mr|pl|pr|left|right|border-l|border-r|rounded-l|rounded-r|rounded-tl|rounded-tr|rounded-bl|rounded-br|text-left|text-right|scroll-ml|scroll-mr|scroll-pl|scroll-pr)(-|\b)`

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  security.configs.recommended,
  {
    files: ['**/*.ts', '**/*.tsx', '**/*.mts'],
    extends: [tseslint.configs.strictTypeChecked, tseslint.configs.stylisticTypeChecked],
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      '@typescript-eslint/consistent-type-imports': 'error',
      '@typescript-eslint/no-non-null-assertion': 'error',
      'no-console': 'error',
    },
  },
  {
    files: ['src/components/**/*.tsx', 'src/app/**/*.tsx'],
    rules: {
      'no-restricted-syntax': [
        'error',
        {
          selector: `Literal[value=/${PHYSICAL_DIRECTION_CLASS}/]`,
          message:
            'Use logical Tailwind utilities (ms-/me-/ps-/pe-/start-/end-/text-start/text-end).',
        },
        {
          selector: `TemplateElement[value.raw=/${PHYSICAL_DIRECTION_CLASS}/]`,
          message:
            'Use logical Tailwind utilities (ms-/me-/ps-/pe-/start-/end-/text-start/text-end).',
        },
      ],
    },
  },
  globalIgnores([
    '.next/**',
    'out/**',
    'build/**',
    'coverage/**',
    'playwright-report/**',
    'test-results/**',
    '.corepack-bin/**',
    'next-env.d.ts',
  ]),
])

export default eslintConfig
