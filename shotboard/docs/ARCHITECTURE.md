# ShotBoard: Architecture and Data Schemas

**Status:** Draft for approval (milestone 0). No application code is written yet.
**Date:** 2026-10-02

ShotBoard is a desktop 3D previs and shot list tool for directors and DPs. You block a scene, set up a real lens, animate the camera, save each setup as a shot, and export a shot list PDF, stills, and an MP4 animatic.

---

## 1. Key decisions

| Decision | Choice | Why |
|---|---|---|
| Shell | **Electron** (not Tauri) | Every platform gets the same Chromium WebGL2 renderer, so shadows, SSAO, and DoF look the same everywhere. Tauri uses the OS webview (WebKitGTK on Linux, Safari on macOS), and WebGL quality and speed vary more between them. Starting and supervising the Python sidecar is easy in Node. |
| Build | **electron-vite** (Vite for main, preload, and renderer) | Fast hot reload, one config, TypeScript everywhere. |
| UI | React 18 + TypeScript (strict) | Matches the request. |
| 3D | three.js + @react-three/fiber + @react-three/drei | Matches the request. drei provides `TransformControls`, `Grid`, `Environment`, `useGLTF`, and `PerspectiveCamera`. |
| Post FX | `@react-three/postprocessing` (pmndrs `postprocessing`) + **N8AO** for SSAO | Effects are merged into fewer passes than three's `EffectComposer`. N8AO is the best-looking real-time AO available for three. |
| State | Zustand + Immer, **command pattern** for undo/redo | Only commands change the document, so every change can be undone and the dirty flag is always correct. |
| Panels | `dockview` (React) | Docked, resizable, tabbed, floating panels. The layout is saved per user. |
| Sidecar | Python 3.11 + FastAPI + Uvicorn, ReportLab, Pillow, ffmpeg | Matches the request. Bound to `127.0.0.1` only, with a per-launch token. |
| Mannequin | **Built in code** (a SkinnedMesh of capsules with a standard humanoid bone set) | No asset licensing issues, a known bone layout for IK and poses, and a small repo. Users can still load rigged .glb characters. |
| HDRIs | A few CC0 Poly Haven 1k/2k HDRIs, fetched by the setup script into `/assets/hdri`, plus a procedural `RoomEnvironment` fallback | drei's `preset` HDRIs load from a CDN at runtime. ShotBoard must work offline. |
| Project location | `/shotboard` folder in this repo (`/shotboard/src`, `/shotboard/server`, `/shotboard/assets`) | This repo already holds other ideas. Easy to move into its own repo later. |

---

## 2. Process model

```
┌──────────────────────────── Electron ────────────────────────────┐
│                                                                  │
│  Main process (Node)                                             │
│   • window + menu + native dialogs                               │
│   • project I/O (read/write project bundle, autosave, backups)   │
│   • sidecar supervisor: spawn, health-check, restart, kill       │
│   • frame sink: receives PNG frames from renderer → temp dir     │
│            ▲  typed IPC (contextBridge, no nodeIntegration)      │
│            │                                                     │
│  Preload  ─┴─ window.shotboard = { project, dialog, sidecar,     │
│                                    frames, app }                 │
│            │                                                     │
│  Renderer (React + R3F)                                          │
│   • Zustand store + command stack                                │
│   • Viewport (editor cam / shot cam), panels, timeline           │
│   • Offscreen render for thumbnails / PNG / animatic frames      │
└────────────┬─────────────────────────────────────────────────────┘
             │ HTTP 127.0.0.1:<random port>, header X-ShotBoard-Token
             ▼
┌────────────── Python sidecar (FastAPI) ──────────────┐
│  /health  /export/pdf  /export/stills                │
│  /export/animatic  /jobs/{id}  /jobs/{id}/cancel     │
│  ReportLab · Pillow · ffmpeg (system or imageio-ff)  │
└──────────────────────────────────────────────────────┘
```

**Sidecar lifecycle.** Main runs `python -m shotboard_server --port 0 --token <random>`. The server binds to a free port and prints `SHOTBOARD_READY {"port": 51234}` on stdout. Main reads that line, passes the URL and token to the renderer, polls `/health` every 10 s, and restarts the server up to 3 times if it crashes. The app works without the sidecar. Only the export menu items are disabled, with a tooltip that says why.

