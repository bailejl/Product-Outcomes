# Hello World App Implementation Plan

## Executive Summary

This document outlines the implementation plan for a cross-platform Hello World application that retrieves a message from a database and displays it on both mobile and web platforms. The implementation follows Acceptance Test-Driven Development (ATDD) methodology and adheres to the practices defined in `practices.md`.

## Project Overview

### Goal

Set up a working end-to-end Hello World app aligned with the Product Outcomes technology stack, demonstrating:

- Database connectivity and message retrieval
- Cross-platform support (web and mobile)
- Enterprise-grade architecture
- Complete technology stack integration

### Key Requirements

1. Display "Hello World" message from database
2. Support both mobile and web platforms
3. Use Nx monorepo structure
4. Implement all technology stack components
5. Follow ATDD development process

## Technology Stack Implementation

### Core Technologies Required

#### Frontend

- **Web**: React with TypeScript
- **Mobile**: React Native with TypeScript
- **Styling**: TailwindCSS
- **State Management**: Context API or Redux Toolkit

#### Backend

- **Runtime**: Node.js v24
- **Framework**: Express.js with TypeScript
- **API**: RESTful endpoints
- **Database**: PostgreSQL

#### Development Tools

- **Monorepo**: Nx workspace
- **Testing**: Playwright (browser, API, mobile), Playwright-BDD, Jest
- **Build**: Vite for web, Metro for React Native
- **Quality**: ESLint, Prettier, MegaLinter

#### Infrastructure

- **Containerization**: Docker
- **CI/CD**: GitHub Actions
- **Cloud Platform**: AWS ECS

## Implementation Phases

### Phase 1: Project Setup and Infrastructure (Days 1-2)

#### 1.1 Nx Monorepo Setup (In Existing Repository)

Since we're working in the existing Product-Outcomes repository, we'll initialize Nx in the current directory:

```bash
# Initialize Nx in current repository
npx nx@latest init

# Add necessary Nx plugins
npm install --save-dev @nx/react @nx/node @nx/react-native @nx/vite @nx/eslint @nx/jest
```

#### 1.2 Project Structure (Within Existing Repository)

```
Product-Outcomes/
├── apps/
│   ├── web/                 # React web application
│   ├── mobile/              # React Native application
│   └── api/                 # Express.js backend
├── libs/
│   ├── shared/              # Shared utilities
│   ├── ui/                  # Shared UI components
│   └── data-access/         # API client libraries
├── features/                # BDD feature files (existing)
├── wiki/                    # Documentation (existing)
├── docs/                    # Implementation docs (existing)
├── tools/
├── nx.json
├── package.json
└── tsconfig.base.json
```

#### 1.3 Development Environment

- Configure VS Code devcontainer
- Set up Docker environment
- Initialize Git repository
- Configure Nx workspace with ESLint and Prettier plugins
- Set up Nx targets for format, lint, test, build, and type-check
- Configure shared tooling across all projects

### Phase 2: Database and Backend Setup (Days 3-4)

#### 2.1 Database Schema

```sql
-- migrations/001_create_messages_table.sql
CREATE TABLE messages (
    id SERIAL PRIMARY KEY,
    key CHARACTER VARYING(100) UNIQUE NOT NULL,
    content TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Insert initial Hello World message
INSERT INTO messages (key, content)
VALUES ('hello_world', 'Hello World from the Database!');
```

#### 2.2 API Development (Functional Programming)

```typescript
// apps/api/src/routes/messages.ts
import express from 'express'
import { pool } from '../db'

// Factory function instead of class
export const createMessagesRouter = () => {
  const router = express.Router()

  // Arrow function for route handler
  const getHelloWorldMessage = async (
    req: express.Request,
    res: express.Response
  ) => {
    try {
      const result = await pool.query(
        'SELECT content FROM messages WHERE key = $1',
        ['hello_world']
      )
      res.json({ message: result.rows[0]?.content || 'Hello World!' })
    } catch (error) {
      res.status(500).json({ error: 'Failed to retrieve message' })
    }
  }

  router.get('/hello-world', getHelloWorldMessage)
  return router
}
```

#### 2.3 API Testing

- Unit tests with Jest
- API tests with Playwright
- Database connection tests

### Phase 3: Web Application Development (Days 5-6)

#### 3.1 React Application Setup

```bash
# Generate React web application
nx g @nx/react:app web --style=css --bundler=vite --e2eTestRunner=playwright

# Generate shared UI library
nx g @nx/react:lib ui --style=css --buildable

# Generate data access library
nx g @nx/js:lib data-access --buildable
```

#### 3.2 Hello World Component (Functional Programming)

