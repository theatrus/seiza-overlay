import { useId, useMemo, type CSSProperties, type SVGProps } from 'react'
import {
  clamp,
  defaultLabelForObject,
  defaultLayerForObject,
  defaultOverlayLayers,
  gridLabelFontSize,
  makeCoordinateGrid,
  movingBodyTail,
  partitionOverlayObjects,
} from './core.js'
import type {
  OverlayLabelFormatter,
  OverlayLayerResolver,
  OverlayLayerVisibility,
  OverlayObject,
  OverlaySolution,
  OverlaySolutionWithWcs,
  OverlayTheme,
} from './types.js'

const embeddedStyles = `
  .coordinate-grid path, .seiza-overlay__grid-line {
    fill: none;
    stroke: var(--seiza-overlay-grid-color, #7ddbe8);
    stroke-width: var(--seiza-overlay-grid-stroke-width, .85);
    stroke-dasharray: var(--seiza-overlay-grid-dasharray, 7 5);
    opacity: var(--seiza-overlay-grid-opacity, .72);
    vector-effect: non-scaling-stroke;
  }
  .coordinate-grid text, .seiza-overlay__grid-label {
    fill: var(--seiza-overlay-grid-label-color, #b9f3f7);
    stroke: var(--seiza-overlay-label-halo-color, #05090e);
    stroke-width: var(--seiza-overlay-label-halo-width, .1em);
    paint-order: stroke;
    font-family: var(--seiza-overlay-grid-font-family, ui-monospace, monospace);
    font-weight: var(--seiza-overlay-grid-font-weight, 700);
  }
  .field-stars circle, .seiza-overlay__field-star {
    fill: none;
    stroke: var(--seiza-overlay-field-star-color, #eef7ff);
    stroke-width: var(--seiza-overlay-field-star-stroke-width, .85);
    opacity: .78;
    vector-effect: non-scaling-stroke;
  }
  .object-marker, .seiza-overlay__marker {
    fill: none;
    stroke-width: var(--seiza-overlay-marker-stroke-width, 1);
    opacity: var(--seiza-overlay-marker-opacity, .88);
    vector-effect: non-scaling-stroke;
  }
  .seiza-overlay__marker--moving, .seiza-overlay__marker--transient {
    stroke-width: var(--seiza-overlay-moving-marker-stroke-width, 1.25);
  }
  .overlay-label, .seiza-overlay__label {
    stroke: var(--seiza-overlay-label-halo-color, rgba(0, 0, 0, .88));
    stroke-width: var(--seiza-overlay-label-halo-width, .1em);
    paint-order: stroke;
    font-family: var(--seiza-overlay-label-font-family, ui-sans-serif, system-ui, sans-serif);
    font-weight: var(--seiza-overlay-label-font-weight, 700);
  }
  .solution-center, .seiza-overlay__center {
    fill: none;
    stroke: var(--seiza-overlay-center-color, #f2c66d);
    stroke-width: var(--seiza-overlay-center-stroke-width, 1);
    vector-effect: non-scaling-stroke;
  }
  .direction-tail { stroke-linecap: round; stroke-linejoin: round; }
`

type ThemeStyle = CSSProperties & Record<`--seiza-overlay-${string}`, string | number | undefined>

export interface AstroOverlayProps extends Omit<SVGProps<SVGSVGElement>, 'children'> {
  solution: OverlaySolution
  objects?: readonly OverlayObject[]
  layers?: OverlayLayerVisibility
  density?: number
  minimumRankedObjects?: number
  layerForObject?: OverlayLayerResolver
  labelForObject?: OverlayLabelFormatter
  theme?: OverlayTheme
  showCenter?: boolean
}

