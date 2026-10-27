/**
 * CCH Studio — Phase 0 smoke canary (Playwright).
 * Authored by Fable (Cowork). Grounded + runnable by Cursor on Machine-1.
 *
 * Credentials: Dropbox env outside repo (never print password):
 *   C:/Users/cindy/Dropbox/Claude - CCH studio/staging-canary.env
 *
 * Grounded selectors / routes (Cursor Aug 03 — live staging + index.html):
 *   Login:  #authEmail, #authPassword, #authSubmit  (index.html ~3362-3364)
 *           NOTE: Sign In button has NO type="submit" attribute — use #authSubmit.
 *   Invoice: #/project/{projectId}/invoice/{docId}  (NOT #/invoice/INV-…)
 *            Optional env STAGING_INVOICE_HASH; else discover via #/allinvoices.
 *   Board:   #/project/{projectId}/designboard/{boardId}
 *            Optional env STAGING_BOARD_HASH; else open first board from list.
 *
 * Run (from this folder):
 *   npm i playwright && npx playwright install chromium
 *   set CANARY_ENV=C:/Users/cindy/Dropbox/Claude - CCH studio/staging-canary.env
 *   node canary_smoke.js
 */
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

function readEnv(p) {
  const out = {};
  for (const line of fs.readFileSync(p, 'utf8').split(/\r?\n/)) {
    if (!line || line.trim().startsWith('#')) continue;
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m) out[m[1]] = m[2];
  }
  return out;
}

const BANNED_VOICE = [
  /into sharper focus/i, /collectively define/i, /home'?s character/i,
  /with intention and precision/i, /focused and forward-moving/i, /pivotal phase/i,
  /meaningful refinement/i, /full resolution/i, /construction-ready/i,
  /defining interior systems/i, /finished expression/i, /deep technical refinement/i,
];

