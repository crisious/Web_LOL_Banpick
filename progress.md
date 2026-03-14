Original prompt: 밴픽 방송 화면 와이어프레임 구현

- TODO: Build a static broadcast wireframe from scratch because the workspace started empty.
- TODO: Add a lightweight interactive draft timeline and testing hooks for deterministic inspection.
- Added index.html, styles.css, and main.js with a full broadcast wireframe, draft phase timeline, live timer, Fearless memory board, and keyboard controls.
- Updated the draft timeline interaction to use event delegation so phase chips still work after repeated rerenders.
- Verified the page serves over a local Python HTTP server and confirmed `/`, `/main.js`, and `/styles.css` respond successfully.
- Environment note: Node, npm, Playwright, and a local WebDriver listener were not available, so the usual automated browser loop could not be run in this workspace.
- Added a shared `draft-state.js` store backed by `localStorage` so the broadcast page and a new `admin.html` control room can stay in sync.
- Reworked `main.js` to read/write shared draft state and added an admin link on the broadcast page footer.
- Added `admin.html`, `admin.css`, and `admin.js` with live controls, series meta editing, active phase editing, and full team roster / pick / ban / fearless editors.
- Verified local serving for `/`, `/admin.html`, `/draft-state.js`, `/admin.js`, and `/admin.css` via the Python HTTP server.
- Verification run: used headless Chrome via the DevTools protocol to load both pages, inspect `window.render_game_to_text()`, confirm the timer counts down, verify pause / next-turn / previous-turn / reset-timer keyboard controls, and confirm admin edits sync to the broadcast page through `localStorage`.
- Verification run: captured screenshots in `test-artifacts/` including `broadcast-initial.png`, `admin-initial.png`, `broadcast-synced-visible.png`, and `admin-synced-visible.png`, then visually checked the layouts.
- Verification run: listened for runtime exceptions and console warnings/errors on both `/` and `/admin.html`; none were reported in the headless browser session.
