// Shared Tailwind class strings so forms look identical on every page.

/** The single motion recipe: colors shift on the brand curve, never a
    browser-default ease. */
const MOVE = "transition-colors duration-300 ease-brand";

/** Class for text/number/date inputs — ONE 36px control height across the
    app, so toolbar rows, filters and dialog fields all line up. */
export const inputCls =
  "h-9 w-full rounded-lg border border-line bg-tint px-3 text-sm " +
  "placeholder:text-dim " + MOVE + " " +
  "focus:bg-card focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20";

/** Same recipe as inputCls for <select> elements (month/year filters). */
export const selectCls =
  "h-9 rounded-lg border border-line bg-tint px-2.5 text-sm text-slate " +
  "hover:bg-tint-hover cursor-pointer " + MOVE + " " +
  "focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20";

/** Class for field labels above inputs. */
export const labelCls = "text-xs font-medium uppercase tracking-wider text-slate";

/** Class for primary (teal) buttons — Button-sm: 14/20 semibold. */
export const primaryBtnCls =
  "inline-flex h-9 items-center gap-1.5 rounded-lg bg-primary px-3 text-sm font-semibold " +
  "text-on-primary shadow-sm hover:bg-primary-hover hover:shadow-md active:bg-primary-press " +
  "active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 " +
  "focus-visible:ring-primary/40 focus-visible:ring-offset-2 focus-visible:ring-offset-card " +
  "transition duration-300 ease-brand";

/** Class for secondary (plain) buttons. */
export const secondaryBtnCls =
  "inline-flex h-9 items-center gap-1.5 rounded-lg border border-line bg-tint px-3 " +
  "text-sm font-semibold text-slate hover:bg-tint-hover hover:text-ink hover:shadow-sm " +
  "active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 " +
  "focus-visible:ring-primary/40 focus-visible:ring-offset-2 focus-visible:ring-offset-card " +
  "transition duration-300 ease-brand";

/** Square icon-only button for toolbars — same skin as the secondary
    button, same 36px height, no text padding (so it aligns with the row). */
export const iconBtnCls =
  "inline-flex h-9 w-9 items-center justify-center rounded-lg border border-line bg-tint " +
  "text-slate hover:bg-tint-hover hover:text-ink hover:shadow-sm " +
  "active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 " +
  "focus-visible:ring-primary/40 focus-visible:ring-offset-2 focus-visible:ring-offset-card " +
  "transition duration-300 ease-brand disabled:opacity-60 disabled:pointer-events-none";

/** Class for small icon-only buttons (row ⋮, dialog ✕, header bell…). */
export const ghostIconBtnCls =
  "rounded-md p-1 text-muted hover:bg-tint-hover hover:text-ink " +
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 " +
  "transition-colors duration-300 ease-brand";

/** Class for destructive (red) buttons — deletes remove money history,
    so the confirm verb is a different color, not a second teal. */
export const dangerBtnCls =
  "inline-flex items-center gap-1.5 rounded-lg bg-red-600 px-3 py-2 text-sm font-semibold " +
  "text-white shadow-sm hover:bg-red-700 active:bg-red-800 " +
  "active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 " +
  "focus-visible:ring-red-500/40 focus-visible:ring-offset-2 focus-visible:ring-offset-card " +
  "transition duration-300 ease-brand disabled:opacity-60";