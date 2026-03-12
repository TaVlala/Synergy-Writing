# Deployment Notes

## Railway / production startup

The production service starts with:

```sh
node server/index.js
```

Because of that, the root `package.json` must include the runtime dependencies required by `server/index.js`.

Important packages currently needed at the repo root:

- `bcryptjs`
- `jsonwebtoken`
- `epub-gen-memory`
- `express`
- `socket.io`
- `cors`
- `sanitize-html`
- `uuid`

If a deploy fails with `Cannot find module 'bcryptjs'` or a similar error, first check whether the missing package exists in the root `package.json`, not only in `server/package.json`.

## Auth secret

Production must set `JWT_SECRET` as an environment variable.

The server currently falls back to a development secret when `JWT_SECRET` is missing, which is acceptable for local development but not for a real deployment.

## UI note

The old auth-page text `In production, set JWT_SECRET.` was removed from the user-facing login/signup screen and should stay as an internal deployment note only.
