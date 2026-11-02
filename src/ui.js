// Small helpers the screens share.
import { loadUnits } from "./content.js";
import { SOURCES, KINDS } from "./catalog.js";
import { VERSIONS } from "./bible.js";
import { state } from "./store.js";
import { worshipDaysPerWeek } from "./schedule.js";

export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

export const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

export const app = () => $("#app");

// Screens load data before drawing. Each takes a ticket when it starts and draws
// only if no other screen has started since, so a slow load can't paint over
// the page the user has already moved on to.
let ticket = 0;
export const nextRender = () => ++ticket;
export const isCurrent = (t) => t === ticket;

export function setTitle(title) {
    $("#page-title").textContent = title;
    document.title = title === "Family Worship" ? title : `${title} · Family Worship`;
}

// Every unit of a source (and, for a section of Scripture, of that section), worked out once
const units = new Map();
export function sourceUnits(kind, source, section) {
    const key = `${kind}/${source}${section ? `/${section.step}/${section.ref}` : ""}`;
    if (!units.has(key)) units.set(key, loadUnits(kind, source, section).catch((e) => {
        units.delete(key);
        throw e;
    }));
    return units.get(key);
}

// A track's units: its whole source, or for hymns only the ones the family chose
// (track.hymns, a list of hymn ids), kept in Let's Sing's order
export async function unitsOf(track) {
    const all = await sourceUnits(track.kind, track.source, track.section);
    if (track.kind !== "hymns" || !track.hymns) return all;
    const chosen = new Set(track.hymns);
    return all.filter((u) => chosen.has(u.id));
}

export async function totalsFor(tracks) {
    const totals = {};
    await Promise.all(tracks.map(async (t) => {
        try {
            totals[t.id] = (await unitsOf(t)).length;
        } catch (e) {
            console.error(e); // e.g. offline before this source was ever loaded
        }
    }));
    return totals;
}

export const sourceOf = (track) => SOURCES[track.kind][track.source];
export const trackName = (track) => track.section ? `${track.section.ref} by ${track.section.step}` : sourceOf(track)?.name ?? track.source;
export const kindIcon = (track) => KINDS[track.kind].icon;
// What one step of the track is called: "chapter", "question"; a section of Scripture says
export const unitWord = (track) => track.section?.step ?? sourceOf(track)?.unit ?? "unit";

// The family's Bible version (the BSB if a saved one is no longer offered)
export const bibleVersion = () => VERSIONS[state.settings.bibleVersion] ? state.settings.bibleVersion : "bsb";

// <option>s for choosing a version, those kept in the app first; `label` is "name" or "short"
export function versionOptions(current, label) {
    const option = ([v, info]) => `<option value="${v}" ${v === current ? "selected" : ""}>${esc(label === "short" ? info.short : info.name)}</option>`;
    const all = Object.entries(VERSIONS);
    return `<optgroup label="On this device">${all.filter(([, i]) => !isOnline(i)).map(option).join("")}</optgroup>
        <optgroup label="Online (needs internet)">${all.filter(([, i]) => isOnline(i)).map(option).join("")}</optgroup>`;
}
export const isOnline = (info) => !!(info.online || info.esv);

export const plural = (n, word) => `${n} ${word}${n === 1 ? "" : "s"}`;

export function paceText(track) {
    const unit = unitWord(track);
    const { pace } = track;
    if (pace.mode === "goal") {
        const months = Math.round(pace.days / 30.4);
        return months % 12 === 0 ? `Finish in ${plural(months / 12, "year")}` : `Finish in ${plural(months, "month")}`;
    }
    return `${plural(pace.count, unit)} a ${pace.per}`;
}

// "About 3.3 chapters per worship day" / "a new question every 7 worship days"
export function rateText(rate, unit) {
    if (rate >= 1) {
        const r = Math.round(rate * 10) / 10;
        return `${r} ${unit}${r === 1 ? "" : "s"} each worship day`;
    }
    const every = Math.round(1 / rate);
    if (every === 1) return `1 ${unit} each worship day`;
    return every === worshipDaysPerWeek(state.settings.worshipDays) ? `a new ${unit} each week` : `a new ${unit} about every ${every} worship days`;
}

export function toast(message) {
    const el = document.createElement("div");
    el.className = "toast";
    el.textContent = message;
    document.body.append(el);
    setTimeout(() => el.classList.add("show"), 10);
    setTimeout(() => {
        el.classList.remove("show");
        setTimeout(() => el.remove(), 300);
    }, 2600);
}
