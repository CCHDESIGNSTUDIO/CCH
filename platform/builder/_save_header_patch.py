from pathlib import Path
p = Path(__file__).with_name("index.html")
t = p.read_text(encoding="utf-8")

insert = """  <motion class="header-save-bar" id="headerSaveBar" style="display:none">
    <span class="header-wo-status" id="headerWoStatus"></span>
    <button type="button" class="btn" id="headerSaveBtn">Save work order</button>
    <span class="header-save-status" id="headerSaveStatus"></span>
  </motion>
"""

insert = insert.replace("motion", "d" + "iv")

needle = '  <div class="auth-note" id="authNote">Checking sign-in...</div>\n'
if needle not in t:
    raise SystemExit("needle not found")
if "headerSaveBar" in t:
    print("header save bar already present")
else:
    t = t.replace(needle, insert + needle, 1)
    print("inserted header save bar")

js_helpers = '''
const BUILDER_SESSION_KEY = "cch_builder_lastWorkOrder";

function readBuilderSession() {
  try {
    const raw = sessionStorage.getItem(BUILDER_SESSION_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (e) { return null; }
}

function writeBuilderSession() {
  const cat = state.category;
  const d = getCatData(cat);
  const projectId = (d.projectId || "").trim();
  const woId = state.currentWorkOrderId || "";
  if (!projectId || !woId) return;
  try {
    sessionStorage.setItem(BUILDER_SESSION_KEY, JSON.stringify({
      projectId,
      workOrderId: woId,
      category: cat,
      workOrderNumber: d.workOrder || "",
      savedAt: Date.now()
    }));
  } catch (e) {}
}

function syncBuilderUrl() {
  const cat = state.category;
  const d = getCatData(cat);
  const projectId = (d.projectId || "").trim();
  const woId = state.currentWorkOrderId || "";
  if (!projectId || !woId) return;
  try {
    const u = new URL(window.location.href);
    u.searchParams.set("projectId", projectId);
    u.searchParams.set("workOrderId", woId);
    u.searchParams.set("category", cat);
    history.replaceState({}, "", u.pathname + "?" + u.searchParams.toString() + u.hash);
  } catch (e) {}
}

function updateHeaderSaveUI(mode) {
  const bar = document.getElementById("headerSaveBar");
  const statusEl = document.getElementById("headerSaveStatus");
  const woEl = document.getElementById("headerWoStatus");
  const btn = document.getElementById("headerSaveBtn");
  if (!bar || !statusEl || !woEl) return;
  if (document.body.classList.contains("builder-signed-in")) bar.style.display = "flex";
  const d = getCatData(state.category);
  const woNum = String(d.workOrder || "").trim();
  const saved = !!state.currentWorkOrderId;
  if (woNum) woEl.textContent = "WO " + woNum + (saved ? "" : " (unsaved)");
  else if (saved) woEl.textContent = "Saved work order";
  else woEl.textContent = "New work order";
  if (mode === "saving") {
    statusEl.textContent = "Saving…";
    if (btn) btn.disabled = true;
  } else if (mode === "saved") {
    statusEl.textContent = "Saved";
    if (btn) btn.disabled = false;
  } else if (mode === "error") {
    statusEl.textContent = "Save failed";
    if (btn) btn.disabled = false;
  } else {
    statusEl.textContent = saved ? "" : "Save before refresh";
    if (btn) btn.disabled = false;
  }
}

'''

if "BUILDER_SESSION_KEY" not in t:
    t = t.replace("async function saveWorkOrder(isNewRevision) {", js_helpers + "async function saveWorkOrder(isNewRevision) {", 1)

old_save_start = "async function saveWorkOrder(isNewRevision) {\n  const cat = state.category;"
new_save_start = """async function saveWorkOrder(isNewRevision) {
  updateHeaderSaveUI("saving");
  const cat = state.category;"""
if old_save_start in t and "updateHeaderSaveUI(\"saving\")" not in t.split("async function saveWorkOrder")[1][:200]:
    t = t.replace(old_save_start, new_save_start, 1)

old_save_end = """  state.workOrdersByProject = await listWorkOrders(projectId);
  renderForm();
}

async function saveAndCloseBuilder() {"""
new_save_end = """  state.workOrdersByProject = await listWorkOrders(projectId);
  writeBuilderSession();
  syncBuilderUrl();
  updateHeaderSaveUI("saved");
  renderForm();
  return true;
}

async function saveAndCloseBuilder() {"""
if old_save_end in t:
    t = t.replace(old_save_end, new_save_end, 1)

