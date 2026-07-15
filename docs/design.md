# Reusable astrometry overlay package

The SVG overlay and browser PNG export are shared application infrastructure,
not seiza-server page components. This repository is their canonical home and
will publish `@seiza/astro-overlay` under Apache-2.0. Seiza-server retains a
temporary vendored snapshot until the first npm release is available.

Both `@seiza/astro-overlay` and `seiza-overlay` were unclaimed on npm when this
package was created. The scoped name makes the relationship to the Seiza Rust
library explicit and leaves room for future sibling packages.

## Package boundary

The package owns:

- the shared WCS, solution, and projected-object TypeScript contract;
- default semantic layers and object counting;
- prominence-based label-density selection from Tenrankai;
- TAN pixel/world transforms and unclipped RA/Dec grid geometry from
  seiza-server;
- deep-sky, stellar, transient, comet, asteroid, field-star, and center marker
  SVG geometry;
- label collision handling and frame-encompassing captions; and
- live-SVG serialization plus browser canvas PNG compositing.

The consuming application owns:

- HTTP requests, caching, progress, and error states;
- buttons, menus, control placement, and preference persistence;
- image zoom/pan layout and the transformed container holding image plus SVG;
- the catalog-to-layer resolver when its groups differ from the defaults; and
- branding, watermarks, and other PNG decorations.

The split is deliberate. Tenrankai can retain its catalog dropdown and density
slider, seiza-server can retain its explicit layer buttons, and PSF Guard can
place controls in its image-detail toolbar without forking the rendering code.

## Public entry points

| Import | Responsibility |
| --- | --- |
| `@seiza/astro-overlay` | Types, layer selection, density, WCS and grid geometry |
| `@seiza/astro-overlay/react` | SVG-only `AstroOverlay` component |
| `@seiza/astro-overlay/export` | SVG serialization, raster compositing, PNG download helper |

The SVG exposes stable `seiza-overlay__*` classes and CSS custom properties.
The React `theme` prop writes those variables inline so the same values survive
SVG serialization. External layout CSS may position the SVG anywhere; the
component itself does not set absolute positioning or z-index.

## Application adapters

Seiza-server already speaks the package's canonical `image_width`,
`image_height`, `wcs`, and `objects` response. Its local adapter only translates
camel-case UI toggle state to semantic snake-case layer IDs.

PSF Guard's in-flight `AstrometrySolutionResponse` is a compatible superset,
including stable IDs, aliases, hierarchy, and provenance. It can consume the
component directly when its WCS phase lands.

Tenrankai currently returns `width`, `height`, `scale_arcsec_px`, and a reduced
object shape. Its fetch hook should normalize those three field names once and
provide a WCS when available. Its name-prefix catalog grouping belongs in an
application `layerForObject` callback; its controls remain unchanged.

## Release

Before the first public release, confirm ownership of the `@seiza` npm scope and
configure npm trusted publishing for this repository's `release.yml` workflow.
The manual release workflow defaults to a dry run and validates that its version
matches `package.json`; the explicit non-dry-run path publishes with provenance
and creates the matching GitHub release. After publication, replace
seiza-server's `file:` dependency with the released version and adopt it
independently in Tenrankai and PSF Guard.

Keeping a single package with subpath exports is preferable to three packages
at this size: it preserves one versioned geometry contract while React remains
an optional peer dependency for consumers that only need core calculations or
PNG export.
