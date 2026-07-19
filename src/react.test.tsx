import { createElement, Fragment } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { AstroOverlay } from './react.js'
import { suggestedDeepSkyColorForObject } from './catalogs.js'
import type { OverlaySolution } from './types.js'

const objectOnlySolution: OverlaySolution = {
  image_width: 800,
  image_height: 600,
  objects: [{
    stable_id: 'ngc:224',
    name: 'NGC 224',
    common_name: 'Andromeda Galaxy',
    kind: 'galaxy',
    x: 400,
    y: 300,
    semi_major_px: 120,
    semi_minor_px: 60,
    angle_deg: 35,
    prominence: 1,
  }],
}

describe('AstroOverlay', () => {
  it('renders an object-only Tenrankai-style solution without requiring WCS', () => {
    const markup = renderToStaticMarkup(createElement(AstroOverlay, {
      solution: objectOnlySolution,
    }))
    expect(markup).toContain('data-kind="galaxy"')
    expect(markup).toContain('NGC 224 · Andromeda Galaxy')
    expect(markup).not.toContain('class="coordinate-grid seiza-overlay__grid"')
    expect(markup).toContain('font-weight: var(--seiza-overlay-label-font-weight, 400)')
    expect(markup).toContain('font-weight: var(--seiza-overlay-grid-font-weight, 500)')
    expect(markup).toContain('stroke-width: var(--seiza-overlay-marker-stroke-width, 0.7)')
  })

  it('writes consumer weight overrides inline for SVG and PNG rendering', () => {
    const markup = renderToStaticMarkup(createElement(AstroOverlay, {
      solution: objectOnlySolution,
      density: 1,
      theme: {
        markerStrokeWidth: 1.1,
        gridStrokeWidth: 0.8,
        labelFontWeight: 'bold',
        gridFontWeight: 650,
        labelHaloWidthEm: 0.075,
      },
    }))
    expect(markup).toContain('--seiza-overlay-marker-stroke-width:1.1')
    expect(markup).toContain('--seiza-overlay-grid-stroke-width:0.8')
    expect(markup).toContain('--seiza-overlay-label-font-weight:bold')
    expect(markup).toContain('--seiza-overlay-grid-font-weight:650')
    expect(markup).toContain('--seiza-overlay-label-halo-width:0.075em')
  })

  it('uses distinct clip paths when several overlays share one page', () => {
    const solution = {
      ...objectOnlySolution,
      center_dec_deg: 41,
      pixel_scale_arcsec_per_pixel: 3.6,
      wcs: {
        crval: [10, 41] as [number, number],
        crpix: [400, 300] as [number, number],
        cd: [[-0.001, 0], [0, -0.001]] as [[number, number], [number, number]],
      },
    }
    const markup = renderToStaticMarkup(createElement(
      Fragment,
      null,
      createElement(AstroOverlay, { solution }),
      createElement(AstroOverlay, { solution }),
    ))
    const ids = [...markup.matchAll(/<clipPath id="([^"]+)"/g)].map((match) => match[1])
    expect(ids).toHaveLength(2)
    expect(new Set(ids).size).toBe(2)
  })

  it('renders unknown ellipse orientations as circles', () => {
    const solution: OverlaySolution = {
      ...objectOnlySolution,
      objects: [{ ...objectOnlySolution.objects![0]!, angle_deg: null }],
    }
    const markup = renderToStaticMarkup(createElement(AstroOverlay, { solution }))
    expect(markup).toContain('rx="120" ry="120"')
    expect(markup).toContain('rotate(0)')
  })

  it('renders projected object outlines instead of the fallback ellipse', () => {
    const solution: OverlaySolution = {
      ...objectOnlySolution,
      objects: [{
        ...objectOnlySolution.objects![0]!,
        outlines: [{
          geometry_id: 'openngc:NGC224#outline-1',
          level: '1',
          contours: [{ closed: true, points: [[10, 20], [30, 40], [50, 20]] }],
        }],
      }],
    }
    const markup = renderToStaticMarkup(createElement(AstroOverlay, { solution }))
    expect(markup).toContain('class="object-marker seiza-overlay__marker seiza-overlay__marker--outline"')
    expect(markup).toContain('data-outline-level="1"')
    expect(markup).toContain('M 10.00 20.00 L 30.00 40.00 L 50.00 20.00 Z')
    expect(markup).not.toContain('seiza-overlay__marker--extended')
  })

  it('applies suggested catalog colors directly to outlines and labels', () => {
    const solution: OverlaySolution = {
      ...objectOnlySolution,
      objects: [{
        ...objectOnlySolution.objects![0]!,
        outlines: [{
          geometry_id: 'openngc:NGC224#outline-1',
          contours: [{ closed: true, points: [[10, 20], [30, 40], [50, 20]] }],
        }],
      }],
    }
    const markup = renderToStaticMarkup(createElement(AstroOverlay, {
      solution,
      colorForObject: suggestedDeepSkyColorForObject,
    }))
    expect(markup).toContain('stroke="#55cfff"')
    expect(markup).toContain('fill="#55cfff"')
  })

  it('renders speed-scaled moving-body vectors with machine-readable metadata', () => {
    const solution: OverlaySolution = {
      ...objectOnlySolution,
      pixel_scale_arcsec_per_pixel: 2,
      objects: [{
        ...objectOnlySolution.objects![0]!,
        stable_id: 'minor-body:12345',
        name: '(12345)',
        common_name: 'Test asteroid',
        kind: 'asteroid',
        semi_major_px: 0,
        semi_minor_px: 0,
        direction_angle_deg: 0,
        motion_arcsec_per_hour: 20,
      }],
    }
    const markup = renderToStaticMarkup(createElement(AstroOverlay, {
      solution,
      movingBodyVectors: {
        durationHours: 6,
        minimumMarkerRadii: 1,
        maximumMarkerRadii: 20,
      },
    }))
    expect(markup).toContain('data-motion-arcsec-per-hour="20"')
    expect(markup).toContain('data-motion-vector-length="60"')
    expect(markup).toContain('L 460.00 300.00')
  })
})
