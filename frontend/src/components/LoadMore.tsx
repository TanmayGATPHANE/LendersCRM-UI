import { useEffect, useRef, useState } from "react";

/**
 * Windowed rendering for the long lists (the scrollable-entries fix):
 * a page renders the first PAGE_SIZE rows and grows by one chunk at a
 * time — through the "Show more" button, or automatically the moment the
 * button scrolls into view, so flicking through 2,000 ledger rows never
 * lays them all out at once. The count resets whenever the underlying
 * collection changes (filter, search, refresh).
 */

/** Rows a list view renders before "Show more" takes over. */
export const PAGE_SIZE = 50;

/** Paged visibility over `total` rows: [how many to render, load more]. */
export function useChunkedRows(total: number): [number, () => void] {
  const [visible, setVisible] = useState(PAGE_SIZE);
  useEffect(() => setVisible(PAGE_SIZE), [total]);
  return [visible, () => setVisible((v) => v + PAGE_SIZE)];
}

/**
 * The "Show more" footer of a windowed list — a real button the user can
 * click, which also auto-advances when it scrolls into view (the
 * IntersectionObserver sees through any clipping scroll container, so no
 * need to guess which element is the scroller). Renders nothing once the
 * list is exhausted; with the windowed list it can never load forever,
 * because the button leaves the viewport before the next chunk would.
 */
export function LoadMore({ visible, total, onMore }: {
  visible: number;
  total: number;
  onMore: () => void;
}) {
  const ref = useRef<HTMLDivElement | null>(null);
  const more = useRef(onMore); // stable for the observer, fresh per render
  more.current = onMore;
  const remaining = total - visible;

  useEffect(() => {
    const el = ref.current;
    if (!el || remaining <= 0) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) more.current();
      },
      { rootMargin: "240px" }
    );
    io.observe(el);
    return () => io.disconnect();
  }, [remaining]);

  if (remaining <= 0) return null;
  const next = Math.min(PAGE_SIZE, remaining);
  return (
    <div ref={ref} className="flex items-center justify-center gap-2 border-t border-line bg-card px-3 py-2.5">
      <button
        type="button"
        onClick={onMore}
        className="flex cursor-pointer items-center gap-1.5 rounded-lg border border-line px-3 py-1.5 text-sm text-primary
                   transition-colors duration-300 ease-brand hover:bg-tint
                   focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
      >
        <i className="ph ph-caret-down text-base" aria-hidden="true" />
        Show {next} more
        <span className="text-xs text-muted">· {remaining} rows left</span>
      </button>
    </div>
  );
}