import { useEffect, useState } from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { currentUser, setUser } from "../api/client.ts";
import { ghostIconBtnCls } from "./ui.ts";
import GlobalSearch from "./GlobalSearch.tsx";
import UserMenu from "./UserMenu.tsx";
import Bell from "./Bell.tsx";
import Toaster from "./Toast.tsx";

/** The browser tab names the page being shown. */
const TITLES: Record<string, string> = {
  "/": "Dashboard",
  "/customers": "Customers",
  "/cash": "Cash",
  "/reports": "Reports",
  "/users": "Users",
};

/**
 * Shell for every authenticated page: sidebar with the nav links, the
 * signed-in user in the header, and <Outlet /> for the page. On screens
 * under lg the sidebar becomes an off-canvas drawer behind a scrim,
 * opened from the header's hamburger and closed by picking a page,
 * tapping out or pressing Escape. Pages render inside a full-height
 * (non-scrolling) region and decide for themselves which part scrolls.
 */
export default function Layout() {
  const navigate = useNavigate();
  const location = useLocation();
  const user = currentUser();
  const [navOpen, setNavOpen] = useState(false); // mobile drawer

  useEffect(() => {
    document.title = `AMS — ${TITLES[location.pathname] ?? "AMS"}`;
  }, [location.pathname]);

  // Navigating (including from the drawer) always closes the drawer.
  useEffect(() => { setNavOpen(false); }, [location.pathname]);

  // Escape closes the drawer while it is open.
  useEffect(() => {
    if (!navOpen) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setNavOpen(false);
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [navOpen]);

  // Sign out: clear local storage and bounce to the login screen.
  function signOut() {
    setUser(null);
    navigate("/login");
  }

  // NavLink passes its render-prop state; only the active flag matters here.
  const linkClass = ({ isActive }: { isActive: boolean }) =>
    `group flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors duration-300 ease-brand
     focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 ${
      isActive
        ? "bg-primary text-on-primary font-medium"
        : "text-slate hover:bg-tint-hover hover:text-ink"
    }`;

  // The icon inside each nav link — nudges right on hover (desktop nicety).
  const iconCls =
    "ph text-xl transition-transform duration-300 ease-brand group-hover:translate-x-0.5";

  return (
    <div className="flex h-screen overflow-hidden bg-surface text-ink">
      {/* Scrim behind the mobile drawer */}
      {navOpen && (
        <div
          className="anim-fade-in fixed inset-0 z-40 bg-slate-900/45 lg:hidden"
          onClick={() => setNavOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Sidebar — off-canvas drawer under lg, static rail from lg up */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-64 shrink-0 flex-col justify-between bg-card
                    shadow-lg transition-transform duration-300 ease-brand motion-reduce:transition-none
                    lg:static lg:z-auto lg:w-56 lg:shadow-[0_1px_8px_rgba(0,0,0,0.04)]
                    ${navOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}`}
      >
        <div>
          <div className="flex h-12 items-center gap-2.5 px-4 border-b border-line">
            {/* Logo tile — the app's mark, reused in favicon.svg */}
            <span className="grid h-8 w-8 place-items-center rounded-lg bg-primary text-on-primary">
              <span className="text-base font-semibold">₹</span>
            </span>
            <div className="leading-tight">
              <span className="block font-semibold tracking-tight">AMS</span>
              <span className="block whitespace-nowrap text-xs uppercase tracking-wider text-muted">
                Amanat Management
              </span>
            </div>
            {/* Close affordance while the drawer is open on mobile */}
            <button
              onClick={() => setNavOpen(false)}
              className={`${ghostIconBtnCls} ml-auto lg:hidden`}
              aria-label="Close menu"
            >
              <i className="ph ph-x text-xl" aria-hidden="true" />
            </button>
          </div>
          <nav className="flex flex-col gap-1 p-2 pt-3">
            <NavLink to="/" end className={linkClass}>
              <i className={`${iconCls} ph-squares-four`} aria-hidden="true" />
              Dashboard
            </NavLink>
            <NavLink to="/customers" className={linkClass}>
              <i className={`${iconCls} ph-users`} aria-hidden="true" />
              Customers
            </NavLink>
            <NavLink to="/cash" className={linkClass}>
              <i className={`${iconCls} ph-coins`} aria-hidden="true" />
              Cash
            </NavLink>
            <NavLink to="/reports" className={linkClass}>
              <i className={`${iconCls} ph-chart-bar`} aria-hidden="true" />
              Reports
            </NavLink>
            {/* Admin-only page */}
            {user?.role === "Admin" && (
              <NavLink to="/users" className={linkClass}>
                <i className={`${iconCls} ph-identification-card`} aria-hidden="true" />
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
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <header className="flex h-12 shrink-0 items-center gap-2 border-b border-line bg-card px-3 sm:gap-3 sm:px-5">
          {/* Hamburger opens the nav drawer on mobile */}
          <button
            onClick={() => setNavOpen(true)}
            className={`${ghostIconBtnCls} lg:hidden`}
            aria-label="Open menu"
            aria-expanded={navOpen}
          >
            <i className="ph ph-list text-xl" aria-hidden="true" />
          </button>
          {/* The reference header: search left (with the kbd hint), then a
              clear middle, then the red-dot bell and the account chip. */}
          <GlobalSearch />
          <div className="hidden flex-1 sm:block" />
          <Bell />
          <UserMenu
            name={user?.name ?? ""}
            email={user?.email ?? ""}
            role={user?.role}
            onSignOut={signOut}
          />
        </header>
        {/* The page itself — keyed by path so switching pages replays the
            fade-up entrance (skipped under prefers-reduced-motion). */}
        <div key={location.pathname} className="anim-fade-up flex min-h-0 flex-1 flex-col">
          <Outlet />
        </div>
        <Toaster />
      </div>
    </div>
  );
}