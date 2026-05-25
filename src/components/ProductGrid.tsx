"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ProductCard } from "./ProductCard";
import { ReserveModal } from "./ReserveModal";

interface StockEntry {
  warehouseId: string;
  warehouseName: string;
  warehouseCity: string;
  total: number;
  reserved: number;
  available: number;
}

interface Product {
  id: string;
  name: string;
  description: string | null;
  imageUrl: string | null;
  price: number;
  stock: StockEntry[];
}

export function ProductGrid({ products }: { products: Product[] }) {
  const router = useRouter();
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [isReserving, setIsReserving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleReserve = async (
    productId: string,
    warehouseId: string,
    quantity: number
  ) => {
    setIsReserving(true);
    setError(null);

    try {
      const res = await fetch("/api/reservations", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          // Idempotency key: re-running same request won't double-reserve
          "Idempotency-Key": `${productId}-${warehouseId}-${Date.now()}`,
        },
        body: JSON.stringify({ productId, warehouseId, quantity }),
      });

      const data = await res.json();

      if (res.status === 409) {
        setError(
          data.error || "Not enough stock available. Try a different warehouse."
        );
        return;
      }

      if (res.status === 429) {
        setError("Another reservation is processing. Please wait a moment and try again.");
        return;
      }

      if (!res.ok) {
        setError(data.error || "Failed to create reservation. Please try again.");
        return;
      }

      // Success — navigate to checkout page
      setSelectedProduct(null);
      router.push(`/checkout/${data.id}`);
    } catch {
      setError("Network error. Please check your connection and try again.");
    } finally {
      setIsReserving(false);
    }
  };

  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {products.map((product, i) => (
          <div
            key={product.id}
            className={`animate-fade-up-delay-${Math.min(i + 1, 3)}`}
          >
            <ProductCard
              product={product}
              onReserve={() => {
                setError(null);
                setSelectedProduct(product);
              }}
            />
          </div>
        ))}
      </div>

      {selectedProduct && (
        <ReserveModal
          product={selectedProduct}
          isReserving={isReserving}
          error={error}
          onReserve={handleReserve}
          onClose={() => {
            setSelectedProduct(null);
            setError(null);
          }}
        />
      )}
    </>
  );
}
