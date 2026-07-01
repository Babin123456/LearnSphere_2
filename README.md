# 📚 LearnSphere — The Ultimate Learning Hub

<div align="center">

![LearnSphere Banner](img/home.png)

[![GitHub Stars](https://img.shields.io/github/stars/omroy07/LearnSphere_2?style=flat-square&color=00d9ff)](https://github.com/omroy07/LearnSphere_2/stargazers)
[![GitHub Forks](https://img.shields.io/github/forks/omroy07/LearnSphere_2?style=flat-square&color=007bff)](https://github.com/omroy07/LearnSphere_2/network)
[![GitHub Issues](https://img.shields.io/github/issues/omroy07/LearnSphere_2?style=flat-square&color=ff6b6b)](https://github.com/omroy07/LearnSphere_2/issues)
[![Contributions Welcome](https://img.shields.io/badge/contributions-welcome-brightgreen?style=flat-square)](CONTRIBUTING.md)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow?style=flat-square)](LICENSE)

**An AI-powered educational platform for Physics, Maths, Chemistry, and Biology — with interactive simulations, quizzes, and a built-in AI tutor.**

[🚀 Quick Start](#-getting-started) · [📖 Features](#-features) · [🗂️ Architecture](#️-project-architecture) · [🤝 Contribute](CONTRIBUTING.md)

</div>

---

## 🌟 About LearnSphere

**LearnSphere** is a static educational web platform designed to make high-quality science and maths education accessible to every student. It combines:

- **Interactive physics/chemistry/maths simulations** with real-time animations
- **Subject-specific quizzes** with progress tracking
- **An AI Tutor chatbot** powered by Google Gemini
- **Study progress tracking** that persists across sessions
- **Dark/Light mode** with system preference detection

---

## 🎯 Features

| Feature | Description |
|---------|-------------|
| 🤖 **AI Tutor** | Google Gemini-powered chatbot for instant answers |
| 📊 **Progress Tracking** | LocalStorage-backed topic completion with visual progress bar |
| 🎮 **Interactive Simulations** | Motion, Projectile, NLM, Ray Optics, Chemical Bonding, Thermodynamics |
| 🧪 **Subject Quizzes** | Multiple-choice quizzes for Physics chapters |
| 🌙 **Dark / Light Mode** | Persistent theme toggle with system preference fallback |
| 📱 **Responsive Design** | Mobile hamburger menu, fluid layouts |
| ♿ **Accessible** | ARIA labels, keyboard navigation, screen reader support |
| 🔒 **Secure** | Environment-variable API key management, XSS-safe chatbot |

---

## 🗂️ Project Architecture

For a contributor-focused module map and data-flow notes, see
[docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

```
LearnSphere_2/
│
├── index.html              ← Landing page (entry point)
├── home.html               ← Dashboard (subject nav, progress, chatbot)
│
├── sub/                    ← Subject hub pages
│   ├── physics.html
│   ├── chemistry.html
│   ├── maths.html
│   └── biology.html
│
├── motion/                 ← Physics: Motion (simulation + theory + quiz link)
├── nlm/                    ← Physics: Newton's Laws
├── projectile/             ← Physics: Projectile Motion
├── ray/                    ← Physics: Ray Optics
├── atomic_structure/       ← Chemistry: Atomic Structure
├── chemical_bonding/       ← Chemistry: Chemical Bonding
├── equilibrium/            ← Chemistry: Equilibrium
├── thermo/                 ← Chemistry: Thermodynamics
├── calculus/               ← Maths: Calculus
├── probability/            ← Maths: Probability
├── geometry/               ← Maths: Geometry
├── vector3d/               ← Maths: Vectors & 3D Geometry
│
├── quiz/                   ← Quiz pages for each Physics chapter
│   ├── motionquiz.html/js/css
│   ├── nlmquiz.html/js/css
│   ├── projectilequiz.html/js/css
│   └── rayquiz.html/js/css
│
├── log/                    ← Authentication pages
│   ├── login.html/css/js
│   └── register.html
│
├── chatbot.py              ← Flask backend for AI Tutor (Google Gemini)
├── progress.js             ← Study progress tracker module
├── theme.js                ← Dark/light mode manager
├── styles.css              ← Global stylesheet (shared by navbar pages)
│
├── .env.example            ← Environment variable template
├── requirements.txt        ← Python dependencies
├── .gitignore              ← Git ignore rules
├── CONTRIBUTING.md         ← Contributor guide
└── 404.html                ← Custom error page
```

---

## 🖥️ Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | HTML5, CSS3, Vanilla JavaScript |
| Backend (AI Tutor) | Python 3, Flask, flask-cors |
| AI Engine | Google Gemini 1.5 Pro (via `google-generativeai`) |
| Data Persistence | Browser localStorage (progress, theme, auth) |
| CI/CD | GitHub Actions (HTML validation, secret scanning) |

---

## 🚀 Getting Started

### Prerequisites

- A modern web browser (Chrome, Firefox, Safari, Edge)
- Python 3.8+ (only needed for the AI Tutor chatbot)
- A [Google Gemini API key](https://makersuite.google.com/app/apikey) (free tier available)

### 1️⃣ Clone the Repository

```bash
git clone https://github.com/omroy07/LearnSphere_2.git
cd LearnSphere_2
```

### 2️⃣ Run the Frontend

No build step required — open directly in your browser:

```bash
# Option A: Open index.html directly
start index.html         # Windows
open index.html          # macOS
xdg-open index.html      # Linux

# Option B: Python simple HTTP server (recommended)
python -m http.server 8080
# Then visit: http://localhost:8080
```

> **Tip:** Use the **Live Server** extension in VS Code for auto-reload during development.

### 3️⃣ Run the AI Tutor Backend (Optional)

The chatbot requires the Flask backend to be running:

```bash
# 1. Create a virtual environment
python -m venv venv
source venv/bin/activate   # Linux/Mac
venv\Scripts\activate      # Windows

# 2. Install dependencies
pip install -r requirements.txt

# 3. Set your API key (NEVER hardcode it in source)
cp .env.example .env
# Edit .env and add your GEMINI_API_KEY

# 4. Load environment and start server
export GEMINI_API_KEY="your_key_here"   # Linux/Mac
set GEMINI_API_KEY=your_key_here        # Windows

python chatbot.py
# Backend available at: http://127.0.0.1:5000
```

---

## 📸 Screenshots

| Home | Dashboard | Physics |
|------|-----------|---------|
| ![Home](img/home.png) | ![Courses](img/Course.png) | ![Physics](img/physics.png) |

---

## 🤝 Contributing

Contributions are warmly welcomed! Please read [CONTRIBUTING.md](CONTRIBUTING.md) for:

- Branch naming conventions
- Commit message format (Conventional Commits)
- PR guidelines
- Development setup instructions

**Quick steps:**
```bash
git checkout -b fix/your-issue-name
# ... make focused changes ...
git commit -m "fix: describe what and why"
git push origin fix/your-issue-name
# Open a Pull Request on GitHub
```

---

## 📄 License

This project is open source under the [MIT License](LICENSE).

---

<div align="center">

Made with ❤️ for learners everywhere · [Report a Bug](https://github.com/omroy07/LearnSphere_2/issues/new?template=bug_report.md) · [Request a Feature](https://github.com/omroy07/LearnSphere_2/issues/new?template=feature_request.md)

</div>
