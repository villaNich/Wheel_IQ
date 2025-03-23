const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const path = require('path');
const axios = require('axios');

const app = express();

// ESPN API endpoints for NCAA Women's Basketball
const ESPN_API = {
    NCAAW_RANKINGS: 'http://site.api.espn.com/apis/site/v2/sports/basketball/womens-college-basketball/rankings',
    NCAAW_SCOREBOARD: 'http://site.api.espn.com/apis/site/v2/sports/basketball/womens-college-basketball/scoreboard',
    NCAAW_GAME_PLAYBYPLAY: (gameId) => `http://site.api.espn.com/apis/site/v2/sports/basketball/womens-college-basketball/summary?event=${gameId}`
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

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));
app.use(express.static(path.join(__dirname, 'public')));

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
            seasontype: 3  // Postseason
        });
        
        console.log('Raw scoreboard data:', JSON.stringify(scoreboard.events?.length || 0, null, 2));

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
                    const today = new Date();
                    const tomorrow = new Date(today);
                    tomorrow.setDate(tomorrow.getDate() + 1);
                    tomorrow.setHours(23, 59, 59, 999);
                    
                    // Only include games scheduled for today or tomorrow
                    return gameDate <= tomorrow;
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

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
}); 