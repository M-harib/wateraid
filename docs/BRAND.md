# GrantGuard brand guide

The look and voice of the GrantGuard frontend. It documents the water theme on `feat/water-theme` (`frontend/src/theme.css`) and marks additions that are **proposed** but not built yet. When code and this guide disagree, fix one of them in the same PR.

## 1. Character

GrantGuard is an evidence desk for grant staff: calm, exact and trustworthy. Water appears as a quiet line motif, never as decoration that competes with the documents. The source page is always the most important thing on screen.

Avoid the look we moved away from: black backgrounds with mint green, pixel or "signal" animations, all-caps monospace navigation. `design/design-3.png` and `design/design-4.png` show it; do not use them as references.

## 2. Voice

| Do | Don't |
| --- | --- |
| "Potential issue: review required" | "Non-compliant", "Approved", "Certified" |
| "Not found in the provided documents. Searched: 03, 04." | A guess, or silence |
| "Who decides: GAC" / "Who decides: Water Care staff" | Resolving a conflict on the user's behalf |
| Sentence case for buttons, headings and labels | Title Case or ALL CAPS (except the small eyebrow label) |
| Plain verbs: Confirm, Correct, Dismiss, Escalate, Request clarification | "Submit", "Send to GAC" (the tool never submits) |

Formats:
- **Dates:** `15 May 2023` in the UI, ISO `2023-05-15` in data.
- **Locators:** `03 · App. D §4.12 · p.16` or `05 · PMF!E14`.
- **Names:** use each source's own name (Water Care in the pack; GrantGuard for the product).

## 3. Logo

- **Mark:** a water droplet with an inner highlight stroke and two ripple lines (`BrandMark` in `frontend/src/Brand.tsx`). It sits on a `--button` tile with a 7px radius; the drop takes `--button-text`, the highlight takes `--mark-stroke`. Both swap correctly in dark mode.
- **Wordmark:** "GrantGuard" in the UI font, `--ink`, letter-spacing about −0.05em, 10px from the mark. Weight is 680 on the landing and 750 on the project hub today; standardise on 700.
- **Minimum size:** 24px tile. Keep clear space of half the tile width on every side.
- **Don't:** recolour the mark green, add a gradient, outline it, or place it on a photo.
- **Favicon (fix needed):** `public/favicon.svg` uses `#0e759f` / `#daf5ff`, a teal that appears nowhere else. Redraw it with `--button` (`#20242b`) and white, or with `--accent` (`#245ac2`) and white, so the tab matches the app.

## 4. Colour

### Brand tokens (built)

| Token | Light | Dark | Use |
| --- | --- | --- | --- |
| `--page` | `#f7f8fa` | `#101216` | App background |
| `--surface` | `#ffffff` | `#181b20` | Cards, panels, header |
| `--surface-soft` | `#f1f3f5` | `#22262d` | Wells, PDF backdrop, chips |
| `--surface-raised` | `#fafbfc` | `#1c2026` | Inputs, secondary buttons |
| `--ink` | `#20242b` | `#f0f1f3` | Body text, headings, wave lines |
| `--muted` | `#626a76` | `#b0b7c2` | Secondary text |
| `--subtle` | `#737d89` → **`#666f7b`** | `#959eab` | Placeholders, small notes (see Accessibility) |
| `--accent` | `#245ac2` | `#a5c0f7` | Links, focus ring, selected state, icons |
| `--accent-hover` | `#19489e` | `#c5d6fb` | Hover on accent |
| `--accent-soft` | `#edf2fc` | `#252f43` | Selected backgrounds, icon tiles |
| `--border` | `#e2e5e9` | `#30353e` | 1px rules and outlines |
| `--button` | `#20242b` | `#f0f1f3` | Primary button fill, logo tile |
| `--button-text` | `#ffffff` | `#161a22` | Text on primary buttons |

Rules:
- **One accent.** Blue marks interaction and selection only. Primary buttons are ink (`--button`), not blue; that keeps the blue meaningful.
- **Use tokens only.** `#125377` (toast) and `#071f31ba` (modal backdrop) in `theme.css` should become tokens (`--toast`, `--backdrop`) with dark values.
- **No green in the brand.** Green is reserved for "verified" (below).

### Status tokens (proposed, not built)

Today every status renders in the accent blue, so an overdue item looks the same as a selected one. Add these and use them only for status. Text colour sits on its own soft fill; contrast is at least 5.6:1 in both themes.

