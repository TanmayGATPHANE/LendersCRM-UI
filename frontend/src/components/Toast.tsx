import { useEffect, useState } from "react";

/** Minimal in-app toast — replaces native alert() calls. Pages call
    `toast(msg)` (error, red) or `toast(msg, "ok")` (green); the <Toaster/>
    mounted in the Layout renders the stack top-right and auto-dismisses. */
type Toast = { id: number; msg: string; kind: "error" | "ok" };

type Listener = (t: Toast) => void;
let listeners: Listener[] = [];
let nextId = 1;

/** Fire a toast from anywhere (module-level emitter — no context needed). */
export function toast(msg: string, kind: "error" | "ok" = "error"): void {
  const t = { id: nextId++, msg, kind };
  listeners.forEach((l) => l(t));
}

export default function Toaster() {
  const [items, setItems] = useState<Toast[]>([]);

  useEffect(() => {
    const l: Listener = (t) => {
      setItems((prev) => [...prev, t]);
      // Auto-dismiss after 4s.
      window.setTimeout(() => setItems((prev) => prev.filter((x) => x.id !== t.id)), 4000);
    };
    listeners.push(l);
    return () => { listeners = listeners.filter((x) => x !== l); };
  }, []);

  if (items.length === 0) return null;
  return (
    <div className="pointer-events-none fixed right-4 top-4 z-[60] flex w-80 flex-col gap-2">
      {items.map((t) => (
        <div
          key={t.id}
          className={`anim-toast-in pointer-events-auto flex items-start gap-2 rounded-lg border px-3 py-2.5 text-sm shadow-[0_8px_30px_rgba(11,28,48,0.14)] ${
            t.kind === "ok"
              ? "border-line bg-card text-ink"
              : "border-red-200 bg-red-50 text-red-700"
          }`}
          role={t.kind === "ok" ? "status" : "alert"}
        >
          <i className={`ph ${t.kind === "ok" ? "ph-check-circle text-badge-ok" : "ph-x-circle text-red-600"} text-lg`} aria-hidden="true" />
          <span className="min-w-0 flex-1">{t.msg}</span>
        </div>
      ))}
    </div>
  );
}