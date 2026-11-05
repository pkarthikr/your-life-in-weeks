# Life in Weeks

Your whole life on one page: one square per week, one row per year, for as many years as you choose to count (100 until you pick).

Inspired by Tim Urban's [Your Life in Weeks](https://waitbutwhy.com/2014/05/life-weeks.html) on Wait But Why.

## Local-first, by design

Life in Weeks is a static web page. There is no server, no database and no account.

- Everything runs in your browser.
- Your birthday, your chapters, your important weeks and your theme are saved in your browser's `localStorage` under the key `liw:v1`. They never leave your device unless you download a backup.
- A different browser or device starts fresh. Clearing this site's data in your browser deletes everything. Some browsers clear it for you: Safari deletes a site's saved data after seven days of use without a visit.
- So Settings → **Backup** can download everything as a JSON file, and restore it in any browser, on any device. The file goes from your browser to you and back; nothing is uploaded. See [Backups](#backups).
- The share pictures (Settings → **Share your weeks**) are drawn in your browser too. Nothing is uploaded; you save or share the picture yourself.

The only network requests are for the page's own files. That includes the Geist fonts, which are served with the site rather than from Google Fonts, and the author's photo in Settings → **About**, which is copied from Gravatar when the site is deployed (see below) so your browser never contacts Gravatar.

## Run it locally

No build step and no dependencies. Serve the `site/` folder with any static file server, for example:

```bash
npm start
```

That runs `python3 -m http.server 8000 --directory site`. Then open http://localhost:8000.

(Opening `site/index.html` straight from disk won't work, because browsers block JavaScript modules on `file://` URLs.)

## Tests

The date math (including where chapters fall), the Settings rules, the share pictures' layout and drawing, the storage layer, the backup files and the link-preview tags have unit tests that use Node's built-in test runner (Node 20 or later):

```bash
npm test
```

## Deploy to GitHub Pages

`.github/workflows/pages.yml` runs the tests on every push and pull request. On the default branch, it then publishes `site/` to GitHub Pages.

Before uploading `site/`, the deploy copies the author's Gravatar into it as `site/me.jpg`. The workflow holds the SHA-256 hash Gravatar looks the picture up by, not the email address. If the download fails, the deploy still goes ahead and the About card shows initials instead; it does the same when you run the site locally, since `me.jpg` isn't in the repository.

One-time setup: in the repository on GitHub, go to **Settings → Pages**. Under **Build and deployment**, set **Source** to **GitHub Actions**. Then push to the default branch, or run the workflow by hand from the **Actions** tab. The site appears at `https://<owner>.github.io/<repo>/`, or under your custom domain if you have one.

The link-preview tags in `index.html` name the site's address in full (link previews need absolute addresses). If you deploy it somewhere else, see [Link previews](#link-previews).

## Project layout

```
site/            the whole app, served as-is
  index.html     page markup
  styles.css     styles and the light and dark theme tokens
  favicon.svg
  me.jpg         the author's photo, added by the deploy (not in the repository)
  link-preview.png  the picture link previews show, drawn by scripts/link-preview.mjs
  fonts/         Geist and Geist Mono (woff2), with their license in OFL.txt
  js/app.js      rendering and events for the Weeks and Settings screens
  js/weeks.js    pure date math for the grid, including where chapters fall (no DOM)
  js/colors.js   the colors a chapter or important week can have (their shades are in styles.css)
  js/settings.js pure rules for Settings: checking dates, adding and removing chapters and important weeks
  js/picture.js  the share pictures: their formats, layout and canvas drawing (no DOM)
  js/lifespan.js how long a life the grid counts: a country's life expectancy or your own number (no DOM)
  js/life-expectancy.js  WHO life expectancy at birth by country and sex (generated)
  js/storage.js  localStorage read/write, and asking the browser to keep it
  js/backup.js   backup files: writing them and checking them before a restore (no DOM)
scripts/
  life-expectancy.mjs  rebuilds js/life-expectancy.js from the WHO API (npm run life-expectancy)
  link-preview.mjs  draws site/link-preview.png (needs Playwright)
test/            unit tests (node --test)
```

## Life span

Settings → **Your life span** sets how many years the grid counts. Pick a country and Average, Male or Female, and it uses that country's life expectancy at birth; or type your own number (1 to 150, decimals fine, e.g. 120), which wins. Until one is chosen it stays at 100 years.

The figures are the World Health Organization's life expectancy at birth ([Global Health Observatory](https://www.who.int/data/gho/data/indicators/indicator-details/GHO/life-expectancy-at-birth-(years)), CC BY-NC-SA 3.0 IGO). They are saved in `site/js/life-expectancy.js`, so the app never looks anything up. To refresh them when WHO publishes a new year, run `npm run life-expectancy` and commit the result. It is an average at birth, not a forecast for any one person.

## Screens

Both screens are on one page; the address picks which one shows, so the browser's back button and reload work as expected.

- **Weeks** (`#weeks`, the default): the grid, as long as your life span. Weeks beyond the span show only where something is saved there, or if you have outlived it, as faded outlines labelled "Past your span"; nothing saved is ever dropped. Chapters color their stretch of weeks, and a line under the legend names each one. Important weeks show in the color you picked for them, over any chapter. Hover a chapter's week or an important week for details. If two important dates fall in the same week, the square takes the earlier one's color. The week you were born, the first square, has a ring in the this-week color; hover it to see your birthday. Inside the ring it keeps its own color: lived, its chapters' or an important week's. Before a birthday is saved, it asks you to add one, or to restore a backup (the way in on a new device, or after the browser cleared the site).
- **Settings** (`#settings`): your birthday, your life span (below), the light or dark theme, your chapters (add when one began, when it ended or nothing if it's still going, a name and a color, or remove one), and your important weeks (add a date, what happened and a color, or remove one). Every change is saved straight away, in this browser only.
  - **Share your weeks** makes a PNG of your whole grid in your current theme, sized for where you'll post it. Save it, or, where the browser supports sharing files (most phones), share it straight to the app. It needs a birthday first.
  - **Backup** downloads everything as a file, or restores one. See below.
  - **About** is a short note on who made the site, with a link to the author's blog, and a link to Tim Urban's original [Your Life in Weeks](https://waitbutwhy.com/2014/05/life-weeks.html) post on Wait But Why. The name, line about the author and blog link are in `index.html`; the photo's Gravatar hash is in `.github/workflows/pages.yml`.

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

### Backups

**Download backup** saves `life-in-weeks-backup-YYYY-MM-DD.json`: your birthday, theme, chapters and important weeks, as readable JSON.

```json
{
  "app": "life-in-weeks",
  "version": 2,
  "exported": "2026-11-05",
  "birthday": "1990-06-15",
  "theme": "dark",
  "chapters": [
    { "id": 1, "start": "2012-06-01", "end": "", "label": "Living in Seattle", "color": "violet" }
  ],
  "events": [
    { "id": 1, "date": "2015-03-02", "label": "Moved to Seattle", "color": "teal" }
  ]
}
```

**Restore backup** reads one back and puts it in place of what this browser holds. If the browser already has a birthday, chapters or important weeks, it first shows both side by side and asks before replacing them. A file that isn't a backup, has a broken birthday, or holds nothing is turned away without changing anything. A malformed chapter or important week is dropped, as it would be on a normal load. A backup from a newer version of the app asks you to reload the page. Version 2 added chapters; a version 1 backup, from before them, restores with none.

When you first save something on a visit, the app also calls `navigator.storage.persist()`, which asks the browser not to clear the site's data. It is only a request. Firefox asks you. Chrome and Safari decide for themselves from how you use the site, and Safari mostly agrees only for sites added to the Home Screen. That's why the backup file, not `persist()`, is the dependable copy. It is asked when you save rather than when the page loads, so Firefox's question follows something you did.

To change the file's shape, bump `BACKUP_VERSION` in `js/backup.js`, and keep `readBackup` reading the older versions.

### Link previews

When someone posts the site's address, apps like X, LinkedIn, Slack, WhatsApp and iMessage show a card with a picture. The page's Open Graph and `twitter:card` tags in `index.html` point them at `site/link-preview.png`: a sample life on the week grid, 1200 × 630, in the dark theme, with "Every square is a week. See yours." over it.

It is a fixed file, drawn by the same code as the share pictures (the `PREVIEW` format in `js/picture.js`, which has no Share button). Redraw it after changing how the pictures look, the dark theme's colors or the site's address:

```bash
npm install --no-save playwright && npx playwright install chromium   # once
npm run link-preview
```

The tags must give the site's full address: `og:url` is `https://pkarthikr.in/your-life-in-weeks/` and `og:image` is the picture under it. If the site moves, or you deploy a copy of it, change both, then run `npm run link-preview` so the address printed on the picture matches. A test checks that the tags are there, that the picture is under `og:url`, and that its size matches the tags.

Apps keep a copy of a preview for a while. To see a change straight away, ask for a fresh one with a tool like LinkedIn's Post Inspector or Facebook's Sharing Debugger.

### Colors for chapters and important weeks

There are six, shared by chapters and important weeks: Blue (the default, and the color of weeks added before colors existed), Violet, Pink, Red, Green and Teal. Each has its own shade per theme, picked to stay distinct from the others and from the lived, ahead and this-week squares. How much of a chapter's color shows in its weeks ahead is the `--tint` token in each theme block. To change a shade, edit its `--c-<color>` token in both theme blocks at the top of `styles.css`; to add a color, add it to `js/colors.js` and give it a token in each theme and a `.c-<color>` class (a test checks that none are missing).

The week you were born is marked with a ring rather than a seventh color. With six important-week colors plus the lived, ahead and this-week squares, no further hue stayed clearly apart from all of them in both themes, including for color-blind readers.
