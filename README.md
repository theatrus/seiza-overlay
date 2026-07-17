# `@seiza/astro-overlay`

Reusable astronomical image overlays for Seiza-based applications, published
as `@seiza/astro-overlay`.

The library deliberately keeps rendering separate from application chrome:

- `@seiza/astro-overlay` provides response types, layer classification,
  prominence-based density selection, WCS transforms, coordinate-grid geometry,
  marker geometry, projected catalog contours, and conservative rendering for
  catalog ellipses whose orientation is unknown.
- `@seiza/astro-overlay/react` provides the SVG-only `AstroOverlay` component.
  It renders no buttons or panels and does not fetch data.
- `@seiza/astro-overlay/export` serializes the live SVG and composites it over a
  raster image as a PNG. Applications may add their own canvas decorations.

## Usage

```tsx
import {
  defaultOverlayDensity,
  defaultOverlayLayers,
  defaultOverlayTheme,
} from '@seiza/astro-overlay'
import { AstroOverlay } from '@seiza/astro-overlay/react'

<div className="image-frame">
  <img src={previewUrl} alt="" />
  <AstroOverlay
    solution={solution}
    layers={{ ...defaultOverlayLayers, field_stars: false }}
    density={defaultOverlayDensity}
    theme={{
      ...defaultOverlayTheme,
      labelFontWeight: 450,
      markerStrokeWidth: 0.75,
    }}
  />
</div>
```

The production defaults use normal-weight object labels (`400`), medium grid
labels (`500`), a `0.1em` label halo, `0.7px` object markers, and a `0.6`
prominence density. Stroke widths, font weights, halo width, opacity, colors,
font families, and density are all typed overrides. The corresponding stable
CSS custom properties remain available for application stylesheets.

The application owns the transformed image container, controls, control
placement, layer persistence, API calls, and branding. Stable
`seiza-overlay__*` classes and CSS custom properties allow application styling;
the `theme` prop is preferred when browser PNG exports must exactly match the
interactive overlay.

```tsx
import { downloadBlob, renderOverlayPng } from '@seiza/astro-overlay/export'

const png = await renderOverlayPng({
  background: fullResolutionBlob,
  overlay: overlayElement,
  width: solution.image_width,
  height: solution.image_height,
  decorate: (context, size) => drawApplicationWatermark(context, size),
})
downloadBlob(png, 'solved-field.png')
```

See [the design document](docs/design.md) for package boundaries and adapters
for seiza-server, Tenrankai, and PSF Guard.

## Development

Node.js 20 or newer is required.

```sh
npm ci
npm run check
npm pack --dry-run
```

The package is Apache-2.0 licensed.
