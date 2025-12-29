/*
  Warnings:

  - Added the required column `updatedAt` to the `Session` table without a default value. This is not possible if the table is not empty.
  - Made the column `updatedAt` on table `User` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
ALTER TABLE "Session" ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL;

-- AlterTable
ALTER TABLE "User" ALTER COLUMN "updatedAt" SET NOT NULL;
