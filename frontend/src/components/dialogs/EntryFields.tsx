import type { ChangeEvent, ReactNode } from "react";
import type { EntryForm } from "../../api/types.ts";
import { inputCls, labelCls } from "../ui.ts";

/**
 * EntryFields — the field grid of the entry form, shared by every mode
 * (add, sub-lend, edit). `customerNode`, `addressNode` and `itemNode`
 * are the ready-made <input>/<select> elements decided by
 * AddEntryDialog (locked or editable per mode). The first row is the
 * customer with their address beside it; the item description takes the
 * next full line; date/amount/rate/notes follow. A null customerNode or
 * addressNode drops that cell (locked modes have no address, and the
 * customer then takes the row on its own).
 */
interface Props {
  form: EntryForm;
  /** Field updater from AddEntryDialog: set("date")(event) updates it. */
  set: (key: keyof EntryForm) => (e: ChangeEvent<HTMLInputElement>) => void;
  /** Rendered customer field, or null to hide it entirely. */
  customerNode: ReactNode | null;
  /** Rendered address field beside the customer, or null in locked modes. */
  addressNode?: ReactNode | null;
  /** Rendered item field (always rendered). */
  itemNode: ReactNode;
}

export default function EntryFields({ form, set, customerNode, addressNode, itemNode }: Props) {
  return (
    <div className="grid grid-cols-2 gap-3">
      {customerNode && (
        <label className={`${labelCls} ${addressNode ? "" : "col-span-2"}`}>
          Customer
          <span className="mt-1 block">{customerNode}</span>
        </label>
      )}

      {addressNode && (
        <label className={labelCls}>
          Address
          <span className="mt-1 block">{addressNode}</span>
        </label>
      )}

      <label className={`${labelCls} col-span-2`}>
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