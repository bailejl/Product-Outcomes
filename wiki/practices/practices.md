# practices.md

This file provides guidance on practices to develop software in this repo.

## Table of Contents

1. [🚨 MANDATORY WORKFLOW - NO EXCEPTIONS 🚨](#mandatory-workflow---no-exceptions)
3. [Commands](#commands)
4. [Development Approach](#development-approach)
5. [Architecture](#architecture)
6. [Technical Constraints](#technical-constraints)
7. [Security Standards](#security-standards)
8. [Implementation Process - ATDD Workflow](#implementation-process---atdd-workflow)
9. [Testing and Debugging](#testing-and-debugging)
10. [Success Criteria](#success-criteria)
11. [Important Instruction Reminders](#important-instruction-reminders)

## MANDATORY WORKFLOW - NO EXCEPTIONS

**CRITICAL**: 🚨 After EVERY single code change, you MUST run both test and quality scripts. This is NON-NEGOTIABLE.

### Required Commands After Every Change

All commands should be run from the **root directory**:

```bash
# 1. ALWAYS ensure code meet formatting standards.
npm run prettier:write

# 2. ALWAYS run tests first - NO EXCEPTIONS. CRITICAL - Check for warnings in logs and fix them. Ensure we have 90% or better coverage.
npm run test:coverage

# 3. ALWAYS run quality checks - NO EXCEPTIONS. CRITICAL - treat warnings like errors and fix them.
npm run lint

```

### Workflow Enforcement Rules

1. **NEVER proceed to the next task** until `npm run test` and `npm run lint` all pass from the root directory
2. **NEVER skip this workflow** - even for "small changes" or "quick fixes"
3. **ALWAYS run the full test suite** - no selective testing
4. **ALWAYS verify quality standards** - no exceptions for any file type

### Quality Gates - ALL Must Pass

- ✅ **All tests pass**: `npm run test` returns success
- ✅ **No linting errors or warnings**: `npm run lint`  has no errors or warnings
- ✅ **Build succeeds**: `npm run build` completes successfully
- ✅ **Type checking passes**: `npm run type-check` finds no errors
- ✅ **Functional patterns**: Code follows functional programming constraints
- ✅ **No Warnings**: check logs of the Quality Gate processes and ensure there are no logs. CRITICAL - treat warnings like errors.

### Failure Response Protocol

If ANY quality gate fails:

1. **STOP** all other work immediately
2. **FIX** the failing quality check first
3. **RE-RUN** both test and quality scripts
4. **ONLY THEN** proceed with next task

## Commands

All commands should be run from the **root directory** (not from subdirectories):

### Setup Commands

- `npm run setup` - **One-command setup for new developers** (installs dependencies, validates setup, runs all checks)
- `npm run setup:install` - Install Node.js dependencies and Playwright browsers
- `npm run setup:validate` - Run type checking, linting, and tests to validate setup
- `npm run setup:complete` - Display setup completion message

### Development Commands

- `npm install` - Install Node.js dependencies only
- `npm run dev` - Start the React app with Vite (accessible at <http://localhost:4200>)
- `npm run build` - Build the application for production
- `npm run preview` - Preview the production build

### Testing Commands

#### Unit Testing

- `npm run test` - Run all unit tests with Jest
- `npm run test:watch` - Run tests in watch mode

#### E2E Testing

All `npm run e2e` commands automatically start the app for testing, so no need to run `npm run dev` before running the tests.

- `npm run e2e:ci` - Run full E2E test suite without HTML server, exit after all tests run (**RECOMMENDED FOR CI**)
- `npm run e2e` - Run full E2E test suite with HTML server, does not exit on failures. **IMPORTANT**: never run `npm run e2e` as it does not exit after tests are done, when failures are present.
- `npm run e2e:demo` - Run full E2E test suite with HTML server, which includes a failing scenario for training, so it will always fail.
- `npm run e2e:debug` - Run E2E tests with Playwright Inspector for debugging UI issues
- `npm run e2e:ui` - Run tests with Playwright's UI mode for interactive debugging
- `npm run snippets` - Generate Cucumber step definition snippets

**Note**: Use PLAYWRIGHT_HTML_OPEN=never to stop it showing the HTML report, otherwise the process never ends.

**Note**: If you are going to manually run `npx playwright test` of any type, ensure `CI=true` is set. This causes the tests to exit immediately after completion, speeding up feedback loops.

### Quality Assurance Commands

- `npm run lint` - Run linting checks with ESLint
- `npm run lint:fix` - Fix auto-fixable linting issues
- `npm run lint:mega` - Run comprehensive MegaLinter security and quality scans. It takes a couple of minutes, so wait for it.
- `npm run type-check` - Run TypeScript type checking

## Development Approach

**IMPORTANT**: This project uses Acceptance Test Driven Development (ATDD) with Playwright-BDD/Playwright. Before implementing any feature:

1. **Read the feature specifications** in `apps/web-e2e/src/features/*.feature` and CRITICAL you read [docs/bdd-and-gherkin-guidance.md](docs/bdd-and-gherkin-guidance.md) to understand the feature files.
2. **Write Cucumber acceptance tests** that describe the expected behavior in BDD style
3. **Implement features to satisfy the acceptance tests**
4. **Validate each test passes** before moving to the next
5. **Reference the feature file continuously** during development to ensure requirements are met
6. **Implement unit test for changes** add unit tests as you go

The feature file contains comprehensive Gherkin scenarios that define the expected behavior. Translate these into Playwright-BDD/Playwright as executable specifications.

**CRITICAL - All development must satisfy the acceptance criteria defined in the feature files.**

## Architecture

### Technology Stack

- **React 19**: Latest React with modern patterns
- **TypeScript 5**: Full type safety
- **Material-UI v6**: UI component library with Emotion styling
- **React Router v7**: Client-side routing
- **Vite**: Build tool and development server
- **Jest**: Unit testing framework
- **Playwright**: E2E testing framework
- **Cucumber**: BDD testing with Gherkin syntax

### Core Structure

- **Modern React App**: Simplified single-page application built with Vite
- **Source Structure**: All application code in `src/` directory
- **Component Organization**: Feature-based component structure
- **Modern Build System**: Vite for fast development and optimized production builds

### Directory Structure

```text
src/
├── components/          # Feature-organized React components
│   ├── auth/           # Authentication components (login, private routes)
│   ├── forms/          # Credit application form components
│   ├── navigation/     # Header, navigation components
│   └── shared/         # Shared/reusable components
├── services/           # Business logic and data services
├── pages/             # Page-level components
├── assets/            # Static assets
├── styles/            # Global styles
├── hooks/             # Custom React hooks
├── types/             # TypeScript type definitions
└── utils/             # Utility functions
```

### Test Architecture

- **Feature Files**: Located in `features/*.feature` using Declarative Gherkin syntax
- **Step Definitions**: Located in `features/step-definitions/`
- **Page Objects**: Located in `features/page-objects/` following Playwright patterns
- **Data Management**: Centralized test data in `features/data/data.json`
- **Unit Tests**: Jest tests co-located with components (`*.spec.tsx`)

### Build System

- **Vite**: Modern build tool for fast development and optimized production builds
- **TypeScript**: Full type checking and compilation
- **SCSS**: Styling with Sass support
- **SVG Components**: SVG files imported as React components via vite-plugin-svgr
- **Path Aliases**: Clean imports using `@components`, `@services`, etc.

### Key Concepts

- **Declarative Gherkin**: Business-readable test scenarios without technical implementation details
- **Centralized Data Management**: Test data organized by personas with meaningful aliases
- **Functional Programming**: Arrow functions and functional patterns throughout

### Test Data Pattern

Test scenarios use personas with descriptive aliases like:

- "Tom Smith w/ minimum acceptable back-end ratio"
- "Lisa Mach w/ highest failing credit score"

This allows tests to be self-documenting and business-readable while referencing specific test data configurations.

## Technical Constraints

### Code Style Requirements

- **MANDATORY**: Use vanilla TypeScript
- **MANDATORY**: Implement functional programming patterns throughout
- **MANDATORY**: Use arrow functions exclusively for function definitions
- **MANDATORY**: Avoid classes - use factory functions and closures instead (code under `features` is acceptable for testing)
- **MANDATORY**: Markdown formatting rules: use Markdown for documentation, no HTML tags
- **MANDATORY**: Markdown needs to be markdownlint compliant with the default rules
- **NO SEMICOLONS** (enforced by Prettier configuration)
- Single quotes for strings
- 2-space indentation
- 80-character line limit
- Trailing commas in ES5 contexts
- No unused variables
- Prefer const over let
- No var declarations
- Consistent arrow function spacing
- No duplicate imports

## Security Standards

### GitHub Actions Security

- **MANDATORY**: All workflows must have restrictive top-level permissions
- **MANDATORY**: No `write-all` permissions unless absolutely necessary
- **MANDATORY**: Workflow dispatch triggers must not have user-controllable inputs that affect build output
- **MANDATORY**: Follow principle of least privilege for all CI/CD processes

### Code Security

- **MANDATORY**: All code changes must pass MegaLinter security scans (`npm run lint:mega`). It takes a couple of minutes, so wait for it.
- **MANDATORY**: No hardcoded secrets, tokens, or API keys in code
- **MANDATORY**: All dependencies must be audited for security vulnerabilities
- **MANDATORY**: Use `npm audit --audit-level=high` to check for critical vulnerabilities

### Current Security Compliance

- ✅ **Checkov Security**: 100% compliance with GitHub Actions security best practices
- ✅ **Workflow Permissions**: All workflows use minimum required permissions
- ✅ **Build Security**: No user-controllable parameters in build processes
- ✅ **Dependency Security**: Regular security audits via CI/CD pipeline

## Implementation Process - ATDD Workflow

Follow this Acceptance Test Driven Development workflow:

### 1. Scenario Analysis

For each feature in `features/*.feature`:

- Read and understand the Gherkin scenario
- Identify the Given/When/Then acceptance criteria
- Note any data tables or example values
- Understand the expected behavior completely
- Data used in the scenario are noted in `features/data/data.json`
  - Use name or aliases in the data file to associate with steps in the scenarios

### 2. Implementation to Satisfy Existing Tests

- **Review existing Cucumber step definitions** in `features/step-definitions/*.playwright.steps.ts`
- **Run the E2E tests** to see which scenarios are currently failing
- **Implement application features** to make the failing tests pass. Implement just enough application code to make the test pass
- **After test passes, run quality checks**: `npm run lint` in the root directory
- **Focus on the React components and business logic** that the tests are exercising
- Refactor while keeping tests green and code quality high

### 3. Validation

- Ensure each Cucumber test passes completely before moving on
- **Verify code passes ESLint and TypeScript checks**
- Verify edge cases mentioned in the feature scenarios
- Confirm the implementation matches the expected behavior exactly

### Implementation Priority

**CRITICAL**: Follow ATDD methodology strictly:

1. **Start by reading** a feature file completely from `features/*.feature`
2. **Implement scenarios in order** as listed in the feature file
3. **Do not proceed** to the next scenario until the current one passes
4. **Reference the feature file continuously** during implementation
5. **Validate behavior** matches the Gherkin scenarios exactly

All implementation must:

- **Satisfy the acceptance criteria** in the feature file scenarios
- Use functional programming patterns exclusively
- Include comprehensive error handling
- Provide clear progress feedback as specified in scenarios
- Handle all edge cases mentioned in the feature scenarios
- Pass both unit and acceptance tests

**NO EXCEPTIONS**: Code that doesn't pass quality checks cannot proceed to the next scenario.

## Testing and Debugging

### Acceptance Test Setup

#### Prerequisites for E2E Testing

- Run `npm install` first to install dependencies
- Then run E2E tests to see failing scenarios

#### Step File Structure Example

```javascript
// features/step-definitions/common.playwright.steps.ts
import HomePage from '../page-objects/home.playwright.page';
import LoginPage from '../page-objects/login.playwright.page';
import { Given } from '../fixtures/test';

Given('{string} logs in', async ({ page, dataManager }, userNameAlias: string) => {
  const userData = dataManager.getData(userNameAlias, true);
  const homePage = new HomePage(page);
  const loginPage = new LoginPage(page);

  await homePage.open();
  await loginPage.login(userData.username, userData.password);
});

Given('{string} logs in with these mods', async ({ page, dataManager }, userNameAlias: string, table: any) => {
  const modDataNames = dataManager.getDataTableColumnValues(table, 0);
  const userData = dataManager.getDataWithMods(userNameAlias, modDataNames);
  const homePage = new HomePage(page);
  const loginPage = new LoginPage(page);

  await homePage.open();
  await loginPage.login(userData.username, userData.password);
});

Given('{string} logs in with this mod {string}', async ({ page, dataManager }, userNameAlias: string, modName: string) => {
  const userData = dataManager.getDataWithMods(userNameAlias, [modName]);
  const homePage = new HomePage(page);
  const loginPage = new LoginPage(page);

  await homePage.open();
  await loginPage.login(userData.username, userData.password);
});
```

### Features Test Data

Here is an example of features test data used by the `features` test suite. This data includes information about the user's financial details and other relevant information. Data consists of personas and data chunks. The example below has one persona followed by one data chunk. The persona is named "Kelly Baddy". The data chunk contains data used typically to modify a persona or can stand alone. Personas have a name and aliases. The data chunk contains name and no aliases.

```json
[
  {
    "name": "Kelly Baddy",
    "aliases": ["Kelly Baddy w/ the ability to break things"],
    "firstName": "Kelly",
    "middleInitial": "A",
    "lastName": "Baddy",
    "dateOfBirth": "10/11/1980",
    "ssn": "555-22-5555",
    "countryOfCitizenShip": "GB",
    "countryOfCitizenShipSecondary": "US",
    "currentEmployerName": "Acme Oil",
    "workPhone": "(555)111-2222",
    "yearsEmployed": 10,
    "monthsEmployed": 1,
    "occupation": "CIO",
    "monthlyHousingPayment": 1800,
    "checkingAmount": 2000,
    "savingsAmount": 2000,
    "investmentsAmount": 20000,
    "monthlyIncome": 5000,
    "username": "kelly_baddy",
    "password": "GherkinIsFun"
  },
  {
    "name": "failing back-end ratio",
    "monthlyHousingPayment": 18001,
    "monthlyIncome": 50000
  }
]
```

### Browser Debugging for UI Issues

When working on UI issues, use the following approaches to see and interact with the browser:

#### Interactive Debugging Mode

```bash
# Debug all tests with browser visible
npm run e2e:debug

# Debug specific test scenarios
npx playwright test --grep "User sees errors" --debug

# Debug a specific feature file
npx playwright test features/credit-application.feature --debug
```

This opens the Playwright Inspector where you can:

- Step through each test action
- See the browser window
- Inspect elements and selectors
- Take screenshots at any point
- Modify timeouts on the fly

#### UI Mode for Visual Testing

```bash
# Run in UI mode for a visual test runner
npm run e2e:ui
```

This provides:

- Visual test tree
- Live browser preview
- Test execution timeline
- Error traces with screenshots
- Time-travel debugging

#### Headed Mode (Browser Always Visible)

```bash
# Run tests with browser visible (not in debug mode)
npx playwright test --headed

# Run specific browser
npx playwright test --headed --project=chromium
```

#### Taking Screenshots for Analysis

Add these to your test code when debugging:

```typescript
// Take a screenshot at any point
await page.screenshot({ path: 'screenshots/debug-issue.png' })

// Take full page screenshot
await page.screenshot({ path: 'screenshots/full-page.png', fullPage: true })

// Screenshot specific element
await page
  .locator('.error-message')
  .screenshot({ path: 'screenshots/error.png' })
```

#### Slow Down Execution

```bash
# Slow down execution to see what's happening
npx playwright test --headed --slow-mo=1000  # 1 second delay between actions
```

#### Browser Developer Tools

```typescript
// Pause test and open DevTools
await page.pause() // This will pause execution and let you inspect
```

### Claude Code Browser Usage

When Claude Code needs to debug UI issues, it can:

1. **Launch a visible browser** using `npm run e2e:debug` or `npx playwright test --headed`
2. **Take screenshots** during test execution to analyze UI problems
3. **Use the Read tool** to view screenshot files and understand visual issues
4. **Add pause points** in tests to inspect the browser state

Example workflow for Claude Code to debug UI issues:

```bash
# 1. Start the dev server (if needed)
npm run dev

# 2. Run specific test in debug mode
npx playwright test --grep "failing test name" --debug --project=chromium

# 3. Or take screenshots in the test code
await page.screenshot({ path: 'debug-screenshot.png' });

# 4. Use Read tool to view the screenshot
# Claude Code can then analyze the visual state
```

## Success Criteria

The application should satisfy ALL scenarios in `features/*.feature`:

**Each scenario must pass its acceptance criteria before the feature is considered complete.**

## Important Instruction Reminders

Do what has been asked; nothing more, nothing less.
NEVER create files unless they're absolutely necessary for achieving your goal.
ALWAYS prefer editing an existing file to creating a new one.
NEVER proactively create documentation files (\*.md) or README files. Only create documentation files if explicitly requested by the User.

## Installing New Packages

CRITICAL - When installing new package, check to see if there is an ESLint rule set for it. This will ensure proper use of the new package.

## MCP Guidance

### Playwright MCP

Make sure the app is running using `npm run dev`, as needed. This will allow you to access the site via <http://localhost:4200>.