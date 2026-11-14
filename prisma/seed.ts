import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";

import { randomUUID } from "node:crypto";

import { hashPassword } from "better-auth/crypto";

import { PrismaClient, type UserRole } from "../src/generated/prisma/client";
import { getDemoCredentials } from "../src/lib/demo";

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("DATABASE_URL is not defined. Add it to your .env file.");
}

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString }),
});

type SeedUser = {
  name: string;
  email: string;
  password: string;
  role: UserRole;
};

/**
 * Crea o actualiza un usuario con su cuenta de correo y contraseña, en el
 * formato que espera Better Auth (cuenta con providerId "credential").
 */
async function upsertUser({ name, email, password, role }: SeedUser) {
  const passwordHash = await hashPassword(password);

  const user = await prisma.user.upsert({
    where: { email },
    update: { name, role },
    create: { id: randomUUID(), name, email, role, emailVerified: true },
  });

  await prisma.account.upsert({
    where: {
      providerId_accountId: { providerId: "credential", accountId: user.id },
    },
    update: { password: passwordHash },
    create: {
      id: randomUUID(),
      providerId: "credential",
      accountId: user.id,
      userId: user.id,
      password: passwordHash,
    },
  });
}

function assertPasswordLength(variable: string, password: string) {
  if (password.length < 8 || password.length > 72) {
    throw new Error(`${variable} must be between 8 and 72 characters.`);
  }
}

async function seedUsers() {
  // Usuario de demostración (solo lectura): solo si se definen sus
  // credenciales en el entorno.
  const demo = getDemoCredentials();

  if (demo) {
    assertPasswordLength("DEMO_USER_PASSWORD", demo.password);
    await upsertUser({ ...demo, role: "DEMO" });
    console.log(`Demo user ready: ${demo.email}`);
  } else {
    console.log(
      "Demo user skipped: define DEMO_USER_EMAIL and DEMO_USER_PASSWORD to create it.",
    );
  }

  // Administrador: solo si se definen sus credenciales en el entorno.
  const email = process.env.SEED_ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.SEED_ADMIN_PASSWORD;

  if (!email || !password) {
    console.log(
      "Admin user skipped: define SEED_ADMIN_EMAIL and SEED_ADMIN_PASSWORD to create it.",
    );
    return;
  }

  assertPasswordLength("SEED_ADMIN_PASSWORD", password);

  await upsertUser({
    name: process.env.SEED_ADMIN_NAME?.trim() || "Administrador",
    email,
    password,
    role: "ADMIN",
  });
  console.log(`Admin user ready: ${email}`);
}

async function main() {
  await seedUsers();

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
