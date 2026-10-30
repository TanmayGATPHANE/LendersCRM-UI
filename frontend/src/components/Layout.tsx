import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { currentUser, setUser } from "../api/client.ts";

/**
 * Shell for every authenticated page: fixed sidebar with the three nav
 * links, the signed-in user in the header, and <Outlet /> for the page.
 * Pages render inside a full-height (non-scrolling) region and decide
 * for themselves which part scrolls.
 */
export default function Layout() {
  const navigate = useNavigate();
  const user = currentUser();

  // Sign out: clear local storage and bounce to the login screen.
  function signOut() {
    setUser(null);
    navigate("/login");
  }

  // NavLink passes its render-prop state; only the active flag matters here.
  const linkClass = ({ isActive }: { isActive: boolean }) =>
    `flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors ${
      isActive
        ? "bg-primary text-on-primary font-medium"
        : "text-slate hover:bg-tint-hover hover:text-ink"
    }`;

  return (
    <div className="flex h-screen overflow-hidden bg-surface text-ink">
      {/* Sidebar */}
      <aside className="flex w-56 shrink-0 flex-col justify-between bg-card shadow-[0_1px_8px_rgba(0,0,0,0.04)]">
        <div>
          <div className="flex h-16 items-center gap-2.5 px-4 border-b border-line">
            {/* Logo tile — the app's mark, reused in favicon.svg */}
            <span className="grid h-8 w-8 place-items-center rounded-lg bg-primary text-on-primary">
              <span className="text-base font-semibold">₹</span>
            </span>
            <div className="leading-tight">
              <span className="block font-semibold tracking-tight">AMS</span>
              <span className="block text-[10px] uppercase tracking-wider text-muted">
                Amanat Management
              </span>
            </div>
          </div>
          <nav className="flex flex-col gap-1 p-2 pt-3">
            <NavLink to="/" end className={linkClass}>
              <span className="material-symbols-outlined text-[20px]">grid_view</span>
              Dashboard
            </NavLink>
            <NavLink to="/customers" className={linkClass}>
              <span className="material-symbols-outlined text-[20px]">group</span>
              Customers
            </NavLink>
            <NavLink to="/cash" className={linkClass}>
              <span className="material-symbols-outlined text-[20px]">payments</span>
              Cash
            </NavLink>
            {/* Admin-only page */}
            {user?.role === "Admin" && (
              <NavLink to="/users" className={linkClass}>
                <span className="material-symbols-outlined text-[20px]">badge</span>
                Users
              </NavLink>
            )}
          </nav>
        </div>
        <div className="p-4 bg-tint">
          <span className="block text-xs text-muted">AMS · v0.1</span>
        </div>
      </aside>

      {/* Main region */}
      <div className="flex flex-1 flex-col overflow-hidden">
        <header className="flex h-16 shrink-0 items-center justify-end gap-4 border-b border-line bg-card px-6">
          <span className="text-sm text-muted">{user?.email}</span>
          <button
            onClick={signOut}
            className="flex items-center gap-1 rounded-lg border border-line bg-tint px-3 py-1.5 text-sm text-slate hover:bg-tint-hover"
          >
            <span className="material-symbols-outlined text-[16px]">logout</span>
            Sign out
          </button>
        </header>
        <Outlet />
      </div>
    </div>
  );
}