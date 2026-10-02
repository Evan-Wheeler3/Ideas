# ShotBoard: Architecture (simplified)

**Date:** 2026-10-02 · **Status:** approved, with direction to keep it simple

ShotBoard is a **storyboard and shot list tool** with a simple 3D stage. You place blocky figures and props, frame them with a real lens, and save each frame as a shot. Then you export a shot list PDF, stills, or an MP4 animatic. It aims for storyboard-level previs, not animation software.

## Guiding rule

**When a feature is unclear, choose the simpler version.** The shot list is the product. The 3D view exists to make frames for it.

## Decisions

| Topic | Decision |
|---|---|
| App shell | **Electron**. It looks and renders the same on Mac, Windows and Linux. |
| Shots | **Each shot is its own frame.** It holds its own copy of the scene, so moving a table in shot 2 does not change shot 1. "New shot" copies the current one. |
| Project file | **One file**, `MyFilm.shotboard`. Under the hood it's a zip holding `project.json`, thumbnails and imported models. Autosave keeps a copy in the app's own data folder for crash recovery. The previous save is kept as `.bak`. |
| Mannequin | **A blocky figure built in code.** It has pose presets (stand, sit, walk, run, point) and its head, arms and legs can be rotated with the normal rotate tool. No IK. |
| Panels | Fixed layout with draggable dividers. No floating or tabbed docking. |
| Shot list | **Configurable**: custom columns, show/hide/reorder columns, list view or storyboard grid view. |
| Export | A small Python (FastAPI) helper makes the PDF and MP4. The app works without it, and only export is disabled. |

## Stack

Electron + electron-vite · React 19 + TypeScript · three.js + react-three-fiber + drei · @react-three/postprocessing (SSAO, depth of field) · Zustand + Immer with command-based undo/redo · react-resizable-panels · JSZip · Python 3.11 FastAPI + ReportLab + Pillow + ffmpeg.

## Layout

```
┌──────────────────────────────────────────────────────────────┐
│ ShotBoard   Diner Scene ●     [Editor | Camera]  ▶   Export  │
├──────────┬────────────────────────────────────┬──────────────┤
│ Scene    │                                    │ Properties   │
│ (list)   │            Viewport                │ (selected    │
│──────────│                                    │  object or   │
│ Add      │                                    │  camera/lens)│
│ (library)│                                    │              │
├──────────┴────────────────────────────────────┴──────────────┤
│ Shots: [grid | list]  ▢ 1  ▢ 2  ▢ 3  + New shot              │
├──────────────────────────────────────────────────────────────┤
│ Timeline (camera keys for the current shot)                  │
└──────────────────────────────────────────────────────────────┘
```

## Data model

Units: meters, Y is up, seconds. Rotations are stored as Euler angles in degrees (`[x, y, z]`), which are easy to read and edit at storyboard level.

```ts
interface Project {
  schemaVersion: 1;
  title: string;
  meta: { production?: string; director?: string; dp?: string };
  settings: {
    fps: number;                 // 24
    aspect: '1.78' | '1.85' | '2.39' | '1.33' | '9:16';
    exportWidth: number;         // 1920 (height derived from aspect)
  };
  shotColumns: ColumnDef[];      // configurable shot list
  shots: Shot[];                 // order = shot list order
  assets: Record<string, AssetRef>; // imported .glb files inside the project zip
}

interface ColumnDef {
  id: string;                    // built-in: 'number','thumb','type','lens','duration','notes'
  label: string;
  kind: 'builtin' | 'text' | 'longtext' | 'select' | 'number';
  options?: string[];            // for 'select'
  visible: boolean;
  width?: number;
}

interface Shot {
  id: string;
  number: string;                // auto "1", "2"... editable ("12A")
  numberLocked: boolean;         // true once the user typed their own number
  type: 'WS' | 'FS' | 'MS' | 'MCU' | 'CU' | 'ECU' | 'OTS' | 'POV' | 'INSERT' | 'OTHER';
  duration: number;              // seconds
  notes: string;
  fields: Record<string, string | number>; // values for custom columns
  scene: Scene;
  camera: Camera;
  keys: CameraKey[];             // empty = static shot
  shake: { intensity: number; seed: number }; // handheld, deterministic
}

interface Scene {
  objects: SceneObject[];
  environment: {
    preset: 'studio' | 'day' | 'overcast' | 'sunset' | 'night' | 'stage';
    background: 'sky' | 'color';
    color: string;
    exposure: number;            // stops (EV)
  };
  lightingPreset: 'none' | 'golden' | 'overcast' | 'night' | 'threepoint';
}

interface SceneObject {
  id: string;
  name: string;
  kind: 'box' | 'sphere' | 'cylinder' | 'plane' | 'cone' | 'prop' | 'mannequin' | 'model' | 'light';
  propId?: 'chair' | 'table' | 'sofa' | 'bed' | 'counter' | 'floorLamp' | 'wall' | 'door' | 'window' | 'car' | 'tree' | 'stairs';
  visible: boolean;
  position: [number, number, number];
  rotation: [number, number, number];   // degrees
  scale: [number, number, number];
  color: string;
  pose?: Pose;                           // mannequin only
  assetId?: string;                      // model only
  light?: { type: 'directional' | 'point' | 'spot' | 'area'; intensity: number; kelvin: number; color: string; shadows: boolean; angle?: number };
  fromPreset?: string;                   // lights added by a lighting preset (replaced by the next one)
}

interface Pose {                          // mannequin joint rotations, degrees
  preset: 'stand' | 'sit' | 'walk' | 'run' | 'point' | 'custom';
  hipsY: number;                          // raise/lower the hips in metres (sitting)
  joints: Partial<Record<'head'|'torso'|'armL'|'armR'|'forearmL'|'forearmR'|'legL'|'legR'|'shinL'|'shinR', [number, number, number]>>;
}

interface Camera {
  position: [number, number, number];
  rotation: [number, number, number];   // degrees, YXZ order (pan, tilt, roll)
  focalLength: number;                  // mm
  sensor: 'super35' | 'fullframe' | 'alexa65' | 'iphone';
  aperture: number;                     // f-stop
  focusDistance: number;                // m
  dof: boolean;
}

interface CameraKey {
  id: string;
  t: number;                            // seconds
  position: [number, number, number];
  rotation: [number, number, number];
  focalLength: number;
  focusDistance: number;
  ease: 'linear' | 'easeIn' | 'easeOut' | 'easeInOut'; // preset bezier curves
}
```

