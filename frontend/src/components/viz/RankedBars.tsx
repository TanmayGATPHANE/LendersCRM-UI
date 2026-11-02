import { useState } from "react";
import { money } from "../../utils/format";
import { VIZ, niceTicks, rightRoundedPath, useSize } from "./viz";
import { TipRow, VizTip } from "./VizShared";

/**
 * RankedBars — money still outstanding per customer, largest first. One
 * series, one hue (slot 1) for every bar — never a darker-where-bigger
 * ramp on names. The value sits at the bar's tip in text ink, the 76px
 * right reserve keeps every tip label outside its bar and inside the
 * card. Bars grow from the left baseline; hover/focus a row for the
 * customer's context (the row's hit target is the full row, not the bar).
 */
export interface RankedRow {
  name: string;
  value: number;
  /** Extra tooltip context (e.g. lends count + total lent). */
  detail?: string;
}

const M = { t: 6, l: 4, r: 76 }; // l hugs the card padding; r reserves tip-label room
const ROW_H = 46;
const BAR_H = 14;

export default function RankedBars({ rows }: {
  rows: RankedRow[];
}) {
  const [ref, { w }] = useSize<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);
  const ih = Math.max(rows.length * ROW_H + M.t, 92);
  const plotW = Math.max(w - M.l - M.r, 0);
  const scale = niceTicks(Math.max(...rows.map((r) => r.value), 1));
  const x0 = M.l;

  return (
    <div ref={ref} className="relative" style={{ height: ih }}>
      {w > 120 && rows.length > 0 && (
        <svg width={w} height={ih} role="img" aria-label="Outstanding principal by customer, largest first">
          {/* The baseline the bars grow from */}
          <line x1={x0} x2={x0} y1={M.t} y2={ih - M.t} stroke="var(--color-line)" strokeWidth="1" />

          {rows.map((r, i) => {
            const rowTop = M.t + i * ROW_H;
            const bw = Math.max((r.value / scale.top) * plotW, 3);
            return (
              <g key={r.name} style={hover === i ? { filter: "brightness(1.12)" } : undefined}>
                <text x={x0} y={rowTop + 10} className="fill-[var(--color-slate)] text-xs">
                  {r.name}
                </text>
                <path
                  d={rightRoundedPath(x0, rowTop + 16, bw, BAR_H)}
                  fill={VIZ.series1}
                  className="viz-grow"
                  style={{ animationDelay: `${i * 55}ms` }}
                />
                <text
                  x={x0 + bw + 6} y={rowTop + 27}
                  className="fill-[var(--color-ink)] text-xs font-semibold tabular-nums"
                >
                  {money(r.value)}
                </text>
                {/* Hit band — the whole row, focusable like the marks it covers */}
                <rect
                  x={0} y={rowTop} width={w} height={ROW_H}
                  fill="transparent" tabIndex={0}
                  aria-label={`${r.name}: outstanding ${money(r.value)}${r.detail ? `, ${r.detail}` : ""}`}
                  onPointerEnter={() => setHover(i)}
                  onPointerLeave={() => setHover(null)}
                  onFocus={() => setHover(i)}
                  onBlur={() => setHover(null)}
                  className="cursor-default focus:outline-none"
                />
              </g>
            );
          })}
        </svg>
      )}

      {hover != null && rows[hover] && w > 120 && (() => {
        const r = rows[hover];
        return (
          <VizTip left={Math.min(M.l + 140, Math.max(w - 210, 0))} top={M.t + hover * ROW_H + 28}>
            <p className="text-xs font-medium text-slate">{r.name}</p>
            <div className="mt-1 space-y-0.5">
              <TipRow swatch={VIZ.series1} label="Outstanding" value={money(r.value)} />
              {r.detail && <p className="whitespace-nowrap text-xs text-muted">{r.detail}</p>}
            </div>
          </VizTip>
        );
      })()}
    </div>
  );
}