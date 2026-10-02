// Everything the Add panel can create, with sensible real-world defaults.
import type { LightSettings, ObjectKind, PosePreset, PropId, Vec3 } from './types'

export type CatalogCategory = 'people' | 'furniture' | 'set' | 'lights' | 'shapes'

export interface CatalogItem {
  key: string
  label: string
  category: CatalogCategory
  kind: ObjectKind
  propId?: PropId
  pose?: PosePreset
  color: string
  scale?: Vec3
  /** Height off the floor for the object's origin. */
  y?: number
  light?: LightSettings
}

export const CATEGORY_LABELS: Record<CatalogCategory, string> = {
  people: 'People',
  furniture: 'Furniture',
  set: 'Set & exterior',
  lights: 'Lights',
  shapes: 'Shapes'
}

export const CATALOG: CatalogItem[] = [
  { key: 'person', label: 'Person', category: 'people', kind: 'mannequin', pose: 'stand', color: '#5b8def' },
  { key: 'person-sit', label: 'Seated', category: 'people', kind: 'mannequin', pose: 'sit', color: '#e0703c' },

  { key: 'chair', label: 'Chair', category: 'furniture', kind: 'prop', propId: 'chair', color: '#8a6a4f' },
  { key: 'table', label: 'Table', category: 'furniture', kind: 'prop', propId: 'table', color: '#7a5c44' },
  { key: 'sofa', label: 'Sofa', category: 'furniture', kind: 'prop', propId: 'sofa', color: '#556270' },
  { key: 'bed', label: 'Bed', category: 'furniture', kind: 'prop', propId: 'bed', color: '#6d5a4b' },
  { key: 'counter', label: 'Counter', category: 'furniture', kind: 'prop', propId: 'counter', color: '#9a9289' },
  { key: 'floorLamp', label: 'Lamp', category: 'furniture', kind: 'prop', propId: 'floorLamp', color: '#2f3237' },

  { key: 'wall', label: 'Wall', category: 'set', kind: 'prop', propId: 'wall', color: '#a8a39b' },
  { key: 'door', label: 'Door', category: 'set', kind: 'prop', propId: 'door', color: '#7d6450' },
  { key: 'window', label: 'Window', category: 'set', kind: 'prop', propId: 'window', color: '#a8a39b' },
  { key: 'stairs', label: 'Stairs', category: 'set', kind: 'prop', propId: 'stairs', color: '#8d8780' },
  { key: 'car', label: 'Car', category: 'set', kind: 'prop', propId: 'car', color: '#9c2f2f' },
  { key: 'tree', label: 'Tree', category: 'set', kind: 'prop', propId: 'tree', color: '#4f7a3a' },
  { key: 'floor', label: 'Floor', category: 'set', kind: 'plane', color: '#3a3d44', scale: [10, 1, 10], y: 0 },

  {
    key: 'spot', label: 'Spot', category: 'lights', kind: 'light', color: '#ffffff',
    light: { type: 'spot', intensity: 4, kelvin: 3200, color: '#ffffff', shadows: true, angle: 40 }
  },
  {
    key: 'softbox', label: 'Soft panel', category: 'lights', kind: 'light', color: '#ffffff', scale: [1.2, 1.2, 1],
    light: { type: 'area', intensity: 4, kelvin: 5600, color: '#ffffff', shadows: false }
  },
  {
    key: 'practical', label: 'Practical', category: 'lights', kind: 'light', color: '#ffffff',
    light: { type: 'point', intensity: 2, kelvin: 2700, color: '#ffffff', shadows: true }
  },
  {
    key: 'sun', label: 'Sun', category: 'lights', kind: 'light', color: '#ffffff',
    light: { type: 'directional', intensity: 4, kelvin: 5600, color: '#ffffff', shadows: true }
  },

  { key: 'box', label: 'Box', category: 'shapes', kind: 'box', color: '#8a8f98', y: 0.5 },
  { key: 'sphere', label: 'Sphere', category: 'shapes', kind: 'sphere', color: '#8a8f98', y: 0.5 },
  { key: 'cylinder', label: 'Cylinder', category: 'shapes', kind: 'cylinder', color: '#8a8f98', y: 0.5 },
  { key: 'cone', label: 'Cone', category: 'shapes', kind: 'cone', color: '#8a8f98', y: 0.5 },
  { key: 'plane', label: 'Plane', category: 'shapes', kind: 'plane', color: '#6b7078', scale: [2, 1, 2], y: 0 }
]

export const catalogItem = (key: string): CatalogItem => {
  const item = CATALOG.find((c) => c.key === key)
  if (!item) throw new Error(`Unknown catalog item ${key}`)
  return item
}

/** Distinct colors for new people, so several figures in one scene are easy to tell apart. */
export const PERSON_COLORS = ['#5b8def', '#e0703c', '#46a758', '#c056c9', '#e5b33b', '#3fb8b0', '#d9534f', '#8e7cc3']
