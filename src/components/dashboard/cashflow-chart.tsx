"use client";

import * as React from "react";
import {
  Area,
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatCompact, formatIDR } from "@/lib/money";
import type { CashflowPoint } from "@/db/queries";

/**
 * Dua garis yang menceritakan hal berbeda:
 *   Saldo    - uang yang benar-benar ada di seluruh akun.
 *   Komitmen - total yang sudah dijanjikan ke vendor secara kumulatif.
 * Jarak keduanya adalah hutang yang menumpuk.
 */
export function CashflowChart({ data }: { data: CashflowPoint[] }) {
  const points = React.useMemo(
    () =>
      data.map((d) => ({
        ...d,
        label: monthLabel(d.month),
      })),
    [data],
  );

  if (points.length < 2) {
    return (
      <div className="flex h-[200px] items-center justify-center px-6 text-center">
        <p className="max-w-xs text-[12px] leading-relaxed text-muted">
          Grafik arus kas muncul setelah ada transaksi di dua bulan berbeda.
        </p>
      </div>
    );
  }

  return (
    <div className="h-[220px] w-full px-1 py-3">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart
          data={points}
          margin={{ top: 4, right: 8, bottom: 0, left: -8 }}
        >
          <defs>
            <linearGradient id="saldoFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--c-blue-fg)" stopOpacity={0.16} />
              <stop offset="100%" stopColor="var(--c-blue-fg)" stopOpacity={0.01} />
            </linearGradient>
          </defs>

          <CartesianGrid
            stroke="var(--c-border)"
            strokeDasharray="2 4"
            vertical={false}
          />
          <XAxis
            dataKey="label"
            tickLine={false}
            axisLine={{ stroke: "var(--c-border)" }}
            tick={{ fontSize: 10.5, fill: "var(--c-text-faint)" }}
            dy={4}
          />
          <YAxis
            tickLine={false}
            axisLine={false}
            width={54}
            tick={{ fontSize: 10.5, fill: "var(--c-text-faint)" }}
            tickFormatter={(v: number) => formatCompact(v)}
          />
          <Tooltip
            cursor={{ stroke: "var(--c-border-strong)", strokeWidth: 1 }}
            content={<ChartTooltip />}
          />

          {/*
            Animasi masuk Recharts sengaja dimatikan. Selain tidak sesuai
            dial motion rendah, animasinya digerakkan requestAnimationFrame:
            kalau tab sedang di latar saat halaman dimuat, rAF ditahan browser
            dan garisnya membeku di posisi awal - grafik tampak kosong padahal
            datanya ada.
          */}
          <Area
            type="monotone"
            dataKey="balance"
            name="Saldo"
            stroke="var(--c-blue-fg)"
            strokeWidth={1.6}
            fill="url(#saldoFill)"
            dot={false}
            activeDot={{ r: 3, strokeWidth: 0 }}
            isAnimationActive={false}
          />
          <Line
            type="monotone"
            dataKey="cumulativeCommitted"
            name="Komitmen kumulatif"
            stroke="var(--c-text-muted)"
            strokeWidth={1.4}
            strokeDasharray="3 3"
            dot={false}
            activeDot={{ r: 3, strokeWidth: 0 }}
            isAnimationActive={false}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}

type TooltipProps = {
  active?: boolean;
  payload?: { payload: CashflowPoint & { label: string } }[];
};

function ChartTooltip({ active, payload }: TooltipProps) {
  if (!active || !payload?.length) return null;
  const p = payload[0].payload;

  return (
    <div className="rounded-[6px] border border-line bg-surface px-2.5 py-2 shadow-[var(--shadow-float)]">
      <p className="mb-1 text-[11px] font-medium text-ink">{p.label}</p>
      <dl className="space-y-0.5 text-[11.5px]">
        <Line2 label="Saldo akhir" value={p.balance} />
        <Line2 label="Kas masuk" value={p.cashIn} tone="text-green-fg" />
        <Line2 label="Kas keluar" value={p.cashOut} tone="text-red-fg" />
        <Line2 label="Komitmen kumulatif" value={p.cumulativeCommitted} muted />
      </dl>
    </div>
  );
}

function Line2({
  label,
  value,
  tone,
  muted,
}: {
  label: string;
  value: number;
  tone?: string;
  muted?: boolean;
}) {
  return (
    <div className="flex gap-4">
      <dt className={muted ? "text-faint" : "text-muted"}>{label}</dt>
      <dd className={`tnum ml-auto font-medium ${tone ?? "text-ink"}`}>
        {formatIDR(value)}
      </dd>
    </div>
  );
}

const MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "Mei",
  "Jun",
  "Jul",
  "Agu",
  "Sep",
  "Okt",
  "Nov",
  "Des",
];

function monthLabel(month: string) {
  const [y, m] = month.split("-");
  return `${MONTHS[Number(m) - 1] ?? m} ${y.slice(2)}`;
}