```typescript
// libs/ui/src/lib/hello-world/hello-world.tsx
import { useEffect, useState } from 'react'
import { fetchHelloMessage } from '@product-outcomes/data-access'

// Factory function for creating hello world functionality
const createHelloWorldState = () => {
  const [message, setMessage] = useState<string>('Loading...')
  const [error, setError] = useState<string | null>(null)

  const loadMessage = async (): Promise<void> => {
    try {
      const data = await fetchHelloMessage()
      setMessage(data.message)
    } catch (err) {
      setError('Failed to load message')
    }
  }

  return { message, error, loadMessage }
}

// Arrow function component
export const HelloWorld = () => {
  const { message, error, loadMessage } = createHelloWorldState()

  useEffect(() => {
    loadMessage()
  }, [])

  if (error)
    return (
      <div className="error" data-testid="error-message">
        {error}
      </div>
    )
  return (
    <div className="hello-world" data-testid="hello-message">
      {message}
    </div>
  )
}
```

#### 3.3 Web Testing

- Component unit tests
- E2E tests with Playwright-BDD
- Accessibility testing

### Phase 4: Mobile Application Development (Days 7-8)

#### 4.1 React Native Setup

```bash
# Generate React Native mobile application
nx g @nx/react-native:app mobile --e2eTestRunner=playwright

# Generate mobile-specific UI library
nx g @nx/react-native:lib mobile-ui --buildable
```

#### 4.2 Mobile Hello World Screen

```typescript
// apps/mobile/src/screens/HelloWorldScreen.tsx
import React, { useEffect, useState } from 'react'
import { View, Text, StyleSheet } from 'react-native'
import { fetchHelloMessage } from '@product-outcomes/data-access'

export const HelloWorldScreen = () => {
  const [message, setMessage] = useState<string>('Loading...')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const loadMessage = async () => {
      try {
        const data = await fetchHelloMessage()
        setMessage(data.message)
      } catch (err) {
        setError('Failed to load message')
      }
    }
    loadMessage()
  }, [])

  return (
    <View style={styles.container}>
      {error ? (
        <Text style={styles.error}>{error}</Text>
      ) : (
        <Text style={styles.message}>{message}</Text>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  message: {
    fontSize: 24,
    fontWeight: 'bold',
  },
  error: {
    fontSize: 18,
    color: 'red',
  },
})
```

#### 4.3 Mobile Testing

- Unit tests with Jest
- E2E tests with Playwright (React Native as web app in mobile browser)
- Cross-platform testing using Playwright mobile emulation

### Phase 5: Integration and Testing (Days 9-10)

#### 5.1 BDD Scenarios (Concise Declarative Gherkin)

```gherkin
# features/hello-world.feature
Feature: Hello World Display
  As a user
  I want to see a Hello World message from the database
  So that I know the system is working

  Scenario: User sees Hello World message on web
    When They go to the hello world page
    Then They see "Hello World from the Database!"
    And They see the header

  Scenario: User sees Hello World message on mobile
    When They go to the hello world mobile app
    Then They see "Hello World from the Database!"
    And They see the mobile navigation

  Scenario: User sees error when database is unavailable
    Given the database is unavailable
    When They go to the hello world page
    Then They see "Failed to load message"
```

#### 5.2 Test Data Structure

```json
# features/data/data.json
[
  {
    "name": "Basic User",
    "aliases": ["Basic User w/ standard access"],
    "username": "hello_user",
    "preferences": {
      "platform": "web"
    }
  },
  {
    "name": "Mobile User",
    "aliases": ["Mobile User w/ mobile preferences"],
    "username": "mobile_user",
    "preferences": {
      "platform": "mobile"
    }
  },
  {
    "name": "Hello World Messages",
    "success": "Hello World from the Database!",
    "error": "Failed to load message",
    "loading": "Loading..."
  },
  {
    "name": "database unavailable",
    "status": "offline",
    "error": true
  }
]
```

#### 5.3 Step Definitions (Playwright-BDD)

```typescript
// features/step-definitions/hello-world.playwright.steps.ts
import { expect } from '@playwright/test'
import { When, Then, Given } from '../fixtures/test'
import HelloWorldPage from '../page-objects/hello-world.playwright.page'
import HeaderPage from '../page-objects/header.playwright.page'

When('They go to the hello world page', async ({ page }) => {
  const helloWorldPage = new HelloWorldPage(page)
  await helloWorldPage.open()
})

When('They go to the hello world mobile app', async ({ page }) => {
  const helloWorldPage = new HelloWorldPage(page)
  await helloWorldPage.openMobile()
})

Then('They see {string}', async ({ page }, expectedMessage: string) => {
  const helloWorldPage = new HelloWorldPage(page)
  const message = await helloWorldPage.getMessage()
  expect(message).toBe(expectedMessage)
})

Then('They see the header', async ({ page }) => {
  const headerPage = new HeaderPage(page)
  const isHeaderVisible = await headerPage.isHeaderVisible()
  expect(isHeaderVisible).toBe(true)
})

Given('the database is unavailable', async ({ page }) => {
  // Mock database failure for testing
  await page.route('**/api/messages/hello-world', route => {
    route.fulfill({
      status: 500,
      body: JSON.stringify({ error: 'Database unavailable' }),
    })
  })
})
```