export function AstroOverlay({
  solution,
  objects = solution.objects ?? [],
  layers = defaultOverlayLayers,
  density = 1,
  minimumRankedObjects = 4,
  layerForObject = defaultLayerForObject,
  labelForObject = defaultLabelForObject,
  theme,
  showCenter = true,
  className,
  style,
  'aria-label': ariaLabel = 'Astronomical objects and coordinate grid',
  ...svgProps
}: AstroOverlayProps) {
  const width = solution.image_width
  const height = solution.image_height
  const mergedLayers: OverlayLayerVisibility = { ...defaultOverlayLayers, ...layers }
  const partitioned = partitionOverlayObjects(objects, width, height, {
    layers,
    density,
    minimumRankedObjects,
    layerForObject,
  })
  const grid = useMemo(
    () => solution.wcs && mergedLayers.grid !== false
      ? makeCoordinateGrid(solution as OverlaySolutionWithWcs)
      : [],
    [mergedLayers.grid, solution],
  )
  const gridFontSize = gridLabelFontSize(width)
  const fontSize = Math.max(width / 75, 14)
  const frameId = `seiza-overlay-frame-${useId().replace(/:/g, '')}`
  const placedLabels: Array<{ x: number; y: number; halfWidth: number }> = []
  const rootStyle: ThemeStyle = { ...themeVariables(theme), ...style }

  const labelPosition = (object: OverlayObject) => {
    const label = labelForObject(object)
    const estimatedHalfWidth = label.length * fontSize * 0.275
    const maximumHalfWidth = Math.max(0, width / 2 - fontSize * 0.25)
    const halfWidth = Math.min(estimatedHalfWidth, maximumHalfWidth)
    const x = halfWidth >= maximumHalfWidth
      ? width / 2
      : clamp(object.x, halfWidth + fontSize * 0.25, width - halfWidth - fontSize * 0.25)
    const radius = Math.max(object.semi_minor_px, fontSize)
    let y = object.y - radius - fontSize * 0.5
    for (let attempt = 0; attempt < 6; attempt += 1) {
      const collision = placedLabels.some((placed) =>
        Math.abs(placed.y - y) < fontSize * 1.3
        && Math.abs(placed.x - x) < placed.halfWidth + halfWidth,
      )
      if (!collision) break
      y -= fontSize * 1.4
    }
    y = clamp(y, fontSize * 1.1, height - fontSize * 0.35)
    placedLabels.push({ x, y, halfWidth })
    return { x, y }
  }

  return <svg
    {...svgProps}
    className={['seiza-overlay', className].filter(Boolean).join(' ')}
    style={rootStyle}
    viewBox={`0 0 ${width} ${height}`}
    preserveAspectRatio="none"
    aria-label={ariaLabel}
    data-overlay-version="1"
  >
    <style>{embeddedStyles}</style>
    <defs>
      <clipPath id={frameId}><rect width={width} height={height} /></clipPath>
    </defs>
    {solution.wcs && mergedLayers.grid !== false && <g className="coordinate-grid seiza-overlay__grid">
      <g clipPath={`url(#${frameId})`} className="coordinate-grid-lines seiza-overlay__grid-lines">
        {grid.map((curve, index) => <path
          className="seiza-overlay__grid-line"
          key={`${curve.axis}-${curve.label}-${index}`}
          d={curve.path}
        />)}
      </g>
      <g className="coordinate-grid-labels seiza-overlay__grid-labels">
        {grid.map((curve, index) => <text
          className="seiza-overlay__grid-label"
          key={`${curve.axis}-${curve.label}-${index}`}
          x={curve.x}
          y={curve.y}
          textAnchor={curve.anchor}
          fontSize={gridFontSize}
          data-axis={curve.axis}
        >{curve.label}</text>)}
      </g>
    </g>}
    <g className="field-stars seiza-overlay__field-stars">
      {partitioned.fieldStars.map((star, index) => <circle
        className="seiza-overlay__field-star"
        key={objectKey(star, index)}
        cx={star.x}
        cy={star.y}
        r={Math.max(width / 1300, 2.5)}
      />)}
    </g>
    {partitioned.encompassing.length > 0 && <text
      className="overlay-label encompassing-label seiza-overlay__label seiza-overlay__encompassing-label"
      fill="var(--seiza-overlay-encompassing-color, #aee8ff)"
      x={fontSize}
      y={height - fontSize}
      fontSize={fontSize}
    >Field within: {partitioned.encompassing.map(labelForObject).join(' · ')}</text>}
    <g className="catalog-objects seiza-overlay__objects">
      {partitioned.rendered.map((object, index) => {
        const namedStar = object.kind === 'star' || object.kind === 'double-star'
        const identifiedStar = object.kind === 'identified-star'
        const transient = object.kind === 'transient'
        const moving = object.kind === 'comet' || object.kind === 'asteroid'
        const color = objectColor(object)
        const a = Math.max(object.semi_major_px, fontSize)
        const b = Math.max(object.semi_minor_px, fontSize)
        const directionTail = moving && object.direction_angle_deg != null
          ? movingBodyTail(object.x, object.y, a, object.direction_angle_deg, object.kind)
          : null
        const label = labelPosition(object)
        return <g
          key={objectKey(object, index)}
          data-kind={object.kind}
          data-layer={layerForObject(object)}
          data-stable-id={object.stable_id}
        >
          {moving || transient ? <>
            <path
              className={`object-marker seiza-overlay__marker ${moving ? 'seiza-overlay__marker--moving' : 'seiza-overlay__marker--transient'}`}
              stroke={color}
              d={`M ${object.x} ${object.y - a} L ${object.x + a} ${object.y} L ${object.x} ${object.y + a} L ${object.x - a} ${object.y} Z`}
            />
            {directionTail && <path
              className={`object-marker direction-tail seiza-overlay__marker seiza-overlay__marker--moving ${object.kind}-tail`}
              data-direction-angle={object.direction_angle_deg}
              stroke={color}
              d={directionTail}
            />}
          </> : namedStar || identifiedStar ? <path
            className="object-marker seiza-overlay__marker seiza-overlay__marker--star"
            stroke={color}
            d={`M ${object.x - a} ${object.y} H ${object.x - a / 3} M ${object.x + a / 3} ${object.y} H ${object.x + a}`}
          /> : <ellipse
            className="object-marker seiza-overlay__marker seiza-overlay__marker--extended"
            stroke={color}
            cx={0}
            cy={0}
            rx={a}
            ry={b}
            transform={`translate(${object.x} ${object.y}) rotate(${object.angle_deg})`}
          />}
          <text
            className="overlay-label seiza-overlay__label"
            fill={color}
            x={label.x}
            y={label.y}
            textAnchor="middle"
            fontSize={fontSize}
          >{labelForObject(object)}</text>
        </g>
      })}
    </g>
    {showCenter && <g className="solution-center seiza-overlay__center">
      <circle cx={width / 2} cy={height / 2} r={fontSize} />
      <path d={`M ${width / 2 - fontSize * 1.7} ${height / 2} H ${width / 2 + fontSize * 1.7} M ${width / 2} ${height / 2 - fontSize * 1.7} V ${height / 2 + fontSize * 1.7}`} />
    </g>}
  </svg>
}

