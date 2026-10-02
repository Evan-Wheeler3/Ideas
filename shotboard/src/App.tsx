import { Group, Panel, Separator } from 'react-resizable-panels'
import { Toolbar } from './components/Toolbar'
import { ScenePanel } from './components/ScenePanel'
import { AddPanel } from './components/AddPanel'
import { PropertiesPanel } from './components/PropertiesPanel'
import { ShotsPanel } from './components/ShotsPanel'
import { DialogHost } from './components/Dialogs'
import { ThumbnailRenderer } from './scene/ThumbnailRenderer'
import { useProjectLifecycle } from './persist/fileActions'
import { Viewport } from './scene/Viewport'
import { ErrorBoundary } from './components/ErrorBoundary'
import { useKeyboardShortcuts } from './keymap'
import { useStore } from './store/store'

function StatusBar() {
  const count = useStore((s) => s.selection.length)
  const snap = useStore((s) => s.snap.enabled)
  const viewMode = useStore((s) => s.viewMode)
  return (
    <footer className="statusbar">
      <span>{count ? `${count} selected` : 'Nothing selected'}</span>
      <span>Snap {snap ? 'on' : 'off'}</span>
      <span>{viewMode === 'camera' ? 'Camera view' : 'Editor view'}</span>
      <span className="spacer" />
      <span className="dim">
        <kbd>N</kbd> new shot · <kbd>[</kbd> <kbd>]</kbd> prev/next shot · <kbd>C</kbd> camera view · <kbd>W</kbd> <kbd>E</kbd> <kbd>R</kbd> move/rotate/scale · <kbd>F</kbd> frame · <kbd>L</kbd> labels ·{' '}
        <kbd>X</kbd> snap · <kbd>Ctrl</kbd>+<kbd>D</kbd> duplicate · <kbd>Del</kbd> delete
      </span>
    </footer>
  )
}

export function App() {
  useKeyboardShortcuts()
  useProjectLifecycle()

  return (
    <div className="app">
      <Toolbar />
      <Group orientation="vertical" className="workspace" id="sb-v">
        <Panel minSize="40%">
          <Group orientation="horizontal" id="sb-h">
            <Panel defaultSize="250px" minSize="190px" maxSize="420px">
              <Group orientation="vertical" id="sb-left">
                <Panel defaultSize="48%" minSize="20%">
                  <ScenePanel />
                </Panel>
                <Separator className="resize-handle horizontal" />
                <Panel defaultSize="52%" minSize="15%">
                  <AddPanel />
                </Panel>
              </Group>
            </Panel>
            <Separator className="resize-handle vertical" />
            <Panel minSize="30%">
              <ErrorBoundary
                fallback={(e) => (
                  <div className="viewport viewport-error">
                    <strong>The 3D view couldn't start.</strong>
                    <span>
                      {/WebGL/i.test(e.message)
                        ? 'Your graphics driver may be outdated or 3D acceleration is turned off.'
                        : e.message}
                    </span>
                  </div>
                )}
              >
                <Viewport />
              </ErrorBoundary>
            </Panel>
            <Separator className="resize-handle vertical" />
            <Panel defaultSize="290px" minSize="230px" maxSize="460px">
              <PropertiesPanel />
            </Panel>
          </Group>
        </Panel>
        <Separator className="resize-handle horizontal" />
        <Panel defaultSize="236px" minSize="140px" maxSize="60%">
          <ShotsPanel />
        </Panel>
      </Group>
      <StatusBar />
      <ThumbnailRenderer />
      <DialogHost />
    </div>
  )
}
