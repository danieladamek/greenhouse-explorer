# Grow log (manager lane)

`grow-log.xlsx` is the greenhouse team's own record of the plants: plantings (where, hydroponic or soil, when),
observations, hydroponic water readings, harvest-and-drying lots, seeds on hand, and the location codes. It is the
source for the **Grow log** page (`/grow-log`). These are greenhouse records, not scientific content: nothing here is a
claim about what a plant does, and nothing feeds an evidence grade. `content-pack/` is untouched by it.

## Updating it (anyone with write access to this repo)

1. Download the current workbook from the Grow log page (or from this folder) and edit it. The **Read me** sheet
   explains every column; one row is one record; keep the header row as it is.
2. On GitHub: this folder → **Add file → Upload files** → drop `grow-log.xlsx` (same name) → **Commit changes**.
3. The site rebuilds automatically (Actions tab, a few minutes). Problems in the data appear under **Data checks**
   on the page; they never stop the site from publishing. Only an unreadable or missing workbook stops the build,
   and then the previous version of the site stays up.

## Without write access

Use **Add an entry** on the Grow log page. Entries are kept in that browser only and marked "saved in this browser".
Download **Workbook with my entries** — the published workbook with the new rows appended — and send it to someone who
can upload it. Then clear the entries.

## What comes back out

Every build writes `public/growlog/grow-log-report.xlsx` (summary, by location, hydroponic vs soil, harvest yields,
plantings with links to their plant pages, observations, water, data checks), one CSV per table, and a copy of the
source workbook. All are downloadable from the page.

## Build

`npm run build:growlog` (also run by `npm run build:content`) → `scripts/build-growlog.ts` →
`src/data/growlog.json` + `public/growlog/`.

Seed data: Barbara Comer's *Medicinal Plant Inventory* workbook (inventoried 26–27 October 2026). Its Plant ID column
was empty, so the import assigned `GL-nn`, `O-nn`, `H-nn`, `W-nn` and `S-nn` ids. Columns ending in `_as_entered` keep
what the original sheet said, and `cleanup` notes what the import corrected.
