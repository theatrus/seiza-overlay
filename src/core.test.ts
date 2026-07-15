import { describe, expect, it } from 'vitest'
import {
  countOverlayObjects,
  defaultOverlayDensity,
  defaultOverlayLayers,
  defaultOverlayTheme,
  formatDec,
  formatRa,
  makeCoordinateGrid,
  partitionOverlayObjects,
  pixelToWorld,
  worldToPixel,
} from './core.js'
import type { OverlayObject, OverlaySolution } from './types.js'

const solution: OverlaySolution = {
  center_ra_deg: 10.6847,
  center_dec_deg: 41.269,
  pixel_scale_arcsec_per_pixel: 3.6,
  matched_stars: 42,
  rms_arcsec: 0.41,
  image_width: 1024,
  image_height: 768,
  wcs: {
    crval: [10.6847, 41.269],
    crpix: [512, 384],
    cd: [[-0.001, 0], [0, -0.001]],
  },
}

function object(partial: Partial<OverlayObject> = {}): OverlayObject {
  return {
    name: 'NGC 224',
    common_name: 'Andromeda Galaxy',
    kind: 'galaxy',
    x: 512,
    y: 384,
    semi_major_px: 30,
    semi_minor_px: 20,
    angle_deg: 0,
    ...partial,
  }
}

describe('overlay layers and density', () => {
  it('publishes the production rendering defaults for consumers to override', () => {
    expect(defaultOverlayDensity).toBe(0.6)
    expect(defaultOverlayTheme).toMatchObject({
      labelFontWeight: 400,
      gridFontWeight: 500,
      markerStrokeWidth: 0.7,
      gridStrokeWidth: 0.65,
      labelHaloWidthEm: 0.1,
    })
  })

  it('keeps historical transients and field stars off by default', () => {
    const objects = [
      object(),
      object({ name: '', common_name: '', kind: 'field-star' }),
      object({ name: 'SN old', kind: 'transient', near_capture: false }),
      object({ name: 'SN new', kind: 'transient', near_capture: true }),
    ]
    const result = partitionOverlayObjects(
      objects,
      solution.image_width,
      solution.image_height,
      { layers: defaultOverlayLayers },
    )
    expect(result.fieldStars).toHaveLength(0)
    expect(result.rendered.map((entry) => entry.name)).toEqual(['NGC 224', 'SN new'])
  })

  it('uses prominence to thin only ranked objects', () => {
    const ranked = Array.from({ length: 12 }, (_, index) => object({
      name: `NGC ${index}`,
      prominence: index / 12,
      x: 50 + index * 70,
    }))
    const transient = object({ name: 'SN current', kind: 'transient', prominence: null })
    const result = partitionOverlayObjects(
      [...ranked, transient],
      solution.image_width,
      solution.image_height,
      { density: 0 },
    )
    expect(result.rendered).toHaveLength(5)
    expect(result.rendered[0]?.name).toBe('SN current')
    expect(result.rendered.some((entry) => entry.name === 'NGC 11')).toBe(true)
    expect(result.rendered.some((entry) => entry.name === 'NGC 0')).toBe(false)
  })

  it('uses the exported density when no consumer override is provided', () => {
    const ranked = Array.from({ length: 12 }, (_, index) => object({
      name: `NGC ${index}`,
      prominence: index / 12,
      x: 50 + index * 70,
    }))
    const transient = object({ name: 'SN current', kind: 'transient', prominence: null })
    const result = partitionOverlayObjects(
      [...ranked, transient],
      solution.image_width,
      solution.image_height,
    )
    expect(result.rendered).toHaveLength(10)
  })

  it('counts default and historical layers independently', () => {
    expect(countOverlayObjects([
      object(),
      object({ kind: 'identified-star' }),
      object({ kind: 'transient', near_capture: false }),
    ])).toEqual({
      deep_sky: 1,
      star_identifiers: 1,
      transients: 1,
      historical_transients: 1,
    })
  })
})

describe('WCS and grid geometry', () => {
  it('round-trips TAN coordinates through pixels', () => {
    const world = pixelToWorld(solution, 200, 650)
    const pixel = worldToPixel(solution, world[0], world[1])
    expect(pixel?.[0]).toBeCloseTo(200, 6)
    expect(pixel?.[1]).toBeCloseTo(650, 6)
  })

  it('keeps coordinate labels within the source frame', () => {
    const curves = makeCoordinateGrid(solution)
    expect(curves.length).toBeGreaterThan(2)
    for (const curve of curves) {
      expect(curve.x).toBeGreaterThanOrEqual(0)
      expect(curve.x).toBeLessThanOrEqual(solution.image_width)
      expect(curve.y).toBeGreaterThanOrEqual(0)
      expect(curve.y).toBeLessThanOrEqual(solution.image_height)
    }
  })

  it('formats RA and declination at one-tenth-second precision', () => {
    expect(formatRa(0)).toBe('RA 00h00m00.0s')
    expect(formatDec(-4)).toBe('Dec −04°00′00.0″')
  })
})
