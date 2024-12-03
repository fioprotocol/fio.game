import express from 'express';
import { getActiveGame, getGameById, getGames, fetchGuesses } from '../services/gameService';
import { SharedState } from '../utils/sharedState';
import config from '../utils/config';
import { logger_error } from '../utils/logger';

const router = express.Router();
const sharedState = SharedState.getInstance();

// Prevent caching for all API routes
router.use((req, res, next) => {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    next();
});

// GET /api/game - returns current active game with guesses
router.get('/game', async (req, res) => {
    try {
        const game = await getActiveGame();
        if (!game) {
            return res.status(404).json({ error: 'No active game found' });
        }

        res.json({
            game,
            config: {
                pollInterval: config.CLIENT_POLL_INTERVAL
            }
        });
    } catch (error) {
        logger_error("API", 'Failed to get active game', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// GET /api/game/:gameId - returns specific game with guesses
router.get('/game/:gameId', async (req, res) => {
    try {
        const gameId = parseInt(req.params.gameId);
        const now = Date.now();

        // Check for new FIO requests if enough time has passed
        if (now - sharedState.lastFioRequestCheckTime >= config.FIO_CHECK_INTERVAL) {
            try {
                await fetchGuesses();
                sharedState.lastFioRequestCheckTime = now;
            } catch (error) {
                logger_error("API", 'Error checking FIO requests', error);
            }
        }

        const game = await getGameById(gameId);
        if (!game) {
            return res.status(404).json({ error: 'Game not found' });
        }

        res.json({
            game,
            config: {
                pollInterval: config.CLIENT_POLL_INTERVAL
            }
        });
    } catch (error) {
        logger_error("API", 'Failed to get game by ID', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// GET /api/games - returns list of recent games without guesses
router.get('/games', async (req, res) => {
    try {
        const games = await getGames(config.FIO_REQ_LIMIT);
        res.json({ games });
    } catch (error) {
        logger_error("API", 'Failed to get games list', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

export default router;