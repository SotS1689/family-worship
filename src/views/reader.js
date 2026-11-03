// One unit of a track: a day's Bible passages, a catechism question, or a hymn.
import { state, save } from "../store.js";
import { BOOK, VERSIONS, passageLabel } from "../bible.js";
import { loadChapter, loadCatechismSongs } from "../content.js";
import { esvPassage, EsvError } from "../esv.js";
import { mountPlayer, hymnPageUrl } from "../letsSing.js";
import { app, esc, setTitle, unitsOf, trackName, sourceOf, nextRender, isCurrent, bibleVersion, versionOptions, isOnline } from "../ui.js";

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
    // A psalm to pray: the guide, then the psalm as a Bible reading
    else if (track.kind === "prayer" && unit.passages) body = `<p class="hint guide">${esc(unit.guide)}</p>${await bibleHtml(unit)}`;
    else if (track.kind === "prayer") body = prayerHtml(unit);
    else body = hymnHtml(unit);
    if (!isCurrent(ticket)) return;
    app().innerHTML = `<article class="reader ${track.kind}">${body}</article>${units.length > 1 ? nav : ""}`;
    if (track.kind === "hymns") startPlayer(unit);

    app().querySelector("#version")?.addEventListener("change", (e) => {
        state.settings.bibleVersion = e.target.value;
        save();
        renderReader(trackId, index);
    });
    window.scrollTo(0, 0);
}

// The KJV's [bracketed] words were supplied by the translators: shown in italics, as printed
const verseText = (t, version) => version === "kjv" ? esc(t).replace(/\[([^\]]*)\]/g, "<em>$1</em>") : esc(t);

async function bibleHtml(unit) {
    const version = bibleVersion();
    const info = VERSIONS[version];
    const switcher = `<select id="version" class="version" aria-label="Bible version">${versionOptions(version, "short")}</select>`;
    const several = unit.passages.length > 1;
    const sections = await Promise.all(unit.passages.map(async (p) => {
        try {
            const all = info.esv ? await esvPassage(p) : await loadChapter(version, p.book, p.chapter);
            const verses = all.filter(([v]) => (p.from == null || v >= p.from) && (p.to == null || v <= p.to));
            // A verse the BSB leaves out of its text (Matthew 18:11) but the KJV has
            if (!verses.length) return `<section><p class="muted">${esc(passageLabel(p))} isn't in the ${esc(info.short)}'s text. Switch versions to read it.</p></section>`;
            return `<section>${several ? `<h2>${esc(passageLabel(p))}</h2>` : ""}<p class="verses">${verses.map(([v, t]) => `<sup>${v}</sup>${verseText(t, version)}`).join(" ")}</p></section>`;
        } catch (e) {
            if (e instanceof EsvError) return `<section><p class="muted">${esc(e.message)}</p><a class="btn" href="#/settings">Open Settings</a></section>`;
            return `<section><h2>${esc(passageLabel(p))}</h2><p class="muted">Couldn't load ${esc(BOOK[p.book].name)}${isOnline(info)
                ? ` in the ${esc(info.short)}, which is read from the internet. Check your connection, or switch to the BSB or KJV.`
                : " — check your connection."}</p></section>`;
        }
    }));
    const credit = info.esv ? `<p class="credits muted small">Scripture quotations are from the ESV® Bible, © 2001 by Crossway.
            Used by permission. All rights reserved. <a href="https://www.esv.org" target="_blank" rel="noopener">esv.org</a></p>`
        : info.online ? `<p class="credits muted small">${esc(info.credit ?? `${info.name}.`)} Read from the
            <a href="https://bible.helloao.org" target="_blank" rel="noopener">Free Use Bible API</a>.</p>` : "";
    return `<header class="reader-head"><h1>${esc(unit.label)}</h1>${switcher}</header>${sections.join("")}${credit}`;
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

// A prayer plan, or one part of it: what to say together and what to pray about
function prayerHtml(unit) {
    const several = unit.parts.length > 1;
    return `
        <h1>${esc(unit.label)}</h1>
        <ol class="prayer-steps">${unit.parts.map((p) => `
            <li>
                ${several && p.title ? `<h2>${esc(p.title)}</h2>` : ""}
                ${p.line ? `<p class="said">${esc(p.line)}</p>` : ""}
                ${p.prompt ? `<p>${esc(p.prompt)}</p>` : ""}
                ${p.refs?.length ? `<p class="muted small refs">${p.refs.map(esc).join("; ")}</p>` : ""}
            </li>`).join("")}
        </ol>
        ${unit.credit ? `<p class="credits muted small">${esc(unit.credit)}</p>` : ""}`;
}

// Let's Sing's page for the hymn: its title, player, music and the words, which
// follow along as they're sung. Until it loads (or if it can't), the words are shown here.
function hymnHtml(unit) {
    return `
        <div class="sing-slot" id="sing-slot"></div>
        <div id="hymn-words">
            <h1>${esc(unit.title)}</h1>
            <p class="muted">${esc([unit.tune, unit.composer].filter(Boolean).join(" · "))}</p>
            <p class="muted small" id="sing-note">Loading the Let's Sing player…</p>
            <div class="verses-hymn">${unit.verses.map((v) => `<p>${esc(v)}</p>`).join("")}</div>
            ${unit.credits ? `<p class="credits muted small">${esc(unit.credits)}</p>` : ""}
        </div>
        <p class="credits small"><a href="${esc(hymnPageUrl(unit.id))}" target="_blank" rel="noopener">Open in Let's Sing ↗</a></p>`;
}

function startPlayer(unit) {
    const slot = app().querySelector("#sing-slot");
    const note = app().querySelector("#sing-note");
    mountPlayer(slot, unit.id, {
        onReady: () => (app().querySelector("#hymn-words").hidden = true),
        onFail: () => {
            note.textContent = "Couldn't load the Let's Sing player. Check your connection, or save this plan's hymns for offline use (Plans → this plan).";
        },
    });
}
