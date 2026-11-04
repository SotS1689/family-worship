// Copies Grace Community Church's Statement of Faith from the "What We Believe" page of
// gracecommunityallentown.org into public/data/creeds/gcc.json, in the same shape as the
// confessions (see "Creeds & Confessions" in fetch-content.mjs). Only the church copy of the
// app lists it (CHURCH in src/catalog.js). Run with: npm run fetch-statement
import { writeFileSync } from "node:fs";
import { parseReference } from "../src/bible.js";

const PAGE = "https://gracecommunityallentown.org/wp-json/wp/v2/pages?slug=what-we-believe&_fields=content,link";
const res = await fetch(PAGE);
if (!res.ok) throw new Error(`${PAGE}: ${res.status}`);
const [{ content, link }] = await res.json();
const html = content.rendered;

const ENTITIES = { amp: "&", lt: "<", gt: ">", quot: '"', nbsp: " ", rsquo: "’", lsquo: "‘", rdquo: "”", ldquo: "“", mdash: "—", ndash: "–", hellip: "…" };
const decode = (s) => s
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(+n))
    .replace(/&#x([\da-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&(\w+);/g, (m, e) => ENTITIES[e] ?? m);
const plain = (s) => decode(s.replace(/<[^>]+>/g, "")).replace(/\s+/g, " ").trim();

// "Matthew 3:16-17; 28:19; John 1:1-2" -> each reference with its book (and chapter) written out
function references(line) {
    let book = "", chapter = "";
    return line.replace(/\.\s*$/, "").split(/\s*;\s*/).filter(Boolean).map((raw) => {
        let ref = raw.replace(/^(\d)(?=[A-Z])/, "$1 ");
        const m = ref.match(/^((?:\d\s+)?[A-Za-z][A-Za-z ]*?)\s+(\d.*)$/);
        if (m) [book, ref] = [m[1], m[2]];
        else if (!ref.includes(":") && chapter) ref = `${chapter}:${ref}`;
        if (ref.includes(":")) chapter = ref.split(":")[0];
        const full = `${book} ${ref}`;
        if (!parseReference(full).length) throw new Error(`can't read the reference "${raw}" in "${line}"`);
        return full;
    });
}

const chapters = [];
for (const sec of html.split(/<h3[^>]*>/).slice(1)) {
    const [, heading, body] = sec.match(/^([\s\S]*?)<\/h3>([\s\S]*)$/);
    const m = plain(heading).match(/^(\d+)\.\s*(.+)$/);
    if (!m) continue;
    const notes = [...(body.match(/<ol[^>]*>([\s\S]*?)<\/ol>/)?.[1] ?? "").matchAll(/<li[^>]*>([\s\S]*?)<\/li>/g)]
        .map((li) => references(plain(li[1])));
    const paragraphs = [...body.matchAll(/<p[^>]*>([\s\S]*?)<\/p>/g)].map((p, i) => {
        const segs = [];
        const parts = p[1].split(/<sup>\s*(\d+)\s*<\/sup>/);
        for (let j = 0; j < parts.length; j += 2) {
            const t = plain(parts[j]);
            const n = parts[j + 1];
            if (n && !notes[n - 1]) throw new Error(`article ${m[1]}: no footnote ${n}`);
            if (t) segs.push(n ? { t, p: notes[n - 1] } : { t });
            else if (n && segs.length) segs[segs.length - 1].p = notes[n - 1];
        }
        return { n: i + 1, segs };
    }).filter((p) => p.segs.length);
    chapters.push({ n: +m[1], title: m[2], paragraphs });
}
if (chapters.length !== 12) throw new Error(`found ${chapters.length} articles, expected 12`);

writeFileSync("public/data/creeds/gcc.json", JSON.stringify({
    type: "confession", title: "Grace Community Church Statement of Faith", short: "GCC", year: null, edition: null,
    source: `Grace Community Church, ${link}`, url: link, chapters,
}));
console.log(`wrote public/data/creeds/gcc.json (${chapters.length} articles, ${chapters.reduce((n, c) => n + c.paragraphs.length, 0)} paragraphs)`);
