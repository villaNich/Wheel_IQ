const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const path = require('path');
const axios = require('axios');
require('dotenv').config();

const app = express();

// CORS configuration
const corsOptions = {
    origin: '*', // Allow all origins in development
    optionsSuccessStatus: 200
};

// ESPN API endpoints for NCAA Women's Basketball
const ESPN_API = {
    NCAAW_RANKINGS: 'https://site.api.espn.com/apis/site/v2/sports/basketball/womens-college-basketball/rankings',
    NCAAW_SCOREBOARD: 'https://site.api.espn.com/apis/site/v2/sports/basketball/womens-college-basketball/scoreboard',
    NCAAW_GAME_PLAYBYPLAY: (gameId) => `https://site.api.espn.com/apis/site/v2/sports/basketball/womens-college-basketball/summary?event=${gameId}`
};

// ESPN API endpoints for PWHL
const PWHL_API = {
    SCOREBOARD: 'https://site.api.espn.com/apis/site/v2/sports/hockey/womens-pro/scoreboard',
    RANKINGS: 'https://site.api.espn.com/apis/site/v2/sports/hockey/womens-pro/standings',
    GAME_PLAYBYPLAY: (gameId) => `https://site.api.espn.com/apis/site/v2/sports/hockey/womens-pro/summary?event=${gameId}`
};

// Odds API configuration
const ODDS_API = {
    BASE_URL: 'https://api.the-odds-api.com/v4/sports/basketball_wncaab/odds',
    API_KEY: process.env.ODDS_API_KEY
};

// Twitter API configuration
const TWITTER_API = {
    BASE_URL: 'https://api.twitter.com/2',
    BEARER_TOKEN: process.env.TWITTER_BEARER_TOKEN
};

// ESPN API endpoints for NWSL
const NWSL_API = {
    SCOREBOARD: 'https://site.api.espn.com/apis/site/v2/sports/soccer/usa.nwsl/scoreboard',
    STANDINGS: 'https://site.api.espn.com/apis/site/v2/sports/soccer/usa.nwsl/standings',
    GAME_SUMMARY: (gameId) => `https://site.api.espn.com/apis/site/v2/sports/soccer/usa.nwsl/summary?event=${gameId}`
};

// Helper function to fetch data from ESPN API
async function fetchESPNData(url, params = {}) {
    try {
        console.log('Fetching from URL:', url, 'with params:', params);
        const response = await axios.get(url, { params });
        return response.data;
    } catch (error) {
        console.error('ESPN API Error:', error.message);
        throw error;
    }
}

// Helper function to fetch odds data
async function fetchOddsData() {
    try {
        const response = await axios.get(ODDS_API.BASE_URL, {
            params: {
                apiKey: ODDS_API.API_KEY,
                regions: 'us',
                markets: 'h2h',
                oddsFormat: 'american'
            }
        });
        return response.data;
    } catch (error) {
        console.error('Odds API Error:', error.message);
        return [];
    }
}

// Helper function to fetch tweets
async function fetchTweets(hashtag) {
    try {
        const response = await axios.get(`${TWITTER_API.BASE_URL}/tweets/search/recent`, {
            headers: {
                'Authorization': `Bearer ${TWITTER_API.BEARER_TOKEN}`
            },
            params: {
                'query': `#${hashtag} -is:retweet`,
                'tweet.fields': 'created_at,author_id,public_metrics',
                'expansions': 'author_id',
                'user.fields': 'name,username,profile_image_url',
                'max_results': 10
            }
        });
        return response.data;
    } catch (error) {
        console.error('Twitter API Error:', error.message);
        throw error;
    }
}

// Middleware
app.use(cors(corsOptions));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));
app.use(express.static(path.join(__dirname, 'public')));

// Health check endpoint
app.get('/health', (req, res) => {
    res.json({ status: 'healthy', timestamp: new Date().toISOString() });
});

