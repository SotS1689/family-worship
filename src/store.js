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

export function newTrack({ kind, source, pace, start = today(), position = 0, hymns, section, each, name, parts }) {
    const track = {
        id: Math.random().toString(36).slice(2, 10),
        kind, source, pace, start, position,
        credit: 0, laps: 0, paused: false,
        ...(kind === "hymns" ? { hymns } : {}),
        ...(source === "section" ? { section } : {}),
        ...(kind === "prayer" ? { each } : {}),
        ...(kind === "prayer" && source === "custom" ? { name, parts } : {}),
    };
    state.tracks.push(track);
    // Bible, catechism, prayer, then hymns: the usual order of family worship
    const order = ["bible", "catechism", "prayer", "hymns"];
    state.tracks.sort((a, b) => order.indexOf(a.kind) - order.indexOf(b.kind));
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
