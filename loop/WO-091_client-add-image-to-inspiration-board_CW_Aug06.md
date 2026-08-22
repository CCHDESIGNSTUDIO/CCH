# WO-091 · Let a client add an image to their inspiration boards (portal) · CW Aug 06
**Change ID:** pending #1 · **Lane:** Client portal + Inspiration hub (CLIENT-FACING) · **State:** OPEN · **Executor:** Cursor (client portal file is small; the studio-side landing reuses existing inspiration/clip plumbing — if that one write reaches into the 5MB index.html and OOMs, hand just that piece to Code) · **Verifier:** Fable · **Gate:** Cindy GO for prod
**File:** the client portal app (`platform/client.html` / `platform/cch-client-board.js`) for the client-facing add UI; the inspiration/clip store + notify path on the studio side. **Staging first; minimal diff.** Apply cch-client-portal + cch-inspiration-hub + cch-marketing "gift" standards (Programa, navy `#1f2a3d` / gold `#C4A464`).

## What Cindy asked
"Would there be any way a client could add an image to their inspiration boards?" Give the client a graceful way, from their portal, to contribute an image (something they love, a reference) to their project's inspiration.

## Change
1. **On the client portal, add an "Add an image" / "Share an idea" affordance** on the project's Inspiration view. Client can:
   - **Upload from their device** (photo/image), and/or **paste an image URL** (keep MVP to these two; a full clipper is later).
   - Add an **optional short caption** ("why I love this").
2. **Client images land in a dedicated, clearly-labeled "Client Ideas" section** of that project's inspiration, tagged **from-client** with the client's name and date. They do **NOT** drop into Cindy's curated boards or mix with her clips.
3. **Store the image in Studio storage** (same-origin, permanent), tagged `projectId` + client + `source: 'client'`. Do not hotlink external URLs into the capture path (same lesson as WO-079).
4. **Notify Cindy AND Vanessa** when a client adds an image (reuse the WO-089 notification path), marked unread / from-client.
5. **Cindy stays in control:** she can promote a client image into her curated inspiration boards, or hide/remove it. The client can remove **their own** additions but cannot touch or edit Cindy's clips.

## Decision for Cindy (LOCKED Aug 7)
- **Immediate** (Cindy: "A- Immediate"): client image appears in the **Client Ideas** section right away; Cindy + Vanessa notified; she can hide/curate later.
- Review-first is NOT selected.

## Guardrails (hard, client-facing)
1. **Scoped to their own project's inspiration only.** A client cannot see or add to any other project, and cannot reach anything beyond inspiration (no cost, vendor, margin, POs, proposals, other clients). Images only.
2. **Never overwrite or alter Cindy's curated clips.** Client adds are additive, into the Client Ideas section, source-flagged.
3. **No auto-anything to the client** beyond a simple confirmation ("Thanks, [Cindy] will see this."). Nothing gets sent out on the client's action except the studio notification.
4. **Non-destructive + moderatable:** every client image is flagged so Cindy can hide, remove, or promote it. A hidden/removed client image is gone from the client's view too.
5. Basic guards: image type/size limit, reasonable per-client rate limit, no script/HTML in the caption (escape before render).

## Acceptance (Fable, staging screenshots)
1. On the client portal, a client can upload an image (and/or paste a URL) with an optional caption, and it appears in a clearly-labeled "Client Ideas" section, not in Cindy's curated boards.
2. Cindy and Vanessa are notified; the item is tagged from-client with name + date.
3. Cindy can hide/remove it and can promote it into a curated board; the client cannot edit or delete Cindy's clips.
4. The client sees nothing forbidden (cost/vendor/margin/other projects). No console errors. Caption is escaped.
Screenshots (client add + studio receipt + Client Ideas section) to Fable = sign-off, then Cindy GO for prod.

## Ledger
Add: WO-091 · Client can add an image to their project's inspiration from the portal — lands in a source-flagged "Client Ideas" section (not Cindy's curated boards), stored in Studio storage, notifies Cindy + Vanessa, Cindy curates/hides/promotes; scoped + non-destructive · Cursor (client portal; studio-write caveat to Code) · staging first.
