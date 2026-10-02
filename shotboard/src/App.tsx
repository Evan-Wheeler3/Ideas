import { Group, Panel, Separator } from 'react-resizable-panels'
import { Toolbar } from './components/Toolbar'
import { ScenePanel } from './components/ScenePanel'
import { AddPanel } from './components/AddPanel'
import { PropertiesPanel } from './components/PropertiesPanel'
import { ShotStrip } from './components/ShotStrip'
import { Viewport } from './scene/Viewport'
import { ErrorBoundary } from './components/ErrorBoundary'
import { useKeyboardShortcuts } from './keymap'
import { useStore } from './store/store'

function StatusBar() {
  const count = useStore((s) => s.selection.length)
  const snap = useStore((s) => s.snap.enabled)
  return (
    <footer className="statusbar">
      <span>{count ? `${count} selected` : 'Nothing selected'}</span>
      <span>Snap {snap ? 'on' : 'off'}</span>
      <span className="spacer" />
      <span className="dim">
        <kbd>W</kbd> <kbd>E</kbd> <kbd>R</kbd> tools · <kbd>X</kbd> snap · <kbd>F</kbd> frame · <kbd>Ctrl</kbd>+<kbd>D</kbd> duplicate ·{' '}
        <kbd>Del</kbd> delete
      </span>
    </footer>
  )
}

export function App() {
  useKeyboardShortcuts()

  return (
    <div className="app">
      <Toolbar />
      <Group orientation="vertical" className="workspace" id="sb-v">
        <Panel minSize="40%">
          <Group orientation="horizontal" id="sb-h">
            <Panel defaultSize="250px" minSize="190px" maxSize="420px">
              <Group orientation="vertical" id="sb-left">
                <Panel defaultSize="65%" minSize="20%">
                  <ScenePanel />
                </Panel>
                <Separator className="resize-handle horizontal" />
                <Panel defaultSize="35%" minSize="15%">
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
        <Panel defaultSize="190px" minSize="120px" maxSize="50%">
          <ShotStrip />
        </Panel>
      </Group>
      <StatusBar />
    </div>
  )
}
