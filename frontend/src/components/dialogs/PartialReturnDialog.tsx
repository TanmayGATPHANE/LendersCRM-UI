import { useEffect, useState, type ChangeEvent, type FormEvent } from "react";
import type { CollateralGroup } from "../../api/types.ts";
import Modal from "../Modal.tsx";
import { inputCls, labelCls, primaryBtnCls, secondaryBtnCls } from "../ui.ts";
import { addPartial } from "../../api/client.ts";
import { money, today } from "../../utils/format.ts";

/**
 * PartialReturnDialog (§4.6) — money the customer hands back early,
 * before the final release. Recording it reduces the group's outstanding
 * principal oldest-lend-first (FIFO); interest keeps accruing on what
 * remains. The lend records themselves stay intact.
 */
interface Props {
  open: boolean;
  /** The collateral receiving the money; null hides the dialog body. */
  group: CollateralGroup | null;
  onClose: () => void;
  onSaved: () => void | Promise<void>;
}

export default function PartialReturnDialog({ open, group, onClose, onSaved }: Props) {
  const [form, setForm] = useState({ date: today(), amount: "", notes: "" });
  const [error, setError] = useState("");

  // Fresh form each time the dialog opens.
  useEffect(() => {
    if (open && group) {
      setForm({ date: today(), amount: "", notes: "" });
      setError("");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, group]);

  /** Update one field of the form. */
  const set =
    (key: "date" | "amount" | "notes") =>
    (e: ChangeEvent<HTMLInputElement>) =>
      setForm({ ...form, [key]: e.target.value });

  /** Validate against the outstanding, record the payment, refresh. */
  async function save(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!group) return; // the render below guards too, but satisfies TS
    if (!(Number(form.amount) > 0)) return setError("Enter the amount received");
    if (Number(form.amount) > group.outstanding)
      return setError(
        `Cannot exceed the outstanding ${money(group.outstanding)}`
      );
    try {
      await addPartial(group.groupId, {
        date: form.date,
        amount: Number(form.amount),
        notes: form.notes,
      });
      onSaved();
      onClose();
    } catch (err) {
      setError((err as Error).message);
    }
  }

  if (!group) return null;

  return (
    <Modal open={open} title="Partial Return" onClose={onClose}>
      {/* What this payment cuts into */}
      <div className="mb-4 rounded-lg bg-tint p-3 text-sm text-slate">
        <div className="grid grid-cols-2 gap-y-1">
          <span>Customer</span><span className="text-ink">{group.customerName}</span>
          <span>Item</span><span className="text-ink">{group.item}</span>
          <span>Total lent</span><span className="text-ink">{money(group.totalAmount)}</span>
          <span>Returned so far</span>
          <span className="text-ink">{money(group.totalPaid)}</span>
          <span>Outstanding principal</span>
          <span className="font-medium text-primary">{money(group.outstanding)}</span>
        </div>
      </div>

      <form onSubmit={save} className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <label className={labelCls}>
            Date
            <input type="date" required value={form.date} onChange={set("date")}
              className={`${inputCls} mt-1`} />
          </label>
          <label className={labelCls}>
            Amount Received
            <input type="number" min="1" required value={form.amount}
              onChange={set("amount")} placeholder="0" className={`${inputCls} mt-1`} />
          </label>
          <label className={`${labelCls} col-span-2`}>
            Notes <span className="normal-case text-muted">(optional)</span>
            <input value={form.notes} onChange={set("notes")} className={`${inputCls} mt-1`} />
          </label>
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <p className="text-xs text-muted">
          Reduces the outstanding principal of the earlier lends first; interest
          keeps accruing on what remains.
        </p>

        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onClose} className={secondaryBtnCls}>Cancel</button>
          <button type="submit" className={primaryBtnCls}>Record Partial Return</button>
        </div>
      </form>
    </Modal>
  );
}