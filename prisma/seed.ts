import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";

import { PrismaClient } from "../src/generated/prisma/client";

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("DATABASE_URL is not defined. Add it to your .env file.");
}

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString }),
});

async function main() {
  await prisma.customer.upsert({
    where: { dni: "00000000" },
    update: {},
    create: {
      dni: "00000000",
      firstName: "Walk-in",
      lastName: "Customer",
      address: "N/A",
    },
  });

  const categories = await Promise.all([
    prisma.category.upsert({
      where: { name: "Bebidas" },
      update: {},
      create: { name: "Bebidas", description: "Bebidas y refrescos" },
    }),
    prisma.category.upsert({
      where: { name: "Snacks" },
      update: {},
      create: { name: "Snacks", description: "Botanas y aperitivos" },
    }),
    prisma.category.upsert({
      where: { name: "Limpieza" },
      update: {},
      create: { name: "Limpieza", description: "Artículos de limpieza" },
    }),
  ]);

  const categoryByName = new Map(
    categories.map((category) => [category.name, category]),
  );

  const products = [
    {
      sku: "BEB-001",
      name: "Agua mineral 500 ml",
      description: "Botella de agua sin gas",
      price: "2.50",
      stock: 50,
      category: "Bebidas",
    },
    {
      sku: "BEB-002",
      name: "Gaseosa 1.5 L",
      description: "Bebida gaseosa familiar",
      price: "6.50",
      stock: 30,
      category: "Bebidas",
    },
    {
      sku: "SNK-001",
      name: "Papas fritas 150 g",
      description: "Papas fritas natural",
      price: "3.50",
      stock: 40,
      category: "Snacks",
    },
    {
      sku: "LIM-001",
      name: "Detergente 1 kg",
      description: "Detergente en polvo",
      price: "12.90",
      stock: 20,
      category: "Limpieza",
    },
  ];

  for (const product of products) {
    const category = categoryByName.get(product.category);

    if (!category) {
      throw new Error(`Missing seed category: ${product.category}`);
    }

    await prisma.product.upsert({
      where: { sku: product.sku },
      update: {},
      create: {
        sku: product.sku,
        name: product.name,
        description: product.description,
        price: product.price,
        stock: product.stock,
        categoryId: category.id,
      },
    });
  }

  console.log("Seed completed.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
