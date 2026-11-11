// Sign in with Google (optional) to keep the family's plans and check marks on
// every device. Everything still works signed out, kept on this device as
// before; signing in adds this device's plans to the account and brings in
// what other devices saved. How two copies are combined: src/syncMerge.js.
//
// In the cloud (Firestore, free plan), per family:
//   users/<uid>              { settings, order, tracks: { <id>: item }, years: ["2026", ...] }
//   users/<uid>/years/<YYYY> { days: { <YYYY-MM-DD>: item } }   one document per year of the log
import { state, save, onChange } from "./store.js";
import { stampChanges, versioned, merge, applyMerged, yearsOf, stable } from "./syncMerge.js";

const ACCOUNT = "fw-sync-account"; // { uid, name, email } while signed in; { pending: true } mid-redirect
const STAMPS = "fw-sync-stamps"; // see syncMerge.js

const read = (key, fallback) => {
    try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; }
};
const write = (key, value) => {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* private mode / full */ }
};
const drop = (key) => {
    try { localStorage.removeItem(key); } catch { /* nothing to drop */ }
};

/** The signed-in account ({ uid, name, email }), or null. */
export const account = () => {
    const a = read(ACCOUNT, null);
    return a?.uid ? a : null;
};

let fb = null;
const firebase = async () => (fb ??= await import("./firebase.js"));

// "idle" (signed out) | "syncing" | "synced" | "offline" | "error"
let status = "idle";
let lastSynced = 0;
const listeners = new Set();
export const syncStatus = () => ({ account: account(), status, lastSynced });
/** `fn({ account, status, lastSynced, changed })` after every step; `changed` when this device's data changed. */
export function onSync(fn) {
    listeners.add(fn);
    return () => listeners.delete(fn);
}
const emit = (changed = false) => listeners.forEach((fn) => fn({ ...syncStatus(), changed }));

const setAccount = (user) => write(ACCOUNT, { uid: user.uid, name: user.displayName ?? "", email: user.email ?? "" });

// ---- Noting what changed on this device -----------------------------------------
// Kept whether or not anyone is signed in, so changes made signed out still
// count as newer when the family signs in again.

let applying = false;
if (!read(STAMPS, null)) write(STAMPS, stampChanges(state, null, Date.now()));
onChange(() => {
    if (applying) return;
    write(STAMPS, stampChanges(state, read(STAMPS, null), Date.now()));
    changed();
});

// ---- Signing in and out --------------------------------------------------------

/** Opens Google's sign-in. Resolves true once signed in, false if it was closed. */
export async function signIn() {
    const f = await firebase();
    const provider = new f.GoogleAuthProvider();
    provider.setCustomParameters({ prompt: "select_account" });
    try {
        const cred = await f.signInWithPopup(f.auth, provider);
        setAccount(cred.user);
    } catch (e) {
        if (e.code === "auth/popup-closed-by-user" || e.code === "auth/cancelled-popup-request") return false;
        // Where a popup can't open, go to Google and come back (finished in sync())
        if (e.code === "auth/popup-blocked" || e.code === "auth/operation-not-supported-in-this-environment") {
            write(ACCOUNT, { pending: true });
            await f.signInWithRedirect(f.auth, provider);
            return false;
        }
        throw e;
    }
    await sync();
    return true;
}

/** Signs out. With `removeHere`, also takes the plans and check marks off this device. */
export async function signOut(removeHere = false) {
    clearTimeout(timer);
    const f = await firebase();
    await f.signOut(f.auth);
    drop(ACCOUNT);
    if (removeHere) {
        applying = true;
        try {
            state.tracks.splice(0);
            for (const day of Object.keys(state.log)) delete state.log[day];
            save();
        } finally {
            applying = false;
        }
        // Start afresh: this device's next sign-in shouldn't remove these from the account
        write(STAMPS, stampChanges(state, null, Date.now()));
    }
    status = "idle";
    emit(removeHere);
}

// ---- Keeping in step -----------------------------------------------------------

let timer;
/** Something was saved on this device: send it up shortly (a burst of changes goes as one). */
function changed() {
    if (!account()) return;
    clearTimeout(timer);
    timer = setTimeout(sync, 2000);
}

let running = null, again = false;
/** Brings this device and the account into step. Safe to call any time; does nothing signed out. */
export function sync() {
    if (!read(ACCOUNT, null)) return Promise.resolve();
    if (running) {
        again = true;
        return running;
    }
    running = (async () => {
        do {
            again = false;
            await syncOnce();
        } while (again);
    })().finally(() => (running = null));
    return running;
}

async function syncOnce() {
    if (!navigator.onLine) {
        status = "offline";
        return emit();
    }
    status = "syncing";
    emit();
    try {
        const f = await firebase();
        await f.auth.authStateReady();
        const user = f.auth.currentUser;
        if (!user) {
            // Signed out elsewhere, or a sign-in that didn't finish
            drop(ACCOUNT);
            status = "idle";
            return emit();
        }
        if (user.uid !== account()?.uid) setAccount(user); // back from a redirect sign-in
        const changedHere = await syncWith(f, user.uid);
        status = "synced";
        lastSynced = Date.now();
        emit(changedHere);
    } catch (e) {
        console.warn("sync:", e);
        status = navigator.onLine ? "error" : "offline";
        emit();
    }
}

/**
 * One sync against Firestore functions `f` (exported for tests, with a stand-in
 * `f`). Reads the account, combines it with this device, writes back whatever
 * the account was missing, and updates this device. Returns true if this
 * device's data changed.
 */
export async function syncWith(f, uid) {
    const here = versioned(read(STAMPS, null) ?? stampChanges(state, null, Date.now()));
    let merged;
    // A transaction, so two devices syncing at the same moment can't undo each other
    await f.runTransaction(f.db, async (tx) => {
        const userRef = f.doc(f.db, "users", uid);
        const top = await tx.get(userRef);
        const cloud = top.exists() ? top.data() : {};
        const years = [...new Set([...(cloud.years ?? []), ...yearsOf(here.log)])].sort();
        const yearRefs = years.map((y) => f.doc(f.db, "users", uid, "years", y));
        const yearDocs = await Promise.all(yearRefs.map((ref) => tx.get(ref)));
        const cloudDays = yearDocs.map((d) => (d.exists() ? d.data().days ?? {} : {}));

        merged = merge(here, { ...cloud, log: Object.assign({}, ...cloudDays) });

        const newTop = { settings: merged.settings, order: merged.order, tracks: merged.tracks, years };
        if (stable(newTop) !== stable({ settings: cloud.settings, order: cloud.order, tracks: cloud.tracks, years: cloud.years })) {
            tx.set(userRef, newTop);
        }
        years.forEach((y, i) => {
            const days = Object.fromEntries(Object.entries(merged.log).filter(([day]) => day.startsWith(y)));
            if (stable(days) !== stable(cloudDays[i])) tx.set(yearRefs[i], { days });
        });
    });

    if (stable(merged) === stable(here)) return false;
    applying = true;
    try {
        write(STAMPS, applyMerged(state, merged));
        save();
    } finally {
        applying = false;
    }
    return true;
}

// Catch up when the app comes back to the screen or back online
if (typeof document !== "undefined") {
    document.addEventListener("visibilitychange", () => {
        if (document.visibilityState === "visible" && Date.now() - lastSynced > 60_000) sync();
    });
    addEventListener("online", () => sync());
}
