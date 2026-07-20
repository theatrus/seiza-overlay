import type {
  DefaultOverlayLayerId,
  GridCurve,
  OverlayLabelFormatter,
  OverlayLayerResolver,
  OverlayLayerVisibility,
  OverlayContour,
  OverlayObject,
  OverlaySolutionWithWcs,
  OverlayTheme,
  MovingBodyVectorOptions,
} from './types.js'
import { satelliteTrackLayerId } from './satellites.js'

/**
 * Balanced browser defaults derived from Tenrankai's production overlay.
 * Consumers can spread this object and override only the values they need.
 */
export const defaultOverlayTheme: Readonly<OverlayTheme> = Object.freeze({
  gridStrokeWidth: 0.65,
  markerStrokeWidth: 0.7,
  movingMarkerStrokeWidth: 0.95,
  satelliteTrackStrokeWidth: 2,
  satelliteHighRiskStrokeWidth: 2.5,
  satelliteAlignedStrokeWidth: 4,
  fieldStarStrokeWidth: 0.65,
  centerStrokeWidth: 0.75,
  labelFontWeight: 400,
  gridFontWeight: 500,
  labelHaloWidthEm: 0.1,
  satelliteLowColor: '#43d9e6',
  satellitePossibleColor: '#ffd166',
  satelliteHighColor: '#ff4d5a',
  satelliteAlignedColor: '#7cff6b',
  satellitePredictionOpacity: 1,
  satelliteAlignedPredictionOpacity: 0.72,
  satelliteTrackDasharray: '8 6',
})

/** Fraction of ranked objects shown when a consumer does not choose a density. */
export const defaultOverlayDensity = 0.6

/** A visible three-hour trail, clamped for very slow and very fast bodies. */
export const defaultMovingBodyVectorOptions: Readonly<Required<MovingBodyVectorOptions>> = Object.freeze({
  durationHours: 3,
  minimumMarkerRadii: 3,
  maximumMarkerRadii: 9,
})

export const defaultOverlayLayers: Readonly<Record<DefaultOverlayLayerId, boolean>> = {
  deep_sky: true,
  named_stars: true,
  star_identifiers: false,
  field_stars: false,
  transients: true,
  minor_bodies: true,
  satellite_tracks: true,
  historical_transients: false,
  grid: true,
}

export const defaultLayerForObject: OverlayLayerResolver = (object) => {
  if (object.kind === 'field-star') return 'field_stars'
  if (object.kind === 'identified-star') return 'star_identifiers'
  if (object.kind === 'star' || object.kind === 'double-star') return 'named_stars'
  if (object.kind === 'transient') return 'transients'
  if (object.kind === 'comet' || object.kind === 'asteroid') return 'minor_bodies'
  if (object.kind === 'satellite') return satelliteTrackLayerId
  return 'deep_sky'
}

export const defaultLabelForObject: OverlayLabelFormatter = (object) => {
  if (object.common_name && object.common_name !== object.name) {
    return `${object.name} · ${object.common_name}`
  }
  return object.common_name || object.name
}

export function countOverlayObjects(
  objects: readonly OverlayObject[],
  layerForObject: OverlayLayerResolver = defaultLayerForObject,
): Record<string, number> {
  const counts: Record<string, number> = {}
  for (const object of objects) {
    const layer = layerForObject(object)
    counts[layer] = (counts[layer] ?? 0) + 1
    if (object.kind === 'transient' && object.near_capture === false) {
      counts.historical_transients = (counts.historical_transients ?? 0) + 1
    }
  }
  return counts
}

export interface PartitionOverlayOptions {
  layers?: OverlayLayerVisibility
  density?: number
  minimumRankedObjects?: number
  layerForObject?: OverlayLayerResolver
}

export interface PartitionedOverlayObjects {
  fieldStars: OverlayObject[]
  rendered: OverlayObject[]
  encompassing: OverlayObject[]
  total: number
}

