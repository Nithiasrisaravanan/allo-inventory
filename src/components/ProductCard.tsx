"use client";

import Image from "next/image";
import { MapPin, Package } from "lucide-react";

interface StockEntry {
  warehouseId: string;
  warehouseName: string;
  warehouseCity: string;
  available: number;
  total: number;
}

interface Product {
  id: string;
  name: string;
  description: string | null;
  imageUrl: string | null;
  price: number;
  stock: StockEntry[];
}

function formatPrice(paise: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(paise / 100);
}

function StockBadge({ available }: { available: number }) {
  if (available === 0) {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-mono px-2 py-0.5 rounded-full bg-red-50 text-red-600">
        Out of stock
      </span>
    );
  }
  if (available <= 2) {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-mono px-2 py-0.5 rounded-full bg-amber-50 text-amber-700">
        Only {available} left
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 text-xs font-mono px-2 py-0.5 rounded-full bg-green-50 text-green-700">
      {available} in stock
    </span>
  );
}

export function ProductCard({
  product,
  onReserve,
}: {
  product: Product;
  onReserve: () => void;
}) {
  const totalAvailable = product.stock.reduce((sum, s) => sum + s.available, 0);
  const hasStock = totalAvailable > 0;

  return (
    <div className="group bg-white border border-stone-200 rounded-xl overflow-hidden hover:shadow-lg hover:border-stone-300 transition-all duration-200">
      {/* Image */}
      <div className="relative h-52 bg-stone-100 overflow-hidden">
        {product.imageUrl ? (
          <img
            src={product.imageUrl}
            alt={product.name}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <Package className="w-12 h-12 text-stone-300" />
          </div>
        )}
        {!hasStock && (
          <div className="absolute inset-0 bg-white/60 backdrop-blur-sm flex items-center justify-center">
            <span className="font-mono text-sm font-medium text-stone-500">Sold Out</span>
          </div>
        )}
      </div>

      {/* Content */}
      <div className="p-5">
        <h3 className="font-medium text-stone-900 mb-1 leading-tight line-clamp-2">
          {product.name}
        </h3>
        {product.description && (
          <p className="text-stone-500 text-sm mb-4 line-clamp-2 leading-relaxed">
            {product.description}
          </p>
        )}

        {/* Price */}
        <div className="text-xl font-semibold text-stone-900 mb-4">
          {formatPrice(product.price)}
        </div>

        {/* Stock by warehouse */}
        <div className="space-y-1.5 mb-4">
          {product.stock.map((s) => (
            <div
              key={s.warehouseId}
              className="flex items-center justify-between text-xs"
            >
              <span className="flex items-center gap-1 text-stone-500">
                <MapPin className="w-3 h-3" />
                {s.warehouseCity}
              </span>
              <StockBadge available={s.available} />
            </div>
          ))}
        </div>

        {/* Reserve button */}
        <button
          onClick={onReserve}
          disabled={!hasStock}
          className={`w-full py-2.5 px-4 rounded-lg text-sm font-medium transition-all duration-150 ${
            hasStock
              ? "bg-orange-600 text-white hover:bg-orange-700 active:scale-[0.98]"
              : "bg-stone-100 text-stone-400 cursor-not-allowed"
          }`}
        >
          {hasStock ? "Reserve — 10 min hold" : "Out of Stock"}
        </button>
      </div>
    </div>
  );
}
