import { describe, expect, it } from 'vitest'
import {
  satelliteTrackHasPixelAlignment,
  satelliteTrackLayerId,
  satelliteTrackOverlayObject,
  satelliteTrackRiskLevelForObject,
  suggestedSatelliteTrackColors,
} from './satellites.js'
import { defaultLayerForObject } from './core.js'

describe('satellite overlay adapter', () => {
  it('keeps predicted and pixel-aligned geometry as separate typed outlines', () => {
    const object = satelliteTrackOverlayObject({
      label: 'ISS (ZARYA) [25544]',
      noradId: 25544,
      cosparId: '1998-067A',
      source: 'CelesTrak active',
      riskLevel: 'high',
      segments: [
        { start: [10, 20], end: [100, 120] },
        { start: [100, 120], end: [180, 140] },
      ],
      pixelAlignment: {
        status: 'detected',
        segments: [
          { start: [14, 25], end: [100, 120] },
          { start: [100, 120], end: [184, 145] },
        ],
      },
    })

    expect(object.stable_id).toBe('satellite:norad:25544')
    expect(object.common_name).toBe('pixel match')
    expect(object.x).toBe(14)
    expect(object.y).toBe(25)
    expect(object.outlines?.map((outline) => outline.role)).toEqual([
      'predicted-track',
      'pixel-aligned-track',
    ])
    expect(object.outlines?.[0]?.contours).toHaveLength(2)
    expect(object.outlines?.[1]?.contours).toHaveLength(2)
    expect(defaultLayerForObject(object)).toBe(satelliteTrackLayerId)
    expect(satelliteTrackRiskLevelForObject(object)).toBe('high')
    expect(satelliteTrackHasPixelAlignment(object)).toBe(true)
    expect(suggestedSatelliteTrackColors.aligned).toBe('#7cff6b')
  })

  it('filters invalid geometry without claiming a pixel match', () => {
    const object = satelliteTrackOverlayObject({
      label: 'NORAD 1',
      riskLevel: 'low',
      segments: [
        { start: [Number.NaN, 1], end: [2, 3] },
        { start: [4, 5], end: [6, 7] },
      ],
      pixelAlignment: { status: 'not_detected', segments: [] },
    })
    expect(object.outlines?.[0]?.contours).toHaveLength(1)
    expect(object.outlines).toHaveLength(1)
    expect(object.common_name).toBe('')
    expect(satelliteTrackHasPixelAlignment(object)).toBe(false)
  })
})
