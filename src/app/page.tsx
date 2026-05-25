import { ProductGrid } from "@/components/ProductGrid";
import { Package } from "lucide-react";

export const dynamic = "force-dynamic";

async function getProducts() {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";
  const res = await fetch(`${baseUrl}/api/products`, { cache: "no-store" });
  if (!res.ok) throw new Error("Failed to fetch products");
  return res.json();
}

export default async function HomePage() {
  const products = await getProducts();

  return (
    <div className="min-h-screen">
      {/* Header */}
      <header className="border-b border-stone-200 bg-white/80 backdrop-blur-sm sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-orange-600 rounded-lg flex items-center justify-center">
              <Package className="w-4 h-4 text-white" />
            </div>
            <span className="font-semibold text-lg tracking-tight">allo</span>
            <span className="text-stone-400 text-sm font-mono">inventory</span>
          </div>
          <div className="flex items-center gap-2 text-xs text-stone-500 font-mono">
            <span className="w-2 h-2 bg-green-500 rounded-full inline-block animate-pulse" />
            Live inventory
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="border-b border-stone-200 bg-white">
        <div className="max-w-7xl mx-auto px-6 py-12">
          <div className="max-w-2xl animate-fade-up">
            <p className="text-xs font-mono text-orange-600 uppercase tracking-widest mb-3">
              Multi-warehouse fulfillment
            </p>
            <h1 className="text-4xl font-semibold tracking-tight text-stone-900 mb-3">
              Reserve before you pay.
            </h1>
            <p className="text-stone-500 text-base leading-relaxed">
              Your item is held for 10 minutes while you checkout — no double-booking, no overselling.
              Stock counts update in real time across all warehouses.
            </p>
          </div>
        </div>
      </section>

      {/* Products */}
      <main className="max-w-7xl mx-auto px-6 py-10">
        <div className="flex items-center justify-between mb-8 animate-fade-up">
          <h2 className="text-sm font-mono text-stone-500 uppercase tracking-widest">
            {products.length} products across 3 warehouses
          </h2>
        </div>
        <ProductGrid products={products} />
      </main>

      {/* Footer */}
      <footer className="border-t border-stone-200 mt-20">
        <div className="max-w-7xl mx-auto px-6 py-6 flex items-center justify-between text-xs text-stone-400 font-mono">
          <span>allo inventory platform</span>
          <span>reservations · 10 min window · auto-expiry</span>
        </div>
      </footer>
    </div>
  );
}
