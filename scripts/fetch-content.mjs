// Downloads the app's texts and writes the copies the app reads into public/data/:
//
//   Bibles      eBible.org verse-per-line files (BSB and KJV, both public domain)
//               -> public/data/bible/<bsb|kjv>/<BOOK>.json   [[ [verse, text], ... ] per chapter]
//   Catechisms  NonlinearFruit/Creeds.json (Unlicense / public-domain texts)
//               -> public/data/catechisms/<id>.json
//   Hymns       SotS1689/lets-sing hymns_data.json (the Let's Sing master copy)
//               -> public/data/hymns.json
//               and its hymn-list matcher, web/src/match.js -> src/vendor/match.js
//   Plans       M'Cheyne: willswire/mcheyne PlanConstants.swift (Apache-2.0)
//               Chronological: bennythadikaran/bible bible.json (365-day chronological)
//               -> public/data/plans/<id>.json
//
// Run with `npm run fetch-content` whenever a source changes (e.g. hymns added to
// Let's Sing). The outputs are committed, so building the site never needs these
// sites to be up. Raw downloads are kept in sources/ (not committed).
import { mkdirSync, writeFileSync, existsSync, readFileSync } from "node:fs";
import { unzipSync, strFromU8 } from "fflate";
import { BOOKS, BOOK, parseReference } from "../src/bible.js";

const OUT = "public/data";
const RAW = "sources";

async function download(url, file) {
    const path = `${RAW}/${file}`;
    if (existsSync(path) && !process.argv.includes("--fresh")) return readFileSync(path);
    process.stdout.write(`  downloading ${url}\n`);
    const res = await fetch(url);
    if (!res.ok) throw new Error(`${url}: HTTP ${res.status}`);
    const buf = Buffer.from(await res.arrayBuffer());
    writeFileSync(path, buf);
    return buf;
}
const text = async (url, file) => (await download(url, file)).toString("utf8");
const write = (path, data) => {
    writeFileSync(`${OUT}/${path}`, JSON.stringify(data));
    console.log(`  wrote ${path}`);
};

mkdirSync(RAW, { recursive: true });
for (const dir of ["bible/bsb", "bible/kjv", "catechisms", "plans"]) mkdirSync(`${OUT}/${dir}`, { recursive: true });

// ---- Bibles ----
// The KJV marks words the translators supplied in [brackets]; the app shows them in italics.
const BIBLES = { bsb: "engbsb", kjv: "eng-kjv2006" };
const lastVerse = {}; // code -> [last verse of each chapter in either version]
for (const [version, id] of Object.entries(BIBLES)) {
    console.log(`Bible: ${version}`);
    const zip = unzipSync(new Uint8Array(await download(`https://ebible.org/Scriptures/${id}_vpl.zip`, `${id}_vpl.zip`)));
    const lines = strFromU8(zip[`${id}_vpl.txt`]).split(/\r?\n/);
    const books = {};
    for (const line of lines) {
        const m = line.match(/^(\w{3}) (\d+):(\d+) (.*)$/);
        if (!m || !BOOK[m[1]]) continue; // skips the KJV's Apocrypha
        const [, code, ch, v, t] = m;
        ((books[code] ??= [])[ch - 1] ??= []).push([+v, t.trim()]);
    }
    for (const b of BOOKS) {
        const chapters = books[b.code];
        if (!chapters || chapters.length !== b.chapters) throw new Error(`${version} ${b.code}: ${chapters?.length} chapters, expected ${b.chapters}`);
        writeFileSync(`${OUT}/bible/${version}/${b.code}.json`, JSON.stringify(chapters));
        lastVerse[b.code] = chapters.map((vs, i) => Math.max(lastVerse[b.code]?.[i] ?? 0, ...vs.map(([v]) => v)));
    }
    console.log(`  wrote bible/${version}/*.json (66 books)`);
}

// ---- Paragraphs ----
// Where the BSB starts a new paragraph (or stanza, in poetry): after a blank line
// (\b), a section heading, a Psalm title or the start of a chapter. A break in the
// middle of a verse is left out, so every paragraph is whole verses.
// -> paragraphs.json  { BOOK: [[last verse, first verse of each paragraph after the first...] per chapter] }
console.log("Paragraphs: BSB");
const usfm = unzipSync(new Uint8Array(await download("https://ebible.org/Scriptures/engbsb_usfm.zip", "engbsb_usfm.zip")));
const BREAKS = new Set(["c", "b", "s1", "s2", "d", "ms1", "qa"]);
const HEADINGS = new Set(["s1", "s2", "d", "ms1", "mr", "r", "qa", "mt1", "h", "toc1", "toc2", "id"]);
// The USFM files use the standard book codes; the eBible.org verse files (and so the app) differ for these
const USFM_CODES = { SNG: "SOL", EZK: "EZE", JOL: "JOE", NAM: "NAH", MRK: "MAR", JHN: "JOH", PHP: "PHI", JAS: "JAM", "1JN": "1JO", "2JN": "2JO", "3JN": "3JO" };
const paragraphs = {};
for (const [file, bytes] of Object.entries(usfm)) {
    const usfmCode = file.match(/^\d+-(\w{3})engbsb\.usfm$/)?.[1];
    const code = USFM_CODES[usfmCode] ?? usfmCode;
    if (!BOOK[code]) continue;
    const starts = Array.from({ length: BOOK[code].chapters }, () => []);
    let chapter = 0, pending = false, heading = false;
    // Each marker and the text after it, up to the next one
    for (const [, marker, rest] of strFromU8(bytes).matchAll(/\\(\+?\w+\*?)([^\\]*)/g)) {
        if (marker === "c") chapter = parseInt(rest);
        if (BREAKS.has(marker)) pending = true;
        if (marker === "c") continue;
        if (marker === "v") {
            const v = parseInt(rest);
            if (pending && v > 1) starts[chapter - 1].push(v);
            pending = heading = false;
            continue;
        }
        if (HEADINGS.has(marker)) {
            heading = true;
            continue;
        }
        if (/^(m|p|pi\d?|q\d|li\d|pmo|qr|pc)$/.test(marker)) heading = false;
        // Words before the next verse number: the break was mid-verse
        if (pending && !heading && rest.trim()) pending = false;
    }
    paragraphs[code] = lastVerse[code].map((last, i) => [last, ...starts[i]]);
}
if (Object.keys(paragraphs).length !== 66) throw new Error(`Paragraphs: ${Object.keys(paragraphs).length} books, expected 66`);
write("paragraphs.json", paragraphs);

