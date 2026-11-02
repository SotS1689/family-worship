import { test } from "node:test";
import assert from "node:assert/strict";

const stored = new Map();
globalThis.localStorage = { getItem: (k) => stored.get(k) ?? null, setItem: (k, v) => stored.set(k, v), removeItem: (k) => stored.delete(k) };
const asked = [];
globalThis.fetch = async (url, opts) => {
    asked.push({ q: new URL(url).searchParams.get("q"), auth: opts.headers.Authorization });
    // As the ESV API's text endpoint sends it, poetry on separate lines
    return { ok: true, status: 200, json: async () => ({ passages: ["  [1] The LORD is my shepherd; I shall not want.\n    [2] He makes me lie down in green pastures.\n He leads me beside still waters.\n\n"] }) };
};
const { esvPassage, setEsvKey, EsvError } = await import("../src/esv.js");

test("the ESV needs the family's key", async () => {
    await assert.rejects(esvPassage({ book: "PSA", chapter: 23 }), EsvError);
});

test("ESV text is split into verses and asked for by name", async () => {
    setEsvKey("k");
    assert.deepEqual(await esvPassage({ book: "PSA", chapter: 23, from: 1, to: 2 }), [
        [1, "The LORD is my shepherd; I shall not want."],
        [2, "He makes me lie down in green pastures. He leads me beside still waters."],
    ]);
    await esvPassage({ book: "JUD", chapter: 1 });
    await esvPassage({ book: "ROM", chapter: 8, from: 28 });
    assert.deepEqual(asked.map((a) => a.q), ["Psalms 23:1-2", "Jude", "Romans 8"]);
    assert.equal(asked[0].auth, "Token k");
});
