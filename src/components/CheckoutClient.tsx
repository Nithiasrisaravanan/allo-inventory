"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  Clock,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  MapPin,
  Package,
  ShoppingBag,
  ArrowLeft,
  Loader2,
} from "lucide-react";

interface Reservation {
  id: string;
  quantity: number;
  status: "PENDING" | "CONFIRMED" | "RELEASED";
  expiresAt: string;
  confirmedAt: string | null;
  releasedAt: string | null;
  product: {
    id: string;
    name: string;
    price: number;
    imageUrl: string | null;
  };
  warehouse: {
    id: string;
    name: string;
    city: string;
  };
}

function formatPrice(paise: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(paise / 100);
}

function useCountdown(expiresAt: string, status: string) {
  const [secondsLeft, setSecondsLeft] = useState(() => {
    if (status !== "PENDING") return 0;
    return Math.max(0, Math.floor((new Date(expiresAt).getTime() - Date.now()) / 1000));
  });

  useEffect(() => {
    if (status !== "PENDING") return;
    const interval = setInterval(() => {
      const remaining = Math.max(
        0,
        Math.floor((new Date(expiresAt).getTime() - Date.now()) / 1000)
      );
      setSecondsLeft(remaining);
    }, 1000);
    return () => clearInterval(interval);
  }, [expiresAt, status]);

  const mins = Math.floor(secondsLeft / 60);
  const secs = secondsLeft % 60;
  const isUrgent = secondsLeft < 60 && secondsLeft > 0;
  const isExpired = secondsLeft === 0 && status === "PENDING";

  return { secondsLeft, mins, secs, isUrgent, isExpired };
}

