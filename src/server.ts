import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import path from 'path';
import expressEjsLayouts from 'express-ejs-layouts';
import apiRouter from './routes/api';
import config from './utils/config';
import { getActiveGame, fetchGuesses, startGame, getGames, getGameById, fetchGames } from './services/gameService';
import { SharedState } from './utils/sharedState';
import { logger_info, logger_error } from './utils/logger';
import prisma from './utils/db';

// Initialize Prisma
prisma.$connect();

// Initialize express
const app = express();
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');
app.use(expressEjsLayouts);
app.set('layout', 'layouts/layout');
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public'), {
    setHeaders: (res, path) => {
        res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
    }
}));
app.use('/api', apiRouter);

// Main game page - shows current game or redirects to past games
app.get('/', async (req, res) => {
    try {
        let game = await getActiveGame();

        if (!game) {
            game = await startGame();
        }

        if (!game) {
            const games = await getGames(config.FIO_REQ_LIMIT);
            return res.render('pages/games', {
                title: 'Past Games',
                games: games || [],
                showNoGamesMessage: true
            });
        }

        res.render('pages/game', {
            title: 'Game',
            game,
            pollInterval: config.CLIENT_POLL_INTERVAL
        });
    } catch (error) {
        logger_error('SERVER', 'Error handling main page', error);
        try {
            const games = await getGames(config.FIO_REQ_LIMIT);
            res.render('pages/games', {
                title: 'Past Games',
                games: games || [],
                showNoGamesMessage: true
            });
        } catch (fallbackError) {
            logger_error('SERVER', 'Error fetching past games as fallback', fallbackError);
            res.render('pages/games', {
                title: 'Past Games',
                games: [],
                showNoGamesMessage: true
            });
        }
    }
});

// Specific game page by ID
app.get('/game/:gameId', async (req, res) => {
    try {
        const gameId = parseInt(req.params.gameId);
        const game = await getGameById(gameId);

        if (!game) {
            return res.redirect('/games');
        }

        res.render('pages/game', {
            title: `Game ${gameId}`,
            game,
            pollInterval: config.CLIENT_POLL_INTERVAL
        });
    } catch (error) {
        logger_error('SERVER', `Error rendering game ${req.params.gameId}`, error);
        res.redirect('/games');
    }
});

// Past games list
app.get('/games', async (req, res) => {
    try {
        const games = await getGames(config.FIO_REQ_LIMIT);
        res.render('pages/games', {
            title: 'Past Games',
            games: games || [],
            showNoGamesMessage: false
        });
    } catch (error) {
        logger_error('SERVER', 'Error rendering past games', error);
        res.render('pages/games', {
            title: 'Past Games',
            games: [],
            showNoGamesMessage: true
        });
    }
});

// Rules page (placeholder for now)
app.get('/rules', (req, res) => {
    res.render('pages/rules', {
        title: 'Rules'
    });
});

app.listen(config.PORT, () => {
    logger_info('SERVER', `Server running on port ${config.PORT}`);
});

// Set up base guess check using interval from config
setInterval(async () => {
    const sharedState = SharedState.getInstance();
    const now = Date.now();

    if (now - sharedState.lastFioRequestCheckTime >= config.BASE_CHECK_INTERVAL) {
        try {
            await fetchGuesses();
            sharedState.lastFioRequestCheckTime = now;
        } catch (error) {
            if (!(error instanceof Error && (
                error.message.includes("Error 404") ||
                error.message.includes("No FIO Requests")
            ))) {
                logger_error('SERVER', 'Error checking FIO requests', error);
            }
        }
    }
}, config.BASE_CHECK_INTERVAL);

// Set up separate game creation check
setInterval(async () => {
    try {
        await fetchGames();
    } catch (error) {
        if (!(error instanceof Error && (
            error.message.includes("Error 404") ||
            error.message.includes("No FIO Requests")
        ))) {
            logger_error('SERVER', 'Error checking for game creation requests', error);
        }
    }
}, config.GAME_CHECK_INTERVAL);