import { createElement, Fragment } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { AstroOverlay } from './react.js'
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
})
