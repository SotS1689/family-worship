# Family Worship

An installable web app (PWA) for family worship. The family picks a Bible reading plan, a
catechism and hymns, then sets a goal ("finish in 1 year") or a pace ("1 question a week")
for each. A **Creeds & Confessions** plan says a creed together every worship day (whole, or an
article at a time, going round again), or reads through a confession a paragraph or a chapter at a
time with its Scripture proofs. It can also add a prayer plan (A.C.T.S., the Lord's Prayer, praying a psalm a day with
Psalm 119 by its 22 stanzas, or the family's own order of prayer), which comes up every worship day and goes round again rather than
finishing. Every day the **Today** page shows what's due, and one tap on the check mark
records that the family worshipped. **Stats** shows streaks, days per week, a calendar and
how far along each plan is.

Everything is stored on the phone. There are no accounts and no server.
**Settings → Backup** saves the data to a file and restores it.

## Everyday commands

| Command | What it does |
|---|---|
| `npm install` | One-time setup. |
| `npm run dev` | Runs the app at http://localhost:5173 and reloads as you edit. |
| `npm run dev:lets-sing` | The same at http://localhost:5175, with hymns played by a local Let's Sing build at http://localhost:4174 (see "Let's Sing" below). |
| `npm test` | Checks the scheduling and streak logic (`tests/`). |
| `npm run build` | Makes the finished site in `dist/`. |
| `npm run preview` | Serves `dist/` at http://localhost:4173 to try the real build, offline mode included. |
| `npm run fetch-content` | Downloads the texts again into `public/data/`, e.g. after hymns are added to Let's Sing. Add `-- --fresh` to ignore the saved downloads in `sources/`. |

Pushing to `main` on GitHub publishes the site through `.github/workflows/pages.yml`. To set
that up, turn on Pages in the repo settings with **Source: GitHub Actions**.

The same push also publishes a church copy at https://familyworship.gracecommunityallentown.org:
the workflow's `church` job pushes the build to the `gh-pages` branch of
[SotS1689/family-worship-church](https://github.com/SotS1689/family-worship-church), using the
`CHURCH_DEPLOY_KEY` secret (the private half of a write deploy key on that repo). The domain's
DNS (at Fastmail) has a CNAME record `familyworship` → `sots1689.github.io`. Each address keeps
its own saved settings and progress in the browser.

## How it's put together

Plain JavaScript and [Vite](https://vite.dev), built the same way as Let's Sing.

- `src/main.js` handles routing with hash routes (`#/`, `#/plans`, `#/stats`, `#/settings`,
  `#/read/<plan>/<n>`).
- `src/views/` holds one file per screen.
- `src/catalog.js` lists the plans, catechisms, creeds and confessions, prayer plans and hymn sources the app offers.
- `creedUnits` in `src/content.js` turns a creed into one unit (said whole) or a unit per article, and a
  confession into a unit per paragraph or per chapter (the track's `step`). A creed repeats like a prayer
  plan (`repeats` in `src/schedule.js`); a confession is paced like a catechism.
- `src/prayer.js` holds the prayer plans' parts and turns a prayer track into its units
  (the whole plan, or one part a day). A family's own plan keeps its parts on its track.
- `src/content.js` turns each source into its list of **units**: a chapter, a day's
  readings, a catechism question, or a hymn. A hymn plan goes through only the hymns
  the family picks (`track.hymns`), in Let's Sing's numbering. They can add or remove
  hymns later, and the plan keeps its place.
- `src/schedule.js` decides what's due each day and moves plans forward on a check-in.
  Each plan has a pace in units per worship day. Each check-in earns that much credit,
  and the whole units are the day's new readings. With a pace under one a day (say
  1 question a week), the days in between show the current question as a review.
  A **goal** recalculates the pace every day from what's left, so missed days are spread
  over the rest of the time. A fixed **pace** just finishes later.
- `src/letsSing.js` puts Let's Sing in a hymn's page and saves hymns for offline use
  (see "Let's Sing" below).
- `src/stats.js` computes streaks, faithfulness percentages and weekly counts. Days the
  family doesn't plan to worship (Settings → Worship days) don't break a streak.
- `src/store.js` holds the saved data. Its shape is documented at the top of the file.
- `sw-template.js` and `scripts/stamp-sw.mjs` are the offline service worker. The app,
  catechisms, hymns and plans are cached at install. Each Bible book is cached the
  first time it's opened.

## Let's Sing

A hymn's page is Let's Sing's own hymn page in a frame the height of the screen:
the four-part player, the sheet music with each note lit as it sounds, and the words
following along. It comes from the live Let's Sing site (`LETS_SING_URL` in
`src/catalog.js`) in its embed mode (`?embed`, described in the embed section of
Let's Sing's `web/src/main.js`), which leaves out its top bar, favorites star, support
ask and Google Analytics. So any fix to Let's Sing shows up here as soon as it's
published there. Until the player loads, or if it can't, the page shows the words.

- **Choosing hymns.** The search covers title, first line, tune, composer and number,
  ignoring accents and punctuation as Let's Sing's does. **Paste a list** matches a
  pasted list of hymns with Let's Sing's own matcher, copied into `src/vendor/match.js`
  by `npm run fetch-content`.
- **Offline use.** On a hymn plan's page, **Offline use** saves the plan's hymns.
  Let's Sing keeps them, in its own offline store, through a hidden Let's Sing frame that
  answers which hymns are saved and saves more. A hymn is also saved the first time it's
  played. Saving only works on the published sites, where Let's Sing's service worker runs.
- **Trying Let's Sing changes here before publishing them:** in Let's Sing's `web`
  folder run `npm run build`, then `npx vite preview --port 4174`; here, run
  `npm run dev:lets-sing` (it reads `.env.lets-sing`).

## Content and sources

| What | Source | Licence |
|---|---|---|
| Berean Standard Bible (text, and its paragraph breaks from the USFM edition) | [eBible.org `engbsb`](https://ebible.org/details.php?id=engbsb) | Public domain |
| King James Version | [eBible.org `eng-kjv2006`](https://ebible.org/details.php?id=eng-kjv2006) | Public domain (outside the UK) |
| English Standard Version | Crossway's [ESV API](https://api.esv.org), read as each passage opens with the family's own key (entered in Settings, never in this repo; see `src/esv.js`) | © Crossway, free for non-commercial use under the API terms |
| Other online translations | [Free Use Bible API](https://bible.helloao.org), read as each chapter opens | Public domain or free licences (see `VERSIONS` in `src/bible.js`) |
| Westminster Shorter, 1695 Baptist and Heidelberg catechisms | [Creeds.json](https://github.com/NonlinearFruit/Creeds.json), with their Scripture proofs from [symbolics.dev](https://symbolics.dev) | Public-domain texts; symbolics.dev is CC0 |
| Westminster Larger Catechism; creeds (Apostles', Nicene, Athanasian, Chalcedonian, Nicaea 325) and confessions (1689, Westminster, Savoy, Philadelphia, Belgic, Dort, Orthodox Creed, Standard Confession) | [symbolics.dev](https://symbolics.dev)'s JSON API, in its modern-spelling editions where it has them (`CREED_DOCS` in `scripts/fetch-content.mjs`) | CC0 |
| An Orthodox Catechism (Hercules Collins, 1680) | The pastor's Word document `The Orthodox Catechism.docx`, imported by `scripts/import_collins.py` | Public-domain text |
| Baptist Catechism music | Jim Scott Orrick, *The Baptist Catechism Set to Music*. Played from [baptistcatechism.org](https://baptistcatechism.org)'s storage, not copied here (see `music` in `src/catalog.js`) | © 2001 Orrick, used by permission on baptistcatechism.org. That site's developer has allowed its use here. |
| Hymns and psalms | [Let's Sing](https://github.com/SotS1689/lets-sing) `hymns_data.json`; played by Let's Sing itself, embedded (see above) | As Let's Sing |
| M'Cheyne calendar | [willswire/mcheyne](https://github.com/willswire/mcheyne) | Apache-2.0 |
| Chronological plan | [bennythadikaran/bible](https://github.com/bennythadikaran/bible) | GPL-3.0 repo, plan from biblestudytools.com |

`scripts/fetch-content.mjs` checks every plan reference and confirms that each plan reads
every chapter of the Bible.

The Collins catechism comes from a Word document, so it has its own importer, which isn't
part of `fetch-content`:
`python scripts/import_collins.py "C:\Users\11tdr\Documents\Resources\Practical Theology\Education\The Orthodox Catechism.docx"`
(needs `pip install python-docx`). It removes the document's footnote numbers. It also
completes six questions the document cuts short (Q. 8, 9, 10, 18, 52 and 80) and fixes a
few typing slips in the proof texts. All of these fixes are listed at the top of the script.

### Still to add

- **More catechism songs.** The Baptist Catechism is sung throughout (see the table above).
  For the other catechisms, the reader shows a "Listen" button for any question listed in
  `public/data/catechism-songs.json`:
  `{ "wsc": { "1": { "title": "Q1 – Chief End", "url": "https://..." } } }`.
  Free recordings exist for the Westminster Shorter Catechism, for example Pastor Michael
  Bowman's [WSC Put to Song](https://wscputtosong.substack.com). Get permission before
  linking or embedding anything beyond a plain link.
