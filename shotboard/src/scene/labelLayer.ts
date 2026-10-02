import { createContext, useContext, type RefObject } from 'react'

/**
 * A fixed DOM layer over the canvas that 3D name labels render into. Without it, drei's <Html>
 * remounts once when the canvas connects its events, which React 19 warns about.
 */
export const LabelLayerContext = createContext<RefObject<HTMLDivElement | null> | null>(null)

// drei types the portal as a non-null ref; it reads .current only after mount, when it is set.
export const useLabelLayer = () => (useContext(LabelLayerContext) ?? undefined) as RefObject<HTMLElement> | undefined
