import re, subprocess

REPO = '.'
REFS = [
    'HEAD',
    'origin/staging-fixes-2026-07-08',
    'origin/wip/preserve-rh-inspiration-board-2026-04-19',
    'origin/master',
]
FFFD = chr(0xFFFD)
WINDOWS = [80, 50, 30, 18, 10]

def git_show(ref):
    out = subprocess.run(['git', 'show', ref + ':platform/index.html'], capture_output=True, cwd=REPO)
    if out.returncode != 0:
        return None
    return out.stdout.decode('utf-8')

ref_texts = {}
for r in REFS:
    ref_texts[r] = git_show(r)

with open('platform/index.html', 'rb') as f:
    cur = f.read().decode('utf-8')

# Work on the whole text, find every FFFD occurrence (with its absolute index), and
# try to resolve it independently using a shrinking context window.
positions = [m.start() for m in re.finditer(re.escape(FFFD), cur)]
print('Total FFFD occurrences:', len(positions))

resolved = {}   # position -> (char, ref, window_used)
unresolved = []

for pos in positions:
    got = None
    for w in WINDOWS:
        left = cur[max(0, pos - w):pos]
        right = cur[pos + 1:pos + 1 + w]
        pattern = re.escape(left) + '(.)' + re.escape(right)
        try:
            rx = re.compile(pattern)
        except re.error:
            continue
        candidates = {}
        for r in REFS:
            t = ref_texts.get(r)
            if not t:
                continue
            matches = list(rx.finditer(t))
            uniq_chars = set(m.group(1) for m in matches)
            if len(matches) >= 1:
                candidates[r] = (matches, uniq_chars)
        # accept first ref (priority order) that has a match, and where all matches agree on the same char
        for r in REFS:
            if r in candidates:
                matches, uniq_chars = candidates[r]
                if len(uniq_chars) == 1:
                    got = (next(iter(uniq_chars)), r, w, len(matches))
                    break
        if got:
            break
    if got:
        resolved[pos] = got
    else:
        unresolved.append(pos)

print('RESOLVED:', len(resolved))
print('UNRESOLVED:', len(unresolved))
print()
print('--- resolved detail ---')
for pos, (ch, ref, w, nmatches) in resolved.items():
    left = cur[max(0, pos-25):pos]
    right = cur[pos+1:pos+26]
    print(f'pos={pos} ref={ref} window={w} nmatches={nmatches} char={ch!r} (U+{ord(ch):04X})')
    print('  context:', repr(left + '[FFFD]' + right))

print()
print('--- UNRESOLVED context (for manual review) ---')
for pos in unresolved:
    left = cur[max(0, pos-40):pos]
    right = cur[pos+1:pos+41]
    print(f'pos={pos}')
    print('  context:', repr(left + '[FFFD]' + right))

# Build fixed text
chars = list(cur)
for pos, (ch, ref, w, n) in resolved.items():
    chars[pos] = ch
new_text = ''.join(chars)
print()
print('Remaining FFFD in candidate:', new_text.count(FFFD))

with open('platform/index.html.RESTORED-CANDIDATE.html', 'w', encoding='utf-8', newline='') as f:
    f.write(new_text)
print('wrote candidate file, len=', len(new_text))
