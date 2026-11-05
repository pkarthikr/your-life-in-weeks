# Life in Weeks

Your whole life on one page: one square per week, one row per year, 100 years.

Inspired by Tim Urban's [Your Life in Weeks](https://waitbutwhy.com/2014/05/life-weeks.html) on Wait But Why.

## Local-first, by design

Life in Weeks is a static web page. There is no server, no database and no account.

- Everything runs in your browser.
- Your birthday, your chapters, your important weeks and your theme are saved in your browser's `localStorage` under the key `liw:v1`. They never leave your device.
- A different browser or device starts fresh. Clearing this site's data in your browser deletes everything.
- The share pictures (Settings → **Share your weeks**) are drawn in your browser too. Nothing is uploaded; you save or share the picture yourself.

The only network requests are for the page's own files. That includes the Geist fonts, which are served with the site rather than from Google Fonts.

## Run it locally

No build step and no dependencies. Serve the `site/` folder with any static file server, for example:

```bash
npm start
```

That runs `python3 -m http.server 8000 --directory site`. Then open http://localhost:8000.

(Opening `site/index.html` straight from disk won't work, because browsers block JavaScript modules on `file://` URLs.)

## Tests

The date math (including where chapters fall), the Settings rules, the share pictures' layout and drawing, and the storage layer have unit tests that use Node's built-in test runner (Node 20 or later):

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
  js/weeks.js    pure date math for the grid, including where chapters fall (no DOM)
  js/colors.js   the colors a chapter or important week can have (their shades are in styles.css)
  js/settings.js pure rules for Settings: checking dates, adding and removing chapters and important weeks
  js/picture.js  the share pictures: their formats, layout and canvas drawing (no DOM)
  js/storage.js  localStorage read/write
test/            unit tests (node --test)
```

## Screens

Both screens are on one page; the address picks which one shows, so the browser's back button and reload work as expected.

- **Weeks** (`#weeks`, the default): the 100-year grid. Chapters color their stretch of weeks, and a line under the legend names each one. Important weeks show in the color you picked for them, over any chapter. Hover a chapter's week or an important week for details. If two important dates fall in the same week, the square takes the earlier one's color. The week you were born, the first square, has a ring in the this-week color; hover it to see your birthday. Inside the ring it keeps its own color: lived, its chapters' or an important week's. Before a birthday is saved, it asks you to add one.
- **Settings** (`#settings`): your birthday, the light or dark theme, your chapters (add when one began, when it ended or nothing if it's still going, a name and a color, or remove one), and your important weeks (add a date, what happened and a color, or remove one). Every change is saved straight away, in this browser only.
  - **Share your weeks** makes a PNG of your whole grid in your current theme, sized for where you'll post it. Save it, or, where the browser supports sharing files (most phones), share it straight to the app. It needs a birthday first.

### Chapters

A chapter is a stretch of weeks: college, a job, the years in a city, a relationship. It has a start date and an end date. With no end date it is still going, and it runs up to this week, growing as the weeks pass.

- Its lived weeks take its color. Its weeks ahead (a chapter you've planned, or the rest of one that ends in the future) get a faded tint of it, so the line between lived and ahead still shows.
- This week and important weeks show over chapters. An important week inside a chapter has a gap of background around it, so it stands out even in the chapter's own color.
- Chapters can overlap: a job while living in a city while in a relationship. Each chapter keeps a lane for all its weeks (the first free one when it begins; one that begins with or inside another takes the lane after it). A week in several chapters is split into a stripe of each, in lane order: stacked on the page, where years are rows, and side by side in pictures where years are columns, so a chapter always reads as one band along time. A week shows at most three chapters (`CHAPTERS_PER_WEEK` in `js/weeks.js`); its popover lists them all.
- Chapters use the same date fields, calendar limits and color picker as important weeks. The picker offers the color the fewest chapters have, so chapters added one after another come out in different colors unless you pick one.
- A chapter that starts before your birthday or runs past the end of the grid (say, after you change your birthday) is cut off at the edges of the grid.

### Share pictures

| Button | Size | Grid |
|---|---|---|
| Instagram story | 1080 × 1920 (9:16) | one row per year, as on the page |
| Instagram post | 1080 × 1350 (4:5) | one column per year, life running left to right |
| LinkedIn post | 1200 × 1200 (1:1) | one column per year |
| X / Twitter post | 1600 × 900 (16:9) | one column per year |

Each picture has the weeks lived and ahead, the grid with ages every ten years, a legend and the site's address, so friends can make their own. The grid fills the picture's width, so weeks can come out wider than they are tall. Chapters and important weeks show in their colors, as on the page, but their names are left off, since the picture is meant to be posted; the legend shows one swatch per color under **Chapter** and **Important week**. The week you were born is ringed, as on the page. The story keeps its text clear of the top and bottom, where Instagram draws the poster's name and the reply bar.

To add a format, add an entry to `FORMATS` in `js/picture.js` (its size, margins, type sizes and which way the grid runs); its button and layout follow from that.

### Colors for chapters and important weeks

There are six, shared by chapters and important weeks: Blue (the default, and the color of weeks added before colors existed), Violet, Pink, Red, Green and Teal. Each has its own shade per theme, picked to stay distinct from the others and from the lived, ahead and this-week squares. How much of a chapter's color shows in its weeks ahead is the `--tint` token in each theme block. To change a shade, edit its `--c-<color>` token in both theme blocks at the top of `styles.css`; to add a color, add it to `js/colors.js` and give it a token in each theme and a `.c-<color>` class (a test checks that none are missing).

The week you were born is marked with a ring rather than a seventh color. With six important-week colors plus the lived, ahead and this-week squares, no further hue stayed clearly apart from all of them in both themes, including for color-blind readers.
