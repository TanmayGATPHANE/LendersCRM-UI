// Shared Tailwind class strings so forms look identical on every page.

/** Class for text/number/date inputs. */
export const inputCls =
  "w-full rounded-lg border border-line bg-tint px-3 py-1.5 text-sm " +
  "placeholder:text-dim " +
  "focus:bg-card focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20";

/** Class for field labels above inputs. */
export const labelCls = "text-xs font-medium uppercase tracking-wider text-slate";

/** Class for primary (teal) buttons. */
export const primaryBtnCls =
  "inline-flex items-center gap-1.5 rounded-lg bg-primary px-3.5 py-2 text-sm font-medium " +
  "text-on-primary shadow-sm hover:bg-primary-hover active:bg-primary-press";

/** Class for secondary (plain) buttons. */
export const secondaryBtnCls =
  "inline-flex items-center gap-1.5 rounded-lg border border-line bg-tint px-3.5 py-2 " +
  "text-sm text-slate hover:bg-tint-hover";