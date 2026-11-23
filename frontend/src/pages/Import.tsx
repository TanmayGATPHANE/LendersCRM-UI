import { useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import ImportPreviewTable from "../components/import/ImportPreviewTable.tsx";
import { toast } from "../components/Toast.tsx";
import { inputCls, labelCls, primaryBtnCls, secondaryBtnCls } from "../components/ui.ts";
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
const MODES: Array<{ kind: ImportKind; title: string; blurb: string; icon: string }> = [
  {
    kind: "Active",
    title: "Import active book",
    blurb:
      "The open lending book. Merged Name + Item cells stay one collateral (their rows become sub-lends); a negative amount is a partial return.",
    icon: "ph-book-open",
  },
  {
    kind: "Released",
    title: "Import released book",
    blurb:
      "Collaterals already returned. Each lands as Released, with the day it came back and the interest the release brought in.",
    icon: "ph-archive-box",
  },
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
  const fileInput = useRef<HTMLInputElement>(null);
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
    setFile(f);
    setResult(null);
    if (!f) {
      parseSeq.current++;
      setReading(false);
      setPreview(null);
      setError("");
      return;
    }
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
    if (fileInput.current) fileInput.current.value = "";
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
      if (fileInput.current) fileInput.current.value = "";
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
    <main className="flex flex-1 flex-col overflow-hidden px-3 py-3 sm:px-6 sm:py-4">
      {/* Step 1 — which book, then which file. Everything here is shrink-0;
          the parsed grid below owns the page's only scroll region. */}
      <div className="shrink-0 space-y-2 pb-2">
        <div className="flex flex-wrap items-baseline gap-x-2">
          <h1 className="text-lg font-semibold tracking-tight text-ink">Import from Excel</h1>
          <p className="text-sm text-muted">
            One book per run — the whole sheet is shown below before anything is written.
          </p>
        </div>

        {/* The two options — deliberately separate runs, each with its own
            sheet on the server side (no silent fallback to the other book). */}
        <div className="grid gap-2 sm:grid-cols-2">
          {MODES.map((m) => {
            const on = kind === m.kind;
            return (
              <button
                key={m.kind}
                type="button"
                aria-pressed={on}
                onClick={() => chooseKind(m.kind)}
                disabled={committing}
                className={`flex items-start gap-3 rounded-xl border p-3 text-left transition duration-300 ease-brand
                            focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 ${
                  on
                    ? "border-primary bg-primary/5 ring-1 ring-primary/30"
                    : "border-line bg-card hover:bg-tint-hover"
                }`}
              >
                <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-lg ${
                  on ? "bg-primary text-on-primary" : "bg-tint text-slate"
                }`}>
                  <i className={`ph ${m.icon} text-lg`} aria-hidden="true" />
                </span>
                <span className="min-w-0">
                  <span className="flex items-center gap-1.5 text-sm font-semibold text-ink">
                    {m.title}
                    {on && <i className="ph ph-check-circle text-base text-primary" aria-hidden="true" />}
                  </span>
                  <span className="mt-0.5 block text-xs leading-relaxed text-muted">{m.blurb}</span>
                </span>
              </button>
            );
          })}
        </div>

        <div className="grid items-end gap-2 sm:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
          <label className={labelCls}>
            {released ? "Released book (.xlsx)" : "Active book (.xlsx)"}
            <input
              ref={fileInput}
              type="file"
              accept=".xlsx"
              onChange={(e) => pick(e.target.files?.[0] ?? null)}
              className={`${inputCls} mt-1 file:mr-3 file:rounded-md file:border-0 file:bg-primary file:px-3 file:py-1 file:text-sm file:font-semibold file:text-on-primary`}
            />
          </label>
          <label className={labelCls}>
            Interest rate (%/month)
            <input
              type="number" min="0" max="99" step="0.01" value={rate}
              onChange={(e) => setRate(e.target.value)}
              className={`${inputCls} mt-1`}
            />
          </label>
        </div>
        <p className="text-xs text-muted">
          One rate for every imported lend (the template's column is 2 %/month). Rows are stamped
          file/sheet/row, so re-imports skip what is already on the books — imports never touch the
          cash ledger.
        </p>

        {reading && <p className="text-sm text-slate">Reading the sheet…</p>}
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
            {/* One compact strip — the grid below owns the page. */}
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 rounded-lg bg-tint px-3 py-2 text-xs text-slate">
              <span className="min-w-0 max-w-full truncate" title={preview.fileName}>
                <span className="text-muted">File</span>{" "}
                <span className="font-medium text-ink">{preview.fileName}</span>
              </span>
              <span>
                <span className="text-muted">Sheet</span>{" "}
                <span className="font-medium text-ink">{preview.sheetUsed}</span>
              </span>
              <span>
                <span className="text-muted">Collaterals</span>{" "}
                <span className="font-medium text-ink">{preview.groups.length}</span>
              </span>
              <span>
                <span className="text-muted">Lends</span>{" "}
                <span className="font-medium text-ink">{lends} · {money(lent)}</span>
              </span>
              <span>
                <span className="text-muted">Partial returns</span>{" "}
                <span className="font-medium text-ink">{rets}</span>
              </span>
              {released && (
                <span>
                  <span className="text-muted">Interest collected</span>{" "}
                  <span className="font-medium text-ink">{money(earned)}</span>
                </span>
              )}
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
          <div className="table-scroll min-h-0 flex-1 overflow-x-auto overflow-y-auto rounded-xl border border-line bg-card shadow-sm">
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
              className={primaryBtnCls}
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
              {reading ? "Reading the sheet…" : "Pick a workbook to see exactly what the import will write."}
            </span>
            {!reading && (
              <span className="text-xs text-muted">
                {released
                  ? "Released book: Date · Amount · Release date · Interest · Name · Item."
                  : "Active book: Date · Amount · Interest · Name · Item."}
              </span>
            )}
          </div>
        )
      )}
    </main>
  );
}
