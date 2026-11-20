import { useRef, useState } from "react";
import Modal from "../Modal.tsx";
import { toast } from "../Toast.tsx";
import { inputCls, labelCls, primaryBtnCls, secondaryBtnCls } from "../ui.ts";
import { importPreview, importCommit } from "../../api/client.ts";
import { money, shortDate } from "../../utils/format.ts";
import type { ImportPreview } from "../../api/types.ts";

/**
 * ImportDialog (§4.7) — bring a yearly lending book (.xlsx, the counter's
 * template: Date · Amount · Interest · Name · Item) into the books.
 *
 * Two steps like the release flow: pick a file and the preview shows every
 * collateral the parser found — MERGED Name+Item blocks stay one
 * collateral with its sub-lends, negative rows become partial returns —
 * plus any skipped rows as warnings. The Import button then commits the
 * same parse. The rate field applies to every imported lend (the sheet
 * template's interest column is 2 %/month). Imported rows are stamped
 * with file/sheet/row in their Notes, so re-importing the same file
 * skips what is already on the books. Nothing is booked into the cash
 * in/out ledger — that stays its own thing, fed by actual entries done
 * in the app.
 */
interface Props {
  open: boolean;
  onClose: () => void;
  /** Refetch after a successful commit (the page reloads its tables). */
  onSaved: () => void | Promise<void>;
}

