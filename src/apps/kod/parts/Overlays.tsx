import type * as React from 'react'
import { useKod } from '../ctx'

export default function Overlays() {
  const {
    nodes,
    setNodes,
    ui,
    setUi,
    buffers,
    setBuffers,
    dirHandle,
    setDirHandle,
    realTree,
    setRealTree,
    sideW,
    setSideW,
    newItem,
    setNewItem,
    renameId,
    setRenameId,
    renameVal,
    setRenameVal,
    findOpen,
    setFindOpen,
    findQ,
    setFindQ,
    findIdx,
    setFindIdx,
    gOpen,
    setGOpen,
    gQ,
    setGQ,
    gResults,
    setGResults,
    gBusy,
    setGBusy,
    toast,
    setToast,
    savedAt,
    setSavedAt,
    lineCol,
    setLineCol,
    replOpen,
    setReplOpen,
    replQ,
    setReplQ,
    gReplQ,
    setGReplQ,
    multi,
    setMulti,
    preview,
    setPreview,
    mini,
    setMini,
    outlineOpen,
    setOutlineOpen,
    histOpen,
    setHistOpen,
    versions,
    setVersions,
    palOpen,
    setPalOpen,
    palQ,
    setPalQ,
    palArg,
    setPalArg,
    palVal,
    setPalVal,
    folds,
    setFolds,
    pair,
    setPair,
    charW,
    setCharW,
    probsOpen,
    setProbsOpen,
    fpOpen,
    setFpOpen,
    fpQ,
    setFpQ,
    focus,
    setFocus,
    newTabOpen,
    setNewTabOpen,
    tplOpen,
    setTplOpen,
    projects,
    setProjects,
    pid,
    setPid,
    projOpen,
    setProjOpen,
    newProjName,
    setNewProjName,
    renProj,
    setRenProj,
    renProjVal,
    setRenProjVal,
    gitOpen,
    setGitOpen,
    commits,
    setCommits,
    gitMsg,
    setGitMsg,
    branches,
    setBranches,
    newBranch,
    setNewBranch,
    curBranch,
    setCurBranch,
    snipOpen,
    setSnipOpen,
    snips,
    setSnips,
    snipLang,
    setSnipLang,
    snipLabel,
    setSnipLabel,
    snipBody,
    setSnipBody,
    findRe,
    setFindRe,
    gRe,
    setGRe,
    synIssues,
    setSynIssues,
    rect,
    setRect,
    bms,
    setBms,
    tabMenu,
    setTabMenu,
    diffV,
    setDiffV,
    splitId,
    setSplitId,
    dropZone,
    setDropZone,
    dragTab,
    setDragTab,
    extChanged,
    setExtChanged,
    keymap,
    setKeymap,
    zipInputRef,
    snipInputRef,
    mtimesRef,
    realTreeRef,
    extRef,
    taRef,
    hlRef,
    gutterRef,
    miniRef,
    fileInputRef,
    nodesRef,
    buffersRef,
    uiRef,
    pendingDelete,
    matches,
    outline,
    foldable,
    foldedStarts,
    probsStatic,
    probs,
    fpList,
    diffRows,
    defFiles,
    defIndex,
    km,
    nodeName,
    pollExternal,
    reloadDisk,
    rescanDisk,
    openGit,
    commitCurrent,
    commitProject,
    restoreCommit,
    diffCommit,
    createBranch,
    exportZip,
    importZip,
    mergedSnippets,
    addSnippet,
    exportSnippets,
    importSnippets,
    syncScroll,
    updateLineCol,
    openNode,
    openReal,
    orderedTabs,
    closeTab,
    reopenClosedTab,
    togglePin,
    closeOthers,
    closeRight,
    sessOf,
    switchProject,
    createProject,
    commitRenameProj,
    removeProject,
    saveActive,
    createItem,
    removeNode,
    commitRename,
    openDirPicker,
    openFilePicker,
    saveAs,
    goMatch,
    runGlobalSearch,
    jumpTo,
    setBuf,
    replForMatch,
    replaceCurrent,
    replaceAllFile,
    replaceAllProject,
    wordAt,
    addNextOccurrence,
    selectAllOccurrences,
    applyMultiEdit,
    rectApply,
    rectExtend,
    jumpLine,
    miniJump,
    insertText,
    paletteCmds,
    openHist,
    restoreVersion,
    offToLC,
    findPair,
    commentToken,
    toggleComment,
    moveLines,
    duplicateSel,
    handleAutoPair,
    foldEnd,
    toggleFold,
    applyContent,
    foldAll,
    unfoldAll,
    toggleBm,
    openFileByKey,
    moveNode,
    importFiles,
    onFilesPicked,
    nodePath,
    doGoToDef,
    createQuickFile,
    createFromTemplate,
    onTaKeyDown,
    childrenOf,
    toggleDir,
    renderNode,
    renderReal,
    active,
    buf,
    activeNode,
    activeReal,
    activeName,
    lang,
    content,
    isImgActive,
    isSvgActive,
    SNIPPETS,
    filteredPal,
    lines,
  } = useKod()

  if (!ui || !nodes) return null

  return (
    <>
      {probsOpen && (
        <div className="kod-panel kod-outline" data-pop="kprob">
          <div className="kod-panel-head">⚠️ Problèmes — {activeName} ({probs.length})</div>
          {probs.map((pr) => (
            <button key={pr.line} className="kod-panel-item" onClick={() => { jumpLine(pr.line); setProbsOpen(false) }}>
              <span className="kod-panel-line">L{pr.line}</span> {pr.label}
            </button>
          ))}
          {probs.length === 0 && <div className="kod-pal-empty">Aucun problème détecté 🎉</div>}
        </div>
      )}
      {fpOpen && (
        <div className="kod-pal" data-pop="kfp">
          <input
            autoFocus
            aria-label="Aller au fichier"
            placeholder="Aller au fichier… (Ctrl+P)"
            value={fpQ}
            onChange={(e) => setFpQ(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && fpList[0]) { openFileByKey(fpList[0].key); setFpOpen(false) }
              if (e.key === 'Escape') setFpOpen(false)
            }}
          />
          <div className="kod-pal-list" role="listbox">
            {fpList.slice(0, 30).map((f) => (
              <button key={f.key} className="kod-pal-item" role="option" onClick={() => { openFileByKey(f.key); setFpOpen(false) }}>{f.name}</button>
            ))}
            {fpList.length === 0 && <div className="kod-pal-empty">Aucun fichier</div>}
          </div>
        </div>
      )}
      {palOpen && (
        <div className="kod-pal" data-pop="kpal">
          <input
            autoFocus
            aria-label="Palette de commandes"
            placeholder={palArg === 'goto' ? 'Numéro de ligne…' : 'Commande ou extrait… (Ctrl+K)'}
            value={palArg === 'goto' ? palVal : palQ}
            onChange={(e) => (palArg === 'goto' ? setPalVal(e.target.value) : setPalQ(e.target.value))}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                if (palArg === 'goto') {
                  const ln = parseInt(palVal, 10)
                  if (ln > 0) jumpLine(ln)
                  setPalOpen(false)
                  setPalArg(null)
                } else {
                  const c = filteredPal[0]
                  if (c) c.run()
                }
              }
              if (e.key === 'Escape') { setPalOpen(false); setPalArg(null) }
            }}
          />
          {palArg !== 'goto' && (
            <div className="kod-pal-list" role="listbox">
              {filteredPal.map((c) => (
                <button key={c.id} className="kod-pal-item" role="option" onClick={() => { if (c.arg) { setPalArg(c.id); setPalVal('') } else c.run() }}>
                  {c.label}
                </button>
              ))}
              {filteredPal.length === 0 && <div className="kod-pal-empty">Aucun résultat</div>}
            </div>
          )}
        </div>
      )}
      {outlineOpen && (
        <div className="kod-panel kod-outline" data-pop="kout">
          <div className="kod-panel-head">☰ Plan — {activeName}</div>
          {outline.map((o) => (
            <button key={o.line} className="kod-panel-item" onClick={() => { jumpLine(o.line); setOutlineOpen(false) }}>
              <span className="kod-panel-line">L{o.line}</span> {o.label}
            </button>
          ))}
          {outline.length === 0 && <div className="kod-pal-empty">Aucun symbole détecté</div>}
        </div>
      )}
      {histOpen && (
        <div className="kod-panel kod-hist" data-pop="khist">
          <div className="kod-panel-head">🕘 Historique — {activeName}</div>
          {versions.map((v) => (
            <div key={v.id} className="kod-hist-row">
              <span>{new Date(v.at).toLocaleString('fr-FR')} · {v.content.length} car.</span>
              <button className="db-btn" onClick={() => restoreVersion(v)}>Restaurer</button>
              <button className="db-btn" onClick={() => setDiffV(v)}>Comparer</button>
            </div>
          ))}
          {versions.length === 0 && <div className="kod-pal-empty">Aucune version enregistrée</div>}
        </div>
      )}
      {diffV && (
        <div className="kod-panel kod-diff" data-pop="kdiff">
          <div className="kod-panel-head">
            <span>⇄ Diff — {diffV.fileId ? nodeName(diffV.fileId) : activeName} · {new Date(diffV.at).toLocaleString('fr-FR')} → courant</span>
            <button className="db-btn" aria-label="Fermer le diff" onClick={() => setDiffV(null)}>✕</button>
          </div>
          <div className="kod-diff-body">
            {diffRows.slice(0, 800).map((r, i) => (
              <div key={i} className={`kod-diff-row ${r.type}`}>
                <span className="kod-diff-ln">{r.type === 'add' ? '' : r.a}{r.type === 'del' ? '' : r.b ? `/${r.b}` : ''}</span>
                <span className="kod-diff-txt">{r.text === '' ? ' ' : r.text}</span>
              </div>
            ))}
            {diffRows.length > 800 && <div className="kod-pal-empty">… {diffRows.length - 800} lignes de plus</div>}
          </div>
        </div>
      )}
      {toast && (
        <div className="toast" key={toast.key} style={{ bottom: 16 }}>
          <span>{toast.msg}</span>
          {toast.action && <button onClick={() => toast.action?.fn()}>{toast.action.label}</button>}
        </div>
      )}
    </>
  )
}
