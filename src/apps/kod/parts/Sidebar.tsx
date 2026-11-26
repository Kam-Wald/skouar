import type * as React from 'react'
import { useKod } from '../ctx'
import { KOD_TEMPLATES, templateGroups } from '../templates'
import { fileGlyph } from '../lib'
import { saveKV, deleteCommit, listCommits, saveSnippets } from '../store'

export default function Sidebar() {
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
        <div className="kod-projbar">
          <button className="db-btn" title="Changer de projet (multi-projets)" onClick={() => setProjOpen((o) => !o)}>
            🗂 {projects.find((p) => p.id === pid)?.name ?? '…'} ▾
          </button>
        </div>
        {projOpen && (
          <div className="kod-panel kod-proj" data-pop="kproj">
            <div className="kod-panel-head">🗂 Projets</div>
            {projects.map((p) => (
              <div key={p.id} className={`kod-proj-row${p.id === pid ? ' active' : ''}`}>
                {renProj === p.id ? (
                  <input
                    className="kod-rename"
                    autoFocus
                    value={renProjVal}
                    onChange={(e) => setRenProjVal(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') void commitRenameProj() }}
                    onBlur={() => void commitRenameProj()}
                  />
                ) : (
                  <button className="kod-panel-item kod-proj-go" onClick={() => void switchProject(p.id)}>
                    {p.id === pid ? '● ' : ''}{p.name}
                  </button>
                )}
                <button className="db-btn" title="Renommer le projet" onClick={() => { setRenProj(p.id); setRenProjVal(p.name) }}>
                  ✎
                </button>
                {projects.length > 1 && (
                  <button className="db-btn" title="Supprimer ce projet (fichiers + commits)" onClick={() => void removeProject(p.id)}>
                    🗑
                  </button>
                )}
              </div>
            ))}
            <div className="kod-git-actions">
              <input placeholder="Nouveau projet…" value={newProjName} onChange={(e) => setNewProjName(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') void createProject() }} />
              <button className="db-btn" onClick={() => void createProject()}>
                ＋
              </button>
            </div>
          </div>
        )}
        <div className="kod-side-actions">
          <button className="db-btn" aria-label="Importer des fichiers" title="Importer des fichiers dans le projet (ou glisse-les dans la fenêtre)" onClick={() => fileInputRef.current?.click()}>
            ⬆️ Importer
          </button>
          <button className="db-btn" onClick={() => setNewItem({ parentId: null, kind: 'file', value: '' })} title="Nouveau fichier à la racine">
            📄 Nouveau fichier
          </button>
          <button className="db-btn" onClick={() => setNewItem({ parentId: null, kind: 'dir', value: '' })} title="Nouveau dossier à la racine">
            📁 Nouveau dossier
          </button>
          <button className="db-btn" title="Exporter tout le projet en ZIP" onClick={() => void exportZip()}>
            📦 Export ZIP
          </button>
          <button className="db-btn" title="Importer un projet depuis un fichier ZIP" onClick={() => zipInputRef.current?.click()}>
            ⇧ Import ZIP
          </button>
        </div>
        <div className="kod-side-actions">
          <button className="db-btn" onClick={() => void openDirPicker()} title="Ouvrir un dossier réel du disque (File System Access)">
            🗂 Ouvrir un dossier…
          </button>
          <button className="db-btn" onClick={() => void openFilePicker()} title="Ouvrir un fichier réel du disque">
            📂 Ouvrir un fichier…
          </button>
          <button className="db-btn" aria-label="Modèles de fichiers" title="Créer un fichier depuis un modèle (langages, projet, docs)" onClick={() => setTplOpen((o) => !o)}>
            📋 Modèles
          </button>
          <button className="db-btn" aria-label="Git local" title="Mini-git 100 % local : commits, branches, diff, restauration" onClick={() => void openGit()}>
            🌿 Git local
          </button>
          <button className="db-btn" aria-label="Mes extraits" title="Gérer mes extraits (snippets) personnels + partage JSON" onClick={() => setSnipOpen((o) => !o)}>
            ✂️ Extraits
          </button>
          <button className="db-btn" onClick={() => setGOpen(true)} title="Rechercher dans tous les fichiers (Ctrl+Shift+F)">
            🔎 Tout chercher
          </button>
        </div>
        <div className="kod-tree">
          <div className="kod-tree-head">📁 Mon projet (local)</div>
          {newItem?.parentId === null && (
            <div className="kod-row new" style={{ paddingLeft: 8 }}>
              <span className="kod-row-ico">{newItem.kind === 'dir' ? '📁' : '📄'}</span>
              <input
                className="kod-rename"
                autoFocus
                placeholder={newItem.kind === 'dir' ? 'nom du dossier' : 'nom du fichier'}
                value={newItem.value}
                onChange={(e) => setNewItem({ ...newItem, value: e.target.value })}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') void createItem()
                  if (e.key === 'Escape') setNewItem(null)
                }}
                onBlur={() => void createItem()}
              />
            </div>
          )}
          {childrenOf(null).map((n) => renderNode(n, 0))}
          {nodes.length === 0 && <div className="kod-empty">Projet vide — crée un fichier 📄</div>}
          {dirHandle && (
            <>
              <div className="kod-tree-head" title="Dossier réel du disque">
                🗂 {dirHandle.name} (disque)
                <button className="db-btn kod-rescan" title="Actualiser depuis le disque" onClick={() => void rescanDisk()}>
                  ⟳
                </button>
              </div>
              {extChanged.length > 0 && (
                <div className="kod-extwarn">
                  <span>⚠ {extChanged.length} modifié(s) sur le disque</span>
                  <button className="db-btn" onClick={() => void reloadDisk()}>Recharger</button>
                </div>
              )}
              <div className="kod-row dir" style={{ paddingLeft: 8 }} onClick={() => toggleDir('root:' + dirHandle.name)}>
                <span className="kod-row-ico">{ui.expanded.includes('root:' + dirHandle.name) ? '📂' : '📁'}</span>
                <span className="kod-row-name">{dirHandle.name}</span>
              </div>
              {ui.expanded.includes('root:' + dirHandle.name) && realTree.map((e) => renderReal(e, 1))}
            </>
          )}
        </div>
        {gOpen && (
          <div className="kod-gsearch" data-pop="kglob">
            <input
              autoFocus
              placeholder="Rechercher dans les fichiers…"
              value={gQ}
              onChange={(e) => {
                setGQ(e.target.value)
                void runGlobalSearch()
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') void runGlobalSearch()
              }}
            />
            <div className="kod-gcount">
              <button className={`db-btn${gRe ? ' active' : ''}`} title="Expression régulière (.*)" aria-label="Recherche regex" onClick={() => { setGRe((v) => !v); void runGlobalSearch(!gRe) }}>
                .*
              </button>
              {gBusy ? '…' : `${gResults.length} résultat(s)`}
            </div>
            {gResults.length > 0 && (
              <div className="kod-grepl">
                <input placeholder="Remplacer par…" value={gReplQ} onChange={(e) => setGReplQ(e.target.value)} />
                <button className="db-btn" onClick={() => void replaceAllProject()}>
                  Tout remplacer ({gResults.length})
                </button>
              </div>
            )}
            <div className="kod-gresults">
              {gResults.map((r, i) => (
                <button key={i} className="kod-gres" onClick={() => jumpTo(r)}>
                  <span className="kod-gres-name">{r.path}</span>
                  <span className="kod-gres-line">L{r.line} · {r.text}</span>
                </button>
              ))}
            </div>
          </div>
        )}
        {tplOpen && (
          <div className="kod-tpl" data-pop="ktpl">
            {templateGroups().map((g) => (
              <div key={g}>
                <div className="kod-tree-head">{g}</div>
                {KOD_TEMPLATES.filter((t) => t.group === g).map((t) => (
                  <button key={t.label} className="kod-tpl-item" onClick={() => void createFromTemplate(t)}>
                    <span>{t.icon}</span>
                    <span className="kod-tpl-label">{t.label}</span>
                    <span className="kod-tpl-path">{t.path}</span>
                  </button>
                ))}
              </div>
            ))}
          </div>
        )}
        {gitOpen && (
          <div className="kod-gsearch kod-git" data-pop="kgit">
            <div className="kod-panel-head">🌿 Git local — {projects.find((p) => p.id === pid)?.name}</div>
            <div className="kod-git-actions">
              <input placeholder="Message du commit…" value={gitMsg} onChange={(e) => setGitMsg(e.target.value)} />
              <button className="db-btn" onClick={() => void commitCurrent()}>Commit fichier</button>
              <button className="db-btn" onClick={() => void commitProject()}>Commit projet</button>
            </div>
            <div className="kod-git-actions">
              <input placeholder="Nouvelle branche…" value={newBranch} onChange={(e) => setNewBranch(e.target.value)} />
              <button className="db-btn" onClick={() => void createBranch()}>Créer</button>
              <span className="kod-git-branch">🌿 {curBranch}</span>
            </div>
            {branches.length > 0 && (
              <div className="kod-git-branches">
                {branches.map((b) => (
                  <button
                    key={b.name}
                    className={`kod-gres${b.name === curBranch ? ' active' : ''}`}
                    onClick={async () => {
                      await saveKV('branch:' + pid, b.name)
                      setCurBranch(b.name)
                    }}
                  >
                    🌿 {b.name}
                  </button>
                ))}
              </div>
            )}
            <div className="kod-gresults">
              {commits.map((c) => (
                <div key={c.id} className="kod-commit">
                  <div className="kod-commit-head">
                    <strong>{c.message}</strong>
                    {c.branch && <span className="kod-commit-branch">🌿 {c.branch}</span>}
                    <span className="kod-commit-meta">
                      {c.scope === 'project' ? `projet (${Object.keys(c.files).length} f.)` : c.fileName} · {new Date(c.at).toLocaleString('fr-FR')}
                    </span>
                  </div>
                  <div className="kod-commit-actions">
                    <button className="db-btn" onClick={() => diffCommit(c)}>Comparer</button>
                    <button className="db-btn" onClick={() => void restoreCommit(c)}>Restaurer</button>
                    <button
                      className="db-btn"
                      onClick={async () => {
                        await deleteCommit(c.id)
                        setCommits(await listCommits(pid))
                      }}
                    >
                      ✕
                    </button>
                  </div>
                </div>
              ))}
              {commits.length === 0 && <div className="kod-pal-empty">Aucun commit local — tout reste dans le navigateur, aucun serveur</div>}
            </div>
          </div>
        )}
        {snipOpen && (
          <div className="kod-gsearch kod-snip" data-pop="ksnip">
            <div className="kod-panel-head">✂️ Mes extraits ({snips.length})</div>
            <div className="kod-git-actions">
              <select value={snipLang} onChange={(e) => setSnipLang(e.target.value)}>
                {['javascript', 'typescript', 'html', 'css', 'markdown', 'python'].map((l) => (
                  <option key={l} value={l}>{l}</option>
                ))}
              </select>
              <input placeholder="Libellé" value={snipLabel} onChange={(e) => setSnipLabel(e.target.value)} />
            </div>
            <textarea className="kod-snip-body" rows={4} placeholder="Corps de l'extrait ($0 = position du curseur)" value={snipBody} onChange={(e) => setSnipBody(e.target.value)} />
            <div className="kod-git-actions">
              <button className="db-btn" onClick={() => void addSnippet()}>Ajouter</button>
              <button className="db-btn" onClick={exportSnippets}>⇩ Exporter JSON</button>
              <button className="db-btn" onClick={() => snipInputRef.current?.click()}>⇧ Importer JSON</button>
            </div>
            <div className="kod-gresults">
              {snips.map((s, i) => (
                <div key={i} className="kod-commit">
                  <div className="kod-commit-head">
                    <strong>{s.label}</strong>
                    <span className="kod-commit-meta">{s.lang}</span>
                  </div>
                  <div className="kod-commit-actions">
                    <button className="db-btn" onClick={() => insertText(s.body)}>Insérer</button>
                    <button
                      className="db-btn"
                      onClick={async () => {
                        const next = snips.filter((_, j) => j !== i)
                        setSnips(next)
                        await saveSnippets(next)
                      }}
                    >
                      ✕
                    </button>
                  </div>
                </div>
              ))}
              {snips.length === 0 && <div className="kod-pal-empty">Aucun extrait perso — exporte/importe en JSON pour les partager</div>}
            </div>
          </div>
        )}
        <input ref={fileInputRef} type="file" multiple hidden onChange={onFilesPicked} />
        <input
          ref={zipInputRef}
          type="file"
          accept=".zip,application/zip"
          hidden
          onChange={(e) => {
            const f = e.target.files?.[0]
            e.target.value = ''
            if (f) void importZip(f)
          }}
        />
        <input
          ref={snipInputRef}
          type="file"
          accept=".json,application/json"
          hidden
          onChange={(e) => {
            const f = e.target.files?.[0]
            e.target.value = ''
            if (f) void importSnippets(f)
          }}
        />
    </>
  )
}
