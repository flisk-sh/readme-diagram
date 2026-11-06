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

## One-click pull request

The result page has an "Open a pull request for me" button once three secrets are set. It signs the user in with GitHub (OAuth, scope `public_repo`), forks the repo if the user cannot push, commits the snippet under the README's first `# Title` on a new branch, and opens the PR. The token is used inside that one request and never stored; the sign-in state is an HMAC-signed value tied to a cookie. Without the secrets the button is hidden and the copy flow stays.

Set it up once:

1. Create an OAuth App (github.com/settings/developers, or the `flisk-sh` org settings): homepage `https://diagram.flisk.si`, callback URL `https://diagram.flisk.si/auth/callback`.
2. Add its credentials to the Worker:

```bash
npx wrangler@4 secret put GH_CLIENT_ID
npx wrangler@4 secret put GH_CLIENT_SECRET
```

`STATE_SECRET` is a random string used to sign the sign-in state (already set on the live Worker; generate your own with `openssl rand -hex 32`).
