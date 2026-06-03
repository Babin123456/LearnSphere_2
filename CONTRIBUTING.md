# 🤝 Contributing to LearnSphere

Thank you for your interest in contributing to **LearnSphere**! We welcome contributions of all kinds — bug fixes, features, documentation improvements, accessibility enhancements, and more.

Please take a moment to review this guide before submitting your first contribution.

---

## 📋 Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [How to Contribute](#how-to-contribute)
- [Branch Naming Conventions](#branch-naming-conventions)
- [Commit Message Guidelines](#commit-message-guidelines)
- [Pull Request Guidelines](#pull-request-guidelines)
- [Development Setup](#development-setup)
- [Reporting Bugs](#reporting-bugs)
- [Suggesting Features](#suggesting-features)

---

## Code of Conduct

By participating in this project, you agree to uphold our [Code of Conduct](CODE_OF_CONDUCT.md).  
Please be respectful, constructive, and inclusive in all interactions.

---

## Getting Started

1. **Fork** the repository on GitHub
2. **Clone** your fork locally:
   ```bash
   git clone https://github.com/YOUR_USERNAME/LearnSphere_2.git
   cd LearnSphere_2
   ```
3. **Add the upstream remote** so you can sync changes:
   ```bash
   git remote add upstream https://github.com/omroy07/LearnSphere_2.git
   ```
4. **Set up environment variables** before running the backend:
   ```bash
   cp .env.example .env
   # Edit .env and add your GEMINI_API_KEY
   ```
5. **Install Python dependencies**:
   ```bash
   pip install -r requirements.txt
   ```
6. **Open `index.html`** in your browser or use the Live Server extension in VS Code.

---

## How to Contribute

> **Important:** Never commit directly to `main`. Always work on a feature branch.

### Step-by-Step Workflow

```bash
# 1. Sync your fork with upstream
git fetch upstream
git checkout main
git merge upstream/main

# 2. Create a focused branch
git checkout -b fix/descriptive-issue-name

# 3. Make your changes
# (keep changes focused — one issue per branch)

# 4. Stage and commit
git add <changed-files>
git commit -m "fix: describe what you fixed and why"

# 5. Push to your fork
git push origin fix/descriptive-issue-name

# 6. Open a Pull Request on GitHub
```

---

## Branch Naming Conventions

Use the following prefixes for consistency:

| Prefix | Purpose |
|--------|---------|
| `fix/` | Bug fixes |
| `feat/` | New features |
| `docs/` | Documentation improvements |
| `refactor/` | Code refactoring (no behaviour change) |
| `accessibility/` | Accessibility improvements |
| `perf/` | Performance improvements |
| `ci/` | CI/CD pipeline changes |
| `style/` | CSS/UI polish (no logic changes) |

**Examples:**
```
fix/navbar-mobile-overflow
feat/dark-mode-toggle
docs/improve-setup-guide
accessibility/add-aria-labels-forms
```

---

## Commit Message Guidelines

Follow the [Conventional Commits](https://www.conventionalcommits.org/) specification:

```
<type>(<scope>): <short description>

[optional body: why this change was made]
[optional footer: Closes #123]
```

**Types:** `fix`, `feat`, `docs`, `refactor`, `style`, `perf`, `ci`, `test`

**Examples:**
```
fix(auth): correct localStorage type mismatch on login redirect
feat(ui): add responsive hamburger menu for mobile navigation
docs(readme): add local setup instructions for Python backend
```

**Avoid:**
- `fixed issue`
- `update code`
- `changes`
- `final commit`

---

## Pull Request Guidelines

- **One concern per PR** — do not mix unrelated changes
- **Reference the issue** your PR resolves: `Closes #42`
- **Keep PRs small** — easier to review and merge
- **Describe your changes** in the PR description
- **Test your changes** before submitting:
  - Open `index.html` in a browser and verify the page works
  - Test on mobile viewport (DevTools responsive mode)
  - Check browser console for errors
- **Do not modify unrelated files** in your PR

---

## Development Setup

### Frontend (HTML/CSS/JS)

No build step required. Open `index.html` directly in a browser, or use:

```bash
# Option A: VS Code Live Server extension (recommended)
# Right-click index.html → "Open with Live Server"

# Option B: Python simple HTTP server
python -m http.server 8080
# Then visit http://localhost:8080
```

### Backend (Python/Flask Chatbot)

```bash
# 1. Create and activate a virtual environment
python -m venv venv
source venv/bin/activate   # Linux/Mac
venv\Scripts\activate      # Windows

# 2. Install dependencies
pip install -r requirements.txt

# 3. Set your API key
export GEMINI_API_KEY="your_key_here"  # Linux/Mac
set GEMINI_API_KEY=your_key_here       # Windows

# 4. Run the Flask server
python chatbot.py
# Backend runs at http://127.0.0.1:5000
```

---

## Reporting Bugs

Use the [Bug Report issue template](.github/ISSUE_TEMPLATE/bug_report.md) and include:

- Steps to reproduce
- Expected vs actual behaviour
- Browser/OS information
- Console error messages (if any)
- Screenshots (if UI-related)

---

## Suggesting Features

Use the [Feature Request issue template](.github/ISSUE_TEMPLATE/feature_request.md) and include:

- Problem you're solving
- Proposed solution
- Alternatives you've considered
- Any additional context

---

## Questions?

If you have questions about contributing, feel free to open a [Discussion](https://github.com/omroy07/LearnSphere_2/discussions) or comment on the relevant issue.

We appreciate every contribution, big or small. Thank you! 🙏
