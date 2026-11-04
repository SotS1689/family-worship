// Downloads the app's texts and writes the copies the app reads into public/data/:
//
//   Bibles      eBible.org verse-per-line files (BSB and KJV, both public domain)
//               -> public/data/bible/<bsb|kjv>/<BOOK>.json   [[ [verse, text], ... ] per chapter]
//   Catechisms  NonlinearFruit/Creeds.json (Unlicense / public-domain texts)
//               -> public/data/catechisms/<id>.json
//               with Scripture proofs from symbolics.dev, and the Larger Catechism from there
//   Creeds &    symbolics.dev's JSON API (CC0): creeds and confessions with their proofs
//   Confessions -> public/data/creeds/<id>.json
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

// ---- symbolics.dev ----
// Creeds, confessions and catechisms as data, with their Scripture proofs (CC0):
// https://symbolics.dev/api/v1/documents/<id>
const symbolics = async (doc) => JSON.parse(await text(`https://symbolics.dev/api/v1/documents/${doc}`, `symbolics-${doc}.json`));
// OSIS book codes, in the same order as BOOKS
const OSIS = ("Gen Exod Lev Num Deut Josh Judg Ruth 1Sam 2Sam 1Kgs 2Kgs 1Chr 2Chr Ezra Neh Esth Job Ps Prov Eccl Song Isa Jer "
    + "Lam Ezek Dan Hos Joel Amos Obad Jonah Mic Nah Hab Zeph Hag Zech Mal Matt Mark Luke John Acts Rom 1Cor 2Cor Gal Eph Phil "
    + "Col 1Thess 2Thess 1Tim 2Tim Titus Phlm Heb Jas 1Pet 2Pet 1John 2John 3John Jude Rev").split(" ");
const OSIS_NAME = Object.fromEntries(OSIS.map((o, i) => [o, BOOKS[i].name]));
// "Rom.2.14-Rom.2.15" -> "Romans 2:14–15"; "Ps.19" -> "Psalms 19"
function osisLabel(osis) {
    const [a, b] = osis.split("-").map((x) => x.split("."));
    const name = OSIS_NAME[a[0]];
    if (!name) throw new Error(`Unknown OSIS book in ${osis}`);
    const one = (r) => r.slice(1).join(":");
    if (!b) return `${name} ${one(a)}`;
    if (b[0] !== a[0]) return `${name} ${one(a)} – ${OSIS_NAME[b[0]]} ${one(b)}`;
    return `${name} ${one(a)}–${b[1] === a[1] && b.length > 2 ? b[2] : one(b)}`;
}
// A segment's proofs as printed ("Luke 16:29, 31"), except that one printed without its
// book ("2:14–15", the book of the proof before it) is written out from its OSIS
const proofLabels = (segment) => (segment.refs ?? []).flatMap((r) =>
    /^\s*(\d\s*)?[A-Za-z]/.test(r.printed) || !r.osis?.length ? [r.printed] : r.osis.map(osisLabel));

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
    // The Scripture proofs come from symbolics.dev, written out ("Romans 14:7–9"), when its
    // questions line up with these; Creeds.json has none for the WSC, and OSIS codes for the rest
    const sym = (await symbolics(id)).questions;
    const aligned = sym.length === src.Data.length && sym.every((q, i) => q.number === src.Data[i].Number);
    if (!aligned) console.warn(`  ${id}: symbolics.dev's questions don't line up; keeping Creeds.json's proofs`);
    const questions = src.Data.map((d, i) => ({
        n: d.Number,
        q: d.Question,
        // A few have only the version with proof marks ("...makes himself known[1].")
        a: d.Answer || (d.AnswerWithProofs || "").replace(/\s*\[\d+\]/g, ""),
        proofs: aligned ? sym[i].segments.flatMap(proofLabels) : (d.Proofs || []).flatMap((p) => p.References || []),
    }));
    write(`catechisms/${id}.json`, {
        title: src.Metadata.Title,
        year: src.Metadata.Year,
        source: `Creeds.json (${file})${aligned ? "; proofs from symbolics.dev" : ""}`,
        questions,
    });
}
// Catechisms taken whole from symbolics.dev (modern spelling)
for (const [id, doc] of Object.entries({ wlc: "wlc-modernized" })) {
    console.log(`Catechism: ${id}`);
    const src = await symbolics(doc);
    write(`catechisms/${id}.json`, {
        title: src.title,
        year: String(src.year),
        source: `symbolics.dev (${doc}, release ${src.version})`,
        questions: src.questions.map((q) => ({ n: q.number, q: q.question, a: q.answer, proofs: q.segments.flatMap(proofLabels) })),
    });
}

// ---- Creeds & Confessions (symbolics.dev, CC0) ----
// -> creeds/<id>.json, each a creed or a confession:
//   creed       { type: "creed", title, year, edition, source, clauses: [{ n, segs }] | null, text: [paragraph...] }
//   confession  { type: "confession", title, short, year, edition, source,
//                 chapters: [{ n, title, paragraphs: [{ n, segs }] }] }
//   segs: [{ t: text, p?: [proof, ...] }], the text in pieces, each with the proofs printed after it
// The modern-spelling editions are used where symbolics.dev has one.
const CREED_DOCS = {
    apostles: "apostles", nicene: "nicene381", athanasian: "athanasian", chalcedon: "chalcedon451", nicaea: "nicene",
    lbcf1689: "lbcf1689-modernized", wcf: "wcf1646-modernized", savoy: "savoy1658-modernized", phila1742: "phila1742",
    belgic: "belgic1561", dort: "dort1619", orthodox1679: "orthodox1679", standard1660: "standard1660",
};
mkdirSync(`${OUT}/creeds`, { recursive: true });
const segsOf = (segments) => segments.map((s) => {
    const p = proofLabels(s);
    return p.length ? { t: s.text, p } : { t: s.text };
});
for (const [id, doc] of Object.entries(CREED_DOCS)) {
    console.log(`Creed or confession: ${id}`);
    const src = await symbolics(doc);
    const base = { title: src.title.replace(/\s*\(modernized\)$/, ""), short: src.short, year: src.year, edition: src.edition, source: `symbolics.dev (${doc}, release ${src.version})` };
    if (src.kind === "creed") {
        const text = (src.text ?? "").split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);
        const clauses = src.clauses?.length ? src.clauses.map((c) => ({ n: c.number, segs: segsOf(c.segments) })) : null;
        if (!text.length && !clauses) throw new Error(`${id}: no text`);
        write(`creeds/${id}.json`, { type: "creed", ...base, clauses, text });
    } else if (src.kind === "confession") {
        if (!src.chapters?.length) throw new Error(`${id}: no chapters`);
        write(`creeds/${id}.json`, {
            type: "confession", ...base,
            chapters: src.chapters.map((c) => ({
                n: c.number, title: c.title,
                paragraphs: c.paragraphs.map((p) => ({ n: p.number, segs: segsOf(p.segments) })),
            })),
        });
    } else throw new Error(`${id}: ${doc} is a ${src.kind}`);
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
writeFileSync("src/vendor/match.js", "// Copied from Let's Sing (SotS1689/lets-sing, web/src/match.js) by\n"
    + "// scripts/fetch-content.mjs: change it there, then run npm run fetch-content.\n\n"
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
