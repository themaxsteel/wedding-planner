import { CheckIcon } from "@phosphor-icons/react/dist/ssr";
import { cn } from "@/lib/cn";

export const SETUP_STEPS = [
  { n: 1, label: "Detail Event", hint: "Nama & tanggal" },
  { n: 2, label: "Assets Account", hint: "Main & sub account" },
  { n: 3, label: "Kategori", hint: "Pengeluaran & pemasukan" },
  { n: 4, label: "Budget", hint: "Alokasi per pos" },
  { n: 5, label: "Supplier", hint: "Opsional" },
] as const;

export function Stepper({ current }: { current: number }) {
  return (
    <ol className="flex flex-wrap items-center gap-x-1 gap-y-2">
      {SETUP_STEPS.map((step, i) => {
        const done = step.n < current;
        const active = step.n === current;
        return (
          <li key={step.n} className="flex items-center gap-1">
            <div
              className={cn(
                "flex items-center gap-1.5 rounded-full border px-2 py-1 transition-colors duration-200",
                active
                  ? "border-line-strong bg-surface text-ink"
                  : done
                    ? "border-transparent bg-transparent text-muted"
                    : "border-transparent bg-transparent text-faint",
              )}
            >
              <span
                className={cn(
                  "tnum flex size-[17px] shrink-0 items-center justify-center rounded-full text-[10px] font-semibold",
                  active
                    ? "bg-solid text-inverse"
                    : done
                      ? "bg-green-bg text-green-fg"
                      : "bg-sunken text-faint",
                )}
              >
                {done ? <CheckIcon size={10} weight="bold" /> : step.n}
              </span>
              <span className="whitespace-nowrap text-[12px] font-medium">
                {step.label}
              </span>
            </div>
            {i < SETUP_STEPS.length - 1 ? (
              <span aria-hidden className="h-px w-3 bg-line-strong" />
            ) : null}
          </li>
        );
      })}
    </ol>
  );
}
