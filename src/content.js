// Loads the texts in public/data/ and turns each source into its list of units.
// A unit is what one step of a track covers:
//   bible     { passages: [{ book, chapter, from?, to? }], label }
//   catechism { n, q, a, proofs, label }
//   hymns     { id, title, tune, composer, verses, credits, label }
import { BOOKS, parseReference, passagesLabel } from "./bible.js";

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

const hymnOrder = (a, b) => (parseInt(a.id) - parseInt(b.id)) || a.id.localeCompare(b.id);

export async function loadUnits(kind, source) {
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

// Optional sung settings of catechism questions:
// public/data/catechism-songs.json = { "<catechism id>": { "<question number>": { "title", "url" } } }
export const loadCatechismSongs = () => json("catechism-songs.json").catch(() => ({}));
