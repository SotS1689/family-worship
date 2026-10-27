// One unit of a track: a day's Bible passages, a catechism question, or a hymn.
import { state, save } from "../store.js";
import { BOOK, VERSIONS, passageLabel } from "../bible.js";
import { loadBook, loadCatechismSongs } from "../content.js";
import { LETS_SING_URL } from "../catalog.js";
import { app, esc, setTitle, unitsOf, trackName, sourceOf, nextRender, isCurrent } from "../ui.js";

export async function renderReader(trackId, index) {
    const ticket = nextRender();
    const track = state.tracks.find((t) => t.id === trackId);
    if (!track) return (location.hash = "#/");
    const units = await unitsOf(track);
    const unit = units[index];
    if (!unit) return (location.hash = "#/");
    setTitle(trackName(track));

    const nav = `
        <nav class="pager">
            ${index > 0 ? `<a class="btn" href="#/read/${trackId}/${index - 1}">‹ Previous</a>` : "<span></span>"}
            <span class="muted small">${index + 1} of ${units.length}</span>
            ${index + 1 < units.length ? `<a class="btn" href="#/read/${trackId}/${index + 1}">Next ›</a>` : "<span></span>"}
        </nav>`;

    let body;
    if (track.kind === "bible") body = await bibleHtml(unit);
    else if (track.kind === "catechism") body = await catechismHtml(track, unit);
    else body = hymnHtml(unit);
    if (!isCurrent(ticket)) return;
    app().innerHTML = `<article class="reader ${track.kind}">${body}</article>${nav}`;

    for (const b of app().querySelectorAll("[data-version]")) {
        b.addEventListener("click", () => {
            state.settings.bibleVersion = b.dataset.version;
            save();
            renderReader(trackId, index);
        });
    }
    window.scrollTo(0, 0);
}

// The KJV's [bracketed] words were supplied by the translators: shown in italics, as printed
const verseText = (t) => esc(t).replace(/\[([^\]]*)\]/g, "<em>$1</em>");

async function bibleHtml(unit) {
    const version = state.settings.bibleVersion;
    const switcher = `<div class="seg" role="group" aria-label="Bible version">
        ${Object.entries(VERSIONS).map(([v, info]) => `<button data-version="${v}" class="${v === version ? "on" : ""}" title="${esc(info.name)}">${info.short}</button>`).join("")}
    </div>`;
    const several = unit.passages.length > 1;
    const sections = await Promise.all(unit.passages.map(async (p) => {
        try {
            const book = await loadBook(version, p.book);
            const verses = book[p.chapter - 1].filter(([v]) => (p.from == null || v >= p.from) && (p.to == null || v <= p.to));
            return `<section>${several ? `<h2>${esc(passageLabel(p))}</h2>` : ""}<p class="verses">${verses.map(([v, t]) => `<sup>${v}</sup>${verseText(t)}`).join(" ")}</p></section>`;
        } catch {
            return `<section><h2>${esc(passageLabel(p))}</h2><p class="muted">Couldn't load ${esc(BOOK[p.book].name)} — check your connection.</p></section>`;
        }
    }));
    return `<header class="reader-head"><h1>${esc(unit.label)}</h1>${switcher}</header>${sections.join("")}`;
}

async function catechismHtml(track, unit) {
    const music = sourceOf(track)?.music;
    const song = (await loadCatechismSongs())[track.source]?.[unit.n];
    return `
        <p class="qnum">Question ${unit.n}</p>
        <h1 class="question">${esc(unit.q)}</h1>
        <div class="answer">${unit.a.split("\n\n").map((p) => `<p>${esc(p)}</p>`).join("")}</div>
        ${music ? `
            <figure class="sung">
                <figcaption>♪ Sing it</figcaption>
                <audio controls preload="none" src="${esc(music.url(unit.n))}"></audio>
                <p class="muted small">${esc(music.credit)}
                    <a href="${esc(music.page(unit.n))}" target="_blank" rel="noopener">More on this question</a></p>
            </figure>`
        : song ? `<a class="btn primary" href="${esc(song.url)}" target="_blank" rel="noopener">♪ Listen: ${esc(song.title || "sung version")}</a>` : ""}
        ${unit.proofs?.length ? `<details><summary>Scripture proofs</summary><p>${unit.proofs.map(esc).join("; ")}</p></details>` : ""}`;
}

function hymnHtml(unit) {
    return `
        <h1>${esc(unit.title)}</h1>
        <p class="muted">${esc([unit.tune, unit.composer].filter(Boolean).join(" · "))}</p>
        <a class="btn primary" href="${LETS_SING_URL}#/hymn/${encodeURIComponent(unit.id)}" target="_blank" rel="noopener">♪ Sing along in Let's Sing</a>
        <div class="verses-hymn">${unit.verses.map((v) => `<p>${esc(v)}</p>`).join("")}</div>
        ${unit.credits ? `<p class="credits muted small">${esc(unit.credits)}</p>` : ""}`;
}
