// The ESV, from Crossway's ESV API (api.esv.org), free for non-commercial use.
//
// Crossway's terms (https://api.esv.org/) shape this file:
// - The key may not be shared or published, so it isn't in the app's code. Each
//   family creates its own at api.esv.org and types it into Settings; it is kept
//   in this browser only, outside the family's data (so not in backup files).
// - No more than 500 verses may be kept, so passages are held in memory only and
//   the oldest are dropped past 500 verses. The service worker doesn't save them.
// - Each page showing the text names it as the ESV and links to esv.org; the
//   notice below is shown in Settings > About.
import { BOOK } from "./bible.js";

const KEY = "family-worship-esv-key";
const API = "https://api.esv.org/v3/passage/text/";
const MAX_VERSES = 500;

export const ESV_NOTICE = "Scripture quotations marked “ESV” are from the ESV® Bible (The Holy Bible, English Standard Version®), © 2001 by Crossway, a publishing ministry of Good News Publishers. Used by permission. All rights reserved. The ESV text may not be quoted in any publication made available to the public by a Creative Commons license. The ESV may not be translated into any other language. Users may not copy or download more than 500 verses of the ESV Bible or more than one half of any book of the ESV Bible.";

export function esvKey() {
    try {
        return localStorage.getItem(KEY) ?? "";
    } catch {
        return "";
    }
}

export function setEsvKey(key) {
    try {
        if (key) localStorage.setItem(KEY, key);
        else localStorage.removeItem(KEY);
    } catch (e) {
        console.error("Couldn't save the ESV key", e);
    }
    held.clear();
}

export class EsvError extends Error {}

// Passages already fetched, oldest first: query -> [[verse, text], ...]
const held = new Map();
const heldVerses = () => [...held.values()].reduce((n, vs) => n + vs.length, 0);

// The verses of one passage ({ book, chapter, from?, to? }), as [[verse, text], ...]
export async function esvPassage(p) {
    const key = esvKey();
    if (!key) throw new EsvError("To read the ESV, add your ESV API key in Settings.");
    const b = BOOK[p.book];
    // "Romans 8:28-39", "Romans 8", "Jude" ("Jude 1" would be its first verse). A passage
    // that runs on to the chapter's end (to == null) asks for the chapter; the reader trims it.
    const q = p.from != null && p.to != null ? `${b.name} ${p.chapter}:${p.from}-${p.to}`
        : b.chapters === 1 ? b.name : `${b.name} ${p.chapter}`;
    if (held.has(q)) return held.get(q);

    const params = new URLSearchParams({
        q,
        "include-passage-references": "false",
        "include-verse-numbers": "true",
        "include-first-verse-numbers": "true",
        "include-footnotes": "false",
        "include-headings": "false",
        "include-short-copyright": "false", // the reader names it as the ESV beside the text
        "include-selahs": "true",
        "indent-poetry": "false",
    });
    const res = await fetch(`${API}?${params}`, { headers: { Authorization: `Token ${key}` } });
    if (res.status === 401 || res.status === 403) throw new EsvError("The ESV API didn't accept your key. Check it in Settings.");
    if (res.status === 429) throw new EsvError("The ESV API is busy for this key. Try again in a minute.");
    if (!res.ok) throw new Error(`ESV API: HTTP ${res.status}`);
    const text = (await res.json()).passages?.[0] ?? "";

    // "[16] For God so loved the world, … [17] For God did not send …"
    const verses = [];
    for (const [, v, t] of text.matchAll(/\[(\d+)\]\s*([^[]*)/g)) verses.push([+v, t.replace(/\s+/g, " ").trim()]);

    held.set(q, verses);
    while (held.size > 1 && heldVerses() > MAX_VERSES) held.delete(held.keys().next().value);
    return verses;
}