export function partitionOverlayObjects(
  objects: readonly OverlayObject[],
  width: number,
  height: number,
  options: PartitionOverlayOptions = {},
): PartitionedOverlayObjects {
  const layers: OverlayLayerVisibility = {
    ...defaultOverlayLayers,
    ...options.layers,
  }
  const layerForObject = options.layerForObject ?? defaultLayerForObject
  const visible = objects.filter((object) => objectIsVisible(object, layers, layerForObject))
  const fieldStars = visible.filter((object) => object.kind === 'field-star')
  const labeled = visible.filter((object) => object.kind !== 'field-star')
  const encompassing = labeled.filter((object) => encompassesFrame(object, width, height))
  const inFrame = labeled.filter((object) => !encompassing.includes(object))
  const rankable = inFrame
    .filter((object) => Number.isFinite(object.prominence))
    .sort((left, right) => (right.prominence ?? 0) - (left.prominence ?? 0))
  const unrankable = inFrame.filter((object) => !Number.isFinite(object.prominence))
  const floor = Math.min(rankable.length, options.minimumRankedObjects ?? 4)
  const density = clamp(options.density ?? defaultOverlayDensity, 0, 1)
  const budget = Math.max(
    floor,
    Math.round(floor + (rankable.length - floor) * density),
  )

  return {
    fieldStars,
    rendered: [...unrankable, ...rankable.slice(0, budget)],
    encompassing,
    total: inFrame.length,
  }
}

function objectIsVisible(
  object: OverlayObject,
  layers: OverlayLayerVisibility,
  layerForObject: OverlayLayerResolver,
) {
  const layer = layerForObject(object)
  if (layers[layer] === false) return false
  if (object.kind === 'transient' && object.near_capture === false) {
    return layers.historical_transients !== false
  }
  return true
}

export function encompassesFrame(
  object: OverlayObject,
  width: number,
  height: number,
) {
  if (object.semi_major_px <= 0) return false
  const radians = (object.angle_deg ?? 0) * Math.PI / 180
  const cos = Math.cos(radians)
  const sin = Math.sin(radians)
  const minorRadius = object.angle_deg == null
    ? object.semi_major_px
    : Math.max(object.semi_minor_px, 1)
  const corners: Array<[number, number]> = [
    [0, 0],
    [width, 0],
    [width, height],
    [0, height],
  ]
  return corners.every(([x, y]) => {
    const dx = x - object.x
    const dy = y - object.y
    const u = (dx * cos + dy * sin) / object.semi_major_px
    const v = (-dx * sin + dy * cos) / minorRadius
    return u * u + v * v <= 1
  })
}

/** Convert one pixel-space catalog contour into SVG path data. */
export function overlayContourPath(contour: OverlayContour): string | null {
  const points = contour.points.filter(([x, y]) => Number.isFinite(x) && Number.isFinite(y))
  const minimumPoints = contour.closed ? 3 : 2
  if (points.length < minimumPoints) return null
  const [first, ...rest] = points
  if (!first) return null
  const segments = [`M ${first[0].toFixed(2)} ${first[1].toFixed(2)}`]
  for (const [x, y] of rest) segments.push(`L ${x.toFixed(2)} ${y.toFixed(2)}`)
  if (contour.closed) segments.push('Z')
  return segments.join(' ')
}

export function movingBodyTail(
  x: number,
  y: number,
  size: number,
  angleDegrees: number,
  kind: string,
  vectorLengthPixels?: number | null,
) {
  const angle = angleDegrees * Math.PI / 180
  const along = (distance: number) => [
    x + Math.cos(angle) * size * distance,
    y + Math.sin(angle) * size * distance,
  ] as const
  const offset = (point: readonly [number, number], distance: number) => [
    point[0] - Math.sin(angle) * size * distance,
    point[1] + Math.cos(angle) * size * distance,
  ] as const
  const point = (value: readonly [number, number]) => `${value[0].toFixed(2)} ${value[1].toFixed(2)}`
  const defaultTipDistance = kind === 'comet' ? 4 : 4.5
  const tipDistance = vectorLengthPixels != null && Number.isFinite(vectorLengthPixels)
    ? Math.max(Math.abs(vectorLengthPixels) / Math.max(Math.abs(size), Number.EPSILON), 1.5)
    : defaultTipDistance

  if (kind === 'comet') {
    const root = along(1.15)
    const span = tipDistance - 1.15
    const shoulder = along(1.15 + span * 0.75)
    const flare = clamp(span * 0.18, 0.35, 0.85)
    const tip = along(tipDistance)
    const upper = offset(shoulder, flare)
    const lower = offset(shoulder, -flare)
    return `M ${point(root)} L ${point(tip)} M ${point(root)} L ${point(upper)} M ${point(root)} L ${point(lower)}`
  }

  const root = along(1.2)
  const span = tipDistance - 1.2
  const tip = along(tipDistance)
  const arrowRoot = along(1.2 + span * 0.73)
  const arrowWidth = clamp(span * 0.2, 0.45, 0.9)
  const upper = offset(arrowRoot, arrowWidth)
  const lower = offset(arrowRoot, -arrowWidth)
  return `M ${point(root)} L ${point(tip)} M ${point(upper)} L ${point(tip)} L ${point(lower)}`
}

