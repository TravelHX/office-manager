# Claude Code Rules for Project

## Project Overview

This is the Sparky project. Customize this section with your project's purpose and goals.

## Project Structure

### Root Directory Structure

The root directory should only contain `readme.md` and the following directories:

- `/data/` - Data files and resources
- `/src/` - Source code
- `/tests/` - Test files
- `/utils/` - Utility scripts and helper tools
- `/docs/` - Documentation folder
- `readme.md` - Implemented functionality, run instructions, and deployment URL

### Utils Directory Structure

The `/utils/` directory MUST contain the following PowerShell scripts:

- `run-docker.ps1` - Starts the development environment
- `run-tests.ps1` - Runs ALL tests (unit, integration, and UI tests)
- `run-integration-tests.ps1` - Runs integration tests only
- `run-ui-tests.ps1` - Runs UI tests only

### Documentation Location

- `readme.md` MUST be located in the project root directory
- `readme.md` contains all implemented functionality, instructions on how to run and use the software, and where it is deployed (URL)
- `spec.md` MUST be located in the `/docs/` folder
- `spec.md` contains all required and implemented functionality in the system (full specification)
- `todo.md` MUST be located in the `/docs/` folder
- `todo.md` should list all tasks to be completed

### Task Numbering System

- Tasks in `todo.md` MUST use sequential numbering in phases
- Phase 1 tasks should be numbered: 1.1, 1.2, 1.3, etc.
- Phase 2 tasks should be numbered: 2.1, 2.2, 2.3, etc.
- Each phase maintains its own sequential numbering

### Feature Management

- Any new features MUST be added to BOTH `docs/spec.md` (to detail the feature) and `docs/todo.md` (to detail the tasks)
- After a phase has been started, no additional tasks can be added to it
- If new tasks are needed after a phase has started, a new phase MUST be created

## Code Style and Standards

### Coding Standards

- **Language Restrictions:**
  - **NO code should be written in Python** - Python is not allowed for any part of the codebase
- Use consistent naming conventions for methods, properties, and classes
- Use consistent naming conventions for private fields and local variables
- Use meaningful, descriptive names for variables and methods
- Prefer async/await pattern for I/O operations and external calls
- Use appropriate type safety features where available
- Follow language-specific naming conventions consistently

### Architecture Patterns

- Maintain separation of concerns between layers
- Use dependency injection for services
- Keep controllers/handlers thin - business logic should be in services
- Use interfaces for service contracts
- Follow repository pattern for data access

### Database and Data Access

- Use async methods for database operations
- Keep migrations clean and well-documented
- Use proper naming conventions for database tables and columns
- Implement proper error handling for database operations

### Testing

- Write unit tests for business logic
- Use integration tests for database operations
- Follow AAA pattern (Arrange, Act, Assert)
- Use meaningful test names that describe the scenario
- Never change production code solely to make a test pass (e.g., no conditional branches like `if (inTest) {}`)
- Never add code paths that exist only for tests; tests must validate real behavior
- Ensure each unit test covers a single, discrete piece of functionality
- Whenever adding or modifying a test, review existing tests to avoid duplication
- **Test Idempotency**: All tests MUST be idempotent
  - Tests should be able to run multiple times in any order without side effects
  - Setup-test and teardown-test operations are redundant and should not be used
  - Each test must clean up after itself or use isolated test data
  - Tests should not depend on external state or previous test execution
- **Use Case Testing**: All use cases MUST have at least one associated test
  - Every documented use case in `usecases.md` must have corresponding test coverage
  - Tests should validate the complete user interaction flow described in the use case
  - Use case tests should be updated when use cases are modified

### Security

- Validate all user inputs
- Use proper authentication and authorization
- Sanitize data before database operations
- Follow OWASP security guidelines

### Performance

- Use async/await for I/O operations
- Implement proper caching strategies
- Optimize database queries
- Use pagination for large result sets

### Error Handling

- Use proper exception handling
- Log errors appropriately
- Return meaningful error messages to users
- Implement proper validation

### File Organization

- Keep related files in appropriate folders
- Use consistent file naming conventions
- Group related functionality together
- Maintain clean project structure

## Specific Project Rules

### Controllers/Handlers

- Keep controllers/handlers focused on HTTP concerns
- Use proper HTTP status codes
- Implement proper validation
- Use view models/DTOs for data transfer

