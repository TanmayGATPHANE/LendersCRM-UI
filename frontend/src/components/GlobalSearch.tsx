import { useEffect, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from "react";
import { useNavigate } from "react-router-dom";
import { currentUser, fetchGlobalSearch } from "../api/client.ts";
import type { SearchHit, SearchHitType, SearchResults } from "../api/types.ts";
import { money } from "../utils/format.ts";

/** The header's global search (plan §3.1). Fires server-side at 3+
    characters (debounced, stale responses discarded) and fans the answer
    across three sections — Customers, Users (Admin only), Transactions.
    Keyboard: ↑/↓ walk, Enter picks, Esc closes; click-through jumps to the
    record's page (customers → Customers page with it focused, lends and
    partial returns → Dashboard with the collateral group focused). */

/** Server-side mirror — the API also gates the query length. */
const MIN_CHARS = 3;

/** Per hit type: the icon glyph + a plain section label. */
const HIT_META: Record<SearchHitType, { icon: string; section: string }> = {
  customer: { icon: "person", section: "Customers" },
  user: { icon: "badge", section: "Users" },
  lend: { icon: "inventory_2", section: "Transactions" },
  payment: { icon: "payments", section: "Transactions" },
};

export default function GlobalSearch() {
  const navigate = useNavigate();
  const [q, setQ] = useState("");
  const [results, setResults] = useState<SearchResults | null>(null);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const boxRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  // Monotonic id — a slow earlier request must never overwrite a fresh one.
  const seq = useRef(0);

  // The debounced, server-backed query.
  useEffect(() => {
    const trimmed = q.trim();
    if (trimmed.length < MIN_CHARS) {
      setResults(null);
      setOpen(false);
      return;
    }
    const id = ++seq.current;
    const t = setTimeout(() => {
      fetchGlobalSearch(trimmed)
        .then((r) => {
          if (seq.current === id) {
            setResults(r);
            setOpen(true);
            setActive(0);
          }
        })
        .catch(() => { /* transient — keep whatever is on screen */ });
    }, 250);
    return () => clearTimeout(t);
  }, [q]);

  // Outside click closes the dropdown.
  useEffect(() => {
    function onDown(e: MouseEvent) {
      if (!boxRef.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, []);

  // Ctrl/Cmd+K focuses the box from anywhere — the fast path.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "k" && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        inputRef.current?.focus();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Sectioned hits, flattened in display order for the keyboard walk.
  const isAdmin = currentUser()?.role === "Admin";
  const flat: SearchHit[] = [
    ...(results?.customers ?? []),
    ...(isAdmin ? (results?.users ?? []) : []),
    ...(results?.transactions ?? []),
  ];

  function pick(hit: SearchHit) {
    setOpen(false);
    setQ("");
    setResults(null);
    if (hit.type === "customer")
      navigate("/customers", { state: { focusCustomerId: hit.id } });
    else if (hit.type === "user") navigate("/users");
    else
      navigate("/", { state: { focusGroupId: hit.groupId ?? hit.id } });
  }

  function onKeyDown(e: ReactKeyboardEvent) {
    if (!open || flat.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((a) => (a + 1) % flat.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => (a - 1 + flat.length) % flat.length);
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (flat[active]) pick(flat[active]);
    } else if (e.key === "Escape") {
      setOpen(false);
      inputRef.current?.blur();
    }
  }

  // Sections are derived from the flat list — Users renders only for Admin,
  // and each section carries its label once at the top.
  const rows = flat.map((hit, i) => {
    const section = HIT_META[hit.type].section;
    const showLabel = i === 0 || HIT_META[flat[i - 1].type].section !== section;
    return { hit, i, section, showLabel };
  });
  const empty =
    results && q.trim().length >= MIN_CHARS && flat.length === 0;

  return (
    <div ref={boxRef} className="relative w-full max-w-md">
      <div className="flex items-center gap-2 rounded-lg border border-line bg-tint px-2.5 py-1.5 focus-within:border-primary focus-within:bg-card">
        <span className="material-symbols-outlined text-[16px] text-muted">search</span>
        <input
          ref={inputRef}
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onFocus={(e) => { if (results) setOpen(true); e.target.select(); }}
          onKeyDown={onKeyDown}
          placeholder="Search loans, items, or customers"
          className="w-full bg-transparent text-sm text-ink outline-none placeholder:text-dim"
          aria-label="Global search"
        />
        {q && (
          <button
            onClick={() => { setQ(""); inputRef.current?.focus(); }}
            className="text-dim hover:text-slate"
            aria-label="Clear search"
          >
            <span className="material-symbols-outlined text-[16px]">close</span>
          </button>
        )}
        <kbd className="hidden rounded border border-line bg-card px-1 py-px text-[9px] leading-tight text-dim lg:block">
          Ctrl K
        </kbd>
      </div>

      {open && (
        <div className="absolute left-0 right-0 top-full z-50 mt-2 max-h-[70vh] overflow-y-auto rounded-xl border border-line bg-card py-1.5 shadow-[0_8px_30px_rgba(11,28,48,0.14)]">
          {rows.map(({ hit, i, section, showLabel }) => (
            <div key={`${hit.type}-${hit.id}`}>
              {showLabel && (
                <div className="px-3 pb-1 pt-2.5 text-[10px] font-medium uppercase tracking-wider text-dim">
                  {section}
                </div>
              )}
              <button
                onMouseDown={(e) => { e.preventDefault(); pick(hit); }}
                onMouseEnter={() => setActive(i)}
                className={`flex w-full items-center gap-3 px-3 py-2 text-left ${
                  i === active ? "bg-tint" : ""
                }`}
              >
                <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-tint text-slate">
                  <span className="material-symbols-outlined text-[18px]">
                    {HIT_META[hit.type].icon}
                  </span>
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm text-ink">{hit.title}</span>
                  {hit.subtitle && (
                    <span className="block truncate text-xs text-muted">{hit.subtitle}</span>
                  )}
                </span>
                {hit.amount != null && (
                  <span className="shrink-0 text-sm tabular-nums text-slate">{money(hit.amount)}</span>
                )}
                <span className="material-symbols-outlined text-[16px] text-dim">
                  chevron_right
                </span>
              </button>
            </div>
          ))}
          {empty && (
            <div className="px-3 py-6 text-center text-sm text-muted">
              Nothing found for “{q.trim()}”
            </div>
          )}
        </div>
      )}
    </div>
  );
}