import { useEffect, useState } from "react";
import Modal from "../Modal.tsx";
import { toast } from "../Toast.tsx";
import { labelCls, primaryBtnCls, secondaryBtnCls } from "../ui.ts";
import type { Role, UserItem } from "../../api/types.ts";

/**
 * ChangeRoleDialog — re-assign one account's role (§2). Admin manages
 * everything including users; Lender runs the counter without touching
 * accounts; ViewOnly reads the books and writes nothing. The change is
 * server-validated (the last active Admin cannot be demoted — the
 * backend refuses and this dialog shows why).
 */
interface Props {
  open: boolean;
  user: UserItem | null;
  onClose: () => void;
  /** The page's updateUser call — resolves to the updated row or throws. */
  onSaved: (id: number, role: Role) => Promise<UserItem>;
}

const ROLES: Array<{ role: Role; blurb: string }> = [
  { role: "Admin", blurb: "Everything: users, customers, entries, cash, reports" },
  { role: "Lender", blurb: "Runs the counter: add/release entries, record returns — no user management" },
  { role: "ViewOnly", blurb: "Reads every page (auditor) — cannot change anything" },
];

export default function ChangeRoleDialog({ open, user, onClose, onSaved }: Props) {
  const [role, setRole] = useState<Role>("Lender");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  // Fresh pick each time the dialog opens — armed with the current role.
  useEffect(() => {
    if (open && user) {
      setRole(user.role);
      setError("");
    }
  }, [open, user]);

  async function save(): Promise<void> {
    if (!user) return;
    if (role === user.role) return onClose(); // nothing picked differently
    setSaving(true);
    setError("");
    try {
      const updated = await onSaved(user.id, role);
      toast(`Role updated — ${updated.name} is now ${updated.role}`, "ok");
      onClose();
    } catch (err) {
      setError((err as Error).message); // e.g. last-admin refusal from the backend
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal open={open} title="Change Role" onClose={onClose}>
      <div className="space-y-3">
        <div className="rounded-lg bg-tint p-3 text-sm text-slate">
          <span className="text-muted">Account</span> · <span className="font-medium text-ink">{user?.name}</span>{" "}
          <span className="text-muted">({user?.email})</span>
        </div>

        <fieldset className="space-y-2">
          <legend className={labelCls}>Role</legend>
          {ROLES.map((r) => (
            <label
              key={r.role}
              className={`flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition-colors duration-300 ease-brand
                          focus-within:outline-none focus-within:ring-2 focus-within:ring-primary/40
                          ${role === r.role ? "border-primary bg-tint ring-1 ring-primary/30" : "border-line hover:bg-tint-hover"}`}
            >
              <input
                type="radio"
                name="role"
                value={r.role}
                checked={role === r.role}
                onChange={() => setRole(r.role)}
                className="mt-0.5 accent-[color:var(--color-primary)]"
              />
              <span>
                <span className="block text-sm font-semibold text-ink">{r.role}</span>
                <span className="block text-xs text-muted">{r.blurb}</span>
              </span>
            </label>
          ))}
        </fieldset>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <p className="text-xs text-muted">
          Takes effect at the account's next sign-in — a signed-in session keeps its current access until then.
        </p>

        <div className="flex justify-end gap-2 pt-1">
          <button onClick={onClose} className={secondaryBtnCls}>Cancel</button>
          <button onClick={save} disabled={saving} className={primaryBtnCls}>
            <i className={`ph ph-shield-star text-base ${saving ? "animate-pulse" : ""}`} aria-hidden="true" />
            {saving ? "Saving…" : "Change Role"}
          </button>
        </div>
      </div>
    </Modal>
  );
}
