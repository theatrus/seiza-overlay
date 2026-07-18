export type DefaultOverlayLayerId =
  | 'deep_sky'
  | 'named_stars'
  | 'star_identifiers'
  | 'field_stars'
  | 'transients'
  | 'minor_bodies'
  | 'historical_transients'
  | 'grid'

export type OverlayLayerVisibility = Readonly<Record<string, boolean | undefined>>

export interface WcsSolution {
  crval: [number, number]
  crpix: [number, number]
  cd: [[number, number], [number, number]]
  ctype?: [string, string]
  cunit?: [string, string]
  radesys?: string
  equinox?: number
}

export interface OverlayContour {
  closed: boolean
  points: ReadonlyArray<readonly [number, number]>
}

export interface OverlayOutline {
  geometry_id?: string
  source_record_id?: string
  role?: string
  quality?: string
  level?: string | null
  contours: readonly OverlayContour[]
}

export interface OverlayObject {
  stable_id?: string
  name: string
  common_name: string
  kind: string
  mag?: number | null
  x: number
  y: number
  semi_major_px: number
  semi_minor_px: number
  /** Null when an asymmetric catalog extent has no known orientation. */
  angle_deg: number | null
  source?: string
  catalog_source?: string
  aliases?: string[]
  parent_ids?: string[]
  alternate_ids?: string[]
  alternate_sources?: string[]
  ra_deg?: number
  dec_deg?: number
  prominence?: number | null
  discovered?: string
  near_capture?: boolean
  distance_au?: number
  direction_pa_deg?: number
  direction_angle_deg?: number
  /** Pixel-projected catalog contours, grouped by source geometry. */
  outlines?: readonly OverlayOutline[]
}

export interface OverlaySolution {
  center_ra_deg?: number
  center_dec_deg?: number
  pixel_scale_arcsec_per_pixel?: number
  matched_stars?: number
  rms_arcsec?: number
  image_width: number
  image_height: number
  wcs?: WcsSolution
  footprint?: Array<[number, number]> | [[number, number], [number, number], [number, number], [number, number]]
  objects?: OverlayObject[]
  catalog_version?: string
  capture_time?: string
}

export type OverlaySolutionWithWcs = OverlaySolution & { wcs: WcsSolution }

export interface GridCurve {
  path: string
  label: string
  x: number
  y: number
  anchor: 'start' | 'middle'
  axis: 'ra' | 'dec'
}

export interface OverlayTheme {
  gridColor?: string
  gridLabelColor?: string
  fieldStarColor?: string
  deepSkyColor?: string
  namedStarColor?: string
  identifiedStarColor?: string
  transientColor?: string
  cometColor?: string
  asteroidColor?: string
  centerColor?: string
  labelHaloColor?: string
  encompassingColor?: string
  gridStrokeWidth?: number
  markerStrokeWidth?: number
  movingMarkerStrokeWidth?: number
  fieldStarStrokeWidth?: number
  centerStrokeWidth?: number
  gridOpacity?: number
  markerOpacity?: number
  gridDasharray?: string
  labelFontFamily?: string
  gridFontFamily?: string
  labelFontWeight?: OverlayFontWeight
  gridFontWeight?: OverlayFontWeight
  labelHaloWidthEm?: number
}

export type OverlayFontWeight = number | 'normal' | 'bold' | 'lighter' | 'bolder'

export type OverlayLayerResolver = (object: OverlayObject) => string
export type OverlayLabelFormatter = (object: OverlayObject) => string
/** Return a CSS color for an object, or undefined to retain the theme color. */
export type OverlayColorResolver = (object: OverlayObject) => string | undefined