# wrap save in try/catch - insert after validations before uploadPendingAssets
# Actually add try/catch around the whole body after validations
marker = "  await uploadPendingAssets(cat, projectId);\n  const col = db.collection"
if marker in t and "try {\n  await uploadPendingAssets" not in t:
    t = t.replace(
        "  if (SHADE_ROLL_CATS.has(cat)) {\n    syncShadeSpecsMountAndRollOff(cat, data);\n    if (!parseShadeMountCompound(String((data.specs || {}).mount || \"\")).roll) {\n      alert(\"Select mount & fabric roll — each option includes roll off front or roll off back.\");\n      return;\n    }\n  }\n  await uploadPendingAssets",
        "  if (SHADE_ROLL_CATS.has(cat)) {\n    syncShadeSpecsMountAndRollOff(cat, data);\n    if (!parseShadeMountCompound(String((data.specs || {}).mount || \"\")).roll) {\n      alert(\"Select mount & fabric roll — each option includes roll off front or roll off back.\");\n      updateHeaderSaveUI();\n      return false;\n    }\n  }\n  try {\n  await uploadPendingAssets",
        1,
    )
    t = t.replace(
        "  if (!projectId) { alert(\"Project ID is required.\"); return; }",
        "  if (!projectId) { alert(\"Project ID is required.\"); updateHeaderSaveUI(); return false; }",
        1,
    )
    t = t.replace(
        "  if (!String(data.room || \"\").trim()) { alert(\"Room is required.\"); return; }",
        "  if (!String(data.room || \"\").trim()) { alert(\"Room is required.\"); updateHeaderSaveUI(); return false; }",
        1,
    )
    t = t.replace(
        '    alert("Window tag is required (e.g. W1, W2). This prints on the work order and drives proposal sequencing.");\n    return;',
        '    alert("Window tag is required (e.g. W1, W2). This prints on the work order and drives proposal sequencing.");\n    updateHeaderSaveUI();\n    return false;',
        1,
    )
    t = t.replace(
        "  renderForm();\n  return true;\n}\n\nasync function saveAndCloseBuilder()",
        "  renderForm();\n  return true;\n  } catch (err) {\n    console.error(\"[Builder] saveWorkOrder\", err);\n    alert(\"Save failed: \" + (err && err.message ? String(err.message) : String(err)));\n    updateHeaderSaveUI(\"error\");\n    return false;\n  }\n}\n\nasync function saveAndCloseBuilder()",
        1,
    )

old_apply = """async function applyBuilderQueryParams() {
  const params = new URLSearchParams(window.location.search);
  const projectId = (params.get("projectId") || params.get("project") || "").trim();
  const workOrderId = (params.get("workOrderId") || params.get("wo") || "").trim();
  const duplicateFrom = (params.get("duplicateFrom") || "").trim();
  if (!projectId) return;"""

new_apply = """async function applyBuilderQueryParams() {
  const params = new URLSearchParams(window.location.search);
  let projectId = (params.get("projectId") || params.get("project") || "").trim();
  let workOrderId = (params.get("workOrderId") || params.get("wo") || "").trim();
  const duplicateFrom = (params.get("duplicateFrom") || "").trim();
  const categoryParam = (params.get("category") || "").trim();
  if (!projectId || !workOrderId) {
    const sess = readBuilderSession();
    if (sess) {
      if (!projectId) projectId = String(sess.projectId || "").trim();
      if (!workOrderId) workOrderId = String(sess.workOrderId || "").trim();
      if (categoryParam && CATS[categoryParam]) state.category = categoryParam;
      else if (sess.category && CATS[sess.category]) state.category = sess.category;
    }
  }
  if (!projectId) return;"""

if old_apply in t:
    t = t.replace(old_apply, new_apply, 1)

old_clear_url = """    if (typeof history.replaceState === "function") {
      try {
        const u = new URL(window.location.href);
        u.search = "";
        history.replaceState({}, "", u.pathname + u.hash);
      } catch (e) {}
    }"""
new_clear_url = """    syncBuilderUrl();"""

if old_clear_url in t:
    t = t.replace(old_clear_url, new_clear_url, 1)

old_load_end = """  state.category = mergedCat;
  if (state.libraryRail) state.libraryRail.userPickedFolder = false;
  document.querySelectorAll("#tabs button").forEach(b => {
    const grp = b.dataset.group || (b.dataset.cat ? currentGroupFromCategory(b.dataset.cat) : "windows");
    b.classList.toggle("active", grp === state.uiGroup);
  });
  renderForm();
}

async function duplicateWorkOrderFromFirestore"""

new_load_end = old_load_end.replace("  renderForm();\n}", "  writeBuilderSession();\n  syncBuilderUrl();\n  renderForm();\n}")

if old_load_end in t and "writeBuilderSession();\n  syncBuilderUrl();\n  renderForm();" not in t.split("async function loadWorkOrderById")[1][:800]:
    t = t.replace(old_load_end, new_load_end, 1)

setup_fn = """
(function setupHeaderSaveButton() {
  const btn = document.getElementById("headerSaveBtn");
  if (!btn || btn.dataset.bound) return;
  btn.dataset.bound = "1";
  btn.addEventListener("click", () => saveWorkOrder(false));
})();

"""

if "setupHeaderSaveButton" not in t:
    t = t.replace("auth.onAuthStateChanged(async user => {", setup_fn + "auth.onAuthStateChanged(async user => {", 1)

if "updateHeaderSaveUI();" not in t.split("async function renderForm")[1][:500]:
    t = t.replace("  updatePreview();\n}\n\ndocument.getElementById(\"tabs\")", "  updatePreview();\n  updateHeaderSaveUI();\n}\n\ndocument.getElementById(\"tabs\")", 1)

p.write_text(t, encoding="utf-8")
print("done")
