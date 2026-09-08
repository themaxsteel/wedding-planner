import type { CategoryKind } from "@/db/schema";

/**
 * Data statis untuk wizard setup. Sengaja TIDAK di-seed langsung ke database:
 * user memilih sendiri mana yang dipakai, lalu bebas mengubah nama & isinya.
 */

export type AccountGroupType = "bank" | "cash" | "ewallet" | "other";

export type AccountGroupPreset = {
  name: string;
  type: AccountGroupType;
  /** nama sub account yang ditawarkan di dalam grup ini */
  accounts: string[];
  defaultSelected: boolean;
};

export const ACCOUNT_GROUP_PRESETS: AccountGroupPreset[] = [
  {
    name: "Bank",
    type: "bank",
    accounts: ["BCA", "Mandiri", "BNI", "BRI"],
    defaultSelected: true,
  },
  {
    name: "Tunai",
    type: "cash",
    accounts: ["Kas Tunai", "Kas Panitia"],
    defaultSelected: true,
  },
  {
    name: "E-Wallet",
    type: "ewallet",
    accounts: ["GoPay", "OVO", "DANA", "ShopeePay"],
    defaultSelected: false,
  },
];

export const ACCOUNT_GROUP_TYPE_LABEL: Record<AccountGroupType, string> = {
  bank: "Bank",
  cash: "Tunai",
  ewallet: "E-Wallet",
  other: "Lainnya",
};

export type CategoryPreset = {
  name: string;
  color: string;
  children: string[];
  defaultSelected: boolean;
};

/** Pos pengeluaran khas pernikahan Indonesia. */
export const EXPENSE_CATEGORY_PRESETS: CategoryPreset[] = [
  {
    name: "Venue & Akomodasi",
    color: "blue",
    children: [
      "Sewa Gedung",
      "Sewa Tenda & Kursi",
      "Akomodasi Tamu",
      "Genset & Listrik",
    ],
    defaultSelected: true,
  },
  {
    name: "Katering",
    color: "yellow",
    children: [
      "Prasmanan",
      "Gubugan / Stall",
      "Snack & Coffee Break",
      "Konsumsi Vendor",
      "Food Tasting",
    ],
    defaultSelected: true,
  },
  {
    name: "Dekorasi",
    color: "green",
    children: [
      "Pelaminan",
      "Bunga Segar",
      "Lighting",
      "Photo Booth",
      "Dekorasi Akad",
    ],
    defaultSelected: true,
  },
  {
    name: "Dokumentasi",
    color: "purple",
    children: ["Foto", "Video", "Drone", "Prewedding", "Cetak Album"],
    defaultSelected: true,
  },
  {
    name: "Busana & Rias",
    color: "red",
    children: [
      "Gaun Pengantin",
      "Jas Pengantin",
      "Seragam Keluarga",
      "MUA",
      "Hijab & Aksesoris",
    ],
    defaultSelected: true,
  },
  {
    name: "Hiburan",
    color: "blue",
    children: ["Band / Organ Tunggal", "MC", "Sound System", "Tari Tradisional"],
    defaultSelected: true,
  },
  {
    name: "Undangan & Souvenir",
    color: "yellow",
    children: ["Undangan Cetak", "Undangan Digital", "Souvenir", "Seating Chart"],
    defaultSelected: true,
  },
  {
    name: "Adat & Keagamaan",
    color: "green",
    children: ["Seserahan", "Mahar", "Penghulu / KUA", "Siraman", "Pengajian"],
    defaultSelected: true,
  },
  {
    name: "Wedding Organizer",
    color: "purple",
    children: ["Fee WO", "Crew & Usher", "Koordinator Hari-H"],
    defaultSelected: true,
  },
  {
    name: "Transportasi",
    color: "neutral",
    children: ["Mobil Pengantin", "Transport Vendor", "Parkir & Retribusi"],
    defaultSelected: false,
  },
  {
    name: "Lain-lain",
    color: "neutral",
    children: ["Administrasi", "Tip & Amplop", "Dana Cadangan"],
    defaultSelected: true,
  },
];

/** Sumber dana pernikahan. */
export const INCOME_CATEGORY_PRESETS: CategoryPreset[] = [
  {
    name: "Kontribusi Keluarga",
    color: "green",
    children: ["Keluarga Pria", "Keluarga Wanita"],
    defaultSelected: true,
  },
  {
    name: "Tabungan Pribadi",
    color: "blue",
    children: ["Tabungan Pengantin Pria", "Tabungan Pengantin Wanita"],
    defaultSelected: true,
  },
  {
    name: "Angpao & Hadiah",
    color: "yellow",
    children: ["Angpao Amplop", "Angpao Transfer", "Hadiah Barang"],
    defaultSelected: true,
  },
  {
    name: "Sponsor & Barter",
    color: "purple",
    children: ["Sponsor Vendor", "Barter Media"],
    defaultSelected: false,
  },
  {
    name: "Lain-lain",
    color: "neutral",
    children: ["Refund Vendor", "Penjualan Aset"],
    defaultSelected: false,
  },
];

export function categoryPresets(kind: CategoryKind): CategoryPreset[] {
  return kind === "expense"
    ? EXPENSE_CATEGORY_PRESETS
    : INCOME_CATEGORY_PRESETS;
}

export const PAYMENT_METHODS = [
  { value: "transfer", label: "Transfer Bank" },
  { value: "tunai", label: "Tunai" },
  { value: "kartu", label: "Kartu Debit/Kredit" },
  { value: "ewallet", label: "E-Wallet" },
  { value: "lainnya", label: "Lainnya" },
] as const;

/** Token warna pastel yang dipakai badge & indikator kategori. */
export const CATEGORY_COLORS = [
  "neutral",
  "red",
  "blue",
  "green",
  "yellow",
  "purple",
] as const;

export type CategoryColor = (typeof CATEGORY_COLORS)[number];