### Lens math (`src/camera/lens.ts`)

- Sensors in mm: Super 35 = 24.89 × 18.66, Full Frame = 36 × 24, Alexa 65 = 54.12 × 25.58, iPhone = 9.8 × 7.3.
- The sensor is cropped to the project aspect ratio, and FOV = `2·atan(size / 2f)`. Example: 35 mm on Full Frame at 2.39 gives 54.4° horizontal.
- Depth of field: the blur strength comes from focal length, f-stop and focus distance (thin-lens blur-circle formula), and is passed to the depth-of-field effect.
- The editor view draws the shot camera with its view cone.

### Undo and redo

Every change to the project goes through a command (`do` / `undo` / `label`). A gizmo drag creates one command when you release. Slider changes made close together merge into one.

### Camera moves

Preset buttons add keys from the current camera: dolly, pan, tilt, crane, orbit, push-in. Handheld shake is a simple seeded wobble, so the preview and the export match.

## Export

The app renders every exported picture itself, in a hidden canvas through each shot's camera (moves and handheld shake included), so exports match what you framed. `src/export/FrameRenderer.tsx` renders frames, and `src/export/exporters.ts` runs the three exports:

| Export | Done by | Output |
|---|---|---|
| Shot list PDF | App renders one frame per shot; helper lays out the PDF (ReportLab) | Storyboard sheet (3×2 panels per page) or a table, using the visible columns |
| Stills | App only (no helper needed) | ZIP with one PNG per shot, HD or 4K |
| Animatic MP4 | App renders every frame and uploads it; helper burns in shot info (Pillow) and encodes H.264 (ffmpeg) | MP4 at the project frame rate, 960/1280/1920 wide |

### Export helper (Python, `/server`)

FastAPI on `127.0.0.1` only. Every request needs the `X-ShotBoard-Token` header.

- `GET /health`: version and whether ffmpeg was found
- `POST /pdf`: shot list JSON (with base64 pictures) in, PDF out
- `POST /animatic`: start a job (`fps`, size, burn-in, shots with frame counts)
- `PUT /animatic/{id}/frames/{n}`: upload frame *n* (JPEG)
- `POST /animatic/{id}/finish`: burn-in and encode in the background
- `GET /jobs/{id}`: state and progress. `GET /jobs/{id}/file` returns the MP4. `DELETE /jobs/{id}` cancels the job and removes its temp files.

The desktop app starts the helper itself (`electron/main/sidecar.ts`). It uses `server/.venv` if setup created it, picks a free port and a random token, waits for the `SHOTBOARD_READY` line, and restarts the helper if it crashes (up to 3 times). It stops the helper on quit. In the browser build, `npm run server` runs it on port 8765 with the token `dev`. If the helper isn't available, the app still works: PDF and MP4 export are disabled, with an explanation.

## Folders

```
shotboard/
  electron/      main process (files, autosave, starting the export helper) + preload
  src/
    components/  panels and UI
    scene/       3D viewport, objects, mannequin, camera, lights
    store/       Zustand store + history
    commands/    undoable commands
    camera/      lens math, keyframe interpolation, moves
    shared/      project types + defaults
  src/export/    frame renderer and the three exports
  src/persist/   .shotboard file format, save/open, autosave
  src/platform/  desktop (Electron IPC) vs browser differences
  server/        Python export helper (FastAPI, ReportLab, Pillow, ffmpeg) + pytest tests
  assets/        sample props and textures
  samples/       sample project
  scripts/       setup scripts
```

## Milestones

Each milestone must pass type checking and tests, and run in a browser smoke test with a screenshot, before the next one starts.

1. **Viewport and gizmos.** Layout, dark theme, orbit camera, grid, add/select/move/rotate/scale objects with snapping, scene list, properties panel, undo/redo, shortcuts.
2. **Lens and camera view.** Shot camera, lens and sensor settings, editor/camera toggle, framing guides (thirds, safe areas, aspect mask), view cone, depth of field, mannequin with poses, .glb import.
3. **Shots and saving.** Shot list (grid and list, configurable columns, drag to reorder, duplicate, delete), auto-thumbnails, save/open `.shotboard`, autosave, sample project.
4. **Keyframes and timeline.** Camera keys with easing, preset moves, handheld shake, timeline scrub and playback, play the whole sequence as an animatic.
5. **Lighting and polish.** Four light types with Kelvin color, lighting presets, environment presets, soft shadows, SSAO.
6. **Export.** PDF, PNG stills, MP4 animatic, setup scripts, README.

## Keyboard shortcuts

W / E / R move / rotate / scale · X snap on/off · C editor ↔ camera view · F frame selection · K add camera key · Space play · Ctrl+D duplicate · Del delete · Ctrl+Z / Ctrl+Shift+Z undo / redo · Ctrl+S save · N new shot

## Not in v1

IK posing, custom light shadow tricks, collaboration, FBX import, script import, code signing and auto-update.