export function CheckoutClient({
  initialReservation,
}: {
  initialReservation: Reservation;
}) {
  const router = useRouter();
  const [reservation, setReservation] = useState(initialReservation);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { mins, secs, isUrgent, isExpired } = useCountdown(
    reservation.expiresAt,
    reservation.status
  );

  // Poll for status when expired to get server-confirmed state
  useEffect(() => {
    if (!isExpired) return;
    const timeout = setTimeout(async () => {
      const res = await fetch(`/api/reservations/${reservation.id}`);
      if (res.ok) {
        const data = await res.json();
        setReservation(data);
      }
    }, 1500);
    return () => clearTimeout(timeout);
  }, [isExpired, reservation.id]);

  const handleConfirm = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/reservations/${reservation.id}/confirm`, {
        method: "POST",
        headers: {
          "Idempotency-Key": `confirm-${reservation.id}`,
        },
      });
      const data = await res.json();

      if (res.status === 410) {
        setError("Your reservation expired before payment could be confirmed. Please start again.");
        const refreshed = await fetch(`/api/reservations/${reservation.id}`);
        if (refreshed.ok) setReservation(await refreshed.json());
        return;
      }

      if (!res.ok) {
        setError(data.error || "Failed to confirm. Please try again.");
        return;
      }

      setReservation(data);
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setIsLoading(false);
    }
  }, [reservation.id]);

  const handleCancel = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/reservations/${reservation.id}/release`, {
        method: "POST",
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Failed to cancel. Please try again.");
        return;
      }

      setReservation((prev) => ({ ...prev, status: "RELEASED", releasedAt: new Date().toISOString() }));
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setIsLoading(false);
    }
  }, [reservation.id]);

  const total = reservation.product.price * reservation.quantity;

  return (
    <div className="animate-fade-up">
      {/* Back */}
      <button
        onClick={() => router.push("/")}
        className="flex items-center gap-1.5 text-stone-500 hover:text-stone-800 text-sm mb-8 transition-colors group"
      >
        <ArrowLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" />
        Back to products
      </button>

      {/* Status banner */}
      {reservation.status === "CONFIRMED" && (
        <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-xl flex items-center gap-3 animate-fade-up">
          <CheckCircle2 className="w-5 h-5 text-green-600 flex-shrink-0" />
          <div>
            <p className="font-medium text-green-900">Order confirmed!</p>
            <p className="text-sm text-green-700">
              Your purchase is complete. Thank you for ordering.
            </p>
          </div>
        </div>
      )}

      {reservation.status === "RELEASED" && (
        <div className="mb-6 p-4 bg-stone-100 border border-stone-200 rounded-xl flex items-center gap-3 animate-fade-up">
          <XCircle className="w-5 h-5 text-stone-500 flex-shrink-0" />
          <div>
            <p className="font-medium text-stone-700">Reservation cancelled</p>
            <p className="text-sm text-stone-500">
              The hold has been released. Stock is available again.
            </p>
          </div>
        </div>
      )}

      {isExpired && reservation.status === "PENDING" && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl flex items-center gap-3 animate-fade-up">
          <AlertTriangle className="w-5 h-5 text-red-600 flex-shrink-0" />
          <div>
            <p className="font-medium text-red-900">Reservation expired</p>
            <p className="text-sm text-red-700">
              The 10-minute hold ended. Your reservation has been released.
            </p>
          </div>
        </div>
      )}

      {/* Main card */}
      <div className="bg-white border border-stone-200 rounded-2xl overflow-hidden shadow-sm">
        {/* Product image strip */}
        {reservation.product.imageUrl && (
          <div className="h-40 overflow-hidden">
            <img
              src={reservation.product.imageUrl}
              alt={reservation.product.name}
              className="w-full h-full object-cover"
            />
          </div>
        )}

        <div className="p-6">
          {/* Product info */}
          <div className="flex items-start gap-4 mb-6 pb-6 border-b border-stone-100">
            <div className="w-10 h-10 bg-orange-50 rounded-lg flex items-center justify-center flex-shrink-0">
              <Package className="w-5 h-5 text-orange-600" />
            </div>
            <div>
              <h2 className="font-medium text-stone-900 mb-1">
                {reservation.product.name}
              </h2>
              <div className="flex items-center gap-2 text-sm text-stone-500">
                <MapPin className="w-3.5 h-3.5" />
                <span>
                  {reservation.warehouse.name} · {reservation.warehouse.city}
                </span>
              </div>
            </div>
          </div>

          {/* Order details */}
          <div className="space-y-3 mb-6 pb-6 border-b border-stone-100">
            <div className="flex justify-between text-sm">
              <span className="text-stone-500">Unit price</span>
              <span className="font-mono">{formatPrice(reservation.product.price)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-stone-500">Quantity</span>
              <span className="font-mono">{reservation.quantity}</span>
            </div>
            <div className="flex justify-between font-semibold">
              <span>Total</span>
              <span className="font-mono">{formatPrice(total)}</span>
            </div>
          </div>

          {/* Countdown timer */}
          {reservation.status === "PENDING" && !isExpired && (
            <div
              className={`mb-6 p-4 rounded-xl flex items-center gap-3 ${
                isUrgent
                  ? "bg-red-50 border border-red-200"
                  : "bg-amber-50 border border-amber-200"
              }`}
            >
              <Clock
                className={`w-5 h-5 flex-shrink-0 ${
                  isUrgent ? "text-red-500" : "text-amber-600"
                }`}
              />
              <div>
                <p
                  className={`font-medium text-sm ${
                    isUrgent ? "text-red-900" : "text-amber-900"
                  }`}
                >
                  {isUrgent ? "Expiring soon!" : "Reservation active"}
                </p>
                <p
                  className={`font-mono text-2xl font-semibold ${
                    isUrgent ? "text-red-600 countdown-urgent" : "text-amber-700"
                  }`}
                >
                  {String(mins).padStart(2, "0")}:{String(secs).padStart(2, "0")}
                </p>
              </div>
            </div>
          )}

          {/* Reservation ID */}
          <div className="mb-6 flex items-center justify-between text-xs text-stone-400 font-mono">
            <span>Reservation ID</span>
            <span className="truncate max-w-[200px]">{reservation.id}</span>
          </div>

          {/* Error */}
          {error && (
            <div className="mb-4 flex items-start gap-2.5 p-3 bg-red-50 border border-red-100 rounded-lg text-sm text-red-700">
              <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Actions */}
          {reservation.status === "PENDING" && !isExpired && (
            <div className="flex gap-3">
              <button
                onClick={handleConfirm}
                disabled={isLoading}
                className="flex-1 py-3 bg-orange-600 text-white rounded-xl font-medium text-sm hover:bg-orange-700 active:scale-[0.98] disabled:opacity-60 transition-all flex items-center justify-center gap-2"
              >
                {isLoading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <ShoppingBag className="w-4 h-4" />
                )}
                Confirm purchase
              </button>
              <button
                onClick={handleCancel}
                disabled={isLoading}
                className="px-4 py-3 border border-stone-200 text-stone-600 rounded-xl font-medium text-sm hover:border-stone-300 hover:bg-stone-50 active:scale-[0.98] disabled:opacity-60 transition-all"
              >
                Cancel
              </button>
            </div>
          )}

          {reservation.status === "RELEASED" && (
            <button
              onClick={() => router.push("/")}
              className="w-full py-3 border border-stone-200 text-stone-600 rounded-xl font-medium text-sm hover:border-stone-300 hover:bg-stone-50 transition-all"
            >
              Browse products
            </button>
          )}

          {reservation.status === "CONFIRMED" && (
            <div className="flex items-center justify-center gap-2 text-green-600 font-medium text-sm py-3">
              <CheckCircle2 className="w-5 h-5" />
              Purchase complete — enjoy your order!
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