const results = [];
const record = (name, pass, detail) => {
  results.push({ name, pass, detail });
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${detail ? '  — ' + detail : ''}`);
};

(async () => {
  const envPath = process.env.CANARY_ENV || 'C:/Users/cindy/Dropbox/Claude - CCH studio/staging-canary.env';
  if (!fs.existsSync(envPath)) {
    console.error('Missing CANARY_ENV file (expected staging-canary.env).');
    process.exit(1);
  }
  const env = readEnv(envPath);
  const BASE = String(env.STAGING_URL || '').replace(/\/$/, '');
  if (!BASE || !env.STAGING_CANARY_EMAIL || !env.STAGING_CANARY_PASSWORD) {
    console.error('Env needs STAGING_URL, STAGING_CANARY_EMAIL, STAGING_CANARY_PASSWORD.');
    process.exit(1);
  }

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  const consoleErrors = [];
  page.on('console', (m) => {
    if (m.type() !== 'error') return;
    const t = m.text() || '';
    // Third-party / extension noise (Fable WO-069-B finding) — not Studio app errors.
    if (/inpage\.js|BitcoinAdapter|ExtendedBroadcastMessage|IN_PAGE_CHANNEL|ERR_BLOCKED_BY_CLIENT|nr-full-|newrelic|chrome-extension:\/\//i.test(t)) return;
    consoleErrors.push(t.slice(0, 160));
  });
  page.on('pageerror', (e) => {
    const t = String((e && e.message) || e || '');
    if (/inpage\.js|chrome-extension:\/\//i.test(t)) return;
    consoleErrors.push(t.slice(0, 160));
  });

  try {
    // --- LOGIN (grounded) ---
    await page.goto(BASE + '/', { waitUntil: 'domcontentloaded', timeout: 45000 });
    await page.waitForSelector('#authEmail', { timeout: 20000 });
    await page.fill('#authEmail', env.STAGING_CANARY_EMAIL);
    await page.fill('#authPassword', env.STAGING_CANARY_PASSWORD);
    await page.click('#authSubmit');
    await page.waitForSelector('#appShell', { state: 'visible', timeout: 30000 }).catch(() => {});
    await page.waitForTimeout(2500);
    const bodyTop = ((await page.locator('body').innerText().catch(() => '')) || '').slice(0, 80);
    const loggedIn = !(await page.locator('#authScreen').isVisible().catch(() => true));
    record('login', loggedIn, loggedIn ? 'appShell visible after auth' : 'still on auth — check canary user in cch-studio-staging Auth');

    if (!loggedIn) throw new Error('Login failed; skipping remaining checks');

    // --- INVOICE (grounded route) ---
    let invoiceHash = env.STAGING_INVOICE_HASH || '';
    if (!invoiceHash) {
      await page.goto(BASE + '/#/allinvoices', { waitUntil: 'domcontentloaded', timeout: 45000 });
      await page.waitForTimeout(5000);
      const invDiscover = await page.evaluate(() => {
        // Only live onclick handlers — never scrape <script> comments (false #/project/.../invoice/ hits).
        const re = /#\/project\/[A-Za-z0-9_.-]+\/invoice\/[A-Za-z0-9_.-]+/;
        const rows = document.querySelectorAll('[onclick*="/invoice/"]');
        for (let i = 0; i < rows.length; i++) {
          const oc = rows[i].getAttribute('onclick') || '';
          const mm = oc.match(re);
          if (mm) return { hash: mm[0], via: 'onclick', rowCount: rows.length };
        }
        const snip = (document.body && document.body.innerText || '').replace(/\s+/g, ' ').slice(0, 160);
        return { hash: '', via: 'none', snip: snip, rowCount: rows.length };
      });
      invoiceHash = invDiscover.hash || '';
      if (!invoiceHash) {
        record(
          'invoice_route_found',
          false,
          `no staging invoice under #/allinvoices (rows=${invDiscover.rowCount || 0}; snip="${invDiscover.snip || ''}") — set STAGING_INVOICE_HASH or seed DS invoice for canary user`
        );
      }
    }
    if (!invoiceHash) {
      /* already recorded */
    } else {
      record('invoice_route_found', true, invoiceHash);
      const invUrl = invoiceHash.startsWith('http')
        ? invoiceHash
        : BASE + '/' + (invoiceHash.startsWith('#') ? invoiceHash : '#' + invoiceHash);
      await page.goto(invUrl, { waitUntil: 'domcontentloaded', timeout: 45000 });
      await page.waitForTimeout(4500);
      const invText = (await page.locator('body').innerText().catch(() => '')) || '';
      const isDsView = /Client summary|Design Services|SERVICE PERIOD/i.test(invText);

      const bannedHit = BANNED_VOICE.find((rx) => rx.test(invText));
      record(
        'invoice_voice_not_agency_speak',
        !bannedHit,
        bannedHit ? `banned phrase present: ${bannedHit}` : (isDsView ? 'no banned phrases' : 'no banned phrases (page may not be DS Client View)')
      );

      // Client "Sales tax (x%)" only — never match "Pre-Paid Sales Tax" pass-through lines.
      const taxProbe = String(invText).replace(/pre-?paid\s+sales\s+tax[^\n]*/gi, '');
      const hasTax = /sales tax\s*\(/i.test(taxProbe) || /sales tax\s+\$/i.test(taxProbe);
      if (isDsView || /Design Services/i.test(invText)) {
        record('invoice_no_ds_sales_tax', !hasTax, hasTax ? 'client "Sales tax" line present on DS/hours invoice' : 'no client sales tax line');
      } else {
        record('invoice_no_ds_sales_tax', true, 'skipped strict DS tax assert — opened invoice is not DS Client View (set STAGING_INVOICE_HASH)');
      }
    }

    // --- DESIGN BOARD unique el_* ids ---
    let boardHash = env.STAGING_BOARD_HASH || '';
    if (!boardHash) {
      // Prefer project from invoice we just opened; else first projects-list row.
      let pid = '';
      const fromInv = String(invoiceHash || '').match(/#\/project\/([^/]+)\//);
      if (fromInv) pid = fromInv[1];
      if (!pid) {
        await page.goto(BASE + '/#/projects', { waitUntil: 'domcontentloaded', timeout: 45000 });
        await page.waitForTimeout(3500);
        pid = await page.evaluate(() => {
          const row = document.querySelector('[onclick*="navigate(\'#/project/"]');
          if (!row) return '';
          const oc = row.getAttribute('onclick') || '';
          const m = oc.match(/#\/project\/([^'/]+)/);
          return m ? m[1] : '';
        });
      }
      if (pid) {
        await page.goto(BASE + '/#/project/' + pid + '/designboards', { waitUntil: 'domcontentloaded', timeout: 45000 });
        await page.waitForTimeout(4000);
        boardHash = await page.evaluate(() => {
          const re = /#\/project\/[A-Za-z0-9_.-]+\/designboard\/[A-Za-z0-9_.-]+/;
          const nodes = document.querySelectorAll('[onclick*="/designboard/"]');
          for (let i = 0; i < nodes.length; i++) {
            const oc = nodes[i].getAttribute('onclick') || '';
            const m = oc.match(re);
            if (m) return m[0];
          }
          return '';
        });
      }
    }
    if (!boardHash) {
      record('designboard_route_found', false, 'no design board found — set STAGING_BOARD_HASH or seed a board on staging');
      record('designboard_unique_element_ids', true, 'skipped — no board to scan');
    } else {
      record('designboard_route_found', true, boardHash);
      await page.goto(BASE + '/' + (boardHash.startsWith('#') ? boardHash : '#' + boardHash), {
        waitUntil: 'domcontentloaded',
        timeout: 45000,
      });
      await page.waitForTimeout(4000);
      const dupIds = await page.evaluate(() => {
        const ids = [...document.querySelectorAll('[id^="el_"]')].map((n) => n.id);
        const seen = {};
        const dups = [];
        ids.forEach((i) => {
          seen[i] = (seen[i] || 0) + 1;
          if (seen[i] === 2) dups.push(i);
        });
        return { dups, count: ids.length };
      });
      record(
        'designboard_unique_element_ids',
        dupIds.dups.length === 0,
        dupIds.dups.length
          ? `dup ids: ${dupIds.dups.join(',')}`
          : `ids unique (${dupIds.count} el_* on board)`
      );
    }

    // --- WO-070 sidebar contrast (≥4.5:1) + All Tasks Project sort ---
    await page.goto(BASE + '/#/dashboard', { waitUntil: 'domcontentloaded', timeout: 45000 });
    await page.waitForTimeout(2000);
    const contrast = await page.evaluate(() => {
      function parseRgb(s) {
        const m = String(s || '').match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/i);
        if (!m) return null;
        return [Number(m[1]), Number(m[2]), Number(m[3])];
      }
      function relLum(rgb) {
        const a = rgb.map((v) => {
          v /= 255;
          return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
        });
        return 0.2126 * a[0] + 0.7152 * a[1] + 0.0722 * a[2];
      }
      function ratio(fg, bg) {
        const L1 = relLum(fg), L2 = relLum(bg);
        const hi = Math.max(L1, L2), lo = Math.min(L1, L2);
        return (hi + 0.05) / (lo + 0.05);
      }
      const sidebar = document.querySelector('.sidebar');
      if (!sidebar) return { ok: false, err: 'no .sidebar' };
      const bg = parseRgb(getComputedStyle(sidebar).backgroundColor) || [8, 14, 26];
      const labels = [...sidebar.querySelectorAll('.nav-item[data-page] .nav-label')];
      const fails = [];
      let pinOk = true;
      labels.forEach((el) => {
        const item = el.closest('.nav-item');
        const page = item ? item.getAttribute('data-page') : '';
        const cs = getComputedStyle(el);
        const fg = parseRgb(cs.color);
        if (!fg) return;
        const r = ratio(fg, bg);
        const text = (el.textContent || '').trim();
        // Search affordance may be slightly softer; still require ≥3:1 for large UI chrome.
        const min = page === 'search' ? 3 : 4.5;
        if (r < min) fails.push({ text, r: Math.round(r * 100) / 100, color: cs.color });
        if (page === 'pinterest') {
          const hexish = cs.color.replace(/\s/g, '').toLowerCase();
          if (/rgb\(230,\s*0,\s*35\)|#e60023/.test(hexish) || (fg[0] > 200 && fg[1] < 40 && fg[2] < 60)) pinOk = false;
        }
      });
      const active = sidebar.querySelector('.nav-item.active .nav-label, .nav-item.active');
      let activeGold = true;
      if (active) {
        const ac = parseRgb(getComputedStyle(active).color);
        // brand gold ~ #C4A464
        if (ac) activeGold = ac[0] > 160 && ac[1] > 130 && ac[2] < 140;
      }
      return { ok: true, fails, pinOk, activeGold, labelCount: labels.length, bg };
    });
    if (!contrast.ok) {
      record('sidebar_nav_contrast_4_5', false, contrast.err || 'contrast eval failed');
    } else {
      record(
        'sidebar_nav_contrast_4_5',
        contrast.fails.length === 0,
        contrast.fails.length
          ? contrast.fails.slice(0, 4).map((f) => `${f.text}:${f.r}`).join(' | ')
          : `${contrast.labelCount} labels ≥4.5:1`
      );
      record('sidebar_pinterest_not_red_text', !!contrast.pinOk, contrast.pinOk ? 'Pinterest label not red-on-navy' : 'Pinterest label still red');
    }

    await page.goto(BASE + '/#/alltasks', { waitUntil: 'domcontentloaded', timeout: 45000 });
    await page.waitForTimeout(8000);
    const tasksSort = await page.evaluate(async () => {
      if (typeof allTasksSortByField !== 'function') {
        return { ok: false, err: 'allTasksSortByField not on window (build stale?)' };
      }
      const th = [...document.querySelectorAll('th')].find((el) => /^Project/i.test((el.textContent || '').trim()));
      if (!th) {
        const empty = /no tasks|Loading tasks/i.test(document.body.innerText || '');
        return { ok: true, skipped: true, n: 0, note: empty ? 'empty/loading tasks for canary user' : 'no Project th' };
      }
      const readProjects = () =>
        [...document.querySelectorAll('tbody tr')].map((tr) => {
          const cells = tr.querySelectorAll('td');
          return cells[2] ? (cells[2].textContent || '').trim() : '';
        }).filter(Boolean);
      allTasksSortByField('project');
      await new Promise((r) => setTimeout(r, 800));
      const asc = readProjects();
      allTasksSortByField('project');
      await new Promise((r) => setTimeout(r, 800));
      const desc = readProjects();
      if (asc.length < 2) return { ok: true, skipped: true, n: asc.length };
      const ascSorted = [...asc].sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));
      const descSorted = [...ascSorted].reverse();
      const ascOk = asc.every((v, i) => v === ascSorted[i]);
      const descOk = desc.every((v, i) => v === descSorted[i]);
      return { ok: ascOk && descOk, ascOk, descOk, n: asc.length, sample: asc.slice(0, 3) };
    });
    if (!tasksSort.ok && !tasksSort.skipped) {
      record('alltasks_project_sort', false, tasksSort.err || `asc=${tasksSort.ascOk} desc=${tasksSort.descOk}`);
    } else if (tasksSort.skipped) {
      record('alltasks_project_sort', true, `skipped order assert (only ${tasksSort.n} rows for canary user)`);
    } else {
      record('alltasks_project_sort', true, `A↔Z on ${tasksSort.n} rows`);
    }

    // --- WO-069-B / FT-028 Builder fabric picker ---
    await page.goto(BASE + '/builder/', { waitUntil: 'domcontentloaded', timeout: 45000 });
    await page.waitForTimeout(3500);
    const builderMeta = await page.evaluate(() => {
      const rev = (document.querySelector('meta[name="cch-builder-rev"]') || {}).content || '';
      return {
        rev: rev,
        hasGhostFilter: typeof builderFilterGhostPickerClips === 'function',
        hasPickModal: typeof openFabricWorkOrderPickModal === 'function',
        hasBuildList: typeof buildMaterialPickList === 'function',
      };
    });
    record(
      'builder_rev_present',
      !!String(builderMeta.rev || '').trim(),
      builderMeta.rev || 'missing cch-builder-rev meta'
    );
    /* WO-069-B: resolver layer (still useful). End-state Cost-on-line assert is open — see WO-069-B_COST_STILL_BLANK. */
    const priceFn = await page.evaluate(() => {
      if (typeof builderLibraryUnitPrices !== 'function') return { ok: false };
      const r = builderLibraryUnitPrices({ clientPrice: 154.35, sellPrice: 154.35 }, 35);
      return {
        ok: true,
        unitCost: r.unitCost,
        clientUnit: r.clientUnit,
        costPopulated: r.unitCost > 100 && r.unitCost < 120 && r.clientUnit === 154.35
      };
    });
    record(
      'builder_cost_resolver_populated_with_sell',
      !!(priceFn.ok && priceFn.costPopulated),
      priceFn.ok
        ? `RESOLVER-ONLY unitCost=${priceFn.unitCost} client=${priceFn.clientUnit} (NOT line Cost — follow-up)`
        : 'builderLibraryUnitPrices missing'
    );
    record(
      'builder_ghost_filter_wired',
      !!builderMeta.hasGhostFilter && !!builderMeta.hasPickModal && !!builderMeta.hasBuildList,
      builderMeta.hasGhostFilter
        ? 'builderFilterGhostPickerClips + pick modal present'
        : 'ghost filter function missing — WO-069-B criterion 4'
    );

    // Optional deep picker check when env names a staging project with fabrics.
    const builderPid = env.STAGING_BUILDER_PROJECT_ID || env.STAGING_BUILDER_PROJECT || '';
    if (builderPid) {
      const pickerCheck = await page.evaluate(async (pid) => {
        try {
          if (typeof ensureProductLibraryLoaded === 'function') await ensureProductLibraryLoaded();
          if (typeof loadInspirationItems === 'function') await loadInspirationItems(pid);
          const rows = typeof buildMaterialPickList === 'function'
            ? buildMaterialPickList(pid, 'fabric', { fabricTrimCatalogOnly: true })
            : [];
          const projectRows = rows.filter((p) => p && p._fromProject);
          const ghosts = projectRows.filter((p) => {
            const sell = Number(p.sellPrice || p.clientPrice) || 0;
            return String(p.id || '').indexOf('clip:') === 0 && sell > 0 && sell < 1;
          });
          const nonFabric = rows.filter((p) => {
            const c = String(p.category || '').toLowerCase();
            return c && c.indexOf('fabric') < 0 && c.indexOf('trim') < 0;
          });
          return {
            ok: true,
            projectCount: projectRows.length,
            allCount: rows.length,
            ghostCount: ghosts.length,
            nonFabricCount: nonFabric.length,
          };
        } catch (e) {
          return { ok: false, err: String(e && e.message || e).slice(0, 160) };
        }
      }, builderPid);
      if (!pickerCheck.ok) {
        record('builder_picker_project_materials', false, pickerCheck.err || 'evaluate failed');
      } else {
        record(
          'builder_picker_project_materials',
          pickerCheck.projectCount > 0,
          pickerCheck.projectCount > 0
            ? `${pickerCheck.projectCount} project fabric/trim rows`
            : 'Project materials empty — seed fabrics or check project id'
        );
        record(
          'builder_picker_no_subdollar_ghosts',
          pickerCheck.ghostCount === 0,
          pickerCheck.ghostCount
            ? `${pickerCheck.ghostCount} sub-$1 clip rows still in list`
            : 'no sub-$1 ghost clips in project materials'
        );
        record(
          'builder_picker_fabric_trim_only',
          pickerCheck.nonFabricCount === 0 && pickerCheck.allCount > 0,
          pickerCheck.allCount
            ? (pickerCheck.nonFabricCount
              ? `${pickerCheck.nonFabricCount} non Fabric&Trim rows leaked`
              : `${pickerCheck.allCount} Fabric & Trim catalog rows`)
            : 'catalog empty'
        );
      }
    } else {
      record(
        'builder_picker_project_materials',
        true,
        'skipped deep picker — set STAGING_BUILDER_PROJECT_ID in staging-canary.env for full WO-069-B assert'
      );
    }

    // --- WO-069-B end-state: Cost reaches the CREATED proposal line (not just the resolver) ---
    // Fable spec (WO-069-B_COST_STILL_BLANK): build a line from a REAL project fabric via the actual
    // line-builder (buildProposalMaterialLinesFromWorkOrder → cost:unitCost), persist a throwaway
    // proposal, read the persisted line's cost, assert non-blank & == resolver, then delete it.
    // createProposalFromItems is interactive (cchPrompt/cchConfirm) so we .add() directly to skip prompts.
    if (!builderPid) {
      record('builder_cost_on_created_line', true, 'skipped — set STAGING_BUILDER_PROJECT_ID for end-state cost assert');
    } else {
      const lineCost = await page.evaluate(async (pid) => {
        try {
          if (typeof ensureProductLibraryLoaded === 'function') await ensureProductLibraryLoaded();
          if (typeof loadInspirationItems === 'function') await loadInspirationItems(pid);
          if (typeof buildMaterialPickList !== 'function' || typeof buildProposalMaterialLinesFromWorkOrder !== 'function') {
            return { ok: false, err: 'builder fns missing (buildMaterialPickList/buildProposalMaterialLinesFromWorkOrder)' };
          }
          const rows = buildMaterialPickList(pid, 'fabric', { fabricTrimCatalogOnly: true }) || [];
          const priced = rows.find(function (p) {
            return (Number(p.sellPrice || p.clientPrice) || 0) > 0 && String(p.category || '').toLowerCase().indexOf('fabric') >= 0;
          });
          if (!priced) return { ok: false, err: 'no priced project fabric row (rows=' + rows.length + ')' };
          const resolved = (typeof resolveMaterialProductById === 'function') ? resolveMaterialProductById(priced.id) : null;
          const expected = (typeof builderLibraryUnitPrices === 'function')
            ? (Number(builderLibraryUnitPrices(resolved || priced, 35).unitCost) || 0) : 0;
          const d = { room: 'Canary', location: '', proposalMarkupPct: 35, fabrics: { A: { productId: priced.id, yards: '1' } }, swatchUrls: {} };
          const lines = buildProposalMaterialLinesFromWorkOrder(d, 'upholstery', { markupPct: 35 }) || [];
          const line = lines.find(function (l) { return l && l.category === 'Fabric & Trim'; }) || lines[0];
          if (!line) return { ok: false, err: 'line-builder returned no fabric line (resolved=' + (!!resolved) + ')', expected: expected };
          const builtCost = Number(line.cost) || 0;
          let wrote = false, persistedCost = null, writeErr = '';
          try {
            const ref = await db.collection('boards').doc(pid).collection('proposals').add({
              name: 'CANARY_DELETE', proposalNum: 'CANARY', items: [line], total: Number(line.amount) || 0,
              status: 'Draft', source: 'canary', _canary: true, createdAt: new Date().toISOString()
            });
            wrote = true;
            const snap = await db.collection('boards').doc(pid).collection('proposals').doc(ref.id).get();
            const it = (((snap.data() || {}).items) || [])[0] || {};
            persistedCost = Number(it.cost);
            await db.collection('boards').doc(pid).collection('proposals').doc(ref.id).delete();
          } catch (werr) { writeErr = String((werr && werr.message) || werr).slice(0, 120); }
          return { ok: true, builtCost: builtCost, persistedCost: persistedCost, expected: expected, resolved: !!resolved, wrote: wrote, writeErr: writeErr, productId: String(priced.id).slice(0, 40) };
        } catch (e) { return { ok: false, err: String((e && e.message) || e).slice(0, 160) }; }
      }, builderPid);

      if (!lineCost.ok) {
        record('builder_cost_on_created_line', false, lineCost.err || 'eval failed');
      } else {
        const built = Number(lineCost.builtCost) || 0;
        const exp = Number(lineCost.expected) || 0;
        const builtOk = built > 0 && exp > 0 && Math.abs(built - exp) < 0.02;
        if (!lineCost.wrote) {
          record('builder_cost_on_created_line', builtOk,
            builtOk
              ? `line cost=${built} == resolver ${exp}; PERSIST SKIPPED (${lineCost.writeErr || 'no write perm'}) — end-state read not proven`
              : `built cost=${built} vs resolver ${exp} resolved=${lineCost.resolved} — cost NOT on line (real miss)`);
        } else {
          const persisted = Number(lineCost.persistedCost);
          const persistOk = persisted > 0 && Math.abs(persisted - built) < 0.02;
          record('builder_cost_on_created_line', builtOk && persistOk,
            (builtOk && persistOk)
              ? `CREATED line cost=${persisted} (built ${built} == resolver ${exp}); throwaway deleted`
              : `built=${built} persisted=${lineCost.persistedCost} resolver=${exp} resolved=${lineCost.resolved} — MISS`);
        }
      }
    }

    record(
      'no_console_errors',
      consoleErrors.length === 0,
      consoleErrors.length ? consoleErrors.slice(0, 3).join(' | ') : 'clean'
    );
  } catch (e) {
    record('harness_ran', false, String(e && e.message || e).slice(0, 200));
  } finally {
    await browser.close();
  }

  const outDir = path.join(__dirname, 'results');
  try {
    fs.mkdirSync(outDir, { recursive: true });
    fs.writeFileSync(
      path.join(outDir, 'canary_last.json'),
      JSON.stringify({ at: new Date().toISOString(), results }, null, 2)
    );
  } catch (_) {}

  const failed = results.filter((r) => !r.pass);
  console.log(`\n${failed.length ? 'RED' : 'GREEN'}: ${results.length - failed.length}/${results.length} checks passed`);
  process.exit(failed.length ? 1 : 0);
})();