/**
 * Convert an apparent angular speed into the number of image pixels travelled
 * over the configured interval. Invalid or missing metadata returns `null`,
 * allowing callers to retain a fixed-size legacy direction indicator.
 */
export function movingBodyVectorLength(
  markerSize: number,
  motionArcsecPerHour: number | null | undefined,
  pixelScaleArcsecPerPixel: number | null | undefined,
  options: MovingBodyVectorOptions = {},
): number | null {
  if (
    motionArcsecPerHour == null
    || pixelScaleArcsecPerPixel == null
    || !Number.isFinite(motionArcsecPerHour)
    || !Number.isFinite(pixelScaleArcsecPerPixel)
    || motionArcsecPerHour < 0
    || pixelScaleArcsecPerPixel <= 0
  ) return null

  const size = Math.max(Math.abs(markerSize), Number.EPSILON)
  const durationHours = Math.max(
    options.durationHours ?? defaultMovingBodyVectorOptions.durationHours,
    0,
  )
  const minimumMarkerRadii = Math.max(
    options.minimumMarkerRadii ?? defaultMovingBodyVectorOptions.minimumMarkerRadii,
    0,
  )
  const maximumMarkerRadii = Math.max(
    options.maximumMarkerRadii ?? defaultMovingBodyVectorOptions.maximumMarkerRadii,
    minimumMarkerRadii,
  )
  const physicalLength = motionArcsecPerHour * durationHours / pixelScaleArcsecPerPixel
  return clamp(
    physicalLength,
    size * minimumMarkerRadii,
    size * maximumMarkerRadii,
  )
}

export function makeCoordinateGrid(solution: OverlaySolutionWithWcs): GridCurve[] {
  const width = solution.image_width
  const height = solution.image_height
  const fontSize = gridLabelFontSize(width)
  const centerRa = pixelToWorld(solution, width / 2, height / 2)[0]
  let raMin = Number.POSITIVE_INFINITY
  let raMax = Number.NEGATIVE_INFINITY
  let decMin = Number.POSITIVE_INFINITY
  let decMax = Number.NEGATIVE_INFINITY
  for (let xIndex = 0; xIndex <= 8; xIndex += 1) {
    for (let yIndex = 0; yIndex <= 8; yIndex += 1) {
      const [ra, dec] = pixelToWorld(
        solution,
        width * xIndex / 8,
        height * yIndex / 8,
      )
      const unwrappedRa = centerRa + modulo(ra - centerRa + 540, 360) - 180
      raMin = Math.min(raMin, unwrappedRa)
      raMax = Math.max(raMax, unwrappedRa)
      decMin = Math.min(decMin, dec)
      decMax = Math.max(decMax, dec)
    }
  }
  const cosDec = Math.max(
    Math.abs(Math.cos((solution.center_dec_deg ?? solution.wcs.crval[1]) * Math.PI / 180)),
    0.05,
  )
  const span = Math.max(
    decMax - decMin,
    (raMax - raMin) * cosDec,
    (solution.pixel_scale_arcsec_per_pixel ?? pixelScaleFromWcs(solution.wcs)) / 3600,
  )
  const decStep = niceGridStep(span / 5)
  const raStep = niceGridStep(span / cosDec / 5)
  const curves: GridCurve[] = []

  for (
    let ra = Math.floor(raMin / raStep) * raStep, count = 0;
    ra <= raMax + raStep && count < 32;
    ra += raStep, count += 1
  ) {
    const samples = sampleCurve(decMin - decStep, decMax + decStep, (dec) =>
      worldToPixel(
        solution,
        modulo(ra, 360),
        clamp(dec, -89.999999, 89.999999),
      ),
    )
    const curve = gridCurve(
      samples,
      width,
      height,
      formatRa(modulo(ra, 360)),
      'ra',
      fontSize,
    )
    if (curve) curves.push(curve)
  }

  for (
    let dec = Math.floor(decMin / decStep) * decStep, count = 0;
    dec <= decMax + decStep && dec <= 90 && count < 32;
    dec += decStep, count += 1
  ) {
    if (dec < -90) continue
    const samples = sampleCurve(raMin - raStep, raMax + raStep, (ra) =>
      worldToPixel(
        solution,
        modulo(ra, 360),
        clamp(dec, -89.999999, 89.999999),
      ),
    )
    const curve = gridCurve(samples, width, height, formatDec(dec), 'dec', fontSize)
    if (curve) curves.push(curve)
  }
  return curves
}

