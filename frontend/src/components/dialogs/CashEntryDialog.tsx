import { useEffect, useState, type ChangeEvent, type FormEvent } from "react";
import Modal from "../Modal.tsx";
import { toast } from "../Toast.tsx";
import { inputCls, labelCls, primaryBtnCls, secondaryBtnCls } from "../ui.ts";
import { addManualCash } from "../../api/client.ts";
import { money, today } from "../../utils/format.ts";

/**
 * CashEntryDialog (§3.5) — a manual movement on the drawer, OUTSIDE the
 * business: "+" is cash put in from elsewhere (topped up from personal
 * funds), "−" is cash taken out for personal use. No customer, no lend —
 * it exists so Total Cash Available stays true to the cash actually in
 * hand. The amount is stored SIGNED at the API; the dialog just flips it
 * behind the direction toggle.
 */
interface Props {
  open: boolean;
  onClose: () => void;
  onSaved: () => void | Promise<void>;
}

export default function CashEntryDialog({ open, onClose, onSaved }: Props) {
  const [direction, setDirection] = useState<"+" | "-">("+");
  const [form, setForm] = useState({ date: today(), amount: "", notes: "" });
  const [error, setError] = useState("");

  // Fresh form each time the dialog opens.
  useEffect(() => {
    if (open) {
      setDirection("+");
      setForm({ date: today(), amount: "", notes: "" });
      setError("");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  /** Update one field of the form. */
  const set =
    (key: "date" | "amount" | "notes") =>
    (e: ChangeEvent<HTMLInputElement>) =>
      setForm({ ...form, [key]: e.target.value });

  /** Record the movement (amount flipped by the direction), refresh. */
  async function save(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!(Number(form.amount) > 0)) return setError("Enter the amount");
    try {
      await addManualCash({
        date: form.date,
        amount: direction === "+" ? Number(form.amount) : -Number(form.amount),
        notes: form.notes,
      });
      toast(
        `${direction === "+" ? "Cash in" : "Cash out"} recorded — ${money(Number(form.amount))}`,
        "ok"
      );
      onSaved();
      onClose();
    } catch (err) {
      setError((err as Error).message);
    }
  }

  const dirBtn = (which: "+" | "-") =>
    `flex-1 rounded-lg border px-3 py-2 text-sm font-medium transition ${
      direction === which
        ? which === "+"
          ? "border-line bg-tint text-primary"
          : "border-line bg-tint text-red-600"
        : "border-line text-muted hover:bg-tint"
    }`;

  return (
    <Modal open={open} title="Add Cash Entry" onClose={onClose}>
      <p className="mb-3 text-sm text-slate">
        Money moved on the counter that isn't a lend or a return — a top-up
        from your pocket or cash taken out. It adjusts{" "}
        <span className="font-medium text-ink">Total Cash Available</span> up
        (+) or down (−) directly.
      </p>

      <form onSubmit={save} className="space-y-3">
        {/* Direction: + in / − out */}
        <div className="flex gap-2">
          <button type="button" onClick={() => setDirection("+")} className={dirBtn("+")}>
            + Money In
          </button>
          <button type="button" onClick={() => setDirection("-")} className={dirBtn("-")}>
            − Money Out
          </button>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <label className={labelCls}>
            Date
            <input type="date" required value={form.date} onChange={set("date")}
              className={`${inputCls} mt-1`} />
          </label>
          <label className={labelCls}>
            Amount
            <input type="number" min="1" required value={form.amount}
              onChange={set("amount")} placeholder="0" className={`${inputCls} mt-1`} />
          </label>
          <label className={`${labelCls} col-span-2`}>
            Notes <span className="normal-case text-muted">(what it was for)</span>
            <input value={form.notes} onChange={set("notes")}
              placeholder={direction === "+" ? "e.g. Cash added from home" : "e.g. Tea, misc purchase"}
              className={`${inputCls} mt-1`} />
          </label>
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onClose} className={secondaryBtnCls}>Cancel</button>
          <button type="submit" className={primaryBtnCls}>
            {direction === "+" ? "Record Money In" : "Record Money Out"}
          </button>
        </div>
      </form>
    </Modal>
  );
}