import { useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import ImportPreviewTable from "../components/import/ImportPreviewTable.tsx";
import WorkbookPicker from "../components/import/WorkbookPicker.tsx";
import { toast } from "../components/Toast.tsx";
import { inputCls, primaryBtnCls, secondaryBtnCls } from "../components/ui.ts";
import { importCommit, importPreview } from "../api/client.ts";
import type { ImportKind, ImportPreview, ImportResult } from "../api/types.ts";
import { money } from "../utils/format.ts";

/**
 * Import (plan §4.7) — the Excel lending book as its OWN page, not a
 * button on the Dashboard. The two books are kept separate on purpose:
 *
 *   Active   — the open lending book. Merged Name+Item cells stay one
 *              collateral (sub-lends); a negative amount is a partial
 *              return.
 *   Released — the already-returned book. Each collateral lands closed,
 *              with its release day and the interest it brought back.
 *
 * The parser is told which book was picked (kind on the preview/commit
 * call): it reads THAT sheet or refuses — it never quietly imports the
 * other one. The parse is then shown in FULL, in the Dashboard's grid
 * shape, and nothing is written until Import is pressed. Preview and
 * commit re-parse the same bytes the same way, so what is on screen is
 * exactly what is written.
 */

/** The two books — each its own import run. */
const MODES: Array<{ kind: ImportKind; title: string; icon: string }> = [
  { kind: "Active", title: "Import active book", icon: "ph-book-open" },
  { kind: "Released", title: "Import released book", icon: "ph-archive-box" },
];

export default function ImportPage() {
  const navigate = useNavigate();
  const [kind, setKind] = useState<ImportKind>("Active");
  const [file, setFile] = useState<File | null>(null);
  const [rate, setRate] = useState("2");
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [reading, setReading] = useState(false);
  const [committing, setCommitting] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<ImportResult | null>(null);
  // A sequence per parse: switching book (or file) while the previous
  // parse is in flight must never let the older answer win.
  const parseSeq = useRef(0);

  /** Parse one file as one book — the preview IS the rehearsal. */
  async function parse(f: File, k: ImportKind): Promise<void> {
    const seq = ++parseSeq.current;
    setReading(true);
    setPreview(null);
    setError("");
    setResult(null);
    const rn = Number(rate);
    const previewRate = Number.isFinite(rn) ? rn : 2; // "0" means interest-free
    try {
      const p = await importPreview(f, previewRate, k);
      if (seq === parseSeq.current) setPreview(p);
    } catch (err) {
      if (seq === parseSeq.current) setError((err as Error).message);
    } finally {
      if (seq === parseSeq.current) setReading(false);
    }
  }

  /** A picked file parses immediately; clearing it clears the preview. */
  function pick(f: File | null): void {
    setResult(null);
    if (!f) {
      parseSeq.current++;
      setFile(null);
      setReading(false);
      setPreview(null);
      setError("");
      return;
    }
    // Drop targets can hand over anything — only an .xlsx is a workbook
    // here. Refuse it loudly instead of uploading bytes the API answers
    // with a generic 400.
    if (!/\.xlsx$/i.test(f.name)) {
      parseSeq.current++;
      setFile(null);
      setReading(false);
      setPreview(null);
      setError("That is not an .xlsx workbook — pick the sheet saved from Excel.");
      return;
    }
    setFile(f);
    void parse(f, kind);
  }

  /** Switching the book is a fresh import run: re-parse the same file as
      the other book (or just clear, when no file is picked yet). */
  function chooseKind(k: ImportKind): void {
    if (k === kind) return;
    setKind(k);
    setError("");
    setResult(null);
    if (file) void parse(file, k);
    else setPreview(null);
  }

  /** Back to an empty page, same book still selected. */
  function reset(): void {
    parseSeq.current++;
    setFile(null);
    setPreview(null);
    setResult(null);
    setError("");
    setReading(false);
  }

  async function commit(): Promise<void> {
    if (!file || !preview) return;
    const rateNum = Number(rate);
    if (!(rateNum >= 0) || rateNum >= 100)
      return setError("Enter the interest rate (0–100 %/month)");
    setCommitting(true);
    setError("");
    try {
      const r = await importCommit(file, rateNum, kind);
      toast(
        `Imported ${r.lendsCreated} lends across ${r.groupsCreated} collaterals` +
        (r.returnsCreated ? `, ${r.returnsCreated} partial returns` : "") +
        (r.groupsSkipped ? ` (${r.groupsSkipped} already imported)` : ""),
        "ok"
      );
      setResult(r);
      setPreview(null);
      setFile(null);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setCommitting(false);
    }
  }

  const released = kind === "Released";
  const lends = preview?.groups.reduce((n, g) => n + g.lends.length, 0) ?? 0;
  const rets = preview?.groups.reduce((n, g) => n + g.returns.length, 0) ?? 0;
  const lent = preview?.groups.reduce(
    (n, g) => n + g.lends.reduce((m, l) => m + l.amount, 0), 0) ?? 0;
  const earned = preview?.groups.reduce(
    (n, g) => n + g.lends.reduce((m, l) => m + (l.interest ?? 0), 0), 0) ?? 0;
  const rateNum = Number(rate);
  const rateOk = Number.isFinite(rateNum) && rateNum >= 0 && rateNum < 100;

  return (
    // Below lg the one-row toolbar wraps, so the page scrolls and the grid
    // keeps a usable floor instead of collapsing to a sliver. From lg up
    // the toolbar stays on one row and the grid owns the scroll.
    <main className="flex flex-1 flex-col overflow-y-auto px-3 py-3 sm:px-6 sm:py-4 lg:overflow-hidden">
      {/* One toolbar: book switch · workbook · rate. The parsed grid below
          owns the page's only scroll region. */}
      <div className="shrink-0 space-y-2 pb-2">
        <h1 className="text-lg font-semibold tracking-tight text-ink">Import from Excel</h1>

        <div className="flex flex-wrap items-center gap-2">
          {/* The two books — deliberately separate runs, each with its own
              sheet on the server side (no silent fallback to the other). */}
          <div
            role="group"
            aria-label="Which book"
            className="flex w-full rounded-lg border border-line bg-tint p-1 sm:w-auto"
          >
            {MODES.map((m) => {
              const on = kind === m.kind;
              // A picked workbook belongs to one book — lock the other side
              // so a stray click cannot re-parse it as the wrong sheet.
              const locked = file !== null && !on;
              return (
                <button
                  key={m.kind}
                  type="button"
                  aria-pressed={on}
                  onClick={() => chooseKind(m.kind)}
                  disabled={committing || locked}
                  title={locked ? "Clear the workbook to switch books" : undefined}
                  className={`inline-flex h-7 flex-1 items-center justify-center gap-1.5 whitespace-nowrap rounded-md px-2.5 text-sm
                              transition-colors duration-300 ease-brand
                              focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40
                              disabled:cursor-not-allowed disabled:opacity-40 ${
                    on
                      ? "bg-primary font-semibold text-on-primary shadow-sm"
                      : "text-slate hover:bg-tint-hover hover:text-ink"
                  }`}
                >
                  <i className={`ph ${m.icon} text-base`} aria-hidden="true" />
                  {m.title}
                </button>
              );
            })}
          </div>

          <div className="min-w-0 flex-1 basis-64">
            <WorkbookPicker
              file={file}
              disabled={committing}
              label={`Choose the ${released ? "released" : "active"} book workbook`}
              onPick={pick}
            />
          </div>

          <label className="flex shrink-0 items-center gap-2">
            <span className="whitespace-nowrap text-xs font-medium uppercase tracking-wider text-slate">
              Rate %/mo
            </span>
            <input
              type="number" min="0" max="99" step="0.01" value={rate}
              onChange={(e) => setRate(e.target.value)}
              aria-label="Interest rate, percent per month"
              className={`${inputCls} w-24`}
            />
          </label>
        </div>

        {error && (
          <p className="rounded-lg border border-red-300/50 bg-red-50 p-2.5 text-sm text-red-700 dark:bg-red-950/40 dark:text-red-200">
            {error}
          </p>
        )}

        {/* A finished import replaces the preview with its receipt. */}
        {result && (
          <div className="flex flex-wrap items-center gap-3 rounded-xl border border-emerald-400/40 bg-emerald-50 p-3 text-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200">
            <i className="ph ph-check-circle text-xl" aria-hidden="true" />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold">{released ? "Released" : "Active"} book imported</p>
              <p className="text-xs">
                {result.lendsCreated} lends across {result.groupsCreated} collaterals
                {result.returnsCreated > 0 && `, ${result.returnsCreated} partial returns`}
                {result.customersCreated > 0 && `, ${result.customersCreated} customers created`}
                {result.groupsSkipped > 0 && ` · ${result.groupsSkipped} collaterals already on the books, skipped`}
                {result.returnsSkipped > 0 && ` · ${result.returnsSkipped} returns already recorded, skipped`}
              </p>
            </div>
            <button onClick={reset} className={secondaryBtnCls}>Import another file</button>
            <button onClick={() => navigate("/")} className={secondaryBtnCls}>Open dashboard</button>
          </div>
        )}

        {preview && (
          <>
            {/* The workbook is already named in the picker above — this
                strip reports what the parse found. */}
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 rounded-lg bg-tint px-3 py-2 text-xs text-slate">
              {[
                ["Sheet", preview.sheetUsed],
                ["Collaterals", String(preview.groups.length)],
                ["Lends", `${lends} · ${money(lent)}`],
                ...(!released ? [["Partial returns", String(rets)]] : []),
                ...(released ? [["Interest collected", money(earned)]] : []),
              ].map(([k, v]) => (
                <span key={k} className="inline-flex items-baseline gap-1 whitespace-nowrap">
                  <span className="text-muted">{k}</span>{" "}
                  <span className="font-medium text-ink">{v}</span>
                </span>
              ))}
            </div>

            {/* Skipped rows: collapsed by default so the preview grid keeps
                the page; the count stays visible. */}
            {preview.warnings.length > 0 && (
              <details className="rounded-lg border border-amber-400/40 bg-amber-50 px-3 py-2 text-xs text-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
                <summary className="cursor-pointer font-semibold">
                  {preview.warnings.length} row(s) were skipped — show
                </summary>
                <ul className="mt-1 max-h-32 list-inside list-disc space-y-0.5 overflow-y-auto">
                  {preview.warnings.map((w, i) => <li key={i}>{w}</li>)}
                </ul>
              </details>
            )}
          </>
        )}
      </div>

      {/* Step 2 — the full parse, in the Dashboard grid's shape. Read-only:
          checking happens here, writing happens on the button below. */}
      {preview ? (
        <>
          <div className="table-scroll min-h-[60svh] flex-1 overflow-x-auto overflow-y-auto rounded-xl border border-line bg-card shadow-sm sm:min-h-[420px] lg:min-h-0">
            <ImportPreviewTable preview={preview} rate={rateOk ? rateNum : null} />
          </div>
          <div className="flex shrink-0 flex-wrap items-center justify-end gap-2 pt-3">
            <span className="mr-auto text-xs text-muted">
              {preview.groups.length === 0
                ? "Nothing to import — check the warnings above."
                : "Preview only — nothing has been written yet."}
            </span>
            <button type="button" onClick={reset} className={secondaryBtnCls}>Choose another file</button>
            <button
              type="button"
              onClick={commit}
              disabled={committing || preview.groups.length === 0}
              className={`${primaryBtnCls} disabled:pointer-events-none disabled:opacity-50`}
            >
              <i className={`ph ph-upload-bold text-base ${committing ? "animate-pulse" : ""}`} aria-hidden="true" />
              {committing
                ? "Importing…"
                : released
                  ? `Import ${preview.groups.length} released collaterals`
                  : `Import ${lends} lends${rets > 0 ? ` and ${rets} returns` : ""}`}
            </button>
          </div>
        </>
      ) : (
        !result && (
          <div className="flex flex-1 flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-line bg-card/50 px-4 text-center">
            <i className={`ph ${reading ? "ph-spinner animate-spin" : "ph-microsoft-excel-logo"} text-3xl text-dim`} aria-hidden="true" />
            <span className="text-sm text-slate">
              {reading
                ? "Reading the sheet…"
                : file
                  ? "No preview — see the message above."
                  : "Pick a workbook to preview."}
            </span>
          </div>
        )
      )}
    </main>
  );
}
