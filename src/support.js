// The heart in the top bar, and the occasional "would you consider supporting it?"
// callout under it -- same wording and cadence as Let's Sing, DA-Tool and BibleSearch.
// Never on first visit; first appears once the app has actually been used
// (10 visits OR 3 distinct days), then resurfaces roughly every 24 days after
// "Maybe later". Stops popping up (the heart itself always stays) after 5
// "Maybe later"s, or for good after "Don't ask again" or clicking through.
// Keys are prefixed because the pastor's apps share the sots1689.github.io origin.

const store = {
    get(key, fallback) {
        try { return JSON.parse(localStorage.getItem("fw-" + key)) ?? fallback; } catch { return fallback; }
    },
    set(key, value) {
        try { localStorage.setItem("fw-" + key, JSON.stringify(value)); } catch { /* private mode */ }
    },
};

// Google Analytics event, if the GA script loaded (blockers, offline)
function track(name, params = {}) {
    if (typeof gtag === "function") gtag("event", name, params);
}

const DAY_MS = 20 * 60 * 60 * 1000;
const FIRST_VISITS_THRESHOLD = 10;
const FIRST_DAYS_THRESHOLD = 3;
const RESHOW_INTERVAL_DAYS = 24;
const MAX_MAYBE_LATER = 5;

export function setUpSupport() {
    const callout = document.getElementById("support-callout");
    const heart = document.getElementById("support");

    function show() {
        callout.classList.add("open");
        store.set("supportLastShown", Date.now());
        track("support_callout_shown");
        // Dismiss on outside click (doesn't count as "Maybe later" -- just closes it)
        setTimeout(() => document.addEventListener("click", outsideClick), 0);
    }

    function outsideClick(e) {
        if (callout.contains(e.target) || heart.contains(e.target)) return;
        callout.classList.remove("open");
        document.removeEventListener("click", outsideClick);
    }

    function dismiss(mode) {
        callout.classList.remove("open");
        document.removeEventListener("click", outsideClick);
        if (mode === "forever") store.set("supportDismissedForever", true);
        else if (mode === "later") store.set("supportMaybeLaterCount", store.get("supportMaybeLaterCount", 0) + 1);
        else if (mode === "acted") store.set("supportActed", true);
        if (mode === "forever" || mode === "later") track("support_callout_dismiss", { choice: mode });
    }

    heart.addEventListener("click", () => {
        track("support_click", { source: "heart" });
        dismiss("acted");
    });
    callout.querySelector('[data-support="acted"]').addEventListener("click", () =>
        track("support_click", { source: "callout" })
    );
    callout.querySelectorAll("[data-support]").forEach((el) =>
        el.addEventListener("click", () => dismiss(el.dataset.support))
    );

    if (store.get("supportDismissedForever", false) || store.get("supportActed", false)) return;

    const visits = store.get("supportVisits", 0) + 1;
    store.set("supportVisits", visits);

    let days = store.get("supportDaysUsed", 0);
    const today = new Date().toISOString().slice(0, 10);
    if (store.get("supportLastDayUsed", "") !== today) {
        days += 1;
        store.set("supportDaysUsed", days);
        store.set("supportLastDayUsed", today);
    }

    if (store.get("supportMaybeLaterCount", 0) >= MAX_MAYBE_LATER) return;
    const lastShown = store.get("supportLastShown", 0);
    const due = lastShown === 0
        ? visits >= FIRST_VISITS_THRESHOLD || days >= FIRST_DAYS_THRESHOLD
        : Date.now() - lastShown >= RESHOW_INTERVAL_DAYS * DAY_MS;
    // A moment after opening, so it doesn't land on top of the app loading
    if (due) setTimeout(show, 1500);
}
