import { useEffect, useState, type ChangeEvent, type FormEvent } from "react";
import type { CollateralGroup, Customer, Entry, EntryForm } from "../../api/types.ts";
import Modal from "../Modal.tsx";
import EntryFields from "./EntryFields.tsx";
import { inputCls, labelCls, primaryBtnCls, secondaryBtnCls } from "../ui.ts";
import { addEntry, updateEntry, ensureCustomer } from "../../api/client.ts";
import { money, today } from "../../utils/format.ts";

/**
 * AddEntryDialog — opens in one of three modes (all the state/rules,
 * none of the field markup — that lives in EntryFields):
 *  1. `group` passed -> sub-lend directly onto that collateral (customer
 *     and item show read-only; fields: date, amount, rate, notes).
 *  2. `entry` passed -> edit an active entry or an individual sub-lend
 *     (customer and item locked).
 *  3. neither        -> fresh entry. The customer is TYPED as a textbox;
 *     as you type, a Google-search-style dropdown suggests customers who
 *     are already on file (name · address · active-lend count — see
 *     CustomerSuggestions below). When the save happens, an unknown name
 *     is created on the spot with the typed address (find-or-create,
 *     §4.1). There is NO sub-lend choice in this dialog: a top-up on an
 *     existing collateral is started from the row's ⋮ → Add Sub-Lend.
 * `groups` and `customers` carry the live data for the suggestions.
 */
interface Props {
  open: boolean;
  /** Present = edit one existing lend (mode 2). */
  entry?: Entry;
  /** Present = sub-lend onto that collateral (mode 1). */
  group?: CollateralGroup;
  /** Live active groups — kept for parity with the Dashboard's other
      dialogs; the suggestions only need `customers` today. */
  groups?: CollateralGroup[];
  /** Customers on file — feeds the type-ahead suggestions. */
  customers?: Customer[];
  onClose: () => void;
  onSaved: () => void | Promise<void>;
}