export default function ImportDialog({ open, onClose, onSaved }: Props) {
  const [file, setFile] = useState<File | null>(null);
  const [rate, setRate] = useState("2");
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [reading, setReading] = useState(false);
  const [committing, setCommitting] = useState(false);
  const [error, setError] = useState("");
  const fileInput = useRef<HTMLInputElement>(null);

  function reset(): void {
    setFile(null);
    setPreview(null);
    setError("");
    if (fileInput.current) fileInput.current.value = "";
  }

  /** Parse immediately on pick — the preview IS the rehearsal; the
      commit later re-parses the same bytes the same way. */
  async function pick(f: File | null): Promise<void> {
    setFile(f);
    setPreview(null);
    setError("");
    if (!f) return;
    setReading(true);
    try {
      setPreview(await importPreview(f, Number(rate) || 2));
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setReading(false);
    }
  }

  async function commit(): Promise<void> {
    if (!file || !preview) return;
    const rateNum = Number(rate);
    if (!(rateNum >= 0) || rateNum >= 100) return setError("Enter the interest rate (0–100 %/month)");
    setCommitting(true);
    setError("");
    try {
      const r = await importCommit(file, rateNum);
      toast(
        `Imported ${r.lendsCreated} lends across ${r.groupsCreated} collaterals` +
        (r.returnsCreated ? `, ${r.returnsCreated} partial returns` : "") +
        (r.groupsSkipped ? ` (${r.groupsSkipped} already imported)` : ""),
        "ok"
      );
      await onSaved();
      reset();
      onClose();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setCommitting(false);
    }
  }

  const lends = preview?.groups.reduce((n, g) => n + g.lends.length, 0) ?? 0;
  const rets = preview?.groups.reduce((n, g) => n + g.returns.length, 0) ?? 0;
  const lent = preview?.groups.reduce(
    (n, g) => n + g.lends.reduce((m, l) => m + l.amount, 0), 0) ?? 0;

  // Every money row of the sheet, flattened in sheet order — a +row is a
  // lend, a −row the inline partial return under the same collateral.
  // A RELEASED sheet adds the release day + the earned interest.
  interface Movement {
    row: number;
    name: string;
    item: string;
    date: string;
    amount: string; // formatted, sign included
    isReturn: boolean;
    note: string | null;
    released: string | null;
    earned: string | null;
  }
  const released = preview?.kind === "Released";
  const movements: Movement[] = (preview?.groups ?? [])
    .flatMap((g) => [
      ...g.lends.map((l) => ({ row: l.row, name: g.name, item: g.item, lend: l, ret: null })),
      ...g.returns.map((r0) => ({ row: r0.row, name: g.name, item: g.item, lend: null, ret: r0 })),
    ])
    .sort((a, b) => a.row - b.row)
    .map(({ row, name, item, lend, ret }) =>
      lend
        ? {
            row, name, item, date: lend.date, amount: money(lend.amount), isReturn: false, note: null,
            released: lend.releasedDate, earned: lend.interest != null ? money(lend.interest) : null,
          }
        : {
            row, name, item, date: ret!.date, amount: money(ret!.amount), isReturn: true, note: ret!.notes,
            released: null, earned: null,
          }
    );

  return (
    <Modal open={open} title="Import from Excel" wide onClose={onClose}>
      <div className="space-y-4">
        {/* Step 1 — the file + the rate every lend gets */}
        <div className="grid grid-cols-5 gap-3">
          <label className={`${labelCls} col-span-3`}>
            Yearly book (.xlsx)
            <input
              ref={fileInput}
              type="file"
              accept=".xlsx"
              onChange={(e) => void pick(e.target.files?.[0] ?? null)}
              className={`${inputCls} mt-1 file:mr-3 file:rounded-md file:border-0 file:bg-primary file:px-3 file:py-1 file:text-sm file:font-semibold file:text-on-primary`}
            />
          </label>
          <label className={`${labelCls} col-span-2`}>
            Interest rate (%/month)
            <input
              type="number" min="0" max="99" step="0.01" value={rate}
              onChange={(e) => setRate(e.target.value)}
              className={`${inputCls} mt-1`}
            />
          </label>
        </div>
        <p className="text-xs text-muted">
          One rate every imported lend carries — the template's interest column is 2 %/month. Merged
          Name+Item cells stay one collateral (their rows become sub-lends); a negative amount is a
          partial return against the collateral above it.
        </p>

        {reading && <p className="text-sm text-slate">Reading the sheet…</p>}
        {error && <p className="text-sm text-red-600">{error}</p>}

        {/* Step 2 — the parse, before anything is written */}
        {preview && (
          <>
            <div className="rounded-lg bg-tint p-3 text-sm text-slate">
              <div className="grid grid-cols-2 gap-y-1 sm:grid-cols-4">
                <span>Collaterals</span><span className="font-medium text-ink">{preview.groups.length}</span>
                <span>Lends ({money(lent)})</span><span className="font-medium text-ink">{lends}</span>
                <span>Partial returns</span><span className="font-medium text-ink">{rets}</span>
                <span>Rows found as "Active"</span>
                <span className="font-medium text-ink">sheet {preview.sheetUsed}</span>
              </div>
            </div>

            {preview.warnings.length > 0 && (
              <div className="rounded-lg border border-amber-400/40 bg-amber-50 p-3 text-xs text-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
                <p className="font-semibold">{preview.warnings.length} row(s) were skipped:</p>
                <ul className="mt-1 list-inside list-disc">
                  {preview.warnings.map((w, i) => <li key={i}>{w}</li>)}
                </ul>
              </div>
            )}

            {/* The parsed money rows — one row per movement, in sheet
                order, mirroring the Excel (a negative row shows negative).
                This is exactly what the commit will write. */}
            <div className="max-h-72 overflow-y-auto rounded-lg border border-line">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-card text-left text-xs uppercase tracking-wider text-slate">
                  <tr className="border-b border-line">
                    <th className="px-3 py-2 font-medium">Row</th>
                    <th className="px-3 py-2 font-medium">Customer</th>
                    <th className="px-3 py-2 font-medium">Item</th>
                    <th className="px-3 py-2 font-medium">Date</th>
                    <th className="px-3 py-2 text-right font-medium">Amount</th>
                    {released && <th className="px-3 py-2 font-medium">Released</th>}
                    {released && <th className="px-3 py-2 text-right font-medium">Earned</th>}
                    <th className="px-3 py-2 font-medium">Note</th>
                  </tr>
                </thead>
                <tbody>
                  {movements.map((m) => (
                    <tr key={m.row} className="border-b border-line/60">
                      <td className="px-3 py-2 text-muted/70">{m.row}</td>
                      <td className="max-w-40 truncate px-3 py-2 text-ink">{m.name || <em className="text-muted">no name</em>}</td>
                      <td className="max-w-52 truncate px-3 py-2 text-muted">{m.item || <em className="text-muted">no item</em>}</td>
                      <td className="whitespace-nowrap px-3 py-2 text-muted">{shortDate(m.date)}</td>
                      <td
                        className={`whitespace-nowrap px-3 py-2 text-right font-medium ${
                          m.isReturn ? "text-red-600" : "text-ink"
                        }`}
                      >
                        {m.isReturn ? "−" : "+"}
                        {m.amount}
                      </td>
                      {released && <td className="whitespace-nowrap px-3 py-2 text-muted">{shortDate(m.released)}</td>}
                      {released && <td className="whitespace-nowrap px-3 py-2 text-right text-slate">{m.earned ?? "—"}</td>}
                      <td className="max-w-48 truncate px-3 py-2 text-muted">{m.note || <span className="text-muted/50">—</span>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex justify-end gap-2 pt-1">
              <button type="button" onClick={reset} className={secondaryBtnCls}>Choose another file</button>
              <button
                onClick={commit}
                disabled={committing || preview.groups.length === 0}
                className={primaryBtnCls}
              >
                <i className={`ph ph-upload-bold text-base ${committing ? "animate-pulse" : ""}`} aria-hidden="true" />
                {committing ? "Importing…" : released ? `Import ${preview.groups.length} released collaterals` : `Import ${lends} lends`}
              </button>
            </div>
          </>
        )}
      </div>
    </Modal>
  );
}
