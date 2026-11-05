import { useState, useEffect, type ChangeEvent, type FormEvent } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { login, currentUser, setUser, API_MODE } from "../api/client.ts";
import { inputCls, labelCls } from "../components/ui.ts";

/**
 * Login screen — the only page outside the app shell. Split layout: a
 * deep-teal brand panel with drifting light discs and the product story
 * on the left (desktop), the credentials form on the right. Everything
 * enters staggered; reduced-motion users see the final layout at once.
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
    <main className="flex min-h-screen bg-surface">
      {/* Brand panel — the product story (desktop only) */}
      <aside className="relative hidden w-[46%] flex-col justify-between overflow-hidden
                        bg-[#084c5e] p-12 lg:flex xl:p-16">
        {/* Drifting light discs — ambient, transform-only motion */}
        <div aria-hidden="true"
             className="anim-drift absolute -top-24 -left-20 h-80 w-80 rounded-full bg-white/8" />
        <div aria-hidden="true"
             className="anim-drift-slow absolute top-1/3 -right-28 h-96 w-96 rounded-full bg-white/6" />
        <div aria-hidden="true"
             className="anim-drift absolute -bottom-28 left-1/4 h-72 w-72 rounded-full bg-white/5"
             style={{ animationDelay: "-5s" }} />

        {/* Mark + wordmark */}
        <div className="anim-fade-up relative flex items-center gap-3">
          <span className="grid h-11 w-11 place-items-center rounded-xl bg-white/12">
            <i className="ph ph-bank text-2xl text-white" aria-hidden="true" />
          </span>
          <div className="leading-tight">
            <span className="block text-lg font-semibold text-white">AMS</span>
            <span className="block text-xs uppercase tracking-wider text-white/60">
              Amanat Management
            </span>
          </div>
        </div>

        {/* Story */}
        <div className="stagger relative max-w-md">
          <h2 className="text-4xl font-semibold leading-tight text-balance text-white">
            Every rupee out, every rupee back — on one screen.
          </h2>
          <p className="mt-4 text-base text-pretty text-white/70">
            Record lends against gold, phones and papers, take partial returns
            at the counter, and release the collateral the day it's settled.
          </p>
          <ul className="mt-8 space-y-4">
            {[
              { icon: "ph-package", title: "Collateral groups", text: "Top-up lends stay under one item" },
              { icon: "ph-hand-coins", title: "Partial returns", text: "Money back early, interest to the day" },
              { icon: "ph-handshake", title: "One-click release", text: "Principal + interest settled in a moment" },
            ].map((f) => (
              <li key={f.title} className="flex items-start gap-3">
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-white/10">
                  <i className={`ph ${f.icon} text-lg text-white`} aria-hidden="true" />
                </span>
                <div>
                  <p className="text-sm font-semibold text-white">{f.title}</p>
                  <p className="text-sm text-white/60">{f.text}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>

        {/* Floating counter chit — a hint of the live numbers inside */}
        <div className="anim-fade-up relative flex items-center gap-4 self-start rounded-2xl
                        bg-white/10 px-5 py-4 backdrop-blur-sm" style={{ animationDelay: "0.5s" }}>
          <span className="grid h-10 w-10 place-items-center rounded-xl bg-white/15">
            <i className="ph ph-trend-up text-xl text-white" aria-hidden="true" />
          </span>
          <div className="leading-tight">
            <p className="text-xs font-medium uppercase tracking-wider text-white/60">
              Books, always current
            </p>
            <p className="mt-0.5 text-sm text-white/90">
              Totals refresh with every save — no month-end surprises
            </p>
          </div>
        </div>
      </aside>

      {/* Form column */}
      <section className="relative flex flex-1 items-center justify-center p-6">
        {/* Slim brand strip on small screens, where the panel is hidden */}
        <div className="anim-fade-up absolute top-6 left-6 flex items-center gap-2.5 lg:hidden">
          <span className="grid h-9 w-9 place-items-center rounded-lg bg-primary/10">
            <i className="ph ph-bank text-xl text-primary" aria-hidden="true" />
          </span>
          <span className="text-sm font-semibold text-ink">AMS</span>
        </div>

        <div className="rise-in w-full max-w-sm rounded-xl bg-card p-5 shadow-lg sm:p-8">
          {/* Heading — text gradient (the one place gradients are used),
              breaks at its own line, no weight above semibold. */}
          <div className="stagger mb-6 text-center">
            <span className="mx-auto grid h-11 w-11 place-items-center rounded-xl bg-primary/10">
              <i className="ph ph-bank text-2xl text-primary" aria-hidden="true" />
            </span>
            <h1 className="mt-3 bg-gradient-to-r from-ink to-[#666666] bg-clip-text text-2xl
                           font-semibold tracking-tight text-balance text-transparent">
              Sign in to your books
            </h1>
            <p className="text-sm text-muted">Amanat Management System</p>
          </div>

          {/* Credentials form */}
          <form onSubmit={submit} className="stagger space-y-3">
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
                  className={`${inputCls} w-full pr-10`}
                />
                <button
                  type="button"
                  onClick={() => setShowPw((s) => !s)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-0.5
                             text-dim hover:text-slate focus-visible:outline-none focus-visible:ring-2
                             focus-visible:ring-primary/40 transition-colors duration-300 ease-brand"
                  aria-label={showPw ? "Hide password" : "Show password"}
                >
                  <i className={`ph ${showPw ? "ph-eye-slash" : "ph-eye"} text-base`} aria-hidden="true" />
                </button>
              </span>
            </label>

            {/* Inline error: what failed, what to do next — calm, specific. */}
            {error && (
              <p role="alert" className="anim-fade-up flex items-start gap-2 rounded-lg bg-red-50 px-3 py-2
                                         text-sm text-red-700">
                <i className="ph ph-warning mt-0.5 shrink-0" aria-hidden="true" />
                {error}
              </p>
            )}

            {/* The one primary action — Button-md, full state set. */}
            <button
              type="submit"
              disabled={busy}
              className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-primary
                         px-3 py-2 text-base font-semibold text-on-primary shadow-sm
                         hover:bg-primary-hover hover:shadow-md active:bg-primary-press active:scale-[0.98]
                         disabled:cursor-not-allowed disabled:opacity-60
                         focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40
                         focus-visible:ring-offset-2 focus-visible:ring-offset-card
                         transition duration-300 ease-brand"
            >
              {busy && (
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white"
                      aria-hidden="true" />
              )}
              {busy ? "Signing in" : "Sign in"}
            </button>
          </form>

          {/* Which data source this build uses — makes "is it talking to
              the API or still mocking?" visible at one glance. Amber =
              mock (VITE_USE_MOCK=1 was compiled in); green = the real
              API, with the base URL it will call. */}
          <p className="stagger mt-3 flex items-center justify-center gap-1.5">
            <span
              className={`inline-flex max-w-full items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ${
                API_MODE.mock ? "bg-amber-100 text-amber-800" : "bg-emerald-100 text-emerald-700"
              }`}
              title={API_MODE.mock
                ? "This build shows sample data (VITE_USE_MOCK=1 was set at build time)"
                : `This build calls the real API at ${API_MODE.base}`}
            >
              <i
                className={`ph ${API_MODE.mock ? "ph-flask" : "ph-broadcast"} text-sm shrink-0`}
                aria-hidden="true"
              />
              {API_MODE.mock
                ? "Demo data (mock mode)"
                : <span className="block truncate">{API_MODE.base}</span>}
            </span>
          </p>

          <p className="mt-6 text-center text-xs text-pretty text-muted">
            Internal system. Accounts are created by administrators.
          </p>
        </div>
      </section>
    </main>
  );
}