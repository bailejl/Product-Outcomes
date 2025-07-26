# NX Guidance

This is a comprehensive guide to help you get the most from Nx using CLI commands and MCP tools.

**CRITICAL**: Do not manually change Nx files and folders. Use MCP first, then Nx CLI commands, and if not possible, reconsider your approach.

# General Guidelines

- When answering questions, use the nx_workspace tool first to gain an understanding of the workspace architecture
- For questions around nx configuration, best practices or if you're unsure, use the nx_docs tool to get relevant, up-to-date docs!! Always use this instead of assuming things about nx configuration
- If the user needs help with an Nx configuration or project graph error, use the 'nx_workspace' tool to get any errors
- To help answer questions about the workspace structure or simply help with demonstrating how tasks depend on each other, use the 'nx_visualize_graph' tool

# Generation Guidelines

If the user wants to generate something, use the following flow:

- learn about the nx workspace and any specifics the user needs by using the 'nx_workspace' tool and the 'nx_project_details' tool if applicable
- get the available generators using the 'nx_generators' tool
- decide which generator to use. If no generators seem relevant, check the 'nx_available_plugins' tool to see if the user could install a plugin to help them
- get generator details using the 'nx_generator_schema' tool
- you may use the 'nx_docs' tool to learn more about a specific generator or technology if you're unsure
- decide which options to provide in order to best complete the user's request. Don't make any assumptions and keep the options minimalistic
- open the generator UI using the 'nx_open_generate_ui' tool
- wait for the user to finish the generator
- read the generator log file using the 'nx_read_generator_log' tool
- use the information provided in the log file to answer the user's question or continue with what they were doing

# Running Tasks Guidelines

If the user wants help with tasks or commands (which include keywords like "test", "build", "lint", or other similar actions), use the following flow:

- Use the 'nx_current_running_tasks_details' tool to get the list of tasks (this can include tasks that were completed, stopped or failed).
- If there are any tasks, ask the user if they would like help with a specific task then use the 'nx_current_running_task_output' tool to get the terminal output for that task/command
- Use the terminal output from 'nx_current_running_task_output' to see what's wrong and help the user fix their problem. Use the appropriate tools if necessary
- If the user would like to rerun the task or command, always use `nx run <taskId>` to rerun in the terminal. This will ensure that the task will run in the nx context and will be run the same way it originally executed
- If the task was marked as "continuous" do not offer to rerun the task. This task is already running and the user can see the output in the terminal. You can use 'nx_current_running_task_output' to get the output of the task to verify the output.

## Repo Structure

This NX monorepo follows an `app-centric` structure:

