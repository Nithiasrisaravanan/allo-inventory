import { z } from "zod";

export const CreateReservationSchema = z.object({
  productId: z.string().min(1, "Product ID is required"),
  warehouseId: z.string().min(1, "Warehouse ID is required"),
  quantity: z.number().int().min(1, "Quantity must be at least 1").max(10, "Max 10 units per reservation"),
});

export type CreateReservationInput = z.infer<typeof CreateReservationSchema>;

export const ReservationStatusSchema = z.enum(["PENDING", "CONFIRMED", "RELEASED"]);

export const ReservationSchema = z.object({
  id: z.string(),
  productId: z.string(),
  warehouseId: z.string(),
  quantity: z.number(),
  status: ReservationStatusSchema,
  expiresAt: z.string(),
  confirmedAt: z.string().nullable(),
  releasedAt: z.string().nullable(),
  createdAt: z.string(),
  product: z.object({
    id: z.string(),
    name: z.string(),
    price: z.number(),
    imageUrl: z.string().nullable(),
  }),
  warehouse: z.object({
    id: z.string(),
    name: z.string(),
    city: z.string(),
  }),
});

export type Reservation = z.infer<typeof ReservationSchema>;
