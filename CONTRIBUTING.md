# Contributing to Backendify

Thank you for your interest in contributing to Backendify! This document provides guidelines and instructions for contributing.

---

## Code of Conduct

Please be respectful and constructive in all interactions. We're building something together!

---

## How to Contribute

### Reporting Bugs

1. Check if the bug has already been reported in [Issues](https://github.com/yourusername/backendify/issues)
2. If not, create a new issue with:
   - Clear title and description
   - Steps to reproduce
   - Expected vs actual behavior
   - Environment details (OS, Docker version, etc.)

### Suggesting Features

1. Check existing issues and discussions
2. Create a new issue with the `enhancement` label
3. Describe the feature and its use case

### Submitting Code

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/my-feature`
3. Make your changes
4. Write/update tests
5. Ensure all tests pass
6. Commit with clear messages
7. Push and create a Pull Request

---

## Development Setup

### Prerequisites

- Docker & Docker Compose
- Python 3.11+
- Node.js 18+

### Backend Development

```bash
cd backend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
pip install -r requirements-dev.txt  # Dev dependencies

# Run tests
pytest

# Run with auto-reload
uvicorn app.main:app --reload
```

### Frontend Development

```bash
cd frontend
npm install
npm run dev

# Type checking
npm run typecheck

# Linting
npm run lint
```

---

## Code Style

### Python (Backend)

- Follow PEP 8
- Use type hints
- Format with `black`
- Sort imports with `isort`
- Lint with `ruff`

### TypeScript (Frontend)

- Use TypeScript strict mode
- Follow ESLint configuration
- Use Prettier for formatting

---

## Commit Messages

Use clear, descriptive commit messages:

```
feat: add advanced filtering to data API
fix: resolve token refresh race condition
docs: update authentication guide
refactor: simplify policy evaluation logic
test: add tests for webhook delivery
```

Prefixes:
- `feat:` - New feature
- `fix:` - Bug fix
- `docs:` - Documentation
- `refactor:` - Code refactoring
- `test:` - Tests
- `chore:` - Maintenance

---

## Pull Request Guidelines

1. **One feature per PR** - Keep PRs focused
2. **Update tests** - Add/update tests for your changes
3. **Update docs** - Document new features or API changes
4. **Pass CI** - Ensure all checks pass
5. **Respond to feedback** - Address review comments promptly

---

## Project Structure

```
backendify/
├── backend/
│   ├── app/
│   │   ├── api/routes/    # API endpoints
│   │   ├── models/        # SQLAlchemy models
│   │   ├── schemas/       # Pydantic schemas
│   │   ├── services/      # Business logic
│   │   └── core/          # Config, security
│   └── tests/
├── frontend/
│   ├── src/
│   │   ├── routes/        # Page components
│   │   ├── components/    # Reusable components
│   │   └── lib/           # Utilities
│   └── tests/
└── docs/
```

---

## Testing

### Backend Tests

```bash
cd backend
pytest                      # Run all tests
pytest -v                   # Verbose output
pytest tests/test_auth.py   # Run specific file
pytest -k "test_login"      # Run tests matching pattern
```

### Frontend Tests

```bash
cd frontend
npm run test
```

---

## Questions?

- Open a GitHub Discussion
- Check existing issues and docs

Thank you for contributing! 🎉