**Why the renderer makes the frames.** The scene, materials, and post FX exist only in the renderer, so the renderer draws each export frame offscreen at the export resolution. That way the export matches the viewport exactly. Frames go to main through IPC (`frames.write(jobDir, index, pngBytes)`). The sidecar then only has to assemble files on disk (PDF layout, image work, ffmpeg encode). It never has to render 3D.

---

## 3. Folder structure

```
shotboard/
├─ README.md
├─ package.json             electron-vite, scripts: dev, build, test, lint, typecheck
├─ electron.vite.config.ts
├─ scripts/
│  ├─ setup.sh / setup.ps1  npm ci, python venv, pip install, fetch HDRIs, check ffmpeg
│  └─ fetch-assets.mjs      downloads CC0 HDRIs with checksums
├─ electron/
│  ├─ main/                 index.ts, ipc.ts, project-io.ts, autosave.ts, sidecar.ts, menu.ts
│  └─ preload/index.ts      contextBridge API (types shared from src/shared/ipc.ts)
├─ src/
│  ├─ main.tsx, App.tsx
│  ├─ shared/               ipc.ts (IPC contract types), schema/ (document types + zod + migrations)
│  ├─ store/                document slice, ui slice, selection, playback, history (command stack)
│  ├─ commands/             one file per command family: entity, transform, light, camera, shot, keyframe
│  ├─ camera/               lens.ts (FOV/sensor/CoC/DoF), sensors.ts, framing.ts, interpolate.ts, moves.ts, shake.ts
│  ├─ scene/                SceneRoot, EntityRenderer, Mannequin/, lights/, ShotCamera, FovCone, Gizmos, PostFX, Environment
│  ├─ components/           panels (Outliner, Inspector, AssetBrowser, ShotList, Timeline, LensPanel, LightPanel), ui kit
│  ├─ render/               offscreen renderer, thumbnail queue, frame export
│  ├─ export/               sidecar client, export dialogs
│  ├─ keymap/               shortcut registry + defaults
│  └─ styles/               tokens.css (dark theme), panel styles
├─ server/
│  ├─ pyproject.toml        fastapi, uvicorn, reportlab, pillow, imageio-ffmpeg, pydantic v2
│  ├─ shotboard_server/     __main__.py, app.py, jobs.py, pdf.py, stills.py, animatic.py, models.py
│  └─ tests/
├─ assets/
│  ├─ hdri/                 (fetched) studio, sunset, overcast, night-city
│  ├─ props/                small CC0 .glb props + generated thumbnails
│  ├─ backdrops/            cyclorama, street, interior-room (.glb)
│  └─ poses/                pose library JSON (stand, sit, walk, run, point)
├─ samples/
│  └─ Diner-Scene.shotboard/   sample project bundle
└─ tests/                   vitest unit tests + playwright smoke (renderer in Chromium)
```

---

## 4. Data schemas

All document types live in `src/shared/schema/` as TypeScript types, with matching **zod** validators that check files on load. The sidecar has matching **pydantic** models that cover only the export payloads.

### 4.1 Units and conventions

- World units are **meters**. **Y is up**. Rotations are stored as **quaternions** `[x, y, z, w]`. Euler angles appear only in the inspector.
- Time is stored in **seconds** (float). The timeline displays and snaps to the project frame rate (24 fps by default).
- Colors are linear-sRGB hex strings in the document (`"#ffcc88"`). Light color temperature is a separate field.
- IDs are short random strings (`nanoid(10)`), prefixed by type: `ent_`, `shot_`, `kf_`, `ast_`.

### 4.2 Project file

A project is a **folder bundle**, `MyFilm.shotboard/`:

```
MyFilm.shotboard/
├─ project.json          the document (below)
├─ thumbs/<shotId>.png   auto-thumbnails (regenerable cache)
├─ assets/<assetId>.glb  imported models copied into the bundle (portable projects)
├─ versions/             rolling backups: project.<ISO-timestamp>.json (keep last 20)
└─ .autosave/project.json
```

