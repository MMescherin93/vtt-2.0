import js from '@eslint/js'
import tseslint from 'typescript-eslint'

export default tseslint.config(
  {
    ignores: [
      '**/out/**',
      '**/dist/**',
      '**/node_modules/**',
      '**/coverage/**',
      '.tmp/**',
      '.npm-cache/**',
      'desktop-host/extensions/**'
    ]
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    rules: {
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }
      ]
    }
  },
  {
    files: ['scripts/**/*.{mjs,js,ts}'],
    languageOptions: {
      globals: {
        console: 'readonly',
        process: 'readonly'
      }
    }
  }
)
