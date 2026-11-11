// Drag the ⠿ handle on a card to move it up or down the list (Today and Plans).
// Works with a mouse or a finger; the handle also takes the arrow keys.
import { state, save } from "./store.js";

export const handleHtml = (name) =>
    `<button type="button" class="drag-handle" aria-label="Move ${name} (drag, or use the arrow keys)" title="Drag to reorder">⠿</button>`;

/**
 * Puts the plans with these ids in this order. Plans not in the list (paused
 * ones missing from Today) keep their places; the listed ones fill their own slots.
 */
export function reorderTracks(ids) {
    const slots = [];
    state.tracks.forEach((t, i) => { if (ids.includes(t.id)) slots.push(i); });
    const byId = new Map(state.tracks.map((t) => [t.id, t]));
    const moved = ids.map((id) => byId.get(id)).filter(Boolean);
    slots.forEach((slot, n) => { state.tracks[slot] = moved[n]; });
    save();
}

/** Makes the <li data-id> cards of `list` draggable by their .drag-handle. */
export function makeSortable(list) {
    const ids = () => [...list.children].map((li) => li.dataset.id);
    const finish = (before) => {
        const after = ids();
        if (after.join() !== before.join()) reorderTracks(after);
    };

    list.addEventListener("pointerdown", (e) => {
        const handle = e.target.closest(".drag-handle");
        if (!handle || e.button > 0) return;
        const li = handle.closest("li");
        e.preventDefault();
        const before = ids();
        const grab = e.clientY - li.getBoundingClientRect().top;
        let shift = 0;
        li.classList.add("dragging");

        const move = (ev) => {
            const y = ev.clientY;
            // Scroll when the card is dragged near the top or bottom of the screen
            if (y < 70) window.scrollBy(0, -12);
            else if (y > window.innerHeight - 110) window.scrollBy(0, 12);
            const center = y - grab + li.offsetHeight / 2;
            const next = [...list.children].find((s) => s !== li && s.getBoundingClientRect().top + s.offsetHeight / 2 > center) ?? null;
            if (next !== li.nextElementSibling) list.insertBefore(li, next);
            const natural = li.getBoundingClientRect().top - shift;
            shift = y - grab - natural;
            li.style.transform = `translateY(${shift}px)`;
        };
        // Listen on the whole window: moving the card in the page would drop a pointer capture
        const up = () => {
            window.removeEventListener("pointermove", move);
            window.removeEventListener("pointerup", up);
            window.removeEventListener("pointercancel", up);
            li.classList.remove("dragging");
            li.style.transform = "";
            finish(before);
        };
        window.addEventListener("pointermove", move);
        window.addEventListener("pointerup", up);
        window.addEventListener("pointercancel", up);
    });

    list.addEventListener("keydown", (e) => {
        const handle = e.target.closest(".drag-handle");
        if (!handle || (e.key !== "ArrowUp" && e.key !== "ArrowDown")) return;
        e.preventDefault();
        const li = handle.closest("li");
        const before = ids();
        if (e.key === "ArrowUp" && li.previousElementSibling) list.insertBefore(li, li.previousElementSibling);
        else if (e.key === "ArrowDown" && li.nextElementSibling) list.insertBefore(li.nextElementSibling, li);
        handle.focus();
        finish(before);
    });
}
