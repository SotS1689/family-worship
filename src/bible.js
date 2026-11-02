// The 66 books: code (as in the eBible.org files and public/data/bible/<version>/<code>.json),
// display name, chapter count, and other names reading plans use for it.
export const BOOKS = [
    ["GEN", "Genesis", 50], ["EXO", "Exodus", 40], ["LEV", "Leviticus", 27],
    ["NUM", "Numbers", 36], ["DEU", "Deuteronomy", 34], ["JOS", "Joshua", 24],
    ["JDG", "Judges", 21], ["RUT", "Ruth", 4], ["1SA", "1 Samuel", 31],
    ["2SA", "2 Samuel", 24], ["1KI", "1 Kings", 22], ["2KI", "2 Kings", 25],
    ["1CH", "1 Chronicles", 29], ["2CH", "2 Chronicles", 36], ["EZR", "Ezra", 10],
    ["NEH", "Nehemiah", 13], ["EST", "Esther", 10], ["JOB", "Job", 42],
    ["PSA", "Psalms", 150, ["Psalm"]], ["PRO", "Proverbs", 31], ["ECC", "Ecclesiastes", 12],
    ["SOL", "Song of Solomon", 8, ["Song of Songs", "Song"]], ["ISA", "Isaiah", 66],
    ["JER", "Jeremiah", 52], ["LAM", "Lamentations", 5], ["EZE", "Ezekiel", 48],
    ["DAN", "Daniel", 12], ["HOS", "Hosea", 14], ["JOE", "Joel", 3],
    ["AMO", "Amos", 9], ["OBA", "Obadiah", 1], ["JON", "Jonah", 4],
    ["MIC", "Micah", 7], ["NAH", "Nahum", 3], ["HAB", "Habakkuk", 3],
    ["ZEP", "Zephaniah", 3], ["HAG", "Haggai", 2], ["ZEC", "Zechariah", 14],
    ["MAL", "Malachi", 4],
    ["MAT", "Matthew", 28], ["MAR", "Mark", 16], ["LUK", "Luke", 24],
    ["JOH", "John", 21], ["ACT", "Acts", 28], ["ROM", "Romans", 16],
    ["1CO", "1 Corinthians", 16], ["2CO", "2 Corinthians", 13], ["GAL", "Galatians", 6],
    ["EPH", "Ephesians", 6], ["PHI", "Philippians", 4], ["COL", "Colossians", 4],
    ["1TH", "1 Thessalonians", 5], ["2TH", "2 Thessalonians", 3], ["1TI", "1 Timothy", 6],
    ["2TI", "2 Timothy", 4], ["TIT", "Titus", 3], ["PHM", "Philemon", 1],
    ["HEB", "Hebrews", 13], ["JAM", "James", 5], ["1PE", "1 Peter", 5],
    ["2PE", "2 Peter", 3], ["1JO", "1 John", 5], ["2JO", "2 John", 1],
    ["3JO", "3 John", 1], ["JUD", "Jude", 1], ["REV", "Revelation", 22],
].map(([code, name, chapters, aliases = []], index) => ({ code, name, chapters, aliases, index, testament: index < 39 ? "OT" : "NT" }));

export const BOOK = Object.fromEntries(BOOKS.map((b) => [b.code, b]));

const squash = (s) => s.toLowerCase().replace(/[\s.]/g, "");
const byName = new Map();
for (const b of BOOKS) for (const n of [b.name, ...b.aliases]) byName.set(squash(n), b);

// Full name, alias, or an abbreviation only one book starts with ("2 Sam", "Rev")
function findBook(name) {
    const key = squash(name);
    if (byName.has(key)) return byName.get(key);
    const matches = BOOKS.filter((b) => squash(b.name).startsWith(key));
    return key.length >= 2 && matches.length === 1 ? matches[0] : null;
}

// The book codes most Bible software uses (USFM), where eBible.org's verse files differ
const USFM = { SOL: "SNG", EZE: "EZK", JOE: "JOL", NAH: "NAM", MAR: "MRK", JOH: "JHN", PHI: "PHP", JAM: "JAS", "1JO": "1JN", "2JO": "2JN", "3JO": "3JN" };
export const usfmCode = (code) => USFM[code] ?? code;

// bsb and kjv are kept in the app and work offline. The esv is read from Crossway's
// ESV API; the others from the Free Use Bible API (bible.helloao.org) as each
// chapter is opened, so they need the internet. `online` is that API's id for the
// translation, `credit` the notice its licence asks for.
export const VERSIONS = {
    bsb: { name: "Berean Standard Bible", short: "BSB" },
    kjv: { name: "King James Version", short: "KJV" },
    // From Crossway's ESV API, with the family's own key (see esv.js)
    esv: { name: "English Standard Version", short: "ESV", esv: true },
    gnv: { name: "Geneva Bible (1599)", short: "Geneva", online: "eng_gnv" },
    asv: { name: "American Standard Version (1901)", short: "ASV", online: "eng_asv" },
    rv: { name: "Revised Version (1885)", short: "RV", online: "eng_rv5" },
    ylt: { name: "Young's Literal Translation", short: "YLT", online: "eng_ylt" },
    darby: { name: "Darby Translation", short: "Darby", online: "eng_dby" },
    webster: { name: "Noah Webster Bible", short: "Webster", online: "eng_wbs" },
    web: { name: "World English Bible", short: "WEB", online: "ENGWEBP" },
    msb: { name: "Majority Standard Bible", short: "MSB", online: "eng_msb" },
    lsv: { name: "Literal Standard Version", short: "LSV", online: "eng_lsv", credit: "Literal Standard Version, © 2020 Covenant Press. Creative Commons Attribution-ShareAlike 4.0." },
    leb: { name: "Lexham English Bible", short: "LEB", online: "eng_leb", credit: "Lexham English Bible, © Logos Bible Software." },
};