| Status | Token pair | Light (text / fill) | Dark (text / fill) |
| --- | --- | --- | --- |
| Overdue, conflict | `--danger` / `--danger-soft` | `#9b1c1c` / `#fdecec` | `#f5b4b4` / `#3a1f22` |
| Needs review | `--warning` / `--warning-soft` | `#8a4b00` / `#fdf3e1` | `#f3c98b` / `#3a2c17` |
| Insufficient evidence, not found | `--neutral` / `--surface-soft` | `#4f5763` / `#f1f3f5` | `#b0b7c2` / `#22262d` |
| Quote verified | `--success` / `--success-soft` | `#1e6b45` / `#e8f5ee` | `#9ad8b5` / `#1d3328` |
| Who decides, info | `--accent` / `--accent-soft` | `#245ac2` / `#edf2fc` | `#a5c0f7` / `#252f43` |

Always pair a status colour with a text label (and an icon where space allows). Red and green have similar lightness, so colour alone never carries meaning.

## 5. Typography

- **Family:** `Inter, "Avenir Next", "Helvetica Neue", Arial, sans-serif` (set in `styles.css`). Inter is **not loaded** today, so most machines show Avenir or Helvetica. Either self-host Inter (fontsource) or accept the fallback; decide once and note it in `docs/DECISIONS.md`.
- **Locators** may use `ui-monospace, "SF Mono", Menlo, monospace` at 12px+. Monospace is for locators only, never navigation.

| Style | Size | Weight | Tracking | Line height |
| --- | --- | --- | --- | --- |
| Hero (landing h1) | `clamp(48px, 5.6vw, 80px)` | 500 | −0.065em | 1.06 |
| Section heading | `clamp(34px, 3.6vw, 48px)` | 500 | −0.05em | 1.12 |
| Body | 16px | 400 | 0 | 1.75 (landing), 1.5 (app) |
| Button | 13px | 600 | 0 | 1.4 |
| Eyebrow label | 12px minimum, uppercase | 600 | 0.14em | 1.4 |

Large headings are light (500) with tight tracking; emphasis inside a heading uses `--muted`, not italics or colour.

## 6. Shape and depth

- **Radius:** 7px for buttons, inputs, toggles and the logo tile; 9–12px for cards and panels. Status chips are fully rounded.
- **Borders:** 1px `--border`. Prefer a border to a shadow.
- **Shadow:** one soft shadow (`0 18px 45px var(--shadow)`) for raised previews and dialogs only.
- **Spacing:** a 4px base; 24px gutters on mobile, 32px on desktop; content max-width 1240px.

## 7. The water motif

- **What it is:** fine contour lines (`.hero-wave-field`): stroke `--ink`, 0.65px, non-scaling, opacity 0.48 in light and 0.33 in dark.
- **Where:** the landing hero and the top edge of prominent cards (project, onboarding, overview).
- **Never on reading surfaces:** PDF pages, evidence quotes, tables and forms stay plain and rectangular.
- **Don't:** fill the waves, add blue gradients, animate them, or add droplet or bubble icons elsewhere.
- **Motion:** respect `prefers-reduced-motion` (already in `theme.css`).

## 8. Light and dark

Light is the default. The toggle saves the choice in the browser (`grantguard.theme.v1`), and `index.html` applies it before React renders. Every new colour needs a dark value in `html[data-theme='dark']`. The PDF canvas always keeps the source document's own colours.

## 9. Accessibility checklist

- Text contrast at least 4.5:1. `--subtle` `#737d89` measures 3.93:1 on `--page`; change it to `#666f7b` (4.79:1). Every other text token passes in both themes.
- No text smaller than 12px. The landing eyebrow (10px, 8px on mobile) and the preview mock text (8–9px) are below this.
- Touch targets at least 44px. The theme toggle is 36px; raise it to 44px.
- A visible focus ring (`--accent` outline) on every interactive element.
- Colour is never the only signal (see Status tokens).

## 10. Fix list for the frontend

1. Change `--subtle` to `#666f7b` in light mode.
2. Add the status tokens and apply them to priority and state chips.
3. Redraw the favicon in brand tokens.
4. Turn the toast and backdrop colours into tokens with dark values.
5. Load Inter or confirm the fallback.
6. Raise the 8–10px labels to 12px and the theme toggle to 44px.
7. Remove the old green values still in `styles.css` (8 uses of `#1c3426`, `#0c6a4c`, `#11744e`, `#5bd5a3`, `#4acb91`, `#28b987`). `theme.css` overrides most of them, but any selector it misses still shows green.
