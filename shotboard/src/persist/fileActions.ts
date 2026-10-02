// New / Open / Save / Save As, autosave and crash recovery.
import { useEffect } from 'react'
import { isDirty } from '../commands/command'
import { makeBlankProject } from '../shared/defaults'
import { makeSampleProject } from '../shared/sample'
import type { Project } from '../shared/types'
import { platform, type FileRef } from '../platform'
import { assetData, putAsset } from '../store/assets'
import { useStore } from '../store/store'
import { useThumbs, type Thumb } from '../store/thumbs'
import { askConfirm, toast } from '../components/Dialogs'
import { ProjectFileError, deserializeProject, serializeProject, type ProjectBundle } from './projectFile'

// 30 s by default; `?autosaveMs=2000` in the URL shortens it (used by the smoke test).
export const AUTOSAVE_INTERVAL_MS = Number(new URLSearchParams(location.search).get('autosaveMs')) || 30_000

function currentBundle(): ProjectBundle {
  const { project } = useStore.getState()
  const assets: Record<string, ArrayBuffer> = {}
  for (const id of Object.keys(project.assets)) {
    const data = assetData(id)
    if (data) assets[id] = data
  }
  return { project, thumbs: useThumbs.getState().byShot, assets }
}

function applyBundle(bundle: ProjectBundle, file: FileRef, dirty = false): void {
  for (const [id, data] of Object.entries(bundle.assets)) putAsset(id, data)
  useThumbs.getState().replaceAll(bundle.thumbs)
  useStore.getState().loadProject(bundle.project, file, { dirty })
}

function loadFresh(project: Project, name: string): void {
  useThumbs.getState().replaceAll({})
  useStore.getState().loadProject(project, { path: null, name })
}

/** If there are unsaved changes, ask before throwing them away. */
async function okToDiscard(action: string): Promise<boolean> {
  if (!isDirty(useStore.getState().history)) return true
  return askConfirm({
    title: 'Unsaved changes',
    message: `You have unsaved changes. ${action} anyway and lose them?`,
    confirmLabel: `Discard and ${action.toLowerCase()}`,
    danger: true
  })
}

const errorText = (e: unknown) => (e instanceof ProjectFileError || e instanceof Error ? e.message : String(e))

export async function saveProject(saveAs = false): Promise<boolean> {
  const { file, markSaved } = useStore.getState()
  // Remember where history was when we started, in case the user keeps editing during the write.
  const pastLength = useStore.getState().history.past.length
  try {
    const data = await serializeProject(currentBundle())
    const saved = await platform.saveProject(data, file, saveAs || !file.path)
    if (!saved) return false
    if (useStore.getState().history.past.length === pastLength) markSaved(saved)
    else useStore.setState({ file: saved })
    await platform.clearAutosave().catch(() => {})
    toast(platform.kind === 'web' ? `Downloaded ${saved.name}.shotboard` : `Saved ${saved.name}`)
    return true
  } catch (e) {
    toast(`Couldn't save: ${errorText(e)}`, 'error')
    return false
  }
}

export async function openProject(): Promise<void> {
  if (!(await okToDiscard('Open'))) return
  try {
    const picked = await platform.openProject()
    if (!picked) return
    const bundle = await deserializeProject(picked.data)
    applyBundle(bundle, { path: picked.path, name: picked.name })
    toast(`Opened ${picked.name}`)
  } catch (e) {
    toast(`Couldn't open the project: ${errorText(e)}`, 'error')
  }
}

export async function newProject(): Promise<void> {
  if (!(await okToDiscard('Start a new project'))) return
  loadFresh(makeBlankProject(), 'Untitled')
}

export async function openSampleProject(): Promise<void> {
  if (!(await okToDiscard('Open the sample'))) return
  loadFresh(makeSampleProject(), 'Diner Scene')
}

/* ---------------- autosave & recovery ---------------- */

async function writeAutosave(): Promise<void> {
  const { file } = useStore.getState()
  const data = await serializeProject(currentBundle())
  await platform.writeAutosave(data, file)
}

/** On launch: if the last session left unsaved work behind, offer to bring it back. */
async function offerRecovery(): Promise<void> {
  const entry = await platform.readAutosave().catch(() => null)
  if (!entry) return
  const when = new Date(entry.savedAt).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })
  const recover = await askConfirm({
    title: 'Recover unsaved work?',
    message: `ShotBoard closed before "${entry.name}" was saved. An autosave from ${when} is available.`,
    confirmLabel: 'Recover',
    cancelLabel: 'Discard'
  })
  if (!recover) {
    await platform.clearAutosave()
    return
  }
  try {
    const bundle = await deserializeProject(entry.data)
    applyBundle(bundle, { path: entry.path, name: entry.name }, true)
    toast(`Recovered ${entry.name}. Save to keep it.`, 'info')
  } catch (e) {
    toast(`The autosave couldn't be read: ${errorText(e)}`, 'error')
  }
}

/** Autosave, recovery prompt, window title, and the "unsaved changes" guard on close. */
export function useProjectLifecycle(): void {
  useEffect(() => {
    void offerRecovery()
  }, [])

  // Autosave every 30 s while there are unsaved changes, only when something changed since last time.
  useEffect(() => {
    let lastSaved: Project | null = null
    let lastThumbs: Record<string, Thumb> | null = null
    const timer = setInterval(() => {
      const { project, history } = useStore.getState()
      const thumbs = useThumbs.getState().byShot
      if (!isDirty(history) || (project === lastSaved && thumbs === lastThumbs)) return
      lastSaved = project
      lastThumbs = thumbs
      writeAutosave().catch((e) => console.warn('Autosave failed', e))
    }, AUTOSAVE_INTERVAL_MS)
    return () => clearInterval(timer)
  }, [])

  // Window title: "Diner Scene • — ShotBoard" while there are unsaved changes.
  useEffect(() => {
    const update = () => {
      const { file, history } = useStore.getState()
      platform.setWindowTitle(`${file.name}${isDirty(history) ? ' •' : ''} — ShotBoard`)
    }
    update()
    return useStore.subscribe(update)
  }, [])

  useEffect(() => {
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (isDirty(useStore.getState().history)) e.preventDefault()
    }
    window.addEventListener('beforeunload', onBeforeUnload)
    return () => window.removeEventListener('beforeunload', onBeforeUnload)
  }, [])
}

/** Exposed for tests: write an autosave right now. */
export const autosaveNow = writeAutosave
