# Family Worship

An installable web app (PWA) for family worship. The family picks a Bible reading plan, a
catechism and hymns, then sets a goal ("finish in 1 year") or a pace ("1 question a week")
for each. Every day the **Today** page shows what's due, and one tap on the check mark
records that the family worshipped. **Stats** shows streaks, days per week, a calendar and
how far along each plan is.

Everything is stored on the phone. There are no accounts and no server.
**Settings → Backup** saves the data to a file and restores it.

## Everyday commands

| Command | What it does |
|---|---|
| `npm install` | One-time setup. |
| `npm run dev` | Runs the app at http://localhost:5173 and reloads as you edit. |
| `npm test` | Checks the scheduling and streak logic (`tests/`). |
| `npm run build` | Makes the finished site in `dist/`. |
| `npm run preview` | Serves `dist/` at http://localhost:4173 to try the real build, offline mode included. |
| `npm run fetch-content` | Downloads the texts again into `public/data/`, e.g. after hymns are added to Let's Sing. Add `-- --fresh` to ignore the saved downloads in `sources/`. |

Pushing to `main` on GitHub publishes the site through `.github/workflows/pages.yml`. To set
that up, turn on Pages in the repo settings with **Source: GitHub Actions**.

## How it's put together

Plain JavaScript and [Vite](https://vite.dev), built the same way as Let's Sing.

- `src/main.js` handles routing with hash routes (`#/`, `#/plans`, `#/stats`, `#/settings`,
  `#/read/<plan>/<n>`).
- `src/views/` holds one file per screen.
- `src/catalog.js` lists the plans, catechisms and hymn sources the app offers.
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
- `src/stats.js` computes streaks, faithfulness percentages and weekly counts. Days the
  family doesn't plan to worship (Settings → Worship days) don't break a streak.
- `src/store.js` holds the saved data. Its shape is documented at the top of the file.
- `sw-template.js` and `scripts/stamp-sw.mjs` are the offline service worker. The app,
  catechisms, hymns and plans are cached at install. Each Bible book is cached the
  first time it's opened.

## Content and sources

| What | Source | Licence |
|---|---|---|
| Berean Standard Bible (text, and its paragraph breaks from the USFM edition) | [eBible.org `engbsb`](https://ebible.org/details.php?id=engbsb) | Public domain |
| King James Version | [eBible.org `eng-kjv2006`](https://ebible.org/details.php?id=eng-kjv2006) | Public domain (outside the UK) |
| Westminster Shorter, 1695 Baptist and Heidelberg catechisms | [Creeds.json](https://github.com/NonlinearFruit/Creeds.json) | Public-domain texts |
| An Orthodox Catechism (Hercules Collins, 1680) | The pastor's Word document `The Orthodox Catechism.docx`, imported by `scripts/import_collins.py` | Public-domain text |
| Baptist Catechism music | Jim Scott Orrick, *The Baptist Catechism Set to Music*. Played from [baptistcatechism.org](https://baptistcatechism.org)'s storage, not copied here (see `music` in `src/catalog.js`) | © 2001 Orrick, used by permission on baptistcatechism.org. That site's developer has allowed its use here. |
| Hymns and psalms | [Let's Sing](https://github.com/SotS1689/lets-sing) `hymns_data.json` | As Let's Sing |
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
