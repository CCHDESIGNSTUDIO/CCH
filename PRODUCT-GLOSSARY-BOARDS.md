# CCH Studio — Boards glossary (authoritative)

Use this vocabulary **everywhere**: UI labels, client copy, Firestore field names in comments, audits, and support docs. These are **different products**, not interchangeable names.

**Style Library is outside of a project** — it is not “another tab inside a client job.” It is a **studio-wide, internal** reference area. Only **Inspiration**, **Room Boards**, **Design Boards / Concepts**, etc. live **inside** a project.

---

## Why the word “Concepts” exists (root of the confusion)

Early on, language around **boards** collided: people read “design boards” (or similar) as **room-by-room** work — the same mental slot as **Room Boards**. To **separate that layer from Room Boards**, the team introduced **Concepts** / **Concept Boards** (and client routes like `/concepts`) as the name for the **project synthesis** surface (mood + direction pulled together for the client).

So: **Concepts was a deliberate rename to reduce confusion with Room Boards** — not because Concepts and Room Boards are the same thing.

**Today:** Studio often uses the tab label **Design Boards** for that same tier (`designboards`); the **client portal** may still say **Concept Boards** and use **`/concepts`** in the URL. Same *role* as in section 2 below; two labels, one product tier — the glossary treats **Design Boards = Concepts = concept-board tier** unless we explicitly unify copy in code.

---

## Room Boards (separate — spatial / per-room)

**What it is:** Boards organized around **rooms** on the project (the **Room Boards** tab / `boards` in Studio) — floor plans, room-specific selections, spatial context.

**Who it is for:** Team and client as you use that tab today.

**Do not conflate with:** **Design Boards / Concepts** (synthesis / direction layer) or **Inspiration** (Niice-style tiles) or **Style Library** (internal reference).

---

## 1) Inspiration (= client-facing Niice-style boards)

**What it is:** Project boards built from **Niice** (and similar) flows that are **meant to be shared with the client** — selections, mood, product direction tied to **that project**.

**Who it is for:** **Clients** (and the team collaborating with them).

**Studio:** Project tab labeled **Inspiration** (not “Style Library”).

**Rule of thumb:** If it is **project-scoped** and **client-shareable** Niice-style content, it is **Inspiration**.

---

## 2) Design Boards (= Concepts / concept boards — project hub for the client)

**What it is:** The layer that pulls the story together for a **single project** — combining threads from **Inspiration**, **product selections**, and other inputs into one client-facing “where the design is going” surface.

**Who it is for:** **Clients** (primary); staff curates and presents.

**Studio:** Project tab **Design Boards** (`designboards` in routing).

**Client portal (legacy / intentional disambiguation):** **Concept Boards**, routes **`/concepts`**, internal `activePage === 'concepts'` — same *tier* as Design Boards; the **“Concept”** name was chosen so clients and staff would **not** mix this up with **Room Boards**.

**Rule of thumb:** If it is **project-scoped** and is the **synthesis / direction** layer (not room-by-room boards, not raw Niice-only Inspiration), it is **Design Boards / Concepts**.

---

## 3) Style Library (**outside** any project — internal only)

**Placement in product terms:** **Outside of a project.** Not client work, not a deliverable surface for a job. Think **firm library**, not “project #47.”

**What it is:** **Reference** boards — Niice / Pinterest / category / tear-sheet style material that is **not tied to a client project**. It is a **designer-internal** library of **styles** (patterns, palettes, typologies) to browse and reuse.

**Who it is for:** **Staff only** (internal). **Not** shown to clients as a project surface.

**How it connects to projects:** Content can be **copied into a project** (e.g. into that project’s **Inspiration** when ready) — it does **not** replace Inspiration or Design Boards on the project. The library itself **stays outside** the project; only **copies** land on a project.

**Implementation note (Studio):** The app may use a pseudo-board id (`_lib_designer`) and a URL shaped like `#/project/_lib_designer/ideabooks` for technical reasons — that is **not** the same as “Style Library is a project.” Product language: **global / outside projects.**

**Rule of thumb:** If it is **not inside any client project** and is **style reference** for the studio, it is **Style Library** — never call it the client’s “Inspiration” or “Design Boards.”

---

## One-line cheat sheet

| Name | Scope | Audience | Role |
|------|--------|----------|------|
| **Room Boards** | Per project | Team / client | Room-organized boards — **not** the same as Design Boards / Concepts |
| **Inspiration** | Per project | Client | Niice-style shared boards for that job |
| **Design Boards** (= **Concepts** on client site) | Per project | Client | Synthesis hub: Inspiration + selections; **“Concepts”** name was to avoid confusion with **Room Boards** |
| **Style Library** | **Outside any project** · studio-wide (internal) | Staff only | Style reference; **copy into** a project when useful — the library itself is not “on” the project |

---

*If code mixes labels (e.g. client still says “Concept Boards” while Studio says “Design Boards”), treat that as **terminology debt** to reconcile against this doc — not as three different products.*

