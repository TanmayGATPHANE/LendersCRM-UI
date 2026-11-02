import { useState } from "react";
import { money } from "../../utils/format";
import { VIZ, clamp, fmtCompact, niceTicks, topRoundedPath, useSize } from "./viz";
import { TipRow, VizTip } from "./VizShared";

/**
 * TrendColumns — monthly money-in vs money-out as a grouped column chart.
 * Two validated series hues (blue = collected, orange = lent out), bars
 * ≤ 20px with a 2px surface gap between neighbours, 4px-rounded data ends
 * square at the baseline, hairline solid gridlines. Hover/focus any month
 * band for a one-tooltip readout of both series plus the net — the mark's
 * hit target is the whole band, never the painted 20px.
 */
export interface TrendPoint {
  /** Full label ("Oct 2026") — always used in the tooltip and aria. */
  label: string;
  /** Compact tick ("Oct" / "Nov '25") for when the bands can't fit `label`. */
  tick?: string;
  lentOut: number;
  moneyIn: number;
  net: number;
}

const M = { t: 8, r: 8, b: 24, l: 46 }; // margins — l holds tick labels, b the month band

export default function TrendColumns({ data, height = 240 }: {
  data: TrendPoint[];
  height?: number;
}) {
  const [ref, { w }] = useSize<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);

  const iw = Math.max(w - M.l - M.r, 0);
  const ih = height - M.t - M.b;
  const scale = niceTicks(Math.max(...data.map((d) => Math.max(d.lentOut, d.moneyIn)), 1));
  const y = (v: number) => M.t + ih * (1 - v / scale.top);
  const y0 = y(0);
  const band = data.length > 0 ? iw / data.length : iw;
  // Two bars per band, 2px surface gap between them, capped at 20px thick.
  const barW = Math.min(Math.max((band - 8) / 2 - 1, 4), 20);
  // X-label mode: full "Oct 2026" if the bands fit it, otherwise the compact
  // "Oct" / "Nov '25" tick — then skip however many labels the band forces.
  const fullW = Math.max(...data.map((d) => d.label.length)) * 5.8;
  const tickW = Math.max(...data.map((d) => (d.tick ?? d.label).length)) * 5.8;
  const compact = band < fullW + 10;
  const every = compact
    ? Math.max(1, Math.ceil((tickW + 10) / band))
    : Math.max(1, Math.ceil((fullW + 10) / band));

  return (
    <div ref={ref} className="relative" style={{ height }}>
      {w > 60 && data.length > 0 && (
        <svg width={w} height={height} role="img" aria-label="Monthly cash flow: money lent out against money collected">
          {/* Gridlines + tick labels (recessive hairlines, compact ticks) */}
          {scale.ticks.map((t) => (
            <g key={t}>
              <line x1={M.l} x2={w - M.r} y1={y(t)} y2={y(t)} stroke="var(--color-line)" strokeWidth="1" />
              <text
                x={M.l - 6} y={y(t) + 3} textAnchor="end"
                className="fill-[var(--color-muted)] text-[10px] tabular-nums"
              >
                {fmtCompact(t)}
              </text>
            </g>
          ))}

          {data.map((d, i) => {
            const cx = M.l + band * i + band / 2;
            const hOut = d.lentOut > 0 ? ih * (d.lentOut / scale.top) : 0;
            const hIn = d.moneyIn > 0 ? ih * (d.moneyIn / scale.top) : 0;
            const lit = hover === i;
            return (
              <g key={d.label} style={lit ? { filter: "brightness(1.12)" } : undefined}>
                {d.lentOut > 0 && (
                  <path
                    d={topRoundedPath(cx - barW - 1, y0 - hOut, barW, hOut)}
                    fill={VIZ.series2}
                    className="viz-rise"
                    style={{ animationDelay: `${i * 50}ms` }}
                  />
                )}
                {d.moneyIn > 0 && (
                  <path
                    d={topRoundedPath(cx + 1, y0 - hIn, barW, hIn)}
                    fill={VIZ.series1}
                    className="viz-rise"
                    style={{ animationDelay: `${i * 50 + 40}ms` }}
                  />
                )}
                {i % every === 0 && (
                  <text
                    x={cx} y={height - 7} textAnchor="middle"
                    className="fill-[var(--color-muted)] text-[10px]"
                  >
                    {(compact ? d.tick : null) ?? d.label}
                  </text>
                )}
              </g>
            );
          })}

          {/* Hit bands: the whole month column is the target, never the bar */}
          {data.map((d, i) => (
            <rect
              key={d.label}
              x={M.l + band * i} y={M.t} width={band} height={ih}
              fill="transparent" tabIndex={0}
              aria-label={`${d.label}: lent out ${money(d.lentOut)}, money in ${money(d.moneyIn)}, net ${money(d.net)}`}
              onPointerEnter={() => setHover(i)}
              onPointerLeave={() => setHover(null)}
              onFocus={() => setHover(i)}
              onBlur={() => setHover(null)}
              className="cursor-default focus:outline-none"
            />
          ))}
        </svg>
      )}

      {hover != null && data[hover] && w > 60 && (() => {
        const d = data[hover];
        const cx = M.l + band * hover + band / 2;
        return (
          <VizTip left={clamp(cx - 85, 0, Math.max(w - 170, 0))} top={6}>
            <p className="text-xs font-medium text-slate">{d.label}</p>
            <div className="mt-1 space-y-0.5">
              <TipRow swatch={VIZ.series2} label="Lent out" value={money(d.lentOut)} />
              <TipRow swatch={VIZ.series1} label="Money in" value={money(d.moneyIn)} />
              <TipRow
                swatch={null} label="Net" value={money(d.net)}
                valueClass={d.net < 0 ? "text-red-600" : "text-green-700"}
              />
            </div>
          </VizTip>
        );
      })()}
    </div>
  );
}