### Services

- Implement business logic in services
- Use dependency injection
- Handle errors gracefully
- Log important operations

### Data Access

- Use data access patterns properly
- Implement repository pattern
- Use async methods consistently
- Handle database errors appropriately

### Views/UI

- Use consistent syntax and patterns
- Implement proper validation
- Use view models/DTOs for data binding
- Keep views focused on presentation

## Code Quality

- Write self-documenting code
- Add documentation for public APIs
- Use meaningful variable names
- Keep methods focused and small
- Avoid code duplication
- Use proper exception handling

## Workflow Rules

### General Workflow

- Always ask for clarification if requirements are unclear
- When a user requests implementation of multiple large features in a single instruction, confirm expectations, negotiate scope, or propose a phased plan before proceeding
- **NEVER directly implement a feature that doesn't have a todo.md entry** - verify the feature exists in `docs/todo.md` before starting implementation
- **If a feature is too large, too complex, or has unmet dependencies/requirements, say so and refuse to implement**
- **Implementation Requirements:**
  - **All functionality MUST be added in discrete chunks** - Never implement something that cannot be run independently
  - **Where independent implementation is absolutely necessary, use feature flags** to control the visibility and execution of incomplete features
  - **Always ensure the code (at least) builds following implementation** - Verify the solution compiles successfully after each implementation step
- Propose changes before implementing them when appropriate
- Never make destructive changes (delete files, etc.) without explicit confirmation
- Never modify production configuration files without permission
- Always explain what changes are being made and why

## Git and Version Control

### Branching Strategy: Mainlining

- This project uses **mainlining** - all work is done directly on the `main` branch
- Do NOT create feature branches, topic branches, or worktree branches for development
- All commits go directly to `main`
- This keeps the history linear and avoids merge overhead

### Critical Workflow Rules

- **NEVER commit changes without explicit permission from the user**
- **NEVER push changes without explicit permission from the user**
- **NEVER run `git push` (in any form) without explicit permission from the user** - this includes `git push`, `git push --force`, `git push origin <branch>`, and all variants, whether invoked via Bash or PowerShell
- **NEVER run `rm` or `Remove-Item` commands (in any form) without explicit permission from the user** - this includes `rm`, `rm -rf`, `rm -f`, PowerShell `Remove-Item`, and all variants; use safer alternatives where possible and always confirm before deleting
- Bash and PowerShell commands are otherwise pre-approved for execution without prompting, EXCEPT for the `git push` and `rm`/`Remove-Item` restrictions above which always require explicit consent
- Always ask for permission before staging files
- Always ask for permission before creating commits
- Always ask for permission before pushing to remote repositories
- Only commit when the user explicitly requests it

### Commit Guidelines

- Write meaningful commit messages
- Keep commits focused and atomic
- Use mainlining strategy (commit directly to main)
- Review code before merging
- Do not commit if the solution does not compile or any tests fail

### Pre-Commit Validation (Mandatory)

- **NEVER commit unless ALL tests pass**
- The solution MUST compile successfully before staging or committing any files
- ALL tests MUST pass (unit, integration, and UI tests when applicable) before committing
  - Run `utils/run-tests.ps1` to verify all tests pass before committing
  - If any test fails, the commit MUST be blocked until all tests pass
- EVERY change MUST include at least one new or updated test that covers the change
- If a change is purely documentation or configuration, add or update a test that asserts the behavior or configuration contract where feasible (e.g., feature flags, routing, or config binding tests)

## GitHub Issue Management

### Critical Workflow Rules

- **NEVER update GitHub issues without explicit permission from the user**
- **NEVER create GitHub issues without explicit permission from the user**
- **NEVER close GitHub issues without explicit permission from the user**
- Always ask for permission before creating, updating, or modifying GitHub issues
- Only interact with GitHub issues when the user explicitly requests it
- When creating issues from bug documentation, only do so if explicitly requested

### Issue Management Guidelines

- When creating issues, include relevant information from bug documentation
- Link issues to related code changes or commits when appropriate
- Use appropriate labels and milestones when creating issues
- Keep issue descriptions clear and actionable
- Update issue status only when explicitly requested

## Dependencies

- Keep dependencies up to date
- Use stable versions in production
- Document any special dependency requirements
- Follow security best practices for package management

