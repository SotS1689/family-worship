import { test } from "node:test";
import assert from "node:assert/strict";
import { stampChanges, versioned, merge, applyMerged, snapshot } from "../src/syncMerge.js";

const ALL = [true, true, true, true, true, true, true];
const track = (id, extra = {}) => ({ id, kind: "bible", source: "straight", pace: { mode: "rate", count: 1, per: "day" }, start: "2026-01-04", position: 0, credit: 0, laps: 0, paused: false, ...extra });
const fresh = () => ({ version: 1, settings: { bibleVersion: "bsb", worshipDays: [...ALL], theme: "auto" }, tracks: [], log: {} });
const clone = (s) => JSON.parse(JSON.stringify(s));

// A device: its state and stamps, saving the way the app does
function device(state = fresh(), t0 = 1) {
    const d = { state, stamps: stampChanges(state, null, t0), clock: t0 };
    d.save = (at) => (d.stamps = stampChanges(d.state, d.stamps, (d.clock = at)));
    return d;
}

// One sync of a device against a cloud copy (a versioned object), as sync.js does
function syncDevice(d, cloud) {
    const merged = merge(versioned(d.stamps), cloud.data);
    d.stamps = applyMerged(d.state, merged);
    cloud.data = versioned(d.stamps);
    // What's uploaded is exactly the merge
    assert.equal(JSON.stringify(Object.keys(cloud.data.tracks).sort()), JSON.stringify(Object.keys(merged.tracks).sort()));
}

test("nothing saved since the last stamp: nothing changes", () => {
    const d = device();
    d.state.tracks.push(track("a"));
    d.save(5);
    const before = JSON.stringify(d.stamps);
    d.save(9);
    assert.equal(JSON.stringify(d.stamps), before);
    assert.equal(d.stamps.at.tracks.a, 5);
});

test("a new device signing in gets the account's plans and log", () => {
    const cloud = { data: {} };
    const phone = device();
    phone.state.tracks.push(track("a", { position: 4 }));
    phone.state.log["2026-11-10"] = { at: 100, entries: [{ track: "a", from: 3, count: 1 }] };
    phone.save(100);
    syncDevice(phone, cloud);

    const tablet = device();
    syncDevice(tablet, cloud);
    assert.equal(tablet.state.tracks.length, 1);
    assert.equal(tablet.state.tracks[0].position, 4);
    assert.ok(tablet.state.log["2026-11-10"]);
});

test("both devices had plans before signing in: they're combined", () => {
    const cloud = { data: {} };
    const phone = device();
    phone.state.tracks.push(track("a"));
    phone.state.log["2026-11-01"] = { at: 50, entries: [] };
    phone.save(50);
    const tablet = device();
    tablet.state.tracks.push(track("b", { kind: "catechism" }));
    tablet.state.log["2026-11-02"] = { at: 60, entries: [] };
    tablet.save(60);

    syncDevice(phone, cloud);
    syncDevice(tablet, cloud);
    syncDevice(phone, cloud);
    for (const d of [phone, tablet]) {
        assert.deepEqual(d.state.tracks.map((t) => t.id).sort(), ["a", "b"]);
        assert.deepEqual(Object.keys(d.state.log).sort(), ["2026-11-01", "2026-11-02"]);
    }
});

test("the later change to a plan wins, and the other device's plan object is updated in place", () => {
    const cloud = { data: {} };
    const phone = device();
    phone.state.tracks.push(track("a"));
    phone.save(10);
    syncDevice(phone, cloud);
    const tablet = device();
    syncDevice(tablet, cloud);
    const held = tablet.state.tracks[0]; // e.g. an open plan form holds this

    tablet.state.tracks[0].position = 2;
    tablet.save(20);
    phone.state.tracks[0].position = 7;
    phone.save(30);
    syncDevice(tablet, cloud);
    syncDevice(phone, cloud);
    syncDevice(tablet, cloud);
    assert.equal(tablet.state.tracks[0].position, 7);
    assert.equal(phone.state.tracks[0].position, 7);
    assert.equal(held, tablet.state.tracks[0]);
});

