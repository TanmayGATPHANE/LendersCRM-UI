import { useState } from "react";
import { money } from "../../utils/format";
import { VIZ, clamp, fmtCompact, niceTicks, useSize } from "./viz";
import { TipRow, VizTip } from "./VizShared";

/**
 * Dumbbell — each released collateral's story as one row: a dot where the
 * money went OUT (light step of the blue ordinal ramp), a dot where it
 * came BACK (dark step), connected by a hairline track. The two shades
 * are one hue stepped light→dark (validated as an ordinal ramp), so the
 * direction reads without a second hue. Hover/focus a row for the full
 * outcome: principal recovered, interest collected, days held.
 */
export interface DumbbellRow {
  /** Row label — "gold chain · Priya". */
  name: string;
  lent: number;
  recovered: number;
  detail?: string;
}

const M = { t: 8, l: 4, r: 88, b: 18 }; // l hugs card padding; r reserves the largest dot
const ROW_H = 52;

export default function Dumbbell({ rows }: {
  rows: DumbbellRow[];
}) {
  const [ref, { w }] = useSize<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);
  const ih = Math.max(rows.length * ROW_H + M.b + M.t, 130);
  const plotH = ih - M.b; // rows live above the tick-label band
  const plotW = Math.max(w - M.l - M.r, 0);
  const maxVal = Math.max(...rows.flatMap((r) => [r.lent, r.recovered]), 1);
  const scale = niceTicks(maxVal);
  const x = (v: number) => M.l + (v / scale.top) * plotW;

  return (
    <div ref={ref} className="relative" style={{ height: ih }}>
      {w > 140 && rows.length > 0 && (
        <svg width={w} height={ih} role="img" aria-label="Per released collateral: money lent out against money recovered">
          {/* Value scale — recessive verticals under everything */}
          <line x1={M.l} x2={M.l} y1={M.t} y2={plotH} stroke="var(--color-line)" strokeWidth="1" />
          {scale.ticks.slice(1).map((t) => (
            <g key={t}>
              <line x1={x(t)} x2={x(t)} y1={M.t} y2={plotH} stroke="var(--color-line)" strokeWidth="1" opacity="0.5" />
              <text x={x(t)} y={ih - 4} textAnchor="middle" className="fill-[var(--color-muted)] text-[10px] tabular-nums">
                {fmtCompact(t)}
              </text>
            </g>
          ))}

          {rows.map((r, i) => {
            const rowTop = M.t + i * ROW_H;
            const dotY = rowTop + 38;
            const xa = x(r.lent);
            const xb = x(r.recovered);
            const left = Math.min(xa, xb);
            const trackW = Math.max(Math.abs(xa - xb), 0.5);
            return (
              <g key={i} style={hover === i ? { filter: "brightness(1.08)" } : undefined}>
                <text x={M.l} y={rowTop + 12} className="fill-[var(--color-slate)] text-xs">
                  {r.name}
                </text>
                <text x={M.l} y={rowTop + 27} className="fill-[var(--color-muted)] text-[10px]">
                  {r.detail}
                </text>
                {/* The span between what went out and what came back */}
                <line
                  x1={left} x2={left + trackW} y1={dotY} y2={dotY}
                  stroke="var(--color-line)" strokeWidth="2"
                  className="viz-grow"
                  style={{ animationDelay: `${i * 55}ms` }}
                />
                {/* Lent endpoint (light) under the recovered endpoint (dark) */}
                <circle
                  cx={xa} cy={dotY} r={5}
                  fill={VIZ.dumbStart} stroke="var(--color-card)" strokeWidth="2"
                  className="viz-pop" style={{ animationDelay: `${i * 55 + 120}ms` }}
                />
                <circle
                  cx={xb} cy={dotY} r={5.5}
                  fill={VIZ.dumbEnd} stroke="var(--color-card)" strokeWidth="2"
                  className="viz-pop" style={{ animationDelay: `${i * 55 + 220}ms` }}
                />
                {/* Hit band — the whole row */}
                <rect
                  x={0} y={rowTop} width={w} height={ROW_H}
                  fill="transparent" tabIndex={0}
                  aria-label={`${r.name}: lent ${money(r.lent)}, recovered ${money(r.recovered)}${r.detail ? `, ${r.detail}` : ""}`}
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

      {hover != null && rows[hover] && w > 140 && (() => {
        const r = rows[hover];
        const rowTop = M.t + hover * ROW_H;
        return (
          <VizTip left={clamp(x(Math.max(r.lent, r.recovered)) - 90, 0, Math.max(w - 190, 0))} top={Math.max(rowTop - 4, 0)}>
            <p className="text-xs font-medium text-slate">{r.name}</p>
            <div className="mt-1 space-y-0.5">
              <TipRow swatch={VIZ.dumbStart} label="Lent out" value={money(r.lent)} />
              <TipRow swatch={VIZ.dumbEnd} label="Recovered" value={money(r.recovered)} />
              {r.detail && <p className="whitespace-nowrap text-xs text-muted">{r.detail}</p>}
            </div>
          </VizTip>
        );
      })()}
    </div>
  );
}