// ---- Catechisms ----
const CREEDS = "https://raw.githubusercontent.com/NonlinearFruit/Creeds.json/master/creeds";
const CATECHISMS = {
    wsc: "westminster_shorter_catechism.json",
    bc1695: "1695_baptist_catechism.json",
    heidelberg: "heidelberg_catechism.json",
};
for (const [id, file] of Object.entries(CATECHISMS)) {
    console.log(`Catechism: ${id}`);
    const src = JSON.parse(await text(`${CREEDS}/${file}`, file));
    const questions = src.Data.map((d) => ({
        n: d.Number,
        q: d.Question,
        // A few have only the version with proof marks ("...makes himself known[1].")
        a: d.Answer || (d.AnswerWithProofs || "").replace(/\s*\[\d+\]/g, ""),
        proofs: (d.Proofs || []).flatMap((p) => p.References || []),
    }));
    write(`catechisms/${id}.json`, {
        title: src.Metadata.Title,
        year: src.Metadata.Year,
        source: `Creeds.json (${file})`,
        questions,
    });
}

// ---- Hymns (Let's Sing) ----
console.log("Hymns: Let's Sing");
const hymns = JSON.parse(await text("https://raw.githubusercontent.com/SotS1689/lets-sing/main/hymns_data.json", "hymns_data.json"));
write("hymns.json", hymns.map((h) => ({
    id: String(h.id),
    title: h.title,
    tune: h.tune || "",
    composer: h.Composer || h.composer_arranger || "",
    verses: h.verses || [],
    credits: h.credits || "",
})));
// The matcher behind "Paste a list", the same one Let's Sing uses
writeFileSync("src/vendor/match.js", "// Copied from Let's Sing (SotS1689/lets-sing, web/src/match.js) by
"
    + "// scripts/fetch-content.mjs: change it there, then run npm run fetch-content.

"
    + await text("https://raw.githubusercontent.com/SotS1689/lets-sing/main/web/src/match.js", "match.js"));
console.log("  wrote src/vendor/match.js");

// ---- Reading plans ----
// Each plan file is a list of days; each day a list of reference strings
// (parsed by the app with parseReference, checked here).
const checkPlan = (id, days) => {
    const read = new Set();
    for (const day of days) for (const ref of day) {
        for (const p of parseReference(ref)) {
            if (p.chapter < 1 || p.chapter > BOOK[p.book].chapters) throw new Error(`${id}: no chapter ${p.chapter} in "${ref}"`);
            read.add(`${p.book} ${p.chapter}`);
        }
    }
    const missed = BOOKS.flatMap((b) => Array.from({ length: b.chapters }, (_, i) => `${b.code} ${i + 1}`)).filter((c) => !read.has(c));
    if (missed.length) throw new Error(`${id}: never reads ${missed.slice(0, 10).join(", ")}${missed.length > 10 ? "…" : ""}`);
    write(`plans/${id}.json`, days);
};

console.log("Plan: M'Cheyne");
const swift = await text("https://raw.githubusercontent.com/willswire/mcheyne/main/App/PlanConstants.swift", "mcheyne.swift");
const block = swift.slice(swift.indexOf("RAW_PLAN_DATA"));
const mcheyne = [...block.matchAll(/^\s*\[("[^\]]*")\],?\s*$/gm)].map((m) => JSON.parse(`[${m[1]}]`));
if (mcheyne.length !== 365) throw new Error(`M'Cheyne: ${mcheyne.length} days, expected 365`);
checkPlan("mcheyne", mcheyne);

console.log("Plan: Chronological");
const chrono = JSON.parse(await text("https://raw.githubusercontent.com/bennythadikaran/bible/master/bible.json", "chronological.json"))
    .filter((s) => s.trim())
    .map((s) => [s]);
if (chrono.length !== 365) throw new Error(`Chronological: ${chrono.length} days, expected 365`);
checkPlan("chronological", chrono);

console.log("Done.");