```ts
// src/shared/schema/project.ts
export const SCHEMA_VERSION = 1;

export interface ProjectFile {
  schemaVersion: number;          // migrations run in order from file version → SCHEMA_VERSION
  app: { name: 'ShotBoard'; version: string };
  meta: {
    id: string;
    title: string;                // "Diner Scene"
    production?: string;
    director?: string;
    dp?: string;
    createdAt: string;            // ISO 8601
    modifiedAt: string;
  };
  settings: ProjectSettings;
  assets: Record<AssetId, AssetRef>;
  shots: Shot[];                  // ordered = shot list order
  activeShotId: ShotId | null;
}

export interface ProjectSettings {
  fps: 23.976 | 24 | 25 | 29.97 | 30 | 48 | 60;
  aspectRatio: AspectPreset;      // delivery aspect, drives masks + export size
  exportResolution: { width: number; height: number }; // e.g. 1920x804 for 2.39
  units: 'metric' | 'imperial';   // display only; storage is meters
  defaultSensor: SensorId;
}

export type AspectPreset = '1.33' | '1.66' | '1.78' | '1.85' | '2.00' | '2.39' | '2.76' | '9:16';
```

### 4.3 Shots and scene snapshots

Each shot owns a **full scene snapshot**. Selecting a shot loads its snapshot into the editor, and edits go to that shot. "New shot" copies the active shot. This matches how previs is done: blocking changes from shot to shot. A bulk command, **"Apply selection to shots…"**, pushes changes to set pieces across several shots when you need that. Snapshots share structure in memory (Immer), so 100 shots of the same set use little extra memory.

```ts
export interface Shot {
  id: ShotId;
  number: string;                 // "12A" — user-editable, auto-assigned on create/reorder if not locked
  numberLocked: boolean;
  name: string;
  shotType: ShotType;
  duration: number;               // seconds
  notes: string;                  // markdown-lite
  dialogue?: string;
  scene: SceneSnapshot;
  camera: ShotCamera;
  cameraTrack: CameraTrack;       // camera keyframes
  objectTracks: ObjectTrack[];    // optional object keyframes
  thumbnail?: { file: string; renderedAt: string; hash: string }; // hash of inputs → stale detection
  color?: string;                 // tag color in shot list
}

export type ShotType =
  | 'EWS' | 'WS' | 'FS' | 'MWS' | 'MS' | 'MCU' | 'CU' | 'ECU'
  | 'OTS' | 'POV' | 'TWO' | 'INSERT' | 'ESTABLISHING' | 'AERIAL' | 'CUSTOM';

export interface SceneSnapshot {
  entities: Record<EntityId, Entity>;
  rootOrder: EntityId[];          // outliner order of top-level entities
  environment: EnvironmentSettings;
  render: RenderSettings;
}

export interface EnvironmentSettings {
  hdri: string | null;            // asset path under /assets/hdri or null → procedural
  hdriIntensity: number;
  hdriRotation: number;           // radians around Y
  background: 'hdri' | 'color' | 'backdrop';
  backgroundColor: string;
  backgroundBlur: number;         // 0..1
  groundShadows: boolean;
  fog?: { color: string; near: number; far: number };
}

export interface RenderSettings {
  toneMapping: 'ACESFilmic' | 'AgX' | 'Neutral';
  exposure: number;               // EV offset
  ssao: { enabled: boolean; radius: number; intensity: number };
  shadows: { enabled: boolean; softness: number; mapSize: 1024 | 2048 | 4096 };
  dof: boolean;                   // master toggle (cost); lens settings drive the look
  bloom: { enabled: boolean; threshold: number; intensity: number };
}
```

### 4.4 Entities

```ts
interface EntityBase {
  id: EntityId;
  name: string;
  parentId: EntityId | null;
  transform: Transform;
  visible: boolean;
  locked: boolean;                // not selectable in viewport
  castShadow: boolean;
  receiveShadow: boolean;
}

export interface Transform {
  position: Vec3;                 // [x, y, z] meters
  rotation: Quat;                 // [x, y, z, w]
  scale: Vec3;
}

export type Entity =
  | (EntityBase & { kind: 'primitive'; shape: 'box'|'sphere'|'cylinder'|'cone'|'plane'|'capsule'; material: MaterialSpec })
  | (EntityBase & { kind: 'model'; assetId: AssetId; materialOverride?: MaterialSpec })
  | (EntityBase & { kind: 'mannequin'; pose: MannequinPose; build: 'male'|'female'|'neutral'|'child'; height: number; color: string })
  | (EntityBase & { kind: 'light'; light: LightSpec })
  | (EntityBase & { kind: 'marker'; label: string; color: string })  // actor marks, tape marks
  | (EntityBase & { kind: 'group' });

export interface MaterialSpec {
  color: string;
  roughness: number;              // 0..1
  metalness: number;              // 0..1
  emissive?: string;
  emissiveIntensity?: number;
  opacity?: number;
}

export interface AssetRef {
  id: AssetId;
  name: string;
  category: 'prop' | 'set' | 'backdrop' | 'character' | 'vehicle' | 'imported';
  source: 'builtin' | 'project';  // builtin → /assets/..., project → bundle/assets/...
  path: string;
  thumbnail?: string;
  bounds?: { min: Vec3; max: Vec3 };
}
```

