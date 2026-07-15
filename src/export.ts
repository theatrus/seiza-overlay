const overlayThemeVariables = [
  '--seiza-overlay-grid-color',
  '--seiza-overlay-grid-label-color',
  '--seiza-overlay-field-star-color',
  '--seiza-overlay-deep-sky-color',
  '--seiza-overlay-named-star-color',
  '--seiza-overlay-identified-star-color',
  '--seiza-overlay-transient-color',
  '--seiza-overlay-comet-color',
  '--seiza-overlay-asteroid-color',
  '--seiza-overlay-center-color',
  '--seiza-overlay-label-halo-color',
  '--seiza-overlay-encompassing-color',
  '--seiza-overlay-grid-stroke-width',
  '--seiza-overlay-marker-stroke-width',
  '--seiza-overlay-moving-marker-stroke-width',
  '--seiza-overlay-field-star-stroke-width',
  '--seiza-overlay-center-stroke-width',
  '--seiza-overlay-grid-opacity',
  '--seiza-overlay-marker-opacity',
  '--seiza-overlay-grid-dasharray',
  '--seiza-overlay-label-font-family',
  '--seiza-overlay-grid-font-family',
  '--seiza-overlay-label-font-weight',
  '--seiza-overlay-grid-font-weight',
  '--seiza-overlay-label-halo-width',
] as const

export interface SerializeOverlayOptions {
  width?: number
  height?: number
  captureTheme?: boolean
}

export function serializeOverlaySvg(
  overlay: SVGSVGElement,
  options: SerializeOverlayOptions = {},
) {
  const clone = overlay.cloneNode(true) as SVGSVGElement
  clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg')
  if (options.width != null) clone.setAttribute('width', String(options.width))
  if (options.height != null) clone.setAttribute('height', String(options.height))
  if (options.captureTheme !== false && typeof getComputedStyle === 'function') {
    const computed = getComputedStyle(overlay)
    for (const variable of overlayThemeVariables) {
      const value = computed.getPropertyValue(variable).trim()
      if (value) clone.style.setProperty(variable, value)
    }
  }
  return new XMLSerializer().serializeToString(clone)
}

export interface RenderedImageSize {
  width: number
  height: number
}

export type CanvasDecoration = (
  context: CanvasRenderingContext2D,
  size: RenderedImageSize,
) => void | Promise<void>

export interface RenderOverlayPngOptions extends RenderedImageSize {
  background: Blob | string
  overlay: SVGSVGElement | string
  decorate?: CanvasDecoration
  canvas?: HTMLCanvasElement
  crossOrigin?: '' | 'anonymous' | 'use-credentials'
}

export async function renderOverlayPng({
  background,
  overlay,
  width,
  height,
  decorate,
  canvas = document.createElement('canvas'),
  crossOrigin,
}: RenderOverlayPngOptions): Promise<Blob> {
  if (!Number.isInteger(width) || width <= 0 || !Number.isInteger(height) || height <= 0) {
    throw new Error('PNG dimensions must be positive integers')
  }

  const backgroundResource = imageResource(background)
  const overlayMarkup = typeof overlay === 'string'
    ? overlay
    : serializeOverlaySvg(overlay, { width, height })
  const overlayResource = imageResource(new Blob(
    [overlayMarkup],
    { type: 'image/svg+xml;charset=utf-8' },
  ))

  try {
    const [backgroundImage, overlayImage] = await Promise.all([
      loadImage(backgroundResource.url, backgroundResource.owned ? undefined : crossOrigin),
      loadImage(overlayResource.url),
    ])
    canvas.width = width
    canvas.height = height
    const context = canvas.getContext('2d')
    if (!context) throw new Error('this browser does not provide a 2D canvas')
    context.drawImage(backgroundImage, 0, 0, width, height)
    context.drawImage(overlayImage, 0, 0, width, height)
    await decorate?.(context, { width, height })
    return await canvasBlob(canvas)
  } finally {
    backgroundResource.revoke()
    overlayResource.revoke()
  }
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  window.setTimeout(() => URL.revokeObjectURL(url), 0)
}

function imageResource(source: Blob | string) {
  if (typeof source === 'string') {
    return { url: source, owned: false, revoke: () => undefined }
  }
  const url = URL.createObjectURL(source)
  return { url, owned: true, revoke: () => URL.revokeObjectURL(url) }
}

function loadImage(
  url: string,
  crossOrigin?: '' | 'anonymous' | 'use-credentials',
) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image()
    if (crossOrigin != null) image.crossOrigin = crossOrigin
    image.onload = () => resolve(image)
    image.onerror = () => reject(new Error('the browser could not decode a rendered image layer'))
    image.src = url
  })
}

function canvasBlob(canvas: HTMLCanvasElement) {
  return new Promise<Blob>((resolve, reject) => canvas.toBlob(
    (value) => value
      ? resolve(value)
      : reject(new Error('the browser could not encode the PNG')),
    'image/png',
  ))
}
