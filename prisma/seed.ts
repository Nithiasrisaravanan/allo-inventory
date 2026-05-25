import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Seeding database...");

  // Clear existing data
  await prisma.reservation.deleteMany();
  await prisma.stock.deleteMany();
  await prisma.product.deleteMany();
  await prisma.warehouse.deleteMany();
  await prisma.idempotencyRecord.deleteMany();

  // Create warehouses
  const mumbai = await prisma.warehouse.create({
    data: { id: "wh_mumbai", name: "Mumbai Central Hub", city: "Mumbai" },
  });
  const delhi = await prisma.warehouse.create({
    data: { id: "wh_delhi", name: "Delhi North Hub", city: "Delhi" },
  });
  const bangalore = await prisma.warehouse.create({
    data: { id: "wh_bangalore", name: "Bangalore Tech Park", city: "Bangalore" },
  });

  console.log("✅ Warehouses created");

  // Create products
  const products = await Promise.all([
    prisma.product.create({
      data: {
        name: "Sony WH-1000XM5 Headphones",
        description: "Industry-leading noise cancelling headphones with 30-hour battery life and multipoint connection.",
        price: 2999900, // ₹29,999
        imageUrl: "https://images.unsplash.com/photo-1618366712010-f4ae9c647dcb?w=800&q=80",
      },
    }),
    prisma.product.create({
      data: {
        name: "Apple iPad Air (M2)",
        description: "Supercharged by M2 chip. 10.9-inch Liquid Retina display, 5G capable, with USB-C.",
        price: 6999900, // ₹69,999
        imageUrl: "https://images.unsplash.com/photo-1544244015-0df4b3ffc6b0?w=800&q=80",
      },
    }),
    prisma.product.create({
      data: {
        name: "Samsung Galaxy Watch 6",
        description: "Advanced health monitoring, sleep tracking, and sapphire crystal display.",
        price: 2499900, // ₹24,999
        imageUrl: "https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=800&q=80",
      },
    }),
    prisma.product.create({
      data: {
        name: "Logitech MX Master 3S",
        description: "Advanced wireless mouse with ultra-fast MagSpeed scrolling and whisper-quiet clicks.",
        price: 999900, // ₹9,999
        imageUrl: "https://images.unsplash.com/photo-1527864550417-7fd91fc51a46?w=800&q=80",
      },
    }),
    prisma.product.create({
      data: {
        name: "DJI Mini 4 Pro Drone",
        description: "Professional 4K drone with 3-axis gimbal, 34-min flight time, and obstacle sensing.",
        price: 7499900, // ₹74,999
        imageUrl: "https://images.unsplash.com/photo-1473968512647-3e447244af8f?w=800&q=80",
      },
    }),
    prisma.product.create({
      data: {
        name: "Kindle Paperwhite Signature",
        description: "6.8-inch display, wireless charging, auto-adjusting front light, 32GB storage.",
        price: 1799900, // ₹17,999
        imageUrl: "https://images.unsplash.com/photo-1481349518771-20055b2a7b24?w=800&q=80",
      },
    }),
  ]);

  console.log("✅ Products created");

  // Create stock levels (some intentionally low to showcase reservation logic)
  const stockData = [
    // Sony Headphones
    { productId: products[0].id, warehouseId: mumbai.id, total: 5, reserved: 0 },
    { productId: products[0].id, warehouseId: delhi.id, total: 3, reserved: 0 },
    { productId: products[0].id, warehouseId: bangalore.id, total: 2, reserved: 0 },
    // iPad Air
    { productId: products[1].id, warehouseId: mumbai.id, total: 8, reserved: 0 },
    { productId: products[1].id, warehouseId: delhi.id, total: 1, reserved: 0 }, // Only 1 left!
    { productId: products[1].id, warehouseId: bangalore.id, total: 4, reserved: 0 },
    // Samsung Watch
    { productId: products[2].id, warehouseId: mumbai.id, total: 12, reserved: 0 },
    { productId: products[2].id, warehouseId: delhi.id, total: 7, reserved: 0 },
    { productId: products[2].id, warehouseId: bangalore.id, total: 1, reserved: 0 }, // Only 1 left!
    // Logitech Mouse
    { productId: products[3].id, warehouseId: mumbai.id, total: 20, reserved: 0 },
    { productId: products[3].id, warehouseId: delhi.id, total: 15, reserved: 0 },
    { productId: products[3].id, warehouseId: bangalore.id, total: 10, reserved: 0 },
    // DJI Drone
    { productId: products[4].id, warehouseId: mumbai.id, total: 2, reserved: 0 }, // Only 2!
    { productId: products[4].id, warehouseId: delhi.id, total: 1, reserved: 0 }, // Only 1!
    { productId: products[4].id, warehouseId: bangalore.id, total: 3, reserved: 0 },
    // Kindle
    { productId: products[5].id, warehouseId: mumbai.id, total: 6, reserved: 0 },
    { productId: products[5].id, warehouseId: delhi.id, total: 4, reserved: 0 },
    { productId: products[5].id, warehouseId: bangalore.id, total: 2, reserved: 0 },
  ];

  await prisma.stock.createMany({ data: stockData });

  console.log("✅ Stock levels created");
  console.log("🎉 Seed complete!");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