- **apps/**: Contains buildable and deployable applications
- **libs/**: Contains shared libraries specific to one or multiple applications
- Libraries can be published to public registries when needed

## NX MCP Tools (Priority #1)

The Nx MCP server provides these tools for workspace management:

- **nx_workspace**: Returns annotated representation of local nx configuration and project graph
- **nx_project_details**: Returns full project configuration for a specific nx project
- **nx_docs**: Retrieves documentation sections relevant to user queries
- **nx_generators**: Returns list of available generators in the workspace
- **nx_generator_schema**: Provides detailed schema information for a specific generator
- **nx_available_plugins**: Returns available Nx plugins from npm registry with descriptions

## Essential NX CLI Commands (Priority #2)

### Core Commands

```bash
# Workspace Management
npx nx create-nx-workspace <name>    # Create new workspace
npx nx add <plugin>                  # Add capabilities to existing workspace
npx nx sync                          # Synchronize workspace configuration

# Code Generation
npx nx generate <generator> <name>   # Generate code and projects
npx nx g app <app-name>             # Generate new application
npx nx g lib <lib-name>             # Generate new library
npx nx g component <name>           # Generate component

# Task Execution
npx nx run <project>:<target>       # Execute specific project task
npx nx serve <app>                  # Serve application in development
npx nx build <app>                  # Build application for production
npx nx test <project>               # Run tests for project
npx nx lint <project>               # Lint project code

# Multi-Project Operations
npx nx run-many --target=<target> --all                    # Run target for all projects
npx nx run-many --target=<target> --projects=<proj1,proj2> # Run target for specific projects
npx nx affected --target=<target>                          # Run target for affected projects only
npx nx affected:build                                       # Build only affected projects
npx nx affected:test                                        # Test only affected projects
```

### Advanced Commands

```bash
# Dependency & Graph Management
npx nx graph                        # Visualize project dependencies
npx nx affected:graph               # Show affected project graph
npx nx dep-graph                    # Alternative dependency graph command

# Migration & Updates
npx nx migrate latest               # Update Nx and dependencies
npx nx migrate <package>            # Migrate specific package
npx nx migrate --run-migrations     # Apply pending migrations

# Cache & Performance
npx nx reset                        # Reset Nx cache
npx nx daemon --stop               # Stop Nx daemon
npx nx daemon --start              # Start Nx daemon

# Workspace Analysis
npx nx list                         # List installed plugins
npx nx list <plugin>               # Show plugin capabilities
npx nx report                      # Generate workspace report
```

### Current Project Commands

Based on your `package.json` scripts:

```bash
npm run dev          # Serve both API and web concurrently
npm run build        # Build all projects
npm run test         # Test all projects
npm run test:coverage # Test with coverage
npm run e2e          # Run end-to-end tests
npm run lint         # Lint all projects
npm run typecheck    # TypeScript checking for all
npm run quality      # Full quality check (format, test, lint, audit)
npm run clean        # Reset cache and clean dependencies
```

## Best Practices for CLI Approach

### 1. Use Generators Instead of Manual File Creation

```bash
# ✅ DO: Use generators
npx nx g @nx/react:app my-app
npx nx g @nx/react:lib shared-utils
npx nx g @nx/react:component my-component --project=my-app

# ❌ DON'T: Manually create files and folders
```

### 2. Leverage Affected Commands for Efficiency

```bash
# ✅ DO: Only run tasks for changed code
npx nx affected:build
npx nx affected:test
npx nx affected:lint

# ❌ DON'T: Always run all projects
npx nx run-many --target=build --all  # Only when necessary
```

### 3. Use MCP Tools for Workspace Queries

```bash
# ✅ DO: Use MCP tools to understand workspace
# nx_workspace - Get workspace overview
# nx_project_details - Get specific project info
# nx_generators - See available generators

# ❌ DON'T: Manually parse nx.json or workspace.json
```

### 4. Automate with npm Scripts

Your `package.json` already includes optimal scripts:

- Use `npm run dev` for development
- Use `npm run quality` for comprehensive checks
- Use `npm run clean` when cache issues occur

### 5. Plugin Management via CLI

```bash
# Add new capabilities
npx nx add @nx/node          # Add Node.js support
npx nx add @nx/storybook     # Add Storybook
npx nx add @nx/cypress       # Add Cypress testing

# List available plugins
npx nx list
npx nx list @nx/react        # See React plugin capabilities
```

## Workspace Configuration (Current Setup)

Your workspace uses Nx v21.3.1 with these key features:

- **Apps Directory**: `apps/`
- **Libs Directory**: `libs/`
- **Cached Operations**: build, lint, test, e2e, typecheck
- **Active Plugins**: webpack, react, vite, playwright, rollup, jest
- **Task Dependencies**: Proper build dependency chain configured

## Common Workflows

### Creating New Features

```bash
# 1. Generate library for shared logic
npx nx g @nx/js:lib feature-user-management

# 2. Generate components in apps
npx nx g @nx/react:component user-profile --project=web

# 3. Generate API endpoints
npx nx g @nx/express:route users --project=api
```

### Testing Strategy

```bash
# Run affected tests during development
npx nx affected:test

# Full test suite with coverage
npm run test:coverage

# E2E tests for web app
npm run e2e
```

### Build & Deploy

```bash
# Build affected projects only
npx nx affected:build

# Build everything for production
npm run build

# Check what would be affected
npx nx affected:graph
```

## Troubleshooting

### Cache Issues

```bash
npm run clean           # Reset everything
npx nx reset           # Reset just Nx cache
```

### Dependency Problems

```bash
npx nx graph           # Visualize dependencies
npx nx report          # Generate diagnostic report
```

### Performance Optimization

```bash
npx nx daemon --start  # Enable Nx daemon for faster builds
```

Remember: Always prefer MCP tools → CLI commands → manual file changes (as last resort)
