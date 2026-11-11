// Makes the app's own copy of Jim Scott Orrick's Baptist Catechism recordings
// (The Baptist Catechism Set to Music), one per question, from baptistcatechism.org.
// Used with permission from Orrick and from the site's developer.
//
//   original  sources/orrick/orrick-catechism-001.mp3       (as the site has it, not committed)
//   app copy  public/audio/bc1695/orrick-catechism-001.mp3  (96 kbps MP3, committed)
//
// The site keeps each recording in its own checksum-named folder
// (assets.baptistcatechism.org/<sha256>/orrick-catechism-001.mp3), so each address is
// read from the question's page. Files already present are skipped; add --fresh to
// download and convert everything again. Needs ffmpeg on the PATH.
import { readFileSync, writeFileSync, existsSync, mkdirSync, statSync } from "node:fs";
import { execFileSync } from "node:child_process";

const RAW = "sources/orrick";
const OUT = "public/audio/bc1695";
const fresh = process.argv.includes("--fresh");
mkdirSync(RAW, { recursive: true });
mkdirSync(OUT, { recursive: true });

const count = JSON.parse(readFileSync("public/data/catechisms/bc1695.json", "utf8")).questions.length;
const name = (n) => `orrick-catechism-${String(n).padStart(3, "0")}.mp3`;

let bytes = 0;
for (let n = 1; n <= count; n++) {
    const raw = `${RAW}/${name(n)}`;
    const out = `${OUT}/${name(n)}`;
    if (fresh || !existsSync(raw)) {
        const page = `https://baptistcatechism.org/${n}/`;
        const res = await fetch(page);
        if (!res.ok) throw new Error(`${page}: HTTP ${res.status}`);
        const url = (await res.text()).match(/<audio[^>]*\bsrc="([^"]+\.mp3)"/)?.[1];
        if (!url) throw new Error(`${page}: no recording found; has the site changed?`);
        const mp3 = await fetch(url);
        if (!mp3.ok) throw new Error(`${url}: HTTP ${mp3.status}`);
        writeFileSync(raw, Buffer.from(await mp3.arrayBuffer()));
        console.log(`  downloaded ${name(n)}`);
    }
    if (fresh || !existsSync(out)) {
        execFileSync("ffmpeg", ["-v", "error", "-y", "-i", raw, "-map", "0:a", "-map_metadata", "-1", "-c:a", "libmp3lame", "-b:a", "96k", out]);
    }
    bytes += statSync(out).size;
}
console.log(`${OUT}: ${count} recordings, ${(bytes / 1e6).toFixed(1)} MB`);
