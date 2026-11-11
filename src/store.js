// Everything the family enters lives in this one object, saved in the browser's
// localStorage on this device. Settings > Backup writes it to a file and reads it back.
//
// {
//   version: 1,
//   settings: { bibleVersion: a key of VERSIONS in bible.js ("bsb", "kjv", "gnv"...), worshipDays: [Sun..Sat booleans], theme: "auto" | "light" | "dark" },
//   tracks: [{ id, kind, source, pace, start, position, credit, laps, paused, hymns?, section? }],
//            (hymns: the hymn ids a hymn track goes through; position counts within them)
//            (section: for the "section" Bible source, { ref: "Matthew 5-7", step: "verse" | "paragraph" | "chapter" })
//            (prayer tracks: each: "all" | "part"; a family's own plan (source "custom") also has
//             name and parts: [{ title, prompt }]. See prayer.js)
//            (creeds tracks: a creed has each: "all" | "part" and goes round like a prayer plan;
//             a confession has step: "paragraph" | "chapter". See creedUnits in content.js)
//   log: { "YYYY-MM-DD": { at, entries: [{ track, from, count, review, credit }], late? } }
// }
import { today } from "./dates.js";

const KEY = "family-worship";
const VERSION = 1;

const fresh = () => ({
    version: VERSION,
    settings: { bibleVersion: "bsb", worshipDays: [true, true, true, true, true, true, true], theme: "auto" },
    tracks: [],
    log: {},
});

function migrate(data) {
    const base = fresh();
    return { ...base, ...data, settings: { ...base.settings, ...data.settings }, version: VERSION };
}

export function load() {
    try {
        const raw = localStorage.getItem(KEY);
        return raw ? migrate(JSON.parse(raw)) : fresh();
    } catch {
        return fresh();
    }
}

export const state = load();

const listeners = new Set();
export const onChange = (fn) => listeners.add(fn);

export function save() {
    try {
        localStorage.setItem(KEY, JSON.stringify(state));
    } catch (e) {
        console.error("Couldn't save", e);
    }
    for (const fn of listeners) fn(state);
}

// Ask the browser not to clear our data when space runs low (installed apps usually get this)
navigator.storage?.persist?.().catch(() => {});

export function newTrack({ kind, source, pace, start = today(), position = 0, hymns, section, each, step, name, parts }) {
    const track = {
        id: Math.random().toString(36).slice(2, 10),
        kind, source, pace, start, position,
        credit: 0, laps: 0, paused: false,
        ...(kind === "hymns" ? { hymns } : {}),
        ...(source === "section" ? { section } : {}),
        ...(kind === "prayer" ? { each } : {}),
        ...(kind === "prayer" && source === "custom" ? { name, parts } : {}),
        ...(kind === "creeds" ? (step ? { step } : { each }) : {}),
    };
    // Bible, catechism, creed or confession, prayer, then hymns: the usual order of family worship.
    // A new plan goes before the first plan of a later kind, so an order the family set by dragging stays.
    const order = ["bible", "catechism", "creeds", "prayer", "hymns"];
    const at = state.tracks.findIndex((t) => order.indexOf(t.kind) > order.indexOf(kind));
    state.tracks.splice(at === -1 ? state.tracks.length : at, 0, track);
    save();
    return track;
}

export const exportData = () => JSON.stringify(state, null, 1);

export function importData(text) {
    const data = JSON.parse(text);
    if (!data || !Array.isArray(data.tracks) || typeof data.log !== "object") throw new Error("That file isn't a Family Worship backup.");
    const next = migrate(data);
    for (const k of Object.keys(state)) delete state[k];
    Object.assign(state, next);
    save();
}
