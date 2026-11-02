// What a family can choose to go through. Each choice is a list of "units"
// (a chapter, a day's readings, a catechism question, a hymn) built by content.js.

export const KINDS = {
    bible: { name: "Bible reading", icon: "📖" },
    catechism: { name: "Catechism", icon: "❓" },
    hymns: { name: "Hymns", icon: "🎵" },
};

export const SOURCES = {
    bible: {
        straight: {
            name: "Straight through the Bible",
            about: "Genesis to Revelation in order, one chapter at a time.",
            unit: "chapter",
        },
        section: {
            name: "A part of the Bible you choose",
            about: "A book, several books, or a few chapters, read a verse, a paragraph or a chapter at a time. Paragraphs follow the Berean Standard Bible's (stanzas, in the Psalms).",
            unit: "chapter", // or verse/paragraph: the track's section.step
        },
        "mcheyne-family": {
            name: "M'Cheyne — family readings",
            about: "The two daily readings M'Cheyne set for family worship: Genesis–2 Chronicles and the whole New Testament in a year.",
            unit: "reading",
        },
        mcheyne: {
            name: "M'Cheyne — all four readings",
            about: "Robert Murray M'Cheyne's calendar: the Old Testament once and the New Testament and Psalms twice in a year.",
            unit: "reading",
        },
        chronological: {
            name: "Bible in chronological order",
            about: "The whole Bible in the order events happened (Job with Genesis, Psalms with David's life, the Gospels together).",
            unit: "reading",
        },
        mixed: {
            name: "Bible: OT + NT + Psalms/Proverbs",
            about: "Each reading is an Old Testament chapter, a New Testament chapter, and a Psalm or Proverb. The Old Testament is read once; the New Testament and Psalms/Proverbs repeat to keep pace with it.",
            unit: "reading",
        },
    },
    catechism: {
        wsc: { name: "Westminster Shorter Catechism", short: "WSC", unit: "question" },
        bc1695: {
            name: "Baptist Catechism (1695)",
            short: "Baptist Catechism",
            about: "Every question is sung, from Jim Scott Orrick's The Baptist Catechism Set to Music.",
            unit: "question",
            // Orrick's settings as baptistcatechism.org (Silicon Valley Reformed Baptist Church)
            // publishes them, one recording per question, played from their storage
            music: {
                url: (n) => `https://baptistcatechism-org.storage.googleapis.com/orrick-catechism/orrick-catechism-${String(n).padStart(3, "0")}.mp3`,
                page: (n) => `https://baptistcatechism.org/${n}/`,
                credit: "The Baptist Catechism Set to Music by Jim Scott Orrick, © 2001. Used by permission. Recording via baptistcatechism.org.",
            },
        },
        heidelberg: { name: "Heidelberg Catechism", short: "Heidelberg", unit: "question" },
        collins: {
            name: "An Orthodox Catechism (Collins, 1680)",
            short: "Orthodox Catechism",
            about: "Hercules Collins' Particular Baptist revision of the Heidelberg Catechism, with his questions on baptism. 150 questions.",
            unit: "question",
        },
    },
    hymns: {
        "lets-sing": {
            name: "Let's Sing hymns & psalms",
            about: "Choose hymns and psalms from Let's Sing; they come up in Let's Sing's numbering. Each one's page has Let's Sing's player, to sing along in four parts with the music and words following.",
            unit: "hymn",
        },
    },
};

// Ready-made goals offered when setting up a track (days)
export const GOALS = [
    { days: 91, label: "3 months" },
    { days: 182, label: "6 months" },
    { days: 365, label: "1 year" },
    { days: 730, label: "2 years" },
    { days: 1095, label: "3 years" },
];

// Where Let's Sing lives. To try Let's Sing changes here before publishing them,
// run its dev server and start this one with VITE_LETS_SING_URL=http://localhost:5174/
export const LETS_SING_URL = import.meta.env?.VITE_LETS_SING_URL || "https://taylordrummond.org/lets-sing/";