### 4.5 Mannequin pose

The pose is stored as **local bone rotations** for a fixed humanoid skeleton. IK only helps you edit: dragging a hand or foot solves a two-bone IK chain and writes the resulting rotations back to the pose. The pose library entries use this same type.

```ts
export type HumanoidBone =
  | 'hips' | 'spine' | 'chest' | 'neck' | 'head'
  | 'shoulder_L' | 'upperArm_L' | 'forearm_L' | 'hand_L'
  | 'shoulder_R' | 'upperArm_R' | 'forearm_R' | 'hand_R'
  | 'thigh_L' | 'shin_L' | 'foot_L'
  | 'thigh_R' | 'shin_R' | 'foot_R';

export interface MannequinPose {
  presetId?: 'stand' | 'sit' | 'walk' | 'run' | 'point' | string; // provenance only
  hipsOffset: Vec3;               // root motion (e.g. sit lowers hips)
  bones: Partial<Record<HumanoidBone, Quat>>; // missing = rest pose
}
```

IK uses an analytic two-bone solver (shoulder→elbow→wrist, hip→knee→ankle). A **pole target** (the elbow or knee direction) keeps the joint bending the right way. There are joint limits for knees and elbows. A head **look-at** handle is included.

### 4.6 Lights

```ts
export interface LightSpec {
  type: 'directional' | 'point' | 'spot' | 'area';
  color: string;                  // tint; multiplied with temperature color
  useTemperature: boolean;
  temperatureK: number;           // 1000..12000, Kelvin → RGB (Tanner Helland approx.)
  intensity: number;              // physical units: lux (directional), candela (point/spot), nits (area)
  castShadow: boolean;
  shadowSoftness: number;         // maps to PCSS/VSM radius
  // type-specific
  distance?: number;              // point/spot, 0 = infinite
  decay?: number;                 // default 2 (physically correct)
  angle?: number;                 // spot cone, radians
  penumbra?: number;              // spot 0..1
  width?: number; height?: number;// area (RectAreaLight)
  target?: EntityId | null;       // aim at entity; otherwise uses rotation
}
```

Known limitation: three's `RectAreaLight` does not cast shadows. Area lights will add a matched **shadow-only spot light** you can turn off, labeled in the UI as "approximate shadow".

**Lighting presets** are commands that create or replace a group of lights named `Lighting: <preset>`, plus environment settings:

| Preset | Contents |
|---|---|
| Golden hour | Low sun (directional, 3200 K, elevation 8°), warm sky HDRI, orange rim |
| Overcast | Soft sky HDRI at high intensity, weak 6500 K directional with very soft shadows |
| Night | Moon (directional, 4100 K, low), blue ambient HDRI at low exposure, 2 practical point lights at 2700 K |
| 3-point | Key (spot, 45°), fill (area, opposite, −2 stops), back/rim (spot, behind), all aimed at the selected entity or the origin |

### 4.7 Camera and lens

```ts
export type SensorId = 'super35' | 'fullframe' | 'alexa65' | 'iphone' | 'custom';

export interface SensorSpec {           // src/camera/sensors.ts
  id: SensorId;
  label: string;
  width: number;                        // mm
  height: number;                       // mm
}
// Super 35 (ARRI 4-perf open gate ref) 24.89 × 18.66
// Full Frame 36.0 × 24.0
// Alexa 65 54.12 × 25.58
// iPhone (main wide, 1/1.28") 9.8 × 7.3  (≈ 24 mm equiv.)

export interface Lens {
  focalLength: number;                  // mm
  aperture: number;                     // f-number (T-stop treated as f-stop)
  focusDistance: number;                // meters
  sensor: SensorId;
  customSensor?: { width: number; height: number };
  anamorphicSqueeze?: 1 | 1.33 | 1.5 | 2; // affects horizontal FOV + oval bokeh (stretch goal)
}

export interface ShotCamera {
  transform: Transform;                 // base pose when cameraTrack is empty
  lens: Lens;
  focusTarget?: EntityId | null;        // rack/follow focus to an entity
  rig: 'tripod' | 'dolly' | 'crane' | 'handheld' | 'steadicam' | 'drone'; // label + preset defaults
}
```

