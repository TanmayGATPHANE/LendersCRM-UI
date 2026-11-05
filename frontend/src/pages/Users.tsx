import { useEffect, useState } from "react";
import DotsMenu from "../components/DotsMenu.tsx";
import AddUserDialog from "../components/dialogs/AddUserDialog.tsx";
import { fetchUsers, addUser, updateUser } from "../api/client.ts";
import type { Role, UserItem } from "../api/types.ts";
import { inputCls, primaryBtnCls } from "../components/ui.ts";
import { toast } from "../components/Toast.tsx";

/**
 * Users — admin-only page for managing who can sign in (Admin / Lender /
 * ViewOnly), backed by GET/POST/PUT /api/users. Same layout pattern as
 * Customers: search + table + dialog, and only the table scrolls.
 * The add dialog is its own component (AddUserDialog).
 */
export default function Users() {
  const [users, setUsers] = useState<UserItem[]>([]);
  const [search, setSearch] = useState("");
  const [adding, setAdding] = useState(false);

  useEffect(() => {
    fetchUsers().then(setUsers).catch((e: unknown) => toast((e as Error).message));
  }, []);

  // Case-insensitive filter over name and email.
  const shown = users.filter((u) => {
    const q = search.trim().toLowerCase();
    return !q || u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q);
  });

  /** Enable/disable an account (PUT /api/users/{id} isActive). */
  async function toggleActive(u: UserItem): Promise<void> {
    try {
      const updated = await updateUser(u.id, { isActive: !u.isActive });
      setUsers((prev) => prev.map((x) => (x.id === u.id ? updated : x)));
      toast(updated.isActive ? `Account enabled — ${u.name}` : `Account disabled — ${u.name}`, "ok");
    } catch (err) {
      toast((err as Error).message);
    }
  }

  /** Create the user (POST /api/users) and put the row in the table right
      away — the dialog closes only when this resolves; a rejection keeps
      it open with the backend's message. */
  async function addNewUser(form: { name: string; email: string; password: string; role: Role }) {
    const created = await addUser(form);
    setUsers((prev) => [...prev, created]);
  }

  const th = "px-3 py-2 text-left text-xs font-medium uppercase tracking-wider text-muted";

  return (
    <main className="flex flex-1 flex-col overflow-hidden px-3 py-3 sm:px-6 sm:py-4">
      {/* Toolbar: search left, Add User right */}
      <div className="flex shrink-0 flex-wrap items-center gap-3 pb-3">
        <div className="min-w-44 max-w-xs flex-1">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search name or email…"
            className={inputCls}
          />
        </div>
        <div className="flex-1" />
        <button onClick={() => setAdding(true)} className={primaryBtnCls}>
          <i className="ph ph-plus text-lg" aria-hidden="true" />
          Add User
        </button>
      </div>

      {/* Users — cards on phones, the table from md up */}
      <div className="table-scroll flex-1 overflow-x-auto overflow-y-auto rounded-xl border border-line bg-card shadow-sm">
        <div className="stagger space-y-2 p-3 md:hidden">
          {shown.map((u) => (
            <div key={u.id} className="rounded-xl border border-line p-3 shadow-sm">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <span className="block truncate text-sm font-semibold text-ink">{u.name}</span>
                  <span className="block truncate text-xs text-muted">{u.email}</span>
                </div>
                <DotsMenu
                  items={[
                    { label: u.isActive ? "Disable" : "Enable", onClick: () => toggleActive(u) },
                  ]}
                />
              </div>
              <div className="mt-2 flex items-center gap-2">
                <RoleBadge role={u.role} />
                <span
                  className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${
                    u.isActive ? "bg-badge-ok-bg text-badge-ok" : "bg-badge-off-bg text-badge-off"
                  }`}
                >
                  {u.isActive ? "Active" : "Disabled"}
                </span>
              </div>
            </div>
          ))}
          {shown.length === 0 && (
            <p className="py-10 text-center text-sm text-muted">No users found.</p>
          )}
        </div>

        <table className="hidden w-full min-w-[560px] text-sm md:table">
          <thead className="sticky top-0 z-10 bg-card border-b border-line">
            <tr>
              <th className={th}>Name</th>
              <th className={th}>Email</th>
              <th className={th}>Role</th>
              <th className={th}>Status</th>
              <th className={`${th} w-16 text-right`}>Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {shown.map((u) => (
              <tr key={u.id} className="hover:bg-tint">
                <td className="px-3 py-2">{u.name}</td>
                <td className="px-3 py-2 text-slate">{u.email}</td>
                <td className="px-3 py-2">
                  <RoleBadge role={u.role} />
                </td>
                <td className="px-3 py-2">
                  <span
                    className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${
                      u.isActive ? "bg-badge-ok-bg text-badge-ok" : "bg-badge-off-bg text-badge-off"
                    }`}
                  >
                    {u.isActive ? "Active" : "Disabled"}
                  </span>
                </td>
                <td className="px-3 py-2 text-right">
                  <DotsMenu
                    items={[
                      {
                        label: u.isActive ? "Disable" : "Enable",
                        onClick: () => toggleActive(u),
                      },
                    ]}
                  />
                </td>
              </tr>
            ))}
            {shown.length === 0 && (
              <tr className="hidden md:table-row">
                <td colSpan={5} className="px-3 py-10 text-center text-sm text-muted">
                  No users found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Add user dialog — own component, keeps this page table-only.
          onSaved creates the user and appends it to the table; a rejected
          promise keeps the dialog open with the backend's message. */}
      <AddUserDialog
        open={adding}
        emails={users.map((u) => u.email)} // for the duplicate check
        onClose={() => setAdding(false)}
        onSaved={addNewUser}
      />
    </main>
  );
}

/**
 * Roles: Admin manages everything including users; Lender runs the
 * counter; ViewOnly browses the books but cannot write anywhere.
 */
function RoleBadge({ role }: { role: Role }) {
  const cls =
    role === "Admin"
      ? "bg-purple-100 text-purple-700"
      : role === "ViewOnly"
        ? "bg-badge-off-bg text-badge-off"
        : "bg-blue-100 text-blue-700";
  return (
    <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${cls}`}>
      {role}
    </span>
  );
}