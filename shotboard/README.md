# ShotBoard

A storyboard and shot list tool with a simple 3D stage. Block a scene with simple figures and props, frame it with a real lens, and save each frame as a shot.

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for the design and data model.

![ShotBoard](docs/screenshots/m2-app.png)

## Status

| Milestone | State |
|---|---|
| 1. Viewport and gizmos | Done |
| 2. Lens and camera view | Done |
| 3. Shots and saving | Next |
| 4. Keyframes and timeline | |
| 5. Lighting and polish | |
| 6. Export (PDF, PNG, MP4) | |

## Run it

Needs Node 20 or newer.

```bash
cd shotboard
npm install
npm run dev        # opens the desktop app with hot reload
```

`npm run web` runs only the UI in your browser at http://localhost:5199. It's handy for quick UI work.

## Checks

```bash
npm run typecheck  # TypeScript
npm test           # unit tests (undo/redo, lens math)
npm run smoke      # drives the UI in headless Chromium, saves screenshots to test-output/
npm run smoke:electron  # Linux only: launches the real app under xvfb and saves a screenshot
```

If the 3D view won't start on a machine without a working GPU (a VM, for example), launch with `SHOTBOARD_SOFTWARE_GL=1 npm run dev`.

## Using it

**Build the scene.** The Add panel has people, furniture, set pieces and basic shapes, at real-world sizes. New things appear where you're looking. Each new person gets their own shirt color, and name labels float above everything (press **L** to hide them). To bring in your own models, use **Import** or drop a `.glb`/`.gltf` file on the 3D view.

**Pose people.** Select a person and pick a pose (Stand, Sit, Walk, Run, Point). To adjust, click one of the white dots on the figure (or a joint name in Properties) and drag the rings. The dark band on the face shows which way they're looking.

**Frame the shot.** The blue camera and its view cone show what the shot camera sees. Press **C** to look through it. In camera view:
- Drag to orbit around the focus point, right-drag to pan, and scroll to dolly.
- **F** aims the camera at whatever is selected.
- The bar at the top sets the aspect ratio, guides and depth of field.

In the editor view, **Camera from view** puts the shot camera where you're looking from.

**Lens.** With nothing selected, Properties shows the camera. Set the focal length, sensor (Super 35, Full Frame, Alexa 65, iPhone), f-stop and focus. **Focus on** pulls focus to a person or prop. The field of view and the in-focus range are calculated the way a real lens works.

## Controls

| Key | Action |
|---|---|
| Left-drag / right-drag / scroll | Orbit / pan / zoom (in camera view this moves the shot camera) |
| Click, Shift+click | Select, add to selection |
| C | Editor view / camera view |
| W / E / R | Move / rotate / scale |
| Q | World / local space |
| X | Snap on/off (0.25 m, 15°, 0.1) |
| F | Frame selection (camera view: aim the camera at it) |
| L | Name labels on/off |
| G | Rule-of-thirds guide on/off |
| Ctrl+D | Duplicate |
| Del | Delete |
| Ctrl+Z / Ctrl+Shift+Z | Undo / redo |
| Esc | Leave joint posing, then clear the selection |

In Properties, drag a field's label left or right to scrub the value. Hold Shift for fine changes and Ctrl for coarse ones. Double-click an item in the scene list to rename it.