**Camera math** (`src/camera/lens.ts`, unit tested):

- The sensor is fit to the delivery aspect. The *active* sensor area is the sensor cropped to `settings.aspectRatio` (width-fit or height-fit, whichever is smaller).
- Vertical FOV = `2 · atan(activeHeight / (2 · focalLength))`, applied to `PerspectiveCamera.fov`. We also set three's `filmGauge` and `setFocalLength` so the numbers in the UI match.
- Circle of confusion limit `c = sensorDiagonal / 1500` (Zeiss formula).
- Hyperfocal `H = f² / (N · c) + f`. Near and far DoF limits come from the standard thin-lens formulas. The lens panel shows them ("in focus: 2.1 m to 3.4 m").
- **Live bokeh.** The DoF effect gets `focusDistance` (m) and a **bokeh scale** taken from the physical blur-disc size. Blur diameter on the sensor is `b(d) = (f² / N) · |d − s| / (d · (s − f))`. Converted to pixels, `b(d) · (imageHeightPx / activeHeight)` drives the effect's max blur. Wide open on a long lens gives heavy bokeh, and a 24 mm at f/11 stays sharp, as on a real camera. We use pmndrs `DepthOfFieldEffect` (a gather-based bokeh) in M2. If it does not look good enough, we upgrade to a custom CoC-driven gather pass.
- **FOV cone.** In the editor view, the shot camera is drawn as a camera body plus a frustum wireframe out to the focus distance. A translucent plane marks the focus distance, and faint planes mark the near and far DoF limits.

**Framing guides** (an overlay layer in the shot camera view, drawn in screen space with CSS/SVG over the canvas so lines stay crisp):
- Aspect ratio mask (letterbox or pillarbox), with adjustable mask opacity
- Frame border, rule of thirds, center cross
- Action safe (93%) and title safe (90%) areas
- Optional extra frame line (for example, a 1.78 extraction inside 2.39)
- A HUD strip with focal length, f-stop, focus distance, sensor, shot number, and timecode

### 4.8 Keyframes and tracks

```ts
export interface CameraKey {
  id: KeyId;
  t: number;                            // seconds from shot start
  position: Vec3;
  rotation: Quat;
  focalLength: number;
  focusDistance: number;
  aperture?: number;                    // optional: animated iris
  easeOut: Bezier;                      // timing curve for segment (this key → next key)
  spatial: 'linear' | 'smooth';         // position path: linear or centripetal Catmull-Rom
}

export type Bezier = [x1: number, y1: number, x2: number, y2: number]; // CSS cubic-bezier, x in [0,1]
// presets: linear [0,0,1,1], easeInOut [0.42,0,0.58,1], easeIn, easeOut, hold (step)

export interface CameraTrack {
  keys: CameraKey[];                    // sorted by t
  shake?: ShakeLayer;                   // procedural, layered on top of keys
}

export interface ShakeLayer {
  enabled: boolean;
  amplitudePos: number;                 // meters
  amplitudeRot: number;                 // degrees
  frequency: number;                    // Hz
  seed: number;                         // deterministic → preview == export
}

export interface ObjectTrack {
  entityId: EntityId;
  keys: { id: KeyId; t: number; transform: Transform; easeOut: Bezier }[];
}
```

**Evaluation** (`src/camera/interpolate.ts`, a pure function `evaluateCamera(shot, t) → CameraState`):
1. Find the segment `[k_i, k_{i+1}]` and set `u = (t − t_i) / (t_{i+1} − t_i)`.
2. Pass `u` through `k_i.easeOut`. A cubic-bezier is solved for x by Newton's method with a bisection fallback, the same way browsers do it.
3. Position uses lerp or Catmull-Rom (with neighbor keys). Rotation uses slerp. Focal length is interpolated in **log space**, so zooms look even. Focus distance is interpolated in **inverse distance**, so pulls look natural.
4. Shake is added last: seeded 1D simplex noise per axis.

**Preset moves** (`src/camera/moves.ts`) are commands that write keys relative to the current camera, using parameters you can edit in a small popover:

| Move | Parameters |
|---|---|
| Dolly in/out | distance (m), duration, ease |
| Truck L/R | distance |
| Pan | angle (°) |
| Tilt | angle (°) |
| Crane / pedestal | height change, optional tilt compensation to keep the subject framed |
| Orbit / arc | angle (°) around selected entity or focus point |
| Push-zoom (dolly zoom) | dolly distance; focal length is solved to keep the subject the same size |
| Handheld | enables `ShakeLayer` with preset intensities (subtle / documentary / chaos) |

