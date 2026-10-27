# WO-174 DONE — One Role per material (Face)

**State:** DONE-UNVERIFIED  
**Executor:** Cursor  
**Date:** 2026-09-02  
**Build:** `cch-builder-rev` **2026-09-02wo174-one-role**

## Symptom

Cindy: don’t need Shade Face block + “Material A — ROLLER FABRIC” + Role dropdown. Then: why Shade Face and Face Fabric and Facing?

## Change

- Material heading is **Material A** only. Role is the dropdown.
- Separate **Shade face material** form block removed. Old Lutron/part # copies onto Material A if A is empty.
- Role list is **Face, Sheer, Liner, Valance, Trim, Side channel, Other**. Shade Face / Face Fabric / Facing / Roller Fabric all map to **Face**.

## Verify (after deploy)

1. Header **2026-09-02wo174-one-role**
2. No SHADE FACE MATERIAL block. Material A has Role, not “Material A — ROLLER FABRIC”
3. Role dropdown has one Face — not Shade Face + Face Fabric + Facing
4. GRE-W-05 Vendor / Lutron still on Material A
