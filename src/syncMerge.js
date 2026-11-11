// How two copies of the family's data become one (used by src/sync.js; no
// browser or Firebase here, so tests can run it).
//
// The data is cut into items: the shared settings (everything but the theme,
// which belongs to each device), the order of the plans, each plan, and each
// day of the log. Every item carries `at`, when it last changed on the device
// that changed it, and for each item the later change wins. A plan or day
// that was removed is kept as { at, gone: true }, so removing it on one device
// removes it on the others instead of the others bringing it back.
//
//   item:      { at, json }  or  { at, gone: true }
//   versioned: { settings: item, order: item, tracks: { <id>: item }, log: { <YYYY-MM-DD>: item } }
//
// Stamps (kept on each device) record what was last seen and when each item
// changed:  { snap: snapshot(state), at: { settings, order, tracks: {}, log: {} },
//             gone: { tracks: { <id>: at }, log: { <day>: at } } }

const KIND_ORDER = ["bible", "catechism", "creeds", "prayer", "hymns"];

/** JSON with keys in order, so the same data always compares equal. */
export function stable(v) {
    if (Array.isArray(v)) return `[${v.map(stable).join(",")}]`;
    if (v && typeof v === "object") {
        return `{${Object.keys(v).sort().filter((k) => v[k] !== undefined).map((k) => `${JSON.stringify(k)}:${stable(v[k])}`).join(",")}}`;
    }
    return JSON.stringify(v ?? null);
}

const sharedSettings = ({ theme, ...rest }) => rest;
const mapValues = (obj, fn) => Object.fromEntries(Object.entries(obj).map(([k, v]) => [k, fn(v, k)]));

/** Each item of `state` as JSON text. */
export function snapshot(state) {
    return {
        settings: stable(sharedSettings(state.settings)),
        order: stable(state.tracks.map((t) => t.id)),
        tracks: Object.fromEntries(state.tracks.map((t) => [t.id, stable(t)])),
        log: mapValues(state.log, (day) => stable(day)),
    };
}

/**
 * New stamps after `state` was saved: anything different from the last
 * snapshot changed `now`. With no earlier stamps (the first time), nothing is
 * new: the plans and settings count as changed long ago, and each day as
 * changed when it was checked.
 */
export function stampChanges(state, prev, now) {
    const snap = snapshot(state);
    if (!prev) {
        return {
            snap,
            at: { settings: 0, order: 0, tracks: mapValues(snap.tracks, () => 0), log: mapValues(state.log, (d) => d.at ?? 0) },
            gone: { tracks: {}, log: {} },
        };
    }
    const at = {
        settings: snap.settings === prev.snap.settings ? prev.at.settings : now,
        order: snap.order === prev.snap.order ? prev.at.order : now,
        tracks: {},
        log: {},
    };
    const gone = { tracks: { ...prev.gone.tracks }, log: { ...prev.gone.log } };
    for (const kind of ["tracks", "log"]) {
        for (const [id, json] of Object.entries(snap[kind])) {
            at[kind][id] = json === prev.snap[kind][id] ? prev.at[kind][id] ?? 0 : now;
            delete gone[kind][id];
        }
        for (const id of Object.keys(prev.snap[kind])) if (!(id in snap[kind])) gone[kind][id] = now;
    }
    return { snap, at, gone };
}

/** The device's data as versioned items, from its stamps. */
export function versioned(stamps) {
    const items = (kind) => ({
        ...mapValues(stamps.gone[kind], (at) => ({ at, gone: true })),
        ...mapValues(stamps.snap[kind], (json, id) => ({ at: stamps.at[kind][id] ?? 0, json })),
    });
    return {
        settings: { at: stamps.at.settings, json: stamps.snap.settings },
        order: { at: stamps.at.order, json: stamps.snap.order },
        tracks: items("tracks"),
        log: items("log"),
    };
}

// The later change wins; on a tie, `there` (the account) does
const pick = (here, there) => (!here ? there : !there ? here : here.at > there.at ? here : there);
const pickEach = (here = {}, there = {}) => {
    const out = {};
    for (const id of new Set([...Object.keys(here), ...Object.keys(there)])) out[id] = pick(here[id], there[id]);
    return out;
};

/** Two versioned copies as one. `there` may be partly or wholly empty (a new account). */
export function merge(here, there = {}) {
    return {
        settings: pick(here.settings, there.settings),
        order: pick(here.order, there.order),
        tracks: pickEach(here.tracks, there.tracks),
        log: pickEach(here.log, there.log),
    };
}

/**
 * Makes `state` match `merged`, changing it in place (plan objects are kept
 * where they still exist, so a screen holding one keeps working), and returns
 * the stamps that go with it. The theme stays this device's own.
 */
export function applyMerged(state, merged) {
    const settings = JSON.parse(merged.settings.json);
    for (const k of Object.keys(state.settings)) if (k !== "theme" && !(k in settings)) delete state.settings[k];
    Object.assign(state.settings, settings);

    const byId = new Map(state.tracks.map((t) => [t.id, t]));
    const order = JSON.parse(merged.order.json);
    const rank = (t) => {
        const i = order.indexOf(t.id);
        return i === -1 ? order.length + KIND_ORDER.indexOf(t.kind) : i;
    };
    const tracks = Object.entries(merged.tracks).filter(([, v]) => !v.gone).map(([id, v]) => {
        const data = JSON.parse(v.json);
        const t = byId.get(id);
        if (!t) return data;
        for (const k of Object.keys(t)) delete t[k];
        return Object.assign(t, data);
    });
    tracks.sort((a, b) => rank(a) - rank(b));
    state.tracks.splice(0, state.tracks.length, ...tracks);

    for (const day of Object.keys(state.log)) if (!merged.log[day] || merged.log[day].gone) delete state.log[day];
    for (const [day, v] of Object.entries(merged.log)) if (!v.gone) state.log[day] = JSON.parse(v.json);

    const ats = (kind) => Object.fromEntries(Object.entries(merged[kind]).filter(([, v]) => !v.gone).map(([id, v]) => [id, v.at]));
    const gones = (kind) => Object.fromEntries(Object.entries(merged[kind]).filter(([, v]) => v.gone).map(([id, v]) => [id, v.at]));
    return {
        snap: snapshot(state),
        at: { settings: merged.settings.at, order: merged.order.at, tracks: ats("tracks"), log: ats("log") },
        gone: { tracks: gones("tracks"), log: gones("log") },
    };
}

/** The years a versioned log has days in (each year is its own cloud document). */
export const yearsOf = (log) => [...new Set(Object.keys(log).map((day) => day.slice(0, 4)))].sort();
