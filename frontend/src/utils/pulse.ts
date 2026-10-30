/**
 * pulse — a one-shot green background pulse on a table row / tile: the
 * "this is what just changed" marker the Dashboard shows after every
 * successful save. Rides the Web Animations API so back-to-back saves
 * restart the animation without the element being re-keyed or remounted;
 * a no-op in browsers without the API (nothing flashes, nothing breaks).
 */
export function pulse(el: HTMLElement | null): void {
  if (!el?.animate) return;
  el.animate(
    [
      { backgroundColor: "rgba(16, 185, 129, 0.22)" },
      { backgroundColor: "rgba(16, 185, 129, 0.1)", offset: 0.7 },
      { backgroundColor: "rgba(16, 185, 129, 0)" },
    ],
    { duration: 1800, easing: "ease-out" }
  );
}