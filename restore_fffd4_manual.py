import re

FFFD = chr(0xFFFD)
EM = '—'   # —
EN = '–'   # –
MID = '·'  # ·
ELL = '…'  # …
LDQ = '“'  # "
RDQ = '”'  # "

with open('platform/index.html.RESTORED-CANDIDATE.html', 'r', encoding='utf-8', newline='') as f:
    text = f.read()

# manual, reasoned fixes for positions that had no clean-git-history match
# (this file is being edited in place as we go, so we resolve by unique
#  surrounding-context regex, not raw numeric offsets, since earlier passes
#  shift nothing -- length-preserving 1-for-1 char swaps -- but we match by
#  content to be safe/self-documenting)

fixes = [
    # (unique_context_regex, replacement_char, note)
    (r'ASCII-only name avoids mojibake \(e\.g\. ' + FFFD + '"' + FFFD + r'\)',
     None, 'SKIP-comment-example-ambiguous'),  # handled specially below
    (r'perfectly together' + FFFD + r'\. 7\.5\? x 7\.5', RDQ, 'closing curly quote after "together"'),
    (r'nameId=' + FFFD + r'\)"', ELL, 'ellipsis placeholder before closing paren, matches convention'),
    (r'still hits "' + FFFD + r'Black Soapstone"', LDQ, 'opening curly quote before Black Soapstone'),
    (r'On doc ' + FFFD + r"' \+ onDocN", EM, 'em dash separator before doc number (x2 occurrences)'),
    (r"' \+ ' projects" + FFFD + r"'", ELL, 'ellipsis, matches "Loading…" convention'),
    (r'title\.split\(/\\s\[-' + FFFD + r'\]\\s/\)', EN, 'en dash in title-split char class, matches sibling regexes'),
    (r'must not override the collection path ' + FFFD, EM, 'trailing em dash continuing comment to next line'),
    (r'font-weight:600;">' + FFFD + r'</div>', EM, 'em dash empty-value placeholder, matches file convention'),
    (r'"\'\+tdStyle\+\'">' + FFFD + r'</td>\'\}', EM, 'em dash, matches 3 sibling cells on same line already resolved'),
    (r'Change status' + FFFD + r'</a>', ELL, 'ellipsis, opens a further dialog (menu item convention)'),
    (r'At receiver' + FFFD + r'</a>', ELL, 'ellipsis, opens a further dialog (menu item convention)'),
    (r'At workroom' + FFFD + r'</a>', ELL, 'ellipsis, opens a further dialog (menu item convention)'),
    (r"allLabel: '" + EM + r' All projects ' + FFFD + r"'", EM, 'em dash bracket, matches "— None —" convention'),
    (r"allLabel: '" + EM + r' All categories ' + FFFD + r"'", EM, 'em dash bracket, matches convention'),
    (r"allLabel: '" + EM + r' All statuses ' + FFFD + r"'", EM, 'em dash bracket, matches convention'),
    (r'Leave only ' + FFFD + r'All' + FFFD + r' selected', None, 'SKIP-double-handled-below'),
    (r'<option value="">' + FFFD + r' None ' + FFFD + r'</option>', None, 'SKIP-double-handled-below'),
    (r"var opts = '<option value=\"\">" + FFFD + r" None " + FFFD + r"</option>'", None, 'SKIP-double-handled-below'),
    (r'Prefer ' + FFFD + r'Remove from room' + FFFD + r' if you only want', None, 'SKIP-double-handled-below'),
    (r'you should see ' + FFFD + r'Trade cost saved' + FFFD + r'\)', None, 'SKIP-double-handled-below'),
    (r"var ph = '" + EM + r" Select vendor " + FFFD + r"'", EM, 'em dash closing bracket, matches "— X —" convention'),
]

applied = []
skipped = []

def apply_single(pattern, repl_char, note):
    global text
    matches = list(re.finditer(pattern, text))
    if len(matches) != 1:
        skipped.append((pattern, len(matches), note))
        return False
    m = matches[0]
    # find the FFFD position(s) inside this match and replace just that character
    start, end = m.span()
    segment = text[start:end]
    new_segment = segment.replace(FFFD, repl_char)
    text = text[:start] + new_segment + text[end:]
    applied.append((pattern, note, segment, new_segment))
    return True

for pattern, repl, note in fixes:
    if repl is None:
        continue
    apply_single(pattern, repl, note)

