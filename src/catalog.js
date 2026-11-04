// What a family can choose to go through. Each choice is a list of "units"
// (a chapter, a day's readings, a catechism question, a hymn) built by content.js.

export const KINDS = {
    bible: { name: "Bible reading", icon: "📖" },
    catechism: { name: "Catechism", icon: "❓" },
    creeds: { name: "Creeds & Confessions", icon: "📜" },
    prayer: { name: "Prayer", icon: "🙏" },
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
        wlc: {
            name: "Westminster Larger Catechism",
            short: "WLC",
            about: "The Westminster Assembly's fuller catechism, 196 questions, in modern spelling.",
            unit: "question",
        },
        collins: {
            name: "An Orthodox Catechism (Collins, 1680)",
            short: "Orthodox Catechism",
            about: "Hercules Collins' Particular Baptist revision of the Heidelberg Catechism, with his questions on baptism. 150 questions.",
            unit: "question",
        },
    },
    // From symbolics.dev (public/data/creeds/<id>.json, see content.js). A creed comes up
    // every worship day, said whole or an article at a time, and goes round like a prayer
    // plan (clauses: false when it has no articles to take one at a time). A confession is
    // read through at a pace, a paragraph or a chapter at a time (the track's step).
    creeds: {
        apostles: { type: "creed", name: "The Apostles' Creed", about: "The church's oldest summary of the faith, in twelve articles.", unit: "article" },
        nicene: { type: "creed", name: "The Nicene Creed (381)", about: "The creed of the Council of Constantinople, confessing the Son and the Spirit with the Father, one God.", unit: "creed", clauses: false },
        athanasian: { type: "creed", name: "The Athanasian Creed", about: "The Trinity and the person of Christ, in 42 articles.", unit: "article" },
        chalcedon: { type: "creed", name: "The Chalcedonian Definition (451)", about: "Christ truly God and truly man, in one person.", unit: "creed", clauses: false },
        nicaea: { type: "creed", name: "The Creed of Nicaea (325)", about: "The first council's creed against Arius, as printed in An Orthodox Catechism (1680).", unit: "creed", clauses: false },
        lbcf1689: { type: "confession", name: "Second London Baptist Confession (1689)", short: "2LCF", about: "32 chapters, 160 paragraphs, with Scripture proofs. Modern spelling.", unit: "paragraph" },
        wcf: { type: "confession", name: "Westminster Confession of Faith (1646)", short: "WCF", about: "33 chapters, 172 paragraphs, with Scripture proofs. Modern spelling.", unit: "paragraph" },
        savoy: { type: "confession", name: "Savoy Declaration (1658)", short: "Savoy", about: "The Congregationalists' revision of the Westminster Confession, 33 chapters. Modern spelling.", unit: "paragraph" },
        phila1742: { type: "confession", name: "Philadelphia Confession (1742)", short: "PCF", about: "The 1689 Confession with chapters on singing and the laying on of hands, as printed by B. Franklin.", unit: "paragraph" },
        belgic: { type: "confession", name: "Belgic Confession (1561)", short: "Belgic", chapter: "Article", about: "Guido de Brès' confession of the Reformed churches in the Low Countries, 37 articles.", unit: "paragraph" },
        dort: { type: "confession", name: "Canons of Dort (1619)", short: "Dort", chapter: "", about: "The Synod of Dort on predestination, the atonement, grace and perseverance: four heads, 59 articles.", unit: "paragraph" },
        orthodox1679: { type: "confession", name: "Orthodox Creed (1679)", short: "Orthodox Creed", chapter: "Article", about: "The General Baptists' confession, 50 articles, with Scripture proofs.", unit: "paragraph" },
        standard1660: { type: "confession", name: "Standard Confession (1660)", short: "Standard Confession", about: "The General Baptists' confession of 1660, 25 articles.", unit: "paragraph" },
    },
    // The plans themselves are in prayer.js
    prayer: {
        acts: {
            name: "A.C.T.S.",
            about: "Adoration, Confession, Thanksgiving, Supplication: praise God for who he is, confess sin, thank him for what he has done, then ask for what we and others need.",
            unit: "prayer",
        },
        "lords-prayer": {
            name: "The Lord's Prayer",
            about: "Pray through the prayer Jesus taught (Matthew 6:9–13) a petition at a time, with what each one asks for.",
            unit: "prayer",
        },
        psalms: {
            name: "Praying the Psalms",
            about: "A psalm a day, read aloud and then prayed back to God. Psalm 119 is taken a stanza at a time, by the 22 letters of the Hebrew alphabet, so the Psalter goes round about every 171 days.",
            unit: "psalm",
        },
        custom: {
            name: "Your own prayer plan",
            about: "Make your own order of prayer: name each part and say what to pray about, such as missionaries, your church, or family needs.",
            unit: "prayer",
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
