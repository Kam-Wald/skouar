import type * as React from 'react'
import { useKod } from '../ctx'
import { fileGlyph, flattenReal } from '../lib'

export default function TabsBar() {
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
        <div className="kod-tabs">
          {orderedTabs().map((id) => {
            const n = nodes.find((x) => x.id === id)
            const r = id.startsWith('real:') ? flattenReal(realTree).find((x) => x.key === id) : undefined
            const name = n?.name ?? r?.name ?? id
            const pinned = ui.pinned.includes(id)
            return (
              <div
                key={id}
                className={`kod-tab${active === id ? ' active' : ''}${pinned ? ' pinned' : ''}`}
                draggable
                onDragStart={(e) => {
                  e.dataTransfer.setData('text/kod-tab', id)
                  e.dataTransfer.effectAllowed = 'move'
                  setDragTab(id)
                }}
                onDragEnd={() => {
                  setDragTab(null)
                  setDropZone(false)
                }}
                onClick={() => setUi({ ...ui, active: id })}
                onContextMenu={(e) => {
                  e.preventDefault()
                  setTabMenu({ id, x: e.clientX, y: e.clientY })
                }}
                title="Clic : ouvrir · clic droit : menu · glisser à droite : volet split"
              >
                {pinned && <span className="kod-tab-pin">📌</span>}
                <span className="kod-tab-ico">{n ? fileGlyph(n.name) : '📄'}</span>
                <span className="kod-tab-name">{name}</span>
                {buffers[id]?.dirty && <span className="kod-dot">●</span>}
                <button
                  className="kod-tab-x"
                  title="Fermer l'onglet"
                  onClick={(e) => {
                    e.stopPropagation()
                    closeTab(id)
                  }}
                >
                  ×
                </button>
              </div>
            )
          })}
          <button className="kod-tab-add" aria-label="Nouveau fichier (nouvel onglet)" title="Nouveau fichier +" onClick={() => setNewTabOpen((o) => !o)}>
            +
          </button>
          {newTabOpen && (
            <div className="kod-panel kod-newtab" data-pop="knew">
              <div className="kod-panel-head">+ Nouveau fichier</div>
              {["md", "js", "ts", "html", "css", "py", "json", "yml", "sh", "sql", "txt"].map((ext) => (
                <button key={ext} className="kod-panel-item" onClick={() => void createQuickFile(ext)}>
                  📄 sans-titre.{ext}
                </button>
              ))}
            </div>
          )}
          {tabMenu && (
            <div className="kod-tabmenu" data-pop="ktmenu" style={{ left: tabMenu.x, top: tabMenu.y }}>
              <button className="kod-panel-item" onClick={() => { togglePin(tabMenu.id); setTabMenu(null) }}>
                {ui.pinned.includes(tabMenu.id) ? '📌 Désépingler' : '📌 Épingler'}
              </button>
              <button className="kod-panel-item" onClick={() => { setSplitId(tabMenu.id); setTabMenu(null) }}>
                ➡ Ouvrir dans le volet droit
              </button>
              <button className="kod-panel-item" onClick={() => { closeTab(tabMenu.id); setTabMenu(null) }}>
                ✕ Fermer
              </button>
              <button className="kod-panel-item" onClick={() => { closeOthers(tabMenu.id); setTabMenu(null) }}>
                Fermer les autres
              </button>
              <button className="kod-panel-item" onClick={() => { closeRight(tabMenu.id); setTabMenu(null) }}>
                Fermer à droite
              </button>
            </div>
          )}
          <div className="kod-tabs-tools">
            <button className="db-btn" title="Rechercher dans le fichier (Ctrl+F)" onClick={() => setFindOpen(true)}>
              🔍
            </button>
            <button className="db-btn" title="Rechercher dans tout le projet (Ctrl+Shift+F)" onClick={() => setGOpen(true)}>
              🔎
            </button>
            <button
              className="db-btn"
              title="Police plus petite"
              onClick={() => setUi({ ...ui, fontSize: Math.max(10, ui.fontSize - 1) })}
            >
              A−
            </button>
            <button
              className="db-btn"
              title="Police plus grande"
              onClick={() => setUi({ ...ui, fontSize: Math.min(22, ui.fontSize + 1) })}
            >
              A+
            </button>
            <button className="db-btn" title={ui.wrap ? 'Désactiver le retour à la ligne' : 'Activer le retour à la ligne'} onClick={() => setUi({ ...ui, wrap: !ui.wrap })}>
              {ui.wrap ? '↵ coupé' : '↵ wrap'}
            </button>
            <button className="db-btn" title="Enregistrer (Ctrl+S)" onClick={() => void saveActive()}>
              💾
            </button>
            <button className="db-btn" title="Enregistrer sous… (disque)" onClick={() => void saveAs()}>
              ⤓
            </button>
            <button className="db-btn" aria-label="Aperçu" title="Aperçu rendu (md/html)" onClick={() => setPreview((x) => !x)}>👁</button>
            <button className="db-btn" aria-label="Plan du fichier" title="Plan (symboles)" onClick={() => setOutlineOpen((o) => !o)}>☰</button>
            <button className="db-btn" aria-label="Minimap" title="Minimap" onClick={() => setMini((x) => !x)}>🗺</button>
            <button className="db-btn" aria-label="Historique des versions" title="Historique des versions" onClick={() => void openHist()}>🕘</button>
            <button className="db-btn" aria-label="Palette de commandes" title="Palette de commandes (Ctrl+K)" onClick={() => { setPalOpen(true); setPalQ(''); setPalArg(null) }}>⌘K</button>
            <button className="db-btn" aria-label="Problèmes" title={`Problèmes (${probs.length})`} onClick={() => setProbsOpen(true)}>⚠️</button>
            <button className="db-btn" aria-label="Mode focus" title="Mode focus (sans sidebar, éditeur centré)" onClick={() => setFocus((z) => !z)}>🧘</button>
          </div>
        </div>
    </>
  )
}
