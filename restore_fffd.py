import re, subprocess, sys

REPO = '.'
REFS = [
    'HEAD',
    'origin/staging-fixes-2026-07-08',
    'origin/wip/preserve-rh-inspiration-board-2026-04-19',
    'origin/master',
]
FFFD = chr(0xFFFD)

def git_show(ref):
    out = subprocess.run(['git', 'show', ref + ':platform/index.html'], capture_output=True, cwd=REPO)
    if out.returncode != 0:
        return None
    try:
        return out.stdout.decode('utf-8')
    except UnicodeDecodeError:
        return out.stdout.decode('utf-8', errors='replace')

ref_texts = {}
for r in REFS:
    t = git_show(r)
    ref_texts[r] = t
    print('REF', r, 'len=', (len(t) if t is not None else None), 'fffd=', (t.count(FFFD) if t else None))

with open('platform/index.html', 'rb') as f:
    cur_bytes = f.read()
cur = cur_bytes.decode('utf-8')
lines = cur.splitlines(keepends=True)
fixed_lines = list(lines)

resolved = []
ambiguous = []
unresolved = []

for i, line in enumerate(lines):
    if FFFD not in line:
        continue
    parts = line.split(FFFD)
    pattern = '(.)'.join(re.escape(p) for p in parts)
    try:
        rx = re.compile(pattern)
    except re.error as e:
        unresolved.append((i + 1, 'REGEX_ERROR:' + str(e), line))
        continue

    chosen = None
    chosen_ref = None
    for r in REFS:
        t = ref_texts.get(r)
        if not t:
            continue
        matches = list(rx.finditer(t))
        if len(matches) == 1:
            chosen = matches[0]
            chosen_ref = r
            break
        elif len(matches) > 1:
            # keep looking at other refs, but remember ambiguity in case nothing resolves
            continue

    if chosen:
        groups = chosen.groups()
        new_line_parts = []
        for idx, p in enumerate(parts):
            new_line_parts.append(p)
            if idx < len(groups):
                new_line_parts.append(groups[idx])
        new_line = ''.join(new_line_parts)
        fixed_lines[i] = new_line
        resolved.append((i + 1, chosen_ref, line, new_line))
    else:
        # check ambiguous vs zero across all refs for reporting
        any_match_counts = {}
        for r in REFS:
            t = ref_texts.get(r)
            if not t:
                continue
            any_match_counts[r] = len(rx.findall(t))
        unresolved.append((i + 1, any_match_counts, line))

print()
print('RESOLVED:', len(resolved))
print('UNRESOLVED:', len(unresolved))
print()
print('--- sample resolved (first 15) ---')
for (ln, ref, old, new) in resolved[:15]:
    print(ln, ref)
    print('  OLD:', repr(old.strip()))
    print('  NEW:', repr(new.strip()))

print()
print('--- ALL unresolved ---')
for (ln, info, old) in unresolved:
    print(ln, info)
    print('  LINE:', repr(old.strip()))

new_text = ''.join(fixed_lines)
remaining = new_text.count(FFFD)
print()
print('REMAINING FFFD after candidate fix:', remaining)

with open('platform/index.html.RESTORED-CANDIDATE.html', 'w', encoding='utf-8', newline='') as f:
    f.write(new_text)
print('Wrote platform/index.html.RESTORED-CANDIDATE.html')

# byte-size sanity
import os
print('candidate size:', os.path.getsize('platform/index.html.RESTORED-CANDIDATE.html'))
print('current size:', os.path.getsize('platform/index.html'))
