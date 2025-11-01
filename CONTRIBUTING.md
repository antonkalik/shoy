# Contributing to Shoy

First off, thank you for considering contributing to Shoy! It's people like you that make Shoy such a great tool.

## Code of Conduct

By participating, you are expected to uphold our Code of Conduct: Be respectful, constructive, and inclusive.

## How Can I Contribute?

### Reporting Bugs

Before creating bug reports, please check the [Issues](https://github.com/antonkalik/shoy/issues) list to avoid duplicates. When creating a bug report, include:

- **Clear title and description**
- **Steps to reproduce** the behavior
- **Expected vs. actual behavior**
- **Environment details** (Node.js version, package manager, etc.)
- **Minimal reproduction** if possible

### Suggesting Enhancements

Enhancement suggestions are tracked as [GitHub Issues](https://github.com/antonkalik/shoy/issues). When creating an enhancement suggestion, include:

- **Clear description** of the enhancement
- **Use case** - why is this enhancement useful?
- **Potential solution** if you have ideas

### Pull Requests

Pull requests are welcome! Please follow these guidelines:

1. **Fork the repository**
2. **Create a feature branch** from `main`
3. **Make your changes**
4. **Write/update tests** - ensure all tests pass
5. **Update documentation** if needed
6. **Follow code style** - run `pnpm test` before submitting
7. **Write a clear commit message** using conventional commits

## Development Setup

```bash
# Clone your fork
git clone https://github.com/YOUR_USERNAME/shoy.git
cd shoy

# Install dependencies
pnpm install

# Run tests
pnpm test

# Run tests in watch mode
pnpm test:watch

# Build the project
pnpm build

# Run type checking
pnpm typecheck
```

## Code Style

- **TypeScript**: Strict mode enabled, follow existing patterns
- **Tests**: Use Jest, write tests for new features
- **Commits**: Use [Conventional Commits](https://www.conventionalcommits.org/)
- **Formatting**: Run `pnpm test` to ensure everything is formatted

## Commit Message Format

We use [Conventional Commits](https://www.conventionalcommits.org/) format:

```
type(scope): description

[optional body]

[optional footer]
```

Types: `feat`, `fix`, `docs`, `style`, `refactor`, `test`, `chore`

Examples:
- `feat(store): add maxHistory option`
- `fix(subscribe): handle unsubscribe properly`
- `docs(readme): update API examples`

## Testing

All new features should include tests. We aim for high test coverage:

```bash
# Run all tests
pnpm test

# Run with coverage
pnpm test:coverage

# Run tests in watch mode during development
pnpm test:watch
```

## Questions?

Feel free to open an issue for any questions about contributing!

