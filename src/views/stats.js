// Stats: streaks, how often, and how far along each plan is.
import { state, save } from "../store.js";
import { today, addDays, formatDay, weekStart } from "../dates.js";
import { projectedFinish } from "../schedule.js";
import { currentStreak, longestStreak, faithfulness, weeklyCounts, totals, nextMilestone, MILESTONES, firstDay } from "../stats.js";
import { app, esc, setTitle, totalsFor, trackName, kindIcon, unitWord, plural, nextRender, isCurrent } from "../ui.js";

const CALENDAR_WEEKS = 18;
const pct = (x) => (x == null ? "—" : `${Math.round(x * 100)}%`);

export async function renderStats() {
    const ticket = nextRender();
    setTitle("Stats");
    const day = today();
    const { log, settings: { worshipDays } } = state;
    const streak = currentStreak(log, worshipDays, day);
    const best = longestStreak(log, worshipDays, day);
    const next = nextMilestone(streak);
    const prev = [...MILESTONES].reverse().find((m) => m <= streak) ?? 0;
    const weeks = weeklyCounts(log, day, 12);
    const maxWeek = Math.max(7, ...weeks.map((w) => w.count));
    const all = totals(log);
    const unitTotals = await totalsFor(state.tracks);
    if (!isCurrent(ticket)) return;

    app().innerHTML = `
        <section class="stat-hero card">
            <div class="big"><span class="flame">🔥</span>${streak}</div>
            <p>day${streak === 1 ? "" : "s"} in a row</p>
            ${next ? `<div class="bar" aria-label="Progress to ${next}-day streak"><span style="width:${(100 * (streak - prev)) / (next - prev)}%"></span></div>
                      <p class="muted small">${next - streak} to go for ${next} days</p>` : ""}
        </section>

        <section class="tiles">
            <div class="tile"><strong>${best}</strong><span>Longest streak</span></div>
            <div class="tile"><strong>${all.days}</strong><span>Days of worship</span></div>
            <div class="tile"><strong>${pct(faithfulness(log, worshipDays, day, 30))}</strong><span>Last 30 days</span></div>
            <div class="tile"><strong>${pct(faithfulness(log, worshipDays, day, 365))}</strong><span>Last year</span></div>
        </section>

        <section class="card">
            <h2>Days per week</h2>
            <div class="weeks" role="img" aria-label="Days of worship in each of the last 12 weeks">
                ${weeks.map((w) => `<div class="week" title="Week of ${esc(formatDay(w.start, { month: "short", day: "numeric" }))}: ${w.count}">
                    <span class="n">${w.count || ""}</span><span class="col" style="height:${(100 * w.count) / maxWeek}%"></span></div>`).join("")}
            </div>
            <p class="muted small">Last 12 weeks, this week on the right.</p>
        </section>

        <section class="card">
            <h2>Calendar</h2>
            ${calendarHtml(day)}
            <p class="muted small">Forgot to tap on a past day? Tap that day here to mark it.</p>
        </section>

        <section class="card">
            <h2>Progress</h2>
            <ul class="progress">
                ${state.tracks.map((t) => {
                    const total = unitTotals[t.id];
                    if (!total) return "";
                    const finish = !t.paused && projectedFinish(t, total, day, worshipDays);
                    const unit = unitWord(t);
                    return `<li>
                        <p><span class="icon">${kindIcon(t)}</span> ${esc(trackName(t))}</p>
                        <div class="bar"><span style="width:${(100 * t.position) / total}%"></span></div>
                        <p class="muted small">${plural(all.byTrack[t.id] ?? 0, unit)} so far · ${total - t.position} left
                            ${finish && t.position < total ? ` · finish ≈ ${esc(formatDay(finish, { month: "short", day: "numeric", year: "numeric" }))}` : ""}</p>
                    </li>`;
                }).join("")}
            </ul>
        </section>`;

    for (const cell of app().querySelectorAll(".cal [data-day]")) {
        cell.addEventListener("click", () => toggleDay(cell.dataset.day, day));
    }
}

function calendarHtml(day) {
    const { log, settings: { worshipDays } } = state;
    const first = addDays(weekStart(day), -7 * (CALENDAR_WEEKS - 1));
    const began = firstDay(log) ?? day;
    const cols = [];
    for (let w = 0; w < CALENDAR_WEEKS; w++) {
        const cells = [];
        for (let d = 0; d < 7; d++) {
            const date = addDays(first, w * 7 + d);
            if (date > day) {
                cells.push(`<span class="cell future"></span>`);
                continue;
            }
            // Days before the family started aren't shown as missed
            const cls = log[date] ? "done" : date < began ? "before" : worshipDays[d] ? "missed" : "off";
            const label = `${formatDay(date)}: ${log[date] ? "worshipped" : worshipDays[d] ? "not marked" : "day off"}`;
            cells.push(`<button class="cell ${cls}${date === day ? " today" : ""}" data-day="${date}" title="${esc(label)}" aria-label="${esc(label)}"></button>`);
        }
        cols.push(`<div class="cal-col">${cells.join("")}</div>`);
    }
    return `<div class="cal">${cols.join("")}</div>`;
}

// Past days only: a check mark with no readings recorded (the plans don't move,
// so today's readings stay what they were). Today is checked on the Today page.
function toggleDay(date, day) {
    if (date === day) return (location.hash = "#/");
    const entry = state.log[date];
    if (entry && !entry.late) return alert("This day's readings were checked off on the Today page, so it stays marked.");
    if (entry) delete state.log[date];
    else state.log[date] = { at: Date.now(), entries: [], late: true };
    save();
    renderStats();
}
