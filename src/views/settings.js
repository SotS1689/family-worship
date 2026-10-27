// Settings: Bible version, which days the family worships, theme, and backups.
import { state, save, exportData, importData } from "../store.js";
import { today } from "../dates.js";
import { VERSIONS } from "../bible.js";
import { app, $, esc, setTitle, toast, nextRender } from "../ui.js";
import { applyTheme } from "../theme.js";

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function renderSettings() {
    nextRender();
    setTitle("Settings");
    const s = state.settings;
    app().innerHTML = `
        <section class="card">
            <h2>Bible version</h2>
            <div class="seg wide">
                ${Object.entries(VERSIONS).map(([v, info]) => `<button data-version="${v}" class="${v === s.bibleVersion ? "on" : ""}">${esc(info.name)}</button>`).join("")}
            </div>
        </section>
        <section class="card">
            <h2>Worship days</h2>
            <p class="muted small">Plans are paced over these days, and streaks aren't broken by the others
               (worshipping on a day off still counts).</p>
            <div class="days">
                ${DAY_NAMES.map((n, i) => `<label class="day"><input type="checkbox" data-day="${i}" ${s.worshipDays[i] ? "checked" : ""}><span>${n}</span></label>`).join("")}
            </div>
        </section>
        <section class="card">
            <h2>Appearance</h2>
            <div class="seg wide">
                ${["auto", "light", "dark"].map((t) => `<button data-theme="${t}" class="${t === s.theme ? "on" : ""}">${t[0].toUpperCase() + t.slice(1)}</button>`).join("")}
            </div>
        </section>
        <section class="card">
            <h2>Backup</h2>
            <p class="muted small">Your plans and check marks are kept only on this device. Save a backup file
               to move to a new phone or keep them safe.</p>
            <div class="actions">
                <button class="btn" id="export">Save backup</button>
                <label class="btn">Restore backup<input type="file" id="import" accept="application/json,.json" hidden></label>
            </div>
        </section>
        <section class="card about">
            <h2>About</h2>
            <p class="small">Scripture: Berean Standard Bible (public domain) and King James Version.
               Catechisms from the Creeds.json project. Hymns from
               <a href="https://sots1689.github.io/lets-sing/" target="_blank" rel="noopener">Let's Sing</a>.
               M'Cheyne calendar via the M'Cheyne Plan app (Apache-2.0).</p>
        </section>`;

    for (const b of app().querySelectorAll("[data-version]")) b.addEventListener("click", () => update(() => (s.bibleVersion = b.dataset.version)));
    for (const b of app().querySelectorAll("[data-theme]")) b.addEventListener("click", () => update(() => {
        s.theme = b.dataset.theme;
        applyTheme();
    }));
    for (const c of app().querySelectorAll("[data-day]")) c.addEventListener("change", () => {
        s.worshipDays[+c.dataset.day] = c.checked;
        if (!s.worshipDays.some(Boolean)) {
            s.worshipDays[+c.dataset.day] = true;
            toast("Keep at least one day.");
        }
        update();
    });

    $("#export").addEventListener("click", () => {
        const a = document.createElement("a");
        a.href = URL.createObjectURL(new Blob([exportData()], { type: "application/json" }));
        a.download = `family-worship-backup-${today()}.json`;
        a.click();
        setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    });
    $("#import").addEventListener("change", async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        if (!confirm("Replace everything on this device with the backup?")) return;
        try {
            importData(await file.text());
            applyTheme();
            toast("Backup restored.");
            renderSettings();
        } catch (err) {
            alert(err.message);
        }
    });
}

function update(change = () => {}) {
    change();
    save();
    renderSettings();
}
