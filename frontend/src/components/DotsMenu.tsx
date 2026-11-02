import { useEffect, useRef, useState } from "react";
import { ghostIconBtnCls } from "./ui.ts";

/** One row action of the ⋮ menu. `danger` tints the label red (Release),
    `hidden` filters an item out entirely (e.g. Release on released rows). */
export interface MenuItem {
  label: string;
  /** Click — the menu closes first, then this runs. */
  onClick: () => void;
  danger?: boolean;
  hidden?: boolean;
}

/**
 * DotsMenu — the "⋮" row action. Shows a small dropdown of the given items.
 *
 * items: [{ label, onClick, hidden }]  — `hidden` filters an item out
 * (pages use this to hide e.g. Release on released rows).
 * Clicking anywhere outside closes the menu.
 */
interface Props {
  items: MenuItem[];
}

export default function DotsMenu({ items }: Props) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Register a one-time document listener while the menu is open.
  useEffect(() => {
    if (!open) return;
    // e.target is the deepest node clicked; contains() wants a Node.
    const onOutsideClick = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onOutsideClick);
    return () => document.removeEventListener("mousedown", onOutsideClick);
  }, [open]);

  const visible = items.filter((i) => !i.hidden);
  if (visible.length === 0) return null; // no actions -> no dots

  return (
    <div ref={ref} className="relative inline-block">
      <button
        onClick={() => setOpen(!open)}
        className={ghostIconBtnCls}
        aria-label="Row actions"
      >
        <i className="ph ph-dots-three-vertical text-lg" aria-hidden="true" />
      </button>
      {open && (
        <div
          className="anim-pop-in absolute right-0 z-30 mt-1 w-32 origin-top-right overflow-hidden rounded-lg border border-line bg-card shadow-md
                     divide-y divide-line"
        >
          {visible.map((item) => (
            <button
              key={item.label}
              onClick={() => {
                setOpen(false);
                item.onClick();
              }}
              className={`flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-tint
                          focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset
                          focus-visible:ring-primary/40 ${
                item.danger ? "text-red-600" : "text-slate"
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}