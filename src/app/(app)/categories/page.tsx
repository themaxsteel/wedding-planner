import { getDb } from "@/db";
import { getBudgetTree } from "@/db/queries";
import { PageHeader } from "@/components/ui/primitives";
import { CategoriesView } from "@/components/categories/categories-view";

export const dynamic = "force-dynamic";

export default async function CategoriesPage() {
  const db = await getDb();
  const [expense, income] = await Promise.all([
    getBudgetTree(db, "expense", { includeArchived: true }),
    getBudgetTree(db, "income", { includeArchived: true }),
  ]);

  return (
    <>
      <PageHeader
        title="Kategori"
        description="Struktur dua tingkat: kategori induk memegang budget, sub-kategori dipilih saat mencatat transaksi. Kategori yang sudah dipakai transaksi hanya bisa diarsipkan agar riwayat tetap utuh."
      />
      <CategoriesView expense={expense} income={income} />
    </>
  );
}