function objectKey(object: OverlayObject, index: number) {
  return object.stable_id
    ?? `${object.source ?? object.kind}-${object.name}-${object.x}-${object.y}-${index}`
}

function objectColor(object: OverlayObject) {
  if (object.kind === 'comet') return 'var(--seiza-overlay-comet-color, #7bffd0)'
  if (object.kind === 'asteroid') return 'var(--seiza-overlay-asteroid-color, #ffb36b)'
  if (object.kind === 'transient') return 'var(--seiza-overlay-transient-color, #ff7be0)'
  if (object.kind === 'identified-star') return 'var(--seiza-overlay-identified-star-color, #b7a6ff)'
  if (object.kind === 'star' || object.kind === 'double-star') {
    return 'var(--seiza-overlay-named-star-color, #ffd479)'
  }
  return 'var(--seiza-overlay-deep-sky-color, #5fd3ff)'
}

function themeVariables(theme: OverlayTheme | undefined): ThemeStyle {
  if (!theme) return {}
  return {
    '--seiza-overlay-grid-color': theme.gridColor,
    '--seiza-overlay-grid-label-color': theme.gridLabelColor,
    '--seiza-overlay-field-star-color': theme.fieldStarColor,
    '--seiza-overlay-deep-sky-color': theme.deepSkyColor,
    '--seiza-overlay-named-star-color': theme.namedStarColor,
    '--seiza-overlay-identified-star-color': theme.identifiedStarColor,
    '--seiza-overlay-transient-color': theme.transientColor,
    '--seiza-overlay-comet-color': theme.cometColor,
    '--seiza-overlay-asteroid-color': theme.asteroidColor,
    '--seiza-overlay-center-color': theme.centerColor,
    '--seiza-overlay-label-halo-color': theme.labelHaloColor,
    '--seiza-overlay-encompassing-color': theme.encompassingColor,
    '--seiza-overlay-grid-stroke-width': theme.gridStrokeWidth,
    '--seiza-overlay-marker-stroke-width': theme.markerStrokeWidth,
    '--seiza-overlay-moving-marker-stroke-width': theme.movingMarkerStrokeWidth,
    '--seiza-overlay-field-star-stroke-width': theme.fieldStarStrokeWidth,
    '--seiza-overlay-center-stroke-width': theme.centerStrokeWidth,
    '--seiza-overlay-grid-opacity': theme.gridOpacity,
    '--seiza-overlay-marker-opacity': theme.markerOpacity,
    '--seiza-overlay-grid-dasharray': theme.gridDasharray,
    '--seiza-overlay-label-font-family': theme.labelFontFamily,
    '--seiza-overlay-grid-font-family': theme.gridFontFamily,
    '--seiza-overlay-label-font-weight': theme.labelFontWeight,
    '--seiza-overlay-grid-font-weight': theme.gridFontWeight,
    '--seiza-overlay-label-halo-width': theme.labelHaloWidthEm == null
      ? undefined
      : `${theme.labelHaloWidthEm}em`,
  }
}

export type {
  OverlayLayerVisibility,
  OverlayObject,
  OverlaySolution,
  OverlayTheme,
} from './types.js'