### 4.9 Editor and UI state (not saved in the project)

```ts
interface UiState {
  viewMode: 'editor' | 'shot';
  selection: EntityId[];
  gizmo: { mode: 'translate' | 'rotate' | 'scale'; space: 'world' | 'local';
           snap: { enabled: boolean; translate: number; rotateDeg: number; scale: number } };
  playback: { playing: boolean; time: number; loop: boolean; scope: 'shot' | 'sequence' };
  guides: { thirds: boolean; safe: boolean; center: boolean; maskOpacity: number; extraFrame?: AspectPreset };
  editorCamera: { position: Vec3; target: Vec3 };      // persisted per-user in app settings, not the project
  quality: 'draft' | 'high';                           // draft disables SSAO/DoF/soft shadows while orbiting
}
```

---

## 5. Commands, undo, and redo

```ts
// src/commands/types.ts
export interface Command {
  readonly label: string;               // "Move Mannequin 1", shown in Edit menu
  do(doc: Draft<ProjectFile>): void;    // mutate via Immer draft
  undo(doc: Draft<ProjectFile>): void;
  /** Merge a following command into this one (e.g. consecutive slider ticks). */
  mergeWith?(next: Command): boolean;
}
```

- `history.execute(cmd)` runs `do` inside an Immer `produce`, pushes the command onto the undo stack, clears the redo stack, and sets `dirty`.
- **Gizmo drags** apply a temporary transform to the three.js object while you drag, without touching the store. On mouse-up, one `SetTransform` command is executed with the before and after values. Each drag is one undo step, and React does not re-render 60 times a second during the drag.
- **Sliders and number fields** merge into one command when they target the same property within 500 ms (`mergeWith`).
- `CompositeCommand` groups several commands for multi-select edits, presets, and shot duplication.
- The stack holds 200 entries. Opening a project clears it. Saving marks the save point, so undoing back to it clears `dirty`.
- Inverse-op commands (rather than Immer patches) were chosen because the labels are readable and merging behaves predictably. Immer patches remain an option for bulk operations.

---

## 6. Rendering pipeline

- `WebGLRenderer` with `outputColorSpace = SRGB`, ACES or AgX tone mapping, and `physicallyCorrectLights` behavior (the three r155+ default).
- Shadows use `PCFSoftShadowMap` with per-light map sizes. **Contact shadows** (drei) on the floor for grounding. Directional shadow frustums fit to the scene bounds automatically.
- Post FX chain (shot view, high quality): N8AO → DepthOfField → Bloom (optional) → ToneMapping → SMAA. The editor view leaves out DoF by default.
- **Adaptive quality**: while you orbit or scrub, draft mode turns off AO and DoF and drops the shadow map size. Full quality returns 150 ms after input stops.
- **Offscreen renders** (thumbnails, stills, animatic frames) use a separate `WebGLRenderTarget` at the export resolution, through the same scene and post chain. That keeps them from fighting the visible canvas. Thumbnails are queued and rendered when idle, and re-rendered only when the shot's input hash changes.

---

## 7. Persistence

- **Save** (Ctrl/Cmd+S): renderer serializes → main checks it against the schema → writes to `project.json.tmp` → `fsync` → atomic rename. The previous file is copied to `versions/` first.
- **Autosave**: every 60 s while `dirty`, written to `.autosave/project.json`. On launch, if an autosave is newer than `project.json`, you are offered **Recover** or **Discard**.
- **Migrations**: `migrations[n]: (v_n) => v_{n+1}`, pure functions with fixture tests. Opening a project made by a newer app version is refused with a clear message.
- **Import .glb/.gltf**: the file is copied into `bundle/assets/<assetId>.glb` (a .gltf with external resources is converted to a self-contained .glb on import). The bounds are measured and a thumbnail is rendered.

---

## 8. Sidecar API

All requests need `X-ShotBoard-Token`. Long jobs return a `jobId` right away. Progress is read by polling `/jobs/{id}` (simple and reliable; no websockets).

```
GET  /health                → { ok, version, ffmpeg: { found, version } }

POST /export/pdf            body: PdfExportRequest  → { jobId }
POST /export/stills         body: StillsRequest     → { jobId }   // copy/rename, optional burn-in (Pillow)
POST /export/animatic       body: AnimaticRequest   → { jobId }
GET  /jobs/{id}             → { state: queued|running|done|error|cancelled, progress: 0..1, message, output? }
POST /jobs/{id}/cancel
```

