import {
  Armchair, BedDouble, Box, BrickWall, Car, Circle, Cone, Cylinder, DoorOpen, Footprints, LampFloor,
  Lightbulb, Package, Sun, Flashlight, RectangleHorizontal, PersonStanding, Square, Table2, TreePine, User, Video, AppWindow, Refrigerator, Sofa, Layers,
  type LucideIcon
} from 'lucide-react'
import type { PropId, SceneObject } from '../shared/types'

export const CATALOG_ICONS: Record<string, LucideIcon> = {
  person: PersonStanding,
  'person-sit': User,
  chair: Armchair,
  table: Table2,
  sofa: Sofa,
  bed: BedDouble,
  counter: Refrigerator,
  floorLamp: LampFloor,
  wall: BrickWall,
  door: DoorOpen,
  window: AppWindow,
  stairs: Footprints,
  car: Car,
  tree: TreePine,
  floor: Layers,
  spot: Flashlight,
  softbox: RectangleHorizontal,
  practical: Lightbulb,
  sun: Sun,
  box: Box,
  sphere: Circle,
  cylinder: Cylinder,
  cone: Cone,
  plane: Square
}

export const CameraIcon = Video

export function iconFor(obj: Pick<SceneObject, 'kind' | 'propId'> & { light?: SceneObject['light'] }): LucideIcon {
  if (obj.kind === 'prop' && obj.propId) return CATALOG_ICONS[obj.propId as PropId] ?? Package
  if (obj.kind === 'mannequin') return PersonStanding
  if (obj.kind === 'model') return Package
  if (obj.kind === 'light') {
    const t = (obj as SceneObject).light?.type
    return t === 'spot' ? Flashlight : t === 'area' ? RectangleHorizontal : t === 'directional' ? Sun : Lightbulb
  }
  return CATALOG_ICONS[obj.kind] ?? Box
}
