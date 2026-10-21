# Optimus design system

Optimus should feel calm and deliberate, like a well-made notebook. These rules keep new screens consistent with the rest of the app.

## Principles

- **One question per screen.** Each page has one primary job. Secondary information sits in a side column or behind a tab.
- **One accent.** Ultramarine (`brand-500`, `#3346d3`) marks the primary action, the current selection, focus and "now". Avoid gradients, coloured card backgrounds and decorative colour.
- **Colour means something.** Red marks danger or urgency, green marks done, amber marks a warning, and a project's own colour appears only as a small chip or edge.
- **Type sets the hierarchy, not boxes.** Use the serif for titles, Geist for interface text and mono for figures, dates and overlines. Separate content with whitespace and hairline dividers before adding cards.

## Typography

| Use | Font | Utility |
| --- | --- | --- |
| Page titles, greeting, note and task titles | Instrument Serif | `text-title`, `text-display` |
| Section and card headings | Geist (medium) | `text-h2` – `text-h4` |
| Interface and body text | Geist | `text-body`, `text-body-sm`, `text-sm` |
| Dates, counts, keyboard hints, overlines | Geist Mono | `font-mono`, `text-overline` |

The base sizes are reduced in `@theme` (`text-sm` is 13px and `text-xs` is 12px), and the bold weight is mapped to 600. Avoid text smaller than 11px.

## Colour tokens

Tokens live in `src/app/globals.css`. Light mode uses `:root, [data-theme="light"]` and dark mode uses `[data-theme="dark"]`. Components must use the semantic names so both modes work. The signed-out screens in `app/(auth)` are always light: the root theme script skips the saved appearance on those paths, and `AuthFrame` sets `data-theme="light"`.

- Surfaces: `bg-canvas` (behind the sheet), `bg-surface`, `bg-surface-secondary`, `bg-surface-tertiary`
- Lines: `border-border`, `border-border-subtle`, `border-border-strong`
- Text: `text-heading`, `text-body`, `text-muted`, `text-placeholder`
- Accent: `bg-primary`, `text-primary`, `brand-50` … `brand-900`
- Status: `danger`, `success`, `warning`, `info`, each with a `-subtle` background

The `neutral-*` scale is ordered from the strongest ink (`neutral-0`) to the lightest paper (`neutral-950`) in both modes. Prefer the semantic tokens above.

## Layout

- The sidebar sits on `canvas`; each page renders inside one sheet (`.app-sheet`).
- Use `.page` for scrolling documents (Today, Projects, Settings) and `.page-fill` for full-height work surfaces (Calendar, Notes).
- `PageHeader` provides the serif title, a one-line description, quiet `PageHeaderStat` figures and the page actions.
- Radii: 6px for controls, 8–10px for cards, 14px for dialogs. Shadows are for floating layers only (menus, dialogs, toasts).
- Editing happens in a right-hand sheet (`<Modal placement="right">`). Centred dialogs are for short confirmations and quick capture.

## Components

Use the primitives in `src/components/ui` before writing new controls: `Button` (primary, secondary, ghost, danger), `Input`, `Textarea`, `Select`, `Checkbox`, `Toggle`, `Tabs` (segmented or underline), `Badge`, `Modal`, `Dropdown`, `Tooltip`, `Toast`, `EmptyState`, `ErrorState`, `Avatar` and `Spinner`. Icons come from `lucide-react` at `strokeWidth` 1.75 (the default) and a size of 14–16px.

## CSS gotchas

- **Keep `@layer base` and `@layer components` as single blocks, directly after `@import "tailwindcss"`.** The build pipeline flattens a second block of the same layer, which removes it from the layer. Unlayered CSS then beats every Tailwind utility, so classes such as `border-transparent` stop working.
- Never add unlayered element selectors such as `input { … }` or `button { … }` to `globals.css`, for the same reason.
- `cn()` in `src/lib/utils.js` only joins class names; it does not resolve conflicts. Don't pass a second `display`, `padding` or colour class to a component that already sets one. Add a prop or put the responsive variant inside the component instead.
- Excalidraw brings its own stylesheet (`@excalidraw/excalidraw/index.css`), and `globals.css` isolates it from the app's base styles.

## Lancehawks brand

- `LancehawksMark` (`src/components/brand/LancehawksMark.js`) draws the crest (wings only) or the full logo with its wordmark, in the brand navy `#2c4c87` by default.
- The marks are transparent masks in `public/brand/`, cut from `public/Lancehawks Logo.png`, so they can take any colour. Keep them at 270px wide or less; larger sizes upscale the source.
- The sign-in screens pair the Optimus wordmark with the Lancehawks crest, and the panel carries the motto "Carpe diem." with a year-at-a-glance grid.

## Founder Lobby

The Founder Lobby uses the same tokens. `src/components/founder/styles/theme.module.css` maps its `--founder-*` variables onto the app tokens, so it follows the app's light or dark appearance and has no theme picker of its own.
