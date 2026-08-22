# WO-114 · Client portal iPad / mobile-first experience

**Change ID:** pending #1 assign · **State:** OPEN · **Executor:** Cursor · **Verifier:** Fable / Cindy on real iPad  
**File:** `platform/client.html` (+ `cch-progress-updates.js`, `cch-invoice-redesign.js`, `cch-client-pepper.js` as needed)  
**Staging first; prod on Cindy GO.**

## Why (Cindy Aug 17)

Most CCH clients review proposals, inspiration, and updates on **iPad** (and phone), not desktop. Houzz competes on mobile app; our client portal is web-only today. It must feel intentional on tablet — not a shrunk desktop layout.

**Out of scope for this WO:** native App Store app, staff Studio mobile, construction field tools.

## Grounding today (`client.html`)

- Viewport meta + `apple-mobile-web-app-capable` present
- Breakpoints: 768px (sidebar → 60px icon rail), 1024px (overview grid stack)
- Proposal table: horizontal scroll wrapper exists but line items still dense on tablet
- Bi-weekly updates: responsive at 720px / 960px (`cch-progress-updates.js`)
- Inspiration: 2-col grid ≤900px, 1-col ≤520px
- **Gap:** no iPad-first QA matrix; portrait iPad (~768–834px) hits phone sidebar collapse; no client PWA manifest / home-screen icon; touch targets not audited; invoice Client View + PDF flows untested on Safari iOS

## Target devices (verify on real hardware)

| Device | Priority |
|--------|----------|
| iPad Safari (portrait + landscape) | **P0** |
| iPhone Safari | P1 |
| iPad “Add to Home Screen” (standalone) | P1 |

## Change (phased)

### Phase A — iPad portrait polish (minimum shippable)

1. **Sidebar / nav:** On tablet portrait, prefer **bottom tab bar or full-width hamburger** over 60px icon-only rail (labels must stay readable for non-technical clients).
2. **Proposals + invoices:** Client View layout — larger product images, readable 14px+ body, no horizontal scroll on iPad portrait for typical 8–15 line proposals.
3. **Inspiration + Room Boards:** Touch-friendly star/comment buttons (min 44px hit targets); lightbox full-bleed on tablet.
4. **Bi-weekly Updates:** Gift-card layout already responsive — verify cover image + typography on iPad; fix any overflow.
5. **Decisions + Documents:** Approve/Request Changes buttons thumb-reachable; PDF preview usable without pinch-only reading.

### Phase B — phone + home screen

6. **Client web manifest** — name, icons, theme color navy/gold, `start_url` for project link pattern.
7. **Safe-area insets** — notch/home indicator padding (`env(safe-area-inset-*)`).
8. **Phone:** single-column home, sticky “back to project” on deep links.

### Phase C — parity checklist (not new features)

9. Document **client-safe pages** that must work on iPad: Home, Inspiration, Proposals, Invoices, Decisions, Updates, Documents, Notes (if published), Client Pepper.
10. Screenshot QA set in `loop/verify/WO-114/` — one iPad portrait per page.

## Agent deliverables lane (related, separate WO)

Studio does **not** need in-app takeoffs. Claude/Cursor produce:

- Room books, category books, tile packets (RH jobsite docs brief)
- Spec book PDFs / E-Spec exports
- Takeoff spreadsheets from plan uploads (agent workflow)
- Houzz-parity *documents* without Houzz-parity *software*

Link deliverables in portal **Documents** tab; client opens PDF on iPad.

## Acceptance (binary)

1. Cindy opens staging portal on **iPad Safari** (Rolling Hills or test project) — proposal Client View readable without zooming.
2. Inspiration star + comment usable with finger; no mis-taps.
3. Bi-weekly update landscape page scrolls cleanly; no clipped gold headers.
4. No horizontal page scroll on iPad portrait on Home + Proposals + Updates.
5. Optional: Add to Home Screen shows CCH icon and opens without browser chrome.

## Verify

Real iPad + iPhone; Safari + one “Add to Home Screen” pass. Screenshots to `loop/verify/WO-114/`.

## Related open WOs

| WO | Relationship |
|----|----------------|
| WO-037 | Magazine-style update list cards — pairs with Phase A Updates |
| WO-047 | Build-from-project updates — content must look good on iPad once live |
| WO-021/028 | Progress updates editor — client view is the iPad surface |
| WO-101 | Staff Pepper PWA — separate from client portal |

## DONE note

`loop/WO-114_DONE_CR_[date].md` + `_DEPLOY_QUEUE.md` staging line.
