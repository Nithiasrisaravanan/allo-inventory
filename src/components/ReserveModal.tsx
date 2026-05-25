"use client";

import { useState, useEffect } from "react";
import { X, MapPin, AlertCircle, Clock, Loader2 } from "lucide-react";

interface StockEntry {
  warehouseId: string;
  warehouseName: string;
  warehouseCity: string;
  available: number;
}

interface Product {
  id: string;
  name: string;
  price: number;
  stock: StockEntry[];
}

interface ReserveModalProps {
  product: Product;
  isReserving: boolean;
  error: string | null;
  onReserve: (productId: string, warehouseId: string, quantity: number) => void;
  onClose: () => void;
}

function formatPrice(paise: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(paise / 100);
}

export function ReserveModal({
  product,
  isReserving,
  error,
  onReserve,
  onClose,
}: ReserveModalProps) {
  const availableStock = product.stock.filter((s) => s.available > 0);
  const [selectedWarehouseId, setSelectedWarehouseId] = useState(
    availableStock[0]?.warehouseId ?? ""
  );
  const [quantity, setQuantity] = useState(1);

  const selectedWarehouse = product.stock.find(
    (s) => s.warehouseId === selectedWarehouseId
  );
  const maxQty = selectedWarehouse?.available ?? 0;

  // Reset quantity if warehouse changes and qty is out of range
  useEffect(() => {
    if (quantity > maxQty) setQuantity(Math.max(1, maxQty));
  }, [selectedWarehouseId, maxQty, quantity]);

  // Close on Escape key
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />

      {/* Modal */}
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md animate-fade-up">
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center rounded-full hover:bg-stone-100 transition-colors"
        >
          <X className="w-4 h-4 text-stone-500" />
        </button>

        <div className="p-6">
          <h2 className="font-semibold text-lg text-stone-900 mb-1 pr-8">
            Reserve this item
          </h2>
          <p className="text-stone-500 text-sm mb-6">
            {product.name} — {formatPrice(product.price)}
          </p>

          {/* Warehouse selection */}
          <div className="mb-4">
            <label className="text-xs font-mono text-stone-500 uppercase tracking-wider block mb-2">
              Ship from warehouse
            </label>
            <div className="space-y-2">
              {product.stock.map((s) => (
                <button
                  key={s.warehouseId}
                  disabled={s.available === 0}
                  onClick={() => setSelectedWarehouseId(s.warehouseId)}
                  className={`w-full flex items-center justify-between p-3 rounded-lg border text-sm transition-all ${
                    selectedWarehouseId === s.warehouseId && s.available > 0
                      ? "border-orange-500 bg-orange-50 text-stone-900"
                      : s.available === 0
                      ? "border-stone-200 bg-stone-50 text-stone-400 cursor-not-allowed"
                      : "border-stone-200 hover:border-stone-300 text-stone-700"
                  }`}
                >
                  <span className="flex items-center gap-2">
                    <MapPin className="w-3.5 h-3.5" />
                    <span>{s.warehouseName}</span>
                    <span className="text-stone-400">·</span>
                    <span className="text-stone-500 text-xs">{s.warehouseCity}</span>
                  </span>
                  <span
                    className={`text-xs font-mono ${
                      s.available === 0
                        ? "text-red-400"
                        : s.available <= 2
                        ? "text-amber-600"
                        : "text-green-600"
                    }`}
                  >
                    {s.available === 0 ? "Out of stock" : `${s.available} avail.`}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Quantity */}
          <div className="mb-6">
            <label className="text-xs font-mono text-stone-500 uppercase tracking-wider block mb-2">
              Quantity
            </label>
            <div className="flex items-center gap-3">
              <button
                onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                disabled={quantity <= 1}
                className="w-9 h-9 rounded-lg border border-stone-200 flex items-center justify-center text-stone-600 hover:border-stone-300 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                −
              </button>
              <span className="font-mono text-lg font-medium w-8 text-center">
                {quantity}
              </span>
              <button
                onClick={() => setQuantity((q) => Math.min(maxQty, q + 1))}
                disabled={quantity >= maxQty}
                className="w-9 h-9 rounded-lg border border-stone-200 flex items-center justify-center text-stone-600 hover:border-stone-300 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                +
              </button>
              <span className="text-sm text-stone-400 font-mono">
                of {maxQty} available
              </span>
            </div>
          </div>

          {/* Error */}
          {error && (
            <div className="mb-4 flex items-start gap-2.5 p-3 bg-red-50 border border-red-100 rounded-lg text-sm text-red-700">
              <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Reserve button */}
          <button
            onClick={() => onReserve(product.id, selectedWarehouseId, quantity)}
            disabled={isReserving || !selectedWarehouseId || maxQty === 0}
            className="w-full py-3 px-4 bg-orange-600 text-white rounded-xl font-medium text-sm hover:bg-orange-700 active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
          >
            {isReserving ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Reserving...
              </>
            ) : (
              <>
                <Clock className="w-4 h-4" />
                Reserve for 10 minutes
              </>
            )}
          </button>

          <p className="text-center text-xs text-stone-400 mt-3">
            Your item is held while you complete payment. No charge until confirmed.
          </p>
        </div>
      </div>
    </div>
  );
}
