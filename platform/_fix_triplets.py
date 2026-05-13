"""Replace 3-char mojibake triplets (â + wrong continuation) with correct geometric symbols."""
from pathlib import Path
import re

# Discovered from file: wrong triple -> intended symbol (single codepoint)
# UTF-8 bytes of intended char must match what broke when mis-decoded
MANUAL = {
    "\u00e2\u2014\u02c6": "\u25c8",  # ◈ (Dashboard, Proposals, PO - diamond)
    "\u00e2\u2014\u2021": "\u25c7",  # ◇ (Inspiration, Library, etc.)
    "\u00e2\u2014\u00bb": "\u25fb",  # ◻ (Projects - white medium square)
}

def main():
    p = Path("index.html")
    text = p.read_text(encoding="utf-8")
    orig = text
    for bad, good in MANUAL.items():
        text = text.replace(bad, good)
    # â‹® → ⋮ vertical ellipsis (kebab) — bytes E2 8B AE for U+22EE
    text = text.replace("\u00e2\u2039\u00ae", "\u22ee")  # verify below

    if text != orig:
        p.write_text(text, encoding="utf-8")
        print("Updated", len(orig) - len(text), "chars delta")
    else:
        print("No triplet replaces")


if __name__ == "__main__":
    main()