#### 5.4 Page Objects (Playwright Patterns)

```typescript
// features/page-objects/hello-world.playwright.page.ts
import { Page } from '@playwright/test'
import PlaywrightPage from './playwright-page'

export default class HelloWorldPage extends PlaywrightPage {
  constructor(page: Page) {
    super(page)
  }

  open = async (): Promise<void> => {
    await this.page.goto('/hello-world')
  }

  openMobile = async (): Promise<void> => {
    await this.page.goto('/mobile/hello-world')
  }

  getMessage = async (): Promise<string> => {
    return (
      (await this.page
        .locator('[data-testid="hello-message"]')
        .textContent()) || ''
    )
  }
}
```

#### 5.5 Integration Testing with Playwright

- **Cross-platform API tests**: Use Playwright for API testing with mocking
- **Web browser tests**: Playwright for web application testing
- **Mobile tests**: Playwright with mobile browser emulation for React Native
- **Database integration tests**: Test database connectivity and queries with mocks
- **Network resilience tests**: Test error handling and retry logic
- **Step definitions**: Domain-specific steps with low reuse (per Concise Declarative Gherkin)

### Phase 6: CI/CD and Deployment (Days 11-12)

#### 6.1 GitHub Actions Workflow

```yaml
# .github/workflows/ci.yml
name: CI/CD Pipeline

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '24'
      - run: npm ci
      - run: nx run-many --target=test --all --coverage
      - run: nx run-many --target=lint --all
      - run: npx mega-linter-runner --flavor=javascript
      - run: nx e2e web-e2e --ci

  build:
    needs: test
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - run: npm ci
      - run: nx run-many --target=build --all
      - run: docker build -t product-outcomes .
```

#### 6.2 Docker Configuration

```dockerfile
# Dockerfile
FROM node:24-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:24-alpine
WORKDIR /app
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
EXPOSE 3000
CMD ["node", "dist/apps/api/main.js"]
```

## ATDD Development Process (Concise Declarative Gherkin)

### Critical Requirements from practices.md

**MANDATORY WORKFLOW - NO EXCEPTIONS:**
After EVERY single code change, run from root directory:

```bash
# Format code across all projects
nx run-many --target=format --all
# OR for specific project: nx format:write <project-name>

# Run tests with coverage across all projects (90%+ coverage required)
nx run-many --target=test --all --coverage
# OR for specific project: nx test <project-name> --coverage

# Lint all projects (zero warnings allowed)
nx run-many --target=lint --all
# OR for specific project: nx lint <project-name>
```

### Workflow for Each Feature

1. **Read Feature Files First**

   - Read `features/*.feature` completely
   - Understand Concise Declarative Gherkin scenarios
   - Reference `bdd-and-gherkin-guidance.md` for context
   - Check existing `features/data/data.json` for test data

2. **Analyze Test Data Requirements**

   - Create personas with names and aliases
   - Create data chunks for modifying personas
   - Use Data Manager patterns from examples
   - Keep scenarios business-readable, not technical

3. **Write Step Definitions (Domain-Specific)**

   - Create steps specific to Hello World domain
   - Low reuse of steps (per Concise Declarative Gherkin)
   - Use `features/step-definitions/*.playwright.steps.ts`
   - Follow existing patterns from examples

4. **Implement Page Objects**

   - Create `features/page-objects/*.playwright.page.ts`
   - Extend base PlaywrightPage class
   - Follow Playwright patterns from examples

5. **Run Tests to See Failures**

   - `nx e2e web-e2e --ci` for CI testing
   - `nx e2e web-e2e --headed --debug` for debugging
   - `nx test api --watch` for API tests
   - Implement just enough code to make tests pass

6. **Implement Features (Functional Programming)**

   - **MANDATORY**: Use vanilla TypeScript only
   - **MANDATORY**: Use arrow functions exclusively
   - **MANDATORY**: Avoid classes - use factory functions and closures
   - **MANDATORY**: Functional programming patterns throughout
   - **MANDATORY**: No semicolons (Prettier enforced)
   - **MANDATORY**: 80-character line limit
   - Write minimal code to satisfy acceptance tests

