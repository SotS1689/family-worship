// Let's Sing inside Family Worship. A hymn's page shows Let's Sing's own hymn
// page (four parts, sheet music, the words lit as they're sung) in a frame the
// height of the screen, scrolling inside itself so its controls stay in view, using
// Let's Sing's embed mode (the embed section of its web/src/main.js describes
// the messages). The player and its music stay Let's Sing's: fixes there show up
// here, and hymns saved for offline use are kept by Let's Sing's service worker.
import { LETS_SING_URL } from "./catalog.js";
import { state } from "./store.js";

const ORIGIN = new URL(LETS_SING_URL).origin;
// Family Worship's "auto" is Let's Sing's "system"
const theme = () => (state.settings.theme === "auto" ? "system" : state.settings.theme ?? "system");
const embedUrl = (hash) => `${LETS_SING_URL}?embed&theme=${theme()}${hash}`;
export const hymnPageUrl = (id) => `${LETS_SING_URL}#/hymn/${encodeURIComponent(id)}`;

const fromLetsSing = (e, frame) => e.origin === ORIGIN && e.source === frame.contentWindow && e.data?.source === "lets-sing";

// How long to wait for the player before showing the words on their own (offline,
// before Let's Sing has ever been opened on this device)
const READY_WAIT = 12000;

/**
 * Puts the player for hymn `id` in `slot`. onReady runs once it has loaded;
 * onFail if it doesn't, leaving the slot empty.
 */
export function mountPlayer(slot, id, { onReady, onFail } = {}) {
    const frame = document.createElement("iframe");
    frame.className = "lets-sing";
    frame.title = "Let's Sing player";
    // The player keeps the screen on while a hymn plays
    frame.allow = "autoplay; screen-wake-lock";
    frame.src = embedUrl(`#/hymn/${encodeURIComponent(id)}`);
    let ready = false;
    const onMessage = (e) => {
        if (!frame.isConnected) return removeEventListener("message", onMessage);
        if (!fromLetsSing(e, frame)) return;
        if (e.data.type !== "ready" || ready) return;
        ready = true;
        clearTimeout(timer);
        removeEventListener("message", onMessage);
        frame.classList.add("ready");
        onReady?.();
    };
    addEventListener("message", onMessage);
    const timer = setTimeout(() => {
        if (ready) return;
        removeEventListener("message", onMessage);
        frame.remove();
        onFail?.();
    }, READY_WAIT);
    slot.replaceChildren(frame);
}

// ---- Saving hymns for offline use ----
// A hidden Let's Sing frame, made on first use, answers which hymns are saved
// on this device and saves more.

let saver = null;
function saverFrame() {
    saver ??= new Promise((resolve, reject) => {
        const frame = document.createElement("iframe");
        frame.hidden = true;
        frame.title = "Let's Sing (saves hymns for offline use)";
        frame.src = embedUrl("#/");
        const timer = setTimeout(() => {
            removeEventListener("message", onReady);
            frame.remove();
            saver = null;
            reject(new Error("Couldn't reach Let's Sing. Check your connection."));
        }, READY_WAIT);
        const onReady = (e) => {
            if (!fromLetsSing(e, frame) || e.data.type !== "ready") return;
            clearTimeout(timer);
            removeEventListener("message", onReady);
            resolve(frame);
        };
        addEventListener("message", onReady);
        document.body.append(frame);
    });
    return saver;
}

let asked = 0;
async function ask(type, ids, onProgress) {
    const frame = await saverFrame();
    const re = ++asked;
    return new Promise((resolve) => {
        const onMessage = (e) => {
            if (!fromLetsSing(e, frame) || e.data.re !== re) return;
            if (e.data.type === "progress") return onProgress?.(e.data.done, e.data.total);
            if (e.data.type !== "reply") return;
            removeEventListener("message", onMessage);
            resolve({ saved: e.data.saved, noMusic: e.data.noMusic, offline: e.data.offline });
        };
        addEventListener("message", onMessage);
        frame.contentWindow.postMessage({ source: "lets-sing-host", type, re, ids: ids.map(String) }, ORIGIN);
    });
}

/** Of these hymn ids: { saved, noMusic, offline } (offline: whether saving works here at all). */
export const offlineStatus = (ids) => ask("status", ids);

/** Saves these hymns on this device; onProgress(done, total) counts files. Resolves as offlineStatus. */
export const saveOffline = (ids, onProgress) => ask("save", ids, onProgress);
