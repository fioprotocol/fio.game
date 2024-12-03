-- AlterTable
ALTER TABLE "games" ADD COLUMN     "winnerFioHandle" TEXT,
ADD COLUMN     "winnerPublicKey" TEXT;

-- AlterTable
ALTER TABLE "guesses" ALTER COLUMN "status" SET DEFAULT 'miss';
