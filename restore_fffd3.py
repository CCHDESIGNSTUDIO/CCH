import re, subprocess

REPO = '.'
REFS = [
    'HEAD',
    'origin/staging-fixes-2026-07-08',
    'origin/wip/preserve-rh-inspiration-board-2026-04-19',
    'origin/master',
]
FFFD = chr(0xFFFD)
WINDOWS = [100, 60, 40, 25, 15, 8]

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

def try_resolve_all(text):
    positions = [m.start() for m in re.finditer(re.escape(FFFD), text)]
    resolved = {}
    unresolved = []
    for pos in positions:
        got = None
        for w in WINDOWS:
            left = text[max(0, pos - w):pos]
            right = text[pos + 1:pos + 1 + w]
            if FFFD in left or FFFD in right:
                continue  # skip windows still containing other unresolved FFFDs this pass
            pattern = re.escape(left) + '(.)' + re.escape(right)
            try:
                rx = re.compile(pattern)
            except re.error:
                continue
            for r in REFS:
                t = ref_texts.get(r)
                if not t:
                    continue
                matches = list(rx.finditer(t))
                uniq = set(m.group(1) for m in matches)
                if len(matches) >= 1 and len(uniq) == 1:
                    got = (next(iter(uniq)), r, w, len(matches))
                    break
            if got:
                break
        if got:
            resolved[pos] = got
        else:
            unresolved.append(pos)
    return resolved, unresolved

text = cur
total_resolved = {}
for iteration in range(5):
    resolved, unresolved = try_resolve_all(text)
    if not resolved:
        print(f'--- iteration {iteration}: no new progress, stopping ---')
        break
    print(f'--- iteration {iteration}: resolved {len(resolved)}, still unresolved {len(unresolved)} ---')
    chars = list(text)
    for pos, (ch, ref, w, n) in resolved.items():
        chars[pos] = ch
        total_resolved[pos] = (ch, ref, w, n)
    text = ''.join(chars)
    if not unresolved:
        break

remaining = text.count(FFFD)
print()
print('FINAL remaining FFFD:', remaining)
print('TOTAL resolved across passes:', len(total_resolved))

# show remaining unresolved contexts
if remaining:
    print()
    print('--- remaining unresolved contexts ---')
    for m in re.finditer(re.escape(FFFD), text):
        pos = m.start()
        left = text[max(0, pos-45):pos]
        right = text[pos+1:pos+46]
        print(f'pos={pos}')
        print('  context:', repr(left + '[FFFD]' + right))

with open('platform/index.html.RESTORED-CANDIDATE.html', 'w', encoding='utf-8', newline='') as f:
    f.write(text)
print()
print('wrote candidate, len=', len(text))

# quick summary of which chars were used, counts
from collections import Counter
cnt = Counter(ch for (ch, ref, w, n) in total_resolved.values())
print('char distribution:', cnt)
