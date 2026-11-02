import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { parseReference, passagesLabel } from "../src/bible.js";

// content.js fetches ./data/...; serve it from public/data
globalThis.fetch = async (url) => {
    const body = await readFile(new URL(`../public/${url.replace(/^\.\//, "")}`, import.meta.url), "utf8");
    return { ok: true, json: async () => JSON.parse(body) };
};
const { sectionUnits } = await import("../src/content.js");
const labels = async (ref, step) => (await sectionUnits({ ref, step })).map((u) => u.label);

test("whole books and spans of books parse", () => {
    assert.equal(parseReference("Romans").length, 16);
    assert.equal(parseReference("Genesis-Deuteronomy").length, 50 + 40 + 27 + 36 + 34);
    assert.equal(passagesLabel(parseReference("Genesis 49 – Exodus 2")), "Genesis 49–50; Exodus 1–2");
    assert.equal(parseReference("1 Kings 21 - 2 Kings 1").length, 3);
    assert.throws(() => parseReference("Exodus - Genesis"));
    assert.equal(passagesLabel(parseReference("Jude 3-4")), "Jude 1:3–4");
    assert.equal(passagesLabel(parseReference("Jude 1")), "Jude");
});

test("a section by chapter", async () => {
    assert.deepEqual(await labels("Matthew 5-7", "chapter"), ["Matthew 5", "Matthew 6", "Matthew 7"]);
    assert.deepEqual(await labels("Romans 8:28-39", "chapter"), ["Romans 8:28–39"]);
});

test("a section by verse", async () => {
    assert.deepEqual(await labels("Psalm 117", "verse"), ["Psalm 117:1", "Psalm 117:2"]);
    // The KJV's verses count too, though the BSB leaves Matthew 18:11 out
    assert.equal((await labels("Matthew 18", "verse")).length, 35);
});

test("a section by paragraph follows the BSB and stays within the section", async () => {
    assert.deepEqual(await labels("Psalm 1", "paragraph"), ["Psalm 1:1–3", "Psalm 1:4–5", "Psalm 1:6"]);
    assert.deepEqual(await labels("Romans 8:1-11", "paragraph"), ["Romans 8:1–4", "Romans 8:5–8", "Romans 8:9–11"]);
    assert.equal((await labels("Psalm 119", "paragraph")).length, 22); // one per Hebrew letter
    const ruth = await sectionUnits({ ref: "Ruth", step: "paragraph" });
    assert.equal(ruth.reduce((n, u) => n + u.passages[0].to - u.passages[0].from + 1, 0), 85); // every verse once
});

test("a section past the end of a chapter is refused", async () => {
    await assert.rejects(sectionUnits({ ref: "Romans 8:40", step: "verse" }), /only 39 verses/);
    await assert.rejects(sectionUnits({ ref: "Romans 17", step: "chapter" }), /only 16 chapters/);
});
