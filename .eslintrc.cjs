const eslintConfig = {
  root: true,
  env: {
    browser: true,
    es2020: true,
    node: true,
    jest: true,
  },
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
    'plugin:react/recommended',
    'plugin:react-hooks/recommended',
    'plugin:import/recommended',
    'plugin:import/typescript',
    'plugin:functional/external-typescript-recommended',
    'plugin:security/recommended-legacy',
  ],
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaVersion: 'latest',
    sourceType: 'module',
    ecmaFeatures: {
      jsx: true,
    },
    project: './tsconfig.json',
  },
  plugins: [
    '@typescript-eslint', 
    'react', 
    'react-hooks',
    'import',
    'functional',
    'security'
  ],
  ignorePatterns: ['dist', '.eslintrc.cjs', 'node_modules', 'features/**/*'],
  rules: {
    // TypeScript rules
    'no-unused-vars': 'off',
    '@typescript-eslint/no-unused-vars': ['error', { 
      argsIgnorePattern: '^_',
      varsIgnorePattern: '^_',
    }],
    '@typescript-eslint/no-explicit-any': 'error',
    '@typescript-eslint/explicit-function-return-type': 'off',
    '@typescript-eslint/explicit-module-boundary-types': 'off',
    '@typescript-eslint/no-empty-interface': ['error', {
      allowSingleExtends: true,
    }],
    
    // React rules
    'react/react-in-jsx-scope': 'off',
    'react/prop-types': 'off',
    'react-hooks/rules-of-hooks': 'error',
    'react-hooks/exhaustive-deps': 'warn',
    
    // General rules
    'no-console': ['error', { allow: ['warn', 'error'] }],
    'prefer-const': 'error',
    'no-var': 'error',
    'prefer-arrow-callback': 'error',
    'func-style': ['error', 'expression', { allowArrowFunctions: true }],
    'arrow-body-style': ['error', 'as-needed'],
    'arrow-parens': ['error', 'always'],
    'arrow-spacing': ['error', { before: true, after: true }],
    'no-restricted-syntax': [
      'error',
      {
        selector: 'FunctionDeclaration',
        message: 'Function declarations are not allowed. Use arrow functions instead.',
      },
      {
        selector: 'ClassDeclaration',
        message: 'Classes are not allowed (except in test code under features/). Use factory functions instead.',
      },
    ],
    
    // Import rules
    'no-duplicate-imports': 'error',
    'sort-imports': ['error', {
      ignoreCase: true,
      ignoreDeclarationSort: true,
    }],
    'import/order': ['warn', {
      groups: [
        'builtin',
        'external',
        'internal',
        ['parent', 'sibling'],
        'index',
      ],
      'newlines-between': 'always',
      alphabetize: {
        order: 'asc',
        caseInsensitive: true,
      },
    }],
    'import/no-named-as-default': 'off',
    'import/no-named-as-default-member': 'off',
    'import/no-unresolved': 'off', // Temporarily disabled due to resolver issues
    'import/no-cycle': 'warn',
    
    // Functional programming rules (relaxed for practical use)
    'functional/no-let': 'warn',
    'functional/immutable-data': 'off',
    'functional/no-expression-statements': 'off',
    'functional/prefer-immutable-types': 'off',
    
    // Security rules
    'security/detect-object-injection': 'warn',
    'security/detect-non-literal-regexp': 'warn',
    
    // Material-UI rules (disabled until plugin is properly configured)
    // 'mui/no-deprecated': 'error',
  },
  settings: {
    react: {
      version: 'detect',
    },
    'import/resolver': {
      typescript: {
        alwaysTryTypes: true,
        project: './tsconfig.json',
      },
    },
  },
  overrides: [
    {
      // Allow classes in test code under features/
      files: ['features/**/*.ts', 'features/**/*.js'],
      extends: ['plugin:playwright/recommended'],
      plugins: ['playwright'],
      rules: {
        'no-restricted-syntax': ['error', {
          selector: 'FunctionDeclaration',
          message: 'Function declarations are not allowed. Use arrow functions instead.',
        }],
        // Disable functional programming rules in test files
        'functional/no-classes': 'off',
        'functional/no-this-expressions': 'off',
      },
    },
    {
      // Jest and Testing Library rules for unit tests
      files: ['**/*.spec.tsx', '**/*.test.tsx', '**/*.spec.ts', '**/*.test.ts'],
      extends: [
        'plugin:testing-library/react',
        'plugin:jest/recommended'
      ],
      plugins: ['testing-library', 'jest'],
      env: {
        jest: true,
      },
      rules: {
        // Allow some flexibility in test files
        'functional/no-let': 'off',
        'functional/immutable-data': 'off',
        'functional/no-expression-statements': 'off',
        'functional/prefer-immutable-types': 'off',
        'import/order': 'off',
        'security/detect-object-injection': 'off',
        'testing-library/prefer-screen-queries': 'warn',
        'testing-library/no-node-access': 'warn',
        'jest/expect-expect': 'off',
      },
    },
  ],
}

module.exports = eslintConfig