export default function AddEntryDialog({ open, entry, group, groups = [], customers = [], onClose, onSaved }: Props) {
  const editing = Boolean(entry);
  const subOf = Boolean(group); // sub-lend aimed at one specific group

  /** Initial form values for the current mode. A brand-new collateral
      pre-fills the counter's usual 2%/mo; a sub-lend inherits the
      original lend's rate; edit mode keeps the entry's own rate. */
  const DEFAULT_RATE = "2";
  function initialForm(): EntryForm {
    if (group) {
      // A sub-lend inherits the original lend's rate — it is the same
      // collateral, so the deal is the same. Interest-free original
      // (rate null) pre-fills interest-free too; the 2%/mo default is
      // only for brand-new collaterals below.
      return {
        customerId: String(group.customerId),
        customerName: group.customerName,
        customerAddress: "",
        date: today(), item: "", amount: "",
        rate: group.primary.rate == null ? "" : String(group.primary.rate), notes: "",
      };
    }
    if (entry)
      return {
        customerId: String(entry.customerId),
        customerName: entry.customerName, customerAddress: "",
        date: entry.date, item: entry.item, amount: String(entry.amount),
        // Rate is a string field of the form; String("2.5") === "2.5" so
        // the pre-fill renders exactly as it did as a bare number.
        rate: entry.rate == null ? "" : String(entry.rate), notes: entry.notes,
      };
    return {
      customerId: "", customerName: "", customerAddress: "",
      date: today(), item: "", amount: "", rate: DEFAULT_RATE, notes: "",
    };
  }
  const [form, setForm] = useState(initialForm);
  const [error, setError] = useState("");

  /** Reset every time the dialog opens (or its target changes). */
  useEffect(() => {
    if (open) {
      setForm(initialForm());
      setError("");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, entry, group]);

  /** Update one field of the form. */
  const set =
    (key: keyof EntryForm) =>
    (e: ChangeEvent<HTMLInputElement>) =>
      setForm({ ...form, [key]: e.target.value });

  /** Shared payload for every branch — an empty rate stays null (§4.4,
      optional interest). */
  function payload() {
    return {
      date: form.date,
      amount: Number(form.amount),
      rate: form.rate === "" ? null : Number(form.rate),
      notes: form.notes,
    };
  }

  /** Validate, then call the API and let the page refresh its table.
      Which identity fields accompany the payload depends on the mode. */
  async function save(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!(Number(form.amount) > 0)) return setError("Amount must be greater than 0");
    try {
      if (editing && entry) {
        await updateEntry(entry.id, {
          customerId: entry.customerId,
          item: entry.item,
          ...payload(),
        });
      } else if (subOf && group) {
        // Sub-lend: join that collateral group (customer + item from it).
        await addEntry({
          groupId: group.groupId,
          customerId: group.customerId,
          item: group.item,
          ...payload(),
        });
      } else {
        // Fresh entry: the typed name, find-or-create with the address.
        const name = form.customerName.trim();
        if (!name) return setError("Enter the customer name");
        const c = await ensureCustomer(name, form.customerAddress.trim());
        await addEntry({
          customerId: c.id,
          item: form.item.trim(),
          ...payload(),
        });
      }
      onSaved();
      onClose();
    } catch (err) {
      setError((err as Error).message); // the API's `{ message }` text
    }
  }

  /** Customer field: locked when joining a group or editing; in fresh
      mode a free textbox with Google-search-style suggestions, plus an
      address for a customer who isn't on file yet. */
  function customerField() {
    if (subOf || editing)
      return <input disabled readOnly value={form.customerName}
        className={`${inputCls} text-muted`} />;
    return (
      <CustomerSuggestions
        form={form}
        set={set}
        customers={customers}
        // A picked suggestion fills the name, bringing their saved address
        // along (still editable; the pick never erases something typed).
        onPick={(c) =>
          setForm((f) => ({
            ...f,
            customerName: c.name,
            customerAddress: c.address || f.customerAddress,
          }))
        }
      />
    );
  }

  /** Item field: locked unless this is a brand-new collateral. */
  function itemField() {
    // `subOf`/`editing` guard `group`/`entry` one-for-one (same booleans
    // the save() branch uses), so both lookups are always safe here.
    const locked = subOf && group ? group.item : editing && entry ? entry.item : undefined;
    if (locked != null)
      return <input disabled readOnly value={locked}
        className={`${inputCls} text-muted`} />;
    return (
      <input required value={form.item} onChange={set("item")}
        placeholder="Gold chain (12g)" className={inputCls} />
    );
  }

  const title = editing ? "Edit Entry" : subOf ? "Add Sub-Lend" : "Add Entry";

  return (
    <Modal open={open} title={title} onClose={onClose}>
      {/* Info: what this lend attaches to (subOf === Boolean(group)) */}
      {subOf && group && (
        <div className="mb-4 rounded-lg bg-tint p-3 text-sm text-slate">
          Adding to <b className="text-ink">{group.customerName}</b> · {group.item}
          <span className="ml-2 text-xs">({money(group.totalAmount)} lent so far)</span>
        </div>
      )}

      <form onSubmit={save} className="space-y-3">
        <EntryFields
          form={form}
          set={set}
          customerNode={customerField()}
          itemNode={itemField()}
        />

        {error && <p className="text-sm text-red-600">{error}</p>}

        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onClose} className={secondaryBtnCls}>Cancel</button>
          <button type="submit" className={primaryBtnCls}>
            {editing ? "Save Changes" : subOf ? "Add Sub-Lend" : "Save Entry"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

/**
 * CustomerSuggestions — the name input with Google-search-style
 * suggestions: as you type, customers whose name contains the text drop
 * down beneath, showing name · address · how many collaterals they have
 * active. A pick (click, or Enter on a highlighted suggestion) fills the
 * name and the saved address hint below; Escape closes. Tab and ↑/↓ walk
 * the suggestions one by one — nothing is auto-selected, whatever is
 * highlighted when Enter is hit is the pick, just like Google Search.
 * Highlighting past the last match closes the list and Tab moves on.
 * Selection survives the input's blur: the buttons never steal focus
 * (preventDefault on mousedown), so the click always lands.
 */
interface SuggestionsProps {
  form: EntryForm;
  /** Field updater shared with the dialog (EntryFields' `set`). */
  set: (key: keyof EntryForm) => (e: ChangeEvent<HTMLInputElement>) => void;
  /** A picked (already-on-file) customer fills the name + address. */
  onPick: (c: Pick<Customer, "name" | "address">) => void;
  customers: Customer[];
}

function CustomerSuggestions({ form, set, onPick, customers }: SuggestionsProps) {
  const [openList, setOpenList] = useState(false);
  const [hi, setHi] = useState(-1); // keyboard-highlighted suggestion
  const query = form.customerName.trim().toLowerCase();

  // Suggest everyone whose name CONTAINS what is typed (google style).
  const matches: Customer[] = query
    ? customers.filter((c) => c.name.toLowerCase().includes(query))
    : [];

  /** One selection path, shared by click and keyboard. */
  function pick(c: Customer) {
    onPick(c);
    setOpenList(false);
    setHi(-1);
  }

  // New typing invalidates whatever the keyboard highlight pointed at.
  useEffect(() => setHi(-1), [query]);

  return (
    <div className="space-y-2">
      <div className="relative">
        <input
          required
          value={form.customerName}
          onChange={set("customerName")}
          onFocus={() => setOpenList(true)}
          onBlur={() => setTimeout(() => setOpenList(false), 120)} // let a click land
          onKeyDown={(e) => {
            if (!openList) {
              if (e.key === "ArrowDown" && matches.length > 0) setOpenList(true);
              return;
            }
            if (e.key === "ArrowDown") {
              e.preventDefault();
              setHi((h) => Math.min(h + 1, matches.length - 1));
            } else if (e.key === "ArrowUp") {
              e.preventDefault();
              setHi((h) => Math.max(h - 1, 0));
            } else if (e.key === "Escape") {
              setOpenList(false);
            } else if (e.key === "Enter" && hi >= 0 && hi < matches.length) {
              e.preventDefault(); // pick the highlighted one, not submit
              pick(matches[hi]);
            } else if (e.key === "Tab" && matches.length > 0) {
              // Tab, like ↑, WALKS the suggestions (Shift+Tab backwards) —
              // it never picks for you: Enter does, on whatever is
              // highlighted. Passing the last match closes the list and
              // the next Tab moves to the next field normally.
              e.preventDefault();
              if (e.shiftKey) {
                setHi((h) => (h <= 0 ? matches.length - 1 : h - 1));
              } else
                setHi((h) => {
                  const next = h + 1;
                  if (next >= matches.length) {
                    setOpenList(false);
                    return -1;
                  }
                  return next;
                });
            }
            // Enter with nothing highlighted = submit the form, as usual.
          }}
          placeholder="Customer name — e.g. Tanmay"
          className={inputCls}
          autoComplete="off"
        />
        {openList && matches.length > 0 && (
          <ul
            role="listbox"
            className="absolute inset-x-0 top-full z-20 mt-1 max-h-48 overflow-y-auto rounded-lg border border-line bg-card shadow-lg"
          >
            {matches.map((c, i) => (
              <li key={c.id} role="option" aria-selected={i === hi}>
                <button
                  type="button"
                  // Focus stays on the input (no blur), so the list never
                  // closes between mousedown and mouseup — click lands.
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => pick(c)}
                  onMouseMove={() => setHi(i)}
                  className={`flex w-full items-baseline justify-between gap-2 px-3 py-1.5 text-left text-sm ${
                    i === hi ? "bg-tint text-ink" : "hover:bg-tint"
                  }`}
                >
                  <span>
                    {c.name}
                    {c.address && <span className="ml-1.5 text-xs text-muted">· {c.address}</span>}
                  </span>
                  <span className="text-xs text-dim">{c.activeCount} active</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
      <input
        value={form.customerAddress}
        onChange={set("customerAddress")}
        placeholder={typedPlaceholder(form, customers)}
        className={`${inputCls} text-sm`}
        autoComplete="off"
      />
    </div>
  );
}

/** Address hint: the picked customer's saved area, or "for a new customer". */
function typedPlaceholder(form: EntryForm, customers: Customer[]): string {
  const match = customers.find(
    (c) => c.name.trim().toLowerCase() === form.customerName.trim().toLowerCase()
  );
  return match ? "Customer on file" : "Address — e.g. Thane (for a new customer)";
}