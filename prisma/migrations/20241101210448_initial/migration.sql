-- CreateTable
CREATE TABLE "games" (
    "id" SERIAL NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fio_handle" TEXT NOT NULL,
    "phrase" TEXT NOT NULL,
    "prize" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'open',

    CONSTRAINT "games_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "guesses" (
    "id" SERIAL NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fio_handle" TEXT NOT NULL,
    "guess" TEXT NOT NULL,
    "game_id" INTEGER NOT NULL,

    CONSTRAINT "guesses_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "guesses" ADD CONSTRAINT "guesses_game_id_fkey" FOREIGN KEY ("game_id") REFERENCES "games"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
