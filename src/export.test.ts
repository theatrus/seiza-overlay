import { afterEach, describe, expect, it, vi } from 'vitest'
import { overlayThemeVariables, serializeOverlaySvg } from './export.js'

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('serializeOverlaySvg', () => {
  it('copies constellation theme variables inline for PNG export', () => {
    expect(overlayThemeVariables).toEqual(expect.arrayContaining([
      '--seiza-overlay-constellation-color',
      '--seiza-overlay-constellation-label-color',
      '--seiza-overlay-constellation-stroke-width',
      '--seiza-overlay-constellation-opacity',
    ]))

    const inline = new Map<string, string>()
    const clone = {
      setAttribute: vi.fn(),
      style: { setProperty: (name: string, value: string) => inline.set(name, value) },
    }
    const overlay = { cloneNode: () => clone } as unknown as SVGSVGElement
    const computed: Record<string, string> = {
      '--seiza-overlay-constellation-color': ' rgb(150, 190, 255) ',
      '--seiza-overlay-constellation-opacity': '0.5',
    }
    vi.stubGlobal('getComputedStyle', () => ({
      getPropertyValue: (name: string) => computed[name] ?? '',
    }))
    vi.stubGlobal('XMLSerializer', class {
      serializeToString(node: unknown) {
        return node === clone ? 'serialized' : 'wrong node'
      }
    })

    expect(serializeOverlaySvg(overlay, { width: 200, height: 100 })).toBe('serialized')
    expect(Object.fromEntries(inline)).toEqual({
      '--seiza-overlay-constellation-color': 'rgb(150, 190, 255)',
      '--seiza-overlay-constellation-opacity': '0.5',
    })
    expect(clone.setAttribute).toHaveBeenCalledWith('width', '200')
  })
})