// Routes
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// NCAA Women's March Madness Endpoints
app.get('/api/ncaaw/tournament', async (req, res) => {
    try {
        console.log('Fetching tournament data...');
        
        // Get current scoreboard data with specific parameters
        const [scoreboard, oddsData] = await Promise.all([
            fetchESPNData(ESPN_API.NCAAW_SCOREBOARD, {
                limit: 100,
                groups: 50,  // NCAA Women's Basketball
            }),
            fetchOddsData()
        ]);
        
        // Add detailed logging
        console.log('Full API Response:', {
            totalEvents: scoreboard.events?.length,
            events: scoreboard.events?.map(event => ({
                id: event.id,
                date: event.date,
                name: event.name,
                status: event.status?.type?.state
            }))
        });

        // Find the next upcoming game
        const now = new Date();
        console.log('Current time:', now.toISOString());
        
        const upcomingGames = scoreboard.events
            ?.filter(event => {
                const gameDate = new Date(event.date);
                const isUpcoming = gameDate > now;
                console.log(`Game ${event.name} at ${event.date} - Is upcoming: ${isUpcoming}`);
                return isUpcoming;
            })
            ?.sort((a, b) => new Date(a.date) - new Date(b.date)) || [];
            
        console.log('Filtered upcoming games:', upcomingGames.map(game => ({
            date: game.date,
            name: game.name,
            status: game.status?.type?.state
        })));

        // Process league and season info
        const leagueInfo = scoreboard.leagues?.[0] || {};
        const seasonInfo = leagueInfo.season || {};

        // Process games data with enhanced error handling
        const games = (scoreboard.events || []).map(event => {
            try {
                const competition = event.competitions?.[0];
                if (!competition) return null;

                const homeTeam = competition.competitors?.find(c => c.homeAway === 'home');
                const awayTeam = competition.competitors?.find(c => c.homeAway === 'away');
                if (!homeTeam || !awayTeam) return null;

                // Find matching odds for this game
                const matchingOdds = oddsData.find(odds => {
                    const homeMatch = odds.home_team.toLowerCase().includes(homeTeam.team.name.toLowerCase());
                    const awayMatch = odds.away_team.toLowerCase().includes(awayTeam.team.name.toLowerCase());
                    return homeMatch && awayMatch;
                });

                // Get tournament specific information
                const notes = competition.notes || [];
                const roundInfo = notes.find(n => n.type === "round");
                const regionInfo = notes.find(n => n.type === "region");
                const bracketInfo = notes.find(n => n.type === "tournament");

                return {
                    id: event.id,
                    date: event.date,
                    name: event.name,
                    shortName: event.shortName,
                    status: {
                        clock: event.status?.clock,
                        displayClock: event.status?.displayClock,
                        period: event.status?.period,
                        type: event.status?.type?.name,
                        state: event.status?.type?.state,
                        completed: event.status?.type?.completed,
                        description: event.status?.type?.description
                    },
                    teams: {
                        home: {
                            id: homeTeam.team?.id,
                            name: homeTeam.team?.name,
                            abbreviation: homeTeam.team?.abbreviation,
                            displayName: homeTeam.team?.displayName,
                            score: homeTeam.score,
                            seed: homeTeam.curatedRank?.seed,
                            winner: homeTeam.winner,
                            records: homeTeam.records,
                            logo: homeTeam.team?.logo,
                            odds: matchingOdds ? {
                                moneyline: matchingOdds.bookmakers?.[0]?.markets?.[0]?.outcomes?.find(
                                    o => o.name.toLowerCase().includes(homeTeam.team.name.toLowerCase())
                                )?.price || null
                            } : null
                        },
                        away: {
                            id: awayTeam.team?.id,
                            name: awayTeam.team?.name,
                            abbreviation: awayTeam.team?.abbreviation,
                            displayName: awayTeam.team?.displayName,
                            score: awayTeam.score,
                            seed: awayTeam.curatedRank?.seed,
                            winner: awayTeam.winner,
                            records: awayTeam.records,
                            logo: awayTeam.team?.logo,
                            odds: matchingOdds ? {
                                moneyline: matchingOdds.bookmakers?.[0]?.markets?.[0]?.outcomes?.find(
                                    o => o.name.toLowerCase().includes(awayTeam.team.name.toLowerCase())
                                )?.price || null
                            } : null
                        }
                    },
                    venue: competition.venue ? {
                        name: competition.venue.fullName,
                        city: competition.venue.address?.city,
                        state: competition.venue.address?.state,
                        capacity: competition.venue.capacity,
                        indoor: competition.venue.indoor
                    } : null,
                    broadcasts: competition.broadcasts?.map(b => b.names).flat() || [],
                    bracketInfo: {
                        round: roundInfo?.value,
                        region: regionInfo?.value,
                        bracketType: bracketInfo?.value
                    },
                    links: event.links?.map(link => ({
                        rel: link.rel,
                        href: link.href,
                        text: link.text
                    })) || []
                };
            } catch (error) {
                console.error('Error processing game:', error);
                return null;
            }
        }).filter(game => game !== null);

        // Organize games by round
        const gamesByRound = {
            "First Four": [],
            "First Round": [],
            "Second Round": [],
            "Sweet 16": [],
            "Elite Eight": [],
            "Final Four": [],
            "Championship": []
        };

        games.forEach(game => {
            const round = game.bracketInfo.round || "Unknown";
            if (gamesByRound[round]) {
                gamesByRound[round].push(game);
            }
        });

        const response = {
            tournament: {
                name: 'NCAA Women\'s Basketball Tournament',
                season: {
                    year: seasonInfo.year,
                    displayName: seasonInfo.displayName,
                    type: seasonInfo.type?.name
                }
            },
            rounds: Object.entries(gamesByRound)
                .filter(([_, games]) => games.length > 0)
                .map(([roundName, games]) => ({
                    name: roundName,
                    games: games.sort((a, b) => new Date(a.date) - new Date(b.date))
                })),
            games: {
                live: games.filter(g => g.status.state === 'in'),
                upcoming: games.filter(g => {
                    if (g.status.state !== 'pre') return false;
                    const gameDate = new Date(g.date);
                    const now = new Date();
                    
                    // Include any future games
                    return gameDate > now;
                }),
                completed: games.filter(g => g.status.state === 'post')
            },
            calendar: leagueInfo.calendar || [],
            lastUpdated: new Date().toISOString()
        };

        res.json(response);
    } catch (error) {
        console.error('Tournament Error:', {
            message: error.message,
            stack: error.stack,
            timestamp: new Date().toISOString()
        });
        res.status(500).json({ 
            error: 'Failed to fetch tournament data',
            message: error.message,
            timestamp: new Date().toISOString()
        });
    }
});

