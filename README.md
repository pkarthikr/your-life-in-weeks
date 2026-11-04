# Life in Weeks

Your whole life on one page: one square per week, one row per year, 100 years.

Inspired by Tim Urban's [Your Life in Weeks](https://waitbutwhy.com/2014/05/life-weeks.html) on Wait But Why.

## Local-first, by design

Life in Weeks is a static web page. There is no server, no database and no account.

- Everything runs in your browser.
- Your birthday, your important weeks and your theme are saved in your browser's `localStorage` under the key `liw:v1`. They never leave your device.
- A different browser or device starts fresh. Clearing this site's data in your browser deletes everything.
- **Post as a story** draws its picture in your browser too. Nothing is uploaded; you save or share the picture yourself.

The only network requests are for the page's own files. That includes the Geist fonts, which are served with the site rather than from Google Fonts.

## Run it locally

No build step and no dependencies. Serve the `site/` folder with any static file server, for example:

```bash
npm start
```

That runs `python3 -m http.server 8000 --directory site`. Then open http://localhost:8000.

(Opening `site/index.html` straight from disk won't work, because browsers block JavaScript modules on `file://` URLs.)

## Tests

The date math, the Settings rules, the story picture's layout and drawing, and the storage layer have unit tests that use Node's built-in test runner (Node 20 or later):

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
  fonts/         Geist and Geist Mono (woff2), with their license in OFL.txt
  js/app.js      rendering and events for the Weeks and Settings screens
  js/weeks.js    pure date math for the grid (no DOM)
  js/colors.js   the colors an important week can have (their shades are in styles.css)
  js/settings.js pure rules for Settings: checking dates, adding and removing important weeks
  js/story.js    the story picture: its layout and canvas drawing (no DOM)
  js/storage.js  localStorage read/write
test/            unit tests (node --test)
```

## Screens

Both screens are on one page; the address picks which one shows, so the browser's back button and reload work as expected.

- **Weeks** (`#weeks`, the default): the 100-year grid. Important weeks show in the color you picked for them; hover one for details. If two important dates fall in the same week, the square takes the earlier one's color. The week you were born, the first square, has a ring in the this-week color; hover it to see your birthday. If it is also an important week, it keeps that week's color inside the ring. Before a birthday is saved, it asks you to add one.
  - **Post as a story** makes a 1080 × 1920 PNG of your whole grid, sized for Instagram stories, in your current theme. Save it, or, where the browser supports sharing files (most phones), share it straight to Instagram or Photos. Important weeks show in their colors but their labels are left off, since the picture is meant to be posted. The week you were born is ringed, as on the page. The site's address is printed at the bottom so friends can make their own.
- **Settings** (`#settings`): your birthday, the light or dark theme, and your important weeks (add a date, what happened and a color, or remove one). Every change is saved straight away, in this browser only.

### Colors for important weeks

There are six: Blue (the default, and the color of weeks added before colors existed), Violet, Pink, Red, Green and Teal. Each has its own shade per theme, picked to stay distinct from the others and from the lived, ahead and this-week squares. To change a shade, edit its `--c-<color>` token in both theme blocks at the top of `styles.css`; to add a color, add it to `js/colors.js` and give it a token in each theme and a `.c-<color>` class (a test checks that none are missing).

The week you were born is marked with a ring rather than a seventh color. With six important-week colors plus the lived, ahead and this-week squares, no further hue stayed clearly apart from all of them in both themes, including for color-blind readers.
