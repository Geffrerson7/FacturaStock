-- AlterEnum
-- Va en su propia migración: PostgreSQL no deja usar un valor nuevo del enum
-- en la misma transacción que lo crea.
ALTER TYPE "UserRole" ADD VALUE 'CASHIER';
