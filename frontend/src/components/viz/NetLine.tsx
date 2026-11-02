import { useState } from "react";
import { money } from "../../utils/format";
import { VIZ, clamp, fmtCompact, niceStep, useSize } from "./viz";
import { TipRow, VizTip } from "./VizShared";

/**
 * NetLine — the month-by-month net cash (in minus out) as a single series
 * line. One series, so no legend — the card's title names it. 2px stroke,
 * ≥8px markers with a 2px surface ring so they stay legible over the line,
 * a hairline zero baseline, and the endpoint direct-labeled. A crosshair
 * tracks the pointer band; the tooltip carries the exact figure the
 * crosshair snapped to.
 */
export interface NetPoint {
  /** Full label ("Oct 2026") — always used in the tooltip and aria. */
  label: string;
  /** Compact tick ("Oct" / "Nov '25") for when the bands can't fit `label`. */
  tick?: string;
  net: number;
}

const M = { t: 12, r: 10, b: 26, l: 46 };

export default function NetLine({ data, height = 240 }: {
  data: NetPoint[];
  height?: number;
}) {
  const [ref, { w }] = useSize<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);

  const iw = Math.max(w - M.l - M.r, 0);
  const ih = height - M.t - M.b;
  const maxNet = Math.max(...data.map((d) => d.net), 0);
  const minNet = Math.min(...data.map((d) => d.net), 0);
  const step = niceStep(Math.max(maxNet, -minNet, 1));
  const lo = Math.floor(minNet / step) * step;
  const hi = Math.ceil(maxNet / step) * step;
  const y = (v: number) => M.t + ih * (1 - (v - lo) / (hi - lo || 1));
  const x = (i: number) =>
    data.length === 1 ? M.l + iw / 2 : M.l + (iw * i) / (data.length - 1);
  const y0 = y(0);
  const last = data.length - 1;
  // X-label mode: full "Oct 2026" if the bands fit it, otherwise the compact
  // "Oct" / "Nov '25" tick — then skip however many labels the band forces.
  const band = data.length > 0 ? iw / data.length : iw;
  const fullW = Math.max(...data.map((d) => d.label.length)) * 5.8;
  const tickW = Math.max(...data.map((d) => (d.tick ?? d.label).length)) * 5.8;
  const compact = band < fullW + 10;
  const every = compact
    ? Math.max(1, Math.ceil((tickW + 10) / band))
    : Math.max(1, Math.ceil((fullW + 10) / band));

  const ticks: number[] = [];
  for (let v = lo; v <= hi + step / 2; v += step) ticks.push(Math.round(v * 1e6) / 1e6);
  const path = data.map((d, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(d.net).toFixed(1)}`).join(" ");

  return (
    <div ref={ref} className="relative" style={{ height }}>
      {w > 60 && data.length > 0 && (
        <svg width={w} height={height} role="img" aria-label="Net cash by month">
          {/* Gridlines + ticks */}
          {ticks.map((t) => (
            <g key={t}>
              <line
                x1={M.l} x2={w - M.r} y1={y(t)} y2={y(t)}
                stroke="var(--color-line)"
                strokeWidth={t === 0 ? 1 : 1}
                opacity={t === 0 ? 1 : 0.7}
              />
              <text
                x={M.l - 6} y={y(t) + 3} textAnchor="end"
                className="fill-[var(--color-muted)] text-[10px] tabular-nums"
              >
                {fmtCompact(t)}
              </text>
            </g>
          ))}

          {/* The line draws itself, then the markers pop in after it */}
          <path
            d={path} fill="none" stroke={VIZ.series1} strokeWidth="2"
            strokeLinejoin="round" strokeLinecap="round"
            pathLength={1} strokeDasharray={1} className="viz-draw"
          />
          {data.map((d, i) => (
            <circle
              key={d.label}
              cx={x(i)} cy={y(d.net)} r={i === last ? 4.5 : 4}
              fill={VIZ.series1} stroke="var(--color-card)" strokeWidth="2"
              className="viz-pop"
              style={{ animationDelay: `${650 + i * 40}ms` }}
            />
          ))}

          {/* Endpoint direct label — the one selectively labelled point */}
          {data.length > 0 && (() => {
            const d = data[last];
            const atRightEdge = x(last) > w - 78;
            return (
              <text
                x={atRightEdge ? x(last) - 10 : x(last) + 8}
                y={y(d.net) - 10}
                textAnchor={atRightEdge ? "end" : "start"}
                className="fill-[var(--color-ink)] text-xs font-semibold tabular-nums"
              >
                {money(d.net)}
              </text>
            );
          })()}

          {/* Month labels — the last one anchors inside the right edge */}
          {data.map((d, i) =>
            i % every === 0 ? (
              <text
                key={d.label}
                x={i === last ? w - 2 : x(i)}
                y={height - 8}
                textAnchor={i === last ? "end" : "middle"}
                className="fill-[var(--color-muted)] text-[10px]"
              >
                {(compact ? d.tick : null) ?? d.label}
              </text>
            ) : null
          )}

          {/* Crosshair finds the X for the hovered band */}
          {hover != null && (
            <line
              x1={x(hover)} x2={x(hover)} y1={M.t} y2={M.t + ih}
              stroke="var(--color-slate)" strokeWidth="1" opacity="0.35"
            />
          )}

          {/* Hit bands — one per month, crosshair snaps inside */}
          {data.map((d, i) => (
            <rect
              key={d.label}
              x={M.l + band * i - (data.length === 1 ? 0 : 0)} y={M.t} width={band} height={ih}
              fill="transparent" tabIndex={0}
              aria-label={`${d.label}: net ${money(d.net)}`}
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
        return (
          <VizTip left={clamp(x(hover) - 70, 0, Math.max(w - 140, 0))} top={6}>
            <p className="text-xs font-medium text-slate">{d.label}</p>
            <div className="mt-1">
              <TipRow
                swatch={VIZ.series1} label="Net" value={money(d.net)}
                valueClass={d.net < 0 ? "text-red-600" : "text-green-700"}
              />
            </div>
          </VizTip>
        );
      })()}
    </div>
  );
}