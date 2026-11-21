import { useEffect, useState } from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { currentUser, setUser } from "../api/client.ts";
import { ghostIconBtnCls } from "./ui.ts";
import GlobalSearch from "./GlobalSearch.tsx";
import UserMenu from "./UserMenu.tsx";
import Toaster from "./Toast.tsx";

/** The browser tab names the page being shown. */
const TITLES: Record<string, string> = {
  "/": "Dashboard",
  "/customers": "Customers",
  "/cash": "Cash",
  "/reports": "Reports",
  "/outsourced": "Outsourced",
  "/users": "Users",
  "/activity": "Activity",
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

  // A nav label: fully shown on mobile and while the desktop rail is
  // expanded; collapsed to zero width (and faded) in the 64px rail.
  // Kept in the DOM for screen readers; focus-within expands it too, so
  // keyboard users always see the label they are on.
  const labelCls =
    "max-w-40 overflow-hidden whitespace-nowrap opacity-100 transition-[max-width,opacity] duration-300 ease-brand " +
    "lg:max-w-0 lg:opacity-0 " +
    "lg:group-hover/nav:max-w-40 lg:group-hover/nav:opacity-100 " +
    "lg:group-has-[:focus-visible]/nav:max-w-40 lg:group-has-[:focus-visible]/nav:opacity-100 " +
    "motion-reduce:transition-none";

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

      {/* Sidebar — off-canvas drawer under lg; a 64px icon rail from lg up
          that expands to 224px on hover/focus. The ASIDE itself animates its
          width, so the page beside it shrinks/grows with the rail instead of
          being covered by it. */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 w-64 shrink-0 bg-card shadow-lg
                    transition-transform duration-300 ease-brand motion-reduce:transition-none
                    lg:relative lg:z-auto lg:w-16 lg:hover:w-56 lg:has-[:focus-visible]:w-56
                    lg:shadow-[0_1px_8px_rgba(0,0,0,0.06)]
                    lg:transition-[width] lg:duration-300 lg:ease-brand
                    ${navOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}`}
      >
        {/* The rail's content; clipped while the width animates. */}
        <div className="group/nav flex h-full w-full flex-col justify-between overflow-hidden bg-card">
        <div>
          <div className="flex h-12 items-center gap-2.5 px-4 border-b border-line">
            {/* Logo tile — the app's mark, reused in favicon.svg */}
            <span className="grid h-8 w-8 place-items-center rounded-lg bg-primary text-on-primary">
              <span className="text-base font-semibold">₹</span>
            </span>
            <div className={`leading-tight ${labelCls}`}>
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
            <NavLink to="/" end className={linkClass} title="Dashboard">
              <i className={`${iconCls} ph-squares-four`} aria-hidden="true" />
              <span className={labelCls}>Dashboard</span>
            </NavLink>
            <NavLink to="/customers" className={linkClass} title="Customers">
              <i className={`${iconCls} ph-users`} aria-hidden="true" />
              <span className={labelCls}>Customers</span>
            </NavLink>
            <NavLink to="/cash" className={linkClass} title="Cash">
              <i className={`${iconCls} ph-coins`} aria-hidden="true" />
              <span className={labelCls}>Cash</span>
            </NavLink>
            <NavLink to="/reports" className={linkClass} title="Reports">
              <i className={`${iconCls} ph-chart-bar`} aria-hidden="true" />
              <span className={labelCls}>Reports</span>
            </NavLink>
            <NavLink to="/outsourced" className={linkClass} title="Outsourced">
              <i className={`${iconCls} ph-package`} aria-hidden="true" />
              <span className={labelCls}>Outsourced</span>
            </NavLink>
            {/* Admin-only pages */}
            {user?.role === "Admin" && (
              <NavLink to="/activity" className={linkClass} title="Activity">
                <i className={`${iconCls} ph-clock-counter-clockwise`} aria-hidden="true" />
                <span className={labelCls}>Activity</span>
              </NavLink>
            )}
            {user?.role === "Admin" && (
              <NavLink to="/users" className={linkClass} title="Users">
                <i className={`${iconCls} ph-identification-card`} aria-hidden="true" />
                <span className={labelCls}>Users</span>
              </NavLink>
            )}
          </nav>
        </div>
        <div className="flex items-center justify-center gap-2 bg-tint p-4 lg:p-3">
          <span
            className="hidden h-1.5 w-1.5 rounded-full bg-line lg:block lg:group-hover/nav:hidden lg:group-has-[:focus-visible]/nav:hidden"
            aria-hidden="true"
          />
          <span className={`${labelCls} block text-center text-xs text-muted`}>AMS · v0.1</span>
        </div>
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