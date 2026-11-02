// Plans: the family's tracks, and the form to add or change one.
import { state, save, newTrack } from "../store.js";
import { today, formatDay } from "../dates.js";
import { unitsPerDay, projectedFinish } from "../schedule.js";
import { KINDS, SOURCES, GOALS } from "../catalog.js";
import { app, $, esc, setTitle, unitsOf, sourceUnits, totalsFor, trackName, kindIcon, paceText, rateText, unitWord, plural, nextRender, isCurrent, toast } from "../ui.js";

export async function renderPlans() {
    const ticket = nextRender();
    setTitle("Plans");
    const day = today();
    const totals = await totalsFor(state.tracks);
    if (!isCurrent(ticket)) return;
    app().innerHTML = `
        <ul class="tracks">
            ${state.tracks.map((t) => {
                const total = totals[t.id];
                const pct = total ? Math.round((100 * t.position) / total) : 0;
                const finish = total && !t.paused ? projectedFinish(t, total, day, state.settings.worshipDays) : null;
                return `<li class="card">
                    <a class="track-link" href="#/plans/${t.id}">
                        <span class="icon">${kindIcon(t)}</span>
                        <span class="track-name">${esc(trackName(t))}</span>
                        <span class="muted small">${t.paused ? "Paused" : esc(paceText(t))}</span>
                    </a>
                    <div class="bar" role="progressbar" aria-valuenow="${pct}" aria-valuemin="0" aria-valuemax="100"><span style="width:${pct}%"></span></div>
                    <p class="muted small">${total ? `${t.position} of ${plural(total, unitWord(t))} · ${pct}%` : ""}
                        ${finish && t.position < total ? ` · on pace to finish ${esc(formatDay(finish, { month: "short", day: "numeric", year: "numeric" }))}` : ""}
                        ${t.laps ? ` · completed ${t.laps}×` : ""}</p>
                </li>`;
            }).join("")}
        </ul>
        <a class="btn primary wide" href="#/plans/new">＋ Add a plan</a>`;
}

// Where the form starts for each kind: a year through the Bible; a catechism question
// and two hymns a week (a goal makes little sense for a short list of chosen hymns)
const DEFAULT_PACE = {
    bible: { mode: "goal", days: 365 },
    catechism: { mode: "rate", count: 1, per: "week" },
    hymns: { mode: "rate", count: 2, per: "week" },
};
// A part of the Bible may be short, so it starts at one step a day rather than a goal
const SECTION_PACE = { mode: "rate", count: 1, per: "day" };
const STEPS = ["verse", "paragraph", "chapter"];