## Documentation and Task Management

### Documentation Rules

1. **readme.md** contains all the implemented functionality in the system
2. **spec.md** contains all the required and implemented functionality in the system (full specification)
3. **spec.md** MUST live in the `/docs/` folder; **readme.md** MUST live in the project root directory
4. **readme.md** MUST contain instructions on how to run and use the software, along with where it is (i.e. the URL it is deployed to)

### Documentation Structure

- Every project MUST have:
  - `readme.md` in the project root - Implemented functionality, run instructions, usage, and deployment URL
  - `docs/` folder containing:
    - `spec.md` - Full specification (required and implemented functionality)
    - `todo.md` - Phased and numbered task list with clear dependencies
- All documentation MUST be in plain text/Markdown format
- NO Unicode characters (emojis, special symbols) in any documentation
- Use standard ASCII characters only (checkboxes: [x], [ ], bullets: -, *, etc.)
- Documentation must be accessible and render correctly in all text editors

### readme.md Requirements (Project Root)

- **Location**: MUST be located in the project root directory
- **Purpose**: Contains all implemented functionality in the system
- Instructions on how to run and use the software
- Where the software is deployed (URL)
- Current feature list (what IS implemented only)
- API endpoints for implemented features (if applicable)

### spec.md Requirements (docs/ folder)

- **Location**: MUST be located in the `/docs/` folder
- **Purpose**: Contains all required and implemented functionality in the system (full specification)
- Clear project overview and purpose
- Complete setup instructions for all platforms
- Architecture overview
- Technology stack
- API endpoints (implemented and planned)
- Testing instructions
- Deployment instructions
- Recent updates section

### TODO.md Requirements

- **Location**: MUST be located in `/docs/` folder as `todo.md`
- **Purpose**: Should list all tasks to be completed
- MUST use numbered phases (Phase 1, Phase 2, etc.)
- Each phase MUST have:
  - Clear objective/goal
  - Numbered tasks within the phase
  - Dependencies clearly stated
  - Estimated effort/time
  - Priority level
- Tasks organized by implementation order
- Dependencies between phases clearly documented
- Use standard checkboxes: [ ] for pending, [x] for completed
- Include testing tasks within each phase
- **Sequential Numbering System**: Task numbering MUST be sequential within each phase
  - Phase 1 tasks MUST be numbered: 1.1, 1.2, 1.3, etc.
  - Phase 2 tasks MUST be numbered: 2.1, 2.2, 2.3, etc.
  - Phase 3 tasks MUST be numbered: 3.1, 3.2, 3.3, etc.
  - The first number indicates the phase, the second number indicates the sequential task within that phase
  - Never use task numbers from a different phase (e.g., 2.1 should never appear under Phase 1)
- **Ascending Numbering Rule**: The numbers in `docs/TODO.md` MUST be ascending
  - **Never add a lower number after a higher one** - All task numbers must increase sequentially
  - **Only ever add items to the end of the list** - Never insert a task above already implemented ones
  - Always append new tasks to the end, maintaining ascending order
- **Phase Locking Rule**: After a phase has been started, no additional tasks can be added to it
  - If new tasks are needed after a phase has started, a new phase MUST be created
  - This ensures phases remain stable once work begins

### Documentation Updates

- Update `readme.md` (root) after each significant code change that affects implemented functionality
- Update `docs/spec.md` when specification changes (new features, architecture, etc.)
- Include new features, bug fixes, and architectural changes in the appropriate document
- Update installation and setup instructions if dependencies change
- Keep project overview and architecture sections current in spec.md
- Document any breaking changes or migration steps
- Remove or update outdated information immediately
- **After every change, check that documentation correctly reflects the system**
  - `readme.md` (root): Ensure it contains only implemented functionality, run instructions, usage, and deployment URL
  - `docs/spec.md`: Ensure implemented features are in "Currently Implemented", planned features in "Not Yet Implemented"
  - Verify that feature descriptions match the actual implementation
- **When a new feature is added, update and review `usecases.md`**
  - Document all manual paths through the new feature
  - Ensure every user interaction flow is captured
  - Review existing use cases to ensure completeness and avoid duplication
  - Verify that all manual testing paths are documented
  - **Each use case MUST have at least one associated test** (see Testing section)

