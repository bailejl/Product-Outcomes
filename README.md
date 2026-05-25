# Product Outcomes

**Reference architecture for AI-augmented full-stack delivery with
BDD acceptance gates.** A working monorepo that demonstrates how a
modern product team would actually wire planning, development, and
acceptance testing together when AI is in the loop.

## Why this exists

Most monorepo starters show you the *layout*. This one shows you the
*delivery flow*:

- **Specs as the source of truth** — Concise Declarative Gherkin
  scenarios that double as acceptance gates and as prompts for AI-assisted
  feature implementation
- **Functional-programming patterns** — arrow functions, factory
  patterns, no classes — chosen because they read cleanly under
  AI-assisted refactoring
- **Cross-platform from day one** — Web + mobile-ready, single API
- **Production hygiene baked in** — health checks, graceful DB
  fallbacks, error handling, typed everywhere

The point isn't that any of these techniques is novel. The point is
that they compose into a delivery substrate where AI agents can do
real work without breaking the build.

## 🎯 What's Inside

This Hello World app demonstrates:

- **Cross-Platform Architecture**: Web app with mobile-ready responsive design
- **Database Integration**: PostgreSQL with graceful fallback to mock data
- **Modern Tech Stack**: React, Express.js, TypeScript, Nx monorepo
- **Functional Programming**: Arrow functions, factory patterns, no classes
- **Enterprise Patterns**: Health checks, error handling, monitoring
- **BDD Testing**: Concise Declarative Gherkin scenarios
- **Quality Gates**: Comprehensive linting, formatting, and type checking

## 🏗️ Architecture

```
Product-Outcomes/
├── api/                    # Express.js API server
│   ├── src/
│   │   ├── main.ts        # Server entry point
│   │   ├── routes/        # API routes (messages)
│   │   └── db/            # Database connection & schema
├── web/                    # React web application
│   ├── src/
│   │   ├── app/           # Main app component
│   │   └── main.tsx       # Web entry point
├── ui/                     # Shared UI component library
│   └── src/lib/           # HelloWorld component
├── features/               # BDD test scenarios
│   ├── hello-world.feature
│   ├── step-definitions/
│   ├── page-objects/
│   └── data/              # Test data (personas)
└── docs/                   # Implementation documentation
```

## 🚀 Quick Start

### Prerequisites

- **Node.js** 24+ (LTS)
- **npm** 9+
- **Git**
- Optional: **PostgreSQL** (uses mock data fallback)
- Optional: **Docker**

### Installation

```bash
# Clone the repository
git clone https://github.com/bailejl/Product-Outcomes.git
cd Product-Outcomes

# Install dependencies and build all projects
npm run setup

# Start both API and web app
npm run dev
```

### Verify Installation

```bash
# Check API health
npm run check:health

# Test Hello World endpoint
npm run check:hello
```

## 📝 Available Scripts

### Development Commands

| Script               | Description                             |
| -------------------- | --------------------------------------- |
| `npm start`          | Start API server only                   |
| `npm run start:api`  | Start Express.js API on port 3333       |
| `npm run start:web`  | Start React web app on port 4200        |
| `npm run start:both` | Start both API and web app concurrently |
| `npm run dev`        | Alias for `start:both`                  |

### Build Commands

| Script              | Description                       |
| ------------------- | --------------------------------- |
| `npm run build`     | Build all projects (api, web, ui) |
| `npm run build:api` | Build API server only             |
| `npm run build:web` | Build web application only        |
| `npm run build:ui`  | Build UI library only             |

### Testing Commands

| Script             | Description                          |
| ------------------ | ------------------------------------ |
| `npm test`         | Run all unit tests                   |
| `npm run test:api` | Run API tests                        |
| `npm run test:web` | Run web app tests                    |
| `npm run test:e2e` | Run end-to-end tests with Playwright |

### Quality Commands

| Script              | Description                                             |
| ------------------- | ------------------------------------------------------- |
| `npm run lint`      | Lint all projects                                       |
| `npm run lint:fix`  | Fix auto-fixable linting issues                         |
| `npm run lint:mega` | Run comprehensive MegaLinter scan                       |
| `npm run format`    | Format code with Prettier                               |
| `npm run typecheck` | TypeScript type checking                                |
| `npm run quality`   | Run all quality checks (format, lint, typecheck, build) |

### Utility Commands

| Script                 | Description                        |
| ---------------------- | ---------------------------------- |
| `npm run clean`        | Clean build cache and dependencies |
| `npm run setup`        | Full setup (install + build)       |
| `npm run check:health` | Check API health endpoint          |
| `npm run check:hello`  | Test Hello World endpoint          |

### Docker Commands

| Script                 | Description               |
| ---------------------- | ------------------------- |
| `npm run docker:build` | Build Docker image        |
| `npm run docker:run`   | Run application in Docker |

## 🌐 Endpoints

### API Server (http://localhost:3333)

- **GET** `/api` - API status
- **GET** `/api/health` - Health check with database status
- **GET** `/api/messages/hello-world` - Hello World message from database

### Web Application (http://localhost:4200)

- Interactive Hello World interface with loading states
- Error handling and retry functionality
- Responsive design for mobile and desktop

## 🧪 Testing

### Running Tests

```bash
# Run all tests
npm test

# Run specific test suites
npm run test:api    # API unit tests
npm run test:web    # React component tests
npm run test:e2e    # End-to-end tests
```

### BDD Testing

The project uses **Concise Declarative Gherkin** for BDD scenarios:

```gherkin
Feature: Hello World Display
  Scenario: User sees Hello World message on web
    When They go to the hello world page
    Then They see "Hello World from the Database!"
    And They see the header
```

Test data uses **personas and data chunks** pattern in `features/data/data.json`.

### Quality Gates

All code must pass these checks:

```bash
npm run quality  # Runs all quality checks
```

- ✅ TypeScript compilation
- ✅ ESLint (zero warnings)
- ✅ Prettier formatting
- ✅ Successful build
- ✅ 90%+ test coverage (when tests are implemented)

## 🐳 Docker Support

### Build and Run

```bash
# Build Docker image
npm run docker:build

# Run in container
npm run docker:run

# Manual Docker commands
docker build -t product-outcomes .
docker run -p 3333:3333 product-outcomes
```

### Health Checks

The Docker image includes built-in health monitoring:

```bash
docker ps  # Check container health status
```

## 🔧 Development

### Tech Stack

- **Frontend**: React 19, TypeScript, Vite, CSS Modules
- **Backend**: Express.js, Node.js 24, TypeScript
- **Database**: PostgreSQL (with mock fallback)
- **Monorepo**: Nx with Webpack, Rollup, Vite
- **Testing**: Playwright, Playwright-BDD, Jest
- **Quality**: ESLint, Prettier, MegaLinter
- **Container**: Docker with Alpine Linux

### Functional Programming

This project follows **functional programming patterns**:

- ✅ Arrow functions exclusively
- ✅ Factory functions instead of classes
- ✅ Immutable patterns
- ✅ Pure functions where possible
- ❌ No classes (except in test utilities)
- ❌ No semicolons (Prettier enforced)

### Code Style

```typescript
// ✅ Good: Factory function pattern
export const createMessagesRouter = () => {
  const router = express.Router()

  const getHelloWorldMessage = async (req, res) => {
    // Implementation
  }

  router.get('/hello-world', getHelloWorldMessage)
  return router
}

// ✅ Good: Arrow function component
export const HelloWorld = () => {
  const { message, error, loading } = createHelloWorldState()
  return <div>{message}</div>
}
```

## 📋 Project Structure

### Nx Workspace

This is an **Nx monorepo** with the following projects:

- **api** - Express.js API server
- **web** - React web application
- **ui** - Shared UI component library

### Key Files

- `nx.json` - Nx workspace configuration
- `tsconfig.base.json` - TypeScript configuration
- `package.json` - Dependencies and scripts
- `Dockerfile` - Container configuration
- `features/` - BDD test scenarios
- `docs/hello-world-implementation-plan.md` - Detailed implementation plan

## 🤝 Contributing

### Getting Started

1. **Fork** the repository
2. **Clone** your fork locally
3. **Install** dependencies: `npm run setup`
4. **Create** a feature branch: `git checkout -b feature/amazing-feature`
5. **Make** your changes following the coding standards
6. **Test** your changes: `npm run quality`
7. **Commit** your changes: `git commit -m 'Add amazing feature'`
8. **Push** to your branch: `git push origin feature/amazing-feature`
9. **Open** a Pull Request

### Coding Standards

Before submitting any PR, ensure:

```bash
# All quality checks pass
npm run quality

# All tests pass
npm test

# Build succeeds
npm run build
```

### Required Practices

- **Functional Programming**: Use arrow functions and factory patterns
- **TypeScript**: Strong typing required
- **Testing**: Write tests for new features
- **BDD**: Add Gherkin scenarios for user-facing features
- **Documentation**: Update README for new scripts or features

### Pull Request Checklist

- [ ] Code follows functional programming patterns
- [ ] All tests pass (`npm test`)
- [ ] Quality checks pass (`npm run quality`)
- [ ] Build succeeds (`npm run build`)
- [ ] Documentation updated if needed
- [ ] BDD scenarios added for new features

## 📚 Documentation

- **Implementation Plan**: [docs/hello-world-implementation-plan.md](docs/hello-world-implementation-plan.md)
- **Implementation Status**: [IMPLEMENTATION_STATUS.md](IMPLEMENTATION_STATUS.md)
- **Wiki**: [Product Outcomes Wiki](https://github.com/bailejl/Product-Outcomes/wiki)
- **Technology Stack**: [wiki/technology-stack.md](wiki/technology-stack.md)
- **Development Practices**: [wiki/practices/practices.md](wiki/practices/practices.md)

## 🚨 Troubleshooting

### Common Issues

**API not starting:**

```bash
# Check if port is in use
lsof -i :3333

# Kill existing process
pkill -f "node.*api"

# Restart API
npm run start:api
```

**Web app not loading:**

```bash
# Check if port is in use
lsof -i :4200

# Clear cache and restart
npm run clean
npm run setup
npm run start:web
```

**Database errors:**
The app gracefully falls back to mock data if PostgreSQL is not available. This is expected behavior for development.

**Build failures:**

```bash
# Clear all caches
npm run clean

# Reinstall dependencies
rm -rf node_modules package-lock.json
npm install

# Try building again
npm run build
```

## 📄 License

This project is licensed under the **MIT License** - see the [LICENSE](LICENSE) file for details.

## 🔗 Links

- **Repository**: https://github.com/bailejl/Product-Outcomes
- **Issues**: https://github.com/bailejl/Product-Outcomes/issues
- **Wiki**: https://github.com/bailejl/Product-Outcomes/wiki

---

**🎉 Happy coding!** This Hello World app demonstrates enterprise-grade full-stack development patterns. Explore the code, run the tests, and build amazing products! 🚀
