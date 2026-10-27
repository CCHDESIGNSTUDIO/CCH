# WO-173 DONE — Builder: material role dropdown at top

**State:** DONE-UNVERIFIED  
**Executor:** Cursor  
**Date:** 2026-09-02  
**Build:** Order Builder meta `cch-builder-rev` **2026-09-02wo173-builder-full**

## Symptom (Cindy)

Need a **Role** control at the **top** of each material row: Roller Fabric, Sheer, Facing, Liner, Valance, Trim (plus Side channel). COM / Vendor already on the row. Shade Face (Lutron) stays as its own block.

## Surfaces

| Surface | This WO |
|---------|---------|
| Builder Materials rows (`platform/builder/index.html`) | **Yes** (window treatments: dropdown; other cats: text Role at top) |
| Shade Face Lutron block | Unchanged |
| Studio financial docs | **No** |

## Grounding (this turn)

- Role was a bottom **Role Label** text field (`former :11912`) that updated the heading in place (WO-169 stopped `renderForm` on keystroke).
- Default roller roles: `CATS.roller.fabricRoles` `ROLLER FABRIC` / `SIDE CHANNEL / PELMET (optional)` (`:1697`).
- COM / Vendor chips already at `:11832`. Type Fabric / Trim chips at `:11856`.

## Change

- `appendMaterialRoleControl` (`:3186`) at the top of each material row (`:11827`).
- Window treatments: dropdown (Roller Fabric / Sheer / Facing / Liner / Valance / Trim / Side channel, plus existing custom values, plus Other…).
- Picking **Trim** sets `slotKind` so Type chips follow; form rebuild uses existing `#formPane` scroll restore (`:11174` / `:12096`).
- Other… shows a custom text field; no `renderForm` on each keystroke.
- Shade Face block not replaced.

## Self-test

- Inline scripts parse; tail `</html>` intact.
- Grep: `Role Label` gone; `appendMaterialRoleControl` called after Material `h2`.

## Verify (after staging)

1. Ctrl+Shift+R `https://cch-platform-staging.web.app/builder/`
2. Header **2026-09-02wo173-builder-full**
3. GRE-W-05 Material A: Role dropdown at top; pick Sheer / Liner / Valance / Trim; COM and Vendor still on the row.
4. Shade Face / Lutron block still present.
5. Existing role **ROLLER FABRIC** still selected until changed.
