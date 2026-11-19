/**
 * Skeleton — the loading shape of what is ABOUT to render (not a spinner):
 * grey blocks that pulse where rows, cards, tiles and text will appear.
 * B9 / the skills: loaders mirror the real layout so the page never jumps
 * when data arrives. Pure opacity pulse — respects prefers-reduced-motion
 * via index.css (blocks settle at ~60% and stop moving).
 */
export function Skeleton({ className = "" }: { className?: string }) {
  return <div aria-hidden="true" className={`skeleton h-3.5 rounded-md ${className}`} />;
}

/** Table body placeholder: rows of grey blocks the width of money,
    names and items — dropped straight into a <tbody> or a loading card.
    `cols` varies widths so it reads like data, not a brick. */
export function SkeletonRows({ rows = 6, cols = 4, className = "" }: {
  rows?: number;
  cols?: number;
  className?: string;
}) {
  const widths = ["w-16", "w-20", "w-28", "w-24", "w-14", "w-32", "w-20", "w-24"];
  return (
    <>
      {Array.from({ length: rows }).map((_, r) => (
        <tr key={r} className={className}>
          {Array.from({ length: cols }).map((_, c) => (
            <td key={c} className="px-3 py-3">
              <Skeleton className={widths[(r * 3 + c) % widths.length]} />
            </td>
          ))}
        </tr>
      ))}
    </>
  );
}

/** Card stack placeholder (phones): the skeleton of the mobile cards. */
export function SkeletonCards({ count = 5, className = "" }: { count?: number; className?: string }) {
  return (
    <div className={`stagger-none space-y-2 p-3 ${className}`}>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="rounded-xl border border-line bg-card p-3 shadow-sm">
          <Skeleton className="h-4 w-40" />
          <Skeleton className="mt-2 h-3 w-56" />
          <div className="mt-3 flex gap-6">
            <Skeleton className="h-3 w-16" />
            <Skeleton className="h-3 w-20" />
          </div>
        </div>
      ))}
    </div>
  );
}
