import { describe, expect, it } from 'vitest'
import {
  constellationLabelPoint,
  constellationLabelText,
  constellationLayerId,
  constellationLinePaths,
} from './constellations.js'
import { defaultOverlayLayers, defaultOverlayTheme } from './core.js'
import type { OverlayConstellation, OverlaySolution } from './types.js'

const cassiopeia: OverlayConstellation = {
  abbreviation: 'Cas',
  name: 'Cassiopeia',
  lines: [
    [[0, 10], [40, 30], [80, 15]],
    [[80, 15], [120, 40]],
  ],
  label: [60, 50],
}

describe('constellation helpers', () => {
  it('turns every polyline into open SVG path data', () => {
    expect(constellationLinePaths(cassiopeia)).toEqual([
      'M 0.00 10.00 L 40.00 30.00 L 80.00 15.00',
      'M 80.00 15.00 L 120.00 40.00',
    ])
  })

  it('drops polylines without two finite points', () => {
    expect(constellationLinePaths({
      lines: [[[1, 2]], [[Number.NaN, 2], [3, 4]], []],
    })).toEqual([])
  })

  it('returns no label point when the server places it off-image', () => {
    expect(constellationLabelPoint(cassiopeia)).toEqual([60, 50])
    expect(constellationLabelPoint({ label: null })).toBeNull()
    expect(constellationLabelPoint({})).toBeNull()
    expect(constellationLabelPoint({ label: [Number.NaN, 2] })).toBeNull()
  })

  it('uppercases the name and falls back to the abbreviation', () => {
    expect(constellationLabelText(cassiopeia)).toBe('CASSIOPEIA')
    expect(constellationLabelText({ name: '', abbreviation: 'Cas' })).toBe('CAS')
  })

  it('is an opt-in layer with CLI sky-map styling defaults', () => {
    expect(constellationLayerId).toBe('constellations')
    expect(defaultOverlayLayers.constellations).toBe(false)
    expect(defaultOverlayTheme).toMatchObject({
      constellationColor: '#96beff',
      constellationOpacity: 0.75,
      constellationStrokeWidth: 1.25,
    })
  })

  it('accepts the seiza-server response contract', () => {
    const response: OverlaySolution = JSON.parse(JSON.stringify({
      image_width: 200,
      image_height: 100,
      constellations: [cassiopeia, { ...cassiopeia, abbreviation: 'Cep', name: 'Cepheus', label: null }],
      constellation_attribution: 'Constellation Lines dataset by Marc van der Sluys',
    }))
    expect(response.constellations?.[1]?.label).toBeNull()
    expect(response.constellation_attribution).toContain('van der Sluys')
  })
})