7. **Quality Checks (After EVERY Change - NO EXCEPTIONS)**

   ```bash
   # ALWAYS format first
   nx run-many --target=format --all

   # MUST achieve 90%+ coverage
   nx run-many --target=test --all --coverage

   # MUST have zero warnings
   nx run-many --target=lint --all

   # MANDATORY MegaLinter scans (global tool)
   npx mega-linter-runner --flavor=javascript

   # TypeScript compilation
   nx run-many --target=type-check --all

   # Build must succeed
   nx run-many --target=build --all
   ```

8. **Validate and Refactor**
   - Each scenario must pass before proceeding
   - Check logs for ANY warnings (treat as errors)
   - Everything must run locally for validation
   - Reference feature file continuously during development

### Failure Response Protocol

If ANY quality gate fails:

1. **STOP** all other work immediately
2. **FIX** the failing quality check first
3. **RE-RUN** all test and quality scripts
4. **ONLY THEN** proceed with next task

## Quality Gates

All code must pass these checks before proceeding:

- ✅ All unit tests pass (90%+ coverage): `nx run-many --target=test --all --coverage`
- ✅ All E2E tests pass (Playwright): `nx e2e web-e2e --ci`
- ✅ All API tests pass (Playwright): `nx test api --coverage`
- ✅ No ESLint errors or warnings: `nx run-many --target=lint --all`
- ✅ Prettier formatting applied: `nx run-many --target=format --all`
- ✅ TypeScript compilation successful: `nx run-many --target=type-check --all`
- ✅ MegaLinter security and quality scans passed: `npx mega-linter-runner --flavor=javascript`
- ✅ Build completes successfully: `nx run-many --target=build --all`
- ✅ Everything runs locally and can be validated

## Success Criteria

### Functional Requirements

- [ ] Hello World message retrieved from PostgreSQL database
- [ ] Message displayed on web application
- [ ] Message displayed on mobile application (iOS and Android)
- [ ] Error handling for database connection failures
- [ ] All BDD scenarios pass

### Technical Requirements

- [ ] Nx monorepo structure implemented in existing repository
- [ ] All technology stack components integrated
- [ ] 90%+ test coverage achieved (`nx run-many --target=test --all --coverage`)
- [ ] Zero linting warnings or errors (`nx run-many --target=lint --all`)
- [ ] MegaLinter security and quality scans passed (`npx mega-linter-runner --flavor=javascript`)
- [ ] TypeScript compilation successful (`nx run-many --target=type-check --all`)
- [ ] Prettier formatting applied (`nx run-many --target=format --all`)
- [ ] Build completes successfully (`nx run-many --target=build --all`)
- [ ] Playwright testing for all platforms (`nx e2e web-e2e`, `nx test api`)
- [ ] Concise Declarative Gherkin BDD scenarios implemented
- [ ] Domain-specific step definitions with low reuse
- [ ] Test data using personas and data chunks pattern
- [ ] Functional programming patterns throughout (no classes, arrow functions only)
- [ ] Everything runs locally and validated by engineer
- [ ] Docker containerization working
- [ ] CI/CD pipeline operational with security checks
- [ ] All commands run from root directory
- [ ] Documentation markdownlint compliant

### Performance Requirements

- [ ] Web app loads in < 3 seconds
- [ ] Mobile app launches in < 5 seconds
- [ ] API response time < 200ms
- [ ] Database query optimized

## Timeline

### Week 1

- Days 1-2: Project setup and infrastructure
- Days 3-4: Database and backend development
- Days 5-6: Web application development

### Week 2

- Days 7-8: Mobile application development
- Days 9-10: Integration and testing
- Days 11-12: CI/CD and deployment

Total Duration: 12 working days

## Risk Mitigation

### Technical Risks

1. **Cross-platform compatibility issues**

   - Mitigation: Use React Native for code sharing
   - Test on multiple devices early

2. **Database connection problems**

   - Mitigation: Implement connection pooling
   - Add retry logic and circuit breakers

3. **Performance issues**
   - Mitigation: Implement caching
   - Optimize database queries

### Process Risks

1. **ATDD learning curve**

   - Mitigation: Start with simple scenarios
   - Provide team training

2. **Monorepo complexity**
   - Mitigation: Use Nx generators
   - Document project structure

## Monitoring and Maintenance

### Application Monitoring

- Set up error tracking (Sentry)
- Implement performance monitoring
- Configure health checks

### Continuous Improvement

- Regular security updates
- Performance optimization
- Feature enhancements based on usage

## Conclusion

This implementation plan provides a structured approach to building a Hello World application that demonstrates the full Product Outcomes technology stack. By following ATDD methodology and adhering to established practices, we ensure high-quality, maintainable code that serves as a foundation for future development.

The plan emphasizes:

- Incremental development with continuous testing
- Full technology stack integration
- Enterprise-grade architecture
- Cross-platform support
- Comprehensive quality assurance

Success depends on strict adherence to the development practices, continuous testing, and maintaining high code quality standards throughout the implementation process.
