/*
  Warnings:

  - You are about to drop the column `meta` on the `Item` table. All the data in the column will be lost.
  - You are about to drop the column `title` on the `Item` table. All the data in the column will be lost.
  - You are about to drop the column `blob` on the `Vault` table. All the data in the column will be lost.
  - You are about to drop the column `cipherMeta` on the `Vault` table. All the data in the column will be lost.
  - Added the required column `encryptedData` to the `Item` table without a default value. This is not possible if the table is not empty.
  - Added the required column `iv` to the `Item` table without a default value. This is not possible if the table is not empty.
  - Added the required column `encryptedVaultKey` to the `Vault` table without a default value. This is not possible if the table is not empty.
  - Added the required column `salt` to the `Vault` table without a default value. This is not possible if the table is not empty.

*/
-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "AuditEvent" ADD VALUE 'SIGNUP_SUCCESS';
ALTER TYPE "AuditEvent" ADD VALUE 'SESSION_DELETE';

-- AlterTable
ALTER TABLE "Item" DROP COLUMN "meta",
DROP COLUMN "title",
ADD COLUMN     "encryptedData" TEXT NOT NULL,
ADD COLUMN     "iv" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "Vault" DROP COLUMN "blob",
DROP COLUMN "cipherMeta",
ADD COLUMN     "encryptedVaultKey" TEXT NOT NULL,
ADD COLUMN     "salt" TEXT NOT NULL;