```python
# server/shotboard_server/models.py (pydantic v2)
class ShotRow(BaseModel):
    number: str
    name: str
    shot_type: str
    lens: str                 # preformatted "35mm  f/2.8  Super 35"
    duration: float           # seconds
    notes: str
    dialogue: str | None
    thumbnail_path: Path

class PdfExportRequest(BaseModel):
    output_path: Path
    title: str
    meta: dict[str, str]      # production, director, dp, date
    layout: Literal["list", "grid-2x3", "storyboard-3x2"]
    page_size: Literal["letter", "a4"]
    orientation: Literal["portrait", "landscape"]
    shots: list[ShotRow]

class AnimaticShot(BaseModel):
    number: str
    frames_dir: Path          # PNG sequence frame_00000.png ...
    frame_count: int

class AnimaticRequest(BaseModel):
    output_path: Path
    fps: float
    width: int
    height: int
    shots: list[AnimaticShot]
    burn_in: bool = True      # shot number, lens, timecode (Pillow overlay)
    slate_seconds: float = 0  # optional title card per shot
    audio_path: Path | None = None
    crf: int = 18             # libx264, yuv420p, +faststart
```

**Animatic flow:** the renderer evaluates each shot at `1/fps` steps, renders each frame offscreen, and streams the PNGs to main, which writes them to `tmp/<job>/<shot>/`. Then it calls `/export/animatic`. The sidecar adds burn-ins with Pillow and writes an ffmpeg concat list. It runs `ffmpeg -c:v libx264 -pix_fmt yuv420p -crf 18 -movflags +faststart`, parses `-progress pipe:1` to report progress, and the temp directory is deleted afterward.

**Security:** binds to `127.0.0.1` only, uses a random token for each launch, and output paths must be ones chosen through a native save dialog (main passes an allowlist). The Electron renderer runs with `contextIsolation: true`, `nodeIntegration: false`, and `sandbox: true`.

---

## 9. UI layout and shortcuts

Default dock layout (dark theme with neutral greys, one amber accent `#f5a524` for selection and the playhead, Inter for UI text, JetBrains Mono for numbers):

```
┌──────────────────────────────────────────────────────────────────────────┐
│ ☰ ShotBoard   Diner Scene ●            [Editor | Shot Cam]   ▶  Export ▾ │
├───────────┬──────────────────────────────────────────────┬───────────────┤
│ Outliner  │                                              │ Inspector     │
│           │              Viewport                        │  Transform    │
│───────────│   (guides, HUD, gizmos, FOV cone)            │  Lens / Light │
│ Assets    │                                              │  Material     │
│ (thumbs)  │                                              │  Pose         │
├───────────┴──────────────────────────────────────────────┴───────────────┤
│ Shot list (horizontal strip of thumbnails, drag to reorder)              │
├──────────────────────────────────────────────────────────────────────────┤
│ Timeline: ruler · camera track · focal/focus curves · object tracks      │
└──────────────────────────────────────────────────────────────────────────┘
```

