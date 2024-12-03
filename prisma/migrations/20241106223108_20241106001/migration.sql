/*
  Warnings:

  - Added the required column `status` to the `guesses` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "guesses" ADD COLUMN     "status" TEXT NOT NULL;
