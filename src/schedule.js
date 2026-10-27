// How much of each track is due, and what a check-in does.
//
// Every track has a pace in units per worship day (u). Each check-in earns u
// units of "credit"; the whole units of credit are that day's new readings,
// and the fraction carries to the next check-in. So 1 question a week over
// 7 worship days gives a new question every 7th check-in (reviewing the
// current one in between), and 1.5 chapters a day alternates 1 and 2.
//
// Pace comes from either
//   { mode: "rate", count, per: "day" | "week" }  - fixed; a missed day just moves the finish later
//   { mode: "goal", days }                        - finish `days` after the start; recomputed every
//                                                  day from what's left, so missed days are spread out
import { addDays, weekday } from "./dates.js";

const EPS = 1e-9;

export const worshipDaysPerWeek = (worshipDays) => Math.max(1, worshipDays.filter(Boolean).length);

// Worship days from `from` (inclusive) to `to` (exclusive)
export function countWorshipDays(from, to, worshipDays) {
    let n = 0;
    for (let d = from; d < to; d = addDays(d, 1)) if (worshipDays[weekday(d)]) n++;
    return n;
}

export const goalEnd = (track) => addDays(track.start, track.pace.days);

export function unitsPerDay(track, total, day, worshipDays) {
    const { pace } = track;
    if (pace.mode === "rate") return pace.per === "week" ? pace.count / worshipDaysPerWeek(worshipDays) : pace.count;
    const remaining = total - track.position;
    const left = countWorshipDays(day, goalEnd(track), worshipDays);
    // Past the goal date: carry on at the goal's average pace
    if (left <= 0) return total / Math.max(1, countWorshipDays(track.start, goalEnd(track), worshipDays));
    return remaining / left;
}

// What `track` asks for on `day`: new units [from, from + count), or a review of
// the latest one when no new unit is due.
export function assignment(track, total, day, worshipDays) {
    const remaining = total - track.position;
    if (remaining <= 0) return { finished: true, from: track.position, count: 0, review: null, rate: 0 };
    const rate = unitsPerDay(track, total, day, worshipDays);
    // A new track starts on its first unit, however slow its pace
    const count = Math.min(remaining, Math.max(track.position === 0 ? 1 : 0, Math.floor(track.credit + rate + EPS)));
    return {
        finished: false,
        from: track.position,
        count,
        review: count === 0 && track.position > 0 ? track.position - 1 : null,
        rate,
    };
}

// Marks `day` done: advances every active track by its assignment and logs what was done.
// `totals` maps track id -> number of units in that track's source.
export function checkIn(state, day, totals) {
    if (state.log[day]) return;
    const entries = [];
    for (const track of state.tracks) {
        if (track.paused || totals[track.id] == null) continue;
        const a = assignment(track, totals[track.id], day, state.settings.worshipDays);
        if (a.finished) continue;
        entries.push({ track: track.id, from: a.from, count: a.count, review: a.review, credit: track.credit });
        track.position += a.count;
        track.credit = Math.max(0, track.credit + a.rate - a.count);
    }
    state.log[day] = { at: Date.now(), entries };
}

// Takes back a check-in, restoring the tracks it moved. Only safe for the most
// recent check-in of each track, so the app offers it for today only.
export function undoCheckIn(state, day) {
    const done = state.log[day];
    if (!done) return;
    for (const e of done.entries) {
        const track = state.tracks.find((t) => t.id === e.track);
        if (!track) continue;
        track.position = e.from;
        track.credit = e.credit;
    }
    delete state.log[day];
}

// The date the track should finish at its current pace (null if it never will)
export function projectedFinish(track, total, day, worshipDays) {
    if (track.position >= total) return day;
    if (track.pace.mode === "goal" && day < goalEnd(track)) return addDays(goalEnd(track), -1);
    const rate = unitsPerDay(track, total, day, worshipDays);
    if (rate <= 0) return null;
    let need = (total - track.position - track.credit) / rate;
    let d = day;
    for (let i = 0; i < 365 * 30; i++, d = addDays(d, 1)) {
        if (worshipDays[weekday(d)] && --need <= EPS) return d;
    }
    return null;
}