test("a plan or day removed on one device stays removed on the other", () => {
    const cloud = { data: {} };
    const phone = device();
    phone.state.tracks.push(track("a"), track("b"));
    phone.state.log["2026-11-11"] = { at: 10, entries: [] };
    phone.save(10);
    syncDevice(phone, cloud);
    const tablet = device();
    syncDevice(tablet, cloud);

    phone.state.tracks.splice(0, 1); // delete plan a
    delete phone.state.log["2026-11-11"]; // undo today's check
    phone.save(20);
    syncDevice(phone, cloud);
    syncDevice(tablet, cloud);
    assert.deepEqual(tablet.state.tracks.map((t) => t.id), ["b"]);
    assert.deepEqual(tablet.state.log, {});
    // And the tablet doesn't bring them back on its next sync
    syncDevice(tablet, cloud);
    syncDevice(phone, cloud);
    assert.deepEqual(phone.state.tracks.map((t) => t.id), ["b"]);
});

test("a check-off on each device on different days: both days are kept", () => {
    const cloud = { data: {} };
    const phone = device();
    phone.state.tracks.push(track("a"));
    phone.save(1);
    syncDevice(phone, cloud);
    const tablet = device();
    syncDevice(tablet, cloud);

    phone.state.log["2026-11-10"] = { at: 100, entries: [{ track: "a", from: 0, count: 1 }] };
    phone.state.tracks[0].position = 1;
    phone.save(100);
    tablet.state.log["2026-11-11"] = { at: 200, entries: [{ track: "a", from: 0, count: 1 }] };
    tablet.state.tracks[0].position = 1;
    tablet.save(200);
    syncDevice(phone, cloud);
    syncDevice(tablet, cloud);
    syncDevice(phone, cloud);
    for (const d of [phone, tablet]) assert.deepEqual(Object.keys(d.state.log).sort(), ["2026-11-10", "2026-11-11"]);
});

test("the theme stays each device's own; other settings are shared", () => {
    const cloud = { data: {} };
    const phone = device();
    phone.state.settings.theme = "dark";
    phone.state.settings.bibleVersion = "kjv";
    phone.save(10);
    syncDevice(phone, cloud);
    const tablet = device();
    tablet.state.settings.theme = "light";
    tablet.save(5);
    syncDevice(tablet, cloud);
    assert.equal(tablet.state.settings.theme, "light");
    assert.equal(tablet.state.settings.bibleVersion, "kjv");
});

test("syncWith reads and writes Firestore as expected (stand-in Firestore)", async () => {
    const store = new Map();
    globalThis.localStorage = {
        m: new Map(),
        getItem(k) { return this.m.has(k) ? this.m.get(k) : null; },
        setItem(k, v) { this.m.set(k, String(v)); },
        removeItem(k) { this.m.delete(k); },
    };
    const { state, save } = await import("../src/store.js");
    const { syncWith } = await import("../src/sync.js");
    state.tracks.push(track("a"));
    state.log["2026-11-11"] = { at: Date.now(), entries: [] };
    save();

    const ref = (...path) => ({ path: path.join("/") });
    const f = {
        db: {},
        doc: (db, ...path) => ref(...path),
        runTransaction: async (db, fn) => fn({
            get: async (r) => ({ exists: () => store.has(r.path), data: () => clone(store.get(r.path)) }),
            set: (r, data) => store.set(r.path, clone(data)),
        }),
    };
    const changed = await syncWith(f, "u1");
    assert.equal(changed, false); // the account was empty: nothing new for this device
    assert.deepEqual(store.get("users/u1").years, ["2026"]);
    assert.ok(store.get("users/u1").tracks.a.json);
    assert.ok(store.get("users/u1/years/2026").days["2026-11-11"]);

    // Another device adds a plan to the account
    const other = device(clone(state), 1);
    other.stamps = applyMerged(other.state, merge(versioned(other.stamps), { ...store.get("users/u1"), log: store.get("users/u1/years/2026").days }));
    other.state.tracks.push(track("b", { kind: "hymns" }));
    other.save(Date.now() + 1000);
    const v = versioned(other.stamps);
    store.set("users/u1", { settings: v.settings, order: v.order, tracks: v.tracks, years: ["2026"] });

    assert.equal(await syncWith(f, "u1"), true);
    assert.deepEqual(state.tracks.map((t) => t.id), ["a", "b"]);
    assert.equal(snapshot(state).order, JSON.stringify(["a", "b"]));
});
