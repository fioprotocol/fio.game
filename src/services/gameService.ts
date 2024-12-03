import { logger_info, logger_error } from '../utils/logger';
import { getPendingFioRequests, rejectFioRequest, sendReward, getFioBalance  } from './fioService';
import { SharedState } from '../utils/sharedState';
import prisma from '../utils/db';
import config from '../utils/config';
import { Game, Guess } from '@prisma/client';

export type GameState = {
    id: number;
    status: string;
    prize: number;
    maskedPhrase: string;
    correctGuesses: string[];
    revealedPhrase?: string;
    winnerFioHandle: string | null;
    guesses?: Guess[];
};

type GameWithGuesses = Game & {
    guesses: Guess[];
};

// Get current active game with guesses
export async function getActiveGame(): Promise<GameState | null> {
    try {
        const game = await prisma.game.findFirst({
            where: { status: 'in_progress' },
            orderBy: {
                timestamp: 'asc'
            },
            include: { guesses: true }
        });

        if (!game) {
            return null;
        }

        return formatGameState(game);
    } catch (error) {
        logger_error('GAME_SERVICE', 'Failed to get active game', error);
        throw error;
    }
}

// Get specific game by ID with guesses
export async function getGameById(gameId: number): Promise<GameState | null> {
    try {
        const game = await prisma.game.findUnique({
            where: { id: gameId },
            include: { guesses: true }
        });

        if (!game) {
            return null;
        }

        return formatGameState(game);
    } catch (error) {
        logger_error('GAME_SERVICE', `Failed to get game by ID ${gameId}`, error);
        throw error;
    }
}

// Get list of past completed games
export async function getGames(limit: number): Promise<GameState[]> {
    try {
        const games = await prisma.game.findMany({
            where: { status: 'completed' },
            take: limit,
            orderBy: {
                timestamp: 'desc'
            },
            include: { guesses: true }
        });

        return games.map(formatGameState);
    } catch (error) {
        logger_error('GAME_SERVICE', 'Failed to get games list', error);
        throw error;
    }
}

// Start new game
export async function startGame(): Promise<GameState | null> {
    try {
        const openGame = await prisma.game.findFirst({
            where: { status: 'open' },
            orderBy: { timestamp: 'asc' }
        });

        if (!openGame) {
            return null;
        }

        // Check FIO balance before starting game
        const balance = await getFioBalance();
        if (balance < openGame.prize) {
            logger_error('GAME_SERVICE', `Insufficient FIO balance (${balance}) for game prize (${openGame.prize})`, '');
            return null;
        }

        const startedGame = await prisma.game.update({
            where: { id: openGame.id },
            data: { status: 'in_progress' },
            include: { guesses: true }
        });

        logger_info('GAME_SERVICE', `Started new game ${startedGame.id}`);
        return formatGameState(startedGame);
    } catch (error) {
        logger_error('GAME_SERVICE', 'Failed to start game', error);
        throw error;
    }
}

// Fetch and process game guesses
export async function fetchGuesses() {
    const sharedState = SharedState.getInstance();

    // Reset the flag if it's been set for more than 5 minutes (safety measure)
    if (sharedState.isProcessingGuesses && Date.now() - sharedState.lastFioRequestCheckTime > 300000) {
        sharedState.resetProcessingState();
    }

    if (sharedState.isProcessingGuesses) {
        logger_info('GAME_SERVICE', 'Another guess processing session is in progress, skipping');
        return;
    }

    try {
        sharedState.isProcessingGuesses = true;

        const activeGame = await getActiveGame();
        if (!activeGame) {
            return;
        }

        const requests = await getPendingFioRequests();
        if (!requests.length) {
            return;
        }

        logger_info('GAME_SERVICE', `Processing ${requests.length} FIO requests for game ${activeGame.id}`);

        for (const request of requests) {
            try {
                // Only process guesses from game handle
                if (request.payer_fio_address !== config.FIO_GUESS_HANDLE) {
                    continue;
                }

                const currentGame = await getActiveGame();
                if (!currentGame) {
                    logger_info('GAME_SERVICE', 'No active game available, stopping request processing');
                    break;
                }

                await processGuess(
                    currentGame.id,
                    request.memo,
                    request.payee_fio_address,
                    request.payee_public_address,
                    request.fio_request_id
                );
            } catch (error) {
                logger_error('GAME_SERVICE', `Error processing FIO Request ${request.fio_request_id}`, error);
            }
        }
    } catch (error) {
        logger_error('GAME_SERVICE', 'Failed to fetch guesses', error);
        throw error;
    } finally {
        sharedState.resetProcessingState();
    }
}

