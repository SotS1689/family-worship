// Install the app (Android), the same card Let's Sing shows.
// Chrome, Edge and Samsung Internet on Android announce when the site can be
// installed (beforeinstallprompt). We hold on to that and show a big Install
// button on the Today page, so nobody has to find "Install app" in the
// browser's menu. It never fires once the app is installed, or on iPhones.
import { toast } from "./ui.js";

const SNOOZE_KEY = "fw-installSnoozed";
const SNOOZE_DAYS = 14;
let installPrompt = null;
let onToday = false;

function snoozedAt() {
    try { return +localStorage.getItem(SNOOZE_KEY) || 0; } catch { return 0; }
}

function render() {
    const slot = document.getElementById("install-slot");
    if (!slot) return;
    const snoozed = Date.now() - snoozedAt() < SNOOZE_DAYS * 864e5;
    if (!installPrompt || snoozed || !onToday) return (slot.innerHTML = "");
    slot.innerHTML = `
        <div class="install-banner">
            <p class="install-title">Put Family Worship on your phone</p>
            <p class="install-body">Install it like any other app, with its own icon on your home screen.</p>
            <div class="install-actions">
                <button type="button" class="install-btn" id="install-app">Install app</button>
                <button type="button" class="install-later" id="install-later">Not now</button>
            </div>
        </div>`;
    document.getElementById("install-app").addEventListener("click", async () => {
        const prompt = installPrompt;
        installPrompt = null; // each prompt can only be shown once
        prompt.prompt();
        await prompt.userChoice;
        render();
    });
    document.getElementById("install-later").addEventListener("click", () => {
        try { localStorage.setItem(SNOOZE_KEY, String(Date.now())); } catch { /* private mode */ }
        render();
    });
}

// Called on every page change: the card only shows on Today
export function showInstallCard(today) {
    onToday = today;
    render();
}

window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault(); // we show our own button instead of Chrome's mini bar
    installPrompt = event;
    render();
});
window.addEventListener("appinstalled", () => {
    installPrompt = null;
    render();
    toast("Family Worship is installed. Look for its icon on your home screen.");
});
