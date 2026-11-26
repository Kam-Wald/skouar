import { useRef } from 'react'
import type * as React from 'react'
import { useKod } from '../ctx'
import { highlight, langOf } from '../highlight'
import { renderPreview } from '../preview'
import { fileGlyph, isImageName } from '../lib'

export default function EditorPane() {
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

  if (!ui || !nodes || !active) return null

  return (
    <>
            <div
              className={`kod-body${preview && (lang === 'markdown' || lang === 'html' || isSvgActive) ? ' split' : ''}${splitId ? ' has-split' : ''}`}
              onDragOver={(e) => {
                if (e.dataTransfer.types.includes('text/kod-tab')) {
                  const r = e.currentTarget.getBoundingClientRect()
                  if (e.clientX > r.right - 140) {
                    e.preventDefault()
                    setDropZone(true)
                  }
                }
              }}
              onDragLeave={() => setDropZone(false)}
              onDrop={(e) => {
                const id = e.dataTransfer.getData('text/kod-tab')
                if (id) {
                  e.preventDefault()
                  setSplitId(id)
                  setDropZone(false)
                }
              }}
            >
              {dropZone && <div className="kod-dropzone">Déposer « {dragTab ? nodeName(dragTab) : ''} » à droite ➡</div>}
              <div className="kod-gutter" ref={gutterRef}>
                <div className="kod-ghead">
                  <button title="Replier tous les blocs" onClick={foldAll}>⤓</button>
                  <button title="Déplier tous les blocs" onClick={unfoldAll}>⤒</button>
                </div>
                {lines.map((_, i) => (
                  <div
                    key={i}
                    className={`kod-gline${foldable.has(i) ? ' foldable' : ''}${foldedStarts.has(i) ? ' folded' : ''}${bms.includes(i) ? ' bm' : ''}`}
                    onClick={() => (foldable.has(i) ? toggleFold(i) : toggleBm(i))}
                    title={foldable.has(i) ? 'Clic : replier/déplier ce bloc' : 'Clic : poser/retirer un signet 🔖'}
                  >
                    <span className="kod-garrow">{foldedStarts.has(i) ? '▸' : foldable.has(i) ? '▾' : ''}</span>
                    <span className="kod-gnum">{i + 1}</span>
                    {bms.includes(i) && <span className="kod-gbm">🔖</span>}
                  </div>
                ))}
              </div>
              {isImgActive && content.startsWith('data:') ? (
                <div className="kod-imgprev">
                  <img src={content} alt={activeName} />
                  <div className="kod-imgprev-name">{activeName} — aperçu image</div>
                </div>
              ) : (
              <div className="kod-edwrap">
              <div className={`kod-ed${ui.wrap ? ' wrap' : ''}`}>
                <pre className="kod-hl" ref={hlRef} aria-hidden>
                  <code dangerouslySetInnerHTML={{ __html: highlight(content, lang) + '\n' }} />
                </pre>
                <textarea
                  ref={taRef}
                  className={`kod-ta${ui.wrap ? ' wrap' : ''}`}
                  wrap={ui.wrap ? 'soft' : 'off'}
                  spellCheck={false}
                  value={content}
                  style={{ tabSize: ui.tabSize }}
                  onChange={(e) => {
                    setBuffers((prev) => ({ ...prev, [active]: { ...prev[active], content: e.target.value, dirty: true } }))
                    updateLineCol()
                  }}
                  onScroll={syncScroll}
                  onSelect={updateLineCol}
                  onKeyUp={updateLineCol}
                  onClick={(e) => {
                    const ta = taRef.current
                    if ((e.ctrlKey || e.metaKey) && ta) {
                      doGoToDef()
                      return
                    }
                    if (e.altKey && ta) {
                      const off = ta.selectionStart
                      const lc = offToLC(ta.value, off)
                      setRect({ aLine: lc.line - 1, aCol: lc.col, line: lc.line - 1, col: lc.col })
                    } else {
                      setRect(null)
                    }
                    updateLineCol()
                  }}
                  onKeyDown={onTaKeyDown}
                />
                {pair && (
                  <>
                    <div className="kod-bracket" style={{ left: 14 + pair.a.col * charW, top: 10 + pair.a.line * (ui.fontSize * 1.55) }} />
                    <div className="kod-bracket" style={{ left: 14 + pair.b.col * charW, top: 10 + pair.b.line * (ui.fontSize * 1.55) }} />
                  </>
                )}
                {rect &&
                  (() => {
                    const l0 = Math.min(rect.aLine, rect.line)
                    const l1 = Math.max(rect.aLine, rect.line)
                    const c0 = Math.min(rect.aCol, rect.col)
                    const c1 = Math.max(rect.aCol, rect.col)
                    const lh = ui.fontSize * 1.55
                    const out: React.ReactNode[] = []
                    for (let i = l0; i <= l1; i++) {
                      const len = Math.max(c1, lines[i]?.length ?? 0) - c0
                      out.push(
                        <div key={i} className="kod-rect" style={{ left: 14 + c0 * charW, top: 10 + i * lh, width: Math.max(2, len * charW), height: lh }} />
                      )
                    }
                    return out
                  })()}
                {findOpen && (
                  <div className="kod-find" data-pop="kfind">
                    <input
                      autoFocus
                      placeholder="Rechercher…"
                      value={findQ}
                      onChange={(e) => setFindQ(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') goMatch(e.shiftKey ? -1 : 1)
                        if (e.key === 'Escape') setFindOpen(false)
                      }}
                    />
                    {replOpen && (
                      <>
                        <input className="kod-repl" placeholder="Remplacer par…" value={replQ} onChange={(e) => setReplQ(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') replaceCurrent() }} />
                        <button className="db-btn" title="Remplacer l’occurrence courante" onClick={() => replaceCurrent()}>⇄</button>
                        <button className="db-btn" title="Tout remplacer dans ce fichier" onClick={() => replaceAllFile()}>Tout ⇄</button>
                      </>
                    )}
                    <button className={`db-btn${findRe ? ' active' : ''}`} title="Recherche par expression régulière (.*)" aria-label="Regex" onClick={() => setFindRe((v) => !v)}>
                      .*
                    </button>
                    <span className="kod-find-count">{matches.length ? `${Math.min(findIdx + 1, matches.length)}/${matches.length}` : '0'}</span>
                    <button className="db-btn" title="Précédent (Maj+Entrée)" onClick={() => goMatch(-1)}>
                      ↑
                    </button>
                    <button className="db-btn" title="Suivant (Entrée)" onClick={() => goMatch(1)}>
                      ↓
                    </button>
                    <button className="db-btn" title="Afficher le remplacement (Ctrl+H)" aria-label="Remplacer" onClick={() => setReplOpen((o) => !o)}>⇄</button>
                    <button className="db-btn" title="Fermer" onClick={() => setFindOpen(false)}>
                      ✕
                    </button>
                  </div>
                )}
              </div>
              {mini && lang !== 'text' && (
                <div className="kod-minimap" ref={miniRef} onClick={miniJump} aria-hidden>
                  <div className="kod-minimap-inner" style={{ width: 440 }} dangerouslySetInnerHTML={{ __html: highlight(content, lang) + '\n' }} />
                </div>
              )}
              </div>
              )}
              {splitId && splitId !== active && (
                <MiniEditor
                  id={splitId}
                  name={nodeName(splitId)}
                  lang={langOf(nodeName(splitId))}
                  content={buffers[splitId]?.content ?? ''}
                  dirty={!!buffers[splitId]?.dirty}
                  onChange={(c) => setBuf(splitId, c)}
                  onSave={() => void saveActive(splitId)}
                  onClose={() => setSplitId(null)}
                />
              )}
              {preview && (lang === 'markdown' || lang === 'html' || isSvgActive) && (
                <div className="kod-preview" dangerouslySetInnerHTML={{ __html: renderPreview(content, isSvgActive ? 'svg' : lang) }} />
              )}
            </div>
            <div className="kod-status">
              <span>
                Ln {lineCol.line}, Col {lineCol.col}
              </span>
              <span>{lang}</span>
              <span>UTF-8</span>
              <span>espaces : {ui.tabSize}</span>
              <span className={buf?.dirty ? 'dirty' : ''}>{buf?.dirty ? '● modifié' : '✓ enregistré'}</span>
              {savedAt && <span className="saved-time">{new Date(savedAt).toLocaleTimeString('fr-FR')}</span>}
            </div>
    </>
  )
}

function MiniEditor(props: {
  id: string
  name: string
  lang: string
  content: string
  dirty: boolean
  onChange: (c: string) => void
  onSave: () => void
  onClose: () => void
}) {
  const taRef = useRef<HTMLTextAreaElement | null>(null)
  const hlRef = useRef<HTMLPreElement | null>(null)
  const gutRef = useRef<HTMLDivElement | null>(null)
  const isImg = isImageName(props.name)
  const sync = (): void => {
    const ta = taRef.current
    if (!ta) return
    if (hlRef.current) {
      hlRef.current.scrollTop = ta.scrollTop
      hlRef.current.scrollLeft = ta.scrollLeft
    }
    if (gutRef.current) gutRef.current.scrollTop = ta.scrollTop
  }
  const lines = props.content.split('\n')
  return (
    <div className="kod-edwrap split-pane">
      <div className="kod-split-head">
        <span className="kod-tab-ico">{fileGlyph(props.name)}</span>
        <span className="kod-tab-name">{props.name}</span>
        {props.dirty && <span className="kod-dot">●</span>}
        <button className="db-btn" title="Enregistrer (Ctrl+S)" onClick={props.onSave}>
          💾
        </button>
        <button className="db-btn" title="Fermer le volet droit" onClick={props.onClose}>
          ✕
        </button>
      </div>
      {isImg && props.content.startsWith('data:') ? (
        <div className="kod-imgprev">
          <img src={props.content} alt={props.name} />
        </div>
      ) : (
        <div className="kod-split-body">
          <div className="kod-gutter" ref={gutRef} aria-hidden>
            {lines.map((_, i) => (
              <div key={i} className="kod-gline">
                <span className="kod-garrow" />
                <span className="kod-gnum">{i + 1}</span>
              </div>
            ))}
          </div>
          <div className="kod-edwrap mini-ed">
            <div className="kod-ed">
              <pre className="kod-hl" ref={hlRef} aria-hidden>
                <code dangerouslySetInnerHTML={{ __html: highlight(props.content, props.lang) + '\n' }} />
              </pre>
              <textarea
                ref={taRef}
                className="kod-ta"
                wrap="off"
                spellCheck={false}
                value={props.content}
                onChange={(e) => props.onChange(e.target.value)}
                onScroll={sync}
                onKeyDown={(e) => {
                  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
                    e.preventDefault()
                    props.onSave()
                  }
                }}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
