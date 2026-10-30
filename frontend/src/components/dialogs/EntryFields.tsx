import type { ChangeEvent, ReactNode } from "react";
import type { EntryForm } from "../../api/types.ts";
import { inputCls, labelCls } from "../ui.ts";

/**
 * EntryFields — the date/amount/rate/notes grid of the entry form,
 * shared by every mode (add, sub-lend, edit). `customerNode` and
 * `itemNode` are the ready-made <input>/<select> elements decided by
 * AddEntryDialog (locked or editable per mode); a null customerNode
 * hides the customer label (e.g. pure sub-lend mode shows it in the
 * info panel instead).
 */
interface Props {
  form: EntryForm;
  /** Field updater from AddEntryDialog: set("date")(event) updates it. */
  set: (key: keyof EntryForm) => (e: ChangeEvent<HTMLInputElement>) => void;
  /** Rendered customer field, or null to hide it entirely. */
  customerNode: ReactNode | null;
  /** Rendered item field (always rendered). */
  itemNode: ReactNode;
}

export default function EntryFields({ form, set, customerNode, itemNode }: Props) {
  return (
    <div className="grid grid-cols-2 gap-3">
      {customerNode && (
        <label className={labelCls}>
          Customer
          <span className="mt-1 block">{customerNode}</span>
        </label>
      )}

      <label className={labelCls}>
        Item Description
        <span className="mt-1 block">{itemNode}</span>
      </label>

      <label className={labelCls}>
        Date
        <input type="date" required value={form.date} onChange={set("date")}
          className={`${inputCls} mt-1`} />
      </label>

      <label className={labelCls}>
        Amount
        <input type="number" min="0" required value={form.amount}
          onChange={set("amount")} placeholder="0"
          className={`${inputCls} mt-1`} />
      </label>

      <label className={labelCls}>
        Interest % per month <span className="normal-case text-muted">(optional)</span>
        <input type="number" min="0" step="0.1" value={form.rate} onChange={set("rate")}
          placeholder="No interest" className={`${inputCls} mt-1`} />
      </label>

      <label className={`${labelCls} col-span-2`}>
        Notes <span className="normal-case text-muted">(optional)</span>
        <input value={form.notes} onChange={set("notes")} className={`${inputCls} mt-1`} />
      </label>
    </div>
  );
}