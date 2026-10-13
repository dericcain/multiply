# Mastery badges

Five original transparent SVGs in `public/badges/`, matching the site’s rounded purple, mint, blue, coral, and gold visual language. Open `preview.html` for the full set and size checks.

| Level | Asset | Mastery | Motif |
| --- | --- | --- | --- |
| Starter | `starter.svg` | 0% | Golden star on mint shield |
| Explorer | `explorer.svg` | 10% | Compass on sky blue shield |
| Builder | `builder.svg` | 25% | Colorful building blocks on coral shield |
| Expert | `expert.svg` | 50% | Lightning bolt and purple wings |
| Math Genius | `math-genius.svg` | 100% | Crown, faceted gem, gold wings and laurels |

All badges share a 160 × 160 viewBox, rounded outlines, and one to five stars. SVGs contain accessible titles and descriptions, no fonts, external assets, scripts, or animation. Recommended display size: 64px or larger; 24px is suitable as a supporting icon beside a written level name. Keep labels outside the artwork so they remain readable and localizable. IDs are prefixed per badge; if embedding the same SVG inline more than once, use unique title/description IDs per instance or use an image element.

The application now displays these badges behind the `mastery-badges` Vercel flag: on player-selection cards, beside family standings, and prominently in the activity/results mastery card. An expandable five-badge shelf shows unlocked levels and dimmed future levels. Current mastery determines the badge; this implementation does not change scoring or make levels permanent. See [integration and verification](integration.md).