# double/triple FFFD special cases handled explicitly (order-sensitive, do exact literal replace once)
special = [
    ('<option value="">' + FFFD + ' None ' + FFFD + '</option></select>\' +',
     '<option value="">' + EM + ' None ' + EM + '</option></select>\' +',
     '"— None —" dropdown, both brackets em dash'),
    ("var opts = '<option value=\"\">" + FFFD + " None " + FFFD + "</option>';",
     "var opts = '<option value=\"\">" + EM + " None " + EM + "</option>';",
     '"— None —" dropdown, both brackets em dash'),
    ('Leave only ' + FFFD + 'All' + FFFD + ' selected',
     'Leave only ' + LDQ + 'All' + RDQ + ' selected',
     'curly-quoted "All" (emphasis on the literal option label)'),
    ('Prefer ' + FFFD + 'Remove from room' + FFFD + ' if you only want',
     'Prefer ' + LDQ + 'Remove from room' + RDQ + ' if you only want',
     'curly-quoted button-name reference'),
    ('you should see ' + FFFD + 'Trade cost saved' + FFFD + ')',
     'you should see ' + LDQ + 'Trade cost saved' + RDQ + ')',
     'curly-quoted status message reference'),
]
for old, new, note in special:
    c = text.count(old)
    if c == 1:
        text = text.replace(old, new, 1)
        applied.append(('(exact-literal)', note, old, new))
    else:
        skipped.append((old, c, note))

# the ambiguous meta-comment about mojibake itself -- lowest stakes (just a comment),
# best-guess: showing an em-dash example pair, flagged clearly as a guess
comment_old = 'ASCII-only name avoids mojibake (e.g. ' + FFFD + '"' + FFFD + ')'
comment_new = 'ASCII-only name avoids mojibake (e.g. ' + EM + '"' + EM + ')'
c = text.count(comment_old)
if c == 1:
    text = text.replace(comment_old, comment_new, 1)
    applied.append(('(exact-literal)', 'GUESS low-confidence: comment example text only, no functional impact', comment_old, comment_new))
else:
    skipped.append((comment_old, c, 'mojibake-comment-example'))

# handle the multi-dash regex character classes (trim/junk-detector helpers)
regex_fixes = [
    (r"out = out\.replace\(/\^\[\\s" + FFFD + r",;\.\\-" + FFFD + FFFD + r"\]\+\|\[\\s" + FFFD + r",;\.\\-" + FFFD + FFFD + r"\]\+\$/g, ''\)\.trim\(\);",
     "out = out.replace(/^[\\s" + EM + ",;.\\-" + EN + MID + "]+|[\\s" + EM + ",;.\\-" + EN + MID + "]+$/g, '').trim();",
     'trim helper: adds em-dash/en-dash/middle-dot to already-present \\s,;.- set, symmetric on both brackets'),
    (r"if \(/\^\[-" + FFFD + FFFD + r"_\.%\\s\]\+\$/i\.test\(raw\)\) return true;",
     "if (/^[-" + EN + EM + "_.%\\s]+$/i.test(raw)) return true;",
     'junk-detector: en-dash + em-dash added to hyphen/underscore/percent/space set'),
    (r"if \(/\^\[-" + FFFD + r"_\.\\s\]\+\$/i\.test\(s\)\) return false;",
     "if (/^[-" + EN + "_.\\s]+$/i.test(s)) return false;",
     'junk-detector: en-dash added to hyphen/underscore/space set'),
]
for pattern, new_literal, note in regex_fixes:
    matches = list(re.finditer(pattern, text))
    if len(matches) == 1:
        m = matches[0]
        text = text[:m.start()] + new_literal + text[m.end():]
        applied.append((pattern, note, m.group(0), new_literal))
    else:
        skipped.append((pattern, len(matches), note))

remaining = text.count(FFFD)
print('APPLIED:', len(applied))
print('SKIPPED (needs manual look):', len(skipped))
print('REMAINING FFFD:', remaining)
print()
print('--- applied detail ---')
for (pat, note, old, new) in applied:
    print('NOTE:', note)
    print('  OLD:', repr(old))
    print('  NEW:', repr(new))
print()
print('--- skipped detail (pattern matched != 1 time) ---')
for (pat, n, note) in skipped:
    print(f'matches={n} note={note}')
    print('  pattern:', pat)

if remaining:
    print()
    print('--- STILL REMAINING FFFD (context) ---')
    for m in re.finditer(re.escape(FFFD), text):
        pos = m.start()
        print(pos, repr(text[max(0,pos-40):pos] + '[FFFD]' + text[pos+1:pos+41]))

with open('platform/index.html.RESTORED-FINAL.html', 'w', encoding='utf-8', newline='') as f:
    f.write(text)
print()
print('wrote platform/index.html.RESTORED-FINAL.html, len=', len(text))
