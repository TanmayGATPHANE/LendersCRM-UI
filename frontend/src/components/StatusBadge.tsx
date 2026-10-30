import type { EntryStatus } from "../api/types.ts";

/**
 * StatusBadge — status chip for an entry. Fixed palette from the design
 * system: Active = green tint, Released = gray tint.
 */
interface Props {
  status: EntryStatus;
}

export default function StatusBadge({ status }: Props) {
  const style =
    status === "Active"
      ? "bg-badge-ok-bg text-badge-ok"
      : "bg-badge-off-bg text-badge-off";
  return (
    <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${style}`}>
      {status}
    </span>
  );
}