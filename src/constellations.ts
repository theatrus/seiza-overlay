import { overlayContourPath } from './core.js'
import type { OverlayConstellation } from './types.js'

export const constellationLayerId = 'constellations'

/**
 * Convert each stick-figure polyline into SVG path data. Polylines with fewer
 * than two finite points are dropped.
 */
export function constellationLinePaths(
  constellation: Pick<OverlayConstellation, 'lines'>,
): string[] {
  return (constellation.lines ?? []).flatMap((line) => {
    const path = overlayContourPath({ closed: false, points: line ?? [] })
    return path == null ? [] : [path]
  })
}

/** The label position, or null when the server placed it off-image. */
export function constellationLabelPoint(
  constellation: Pick<OverlayConstellation, 'label'>,
): readonly [number, number] | null {
  const label = constellation.label
  if (!label || label.length !== 2 || !label.every(Number.isFinite)) return null
  return label
}

/** Constellation names render in uppercase, as on printed star charts. */
export function constellationLabelText(
  constellation: Pick<OverlayConstellation, 'name' | 'abbreviation'>,
): string {
  return (constellation.name || constellation.abbreviation).toUpperCase()
}
