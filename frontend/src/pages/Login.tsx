import { useState, useEffect, type ChangeEvent, type FormEvent } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { login, currentUser, setUser } from "../api/client.ts";
import { inputCls, labelCls, primaryBtnCls } from "../components/ui.ts";

/**
 * Login screen — the only page outside the app shell. On success the user
 * is stored locally (JWT stands in for it later) and the app redirects.
 */
export default function Login() {
  const navigate = useNavigate();
  const [form, setForm] = useState({ email: "", password: "" });
  const [error, setError] = useState<string>("");
  const [busy, setBusy] = useState(false);
  const [showPw, setShowPw] = useState(false);

  // The browser tab names the page being shown.
  useEffect(() => { document.title = "AMS — Sign in"; }, []);

  // Already signed in? No need to show the form.
  if (currentUser()) return <Navigate to="/" replace />;

  /** Update one field of the controlled form. */
  const set =
    (key: "email" | "password") =>
    (e: ChangeEvent<HTMLInputElement>) =>
      setForm({ ...form, [key]: e.target.value });

  /** Submit credentials to the API and store the returned user. */
  async function submit(e: FormEvent): Promise<void> {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      setUser(await login(form.email, form.password));
      navigate("/", { replace: true });
    } catch (err) {
      setError((err as Error).message); // the API's `{ message }` text
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-surface p-6">
      <div className="w-full max-w-sm rounded-xl bg-card p-8 shadow-lg">
        {/* Heading */}
        <div className="mb-6 text-center">
          <span className="material-symbols-outlined text-3xl text-primary">
            account_balance
          </span>
          <h1 className="mt-2 text-xl font-semibold tracking-tight">AMS</h1>
          <p className="text-sm text-muted">Amanat Management System</p>
        </div>

        {/* Credentials form */}
        <form onSubmit={submit} className="space-y-3">
          <label className={labelCls}>
            Email
            <input
              type="email"
              required
              value={form.email}
              onChange={set("email")}
              placeholder="admin@lenders.in"
              className={`${inputCls} mt-1`}
            />
          </label>
          <label className={labelCls}>
            Password
            <span className="relative mt-1 block">
              <input
                type={showPw ? "text" : "password"}
                required
                value={form.password}
                onChange={set("password")}
                placeholder="••••••••"
                className={`${inputCls} w-full`}
              />
              <button
                type="button"
                onClick={() => setShowPw((s) => !s)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-dim hover:text-slate"
                aria-label={showPw ? "Hide password" : "Show password"}
                tabIndex={-1}
              >
                <span className="material-symbols-outlined text-[18px]">
                  {showPw ? "visibility_off" : "visibility"}
                </span>
              </button>
            </span>
          </label>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <button type="submit" disabled={busy} className={`${primaryBtnCls} w-full justify-center`}>
            {busy ? "Signing in…" : "Sign in"}
          </button>
        </form>

        <p className="mt-6 text-center text-xs text-muted" >
          Internal system. Accounts are created by administrators.
        </p>
      </div>
    </div>
  );
}