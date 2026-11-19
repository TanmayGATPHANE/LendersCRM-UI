import { useEffect, useState } from "react";
import Modal from "./Modal.tsx";
import { dangerBtnCls, secondaryBtnCls } from "./ui.ts";

/**
 * ConfirmDialog — the app's in-app replacement for the browser's raw
 * window.confirm: one styled card with the plain consequence, Cancel and
 * the confirm verb. The confirm button latches while the action runs, so
 * a double click can't fire it twice (the same saving rule every dialog
 * follows).
 */
interface Props {
  open: boolean;
  title: string;
  /** The consequence, in one plain sentence. */
  message: string;
  /** The verb on the confirm button, e.g. "Delete Entry". */
  confirmLabel: string;
  onClose: () => void;
  /** Runs when confirmed; a thrown error keeps the dialog open with the
      message (the page shows it, like every dialog). */
  onConfirm: () => void | Promise<void>;
}

export default function ConfirmDialog({ open, title, message, confirmLabel, onClose, onConfirm }: Props) {
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) setBusy(false);
  }, [open]);

  async function confirm(): Promise<void> {
    if (busy) return;
    setBusy(true);
    try {
      await onConfirm();
      onClose();
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal open={open} title={title} onClose={onClose}>
      <p className="text-sm text-slate">{message}</p>
      <div className="mt-5 flex justify-end gap-2">
        <button type="button" onClick={onClose} disabled={busy} className={secondaryBtnCls}>Cancel</button>
        <button type="button" onClick={confirm} disabled={busy} className={dangerBtnCls}>
          {busy ? "Working…" : confirmLabel}
        </button>
      </div>
    </Modal>
  );
}
