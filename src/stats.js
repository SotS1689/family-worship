// Numbers for the Stats page, all worked out from state.log.
// A day off (not one of the family's worship days) neither breaks nor adds to a
// streak unless they worshipped anyway, which then counts.
import { addDays, daysBetween, weekday, weekStart } from "./dates.js";

const isWorshipDay = (day, worshipDays) => worshipDays[weekday(day)];

export function firstDay(log) {
    const days = Object.keys(log).sort();
    return days[0] ?? null;
}

// Consecutive worship days done, ending today (or yesterday, if today isn't done yet)
export function currentStreak(log, worshipDays, day) {
    let streak = 0;
    let d = log[day] ? day : addDays(day, -1);
    const start = firstDay(log);
    if (!start) return 0;
    for (; d >= start; d = addDays(d, -1)) {
        if (log[d]) streak++;
        else if (isWorshipDay(d, worshipDays)) break;
    }
    return streak;
}

export function longestStreak(log, worshipDays, day) {
    const start = firstDay(log);
    if (!start) return 0;
    let best = 0, run = 0;
    for (let d = start; d <= day; d = addDays(d, 1)) {
        if (log[d]) best = Math.max(best, ++run);
        else if (isWorshipDay(d, worshipDays) && d !== day) run = 0; // today isn't missed yet
    }
    return best;
}

// Share of worship days done over the last `days` days (from first use, if more recent)
export function faithfulness(log, worshipDays, day, days) {
    const start = firstDay(log);
    if (!start) return null;
    let from = addDays(day, -(days - 1));
    if (from < start) from = start;
    let planned = 0, done = 0;
    for (let d = from; d <= day; d = addDays(d, 1)) {
        const w = isWorshipDay(d, worshipDays);
        // Today counts once it's done, but isn't held against them before then
        if (d === day && !log[d]) continue;
        if (w) planned++;
        if (log[d]) done++;
    }
    return planned ? Math.min(1, done / planned) : null;
}

// Days done in each of the last `weeks` weeks (Sunday–Saturday), oldest first
export function weeklyCounts(log, day, weeks) {
    const thisWeek = weekStart(day);
    return Array.from({ length: weeks }, (_, i) => {
        const start = addDays(thisWeek, -7 * (weeks - 1 - i));
        let n = 0;
        for (let k = 0; k < 7; k++) if (log[addDays(start, k)]) n++;
        return { start, count: n };
    });
}

export function totals(log) {
    const days = Object.keys(log);
    const byTrack = {};
    for (const d of days) for (const e of log[d].entries) byTrack[e.track] = (byTrack[e.track] ?? 0) + e.count;
    return { days: days.length, byTrack };
}

export const daysSinceStart = (log, day) => {
    const start = firstDay(log);
    return start ? daysBetween(start, day) + 1 : 0;
};

// Streak milestones to celebrate, with the next one to aim for
export const MILESTONES = [3, 7, 14, 30, 50, 100, 200, 365, 500, 1000];
export const nextMilestone = (streak) => MILESTONES.find((m) => m > streak) ?? null;
