// Loads the texts in public/data/ and turns each source into its list of units.
// A unit is what one step of a track covers:
//   bible     { passages: [{ book, chapter, from?, to? }], label }
//   catechism { n, q, a, proofs, label }
//   creeds    { label, heading, doc, paras, preview? }  (see creedUnits below)
//   hymns     { id, title, tune, composer, verses, credits, label }
import { BOOKS, BOOK, VERSIONS, usfmCode, parseReference, passagesLabel } from "./bible.js";
import { SOURCES } from "./catalog.js";

const cache = new Map();
const json = (path) => {
    if (!cache.has(path)) {
        cache.set(path, fetch(`./data/${path}`).then((r) => {
            if (!r.ok) throw new Error(`${path}: HTTP ${r.status}`);
            return r.json();
        }).catch((e) => {
            cache.delete(path); // let a later visit retry (e.g. back online)
            throw e;
        }));
    }
    return cache.get(path);
};

const plural = (n, word) => `${n} ${word}${n === 1 ? "" : "s"}`;
const bibleUnit = (passages) => ({ passages, label: passagesLabel(passages) });

const allChapters = (filter = () => true) => BOOKS.filter(filter)
    .flatMap((b) => Array.from({ length: b.chapters }, (_, i) => ({ book: b.code, chapter: i + 1 })));

const BIBLE_PLANS = {
    straight: async () => allChapters().map((p) => bibleUnit([p])),
    mcheyne: async () => (await json("plans/mcheyne.json")).map((day) => bibleUnit(day.flatMap(parseReference))),
    "mcheyne-family": async () => (await json("plans/mcheyne.json")).map((day) => bibleUnit(day.slice(0, 2).flatMap(parseReference))),
    chronological: async () => (await json("plans/chronological.json")).map((day) => bibleUnit(day.flatMap(parseReference))),
    mixed: async () => {
        const wisdom = (b) => b.code === "PSA" || b.code === "PRO";
        const ot = allChapters((b) => b.testament === "OT" && !wisdom(b));
        const nt = allChapters((b) => b.testament === "NT");
        const ps = allChapters(wisdom);
        return ot.map((p, i) => bibleUnit([p, nt[i % nt.length], ps[i % ps.length]]));
    },
};

// Where each chapter's paragraphs begin: { BOOK: [[last verse, first verse of each later paragraph...], ...] }
export const loadParagraphs = () => json("paragraphs.json");

// A part of the Bible the family chose ("Romans", "Matthew 5-7"), one verse, paragraph or chapter at a time
export async function sectionUnits({ ref, step }) {
    const passages = parseReference(ref);
    if (!passages.length) throw new Error("Type a part of the Bible, such as Romans or Matthew 5–7.");
    const paragraphs = await loadParagraphs();
    const units = [];
    for (const p of passages) {
        const name = BOOK[p.book].name;
        const [last, ...starts] = paragraphs[p.book][p.chapter - 1] ?? [];
        if (!last) throw new Error(`${name} has only ${plural(BOOK[p.book].chapters, "chapter")}`);
        const lo = p.from ?? 1, hi = Math.min(p.to ?? last, last);
        if (lo > hi) throw new Error(`${name} ${p.chapter} has only ${plural(last, "verse")}`);
        // Whole chapters keep no verse numbers, so they're labelled "Romans 8", not "Romans 8:1–39"
        const piece = (from, to) => from === 1 && to === last ? { book: p.book, chapter: p.chapter } : { book: p.book, chapter: p.chapter, from, to };
        if (step === "chapter") units.push(piece(lo, hi));
        else if (step === "verse") for (let v = lo; v <= hi; v++) units.push(piece(v, v));
        else {
            const firsts = [1, ...starts];
            firsts.forEach((s, i) => {
                const from = Math.max(s, lo), to = Math.min((firsts[i + 1] ?? last + 1) - 1, hi);
                if (from <= to) units.push(piece(from, to));
            });
        }
    }
    return units.map((p) => bibleUnit([p]));
}

const hymnOrder = (a, b) => (parseInt(a.id) - parseInt(b.id)) || a.id.localeCompare(b.id);

