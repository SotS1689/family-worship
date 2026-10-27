import { test } from "node:test";
import assert from "node:assert/strict";
import { assignment, checkIn, undoCheckIn, projectedFinish } from "../src/schedule.js";
import { currentStreak, longestStreak, faithfulness } from "../src/stats.js";
import { addDays } from "../src/dates.js";
import { parseReference, passagesLabel } from "../src/bible.js";

const ALL = [true, true, true, true, true, true, true];
const track = (pace, extra = {}) => ({ id: "t", kind: "bible", source: "straight", pace, start: "2026-01-04", position: 0, credit: 0, laps: 0, ...extra });
const stateWith = (...tracks) => ({ settings: { worshipDays: ALL }, tracks, log: {} });

function runDays(state, totals, first, n) {
    for (let i = 0; i < n; i++) checkIn(state, addDays(first, i), totals);
}

test("one chapter a day advances one chapter per check-in", () => {
    const s = stateWith(track({ mode: "rate", count: 1, per: "day" }));
    runDays(s, { t: 1189 }, "2026-01-04", 10);
    assert.equal(s.tracks[0].position, 10);
});

test("one question a week: new question on day 1, then every 7th check-in, review between", () => {
    const s = stateWith(track({ mode: "rate", count: 1, per: "week" }));
    const news = [];
    for (let i = 0; i < 21; i++) {
        const day = addDays("2026-01-04", i);
        const a = assignment(s.tracks[0], 107, day, ALL);
        if (a.count) news.push(i);
        else assert.equal(a.review, s.tracks[0].position - 1);
        checkIn(s, day, { t: 107 });
    }
    assert.deepEqual(news, [0, 7, 14]);
});

test("two hymns a week gives exactly two per 7 check-ins", () => {
    const s = stateWith(track({ mode: "rate", count: 2, per: "week" }));
    runDays(s, { t: 547 }, "2026-01-04", 70);
    assert.ok(Math.abs(s.tracks[0].position - 20) <= 1, `got ${s.tracks[0].position}`);
});

test("goal of one year finishes the Bible on time with daily check-ins", () => {
    const s = stateWith(track({ mode: "goal", days: 365 }));
    runDays(s, { t: 1189 }, "2026-01-04", 365);
    assert.equal(s.tracks[0].position, 1189);
});

test("goal pace spreads out missed days", () => {
    const s = stateWith(track({ mode: "goal", days: 100 }));
    runDays(s, { t: 100 }, "2026-01-04", 10);
    const after = assignment(s.tracks[0], 100, "2026-02-03", ALL); // 20 days missed
    assert.ok(after.rate > 1, `rate ${after.rate}`);
});

test("only worship days count toward a weekly pace", () => {
    const sundaysOff = [false, true, true, true, true, true, true];
    const s = stateWith(track({ mode: "rate", count: 6, per: "week" }));
    s.settings.worshipDays = sundaysOff;
    assert.equal(assignment(s.tracks[0], 100, "2026-01-05", sundaysOff).count, 1);
});

test("undo restores position and credit", () => {
    const s = stateWith(track({ mode: "rate", count: 1, per: "week" }));
    runDays(s, { t: 107 }, "2026-01-04", 3);
    const before = structuredClone(s.tracks[0]);
    checkIn(s, "2026-01-07", { t: 107 });
    undoCheckIn(s, "2026-01-07");
    assert.deepEqual(s.tracks[0], before);
    assert.equal(s.log["2026-01-07"], undefined);
});

test("projected finish for a goal track is the goal date", () => {
    const t = track({ mode: "goal", days: 365 });
    assert.equal(projectedFinish(t, 1189, "2026-01-04", ALL), "2027-01-03");
});

test("streaks skip days off and survive an unfinished today", () => {
    const sundaysOff = [false, true, true, true, true, true, true];
    const log = {};
    // Mon 2026-01-05 .. Sat 01-10 done, Sun 01-11 off, Mon 01-12 done; today Tue 01-13 not yet
    for (const d of ["05", "06", "07", "08", "09", "10", "12"]) log[`2026-01-${d}`] = { entries: [] };
    assert.equal(currentStreak(log, sundaysOff, "2026-01-13"), 7);
    assert.equal(currentStreak(log, ALL, "2026-01-13"), 1);
    assert.equal(longestStreak(log, sundaysOff, "2026-01-13"), 7);
    assert.equal(faithfulness(log, sundaysOff, "2026-01-13", 30), 1);
});

test("plan references parse", () => {
    assert.equal(passagesLabel(parseReference("Genesis 9-10")), "Genesis 9–10");
    assert.equal(passagesLabel(parseReference("Psalm 119:1-24")), "Psalm 119:1–24");
    assert.equal(passagesLabel(parseReference("Psalm 46, 80, 135")), "Psalm 46; Psalm 80; Psalm 135");
    assert.equal(passagesLabel(parseReference("Obadiah; Psalm 82-83")), "Obadiah; Psalm 82–83");
    assert.equal(parseReference("2 Sam10")[0].book, "2SA");
});
