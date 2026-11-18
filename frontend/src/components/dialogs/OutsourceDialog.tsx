import { useEffect, useState, type ChangeEvent, type FormEvent } from "react";
import type { CollateralGroup, SavedWhere } from "../../api/types.ts";
import Modal from "../Modal.tsx";
import { toast } from "../Toast.tsx";
import { inputCls, labelCls, primaryBtnCls, secondaryBtnCls } from "../ui.ts";
import { outsourceGroup } from "../../api/client.ts";
import { money, today } from "../../utils/format.ts";

/**
 * OutsourceDialog (§4.8) — hand one collateral to an outside party
 * ("outsourced to") to sell/recover on the counter's behalf. Going out
 * stamps the group IsOutsourced: it leaves the dashboard, reports and
 * customer views and shows ONLY on the Outsourced page until it is
 * marked returned.
 */
interface Props {
  open: boolean;
  group: CollateralGroup | null;
  onClose: () => void;
  onSaved: (where?: SavedWhere) => void | Promise<void>;
}

export default function OutsourceDialog({ open, group, onClose, onSaved }: Props) {
  const [form, setForm] = useState({ to: "", date: today(), notes: "" });
  const [saving, setSaving] = useState(false); // one outsource, one click
  const [error, setError] = useState("");

  // Fresh form each time the dialog opens.
  useEffect(() => {
    if (open && group) {
      setForm({ to: "", date: today(), notes: "" });
      setSaving(false);
      setError("");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, group]);

  const set =
    (key: "to" | "date" | "notes") =>
    (e: ChangeEvent<HTMLInputElement>) =>
      setForm({ ...form, [key]: e.target.value });

  async function save(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!group || saving) return;
    if (!form.to.trim()) return setError("Name the person/shop it is outsourced to");
    setSaving(true);
    try {
      await outsourceGroup(group.groupId, {
        date: form.date,
        to: form.to.trim(),
        notes: form.notes,
      });
      toast(`Outsourced — ${group.customerName}: ${group.item} → ${form.to.trim()}`, "ok");
      onSaved({ groupId: group.groupId });
      onClose();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  if (!group) return null;

  return (
    <Modal open={open} title="Outsource Collateral" onClose={onClose}>
      <div className="mb-4 rounded-lg bg-tint p-3 text-sm text-slate">
        <div className="grid grid-cols-2 gap-y-1">
          <span>Customer</span><span className="text-ink">{group.customerName}</span>
          <span>Item</span><span className="text-ink">{group.item}</span>
          <span>Lent on it</span><span className="text-ink">{money(group.totalAmount)}</span>
        </div>
      </div>

      <form onSubmit={save} className="space-y-3">
        <label className={labelCls}>
          Outsourced to
          <input required value={form.to} onChange={set("to")}
            placeholder="Person / shop taking the item" className={`${inputCls} mt-1`} />
        </label>
        <label className={labelCls}>
          Date
          <input type="date" required value={form.date} onChange={set("date")}
            className={`${inputCls} mt-1`} />
        </label>
        <label className={labelCls}>
          Note <span className="normal-case text-muted">(optional)</span>
          <input value={form.notes} onChange={set("notes")}
            placeholder="Why / terms" className={`${inputCls} mt-1`} />
        </label>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <p className="text-xs text-muted">
          While it is out, this collateral disappears from the dashboard, reports and
          customer views — it shows only on the Outsourced page, until you mark it returned.
        </p>

        <div className="flex justify-end gap-2 pt-1">
          <button type="button" onClick={onClose} disabled={saving} className={secondaryBtnCls}>Cancel</button>
          <button type="submit" disabled={saving} className={primaryBtnCls}>
            <i className="ph ph-paper-plane-tilt text-base" aria-hidden="true" />
            {saving ? "Outsourcing…" : "Outsource"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