// Process single game guess
export async function processGuess(
    gameId: number,
    guess: string,
    fioHandle: string,
    payeePublicKey: string,
    requestId: number
) {
    try {
        const game = await prisma.game.findUnique({
            where: { id: gameId },
            include: { guesses: true }
        });

        if (!game) {
            throw new Error('Game not found');
        }

        const normalizedGuess = guess.trim().toUpperCase();
        const normalizedPhrase = game.phrase.toUpperCase();
        const isFullPhraseGuess = normalizedGuess.length > 1;
        const isCorrect = isFullPhraseGuess
            ? normalizedGuess === normalizedPhrase
            : normalizedPhrase.includes(normalizedGuess);

        // Get all correct guesses including the current one if it's correct
        const correctGuesses = game.guesses
            .filter(g => normalizedPhrase.includes(g.guess.toUpperCase()))
            .map(g => g.guess.toUpperCase());
        if (isCorrect && !correctGuesses.includes(normalizedGuess)) {
            correctGuesses.push(normalizedGuess);
        }

        // Check if all letters have been guessed
        const phraseLetters = new Set(normalizedPhrase.split(''));
        const allLettersGuessed = Array.from(phraseLetters).every(letter =>
            letter === ' ' || correctGuesses.includes(letter)
        );

        const isWinner = isFullPhraseGuess ? isCorrect : allLettersGuessed;
        const guessStatus = isWinner ? 'winner' : (isCorrect ? 'correct' : 'miss');

        await prisma.guess.create({
            data: {
                gameId,
                fioHandle,
                guess: normalizedGuess,
                status: guessStatus
            }
        });

        logger_info('GAME_SERVICE', `Processed guess for game ${gameId}: "${normalizedGuess}" - ${guessStatus}`);

        if (isWinner) {
            logger_info('GAME_SERVICE', `Game ${gameId} completed! Winner: ${fioHandle}`);
            await prisma.game.update({
                where: { id: gameId },
                data: {
                    status: 'completed',
                    winnerFioHandle: fioHandle
                }
            });

            logger_info('GAME_SERVICE', `Sending reward for winning guess to ${fioHandle}`);
            await sendReward(
                payeePublicKey,
                fioHandle,
                requestId,
                game.prize * 1000000000
            );

            await startGame(); // Start new game
        } else {
            logger_info('GAME_SERVICE', `Rejecting FIO Request ${requestId}`);
            await rejectFioRequest(requestId);
        }
    } catch (error) {
        logger_error('GAME_SERVICE', `Failed to process guess for game ${gameId}`, error);
        throw error;
    }
}

// Fetch and process new game creation requests
// Fetch and process new game creation requests
export async function fetchGames() {
    try {
        const requests = await getPendingFioRequests();

        if (!requests.length) {
            return;
        }

        for (const request of requests) {
            try {
                // Skip guess requests
                if (request.payer_fio_address === config.FIO_GUESS_HANDLE) {
                    continue;
                }

                // Process admin requests
                if (request.payer_fio_address === config.FIO_ADMIN_HANDLE) {
                    // Verify payee is in admins list
                    if (config.FIO_ADMINS.includes(request.payee_fio_address)) {
                        // Clean and validate the phrase
                        const cleanedPhrase = request.memo
                            .trim()
                            .replace(/\s+/g, ' ')
                            .toUpperCase();

                        // Validate phrase contains only alphanumeric characters
                        if (!/^[A-Z0-9 ]*$/.test(cleanedPhrase)) {
                            logger_info('GAME_SERVICE', `Game create: Invalid phrase characters in ${request.fio_request_id}`);
                        } else {
                            // Create new game using amount as prize and memo as phrase
                            const amount = Number(request.amount.toString());
                            if (!isNaN(amount) && amount > 0 && amount <= config.MAX_PRIZE) {
                                await createGame(cleanedPhrase, amount);
                                logger_info('GAME_SERVICE', `Game create: new game from request ${request.fio_request_id}`);
                            } else {
                                logger_info('GAME_SERVICE', `Game create: Invalid amount (${amount}) in ${request.fio_request_id}`);
                            }
                        }
                    } else {
                        logger_info('GAME_SERVICE', `Game create: Payee (${request.payee_fio_address}) not in admins in ${request.fio_request_id}`);
                    }
                } else {
                    logger_info('GAME_SERVICE', `Game create: Payer (${request.payer_fio_address}) not admin in ${request.fio_request_id}`);
                }

                // Reject request after processing or if not from valid sender
                await rejectFioRequest(request.fio_request_id);
                logger_info('GAME_SERVICE', `Rejected request ${request.fio_request_id}`);

            } catch (error) {
                logger_error('GAME_SERVICE', `Error processing FIO Request ${request.fio_request_id}`, error);
            }
        }
    } catch (error) {
        logger_error('GAME_SERVICE', 'Failed to fetch games', error);
        throw error;
    }
}

// Format game state from database game object
function formatGameState(game: GameWithGuesses): GameState {
    const correctGuesses = game.guesses
        .filter(g => game.phrase.toUpperCase().includes(g.guess.toUpperCase()))
        .map(g => g.guess.toUpperCase());

    return {
        id: game.id,
        status: game.status,
        prize: game.prize,
        maskedPhrase: game.status === 'completed' ? game.phrase : maskPhrase(game.phrase, correctGuesses),
        correctGuesses,
        revealedPhrase: game.status === 'completed' ? game.phrase : undefined,
        winnerFioHandle: game.winnerFioHandle,
        guesses: game.guesses
    };
}

// Mask phrase for display
function maskPhrase(phrase: string, correctGuesses: string[]): string {
    return phrase
        .split('')
        .map(char => {
            if (char === ' ') return ' ';
            return correctGuesses.includes(char.toUpperCase()) ? char : '_';
        })
        .join('');
}

// Create new game
export async function createGame(phrase: string, prize: number): Promise<void> {
    try {
        await prisma.game.create({
            data: {
                phrase,
                prize
            }
        });

        logger_info('GAME_SERVICE', `Created new game with prize ${prize} FIO`);
    } catch (error) {
        logger_error('GAME_SERVICE', 'Failed to create game', error);
        throw error;
    }
}