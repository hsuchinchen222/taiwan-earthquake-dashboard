# Visual and data QA

## Reference and captured states

- Reference: `artifacts/design-reference.jpeg`, copied from `/workspace/scratch/b3134020c807/upload/E5EEF73D-11CC-4007-B337-D7E39FAD900D(1).jpeg` (1536 × 864 px).
- Desktop, default data: `artifacts/dashboard-desktop-full.png` (1536 × 864 px; 39 records, no filters).
- Mobile, default data: `artifacts/dashboard-mobile-full.png` (390 × 2145 px; captured at a 390 × 844 px viewport).
- Event detail: `artifacts/dashboard-detail-dialog.png` (1536 × 864 px; CWA record `2025-007`, M6.4, depth 15.8 km).

The desktop layout preserves the reference's title and date band, five KPI cards, three chart panels, five colored insight cards, and green sample note. At 1536 × 864 the full dashboard fits the viewport. At 390 px the panels stack vertically and the document has no horizontal overflow.

## Data and interaction checks

`npm run check:data` independently checks the supplied CSV and passes all nine assertions:

- 39 unique records, maximum M7.0, and maximum intensity 6弱.
- Monthly peak: 2025/01 with 7 records.
- Pearson magnitude/depth: 0.446225…; Spearman magnitude/intensity: 0.156021….
- Maximum depth: 113.9 km; 50 km connected components: 19, 13, 5, 1, 1.

Playwright with local Chromium verified the development server and the built `vite preview`: both return HTTP 200, render all three charts and the 39-record KPI, and produce zero browser errors. The filter/detail results were:

| Interaction | Result |
|---|---:|
| East-region filter | 19 records |
| January 2025 filter | 7 records |
| East + January 2025 | 1 record |
| East + February 2025 | 0 records and three empty chart states |
| Minimum magnitude M6.0 | 6 records |
| Scatter point click | Opens event `2025-007` with its Central Weather Administration source URL |

The region chart shows 48.7%, 33.3%, 12.8%, and 5.1%. The scatter plot uses a dynamic depth axis capped at 125 km with 25 km ticks because the CSV's deepest event is 113.9 km; the reference mockup's 250 km axis does not match these records. The header shows the filename's analysis window (2024/09/25–2026/09/25), while the note shows actual event-row coverage (2024/10/16–2026/09/22).

## Fixes made during review

- Kept the file's analysis window separate from the first and last event dates in the CSV.
- Made donut labels use one decimal place and set depth-axis ticks from the CSV-derived range.
- Condensed the sample caveat into the existing green note so the full desktop page fits the reference viewport.
- Hide the chart hover tooltip when an event detail dialog opens.

## Verification limits

- This Linux test container has no Traditional Chinese font installed (`fontconfig` reports no `zh` font). Chromium therefore captured Chinese glyphs as empty boxes even though the text is present in the page and its DOM values match the CSV. The application uses system fallbacks for Noto Sans TC, PingFang TC, and Microsoft JhengHei; glyph appearance could not be confirmed in this container. A Chinese-capable system font is needed for a readable local Linux capture.
- `npm run build` succeeds. Vite reports the lazy ECharts chunk at 552.27 kB minified (186.96 kB gzip); this is a size warning, not a build failure.
- This remains a static dashboard backed by the supplied sample CSV. It has no live API, complete earthquake catalogue, geographic basemap, or deployment. No remote repository write or public release was performed.
