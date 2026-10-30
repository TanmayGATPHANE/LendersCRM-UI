import { useEffect } from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { currentUser, setUser } from "../api/client.ts";
import GlobalSearch from "./GlobalSearch.tsx";
import UserMenu from "./UserMenu.tsx";
import Bell from "./Bell.tsx";
import Toaster from "./Toast.tsx";

/** The browser tab names the page being shown. */
const TITLES: Record<string, string> = {
  "/": "Dashboard",
  "/customers": "Customers",
  "/cash": "Cash",
  "/users": "Users",
};

/**
 * Shell for every authenticated page: fixed sidebar with the three nav
 * links, the signed-in user in the header, and <Outlet /> for the page.
 * Pages render inside a full-height (non-scrolling) region and decide
 * for themselves which part scrolls.
 */
export default function Layout() {
  const navigate = useNavigate();
  const location = useLocation();
  const user = currentUser();

  useEffect(() => {
    document.title = `AMS — ${TITLES[location.pathname] ?? "AMS"}`;
  }, [location.pathname]);

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
          <div className="flex h-12 items-center gap-2.5 px-4 border-b border-line">
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
        <header className="flex h-12 shrink-0 items-center gap-3 border-b border-line bg-card px-5">
          {/* The reference header: search left (with the kbd hint), then a
              clear middle, then the red-dot bell and the account chip. */}
          <GlobalSearch />
          <div className="flex-1" />
          <Bell />
          <UserMenu
            name={user?.name ?? ""}
            email={user?.email ?? ""}
            role={user?.role}
            onSignOut={signOut}
          />
        </header>
        <Outlet />
        <Toaster />
      </div>
    </div>
  );
}