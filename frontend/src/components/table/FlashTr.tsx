import { useEffect, useRef, type ReactNode } from "react";
import type { SavedWhere } from "../../api/types.ts";
import { pulse } from "../../utils/pulse.ts";

/**
 * A save flash: which collateral the last save landed on (`groupId`),
 * plus `seq` — a counter the page bumps on every save so the green pulse
 * can fire again even when the same group is saved twice in a row.
 */
export interface FlashHint extends SavedWhere {
  seq: number;
}

/**
 * FlashTr — a <tr> that pulses green when the last save named its group
 * (the Dashboard's "this row just changed" highlight). The pulse fires
 * on the save itself, or — for a row that only comes to exist when the
 * refreshed data lands — right then, when the row first renders.
 */
export default function FlashTr({ flash, groupId, className, onClick, children }: {
  flash?: FlashHint | null;
  /** This row's collateral groupId. */
  groupId: number;
  className?: string;
  onClick?: () => void;
  children: ReactNode;
}) {
  const ref = useRef<HTMLTableRowElement>(null);
  const pulsed = useRef<number | null>(null); // the last save this row pulsed for

  const matched = Boolean(flash && flash.groupId === groupId);
  useEffect(() => {
    if (!matched || !flash || pulsed.current === flash.seq) return;
    pulsed.current = flash.seq;
    pulse(ref.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- the flash object identity is irrelevant; its seq + the match drive the pulse
  }, [flash?.seq, matched]);

  return (
    <tr ref={ref} onClick={onClick} className={className}>
      {children}
    </tr>
  );
}