// Family Worship: hash routes so the app works from any folder and offline.
//   #/                 Today
//   #/read/<track>/<n> one reading, question or hymn
//   #/plans            the family's plans      #/plans/new, #/plans/<track>
//   #/stats            streaks and progress
//   #/settings
import "./style.css";
import { applyTheme } from "./theme.js";
import { renderToday } from "./views/today.js";
import { renderReader } from "./views/reader.js";
import { renderPlans, renderPlanForm } from "./views/plans.js";
import { renderStats } from "./views/stats.js";
import { renderSettings } from "./views/settings.js";
import { app, $, $$, esc } from "./ui.js";

const ROUTES = [
    [/^#\/read\/([\w-]+)\/(\d+)$/, (id, n) => renderReader(id, +n), "today"],
    [/^#\/plans\/new$/, () => renderPlanForm(), "plans"],
    [/^#\/plans\/([\w-]+)$/, (id) => renderPlanForm(id), "plans"],
    [/^#\/plans$/, renderPlans, "plans"],
    [/^#\/stats$/, renderStats, "stats"],
    [/^#\/settings$/, renderSettings, "settings"],
    [/^/, renderToday, "today"],
];

async function route() {
    for (const [re, render, tab] of ROUTES) {
        const m = location.hash.match(re);
        if (!m) continue;
        for (const a of $$(".tabbar a")) a.classList.toggle("on", a.dataset.tab === tab);
        $("#back").hidden = !/^#\/(read|plans\/)/.test(location.hash);
        try {
            await render(...m.slice(1));
        } catch (e) {
            console.error(e);
            app().innerHTML = `<p class="card">Something went wrong: ${esc(e.message)}</p>`;
        }
        return;
    }
}

$("#back").addEventListener("click", () => (history.length > 1 ? history.back() : (location.hash = "#/")));
addEventListener("hashchange", route);
applyTheme();
route();

// A day can roll over while the app sits open: show the new day when it comes back
let shownDay = new Date().toDateString();
document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible" && new Date().toDateString() !== shownDay) {
        shownDay = new Date().toDateString();
        route();
    }
});

if ("serviceWorker" in navigator && import.meta.env.PROD) {
    navigator.serviceWorker.register("./sw.js").catch((e) => console.error("Service worker", e));
}
