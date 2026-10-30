import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import type { ReactNode } from "react";
import Layout from "./components/Layout.tsx";
import Login from "./pages/Login.tsx";
import Dashboard from "./pages/Dashboard.tsx";
import Customers from "./pages/Customers.tsx";
import Users from "./pages/Users.tsx";
import Cash from "./pages/Cash.tsx";
import { currentUser } from "./api/client.ts";
import type { Role } from "./api/types.ts";

/**
 * Route guards — redirect helpers for the route table below.
 */

/**
 * Redirects to /login when there is no signed-in user in storage.
 * Wraps the authenticated part of the app.
 */
function RequireAuth({ children }: { children: ReactNode }) {
  if (!currentUser()) return <Navigate to="/login" replace />;
  return children;
}

/** Props of RequireRole — the role that may open the route, plus the
    routed subtree. */
export interface Props {
  role: Role;
  children: ReactNode;
}

/** Guards a route by role — typing /users as a view-only or lender
    user bounces back to the dashboard (the sidebar hides it too). */
function RequireRole({ role, children }: Props) {
  if (currentUser()?.role !== role) return <Navigate to="/" replace />;
  return children;
}

/** Route table — one component per page, shared shell in Layout. */
export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route
          element={
            <RequireAuth>
              <Layout />
            </RequireAuth>
          }
        >
          <Route path="/" element={<Dashboard />} />
          <Route path="/customers" element={<Customers />} />
          <Route path="/cash" element={<Cash />} />
          <Route
            path="/users"
            element={
              <RequireRole role="Admin">
                <Users />
              </RequireRole>
            }
          />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}