### TODO List Management

- Review and update TODO.md after each task completion
- **After every change, update TODO.md to accurately reflect what has been done and what is still to do**
  - Mark completed tasks with [x]
  - Update task status from "Not Started" to "In Progress" to "Completed"
  - Remove completed phases when all tasks done
  - Add new tasks to appropriate phases
  - Renumber phases if structure changes
  - Update effort estimates based on actual time
  - Link tasks to related code changes or issues
- Ensure TODO.md accurately reflects the current state of implementation
- Keep task dependencies and status up to date
- Do not add new tasks to phases with numbers lower than already completed phases; append new work to the next appropriate phase number or create a new higher-numbered phase

### Bug Documentation

- When a bug is classified as such by the user, create a bug documentation file in the `docs/` folder
- **When creating bug documentation, NO code should be changed** - only create or update the bug markdown file
- Bug documentation files MUST follow the naming pattern: `####-BugName.md` (e.g., `0001-ExampleBug.md`)
  - Bugs MUST be numbered with a 4-digit zero-padded number (0001, 0002, 0003, etc.)
  - The number is followed by a dash, then the bug name
  - Use sequential numbering for new bugs (increment from the highest existing bug number)
- Each bug documentation file MUST include:
  - Issue description: Clear explanation of the bug
  - Current Status: Details of what has been tried and what the current state is
  - Investigation Tasks: Numbered list of tasks to investigate and fix the bug
  - Technical Notes: Implementation details, known issues, and relevant technical information
  - Next Steps: Plan for resolving the bug
- **Pre-Bug Work Prerequisites:**
  - **BEFORE starting to look at a bug, ALWAYS review the bug markdown file**
  - If no bug markdown file exists and you have NOT been explicitly asked to create one, state that no bug file exists and stop
  - Do not proceed with bug investigation or fixing without a bug documentation file unless explicitly instructed to create one
  - Review the existing bug file to understand the current state, previous attempts, and next steps before beginning work
- **When Asked to Verify, Check, or Work on a Bug:**
  - **3a. Validate that the bug is still a bug** - First verify that the reported issue still exists and reproduces the described behavior
  - **3b. Update each action in the bug ticket** - Document every action taken, including:
    - All actions to investigate the bug
    - All actions to fix the bug
    - Whether each action succeeded or failed
    - Results and outcomes of each attempt
  - **3c. Where a bug is fixed, ask for confirmation** - When a bug appears to be fixed:
    - Mark the bug status as "Pending Confirmation" in the "Current Status" section
    - Do NOT mark as fixed or move to fixed folder until user confirms
    - Request explicit confirmation from the user that the bug is resolved
- **Bug Fixing Workflow (Test-Driven Bug Fixes):**
  - **ALWAYS create a failing test first** that reproduces the bug before starting any fix work
  - The failing test serves as proof that the bug exists and documents the expected behavior
  - **DO NOT start fixing the bug until the failing test is created**
  - **The bug ticket markdown file MUST be updated at each step** during the bug fixing process
  - After creating the failing test, implement the fix
  - Verify that the previously failing test now passes, confirming the bug is resolved
  - This ensures bugs are properly documented through tests and prevents regressions
- **Bug Fix Completion Requirements:**
  - **1. A bug can ONLY be marked as complete when BOTH of the following conditions are met:**
    1. There is a passing test that was previously failing (the test serves as proof that the bug existed and is now resolved)
    2. The user confirms the issue is fixed
  - **2. Once a bug is confirmed as fixed, it MUST be moved into the `/bugs/fixed/` folder** (`docs/bugs/fixed/`)
    - This MUST happen immediately after the bug is confirmed as fixed
    - Both conditions must be met before moving:
      1. The bug has a test that was failing and now passes
      2. The user confirms the bug is fixed
    - Update the bug documentation file's "Current Status" to indicate the bug is fixed before moving it
    - Fixed bugs MUST be moved to `docs/bugs/fixed/` - do not leave fixed bugs in the main bugs directory
    - Once moved, the bug is considered resolved and archived
  - **Never mark a bug as fixed or move it to the fixed folder without BOTH a passing test AND user confirmation**
