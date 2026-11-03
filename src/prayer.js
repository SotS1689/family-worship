// Prayer plans: an order to pray in, kept here rather than in public/data/ since
// they're small. Each part is { title, line?, prompt, refs? }:
//   line   words to pray or say together (the Lord's Prayer's own words)
//   prompt what to pray about in this part
//   refs   Scripture to read or remember with it
// A family's own plan keeps its parts on the track (track.parts) and its name in track.name.
//
// A prayer track goes round and round rather than finishing (see schedule.js):
//   track.each = "all"  the whole plan every worship day (one unit)
//              = "part" one part each worship day, in turn (a unit per part)
// Praying the Psalms (source "psalms") is always a psalm a day: its units carry
// passages, shown like a Bible reading, and a guide to praying them, but no parts.
import { passageLabel } from "./bible.js";

export const PRAYER_PLANS = {
    acts: {
        name: "A.C.T.S.",
        parts: [
            {
                title: "Adoration",
                prompt: "Praise God for who he is: holy, almighty, wise, faithful, merciful. Name one thing about him you've seen in Scripture today.",
                refs: ["Psalm 145:1–3", "Revelation 4:11"],
            },
            {
                title: "Confession",
                prompt: "Admit to God, honestly and by name, the ways we have sinned against him and one another, and ask his forgiveness for Christ's sake.",
                refs: ["Psalm 51:1–4", "1 John 1:9"],
            },
            {
                title: "Thanksgiving",
                prompt: "Thank God for what he has done: for Christ and the gospel, for answered prayer, and for the gifts of this day.",
                refs: ["Psalm 103:1–5", "1 Thessalonians 5:18"],
            },
            {
                title: "Supplication",
                prompt: "Ask God for what we and others need: our family, the church, friends and neighbors, missionaries, those who are sick or grieving, and the lost.",
                refs: ["Philippians 4:6–7", "1 Timothy 2:1–4"],
            },
        ],
    },
    "lords-prayer": {
        name: "The Lord's Prayer",
        parts: [
            {
                title: "Our Father",
                line: "Our Father which art in heaven,",
                prompt: "Come to God with reverence and confidence, as children to a Father who is able and ready to help. Pray with and for others, not only for yourselves.",
                refs: ["Romans 8:15", "Ephesians 3:14–15"],
            },
            {
                title: "His name",
                line: "Hallowed be thy name.",
                prompt: "Ask that God would be honored: in our words and lives, in the church, and through all he does in the world.",
                refs: ["Psalm 67:1–3"],
            },
            {
                title: "His kingdom",
                line: "Thy kingdom come.",
                prompt: "Pray for the gospel to spread, for sinners to be saved, for the church to grow, and for Christ to come again.",
                refs: ["Matthew 9:37–38", "Revelation 22:20"],
            },
            {
                title: "His will",
                line: "Thy will be done in earth, as it is in heaven.",
                prompt: "Ask for hearts that gladly obey God and submit to his will, in what he commands and in what he sends us.",
                refs: ["Psalm 119:34–36", "Luke 22:42"],
            },
            {
                title: "Daily bread",
                line: "Give us this day our daily bread.",
                prompt: "Bring the needs of today: food and work, health, home and family, and ask God to bless what he gives.",
                refs: ["Proverbs 30:8–9", "Philippians 4:19"],
            },
            {
                title: "Forgiveness",
                line: "And forgive us our debts, as we forgive our debtors.",
                prompt: "Confess sin and ask forgiveness for Christ's sake. Ask for grace to forgive anyone who has wronged us.",
                refs: ["Psalm 130:3–4", "Ephesians 4:32"],
            },
            {
                title: "Deliverance",
                line: "And lead us not into temptation, but deliver us from evil:",
                prompt: "Ask God to keep us from temptation, to hold us up when we're tempted, and to guard us from the evil one.",
                refs: ["1 Corinthians 10:13", "2 Thessalonians 3:3"],
            },
            {
                title: "His glory",
                line: "For thine is the kingdom, and the power, and the glory, for ever. Amen.",
                prompt: "End with praise, trusting God alone to answer, because all power and glory are his.",
                refs: ["1 Chronicles 29:11–13"],
            },
        ],
        credit: "Matthew 6:9–13, King James Version.",
    },
};

// A blank part for a family's own plan
export const blankPart = () => ({ title: "", prompt: "" });

export const prayerPlanOf = (track) => track.source === "custom"
    ? { name: track.name || "Our prayer plan", parts: track.parts ?? [] }
    : track.source === "psalms" ? PSALMS_PLAN : PRAYER_PLANS[track.source];

// Praying the Psalms: a psalm a day, read and then prayed back to God. Psalm 119 is
// too long for one sitting, so it goes by its 22 stanzas of 8 verses, one for each
// letter of the Hebrew alphabet, which begins each verse of its stanza.
const HEBREW = [
    ["א", "Aleph"], ["ב", "Beth"], ["ג", "Gimel"], ["ד", "Daleth"], ["ה", "He"], ["ו", "Waw"],
    ["ז", "Zayin"], ["ח", "Heth"], ["ט", "Teth"], ["י", "Yodh"], ["כ", "Kaph"], ["ל", "Lamedh"],
    ["מ", "Mem"], ["נ", "Nun"], ["ס", "Samekh"], ["ע", "Ayin"], ["פ", "Pe"], ["צ", "Tsadhe"],
    ["ק", "Qoph"], ["ר", "Resh"], ["ש", "Shin"], ["ת", "Taw"],
];
export const PSALMS_PLAN = {
    name: "Praying the Psalms",
    guide: "Read the psalm aloud, then pray it back to God in your own words: praise him for what it says of him, "
        + "confess what it shows of your sin, give thanks for what it promises, and ask for what it teaches you to want.",
};
export function psalmUnits() {
    const units = [];
    for (let n = 1; n <= 150; n++) {
        if (n !== 119) {
            units.push({ label: passageLabel({ book: "PSA", chapter: n }), passages: [{ book: "PSA", chapter: n }] });
            continue;
        }
        HEBREW.forEach(([letter, name], i) => {
            const p = { book: "PSA", chapter: 119, from: 8 * i + 1, to: 8 * i + 8 };
            units.push({ label: `${passageLabel(p)} ${letter} ${name}`, passages: [p] });
        });
    }
    return units.map((u) => ({ ...u, guide: PSALMS_PLAN.guide, parts: [] }));
}

// A prayer track's units: the whole plan, or each of its parts
export function prayerUnits(track) {
    if (track.source === "psalms") return psalmUnits();
    const plan = prayerPlanOf(track);
    const parts = plan.parts.filter((p) => p.title || p.prompt || p.line);
    if (!parts.length) return [];
    if (track.each === "part") return parts.map((p) => ({ label: p.title || "Prayer", parts: [p], credit: plan.credit }));
    return [{ label: plan.name, parts, credit: plan.credit }];
}
