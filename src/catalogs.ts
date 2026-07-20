import { defaultLayerForObject } from './core.js'
import type {
  OverlayColorResolver,
  OverlayLayerResolver,
  OverlayObject,
} from './types.js'

export type SuggestedDeepSkyCatalogId =
  | 'messier'
  | 'ngc'
  | 'ic'
  | 'sharpless-vdb'
  | 'lbn'
  | 'cederblad'
  | 'dark-nebulae'
  | 'snr'
  | 'ugc'
  | 'pgc'
  | 'other-deep-sky'

/**
 * Suggested catalog groups and labels used by Seiza applications. Consumers
 * may use these for filters without making them mandatory overlay layers.
 */
export const suggestedDeepSkyCatalogs: ReadonlyArray<readonly [SuggestedDeepSkyCatalogId, string]> = [
  ['messier', 'Messier'],
  ['ngc', 'NGC'],
  ['ic', 'IC'],
  ['sharpless-vdb', 'Sharpless / vdB'],
  ['lbn', 'LBN (bright nebulae)'],
  ['cederblad', 'Cederblad'],
  ['dark-nebulae', 'Dark nebulae (B / LDN)'],
  ['snr', 'Supernova remnants'],
  ['ugc', 'UGC galaxies'],
  ['pgc', 'PGC galaxies'],
  ['other-deep-sky', 'Other / default catalogs'],
]

/**
 * A restrained suggested palette: related catalogs stay in the same cool
 * family, with distinct accents reserved for dark nebulae and remnants.
 */
export const suggestedDeepSkyCatalogColors: Readonly<Record<SuggestedDeepSkyCatalogId, string>> = Object.freeze({
  messier: '#f2ca72',
  ngc: '#55cfff',
  ic: '#72dfb9',
  'sharpless-vdb': '#ee9a78',
  lbn: '#a2d96f',
  cederblad: '#70d7d0',
  'dark-nebulae': '#b4a3f0',
  snr: '#f18782',
  ugc: '#79aff5',
  pgc: '#a1aed8',
  'other-deep-sky': '#c1d1d3',
})

const nonDeepSkyKinds = new Set([
  'star',
  'double-star',
  'identified-star',
  'field-star',
  'transient',
  'comet',
  'asteroid',
  'satellite',
])

/** Classify a deep-sky object by its primary catalog designation. */
export function suggestedDeepSkyCatalogForObject(
  object: Pick<OverlayObject, 'kind' | 'name'>,
): SuggestedDeepSkyCatalogId | null {
  if (nonDeepSkyKinds.has(object.kind)) return null
  const name = object.name.trim()
  if (/^PGC(?:\s|$)/i.test(name)) return 'pgc'
  if (/^UGC(?:\s|$)/i.test(name)) return 'ugc'
  if (/^LBN(?:\s|$)/i.test(name)) return 'lbn'
  if (/^(?:Ced|Cederblad)(?:\s|$)/i.test(name)) return 'cederblad'
  if (/^(?:LDN(?:\s|$)|B\s*\d)/i.test(name)) return 'dark-nebulae'
  if (/^SNR(?:\s|$)/i.test(name)) return 'snr'
  if (/^(?:Sh\s*2[- ]|vdB(?:\s|$))/i.test(name)) return 'sharpless-vdb'
  if (/^M\s*\d/i.test(name)) return 'messier'
  if (/^NGC\s*\d/i.test(name)) return 'ngc'
  if (/^IC\s*\d/i.test(name)) return 'ic'
  return 'other-deep-sky'
}

/** Stable suggested layer ID for consumers that expose catalog filters. */
export function suggestedDeepSkyCatalogLayer(catalog: SuggestedDeepSkyCatalogId): string {
  return `deep-sky:${catalog}`
}

/** Suggested catalog-aware layer resolver; non-deep-sky kinds use defaults. */
export const suggestedDeepSkyLayerForObject: OverlayLayerResolver = (object) => {
  const catalog = suggestedDeepSkyCatalogForObject(object)
  return catalog
    ? suggestedDeepSkyCatalogLayer(catalog)
    : defaultLayerForObject(object)
}

/**
 * Suggested catalog-aware colors for deep-sky markers, labels, and outlines.
 * Returning undefined for other kinds preserves the active overlay theme.
 */
export const suggestedDeepSkyColorForObject: OverlayColorResolver = (object) => {
  const catalog = suggestedDeepSkyCatalogForObject(object)
  return catalog ? suggestedDeepSkyCatalogColors[catalog] : undefined
}