// A passage: { book: code, chapter, from?, to? } -- from/to are verses; absent = whole chapter.

// "Genesis 9-10", "Psalm 119:1-24", "2 Samuel 5:1-10; 1 Chronicles 11-12", "Psalm 46, 80, 135",
// "Romans", "Genesis-Deuteronomy", "Genesis 37 - Exodus 2"
// -> one passage per chapter (or chapter part).
export function parseReference(text) {
    const passages = [];
    let book = null;
    const chaptersOf = (b, from = 1, to = b.chapters) => {
        if (from < 1 || to > b.chapters || from > to) throw new Error(`${b.name} has ${b.chapters} chapter${b.chapters === 1 ? "" : "s"}`);
        for (let c = from; c <= to; c++) passages.push({ book: b.code, chapter: c });
    };
    for (const part of text.split(/[;,]/).map((s) => s.trim()).filter(Boolean)) {
        const whole = findBook(part);
        if (whole) { // "Obadiah", "Romans"
            book = whole;
            chaptersOf(book);
            continue;
        }
        // From one book (and chapter) to another
        const span = part.match(/^(.*?\D)\s*(\d+)?\s*[-–—]\s*(.*?\D)\s*(\d+)?$/);
        const [first, last] = span ? [findBook(span[1].trim()), findBook(span[3].trim())] : [];
        if (first && last && first !== last) {
            if (last.index < first.index) throw new Error(`${last.name} comes before ${first.name}`);
            for (let i = first.index; i <= last.index; i++) {
                const b = BOOKS[i];
                chaptersOf(b, i === first.index && span[2] ? +span[2] : 1, i === last.index && span[4] ? +span[4] : b.chapters);
            }
            book = last;
            continue;
        }
        const m = part.match(/^(.*?)\s*(\d+)(?::(\d+))?(?:\s*[-–]\s*(\d+)(?::(\d+))?)?$/);
        if (!m) throw new Error(`Can't read reference "${part}" in "${text}"`);
        const [, name, c1, v1, x2, v2] = m;
        if (name) {
            book = findBook(name);
            if (!book) throw new Error(`Unknown book "${name}" in "${text}"`);
        }
        if (!book) throw new Error(`No book given in "${text}"`);
        const ch = +c1;
        if (book.chapters === 1 && !v1 && (x2 || ch > 1)) {
            // "Jude 3-4", "Philemon 4": verses ("Jude 1" stays the whole book, as the plans use it)
            passages.push({ book: book.code, chapter: 1, from: ch, to: x2 ? +x2 : ch });
        } else if (v1 && x2 && v2) {
            // Psalm 18:1-19:6 style: across a chapter break
            passages.push({ book: book.code, chapter: ch, from: +v1 });
            for (let c = ch + 1; c < +x2; c++) passages.push({ book: book.code, chapter: c });
            passages.push({ book: book.code, chapter: +x2, from: 1, to: +v2 });
        } else if (v1) {
            passages.push({ book: book.code, chapter: ch, from: +v1, to: x2 ? +x2 : +v1 });
        } else {
            for (let c = ch; c <= (x2 ? +x2 : ch); c++) passages.push({ book: book.code, chapter: c });
        }
    }
    return passages;
}

export function passageLabel(p) {
    const b = BOOK[p.book];
    const name = b.code === "PSA" ? "Psalm" : b.name;
    if (p.from == null) return b.chapters === 1 ? name : `${name} ${p.chapter}`;
    if (p.to == null) return `${name} ${p.chapter}:${p.from}ff`;
    return p.from === p.to ? `${name} ${p.chapter}:${p.from}` : `${name} ${p.chapter}:${p.from}–${p.to}`;
}

// Joins consecutive whole chapters of one book: Genesis 1, Genesis 2 -> "Genesis 1–2"
export function passagesLabel(passages) {
    const out = [];
    for (let i = 0; i < passages.length; i++) {
        const p = passages[i];
        let j = i;
        while (p.from == null && j + 1 < passages.length && passages[j + 1].book === p.book
            && passages[j + 1].from == null && passages[j + 1].chapter === passages[j].chapter + 1) j++;
        out.push(j === i ? passageLabel(p) : `${passageLabel(p)}–${passages[j].chapter}`);
        i = j;
    }
    return out.join("; ");
}
