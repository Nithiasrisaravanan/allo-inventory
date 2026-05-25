import { CheckoutClient } from "@/components/CheckoutClient";
import { Package } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

async function getReservation(id: string) {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";
  const res = await fetch(`${baseUrl}/api/reservations/${id}`, { cache: "no-store" });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error("Failed to fetch reservation");
  return res.json();
}

export default async function CheckoutPage({
  params,
}: {
  params: { id: string };
}) {
  const reservation = await getReservation(params.id);

  if (!reservation) {
    notFound();
  }

  return (
    <div className="min-h-screen">
      {/* Header */}
      <header className="border-b border-stone-200 bg-white/80 backdrop-blur-sm sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center gap-3">
          <Link href="/" className="flex items-center gap-3 group">
            <div className="w-8 h-8 bg-orange-600 rounded-lg flex items-center justify-center">
              <Package className="w-4 h-4 text-white" />
            </div>
            <span className="font-semibold text-lg tracking-tight group-hover:text-orange-600 transition-colors">allo</span>
          </Link>
          <span className="text-stone-300">/</span>
          <span className="text-stone-500 text-sm font-mono">checkout</span>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-6 py-12">
        <CheckoutClient initialReservation={reservation} />
      </main>
    </div>
  );
}
