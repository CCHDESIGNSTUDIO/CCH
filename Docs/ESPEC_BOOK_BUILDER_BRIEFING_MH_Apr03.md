# E-Spec Book Builder — CCH Studio Feature Briefing
**Created by:** MH (CCWO/Hermes)  
**Date:** April 3, 2026  
**Handoff to:** CCW1/CCW2 (Claude Code)  
**Context:** Prototype built in local agent session, ready for CCH Studio integration

---

## Feature Overview

The E-Spec Book Builder is a new module in CCH Studio that generates a digital specification book from existing project data. It pulls products from either **Room Boards** or **Category views**, lets the user select items, attach/manage documents per item, then exports as PDF with print/share/download options.

---

## 4-Step Flow

### Step 1 — Source Selection
- Toggle between **Room** or **Category** as the source type
- Checkbox list of available rooms or categories to pull from
- Select All / Deselect All
- "Next" advances to item selection

### Step 2 — Select Items
- Full item list populated from selected source(s)
- Each row displays: **Tag, Product Name, Type, Manufacturer, Doc Count**
- Checkboxes for each item — Select All / Deselect All
- Search/filter bar
- **Expandable row** — click any item row to reveal:
  - Drag & drop zone for adding documents
  - Add from file browser or project library
  - Reorder attached documents
  - Remove documents
- Doc count updates live per item

### Step 3 — Review Documents
- Summary cards showing:
  - Total items included
  - Total docs attached
  - Items missing docs (flagged with gold border)
- Quick-add documents to any item from this view
- Validation: flag items with zero docs attached

### Step 4 — Export
- **Name the book** (text input)
- **Three export actions:**
  - Download PDF
  - Print
  - Share Link
- **Include checkboxes:**
  - Cover Page
  - Table of Contents
  - Cut Sheets
  - Supporting Documents
  - Pricing Summary
  - Room Dividers
- Confirmation modal before executing action

---

## UI / Brand Requirements

- **CCH brand palette:** Navy (#1B2A4A), Gold (#C9A84C), White
- Match existing CCH Studio dashboard aesthetic
- Consistent with current index.html component patterns
- Responsive — works on desktop primary, tablet secondary

---

## Data Integration Points

- Pulls from existing **Firestore product/item collections** already in CCH Studio
- Room boards and category assignments must already exist in project data
- Documents: support existing file references + new uploads
- Export: PDF generation (server-side or client-side TBD based on current stack)

---

## Prototype Reference

A fully interactive JSX prototype was built in Claude Code local agent session:
- **Session:** `8ae4eae9-c130-4092-a029-e3ffbff9096e`
- **File:** `CCH_ESpec_Book_Builder.jsx`
- **Location:** `C:\Users\cindy\AppData\Roaming\Claude\local-agent-mode-sessions\8ae4eae9-c130-4092-a029-e3ffbff9096e\...\outputs\CCH_ESpec_Book_Builder.jsx`

The prototype demonstrates the full 4-step flow with mock data. Use it as the visual/interaction reference when integrating into the CCH Studio index.html codebase.

---

## Implementation Notes for Code

1. **CCH Studio is a single index.html (~17,000 lines)** — this feature integrates as a new section/module within that file
2. **Firestore** is the backend — product data, room assignments, and document references live there
3. **No separate React build** — the prototype is React/JSX for demonstration; actual implementation follows whatever pattern the existing Studio uses
4. **Document handling** — need to confirm current file storage approach (Firebase Storage, external URLs, etc.) before building the attach/upload flow
5. **PDF generation** — evaluate jsPDF, html2pdf, or server-side options based on what's already in the stack

---

## Status

- [x] Feature concept defined
- [x] Interactive prototype built (JSX)
- [ ] Integration into CCH Studio index.html
- [ ] Firestore data model for E-Spec books
- [ ] Document upload/attach flow
- [ ] PDF export implementation
- [ ] Testing with real project data
