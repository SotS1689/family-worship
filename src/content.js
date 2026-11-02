// Loads the texts in public/data/ and turns each source into its list of units.
// A unit is what one step of a track covers:
//   bible     { passages: [{ book, chapter, from?, to? }], label }
//   catechism { n, q, a, proofs, label }
//   hymns     { id, title, tune, composer, verses, credits, label }
import { BOOKS, BOOK, VERSIONS, usfmCode, parseReference, passagesLabel } from "./bible.js";

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
