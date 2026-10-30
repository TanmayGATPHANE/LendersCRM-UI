import { useEffect, useRef, useState } from "react";

/** The header's account chip: avatar disc with the user's initial; clicking
    it drops a small menu with the signed-in identity (email + role) and
    Sign out — the header itself stays clean. */
export default function UserMenu({ name, email, role, onSignOut }: {
  name: string; email: string; role?: string; onSignOut: () => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Outside click closes the menu.
  useEffect(() => {
    function onDown(e: MouseEvent) {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, []);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2 rounded-lg border border-line bg-card py-1 pl-1 pr-2.5 text-left shadow-sm transition-colors hover:bg-tint"
        aria-label={`Account menu (${name})`}
        aria-expanded={open}
      >
        <span className="grid h-7 w-7 place-items-center rounded-md bg-primary text-xs font-semibold text-on-primary">
          {name.trim()[0]?.toUpperCase() ?? "?"}
        </span>
        <span className="leading-tight">
          <span className="block max-w-[160px] truncate text-xs font-medium text-ink">{name}</span>
          {role && <span className="block text-[10px] text-muted">{role}</span>}
        </span>
      </button>

      {open && (
        <div className="absolute right-0 top-full z-50 mt-2 w-64 rounded-xl border border-line bg-card py-1 shadow-[0_8px_30px_rgba(11,28,48,0.14)]">
          <div className="border-b border-line px-3 py-3">
            <span className="block text-[10px] font-medium uppercase tracking-wider text-dim">
              Signed in as
            </span>
            <span className="mt-1 block truncate text-sm text-ink" title={email}>
              {name}
            </span>
            <span className="block truncate text-xs text-muted" title={email}>
              {email}
            </span>
            {role && (
              <span className="mt-2 inline-block rounded-full bg-tint px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-slate">
                {role}
              </span>
            )}
          </div>
          <button
            onClick={() => { setOpen(false); onSignOut(); }}
            className="flex w-full items-center gap-2 px-3 py-2.5 text-sm text-slate hover:bg-tint"
          >
            <span className="material-symbols-outlined text-[18px] text-muted">logout</span>
            Sign out
          </button>
        </div>
      )}
    </div>
  );
}