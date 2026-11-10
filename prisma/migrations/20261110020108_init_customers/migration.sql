-- CreateTable
CREATE TABLE "customers" (
    "id" UUID NOT NULL,
    "dni" VARCHAR(8) NOT NULL,
    "first_name" VARCHAR(80) NOT NULL,
    "last_name" VARCHAR(80) NOT NULL,
    "address" VARCHAR(200) NOT NULL,
    "phone" VARCHAR(20),
    "email" VARCHAR(120),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "customers_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "customers_dni_key" ON "customers"("dni");

-- CreateIndex
CREATE UNIQUE INDEX "customers_email_key" ON "customers"("email");
