import { useRef, useState } from "react";

/**
 * WorkbookPicker — the Import page's file chooser.
 *
 * The browser's native file control (`Choose File — No file chosen`) is a
 * foreign object on a page built from the app's rounded, 36px controls,
 * and it can't be cleared without reopening the OS dialog. This is the
 * same 36px recipe as `inputCls`, but as a real drop target:
 *
 *   · click or Enter opens the picker        · drag a workbook onto it
 *   · the chosen file's name replaces the hint · ✕ clears it
 *
 * It is a plain (not nested) button plus a sibling ✕, so both stay
 * keyboard-reachable and valid. The hidden <input> is not tabbable — the
 * button is the control screen readers announce.
 */
interface Props {
  /** The chosen workbook, or null when none is picked. */
  file: File | null;
  /** Block interaction while an import is in flight. */
  disabled?: boolean;
  /** Accessible name, e.g. "Choose the active book workbook". */
  label: string;
  /** A picked file (or null when the ✕ is pressed). */
  onPick: (file: File | null) => void;
}

export default function WorkbookPicker({ file, disabled, label, onPick }: Props) {
  const input = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false); // a file is hovering the zone

  function browse(): void {
    if (!disabled) input.current?.click();
  }

  function take(f: File | null): void {
    if (input.current) input.current.value = ""; // re-picking the same file fires again
    if (f) onPick(f);
  }

  return (
    <div
      onDragOver={(e) => {
        if (disabled) return;
        e.preventDefault();
        setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        if (disabled) return;
        e.preventDefault();
        setOver(false);
        const f = e.dataTransfer.files?.[0] ?? null;
        if (f) onPick(f);
      }}
      className={`flex h-9 items-center rounded-lg border transition-colors duration-300 ease-brand ${
        over
          ? "border-primary bg-primary/5 ring-2 ring-primary/20"
          : "border-line bg-tint"
      } ${disabled ? "opacity-60" : ""}`}
    >
      <input
        ref={input}
        type="file"
        accept=".xlsx"
        tabIndex={-1}
        aria-hidden="true"
        onChange={(e) => take(e.target.files?.[0] ?? null)}
        className="sr-only"
      />
      <button
        type="button"
        onClick={browse}
        disabled={disabled}
        aria-label={file ? `${label} — current file ${file.name}. Choose a different one.` : label}
        className="flex h-full min-w-0 flex-1 items-center gap-2.5 rounded-lg px-3 text-left
                   focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
      >
        <i
          className={`ph text-lg ${file ? "ph-file-xls text-emerald-600" : "ph-upload-simple text-primary"}`}
          aria-hidden="true"
        />
        <span className={`min-w-0 flex-1 truncate text-sm ${file ? "text-ink" : "text-muted"}`}>
          {file ? file.name : "Drop the .xlsx here, or browse"}
        </span>
        <span className="shrink-0 rounded-md bg-primary px-2 py-1 text-xs font-semibold text-on-primary">
          {file ? "Change" : "Browse"}
        </span>
      </button>
      {file && (
        <button
          type="button"
          onClick={() => onPick(null)}
          disabled={disabled}
          aria-label="Clear the chosen workbook"
          title="Clear the chosen workbook"
          className="mr-1 grid h-7 w-7 shrink-0 place-items-center rounded-md text-muted
                     hover:bg-tint-hover hover:text-ink
                     focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40
                     transition-colors duration-300 ease-brand disabled:pointer-events-none"
        >
          <i className="ph ph-x text-base" aria-hidden="true" />
        </button>
      )}
    </div>
  );
}
