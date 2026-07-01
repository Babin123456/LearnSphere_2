# LearnSphere Architecture Overview

LearnSphere is a mostly static learning platform built with HTML, CSS, and
vanilla JavaScript. The optional AI tutor runs as a small Flask service, but the
core learning, quiz, progress, and offline flows work in the browser.

## Runtime Shape

- Static pages such as `index.html`, `home.html`, `courses.html`, and subject
  pages render the public learning experience.
- Topic folders such as `motion/`, `calculus/`, and `chemical_bonding/` hold
  module-specific simulations, styles, and learning content.
- Quiz folders are split by subject:
  - `quiz/` for physics quizzes and shared adaptive quiz helpers.
  - `mathsquiz/` for mathematics quizzes.
  - `chemistryquiz/` for chemistry quizzes.
- `chatbot.py` exposes the optional AI tutor endpoints and uses
  `GEMINI_API_KEY` from the server environment.

## Shared Browser Modules

- `theme.js` manages the persisted dark/light theme and offline badge.
- `navbar.js` controls the shared responsive navigation menu.
- `progress.js` stores topic progress, review scheduling, XP, streaks, and daily
  learning goal state.
- `quizProgress.js` stores quiz attempts, per-topic aggregates, skill mastery,
  recommendations, and retry history.
- `dashboardProgress.js` renders read-only analytics for parent and teacher
  dashboard views.
- `assignmentBuilder.js` powers teacher-created assignments and local
  submission analytics.
- `offlineSync.js` queues progress events while offline so a future backend can
  sync them without changing quiz callers.
- `sw.js` caches the app shell and quiz practice assets for offline use.

## Persistence Model

The current app intentionally uses browser `localStorage` for demo-mode data:

- `learnsphere_progress` stores topic-level progress and XP.
- `learnsphere_quiz_progress_v1` stores quiz attempts, mastery, and streak data.
- `learnsphere_streak_state_v1` stores the unified daily goal and streak state.
- `learnsphere_review_schedule_v1` stores spaced review dates.
- `learnsphere_assignments` and `learnsphere_assignment_submissions` store the
  teacher assignment workflow.
- `learnsphere_offline_queue_v1` stores queued offline progress sync events.

Because the data is local to a browser profile, it should not be treated as a
trusted source for grading or identity. Any future server sync should validate
payloads server-side.

## Offline Flow

The service worker caches the static app shell and quiz practice assets during
installation. Runtime caching handles same-origin scripts, styles, HTML, JSON,
and image assets. `offlineSync.js` keeps quiz progress writes local-first and
can flush queued entries to `/api/sync-progress` when a backend endpoint is
added.

## Adding New Learning Content

1. Create a topic page folder with its own HTML, CSS, and JS when the simulation
   is topic-specific.
2. Add quiz content to the relevant quiz folder.
3. Register the topic in `progress.js` and `quizProgress.js` if it should appear
   in dashboards, recommendations, analytics, or curriculum maps.
4. Update `curriculumMapConfig.js` when the topic participates in prerequisite
   relationships.
5. Add offline cache entries to `sw.js` only for files that exist in the repo.

## Contribution Boundaries

Keep contributions focused by ownership area:

- Navigation and global layout: `styles.css`, `navbar.js`, page headers.
- Theme tokens: `variables.css` and small page-specific overrides.
- Quiz behavior: one subject quiz family or one shared helper at a time.
- Progress and analytics: `progress.js`, `quizProgress.js`,
  `dashboardProgress.js`, and their direct consumers.
- Offline behavior: `sw.js` and `offlineSync.js`.
- AI tutor behavior: `chatbot.py`, `.env.example`, and backend setup docs.
