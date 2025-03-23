const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const path = require('path');
const axios = require('axios');
require('dotenv').config();

const app = express();

// CORS configuration
const corsOptions = {
    origin: process.env.NODE_ENV === 'production' 
        ? ['https://your-github-pages-url.com', 'https://your-custom-domain.com'] 
        : 'http://localhost:3000',
    optionsSuccessStatus: 200
};

// ESPN API endpoints for NCAA Women's Basketball
const ESPN_API = {
    NCAAW_RANKINGS: 'http://site.api.espn.com/apis/site/v2/sports/basketball/womens-college-basketball/rankings',
    NCAAW_SCOREBOARD: 'http://site.api.espn.com/apis/site/v2/sports/basketball/womens-college-basketball/scoreboard',
    NCAAW_GAME_PLAYBYPLAY: (gameId) => `http://site.api.espn.com/apis/site/v2/sports/basketball/womens-college-basketball/summary?event=${gameId}`
};

// Twitter API configuration
const TWITTER_API = {
    BASE_URL: 'https://api.twitter.com/2',
    BEARER_TOKEN: process.env.TWITTER_BEARER_TOKEN
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
        const scoreboard = await fetchESPNData(ESPN_API.NCAAW_SCOREBOARD, {
            limit: 100,
            groups: 50,  // NCAA Women's Basketball
        });
        
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
                            logo: homeTeam.team?.logo
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
                            logo: awayTeam.team?.logo
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
        const data = await fetchESPNData(ESPN_API.NCAAW_GAME_PLAYBYPLAY(gameId));
        
        // Process the play-by-play data
        const plays = data.plays || [];
        const drives = data.drives || [];
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
            }))
        };
        
        res.json(gameInfo);
    } catch (error) {
        console.error('Play-by-play Error:', error.message);
        res.status(500).json({ error: 'Failed to fetch play-by-play data' });
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

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
    console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
}); 