import type { OverlayObject } from './types.js'

export const satelliteTrackLayerId = 'satellite_tracks'

export type SatelliteTrackRiskLevel = 'low' | 'possible' | 'high'

export interface SatelliteTrackSegment {
  start: readonly [number, number]
  end: readonly [number, number]
}

export interface SatellitePixelAlignment {
  status: 'detected' | 'not_detected' | 'not_evaluated'
  segments?: readonly SatelliteTrackSegment[]
}

/**
 * Presentation-neutral input accepted from Seiza Server, PSF Guard, or any
 * other consumer of `seiza-satellites` output.
 */
export interface SatelliteTrackOverlayInput {
  stableId?: string
  label: string
  noradId?: number | null
  cosparId?: string | null
  source?: string
  catalogSource?: string
  riskLevel?: SatelliteTrackRiskLevel
  segments: readonly SatelliteTrackSegment[]
  pixelAlignment?: SatellitePixelAlignment | null
  maximumApparentRateArcsecPerSecond?: number | null
}

/** Risk and evidence colors generalized from PSF Guard's satellite overlay. */
export const suggestedSatelliteTrackColors = Object.freeze({
  low: '#43d9e6',
  possible: '#ffd166',
  high: '#ff4d5a',
  aligned: '#7cff6b',
})

/**
 * Convert a compact satellite prediction into the canonical overlay-object
 * vocabulary. The orbital prediction and any pixel alignment remain separate
 * outlines with typed roles; a pixel match never replaces the prediction.
 */
export function satelliteTrackOverlayObject(
  track: SatelliteTrackOverlayInput,
): OverlayObject {
  const riskLevel = track.riskLevel ?? 'low'
  const predicted = validSegments(track.segments)
  const aligned = track.pixelAlignment?.status === 'detected'
    ? validSegments(track.pixelAlignment.segments ?? [])
    : []
  const anchor = aligned[0]?.start ?? predicted[0]?.start ?? [0, 0]
  const stableId = track.stableId
    ?? (track.noradId != null
      ? `satellite:norad:${track.noradId}`
      : track.cosparId
        ? `satellite:cospar:${track.cosparId}`
        : undefined)

  return {
    stable_id: stableId,
    name: track.label,
    common_name: aligned.length > 0 ? 'pixel match' : '',
    kind: 'satellite',
    mag: null,
    x: anchor[0],
    y: anchor[1],
    semi_major_px: 0,
    semi_minor_px: 0,
    angle_deg: null,
    source: track.source ?? 'satellite_prediction',
    catalog_source: track.catalogSource,
    aliases: track.cosparId ? [track.cosparId] : [],
    alternate_ids: track.noradId == null ? [] : [`NORAD ${track.noradId}`],
    prominence: null,
    motion_arcsec_per_hour: track.maximumApparentRateArcsecPerSecond == null
      ? undefined
      : track.maximumApparentRateArcsecPerSecond * 3_600,
    outlines: [
      {
        geometry_id: stableId ? `${stableId}:predicted-track` : undefined,
        source_record_id: stableId,
        role: 'predicted-track',
        quality: 'propagated',
        level: riskLevel,
        contours: predicted.map(segmentContour),
      },
      ...(aligned.length === 0 ? [] : [{
        geometry_id: stableId ? `${stableId}:pixel-aligned-track` : undefined,
        source_record_id: stableId,
        role: 'pixel-aligned-track',
        quality: 'detected',
        level: 'detected',
        contours: aligned.map(segmentContour),
      }]),
    ],
  }
}

export function satelliteTrackRiskLevelForObject(
  object: Pick<OverlayObject, 'kind' | 'outlines'>,
): SatelliteTrackRiskLevel | null {
  if (object.kind !== 'satellite') return null
  const level = object.outlines?.find((outline) => outline.role === 'predicted-track')?.level
  return level === 'high' || level === 'possible' || level === 'low' ? level : 'low'
}

export function satelliteTrackHasPixelAlignment(
  object: Pick<OverlayObject, 'kind' | 'outlines'>,
): boolean {
  return object.kind === 'satellite'
    && object.outlines?.some((outline) =>
      outline.role === 'pixel-aligned-track'
      && outline.quality === 'detected'
      && outline.contours.length > 0,
    ) === true
}

function validSegments(segments: readonly SatelliteTrackSegment[]) {
  return segments.filter(({ start, end }) =>
    start.length === 2
    && end.length === 2
    && start.every(Number.isFinite)
    && end.every(Number.isFinite),
  )
}

function segmentContour(segment: SatelliteTrackSegment) {
  return {
    closed: false,
    points: [segment.start, segment.end],
  }
}