| Key | Action |
|---|---|
| W / E / R | Translate / rotate / scale gizmo |
| X | Toggle snapping (hold Ctrl for temporary snap) |
| Q | Toggle world/local space |
| C | Toggle editor ↔ shot camera |
| F | Frame selection |
| Numpad 0 / ` | Look through shot camera / pilot shot camera (WASD fly) |
| K | Add/update camera key at playhead |
| Space | Play / pause; Shift+Space plays sequence |
| J / L, ← / → | Previous/next key, step frame |
| Ctrl+D | Duplicate entity / shot (context) |
| Del | Delete |
| Ctrl+Z / Ctrl+Shift+Z | Undo / redo |
| Ctrl+S / Ctrl+Shift+S | Save / Save as |
| Ctrl+N (in shot list) | New shot from current view |
| G | Toggle guides |

All shortcuts go through one registry (`src/keymap`), so a later version can let users remap them and show a cheat sheet (`?`).

---

## 10. Milestones and how each one is checked

Each milestone ends with: `npm run typecheck && npm run lint && npm test` passing, a Playwright smoke test that loads the renderer in Chromium and saves a screenshot, and (from M3) `pytest` passing for the sidecar. I'll attach screenshots for each milestone.

| # | Milestone | Done when |
|---|---|---|
| **M1** | **Viewport and gizmos.** electron-vite scaffold, dock layout, dark theme, R3F viewport, orbit/pan/zoom, grid, primitives, click and box select, transform gizmos with snapping, outliner, inspector, command stack with undo/redo, keymap | You can add, select, move, rotate, scale, and delete objects, and undo or redo each step. Command and store unit tests pass. |
| **M2** | **Lens and camera view.** Lens model plus sensors, shot camera entity, editor/shot toggle, framing guides and HUD, FOV cone, physical DoF, lens panel with DoF readout, mannequin with pose library and IK handles, .glb import, asset browser | The FOV matches reference values (tests: 35 mm on Full Frame at 2.39 gives 54.4° horizontal and 24.3° vertical). DoF changes visibly with f-stop and focus. Poses apply, and dragging a hand moves the arm. |
| **M3** | **Shots and persistence.** Shot model, shot list panel (thumbnails, drag to reorder, duplicate, delete, renumber), auto-thumbnails, project bundle save/load, version backups, autosave and recovery, migrations, sample project | Saving and reloading gives back the same document (deep equal). Killing the app mid-edit leads to the recovery prompt. The sample project opens. |
| **M4** | **Keyframes and timeline.** Camera keys, bezier easing editor, preset moves, shake, timeline (scrub, zoom, drag keys, snap to frames), playback, sequence playback as an animatic in the viewport, optional object keys | Interpolation tests pass: endpoints match exactly, the bezier solver agrees with known values, and the shake is deterministic. Playback stays in sync with real time (it drops frames instead of drifting). |
| **M5** | **Lighting and polish.** All 4 light types, Kelvin color, shadows, the 4 presets, HDRI and backdrop picker, SSAO, tone mapping, adaptive quality, empty states, tooltips, shortcut cheat sheet | Each preset renders as expected (screenshots attached). The editor holds ≥ 50 fps at 1080p on a mid-range GPU with the sample project in draft mode. |
| **M6** | **Export.** Sidecar supervisor, PDF (3 layouts), PNG stills, MP4 animatic with burn-ins and progress and cancel, setup scripts, README | The PDF opens and shows every shot field. The MP4 plays with the right length (sum of durations ± 1 frame, checked with ffprobe in tests). A clean `scripts/setup.sh` gets to a running app. |

**Note on this environment:** I build and test in a headless Linux container. I can run the renderer in headless Chromium (WebGL via SwiftShader), run Electron under `xvfb`, and run the sidecar with the system ffmpeg. That proves each milestone *runs*. Speed and visual quality on a real GPU still need a check on your machine. The README will include a short checklist for that.

---

## 11. Risks and mitigations

| Risk | Mitigation |
|---|---|
| Gather-based DoF artifacts around edges | Start with pmndrs DoF and keep it behind an interface (`DofPass`). Swap in a custom CoC-sorted gather if needed. |
| A full snapshot per shot makes files bigger | JSON compresses well. Entities are usually under 200 per shot. If needed, content-hash shared entities in a later schema version, with a migration. |
| Area lights can't cast shadows in three | Add a paired shadow-only spot light, labeled as an approximation. |
| GPU memory with many high-res thumbnails | Keep thumbnails at 480 px wide on disk, lazy-load them, and use `ImageBitmap` in the shot list. |
| Python setup friction for users | The app works without the sidecar (only export is off). Setup scripts create a venv. Later: bundle a frozen sidecar with PyInstaller in electron-builder `extraResources`. |
| Offscreen render speed for long animatics | Render with the same post chain, show an ETA, and allow cancel. Offer a "draft animatic" option (no AO or DoF, half resolution). |

---

## 12. Out of scope for v1 (proposed)

Collaboration and sync, audio scrubbing beyond one reference track, motion-capture import, script breakdown or import (FDX), FBX import (users can convert to .glb), and code signing and auto-update.

---

## Decisions for you to approve

1. **Electron** over Tauri (reasons in §1).
2. Each shot has its **own full scene snapshot**, with an "apply to other shots" helper (§4.3), rather than one shared set with per-shot overrides.
3. A **project bundle folder** (`.shotboard/`) rather than a single JSON file, so imported .glb files and thumbnails travel with the project.
4. A **mannequin built in code** rather than a shipped rigged .glb.
5. The code lives in **`/shotboard`** inside this repo.
6. The out-of-scope list in §12.