export async function loadUnits(kind, source, section) {
    if (kind === "bible" && source === "section") return sectionUnits(section);
    if (kind === "bible") return BIBLE_PLANS[source]();
    if (kind === "catechism") {
        const cat = await json(`catechisms/${source}.json`);
        return cat.questions.map((q) => ({ ...q, label: `Q. ${q.n}` }));
    }
    if (kind === "hymns") {
        const hymns = await json("hymns.json");
        return [...hymns].sort(hymnOrder).map((h) => ({ ...h, label: `${h.id}. ${h.title}` }));
    }
    throw new Error(`Unknown kind ${kind}`);
}

// ---- Creeds & Confessions (public/data/creeds/<id>.json, from symbolics.dev; see fetch-content) ----
// A unit is { label, heading, doc, paras: [{ n?, segs: [{ t, p? }] }], preview? }: the paragraphs
// to read or say, each in pieces with the Scripture proofs printed after them.
//   A creed (track.each): "all", the whole creed (its articles, or its paragraphs); "part", one article
//   A confession (track.step): "paragraph" or "chapter"
export const loadCreed = (id) => json(`creeds/${id}.json`);

// "Of the Holy Scriptures" becomes "Chapter 1: Of the Holy Scriptures", or "Article 1: ..." as the
// confession names its divisions (SOURCES.creeds[id].chapter; "" where the titles say it already).
// "Article 3" stays as it is.
const chapterHeading = (c, word = "Chapter") => !word || /^article\b/i.test(c.title ?? "") ? c.title : `${word} ${c.n}${c.title ? `: ${c.title}` : ""}`;
const plainText = (segs) => segs.map((s) => s.t).join(" ");

export async function creedUnits({ source, each, step }) {
    const doc = await loadCreed(source);
    if (doc.type === "creed") {
        const whole = doc.clauses ? doc.clauses.map((c) => ({ segs: c.segs })) : doc.text.map((t) => ({ segs: [{ t }] }));
        if (each !== "part" || !doc.clauses) return [{ label: doc.title, heading: doc.title, doc: doc.title, paras: whole, said: true }];
        return doc.clauses.map((c) => ({
            label: `Article ${c.n}`, heading: `Article ${c.n}`, doc: doc.title, paras: [{ segs: c.segs }], said: true, preview: plainText(c.segs),
        }));
    }
    const short = SOURCES.creeds[source]?.short ?? doc.short ?? doc.title;
    const word = SOURCES.creeds[source]?.chapter;
    const heading = (c) => chapterHeading(c, word);
    if (step === "chapter") return doc.chapters.map((c) => ({
        label: `${short} ${c.n}`, heading: heading(c), doc: doc.title,
        paras: c.paragraphs.map((p) => ({ n: c.paragraphs.length > 1 ? p.n : null, segs: p.segs })), preview: c.title,
    }));
    return doc.chapters.flatMap((c) => c.paragraphs.map((p) => ({
        label: c.paragraphs.length > 1 ? `${short} ${c.n}.${p.n}` : `${short} ${c.n}`,
        heading: heading(c), doc: doc.title,
        paras: [{ n: c.paragraphs.length > 1 ? p.n : null, segs: p.segs }], preview: c.title,
    })));
}

// One book of a Bible version: chapters[chapter - 1] = [[verse, text], ...]
export const loadBook = (version, code) => json(`bible/${version}/${code}.json`);

// One chapter of a version, [[verse, text], ...]: from the app's copy, or for an
// online version from the Free Use Bible API (footnote marks and line breaks left out)
const API = "https://bible.helloao.org/api";
const chapters = new Map();
export async function loadChapter(version, code, chapter) {
    const online = VERSIONS[version]?.online;
    if (!online) return (await loadBook(version, code))[chapter - 1];
    const url = `${API}/${online}/${usfmCode(code)}/${chapter}.json`;
    if (!chapters.has(url)) {
        chapters.set(url, fetch(url).then((r) => {
            if (!r.ok) throw new Error(`${url}: HTTP ${r.status}`);
            return r.json();
        }).then((data) => data.chapter.content.filter((c) => c.type === "verse").map((v) => [
            v.number,
            v.content.map((part) => typeof part === "string" ? part : part.text ?? "").filter(Boolean).join(" ").replace(/\s+/g, " ").trim(),
        ])).catch((e) => {
            chapters.delete(url);
            throw e;
        }));
    }
    return chapters.get(url);
}

// Optional sung settings of catechism questions:
// public/data/catechism-songs.json = { "<catechism id>": { "<question number>": { "title", "url" } } }
export const loadCatechismSongs = () => json("catechism-songs.json").catch(() => ({}));
