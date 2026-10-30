import { useEffect, useState, type ChangeEvent, type FormEvent } from "react";
import type { Customer } from "../../api/types.ts";
import Modal from "../Modal.tsx";
import { toast } from "../Toast.tsx";
import { inputCls, labelCls, primaryBtnCls, secondaryBtnCls } from "../ui.ts";
import { addCustomer, updateCustomer } from "../../api/client.ts";

/**
 * CustomerDialog — add or edit a customer: name, phone and address.
 * Decides its own mode from the `customer` prop: present = edit,
 * absent = add.
 */
interface Props {
  open: boolean;
  /** Present = edit this customer; absent = add a new one. */
  customer?: Customer;
  onClose: () => void;
  /** Called after a successful add/update (the page refetches). */
  onSaved: () => void | Promise<void>;
}

export default function CustomerDialog({ open, customer, onClose, onSaved }: Props) {
  const editing = Boolean(customer);
  const [form, setForm] = useState({ name: "", phone: "", address: "" });
  const [error, setError] = useState("");

  // Reset the form each time the dialog opens.
  // Reset the form each time the dialog opens.
  useEffect(() => {
    if (open) {
      setForm({
        name: customer ? customer.name : "",
        phone: customer ? customer.phone : "",
        address: customer ? customer.address ?? "" : "",
      });
      setError("");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, customer]);

  /** Update one field of the form. */
  const set =
    (key: "name" | "phone" | "address") =>
    (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setForm({ ...form, [key]: e.target.value });

  /** Save through the API: update when editing, create otherwise. */
  async function save(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const values = {
      name: form.name.trim(),
      phone: form.phone.trim(),
      address: form.address.trim(),
    };
    if (!values.name) return setError("Name is required");
    if (!/^\d{10}$/.test(values.phone.replace(/\s/g, "")))
      return setError("Phone must be 10 digits");
    try {
      await (editing && customer
        ? updateCustomer(customer.id, values)
        : addCustomer(values));
      toast(`${editing ? "Customer updated" : "Customer added"} — ${values.name}`, "ok");
      onSaved();
      onClose();
    } catch (err) {
      setError((err as Error).message);
    }
  }

  return (
    <Modal open={open} title={editing ? "Edit Customer" : "Add Customer"} onClose={onClose}>
      <form onSubmit={save} className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <label className={labelCls}>
            Name
            <input required value={form.name} onChange={set("name")}
              placeholder="Full name" className={`${inputCls} mt-1`} />
          </label>
          <label className={labelCls}>
            Phone
            <input required value={form.phone} onChange={set("phone")}
              placeholder="10 digits" className={`${inputCls} mt-1`} />
          </label>
          <label className={labelCls + " col-span-2"}>
            Address <span className="normal-case text-muted">(area / locality — e.g. Thane)</span>
            <textarea value={form.address} onChange={set("address")}
              placeholder="Shop 12, Station Road, Thane" rows={2}
              className={`${inputCls} mt-1`} />
          </label>
        </div>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onClose} className={secondaryBtnCls}>Cancel</button>
          <button type="submit" className={primaryBtnCls}>
            {editing ? "Save Changes" : "Add Customer"}
          </button>
        </div>
      </form>
    </Modal>
  );
}