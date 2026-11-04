# Life in Weeks

Your whole life on one page: one square per week, one row per year, 90 years.

Inspired by Tim Urban's [Your Life in Weeks](https://waitbutwhy.com/2014/05/life-weeks.html) on Wait But Why.

## Local-first, by design

Life in Weeks is a static web page. There is no server, no database and no account.

- Everything runs in your browser.
- Your birthday (and, later, your important weeks and theme) is saved in your browser's `localStorage` under the key `liw:v1`. It never leaves your device.
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

The date math and storage layer have unit tests that use Node's built-in test runner (Node 20 or later):

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
  js/app.js      rendering and events for the home page
  js/weeks.js    pure date math for the grid (no DOM)
  js/storage.js  localStorage read/write
test/            unit tests (node --test)
```

## Status

This first version is the home page: the week grid and a birthday prompt. The Settings screen from the design is next. It covers picking the theme and adding important weeks. The home page already shows important weeks and the saved theme from storage.
