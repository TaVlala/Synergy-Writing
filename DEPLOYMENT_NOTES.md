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

- `client/src/App.jsx` - app shell, auth context, routing
- `client/src/pages/Auth.jsx` - login and registration screen
- `client/src/pages/Start.jsx` - entry/dashboard page after auth
- `client/src/pages/Room.jsx` - main room page orchestration
- `client/src/hooks/useRoomData.js` - room data loading and membership bootstrap
- `client/src/hooks/useRoomSocket.js` - socket lifecycle, presence, notifications, game challenge flow
- `client/src/hooks/useRoomExports.js` - export handlers for txt/pdf/docx/epub
- `client/src/components/RoomHeader.jsx` - room header and controls
- `client/src/components/RichEditor.jsx` - rich text editor behavior
- `client/src/lib/api.js` - shared JSON/fetch helpers
- `server/index.js` - backend entrypoint and route wiring
- `server/routes/auth.js` - auth and user profile routes
- `server/routes/rooms.js` - room, member, and chat routes
- `server/routes/contributions.js` - contribution, comment, moderation, reorder, and reaction routes
- `server/routes/notifications.js` - notification routes
- `server/routes/export.js` - EPUB export route
- `server/lib/auth.js` - token/auth helpers
- `server/lib/sanitize.js` - HTML sanitization
- `server/lib/config.js` - env/config handling
- `server/socket.js` - socket event wiring
- `server/db.js` - file-based persistence helpers
- `server/data/db.json` - runtime data store, not meant to be committed as source-of-truth app code
- `railway.json` - Railway build and start configuration
- `package.json` - root manifest used by production installs
- `server/package.json` - backend-local package manifest

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

### 3. Modernization pass

A broader maintainability update was also completed.

Frontend improvements:

- `Room.jsx` was reduced from a monolithic page into a smaller orchestrator backed by dedicated hooks
- Shared room responsibilities were extracted into `useRoomData`, `useRoomSocket`, and `useRoomExports`
- Shared JSON request handling was centralized in `client/src/lib/api.js`
- The room page now uses deferred contribution/notification rendering for smoother updates under heavier state churn
- The `USER_COLORS` drift in the room page was removed in favor of the shared `APP_COLORS`
- Export menu outside-click behavior and collaboration auto-scroll were preserved after the refactor

Editor improvements:

- Rich editor link support is now backed by the Tiptap `Link` extension instead of relying on commands without the extension configured
- Image insertion no longer uses `window.prompt`; it now uses the same in-editor popover style as links
- Thesaurus requests now use `AbortController` so repeated lookups do not race each other as badly
- A few legacy imports and rougher UI labels were cleaned up

Backend improvements:

- The single large `server/index.js` file was split into smaller route and helper modules
- Auth, config, sanitization, notifications, socket wiring, rooms, contributions, exports, and notifications now live in their own files
- Production config warnings are centralized in `server/lib/config.js`
- Socket authentication was moved behind dedicated helpers instead of being embedded in the entry file

### 4. Thesaurus stability and visibility fixes

The rich editor thesaurus flow went through several rounds of production hardening.

Work completed:

- fixed broken selection handling in the editor so the `Syn` action could still use the last valid text selection
- moved thesaurus lookup behind a backend proxy route at `server/routes/thesaurus.js` instead of calling Datamuse directly from the browser
- disabled caching for thesaurus requests after production returned `304 Not Modified` responses that prevented fresh synonym payloads from being used reliably
- removed duplicate Tiptap `link` and `underline` extension registration warnings by configuring `StarterKit` to skip those explicit extensions
- stabilized thesaurus popup visibility by clamping the panel position and raising its layering above surrounding room UI
- changed thesaurus targeting so multi-word selections resolve to a real word token instead of querying the whole phrase, improving results for cases like a selection ending in `hello`

Important takeaway:

The thesaurus issue was not one single bug. It involved selection persistence, production request path behavior, response caching, duplicate editor extensions, popup visibility, and word-targeting behavior.

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
- Add a real frontend test/build CI step with dependencies installed in the environment

## Current branch reference

Recent commits related to this recap:

- `833ec91` - Remove JWT warning from auth page
- `71095af` - Add missing server runtime dependencies
- `153d5c1` - Add deployment reference notes
- `8c6ee39` - Expand project recap notes
- `b050c93` - Fix thesaurus selection handling
- `4434cf0` - Fix thesaurus lookup in production
- `2ca7587` - Disable thesaurus response caching
- `fa111c3` - Remove duplicate Tiptap extensions
- `86e4168` - Keep thesaurus popover visible
- `5fbd0d9` - Stabilize thesaurus word targeting