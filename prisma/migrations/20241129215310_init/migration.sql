-- CreateIndex
CREATE INDEX "games_status_timestamp_idx" ON "games"("status", "timestamp");

-- CreateIndex
CREATE INDEX "guesses_gameId_idx" ON "guesses"("gameId");

-- CreateIndex
CREATE INDEX "guesses_status_idx" ON "guesses"("status");