// New (trackId undefined) or edit
export async function renderPlanForm(trackId) {
    const ticket = nextRender();
    const editing = trackId ? state.tracks.find((t) => t.id === trackId) : null;
    if (trackId && !editing) return (location.hash = "#/plans");
    setTitle(editing ? "Edit plan" : "Add a plan");

    const draft = editing ? structuredClone(editing) : {
        kind: "bible", source: "straight", pace: DEFAULT_PACE.bible, position: 0, start: today(),
    };
    const firstAvailable = (kind) => Object.keys(SOURCES[kind]).find((k) => !SOURCES[kind][k].unavailable);

    app().innerHTML = `
        <form class="plan-form" id="form">
            <fieldset ${editing ? "disabled" : ""}>
                <legend>What</legend>
                <div class="seg wide" id="kinds">
                    ${Object.entries(KINDS).map(([k, v]) => `<button type="button" data-kind="${k}">${v.icon} ${esc(v.name)}</button>`).join("")}
                </div>
                <select id="source" aria-label="Which"></select>
                <p class="muted small" id="about"></p>
            </fieldset>
            <fieldset id="section-pick" hidden ${editing ? "disabled" : ""}>
                <legend>Which part</legend>
                <input type="text" id="section-ref" placeholder="Romans · Matthew 5–7 · Genesis–Deuteronomy" aria-label="Part of the Bible" autocomplete="off" spellcheck="false">
                <p class="muted small" id="section-note"></p>
                <p class="small">Read it a step at a time, by</p>
                <div class="seg wide" id="steps">
                    ${STEPS.map((s) => `<button type="button" data-step="${s}">${s[0].toUpperCase()}${s.slice(1)}</button>`).join("")}
                </div>
            </fieldset>
            <fieldset id="hymn-pick" hidden>
                <legend>Which hymns</legend>
                <input type="search" id="hymn-search" placeholder="Search title, tune or number" aria-label="Search hymns">
                <div class="pick-bar">
                    <span id="hymn-count"></span>
                    <label class="small"><input type="checkbox" id="chosen-only"> Show chosen only</label>
                </div>
                <div class="pick-bar">
                    <button type="button" class="btn small" id="choose-shown">Choose all shown</button>
                    <button type="button" class="btn small" id="clear-shown">Clear all shown</button>
                </div>
                <ul class="pick-list" id="hymn-list"></ul>
            </fieldset>
            <fieldset>
                <legend>How fast</legend>
                <label class="radio"><input type="radio" name="mode" value="goal"> Finish in
                    <select id="goal">${GOALS.map((g) => `<option value="${g.days}">${g.label}</option>`).join("")}</select>
                </label>
                <label class="radio"><input type="radio" name="mode" value="rate">
                    <input type="number" id="count" min="1" max="50" value="1" inputmode="numeric">
                    <span id="unit-word"></span> each
                    <select id="per"><option value="day">day</option><option value="week">week</option></select>
                </label>
                <p class="hint" id="preview"></p>
            </fieldset>
            <fieldset>
                <legend>${editing ? "Where you are" : "Start at"}</legend>
                <select id="position" aria-label="Next to read"></select>
                <p class="muted small">${editing ? "The next one due. Change it to skip ahead or go back." : "Already partway through? Pick where to begin."}</p>
            </fieldset>
            <div class="actions">
                <button class="btn primary" type="submit">${editing ? "Save" : "Add plan"}</button>
                <a class="btn" href="#/plans">Cancel</a>
            </div>
            ${editing ? `
            <div class="actions danger-zone">
                <button class="btn" type="button" id="pause">${editing.paused ? "Resume" : "Pause"}</button>
                <button class="btn" type="button" id="restart">Start over</button>
                <button class="btn danger" type="button" id="delete">Remove</button>
            </div>` : ""}
        </form>`;

    const form = $("#form");
    let units = [];

    async function refreshSource() {
        for (const b of form.querySelectorAll("[data-kind]")) b.classList.toggle("on", b.dataset.kind === draft.kind);
        $("#source").innerHTML = Object.entries(SOURCES[draft.kind]).map(([k, s]) =>
            `<option value="${k}" ${s.unavailable ? "disabled" : ""} ${k === draft.source ? "selected" : ""}>${esc(s.name)}${s.unavailable ? " (coming)" : ""}</option>`).join("");
        const src = SOURCES[draft.kind][draft.source];
        $("#about").textContent = src.about ?? "";
        $("#hymn-pick").hidden = draft.kind !== "hymns";
        $("#section-pick").hidden = draft.source !== "section";
        if (draft.source === "section") {
            draft.section ??= { ref: "", step: "paragraph" };
            $("#section-ref").value = draft.section.ref;
            refreshSteps();
        }
        if (draft.kind === "hymns") {
            allHymns = await sourceUnits("hymns", draft.source);
            if (!isCurrent(ticket)) return;
            // A new plan starts with none chosen; one saved before choosing existed had them all
            draft.hymns ??= editing ? allHymns.map((h) => h.id) : [];
            refreshHymnList();
        }
        await refreshUnits();
    }

    let unitsAsked = 0;
    async function refreshUnits() {
        const asked = ++unitsAsked;
        const section = draft.source === "section";
        let problem = null;
        if (section && !draft.section.ref) units = [];
        else {
            try {
                units = await unitsOf(draft);
            } catch (e) {
                if (!section) throw e;
                units = [];
                problem = e.message;
            }
        }
        if (!isCurrent(ticket) || asked !== unitsAsked) return;
        if (section) {
            $("#section-note").textContent = problem ?? (units.length
                ? `${plural(units.length, draft.section.step)}: ${units[0].label} to ${units.at(-1).label}`
                : "A book, chapters, or several books, separated by semicolons.");
            $("#section-note").classList.toggle("error", !!problem);
        }
        $("#unit-word").textContent = `${unitWord(draft)}(s)`;
        $("#position").innerHTML = units.map((u, i) => `<option value="${i}" ${i === draft.position ? "selected" : ""}>${esc(u.q ? `${u.label} ${u.q}` : u.label)}</option>`).join("");
        $("#position").disabled = !units.length;
        refreshPace();
    }

    // ---- Part of the Bible ----
    function refreshSteps() {
        for (const b of form.querySelectorAll("[data-step]")) b.classList.toggle("on", b.dataset.step === draft.section.step);
    }
    let typing;
    $("#section-ref").addEventListener("input", (e) => {
        draft.section = { ...draft.section, ref: e.target.value.trim() };
        draft.position = 0;
        clearTimeout(typing);
        typing = setTimeout(refreshUnits, 300);
    });
    for (const b of form.querySelectorAll("[data-step]")) {
        b.addEventListener("click", () => {
            draft.section = { ...draft.section, step: b.dataset.step };
            draft.position = 0;
            refreshSteps();
            refreshUnits();
        });
    }

    // ---- Hymn picker ----
    let allHymns = [];
    const shownHymns = () => {
        const words = $("#hymn-search").value.toLowerCase().split(/\s+/).filter(Boolean);
        const chosen = new Set(draft.hymns);
        return allHymns.filter((h) => (!$("#chosen-only").checked || chosen.has(h.id))
            && words.every((w) => `${h.id} ${h.title} ${h.tune} ${h.composer}`.toLowerCase().includes(w)));
    };
    function refreshHymnList() {
        const chosen = new Set(draft.hymns);
        $("#hymn-list").innerHTML = shownHymns().map((h) => `
            <li><label><input type="checkbox" value="${esc(h.id)}" ${chosen.has(h.id) ? "checked" : ""}>
                <span>${esc(h.label)}${h.tune ? ` <span class="muted small">${esc(h.tune)}</span>` : ""}</span></label></li>`).join("")
            || `<li class="muted small">No hymns match.</li>`;
        refreshHymnCount();
    }
    const refreshHymnCount = () => ($("#hymn-count").textContent = `${draft.hymns.length} of ${allHymns.length} chosen`);

    // Changing the choice keeps the plan's place: the next hymn due stays next (or the
    // first chosen hymn after it, if it was taken out), and hymns already sung stay sung
    function setChosen(ids) {
        const order = new Map(allHymns.map((h, i) => [h.id, i]));
        const nextId = units[draft.position]?.id;
        const nextAt = nextId != null ? order.get(nextId)
            : units.length ? order.get(units.at(-1).id) + 0.5 // finished: only hymns added after the last one are due
            : 0;
        draft.hymns = [...new Set(ids)].sort((a, b) => order.get(a) - order.get(b));
        const at = draft.hymns.findIndex((id) => order.get(id) >= nextAt);
        draft.position = at === -1 ? draft.hymns.length : at;
        refreshHymnCount();
        refreshUnits();
    }
    $("#hymn-list").addEventListener("change", (e) => {
        const id = e.target.value;
        setChosen(e.target.checked ? [...draft.hymns, id] : draft.hymns.filter((x) => x !== id));
        if ($("#chosen-only").checked && !e.target.checked) refreshHymnList();
    });
    $("#hymn-search").addEventListener("input", refreshHymnList);
    $("#chosen-only").addEventListener("change", refreshHymnList);
    $("#choose-shown").addEventListener("click", () => {
        setChosen([...draft.hymns, ...shownHymns().map((h) => h.id)]);
        refreshHymnList();
    });
    $("#clear-shown").addEventListener("click", () => {
        const shown = new Set(shownHymns().map((h) => h.id));
        setChosen(draft.hymns.filter((id) => !shown.has(id)));
        refreshHymnList();
    });

    function refreshPace() {
        form.mode.value = draft.pace.mode;
        if (draft.pace.mode === "goal") $("#goal").value = String(draft.pace.days);
        else {
            $("#count").value = draft.pace.count;
            $("#per").value = draft.pace.per;
        }
        if (!units.length) {
            $("#preview").textContent = draft.kind === "hymns" ? "Choose at least one hymn." : draft.source === "section" ? "Type which part of the Bible to read." : "";
            return;
        }
        const day = today();
        // As it will be once saved: a changed goal counts from today
        const t = { ...draft, credit: draft.credit ?? 0, start: editing && JSON.stringify(draft.pace) === JSON.stringify(editing.pace) ? draft.start : day };
        const rate = unitsPerDay(t, units.length, day, state.settings.worshipDays);
        const finish = projectedFinish(t, units.length, day, state.settings.worshipDays);
        const unit = unitWord(draft);
        $("#preview").textContent = rate
            ? `That's ${rateText(rate, unit)}${finish ? `, finishing about ${formatDay(finish, { month: "long", day: "numeric", year: "numeric" })}` : ""}.`
            : "";
    }

    for (const b of form.querySelectorAll("[data-kind]")) {
        b.addEventListener("click", () => {
            draft.kind = b.dataset.kind;
            draft.source = firstAvailable(draft.kind);
            draft.position = 0;
            draft.pace = DEFAULT_PACE[draft.kind];
            refreshSource();
        });
    }
    $("#source").addEventListener("change", (e) => {
        draft.source = e.target.value;
        draft.position = 0;
        draft.pace = draft.source === "section" ? SECTION_PACE : DEFAULT_PACE[draft.kind];
        refreshSource();
    });
    const readPace = () => {
        draft.pace = form.mode.value === "goal"
            ? { mode: "goal", days: +$("#goal").value }
            : { mode: "rate", count: Math.max(1, +$("#count").value || 1), per: $("#per").value };
        refreshPace();
    };
    for (const el of [...form.querySelectorAll("[name=mode]"), $("#goal"), $("#per")]) el.addEventListener("change", readPace);
    $("#count").addEventListener("input", () => {
        form.mode.value = "rate";
        readPace();
    });
    $("#goal").addEventListener("focus", () => (form.mode.value = "goal"));
    $("#position").addEventListener("change", (e) => {
        draft.position = +e.target.value;
        refreshPace();
    });

    form.addEventListener("submit", (e) => {
        e.preventDefault();
        if (draft.kind === "hymns" && !draft.hymns?.length) {
            $("#hymn-search").focus();
            return toast("Choose at least one hymn.");
        }
        if (draft.source === "section" && !editing && !units.length) {
            $("#section-ref").focus();
            return toast("Type which part of the Bible to read.");
        }
        if (editing) {
            // A new goal counts from today, so the pace is worked out from what's left
            if (draft.pace.mode === "goal" && JSON.stringify(draft.pace) !== JSON.stringify(editing.pace)) editing.start = today();
            if (draft.position !== editing.position) editing.credit = 0;
            Object.assign(editing, { pace: draft.pace, position: draft.position });
            if (draft.kind === "hymns") editing.hymns = draft.hymns;
            save();
        } else {
            newTrack(draft);
        }
        location.hash = "#/plans";
    });

    if (editing) {
        $("#pause").addEventListener("click", () => {
            editing.paused = !editing.paused;
            save();
            location.hash = "#/plans";
        });
        $("#restart").addEventListener("click", () => {
            if (!confirm("Start this plan over from the beginning?")) return;
            if (editing.position >= units.length) editing.laps++;
            Object.assign(editing, { position: 0, credit: 0, start: today() });
            save();
            location.hash = "#/plans";
        });
        $("#delete").addEventListener("click", () => {
            if (!confirm(`Remove "${trackName(editing)}"? Your past check marks stay in your stats.`)) return;
            state.tracks.splice(state.tracks.indexOf(editing), 1);
            save();
            location.hash = "#/plans";
        });
    }

    await refreshSource();
}
