import { useEffect, useState, type ChangeEvent, type FormEvent } from "react";
import type { CollateralGroup, SavedWhere } from "../../api/types.ts";
import Modal from "../Modal.tsx";
import { toast } from "../Toast.tsx";
import { inputCls, labelCls, primaryBtnCls, secondaryBtnCls } from "../ui.ts";
import { releaseGroup } from "../../api/client.ts";
import { money, today } from "../../utils/format.ts";
import { accruedInterest, daysBetween } from "../../utils/interest.ts";

/**
 * ReleaseEntryDialog — releases one collateral group: every active entry
 * in it is closed and interest is frozen from each entry's own date of
 * lend up to the chosen return date (§4.4). "Total Collectable" shows the
 * computed figure (principal outstanding + interest due); "Total
 * Collected" is what we ACTUALLY received from the customer — it follows
 * the collectable until you type over it. "Interest Collected" is the
 * books figure, spread across the entries proportionally to what had
 * accrued.
 */
interface Props {
  open: boolean;
  /** The collateral being released; null hides the dialog body. */
  group: CollateralGroup | null;
  onClose: () => void;
  /** Handed up with the group's id so the page can pulse the released row. */
  onSaved: (where?: SavedWhere) => void | Promise<void>;
}

/** Form state. The two number fields arrive from <input> handlers as
    STRINGS (event.target.value) and from the reset/derived computation as
    numbers — every consumer goes through Number(), so the union is the
    honest shape. */
interface ReleaseForm {
  dateReturned: string;
  interestCollected: string | number;
  totalCollected: string | number;
  notes: string;
}

export default function ReleaseEntryDialog({ open, group, onClose, onSaved }: Props) {
  const [form, setForm] = useState<ReleaseForm>({
    dateReturned: today(), interestCollected: 0, totalCollected: 0, notes: "",
  });
  // True once the user typed their own Total Collected — after that the
  // field stops following the (recomputed) collectable.
  const [collectedTouched, setCollectedTouched] = useState(false);
  const [error, setError] = useState("");

  /** Derived numbers for the dialog's info panel. Kept as helpers so the
      render below reads as plain sentences. They never run while `group`
      is null (the early return below fires first) — hence the `!`. */
  function activeSubs() {
    return group!.activeSubs;
  }
  function principal(): number {
    // Outstanding principal — partial returns (§4.6) already taken off.
    return group!.outstanding;
  }
  function due(toDate: string): number {
    return group!.activeSubs.reduce((s, e) => s + accruedInterest(e, toDate), 0);
  }

  // Recompute defaults each time the dialog opens.
  useEffect(() => {
    if (open && group) {
      setForm({
        dateReturned: today(),
        interestCollected: due(today()),
        totalCollected: principal() + due(today()),
        notes: "",
      });
      setCollectedTouched(false);
      setError("");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, group]);

  /** Update one field of the form. */
  const set =
    (key: keyof ReleaseForm) =>
    (e: ChangeEvent<HTMLInputElement>) =>
      setForm({ ...form, [key]: e.target.value });

  /** Date change: recompute the collectable-derived fields, except a
      Total Collected the user has already taken over. */
  function onDateReturned(e: ChangeEvent<HTMLInputElement>) {
    const date = e.target.value;
    setForm((f) => ({
      ...f,
      dateReturned: date,
      totalCollected: collectedTouched ? f.totalCollected : principal() + due(date),
    }));
  }

  /** Freeze the group and let the page refresh its table. */
  async function save(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!group) return; // only reachable in render — satisfies TS
    try {
      await releaseGroup(group.groupId, {
        dateReturned: form.dateReturned,
        interestCollected: Number(form.interestCollected) || 0,
        totalCollected: Number(form.totalCollected) || 0,
        notes: form.notes,
      });
      toast(`Collateral released — collected ${money(Number(form.totalCollected))}`, "ok");
      onSaved({ groupId: group.groupId });
      onClose();
    } catch (err) {
      setError((err as Error).message);
    }
  }

  if (!group) return null;
  const toCollect = principal() + due(form.dateReturned);

  return (
    <Modal open={open} title="Release Entry" onClose={onClose}>
      {/* What is being released */}
      <div className="mb-4 rounded-lg bg-tint p-3 text-sm text-slate">
        <div className="grid grid-cols-2 gap-y-1">
          <span>Customer</span><span className="text-ink">{group.customerName}</span>
          <span>Item</span><span className="text-ink">{group.item}</span>
          <span>Lends in this entry</span>
          <span className="text-ink">
            {group.subs.length} ({group.activeSubs.length} active)
          </span>
          <span>Principal outstanding</span>
          <span className="text-ink">{money(principal())}</span>
          <span>Interest due</span>
          <span className="font-medium text-ink">{money(due(form.dateReturned))}</span>
          <span>Total collectable</span>
          <span className="font-medium text-primary">{money(toCollect)}</span>
        </div>
      </div>

      <form onSubmit={save} className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <label className={labelCls}>
            Date Returned
            <input type="date" required value={form.dateReturned} onChange={onDateReturned}
              className={`${inputCls} mt-1`} />
          </label>
          {/* What actually came from the customer at the counter */}
          <label className={labelCls}>
            Total Collected
            <input type="number" min="0" step="1" required value={form.totalCollected}
              onChange={(e) => { setCollectedTouched(true); set("totalCollected")(e); }}
              className={`${inputCls} mt-1`} />
          </label>
          <label className={labelCls + " col-span-2"}>
            Interest Collected <span className="normal-case text-muted">(books figure — spread across the lends)</span>
            <input type="number" min="0" step="1" value={form.interestCollected}
              onChange={set("interestCollected")} className={`${inputCls} mt-1`} />
          </label>
          <label className={labelCls + " col-span-2"}>
            Notes <span className="normal-case text-muted">(optional)</span>
            <input value={form.notes} onChange={set("notes")} className={`${inputCls} mt-1`} />
          </label>
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <div className="flex items-center justify-between pt-2">
          <span className="text-xs text-muted">
            Interest is calculated from each lend's own date.
          </span>
          <div className="flex gap-2">
            <button type="button" onClick={onClose} className={secondaryBtnCls}>Cancel</button>
            <button type="submit" className={primaryBtnCls}>Confirm Release</button>
          </div>
        </div>
      </form>
    </Modal>
  );
}