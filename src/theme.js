import { state } from "./store.js";

// "auto" follows the phone's light/dark setting (style.css); light/dark override it
export function applyTheme() {
    const t = state.settings.theme;
    if (t === "auto") document.documentElement.removeAttribute("data-theme");
    else document.documentElement.dataset.theme = t;
}
