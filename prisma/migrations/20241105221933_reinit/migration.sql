/*
  Warnings:

  - You are about to drop the column `fio_handle` on the `games` table. All the data in the column will be lost.
  - You are about to drop the column `fio_handle` on the `guesses` table. All the data in the column will be lost.
  - You are about to drop the column `game_id` on the `guesses` table. All the data in the column will be lost.
  - Added the required column `fioHandle` to the `games` table without a default value. This is not possible if the table is not empty.
  - Added the required column `fioHandle` to the `guesses` table without a default value. This is not possible if the table is not empty.
  - Added the required column `gameId` to the `guesses` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "guesses" DROP CONSTRAINT "guesses_game_id_fkey";

-- AlterTable
ALTER TABLE "games" DROP COLUMN "fio_handle",
ADD COLUMN     "fioHandle" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "guesses" DROP COLUMN "fio_handle",
DROP COLUMN "game_id",
ADD COLUMN     "fioHandle" TEXT NOT NULL,
ADD COLUMN     "gameId" INTEGER NOT NULL;

-- AddForeignKey
ALTER TABLE "guesses" ADD CONSTRAINT "guesses_gameId_fkey" FOREIGN KEY ("gameId") REFERENCES "games"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
