"""Reads Hercules Collins' An Orthodox Catechism (1680) from the Word document and
writes public/data/catechisms/collins.json, in the same shape as the other catechisms.

    python scripts/import_collins.py "<path to The Orthodox Catechism.docx>"

The document's layout: each question is a "Heading 2" paragraph ("1. What is your only
comfort...?"), its answer one or more "Normal" paragraphs, and its proof texts one
"List Paragraph" per footnote. Footnote numbers run through the whole document and are
left in the text ("I am not my own,1 but belong"); the importer removes them.
Needs python-docx (pip install python-docx).
"""
import json
import re
import sys
from pathlib import Path

import docx

OUT = Path(__file__).resolve().parent.parent / "public" / "data" / "catechisms" / "collins.json"
EXPECTED = 150

# Question paragraphs the document cuts short, or styles as body text, completed here
FULL_QUESTIONS = {
    8: "But are we so corrupt that we are totally unable to do any good and inclined toward all evil?",
    9: "But doesn't God do us an injustice by requiring in his law what we are unable to do?",
    10: "Will God permit such disobedience and rebellion to go unpunished?",
    18: "And who is this mediator—true God and at the same time truly human and truly righteous?",
    52: "How does Christ's return “to judge the living and the dead” comfort you?",
    80: "Why then does the Holy Spirit call baptism the washing of rebirth and the washing away of sins?",
}
# Typing slips in the proof texts
PROOF_FIXES = {
    "Romans 7:7-25}": "Romans 7:7-25",
    "Luke 4:18 a. 61:1)": "Luke 4:18 (Isa. 61:1)",
    "Gen.12;6-7; 13.15-17; 15:16,18; 17:8-11": "Gen. 12:6-7; Gen. 13:15-17; Gen. 15:16, 18; Gen. 17:8-11",
}

QUESTION = re.compile(r"^(\d+)\.\s+(.*)$")
# A number not part of a Scripture reference ("5:12", "7-9", "12, 18")
NUMBER = re.compile(r"(?<![\d:])(?<!\d[-–])(?<!\d,)(?<!\d, )\s?(\d+)(?![\d:\-–])")
# Footnote marks from the text's own source, outside the running numbers: "a God to4 Abraham",
# "congregation.1 Therefore", "this promise:1 First"
STRAY_MARK = re.compile(r"(?<=[a-z])\d+\b|(?<=[a-z][.:])\d+(?= [A-Z])")


def clean(text):
    text = re.sub(r"\s+", " ", text).strip()
    text = re.sub(r"—-\s*", "—", text)  # "his precious blood—-99 he has set us free"
    return re.sub(r"\s+([,.;:?!])", r"\1", text)


class Footnotes:
    """Removes the document's running footnote numbers, which only ever go up."""

    def __init__(self):
        self.last = 0

    def strip(self, text):
        def drop(m):
            n = int(m.group(1))
            if self.last < n <= self.last + 12:
                self.last = n
                return ""
            return m.group(0)
        return NUMBER.sub(drop, text)


def main(path):
    paragraphs = [(p.style.name, p.text.strip()) for p in docx.Document(path).paragraphs]
    notes = Footnotes()
    questions, current = [], None
    for style, text in paragraphs:
        if not text:
            continue
        m = QUESTION.match(text)
        # Three questions (25, 47, 64) are styled as body text; their number still marks them
        if m and (style == "Heading 2" or (current and int(m.group(1)) == current["n"] + 1)):
            n = int(m.group(1))
            current = {"n": n, "q": clean(notes.strip(m.group(2))), "a": [], "proofs": []}
            if n in FULL_QUESTIONS:
                current["q"] = FULL_QUESTIONS[n]
            questions.append(current)
        elif current is None:
            continue  # the title
        elif style == "List Paragraph":
            text = PROOF_FIXES.get(text, text)
            current["proofs"] += [clean(r) for r in text.split(";") if r.strip()]
        else:
            current["a"].append(clean(STRAY_MARK.sub("", notes.strip(text))))

    numbers = [q["n"] for q in questions]
    if numbers != list(range(1, EXPECTED + 1)):
        sys.exit(f"Expected questions 1-{EXPECTED}, got {len(numbers)}: {numbers}")
    for q in questions:
        q["a"] = "\n\n".join(q["a"])
        # "2 Tim. 2:2; 3:13-17", "Ps. 55:22; 62": a bare chapter is in the book before it
        for i in range(1, len(q["proofs"])):
            book = re.match(r"^((?:[1-3]\s?)?[A-Za-z][A-Za-z. ]*?)\s*\d", q["proofs"][i - 1])
            if book and re.match(r"^\d+(:\d|$)", q["proofs"][i]):
                q["proofs"][i] = f"{book.group(1)} {q['proofs'][i]}"
    OUT.write_text(json.dumps({
        "title": "An Orthodox Catechism",
        "year": "1680",
        "source": "Hercules Collins",
        "questions": questions,
    }, ensure_ascii=False), encoding="utf-8")
    print(f"wrote {OUT} ({len(questions)} questions)")


main(sys.argv[1])
