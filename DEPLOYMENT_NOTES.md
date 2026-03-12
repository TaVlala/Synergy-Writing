# Penwove Project Recap

This file is a high-level handoff and reference note for the current state of the project, what has already been built, and the most important deployment details.

## Project summary

Penwove is a collaborative writing platform built for shared rooms where multiple users can write, comment, react, chat, and manage contributions in real time.

Core stack:

- Frontend: React 18 + Vite
- Backend: Node.js + Express
- Realtime: Socket.io
- Editor: Tiptap rich text editor
- Storage: JSON file database in `server/data/db.json`
- Deployment: Railway

## Main product capabilities

The project currently supports:

- User registration and login with JWT-based auth
- Persistent user identity and profile details
- Room creation and room joining
- Room member management, including removal and entry lock behavior
- Realtime presence updates
- Realtime typing and cursor updates
- Rich-text contributions with moderation flow
- Contribution approval, rejection, pinning, editing, deleting, and reordering
- Comment threads on contributions
- Reactions on contributions
- Room chat
- Notifications for replies, comments, and new contributions
- EPUB export from room content
- Mini-games and 1v1 game challenge flow in rooms

## UI and UX work completed

A substantial amount of UI modernization has already been done.

Highlights:

- The branding was moved away from the older purple direction into a more oceanic visual style
- Shared design language was introduced across header controls, cards, and interactive panels
- The home and room experiences were visually polished
- Mobile responsiveness was improved, including stacked controls for smaller screens
- The export experience was upgraded into a richer menu-based flow
- Rich editor capabilities were expanded with support for links and images
- Auth pages now show only user-relevant information and no longer display the internal `JWT_SECRET` warning text

## Collaboration and writing workflow completed

The collaborative writing flow already includes:

- Room-level access and membership handling
- Contribution submission and moderation states
- Approved contribution ordering
- Presence tracking for online users
- Cursor broadcasting over sockets
- Chat and notifications for collaboration awareness
- Inline and threaded feedback patterns through comments

## Game system completed

The room experience also includes game/challenge functionality.

Known flow:

- `game:challenge`
- `game:challenge:received`
- `game:challenge:respond`
- `game:challenge:accepted`
- `game:challenge:declined`
- `game:result`

Mini-game components referenced in the repo include:

- `WordleGame.jsx`
- `HangmanGame.jsx`
- `WordLadder.jsx`

## Important files

Key project files to know:

- `client/src/App.jsx` — app shell, auth context, routing
- `client/src/pages/Auth.jsx` — login and registration screen
- `client/src/pages/Start.jsx` — entry/dashboard page after auth
- `client/src/pages/Room.jsx` — main room state, API usage, socket wiring, room workflow
- `client/src/components/RoomHeader.jsx` — room header and controls
- `client/src/components/RichEditor.jsx` — rich text editor behavior
- `server/index.js` — backend routes, auth, sockets, notifications, export endpoint
- `server/db.js` — file-based persistence helpers
- `server/data/db.json` — runtime data store, not meant to be committed as source-of-truth app code
- `railway.json` — Railway build and start configuration
- `package.json` — root manifest used by production installs
- `server/package.json` — backend-local package manifest

## Important implementation notes

A few details are easy to forget and are important for future work:

- The localStorage key for the current user is `collab_user`
- Auth uses JWTs signed by `JWT_SECRET`
- The backend uses `express.json({ limit: '10mb' })`, which matters for richer content and export payloads
- Member objects use fields like `user_id`, `user_name`, and `user_color`
- The app depends on real-time socket events for presence, cursor updates, chat, notifications, and game challenges

## Recent fixes completed

Recent work completed on this branch includes:

### 1. Removed internal JWT message from auth UI

The login/signup page used to display this user-facing text:

`In production, set JWT_SECRET.`

That message was an internal deployment reminder and should not appear in the user interface. It has been removed from `client/src/pages/Auth.jsx`.

### 2. Fixed Railway production dependency issue

A production crash occurred because Railway started the app with:

```sh
node server/index.js
```

But the root `package.json` did not include all runtime packages required by `server/index.js`.

This caused errors such as:

`Cannot find module 'bcryptjs'`

To fix that, the root `package.json` was updated so the production/root install includes the runtime dependencies needed by the backend entrypoint.

Important packages now included at the root:

- `bcryptjs`
- `jsonwebtoken`
- `epub-gen-memory`
- `express`
- `socket.io`
- `cors`
- `sanitize-html`
- `uuid`

## Deployment notes

### Railway behavior

Current Railway config builds with:

```sh
npm run install:all && npm run build
```

And starts with:

```sh
node server/index.js
```

Because the app starts from the repo root, any runtime dependency needed by `server/index.js` must exist in the root `package.json`, not only in `server/package.json`.

If production fails with `Cannot find module ...`, check the root manifest first.

### Environment variables

Production should set at least:

- `JWT_SECRET`
- `CORS_ORIGINS` as needed for frontend origin control

`JWT_SECRET` is required for secure token signing in production.

If it is missing, the server currently falls back to a development secret. That fallback is acceptable for local development only and should not be relied on in real production.

## Recommended future cleanup

These would be good future improvements:

- Reduce duplication between root and `server/package.json`
- Consider a clearer monorepo/deploy strategy so production installs are less error-prone
- Add a dedicated deployment checklist for Railway variables and install expectations
- Add smoke tests for auth startup and server boot in production-like environments
- Document room moderation and contribution status flows in more detail

## Current branch reference

Recent commits related to this recap:

- `833ec91` — Remove JWT warning from auth page
- `71095af` — Add missing server runtime dependencies
- `153d5c1` — Add deployment reference notes
