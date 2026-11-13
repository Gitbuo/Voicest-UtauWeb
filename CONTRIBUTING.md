# Contributing

1. Fork or branch from `main`, then `npm install`.
2. Make your change. The editor lives in `public/voicest.html`; new user-facing text goes through `AX(key, vi, en, ja, zh, ko)` / `_T(key)` so it follows the interface language (English is the default). Code comments and docs are written in English.
3. Run `npm run lint`, `npm test` and `npm run build` before opening a pull request. CI runs the same checks.
4. Do not commit voicebanks or other large binaries unless they are meant to be published on the Pages site.
