// After `vite build`: writes dist/sw.js from sw-template.js, filling in
// VERSION (a hash of every published file), BIBLE_VERSION (a hash of the Bible
// files) and SHELL (the files cached at install: everything except the Bible
// books, which are cached as they're read, and source maps).
import { readFileSync, writeFileSync, readdirSync, statSync } from "node:fs";
import { createHash } from "node:crypto";
import { join, relative, sep } from "node:path";

const DIST = "dist";

const walk = (dir) =>
    readdirSync(dir).flatMap((name) => {
        const p = join(dir, name);
        return statSync(p).isDirectory() ? walk(p) : [p];
    });

const files = walk(DIST)
    .map((p) => relative(DIST, p).split(sep).join("/"))
    .filter((f) => f !== "sw.js")
    .sort();

const isBible = (f) => f.startsWith("data/bible/");

const hashOf = (list, seed = "") => {
    const hash = createHash("sha256").update(seed);
    for (const f of list) {
        hash.update(f);
        hash.update(readFileSync(join(DIST, f)));
    }
    return hash.digest("hex").slice(0, 16);
};

const template = readFileSync("sw-template.js", "utf8");
const version = hashOf(files, template);
const bibleVersion = hashOf(files.filter(isBible));
const shell = ["./", ...files.filter((f) => !isBible(f) && !f.endsWith(".map")).map((f) => `./${f}`)];

const sw = template
    .replace("__VERSION__", version)
    .replace("__BIBLE_VERSION__", bibleVersion)
    .replace("__SHELL__", JSON.stringify(shell, null, 4));
writeFileSync(join(DIST, "sw.js"), sw);
console.log(`stamp-sw: version ${version}, ${shell.length} shell files, ${files.filter(isBible).length} Bible books cached as read`);