app.get('/api/ncaaw/rankings', async (req, res) => {
    try {
        const data = await fetchESPNData(ESPN_API.NCAAW_RANKINGS);
        
        // Get AP Top 25 rankings (index 0 is typically AP rankings)
        const rankings = data.rankings[0]?.ranks || [];
        
        // Format the rankings data
        const formattedRankings = rankings.map(rank => ({
            rank: rank.current,
            previousRank: rank.previous || rank.current,
            team: {
                name: rank.team.name,
                logo: rank.team.logos?.[0]?.href || null
            },
            record: `${rank.recordSummary || '0-0'}`
        }));

        res.json(formattedRankings);
    } catch (error) {
        console.error('Rankings Error:', error.message);
        res.status(500).json({ error: 'Failed to fetch rankings' });
    }
});

// Add new endpoint for play-by-play data
app.get('/api/ncaaw/game/:gameId/playbyplay', async (req, res) => {
    try {
        const { gameId } = req.params;
        console.log(`Fetching play-by-play data for game ${gameId}`);
        
        const data = await fetchESPNData(ESPN_API.NCAAW_GAME_PLAYBYPLAY(gameId));
        console.log('Play-by-play API response:', {
            hasPlays: Boolean(data.plays),
            playsCount: data.plays?.length || 0,
            hasDrives: Boolean(data.drives),
            drivesCount: data.drives?.length || 0
        });
        
        if (!data.plays) {
            return res.status(404).json({ 
                error: 'No play-by-play data available',
                gameId,
                timestamp: new Date().toISOString()
            });
        }
        
        // Process the play-by-play data
        const plays = data.plays || [];
        const gameInfo = {
            clock: data.clock,
            period: data.period,
            possessionArrow: data.possessionArrow,
            recentPlays: plays.slice(-10).map(play => ({
                id: play.id,
                clock: play.clock?.displayValue,
                period: play.period?.number,
                text: play.text,
                scoreValue: play.scoreValue,
                team: play.team?.abbreviation,
                type: play.type?.text
            })),
            scoring: data.scoringPlays?.map(play => ({
                id: play.id,
                clock: play.clock?.displayValue,
                period: play.period?.number,
                text: play.text,
                scoreValue: play.scoreValue,
                team: play.team?.abbreviation
            })) || []
        };
        
        res.json(gameInfo);
    } catch (error) {
        console.error('Play-by-play Error:', {
            message: error.message,
            gameId: req.params.gameId,
            stack: error.stack,
            timestamp: new Date().toISOString()
        });
        res.status(500).json({ 
            error: 'Failed to fetch play-by-play data',
            message: error.message,
            gameId: req.params.gameId,
            timestamp: new Date().toISOString()
        });
    }
});

// Add Twitter endpoint
app.get('/api/tweets/marchmadness', async (req, res) => {
    try {
        const tweets = await fetchTweets('marchmadness');
        
        // Process tweets to include user information
        const users = tweets.includes.users.reduce((acc, user) => {
            acc[user.id] = user;
            return acc;
        }, {});

        const formattedTweets = tweets.data.map(tweet => ({
            id: tweet.id,
            text: tweet.text,
            created_at: tweet.created_at,
            metrics: tweet.public_metrics,
            author: {
                id: tweet.author_id,
                name: users[tweet.author_id].name,
                username: users[tweet.author_id].username,
                profile_image: users[tweet.author_id].profile_image_url
            }
        }));

        res.json(formattedTweets);
    } catch (error) {
        console.error('Twitter API Error:', error);
        res.status(500).json({ error: 'Failed to fetch tweets' });
    }
});

