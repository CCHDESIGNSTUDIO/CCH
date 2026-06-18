/**
 * Financial documents (proposals / invoices / POs) are isolated snapshots.
 * No automatic back-sync to Product Library or project clips.
 */
(function (global) {
  'use strict';

  var FINANCIAL_COLLECTIONS = { proposals: 1, invoices: 1, purchaseOrders: 1 };

  function cchIsFinancialDocCollection(collection) {
    return !!FINANCIAL_COLLECTIONS[String(collection || '').trim()];
  }

  /** Hard rule: doc edit/save paths must not push upstream. */
  function cchNoBackSyncFromDoc() {
    return true;
  }

  function cchIsDocumentIsolated(collection) {
    return cchIsFinancialDocCollection(collection);
  }

  /**
   * @param {string} operation
   * @param {object} [meta]
   * @returns {{ blocked: boolean, reason?: string }}
   */
  /** Completed / archived projects: no automatic financial back-sync (manual doc edit still allowed). */
  function cchProjectFinancialsAreFrozen(projectId) {
    projectId = String(projectId || '').trim();
    if (!projectId || projectId === '_lib_designer') return false;
    var st = '';
    try {
      if (typeof global.cchProjectFinancialsAreFrozen === 'function' && global.cchProjectFinancialsAreFrozen !== cchProjectFinancialsAreFrozen) {
        return !!global.cchProjectFinancialsAreFrozen(projectId);
      }
      st = String((global._cchProjStatusById || {})[projectId] || '').trim();
    } catch (_eSt) {}
    return st === 'Completed' || st === 'Archived';
  }

  function cchGuardDocBackSync(operation, meta) {
    meta = meta || {};
    if (!cchNoBackSyncFromDoc()) return { blocked: false };

    if (meta.projectId && cchProjectFinancialsAreFrozen(meta.projectId) &&
        meta.explicitUserAction !== true && meta.allowProposalCreateClipLink !== true) {
      if (operation === 'pushLibraryPrices' || operation === 'scheduleLibraryAutoSync' ||
          operation === 'syncProductToClipsFromDoc' || operation === 'clipHydrateOnOpen' ||
          operation === 'applyLibraryToLinePersist' || operation === 'spawnClipFromDocLine' ||
          operation === 'applyLibraryToLine' || operation === 'ensureClipLink' || operation === 'syncClipLinkMetadata') {
        return { blocked: true, reason: 'project-financials-frozen' };
      }
    }

    if (meta.explicitUserAction === true || meta.allowProposalCreateClipLink === true) {
      if (operation === 'ensureClipLink' || operation === 'syncClipLinkMetadata') {
        return { blocked: false };
      }
    }
    if (meta.explicitApplyFromLibrary === true &&
        (operation === 'applyLibraryToLine' || operation === 'applyLibraryToLinePersist')) {
      return { blocked: false };
    }

    if (operation === 'pushLibraryPrices' || operation === 'scheduleLibraryAutoSync' ||
        operation === 'syncProductToClipsFromDoc' || operation === 'clipHydrateOnOpen' ||
        operation === 'applyLibraryToLinePersist' || operation === 'spawnClipFromDocLine') {
      cchRecordDocVariance({
        operation: operation,
        source: meta.source || '',
        projectId: meta.projectId || '',
        collection: meta.collection || '',
        docId: meta.docId || '',
        lineIdx: meta.lineIdx,
        field: meta.field || '',
        message: meta.message || 'Blocked doc→upstream sync (document isolation rule)'
      });
      return { blocked: true, reason: 'document-isolated' };
    }

    if (operation === 'applyLibraryToLine' && !meta.explicitApplyFromLibrary) {
      return { blocked: true, reason: 'apply-requires-explicit-ui' };
    }

    return { blocked: false };
  }

  function cchRecordDocVariance(entry) {
    entry = entry || {};
    entry.recordedAt = entry.recordedAt || new Date().toISOString();
    global._cchDocVarianceLog = global._cchDocVarianceLog || [];
    global._cchDocVarianceLog.push(entry);
    if (global._cchDocVarianceLog.length > 200) {
      global._cchDocVarianceLog = global._cchDocVarianceLog.slice(-200);
    }
    try {
      console.info('[cch-doc-isolation] variance', entry.operation, entry.source || '', entry.message || '');
    } catch (_e) {}
  }

  /** Legacy opt-in for clip spawn on save — permanently off (use explicit link UI). */
  function cchDocSaveAutoLinkRoomBoardEnabled() {
    return false;
  }

  function cchAllowClipToDocHydrateOnOpen() {
    return global.CCH_INVOICE_OPEN_CLIP_HYDRATE === true;
  }

  /**
   * Hard rule: library ↔ clip ↔ doc lines do not auto-sync fields.
   * Only explicit UI (Apply from Library, etc.) may pass explicitApplyFromLibrary / explicitUserAction.
   */
  function cchGuardCrossEntitySync(operation, meta) {
    meta = meta || {};
    if (meta.explicitApplyFromLibrary === true || meta.explicitUserAction === true ||
        meta.explicitPushClipImages === true) {
      return { blocked: false };
    }
    var blocked = {
      syncProductToClips: 1,
      cchPushClipImagesToLinkedDocLines: 1,
      clipToLibraryMirror: 1
    };
    if (!blocked[operation]) return { blocked: false };
    cchRecordDocVariance({
      operation: operation,
      source: meta.source || '',
      projectId: meta.projectId || '',
      message: meta.message || 'Blocked automatic cross-entity sync — use explicit Apply from Library only'
    });
    return { blocked: true, reason: 'cross-entity-isolated' };
  }

  global.cchIsFinancialDocCollection = cchIsFinancialDocCollection;
  global.cchNoBackSyncFromDoc = cchNoBackSyncFromDoc;
  global.cchIsDocumentIsolated = cchIsDocumentIsolated;
  global.cchGuardDocBackSync = cchGuardDocBackSync;
  global.cchRecordDocVariance = cchRecordDocVariance;
  global.cchDocSaveAutoLinkRoomBoardEnabled = cchDocSaveAutoLinkRoomBoardEnabled;
  global.cchAllowClipToDocHydrateOnOpen = cchAllowClipToDocHydrateOnOpen;
  global.cchProjectFinancialsAreFrozen = cchProjectFinancialsAreFrozen;
  global.cchGuardCrossEntitySync = cchGuardCrossEntitySync;

  /**
   * Product Library is edited only from #/library UI — never from clips, selections, proposals, or invoices.
   * Pass explicitLibraryEdit:true from saveProduct (library), _pdUpdateField, _pdUploadImage, etc.
   * Pass allowNewLibraryProduct:true only for intentional .add() (Add new product, clipper capture).
   */
  function cchGuardLibraryWrite(operation, meta) {
    meta = meta || {};
    if (meta.allowNewLibraryProduct === true) return { blocked: false };
    if (meta.explicitLibraryEdit === true) return { blocked: false };
    if ((global._cchLibraryEditDepth || 0) > 0) return { blocked: false };
    cchRecordDocVariance({
      operation: operation || 'libraryWrite',
      source: meta.source || '',
      projectId: meta.projectId || '',
      message: meta.message || 'Blocked write to Product Library (no backward sync from project data)'
    });
    return { blocked: true, reason: 'library-write-isolated' };
  }

  function cchRunAsLibraryEdit(fn) {
    global._cchLibraryEditDepth = (global._cchLibraryEditDepth || 0) + 1;
    try {
      var out = fn();
      if (out && typeof out.then === 'function') {
        return out.finally(function () {
          global._cchLibraryEditDepth = Math.max(0, (global._cchLibraryEditDepth || 1) - 1);
        });
      }
      global._cchLibraryEditDepth = Math.max(0, (global._cchLibraryEditDepth || 1) - 1);
      return out;
    } catch (e) {
      global._cchLibraryEditDepth = Math.max(0, (global._cchLibraryEditDepth || 1) - 1);
      throw e;
    }
  }

  global.cchGuardLibraryWrite = cchGuardLibraryWrite;
  global.cchRunAsLibraryEdit = cchRunAsLibraryEdit;

  try {
    console.info('[cch-doc-isolation] loaded v20260603d — cchNoBackSyncFromDoc()=', cchNoBackSyncFromDoc());
  } catch (_bootLog) {}
})(typeof window !== 'undefined' ? window : global);
