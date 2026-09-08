"use client";

import { PrinterIcon } from "@phosphor-icons/react/dist/ssr";
import { Button } from "@/components/ui/primitives";

/** Mencetak halaman laporan apa adanya; sidebar & tombol disembunyikan CSS print. */
export function PrintButton() {
  return (
    <Button onClick={() => window.print()}>
      <PrinterIcon size={13} />
      Cetak
    </Button>
  );
}
