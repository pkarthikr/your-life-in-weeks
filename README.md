# Life in Weeks

Your whole life on one page: one square per week, one row per year, 100 years.

Inspired by Tim Urban's [Your Life in Weeks](https://waitbutwhy.com/2014/05/life-weeks.html) on Wait But Why.

## Local-first, by design

Life in Weeks is a static web page. There is no server, no database and no account.

- Everything runs in your browser.
- Your birthday, your important weeks and your theme are saved in your browser's `localStorage` under the key `liw:v1`. They never leave your device.
- A different browser or device starts fresh. Clearing this site's data in your browser deletes everything.

The only network requests are for the page's own files and the Geist fonts from Google Fonts.

## Run it locally

No build step and no dependencies. Serve the `site/` folder with any static file server, for example:

```bash
npm start
```

That runs `python3 -m http.server 8000 --directory site`. Then open http://localhost:8000.

(Opening `site/index.html` straight from disk won't work, because browsers block JavaScript modules on `file://` URLs.)

## Tests

The date math, the Settings rules and the storage layer have unit tests that use Node's built-in test runner (Node 20 or later):

```bash
npm test
```

## Deploy to GitHub Pages

`.github/workflows/pages.yml` runs the tests on every push and pull request. On the default branch, it then publishes `site/` to GitHub Pages.

One-time setup: in the repository on GitHub, go to **Settings → Pages**. Under **Build and deployment**, set **Source** to **GitHub Actions**. Then push to the default branch, or run the workflow by hand from the **Actions** tab. The site appears at `https://<owner>.github.io/<repo>/`.

## Project layout

```
site/            the whole app, served as-is
  index.html     page markup
  styles.css     styles and the light and dark theme tokens
  favicon.svg
  js/app.js      rendering and events for the Weeks and Settings screens
  js/weeks.js    pure date math for the grid (no DOM)
  js/settings.js pure rules for Settings: checking dates, adding and removing important weeks
  js/storage.js  localStorage read/write
test/            unit tests (node --test)
```

## Screens

Both screens are on one page; the address picks which one shows, so the browser's back button and reload work as expected.

- **Weeks** (`#weeks`, the default): the 100-year grid. Important weeks are highlighted; hover one for details. Before a birthday is saved, it asks you to add one.
- **Settings** (`#settings`): your birthday, the light or dark theme, and your important weeks (add a date and what happened, or remove one). Every change is saved straight away, in this browser only.