// PWHL Tournament Endpoint
app.get('/api/pwhl/tournament', async (req, res) => {
    try {
        const response = await fetch(PWHL_API.SCOREBOARD);
        const data = await response.json();
        res.json(data);
    } catch (error) {
        console.error('Error fetching PWHL tournament data:', error);
        res.status(500).json({ error: 'Failed to fetch PWHL data' });
    }
});

// PWHL Rankings Endpoint
app.get('/api/pwhl/rankings', async (req, res) => {
    try {
        const response = await fetch(PWHL_API.RANKINGS);
        const data = await response.json();
        res.json(data);
    } catch (error) {
        console.error('Error fetching PWHL rankings:', error);
        res.status(500).json({ error: 'Failed to fetch PWHL rankings' });
    }
});

// PWHL Game Play-by-Play Endpoint
app.get('/api/pwhl/game/:gameId/playbyplay', async (req, res) => {
    try {
        const { gameId } = req.params;
        const response = await fetch(PWHL_API.GAME_PLAYBYPLAY(gameId));
        const data = await response.json();
        res.json(data);
    } catch (error) {
        console.error('Error fetching PWHL play-by-play data:', error);
        res.status(500).json({ error: 'Failed to fetch PWHL play-by-play data' });
    }
});

// NWSL Tournament Endpoint
app.get('/api/nwsl/tournament', async (req, res) => {
    try {
        const response = await fetchESPNData(NWSL_API.SCOREBOARD);
        
        // Process games data
        const games = (response.events || []).map(event => {
            try {
                const competition = event.competitions?.[0];
                if (!competition) return null;

                const homeTeam = competition.competitors?.find(c => c.homeAway === 'home');
                const awayTeam = competition.competitors?.find(c => c.homeAway === 'away');
                if (!homeTeam || !awayTeam) return null;

                return {
                    id: event.id,
                    date: event.date,
                    name: event.name,
                    shortName: event.shortName,
                    status: {
                        clock: event.status?.clock,
                        displayClock: event.status?.displayClock,
                        period: event.status?.period,
                        type: event.status?.type?.name,
                        state: event.status?.type?.state,
                        completed: event.status?.type?.completed,
                        description: event.status?.type?.description
                    },
                    teams: {
                        home: {
                            id: homeTeam.team?.id,
                            name: homeTeam.team?.name,
                            abbreviation: homeTeam.team?.abbreviation,
                            displayName: homeTeam.team?.displayName,
                            score: homeTeam.score,
                            winner: homeTeam.winner,
                            records: homeTeam.records,
                            logo: homeTeam.team?.logo
                        },
                        away: {
                            id: awayTeam.team?.id,
                            name: awayTeam.team?.name,
                            abbreviation: awayTeam.team?.abbreviation,
                            displayName: awayTeam.team?.displayName,
                            score: awayTeam.score,
                            winner: awayTeam.winner,
                            records: awayTeam.records,
                            logo: awayTeam.team?.logo
                        }
                    },
                    venue: {
                        name: competition.venue?.fullName,
                        city: competition.venue?.address?.city,
                        state: competition.venue?.address?.state,
                        country: competition.venue?.address?.country
                    },
                    broadcasts: competition.broadcasts?.[0]?.names || [],
                    links: event.links || []
                };
            } catch (error) {
                console.error('Error processing game:', error);
                return null;
            }
        }).filter(Boolean);

        // Categorize games
        const now = new Date();
        const categorizedGames = {
            live: games.filter(game => game.status.state === 'in'),
            upcoming: games.filter(game => new Date(game.date) > now),
            completed: games.filter(game => game.status.state === 'post')
        };

        res.json({
            games: categorizedGames,
            lastUpdated: new Date().toISOString()
        });
    } catch (error) {
        console.error('Error fetching NWSL tournament data:', error);
        res.status(500).json({ error: 'Failed to fetch NWSL data' });
    }
});

// NWSL Standings Endpoint
app.get('/api/nwsl/standings', async (req, res) => {
    try {
        const response = await fetchESPNData(NWSL_API.STANDINGS);
        res.json(response);
    } catch (error) {
        console.error('Error fetching NWSL standings:', error);
        res.status(500).json({ error: 'Failed to fetch NWSL standings' });
    }
});

// NWSL Game Summary Endpoint
app.get('/api/nwsl/game/:gameId/summary', async (req, res) => {
    try {
        const { gameId } = req.params;
        const response = await fetchESPNData(NWSL_API.GAME_SUMMARY(gameId));
        res.json(response);
    } catch (error) {
        console.error('Error fetching NWSL game summary:', error);
        res.status(500).json({ error: 'Failed to fetch NWSL game summary' });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
    console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
}); 