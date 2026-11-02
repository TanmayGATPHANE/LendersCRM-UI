// Shared Tailwind class strings so forms look identical on every page.

/** The single motion recipe: colors shift on the brand curve, never a
    browser-default ease. */
const MOVE = "transition-colors duration-300 ease-brand";

/** Class for text/number/date inputs. */
export const inputCls =
  "w-full rounded-lg border border-line bg-tint px-3 py-1.5 text-sm " +
  "placeholder:text-dim " + MOVE + " " +
  "focus:bg-card focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20";

/** Same recipe as inputCls for <select> elements (month/year filters). */
export const selectCls =
  "rounded-lg border border-line bg-tint px-2.5 py-2 text-sm text-slate " +
  "hover:bg-tint-hover cursor-pointer " + MOVE + " " +
  "focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20";

/** Class for field labels above inputs. */
export const labelCls = "text-xs font-medium uppercase tracking-wider text-slate";

/** Class for primary (teal) buttons — Button-sm: 14/20 semibold. */
export const primaryBtnCls =
  "inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-sm font-semibold " +
  "text-on-primary shadow-sm hover:bg-primary-hover hover:shadow-md active:bg-primary-press " +
  "active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 " +
  "focus-visible:ring-primary/40 focus-visible:ring-offset-2 focus-visible:ring-offset-card " +
  "transition duration-300 ease-brand";

/** Class for secondary (plain) buttons. */
export const secondaryBtnCls =
  "inline-flex items-center gap-1.5 rounded-lg border border-line bg-tint px-3 py-2 " +
  "text-sm font-semibold text-slate hover:bg-tint-hover hover:text-ink hover:shadow-sm " +
  "active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 " +
  "focus-visible:ring-primary/40 focus-visible:ring-offset-2 focus-visible:ring-offset-card " +
  "transition duration-300 ease-brand";

/** Class for small icon-only buttons (row ⋮, dialog ✕, header bell…). */
export const ghostIconBtnCls =
  "rounded-md p-1 text-muted hover:bg-tint-hover hover:text-ink " +
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 " +
  "transition-colors duration-300 ease-brand";