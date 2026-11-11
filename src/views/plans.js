// Plans: the family's tracks, and the form to add or change one.
import { state, save, newTrack } from "../store.js";
import { today, formatDay } from "../dates.js";
import { unitsPerDay, projectedFinish, repeats } from "../schedule.js";
import { KINDS, SOURCES, GOALS } from "../catalog.js";
import { offlineStatus, saveOffline } from "../letsSing.js";
import { PRAYER_PLANS, blankPart } from "../prayer.js";
import { handleHtml, makeSortable } from "../reorder.js";
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
                if (repeats(t)) return `<li class="card sortable" data-id="${t.id}">${state.tracks.length > 1 ? handleHtml(esc(trackName(t))) : ""}
                    <a class="track-link" href="#/plans/${t.id}">
                        <span class="icon">${kindIcon(t)}</span>
                        <span class="track-name">${esc(trackName(t))}</span>
                        <span class="muted small">${t.paused ? "Paused" : esc(paceText(t))}</span>
                    </a>
                </li>`;
                const pct = total ? Math.round((100 * t.position) / total) : 0;
                const finish = total && !t.paused ? projectedFinish(t, total, day, state.settings.worshipDays) : null;
                return `<li class="card sortable" data-id="${t.id}">${state.tracks.length > 1 ? handleHtml(esc(trackName(t))) : ""}
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
    if (state.tracks.length > 1) makeSortable($(".tracks"));
}

// Where the form starts for each kind: a year through the Bible; a catechism question
// and two hymns a week (a goal makes little sense for a short list of chosen hymns)
const DEFAULT_PACE = {
    bible: { mode: "goal", days: 365 },
    catechism: { mode: "rate", count: 1, per: "week" },
    creeds: { mode: "rate", count: 1, per: "day" }, // a confession; a creed, like prayer, comes up every worship day
    prayer: { mode: "rate", count: 1, per: "day" }, // fixed: a prayer plan comes up every worship day
    hymns: { mode: "rate", count: 2, per: "week" },
};
// A part of the Bible may be short, so it starts at one step a day rather than a goal
const SECTION_PACE = { mode: "rate", count: 1, per: "day" };
const STEPS = ["verse", "paragraph", "chapter"];
// A confession, a paragraph a day or a chapter a week to start with
const CONFESSION_PACE = { paragraph: { mode: "rate", count: 1, per: "day" }, chapter: { mode: "rate", count: 1, per: "week" } };
const GROUPS = { creed: "Creeds", confession: "Confessions" };
// What "each" offers: a prayer plan's parts, or a creed's articles
const EACH_LABELS = {
    prayer: { legend: "Pray through", all: "The whole plan each day", part: "One part a day, in turn" },
    creeds: { legend: "Say it", all: "The whole creed each day", part: "One article a day, in turn" },
};

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
                <input type="search" id="hymn-search" placeholder="Search title, first line, tune or number" aria-label="Search hymns">
                <div class="pick-bar">
                    <span id="hymn-count"></span>
                    <label class="small"><input type="checkbox" id="chosen-only"> Show chosen only</label>
                </div>
                <div class="pick-bar">
                    <button type="button" class="btn small" id="choose-shown">Choose all shown</button>
                    <button type="button" class="btn small" id="clear-shown">Clear all shown</button>
                </div>
                <ul class="pick-list" id="hymn-list"></ul>
                <details class="more" id="paste">
                    <summary>Paste a list</summary>
                    <p class="muted small">Paste hymn titles, one per line, from a bulletin, an email or a spreadsheet.
                        Numbers and bullets are fine, and so are first lines, tune names and psalm numbers (“Psalm 23”).</p>
                    <textarea id="paste-text" rows="6" aria-label="Hymn list"
                        placeholder="Holy, Holy, Holy&#10;Psalm 100&#10;When I survey the wondrous cross"></textarea>
                    <button type="button" class="btn small" id="paste-find">Find these hymns</button>
                    <div id="paste-results"></div>
                </details>
                <details class="more" id="offline">
                    <summary>Offline use</summary>
                    <p class="small" id="offline-text">Checking which hymns are saved on this device…</p>
                    <button type="button" class="btn small" id="offline-save" hidden></button>
                </details>
            </fieldset>
            <fieldset id="prayer-own" hidden>
                <legend>Your plan</legend>
                <input type="text" id="prayer-name" placeholder="Name it, e.g. Evening prayer" aria-label="Name of your prayer plan" autocomplete="off">
                <p class="small">The parts, in the order you'll pray them:</p>
                <ol class="prayer-parts" id="prayer-parts"></ol>
                <div class="pick-bar">
                    <button type="button" class="btn small" id="part-add">＋ Add a part</button>
                </div>
                <p class="muted small">Or start from a suggestion and change it:
                    ${Object.entries(PRAYER_PLANS).map(([k, p]) => `<button type="button" class="btn small" data-copy="${k}">${esc(p.name)}</button>`).join(" ")}</p>
            </fieldset>
            <fieldset id="confession-step" hidden ${editing ? "disabled" : ""}>
                <legend>Read it</legend>
                <div class="seg wide">
                    <button type="button" data-cstep="paragraph">A paragraph at a time</button>
                    <button type="button" data-cstep="chapter">A chapter at a time</button>
                </div>
                <p class="muted small">Each paragraph comes with its Scripture proofs.</p>
            </fieldset>
            <fieldset id="prayer-pick" hidden>
                <legend id="each-legend">Pray through</legend>
                <div class="seg wide" id="each">
                    <button type="button" data-each="all"></button>
                    <button type="button" data-each="part"></button>
                </div>
                <p class="muted small">It comes up every worship day and starts again from the top when it reaches the end.</p>
            </fieldset>
            <fieldset id="pace-pick">
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
            <fieldset id="position-pick">
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
        const option = ([k, s]) =>
            `<option value="${k}" ${s.unavailable ? "disabled" : ""} ${k === draft.source ? "selected" : ""}>${esc(s.name)}${s.unavailable ? " (coming)" : ""}</option>`;
        const sources = Object.entries(SOURCES[draft.kind]);
        // Creeds & Confessions come in two groups
        $("#source").innerHTML = sources.some(([, s]) => s.type)
            ? Object.entries(GROUPS).map(([type, label]) => `<optgroup label="${label}">${sources.filter(([, s]) => s.type === type).map(option).join("")}</optgroup>`).join("")
            : sources.map(option).join("");
        const src = SOURCES[draft.kind][draft.source];
        $("#about").textContent = src.about ?? "";
        $("#hymn-pick").hidden = draft.kind !== "hymns";
        $("#section-pick").hidden = draft.source !== "section";
        const prayer = draft.kind === "prayer";
        // Praying the Psalms is a psalm a day, from wherever the family starts
        const psalms = prayer && draft.source === "psalms";
        // A creed is said every worship day, whole or (if it has articles) an article at a time
        const creed = draft.kind === "creeds" && src.type === "creed";
        const confession = draft.kind === "creeds" && src.type === "confession";
        $("#prayer-pick").hidden = !(prayer && !psalms) && !(creed && src.clauses !== false);
        $("#prayer-own").hidden = !prayer || draft.source !== "custom";
        $("#confession-step").hidden = !confession;
        $("#pace-pick").hidden = prayer || creed;
        $("#position-pick").hidden = (prayer && !psalms) || creed;
        const labels = EACH_LABELS[draft.kind];
        if (labels) {
            $("#each-legend").textContent = labels.legend;
            for (const b of form.querySelectorAll("[data-each]")) b.textContent = labels[b.dataset.each];
        }
        if (creed) {
            delete draft.step;
            draft.each = src.clauses === false ? "all" : draft.each ?? "all";
            refreshEach();
        }
        if (confession) {
            delete draft.each;
            draft.step ??= "paragraph";
            refreshConfessionStep();
        }
        if (prayer) {
            draft.each ??= "all";
            refreshEach();
            if (draft.source === "custom") {
                draft.parts ??= [blankPart()];
                $("#prayer-name").value = draft.name ?? "";
                refreshParts();
            }
        }
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
        $("#position").innerHTML = units.map((u, i) => `<option value="${i}" ${i === draft.position ? "selected" : ""}>${esc(u.q ? `${u.label} ${u.q}` : u.preview ? `${u.label} · ${u.preview}` : u.label)}</option>`).join("");
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

    // ---- Confession: a paragraph or a chapter at a time ----
    function refreshConfessionStep() {
        for (const b of form.querySelectorAll("[data-cstep]")) b.classList.toggle("on", b.dataset.cstep === draft.step);
    }
    for (const b of form.querySelectorAll("[data-cstep]")) {
        b.addEventListener("click", () => {
            draft.step = b.dataset.cstep;
            draft.position = 0;
            draft.pace = CONFESSION_PACE[draft.step];
            refreshConfessionStep();
            refreshUnits();
        });
    }

    // ---- Prayer, and a creed's articles ----
    function refreshEach() {
        for (const b of form.querySelectorAll("[data-each]")) b.classList.toggle("on", b.dataset.each === draft.each);
    }
    for (const b of form.querySelectorAll("[data-each]")) {
        b.addEventListener("click", () => {
            draft.each = b.dataset.each;
            draft.position = 0;
            refreshEach();
            refreshUnits();
        });
    }
    function refreshParts() {
        const n = draft.parts.length;
        $("#prayer-parts").innerHTML = draft.parts.map((p, i) => `
            <li class="prayer-part" data-i="${i}">
                <input type="text" data-field="title" value="${esc(p.title)}" placeholder="Part ${i + 1}, e.g. Missionaries" aria-label="Name of part ${i + 1}" autocomplete="off">
                ${p.line ? `<p class="muted small">Said together: “${esc(p.line)}”</p>` : ""}
                <textarea data-field="prompt" rows="2" placeholder="What to pray about" aria-label="What to pray about in part ${i + 1}">${esc(p.prompt)}</textarea>
                <div class="part-tools">
                    <button type="button" class="btn small" data-move="-1" ${i === 0 ? "disabled" : ""} aria-label="Move part ${i + 1} up">↑</button>
                    <button type="button" class="btn small" data-move="1" ${i === n - 1 ? "disabled" : ""} aria-label="Move part ${i + 1} down">↓</button>
                    <button type="button" class="btn small danger" data-remove ${n === 1 ? "disabled" : ""} aria-label="Remove part ${i + 1}">Remove</button>
                </div>
            </li>`).join("");
    }
    $("#prayer-name").addEventListener("input", (e) => (draft.name = e.target.value));
    $("#prayer-parts").addEventListener("input", (e) => {
        const i = +e.target.closest("[data-i]").dataset.i;
        draft.parts[i] = { ...draft.parts[i], [e.target.dataset.field]: e.target.value };
        clearTimeout(typing);
        typing = setTimeout(refreshUnits, 300);
    });
    $("#prayer-parts").addEventListener("click", (e) => {
        const btn = e.target.closest("button");
        if (!btn) return;
        const i = +btn.closest("[data-i]").dataset.i;
        if (btn.dataset.move) {
            const j = i + +btn.dataset.move;
            [draft.parts[i], draft.parts[j]] = [draft.parts[j], draft.parts[i]];
        } else if (btn.hasAttribute("data-remove")) draft.parts.splice(i, 1);
        refreshParts();
        refreshUnits();
    });
    $("#part-add").addEventListener("click", () => {
        draft.parts.push(blankPart());
        refreshParts();
        $("#prayer-parts").lastElementChild.querySelector("input").focus();
    });
    for (const b of form.querySelectorAll("[data-copy]")) {
        b.addEventListener("click", () => {
            const plan = PRAYER_PLANS[b.dataset.copy];
            const blank = draft.parts.every((p) => !p.title && !p.prompt);
            if (!blank && !confirm(`Replace your parts with ${plan.name}?`)) return;
            draft.parts = structuredClone(plan.parts);
            if (!draft.name) $("#prayer-name").value = draft.name = plan.name;
            refreshParts();
            refreshUnits();
        });
    }

    // ---- Hymn picker ----
    let allHymns = [];
    // As Let's Sing searches: accents, apostrophes and punctuation don't matter.
    // The first line finds a hymn known by it rather than by its title.
    const fold = (s) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/['’]/g, "").replace(/[^a-z0-9]+/g, " ");
    const searchText = new WeakMap();
    const searchOf = (h) => {
        if (!searchText.has(h)) {
            const firstLine = (h.verses[0] ?? "").split("\n")[0].replace(/^\s*\d+\.?\s*/, "");
            searchText.set(h, ` ${fold(`${h.id} ${h.title} ${firstLine} ${h.tune} ${h.composer}`)} `);
        }
        return searchText.get(h);
    };
    const shownHymns = () => {
        const words = fold($("#hymn-search").value).split(" ").filter(Boolean);
        const chosen = new Set(draft.hymns);
        // A number on its own is a whole number: "23" finds Psalm 23, not 123
        return allHymns.filter((h) => (!$("#chosen-only").checked || chosen.has(h.id))
            && words.every((w) => searchOf(h).includes(/^\d+$/.test(w) ? ` ${w} ` : w)));
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
        if ($("#offline").open) refreshOffline();
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

    // ---- Paste a list (Let's Sing's matcher, src/vendor/match.js) ----
    // Lines it's sure of come ticked with their hymn; the rest offer the nearest hymns
    let matches = [];
    const hymnLabel = (h) => `${h.label}${h.tune ? ` — ${h.tune}` : ""}`;
    $("#paste-find").addEventListener("click", async () => {
        const { matchList } = await import("../vendor/match.js");
        const all = matchList($("#paste-text").value, allHymns);
        matches = all.filter((m) => m.confidence !== "none");
        const notFound = all.filter((m) => m.confidence === "none")
            .map((m) => `<p class="muted small">Couldn't find “${esc(m.line)}”</p>`).join("");
        const chosen = new Set(draft.hymns);
        $("#paste-results").innerHTML = !all.length ? `<p class="hint">Paste some hymn titles above first.</p>` : `
            ${notFound}
            ${matches.length ? `<ul class="pick-list matches">${matches.map((m, i) => `
                <li><label><input type="checkbox" data-pick="${i}" checked>
                    <span><span class="muted small">${esc(m.line)}</span><br>
                    ${m.confidence === "sure" ? esc(hymnLabel(m.candidates[0].hymn))
                        : `<select data-choice="${i}" aria-label="Hymn for “${esc(m.line)}”">${m.candidates.map((c) =>
                            `<option value="${esc(c.hymn.id)}">${esc(hymnLabel(c.hymn))}</option>`).join("")}</select>
                           <br><span class="small muted">${m.tunes ? "Sung to more than one tune: pick the one you want" : "Check this one"}</span>`}
                    ${m.confidence === "sure" && chosen.has(m.candidates[0].hymn.id) ? `<span class="small muted"> · already chosen</span>` : ""}</span>
                </label></li>`).join("")}</ul>
            <button type="button" class="btn small primary" id="paste-add"></button>` : ""}`;
        refreshPasteAdd();
    });
    const pickedIds = () => matches.flatMap((m, i) => $(`#paste-results [data-pick="${i}"]`).checked
        ? [$(`#paste-results [data-choice="${i}"]`)?.value ?? m.candidates[0].hymn.id] : []);
    function refreshPasteAdd() {
        const btn = $("#paste-add");
        if (!btn) return;
        const n = pickedIds().length;
        btn.textContent = n ? `Choose ${plural(n, "hymn")}` : "Nothing ticked";
        btn.disabled = !n;
    }
    $("#paste-results").addEventListener("change", (e) => {
        // Picking a hymn for a line means you want it
        const i = e.target.dataset.choice;
        if (i) $(`#paste-results [data-pick="${i}"]`).checked = true;
        refreshPasteAdd();
    });
    $("#paste-results").addEventListener("click", (e) => {
        if (e.target.id !== "paste-add") return;
        const before = draft.hymns.length;
        setChosen([...draft.hymns, ...pickedIds()]);
        refreshHymnList();
        const added = draft.hymns.length - before;
        $("#paste-text").value = "";
        $("#paste-results").innerHTML = "";
        matches = [];
        toast(added ? `Chose ${plural(added, "more hymn")}` : "Those were already chosen");
    });

    // ---- Offline use ----
    // Let's Sing keeps the saved hymns (src/letsSing.js). Asked only once this is
    // opened, since asking loads Let's Sing in the background.
    let saving = false;
    async function refreshOffline() {
        const text = $("#offline-text"), btn = $("#offline-save");
        if (saving) return;
        if (!draft.hymns.length) {
            text.textContent = "Choose some hymns first.";
            return (btn.hidden = true);
        }
        let status;
        try {
            status = await offlineStatus(draft.hymns);
        } catch (e) {
            if (!isCurrent(ticket)) return;
            text.textContent = `${e.message} Saving hymns needs the internet.`;
            return (btn.hidden = true);
        }
        if (!isCurrent(ticket) || saving) return;
        if (!status.offline) {
            text.textContent = "Saving hymns works only in the published app, where Let's Sing's offline support runs.";
            return (btn.hidden = true);
        }
        const withMusic = draft.hymns.length - status.noMusic.length;
        const saved = status.saved.length;
        const n = status.noMusic.length;
        const noMusic = n ? ` ${plural(n, "chosen hymn")} ${n === 1 ? "has" : "have"} no music yet.` : "";
        text.textContent = saved === withMusic
            ? `${withMusic === 1 ? "This plan's hymn is" : `All ${withMusic} of this plan's hymns are`} saved on this device, so the player works without internet.${noMusic}`
            : `${saved} of ${plural(withMusic, "hymn")} saved on this device. Save them so the player works without internet.${noMusic}`;
        btn.hidden = saved === withMusic;
        btn.disabled = false;
        btn.textContent = saved ? "Save the rest" : withMusic === 1 ? "Save it" : `Save all ${withMusic}`;
    }
    $("#offline").addEventListener("toggle", () => $("#offline").open && refreshOffline());
    $("#offline-save").addEventListener("click", async () => {
        const btn = $("#offline-save");
        if (!navigator.onLine) return toast("Connect to the internet to save hymns.");
        saving = true;
        btn.disabled = true;
        btn.textContent = "Saving…";
        let failed = false;
        try {
            await saveOffline(draft.hymns, (done, total) => (btn.textContent = `Saving… ${done} of ${total} files`));
        } catch (e) {
            failed = true;
            toast(e.message);
        }
        saving = false;
        if (!isCurrent(ticket)) return;
        await refreshOffline();
        if (failed) return;
        toast(btn.hidden ? "Saved. These hymns now play without internet." : "Some didn't save. Check your connection and try again.");
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
        draft.pace = draft.source === "section" ? SECTION_PACE
            : draft.kind === "creeds" && draft.step ? CONFESSION_PACE[draft.step] : DEFAULT_PACE[draft.kind];
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
        if (draft.kind === "prayer" && draft.source === "custom") {
            draft.name = draft.name?.trim();
            draft.parts = draft.parts.filter((p) => p.title.trim() || p.prompt.trim() || p.line);
            if (!draft.parts.length) {
                draft.parts = [blankPart()];
                refreshParts();
                $("#prayer-parts input").focus();
                return toast("Add at least one part to pray.");
            }
        }
        if (editing) {
            // A new goal counts from today, so the pace is worked out from what's left
            if (draft.pace.mode === "goal" && JSON.stringify(draft.pace) !== JSON.stringify(editing.pace)) editing.start = today();
            if (draft.position !== editing.position) editing.credit = 0;
            Object.assign(editing, { pace: draft.pace, position: draft.position });
            if (draft.kind === "hymns") editing.hymns = draft.hymns;
            if (draft.kind === "prayer") Object.assign(editing, draft.source === "custom"
                ? { each: draft.each, name: draft.name, parts: draft.parts } : { each: draft.each });
            if (draft.kind === "creeds" && draft.each) editing.each = draft.each;
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