function sampleCurve(
  start: number,
  end: number,
  project: (coordinate: number) => [number, number] | null,
) {
  return Array.from(
    { length: 97 },
    (_, index) => project(start + (end - start) * index / 96),
  )
}

function gridCurve(
  samples: Array<[number, number] | null>,
  width: number,
  height: number,
  label: string,
  axis: 'ra' | 'dec',
  fontSize: number,
): GridCurve | null {
  const commands: string[] = []
  const inFrame: Array<[number, number]> = []
  let penDown = false
  for (const sample of samples) {
    if (
      !sample
      || sample[0] < -4 * width
      || sample[0] > 5 * width
      || sample[1] < -4 * height
      || sample[1] > 5 * height
    ) {
      penDown = false
      continue
    }
    commands.push(`${penDown ? 'L' : 'M'}${sample[0].toFixed(2)},${sample[1].toFixed(2)}`)
    penDown = true
    if (
      sample[0] >= 4
      && sample[0] <= width - 4
      && sample[1] >= 4
      && sample[1] <= height - 4
    ) {
      inFrame.push(sample)
    }
  }
  const first = inFrame[0]
  if (commands.length < 2 || !first) return null
  const point = inFrame.reduce((best, candidate) =>
    axis === 'ra'
      ? (candidate[1] < best[1] ? candidate : best)
      : (candidate[0] < best[0] ? candidate : best),
  first)
  const padding = Math.max(6, fontSize * 0.45)
  const labelWidth = label.length * fontSize * 0.7
  const minimumBaseline = padding + fontSize * 1.08
  const maximumBaseline = height - padding - fontSize * 0.25
  return {
    path: commands.join(' '),
    label,
    x: axis === 'ra'
      ? clampOrCenter(
        point[0],
        padding + labelWidth / 2,
        width - padding - labelWidth / 2,
        width / 2,
      )
      : clampOrCenter(
        point[0] + padding,
        padding,
        width - padding - labelWidth,
        width / 2,
      ),
    y: clampOrCenter(
      axis === 'ra' ? point[1] + fontSize * 1.35 : point[1] - padding,
      minimumBaseline,
      maximumBaseline,
      height / 2,
    ),
    anchor: axis === 'ra' ? 'middle' : (labelWidth + padding * 2 <= width ? 'start' : 'middle'),
    axis,
  }
}

export function gridLabelFontSize(width: number) {
  return Math.max(Math.min(Math.max(width / 60, 18), width / 18), 6)
}

export function pixelToWorld(
  solution: Pick<OverlaySolutionWithWcs, 'wcs'>,
  x: number,
  y: number,
): [number, number] {
  const { crval, crpix, cd } = solution.wcs
  const dx = x - crpix[0]
  const dy = y - crpix[1]
  const xi = (cd[0][0] * dx + cd[0][1] * dy) * Math.PI / 180
  const eta = (cd[1][0] * dx + cd[1][1] * dy) * Math.PI / 180
  const ra0 = crval[0] * Math.PI / 180
  const dec0 = crval[1] * Math.PI / 180
  const rho = Math.hypot(xi, eta)
  if (rho === 0) return [crval[0], crval[1]]
  const c = Math.atan(rho)
  const dec = Math.asin(
    Math.cos(c) * Math.sin(dec0)
    + eta * Math.sin(c) * Math.cos(dec0) / rho,
  )
  const ra = ra0 + Math.atan2(
    xi * Math.sin(c),
    rho * Math.cos(dec0) * Math.cos(c) - eta * Math.sin(dec0) * Math.sin(c),
  )
  return [modulo(ra * 180 / Math.PI, 360), dec * 180 / Math.PI]
}