- **Bug Ticket Update Requirements:**
  - **The bug ticket markdown file MUST be updated at each step** while fixing a bug
  - Update the file immediately after each significant action or discovery
  - Do not wait until the end of a session to update the bug ticket
  - Each update should reflect the current state of the investigation or fix attempt
  - **Update each action in the bug ticket, including any actions to fix, whether or not they succeed**
    - Document successful actions
    - Document failed actions and why they failed
    - Include all investigation steps and their outcomes
- When working on a bug, ALWAYS update the "Current Status" section with:
  - What was attempted in the current iteration
  - Results of each attempt (successful or not)
  - Any new information discovered
  - What still needs to be tried
- Update the bug documentation file after each iteration or significant attempt to fix the bug
- Keep the "Current Status" section as a running log of investigation and fix attempts
- Document all attempted solutions, even if they didn't work, to avoid repeating unsuccessful approaches
- **Numbering Rules for Documentation:**
  - ALL numbered lists in documentation MUST start at 1 (not 0)
  - Tasks, phases, steps, and any other numbered items should begin with 1
  - This applies to bug documentation, TODO lists, README files, and all documentation

### Feature Request Documentation

- When a new feature is requested, follow this process:
  1. **Add the new feature to `docs/spec.md`** - Document the feature specification
  2. **Break down the feature into small, actionable tasks** - Each task should be specific and achievable
  3. **Add the tasks to the end of `docs/todo.md`** - Tasks MUST be appended to the end of the todo.md file, maintaining chronological order
  4. **Include an end-to-end test task** - Part of the tasks for the new feature MUST include an end-to-end test using Playwright
- **When creating feature documentation, NO code should be changed** - only update the documentation files (`docs/spec.md` and `docs/todo.md`)
- Do not implement newly requested features until the user explicitly instructs you to do so; only update the documentation files when the request is made
- **NEVER directly implement a feature that doesn't have a todo.md entry**
  - Before implementing any feature, verify that it has corresponding tasks in `docs/todo.md`
  - If a feature is requested for implementation but has no todo.md entry, refuse to implement and request that the feature be documented first
- **Feature Implementation Refusal Criteria:**
  - **If a feature is too large to implement in one go, say so and refuse to implement**
  - **If a feature is too complex, say so and refuse to implement**
  - **If dependencies or requirements cannot be fully met, say so and refuse to implement**
  - When refusing, clearly explain why the feature cannot be implemented (size, complexity, or unmet dependencies/requirements)
  - Suggest breaking the feature into smaller, manageable pieces if appropriate
- In `docs/spec.md`: Add the feature to detail the feature specification
- In `docs/todo.md`: Add tasks that need to be achieved to implement the feature
- **Test-First Development**: Each new feature MUST have a test written BEFORE development starts
  - Create the test(s) that define the expected behavior of the feature
  - The test(s) should initially fail (red phase of TDD)
  - Then implement the feature to make the test(s) pass (green phase of TDD)
  - This ensures the feature is developed to meet the test requirements and prevents over-engineering
- **End-to-End Testing Requirements:**
  - Part of the tasks for each new feature MUST include an end-to-end test
  - End-to-end tests MUST be written using Playwright
  - The end-to-end test task should be included in the task breakdown when documenting the feature
- **New features MUST always be added AFTER the last implemented feature, maintaining chronological order**
  - Identify the last implemented feature/phase in TODO.md (e.g., if Phase 7 is the latest implemented feature)
  - Add the new feature AFTER this point, even if it logically belongs in an earlier phase (e.g., a feature that fits Phase 4 must still be added after Phase 7)
  - This maintains chronological implementation order regardless of logical phase placement
  - When determining which phase to place the feature in:
    - Identify the highest completed phase number
    - Place the feature in the next appropriate phase, or create a new phase if needed
    - If Phase 5 is complete, the feature can be added to Phase 6, Phase 7, or new Phase 8+
    - Consider dependencies and logical grouping when determining placement
    - Unless explicitly stated otherwise by the user, fit the feature into the most appropriate existing phase or create a new phase
- **Phase Locking**: Remember that after a phase has been started, no additional tasks can be added to it - a new phase must be created
- Break down features into numbered tasks following the sequential numbering system (e.g., Phase 1: 1.1, 1.2, 1.3, etc.)
- Include dependencies, priority, and effort estimates when applicable
- Follow the same phase structure with clear objectives and numbered subtasks
