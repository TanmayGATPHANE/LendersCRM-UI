import type { ReactNode } from "react";

/**
 * Field — one label/value pair inside a mobile data card (the phone-size
 * stand-in for the desktop tables). Cards read like a passbook: label in
 * small caps above the value, value in the ink color by default.
 */
export function Field({ label, children, tone = "ink" }: {
  label: string;
  children: ReactNode;
  /** ink = normal value; in/out color the money like the tables do. */
  tone?: "ink" | "in" | "out" | "muted";
}) {
  const toneCls =
    tone === "in" ? "text-green-700"
    : tone === "out" ? "text-red-600"
    : tone === "muted" ? "text-muted"
    : "text-ink";
  return (
    <div className="min-w-0">
      <p className="text-xs font-medium uppercase tracking-wider text-muted">{label}</p>
      <p className={`mt-0.5 truncate text-sm tabular-nums ${toneCls}`}>{children}</p>
    </div>
  );
}