export function worldToPixel(
  solution: Pick<OverlaySolutionWithWcs, 'wcs'>,
  raDegrees: number,
  decDegrees: number,
): [number, number] | null {
  const { crval, crpix, cd } = solution.wcs
  const ra0 = crval[0] * Math.PI / 180
  const dec0 = crval[1] * Math.PI / 180
  const ra = raDegrees * Math.PI / 180
  const dec = decDegrees * Math.PI / 180
  const deltaRa = ra - ra0
  const cosC = Math.sin(dec0) * Math.sin(dec)
    + Math.cos(dec0) * Math.cos(dec) * Math.cos(deltaRa)
  if (cosC <= 1e-9) return null
  const xi = Math.cos(dec) * Math.sin(deltaRa) / cosC * 180 / Math.PI
  const eta = (
    Math.cos(dec0) * Math.sin(dec)
    - Math.sin(dec0) * Math.cos(dec) * Math.cos(deltaRa)
  ) / cosC * 180 / Math.PI
  const determinant = cd[0][0] * cd[1][1] - cd[0][1] * cd[1][0]
  if (determinant === 0) return null
  return [
    crpix[0] + (cd[1][1] * xi - cd[0][1] * eta) / determinant,
    crpix[1] + (-cd[1][0] * xi + cd[0][0] * eta) / determinant,
  ]
}

const gridSteps = [
  1 / 3600, 2 / 3600, 5 / 3600, 10 / 3600, 15 / 3600, 30 / 3600,
  1 / 60, 2 / 60, 5 / 60, 10 / 60, 15 / 60, 30 / 60,
  1, 2, 5, 10, 15, 30, 45, 90,
]

export function pixelScaleFromWcs(wcs: OverlaySolutionWithWcs['wcs']) {
  const firstAxis = Math.hypot(wcs.cd[0][0], wcs.cd[1][0])
  const secondAxis = Math.hypot(wcs.cd[0][1], wcs.cd[1][1])
  return Math.max((firstAxis + secondAxis) / 2 * 3600, Number.EPSILON)
}

function niceGridStep(target: number) {
  return gridSteps.find((step) => step >= target) ?? 90
}

function modulo(value: number, divisor: number) {
  return ((value % divisor) + divisor) % divisor
}

export function clamp(value: number, minimum: number, maximum: number) {
  return Math.max(Math.min(value, Math.max(minimum, maximum)), Math.min(minimum, maximum))
}

function clampOrCenter(value: number, minimum: number, maximum: number, center: number) {
  return minimum <= maximum ? clamp(value, minimum, maximum) : center
}

export function formatRa(ra: number) {
  const totalTenths = Math.round(modulo(ra, 360) / 15 * 36_000) % 864_000
  const hours = Math.floor(totalTenths / 36_000)
  const minutes = Math.floor((totalTenths % 36_000) / 600)
  const seconds = totalTenths % 600
  return `RA ${String(hours).padStart(2, '0')}h${String(minutes).padStart(2, '0')}m${String(Math.floor(seconds / 10)).padStart(2, '0')}.${seconds % 10}s`
}

export function formatDec(dec: number) {
  const totalTenths = Math.round(Math.abs(dec) * 36_000)
  const degrees = Math.floor(totalTenths / 36_000)
  const minutes = Math.floor((totalTenths % 36_000) / 600)
  const seconds = totalTenths % 600
  return `Dec ${dec < 0 ? '−' : '+'}${String(degrees).padStart(2, '0')}°${String(minutes).padStart(2, '0')}′${String(Math.floor(seconds / 10)).padStart(2, '0')}.${seconds % 10}″`
}
