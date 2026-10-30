import type { ReactNode } from "react";

/**
 * Modal — light overlay with a centered card. Renders nothing when `open`
 * is false. Close on scrim click or the ✕ button; pages own what's inside.
 * Pass `wide` for content-heavy dialogs (e.g. the customer History view).
 */
interface Props {
  open: boolean;
  title: string;
  /** Closes on the ✕ and, via the scrim, on any outside click. */
  onClose: () => void;
  wide?: boolean;
  children: ReactNode;
}

export default function Modal({ open, title, onClose, wide = false, children }: Props) {
  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/45 backdrop-blur-[2px]"
      onClick={onClose}
    >
      <div
        className={`w-full rounded-2xl bg-card shadow-2xl ring-1 ring-line ${wide ? "max-w-3xl" : "max-w-xl"}`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between gap-4 border-b border-line px-5 py-4">
          <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
          <button
            onClick={onClose}
            className="rounded-md p-1 text-muted hover:bg-tint-hover hover:text-ink"
            aria-label="Close"
          >
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>
        {/* Body — table-scroll keeps the gutter so content doesn't shift
            when a long dialog body starts scrolling */}
        <div className="table-scroll max-h-[75vh] overflow-y-auto p-5">{children}</div>
      </div>
    </div>
  );
}