# Contributing to RESEARKA Token

Thank you for considering contributing to the RESEARKA Token project! This document outlines the process for contributing to the project and how to report issues.

## Code of Conduct

Please read our [Code of Conduct](.github/CODE_OF_CONDUCT.md) before participating in this project.

## How to Contribute

### Reporting Bugs

If you find a bug in the codebase, please submit an issue using the bug report template. Please include:

1. A clear description of the bug
2. Steps to reproduce the issue
3. Expected behavior
4. Actual behavior
5. Environment details (OS, Node.js version, etc.)
6. Any relevant logs or error messages

### Suggesting Enhancements

If you have an idea for an enhancement, please submit an issue using the feature request template. Please include:

1. A clear description of the enhancement
2. The motivation behind the enhancement
3. Any potential implementation details
4. How this enhancement would benefit the project

### Pull Requests

1. Fork the repository
2. Create a new branch from `main`
3. Make your changes
4. Run tests and linting to ensure your changes don't break existing functionality
5. Submit a pull request using the provided template

### Development Workflow

1. Install dependencies: `npm install`
2. Compile contracts: `npm run compile`
3. Run tests: `npm test`
4. Run linting: `npm run lint`
5. Format code: `npm run format`

### Commit Messages

Please follow the [Conventional Commits](https://www.conventionalcommits.org/) specification for your commit messages. This helps us automatically generate the changelog.

Examples:

- `feat: add token vesting contract`
- `fix: correct allocation percentage calculation`
- `docs: update README with vesting instructions`
- `test: add tests for token vesting`
- `chore: update dependencies`

### Code Style

We use ESLint, Solhint, and Prettier to enforce code style. Please make sure your code passes all linting checks before submitting a pull request.

## License

By contributing to this project, you agree that your contributions will be licensed under the project's [MIT License](LICENSE).
