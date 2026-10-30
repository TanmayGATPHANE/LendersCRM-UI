import { useEffect, useState, type ChangeEvent, type FormEvent } from "react";
import type { Role } from "../../api/types.ts";
import Modal from "../Modal.tsx";
import { inputCls, labelCls, primaryBtnCls, secondaryBtnCls } from "../ui.ts";

/**
 * AddUserDialog — name, email, password and role; minimal validation.
 * Edit/disable lives in the Users page table; onSaved hands the form to
 * the page's API call (addUser) — close happens only on success, and a
 * rejection (bad email, duplicate, weak password) shows its message.
 */
interface Props {
  open: boolean;
  /** Emails already on file — the duplicate check runs here. */
  emails: string[];
  onClose: () => void;
  /** The page's addUser call; rejected (throws) keeps the dialog open.
      `unknown` return: the page may resolve with the created user. */
  onSaved: (form: { name: string; email: string; password: string; role: Role }) => unknown;
}

/** Form state — role kept as the Role union, never a bare string. */
interface UserForm {
  name: string;
  email: string;
  password: string;
  role: Role;
}

export default function AddUserDialog({ open, emails, onClose, onSaved }: Props) {
  const [form, setForm] = useState<UserForm>({ name: "", email: "", password: "", role: "Lender" });
  const [error, setError] = useState("");

  // Fresh form every time the dialog opens.
  useEffect(() => {
    if (open) {
      setForm({ name: "", email: "", password: "", role: "Lender" });
      setError("");
    }
  }, [open]);

  /** Update one field of the form. The <select>'s options are exactly the
      Role union, so the string cast is safe — kept in spread form so the
      reset/save logic stays untouched. */
  const set =
    (key: keyof UserForm) =>
    (e: ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
      setForm({ ...form, [key]: e.target.value } as UserForm);

  /** Basic validation, then the page's API call; close only on success. */
  async function save(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (form.password.length < 6) return setError("Password needs at least 6 characters");
    if (emails.some((m) => m.toLowerCase() === form.email.toLowerCase()))
      return setError("That email is already used");
    try {
      await onSaved(form);
      onClose();
    } catch (err) {
      setError((err as Error).message); // e.g. "A user with this email already exists"
    }
  }

  return (
    <Modal open={open} title="Add User" onClose={onClose}>
      <form onSubmit={save} className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <label className={labelCls}>
            Name
            <input required value={form.name} onChange={set("name")} className={`${inputCls} mt-1`} />
          </label>
          <label className={labelCls}>
            Role
            <select value={form.role} onChange={set("role")} className={`${inputCls} mt-1`}>
              <option>Lender</option>
              <option>ViewOnly</option>
              <option>Admin</option>
            </select>
          </label>
          <label className={labelCls}>
            Email
            <input type="email" required value={form.email} onChange={set("email")}
              className={`${inputCls} mt-1`} />
          </label>
          <label className={labelCls}>
            Password
            <input type="password" required value={form.password} onChange={set("password")}
              className={`${inputCls} mt-1`} />
          </label>
        </div>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onClose} className={secondaryBtnCls}>Cancel</button>
          <button type="submit" className={primaryBtnCls}>Add User</button>
        </div>
      </form>
    </Modal>
  );
}