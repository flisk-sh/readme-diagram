# readme-diagram

Turn any GitHub README into an animated SVG diagram. No LLM: it reads headings, code fences and the stack the README mentions, then draws the same three-card layout as Flisk's ecosystem diagram.

- `GET /<owner>/<repo>.svg` renders a repo's diagram (cached a day at the edge).
- `POST /render` with Markdown in the body returns the SVG.
- `/` is a preview page with a copy-snippet button and an "Open README on GitHub" link.

```bash
npm test
npm run dev
```

Update the golden file after an intended visual change: `UPDATE_GOLDEN=1 npm test`.
