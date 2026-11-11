// Today: what each track asks for, and the one big check mark.
import { state, save } from "../store.js";
import { today, formatDay } from "../dates.js";
import { assignment, checkIn, undoCheckIn, repeats } from "../schedule.js";
import { currentStreak, nextMilestone } from "../stats.js";
import { app, esc, setTitle, unitsOf, totalsFor, trackName, kindIcon, toast, nextRender, isCurrent } from "../ui.js";

export async function renderToday() {
    const ticket = nextRender();
    setTitle("Family Worship");
    const day = today();
    const done = state.log[day];
    const tracks = state.tracks.filter((t) => !t.paused);

    if (!state.tracks.length) {
        app().innerHTML = `
            <section class="welcome card">
                <h2>Welcome</h2>
                <p>Choose what your family will go through together: a Bible reading plan, a catechism, a creed or confession, a prayer plan, and hymns.
                   Set a goal or a pace for each, then tap the check mark each day you worship together.</p>
                <a class="btn primary" href="#/plans/new">Set up family worship</a>
            </section>`;
        return;
    }

    const totals = await totalsFor(tracks);
    // After checking in, show what was done; before, what's due.
    const items = await Promise.all(tracks.map(async (track) => {
        const units = await unitsOf(track).catch(() => null);
        if (!units) return { track, error: true };
        if (done) {
            const e = done.entries.find((x) => x.track === track.id);
            return e ? { track, units, from: e.from, count: e.count, review: e.review } : { track, units, count: 0, review: null, skipped: true };
        }
        return { track, units, ...assignment(track, totals[track.id], day, state.settings.worshipDays) };
    }));

    if (!isCurrent(ticket)) return;
    const streak = currentStreak(state.log, state.settings.worshipDays, day);
    const goal = nextMilestone(streak);

    app().innerHTML = `
        <section class="today-head">
            <div>
                <p class="date">${esc(formatDay(day, { weekday: "long", month: "long", day: "numeric" }))}</p>
                <p class="muted">${state.settings.worshipDays[new Date().getDay()] ? "" : "A day off — but you're welcome to worship anyway."}</p>
            </div>
            <a class="streak" href="#/stats" aria-label="Current streak">
                <span class="flame">🔥</span><strong>${streak}</strong><small>day${streak === 1 ? "" : "s"}</small>
            </a>
        </section>
        <ul class="assignments">
            ${items.map(itemHtml).join("")}
        </ul>
        <section class="check-area">
            ${done ? `
                <button class="check done" id="undo" aria-label="Done for today. Tap to undo.">
                    <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 16.2 4.8 12l-1.4 1.4L9 19 21 7l-1.4-1.4z"/></svg>
                </button>
                <p><strong>Done for today.</strong> ${goal ? `${goal - streak} more to reach a ${goal}-day streak.` : ""}</p>
                <p class="muted small">Tapped by mistake? Tap the check again to undo.</p>
            ` : `
                <button class="check" id="check" aria-label="Mark today's worship done">
                    <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 16.2 4.8 12l-1.4 1.4L9 19 21 7l-1.4-1.4z"/></svg>
                </button>
                <p>Tap when you've finished today's worship.</p>
            `}
        </section>`;

    document.getElementById("check")?.addEventListener("click", async () => {
        checkIn(state, day, await totalsFor(tracks));
        save();
        const s = currentStreak(state.log, state.settings.worshipDays, day);
        toast(s > 1 ? `🔥 ${s}-day streak!` : "Well done!");
        renderToday();
    });
    document.getElementById("undo")?.addEventListener("click", () => {
        if (!confirm("Undo today's check mark?")) return;
        undoCheckIn(state, day);
        save();
        renderToday();
    });
}

function itemHtml({ track, units, from, count, review, finished, skipped, error }) {
    const head = `<span class="icon">${kindIcon(track)}</span><span class="track-name">${esc(trackName(track))}</span>`;
    if (error) return `<li class="card">${head}<p class="muted">Couldn't load this — check your connection.</p></li>`;
    if (finished) return `<li class="card">${head}<p>🎉 Finished! <a href="#/plans/${track.id}">Start again or choose another</a>.</p></li>`;
    if (skipped) return `<li class="card">${head}<p class="muted">Nothing recorded today.</p></li>`;
    if (track.kind === "prayer") {
        const unit = units[from % units.length];
        if (unit.passages) return `<li class="card">${head}<div class="units"><a class="unit" href="#/read/${track.id}/${from % units.length}">${
            esc(`Pray: ${unit.label}`)}</a></div></li>`;
        const about = unit.parts.length > 1 ? unit.parts.map((p) => p.title).filter(Boolean).join(" · ") : unit.parts[0].prompt;
        return `<li class="card">${head}<div class="units"><a class="unit" href="#/read/${track.id}/${from % units.length}">${
            esc(unit.parts.length > 1 ? "Pray together" : `Pray: ${unit.label}`)}</a></div>${about ? `<p class="preview">${esc(about)}</p>` : ""}</li>`;
    }
    // A creed said together, whole or an article at a time
    if (repeats(track)) {
        const i = from % units.length, unit = units[i];
        return `<li class="card">${head}<div class="units"><a class="unit" href="#/read/${track.id}/${i}">${
            esc(unit.preview ? unit.label : "Say it together")}</a></div>${unit.preview ? `<p class="preview">${esc(unit.preview)}</p>` : ""}</li>`;
    }
    const links = [];
    for (let i = from; i < from + count; i++) links.push(`<a class="unit" href="#/read/${track.id}/${i}">${esc(units[i].label)}</a>`);
    if (review != null) links.push(`<a class="unit review" href="#/read/${track.id}/${review}">Review: ${esc(units[review].label)}</a>`);
    if (!links.length) links.push(`<span class="muted">Nothing new today.</span>`);
    const preview = !count ? "" : track.kind === "catechism" ? `<p class="preview">${esc(units[from].q)}</p>`
        : track.kind === "creeds" && units[from].preview ? `<p class="preview">${esc(units[from].preview)}</p>` : "";
    return `<li class="card">${head}<div class="units">${links.join("")}</div>${preview}</li>`;
}
