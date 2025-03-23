// API endpoints
const API = {
    tournament: '/api/ncaaw/tournament',
    rankings: '/api/ncaaw/rankings',
    playByPlay: (gameId) => `/api/ncaaw/game/${gameId}/playbyplay`
};

// Helper function to show loading state
function showLoading(elementId) {
    const element = document.getElementById(elementId);
    element.innerHTML = '<div class="loading"></div>';
}

// Helper function to show error state
function showError(elementId, message) {
    const element = document.getElementById(elementId);
    element.innerHTML = `<div class="error">${message}</div>`;
}

// Format date helper
function formatDate(dateString) {
    const date = new Date(dateString);
    const now = new Date();
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    // Check if date is today
    if (date.toDateString() === now.toDateString()) {
        return `Today, ${date.toLocaleTimeString('en-US', { 
            hour: 'numeric',
            minute: '2-digit',
            timeZoneName: 'short'
        })}`;
    }
    
    // Check if date is tomorrow
    if (date.toDateString() === tomorrow.toDateString()) {
        return `Tomorrow, ${date.toLocaleTimeString('en-US', { 
            hour: 'numeric',
            minute: '2-digit',
            timeZoneName: 'short'
        })}`;
    }
    
    // For other dates
    return date.toLocaleDateString('en-US', { 
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        timeZoneName: 'short'
    });
}

// Format game status
function formatGameStatus(status) {
    if (status.state === 'pre') {
        return status.description || 'Scheduled';
    } else if (status.state === 'in') {
        return status.period > 4 
            ? `OT${status.period - 4} ${status.displayClock}`
            : `${status.period}Q ${status.displayClock}`;
    } else {
        return 'Final' + (status.period > 4 ? ' (OT)' : '');
    }
}

// Helper function to group games by date
function groupGamesByDate(games) {
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    return games.reduce((acc, game) => {
        const gameDate = new Date(game.date);
        
        if (gameDate.toDateString() === today.toDateString()) {
            acc.today.push(game);
        } else if (gameDate.toDateString() === tomorrow.toDateString()) {
            acc.tomorrow.push(game);
        } else if (gameDate > tomorrow) {
            acc.later.push(game);
        }
        
        return acc;
    }, { today: [], tomorrow: [], later: [] });
}

// Function to format tweet date
function formatTweetDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}

// Function to load tweets
async function loadTweets() {
    try {
        const newsContainer = document.getElementById('march-madness-news');
        if (!newsContainer) return;

        newsContainer.innerHTML = '<div class="loading"></div>';

        const response = await fetch('/api/tweets/marchmadness');
        if (!response.ok) throw new Error('Failed to fetch tweets');
        
        const tweets = await response.json();
        
        const tweetsList = document.createElement('div');
        tweetsList.className = 'tweets-list';
        
        tweets.forEach(tweet => {
            const tweetCard = document.createElement('div');
            tweetCard.className = 'tweet-card';
            tweetCard.innerHTML = `
                <div class="tweet-header">
                    <img src="${tweet.author.profile_image}" alt="${tweet.author.name}" class="tweet-avatar">
                    <div class="tweet-author">
                        <div class="tweet-name">${tweet.author.name}</div>
                        <div class="tweet-username">@${tweet.author.username}</div>
                    </div>
                    <div class="tweet-date">${formatTweetDate(tweet.created_at)}</div>
                </div>
                <div class="tweet-content">${tweet.text}</div>
                <div class="tweet-metrics">
                    <span>❤️ ${tweet.metrics.like_count}</span>
                    <span>🔄 ${tweet.metrics.retweet_count}</span>
                    <span>💬 ${tweet.metrics.reply_count}</span>
                </div>
            `;
            tweetsList.appendChild(tweetCard);
        });

        newsContainer.innerHTML = '';
        newsContainer.appendChild(tweetsList);
    } catch (error) {
        console.error('Error loading tweets:', error);
        const newsContainer = document.getElementById('march-madness-news');
        if (newsContainer) {
            newsContainer.innerHTML = '<div class="error">Failed to load tweets</div>';
        }
    }
}

// Update initApp to include tweet loading
async function initApp() {
    await Promise.all([
        loadTournamentData(),
        loadNCAARankings(),
        loadTweets()
    ]);
}

// Add error handling for API calls
async function fetchWithRetry(url, options = {}, retries = 3) {
    for (let i = 0; i < retries; i++) {
        try {
            const response = await fetch(url, options);
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
            return await response.json();
        } catch (error) {
            if (i === retries - 1) throw error;
            await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1))); // Exponential backoff
        }
    }
}

// Helper functions for game storage
function saveCompletedGame(game) {
    try {
        const storage = JSON.parse(localStorage.getItem('completedGames') || '{}');
        const now = new Date().getTime();
        
        // Remove games older than 24 hours
        Object.keys(storage).forEach(gameId => {
            if (now - storage[gameId].savedAt > 24 * 60 * 60 * 1000) {
                delete storage[gameId];
            }
        });
        
        // Save the new game with timestamp
        storage[game.id] = {
            game,
            savedAt: now
        };
        
        localStorage.setItem('completedGames', JSON.stringify(storage));
    } catch (error) {
        console.error('Error saving completed game:', error);
    }
}

function getCompletedGames() {
    try {
        const storage = JSON.parse(localStorage.getItem('completedGames') || '{}');
        const now = new Date().getTime();
        const games = [];
        
        Object.keys(storage).forEach(gameId => {
            if (now - storage[gameId].savedAt <= 24 * 60 * 60 * 1000) {
                games.push(storage[gameId].game);
            }
        });
        
        return games;
    } catch (error) {
        console.error('Error getting completed games:', error);
        return [];
    }
}

function loadTournamentData() {
    fetchWithRetry(API.tournament)
        .then(data => {
            // Save completed games to local storage
            data.games.completed.forEach(game => saveCompletedGame(game));
            
            // Merge API completed games with stored completed games
            const storedGames = getCompletedGames();
            const allCompletedGames = [...data.games.completed];
            
            // Add stored games that aren't in the API response
            storedGames.forEach(storedGame => {
                if (!allCompletedGames.some(g => g.id === storedGame.id)) {
                    allCompletedGames.push(storedGame);
                }
            });
            
            // Sort completed games by date, most recent first
            allCompletedGames.sort((a, b) => new Date(b.date) - new Date(a.date));
            
            // Live Games Section
            const liveGamesContainer = document.getElementById('live-games');
            if (data.games.live.length > 0) {
                const gamesGrid = document.createElement('div');
                gamesGrid.className = 'games-grid';
                data.games.live.forEach(game => {
                    gamesGrid.appendChild(createGameCard(game));
                });
                liveGamesContainer.innerHTML = '';
                liveGamesContainer.appendChild(gamesGrid);
            } else {
                liveGamesContainer.innerHTML = '<div class="no-games">No live games at the moment</div>';
            }

            // Upcoming Games Section
            const upcomingGamesContainer = document.getElementById('upcoming-games');
            if (data.games.upcoming.length > 0) {
                const gamesGrid = document.createElement('div');
                gamesGrid.className = 'games-grid';
                data.games.upcoming.forEach(game => {
                    gamesGrid.appendChild(createGameCard(game));
                });
                upcomingGamesContainer.innerHTML = '';
                upcomingGamesContainer.appendChild(gamesGrid);
            } else {
                upcomingGamesContainer.innerHTML = '<div class="no-games">No upcoming games scheduled</div>';
            }

            // Completed Games Section
            const completedGamesContainer = document.getElementById('completed-games');
            if (allCompletedGames.length > 0) {
                const gamesGrid = document.createElement('div');
                gamesGrid.className = 'games-grid';
                allCompletedGames.forEach(game => {
                    gamesGrid.appendChild(createGameCard(game));
                });
                completedGamesContainer.innerHTML = '';
                completedGamesContainer.appendChild(gamesGrid);
            } else {
                completedGamesContainer.innerHTML = '<div class="no-games">No completed games</div>';
            }

            // Update tournament bracket with completed games from storage
            const bracketContainer = document.getElementById('tournament-bracket');
            if (data.rounds.length > 0) {
                // Merge stored completed games into rounds
                const rounds = data.rounds.map(round => {
                    const games = round.games.map(game => {
                        if (game.status.state === 'post') {
                            const storedGame = storedGames.find(g => g.id === game.id);
                            return storedGame || game;
                        }
                        return game;
                    });
                    return { ...round, games };
                });

                const bracketHTML = rounds.map(round => `
                    <div class="round">
                        <h4>${round.name}</h4>
                        <div class="games-grid">
                            ${round.games.map(game => createGameCard(game).outerHTML).join('')}
                        </div>
                    </div>
                `).join('');
                bracketContainer.innerHTML = bracketHTML;
            } else {
                bracketContainer.innerHTML = '<div class="no-games">Tournament bracket not available</div>';
            }
        })
        .catch(error => {
            console.error('Error loading tournament data:', error);
            
            // If API fails, show stored completed games
            const completedGamesContainer = document.getElementById('completed-games');
            const storedGames = getCompletedGames();
            
            if (storedGames.length > 0) {
                const gamesGrid = document.createElement('div');
                gamesGrid.className = 'games-grid';
                storedGames.forEach(game => {
                    gamesGrid.appendChild(createGameCard(game));
                });
                completedGamesContainer.innerHTML = '';
                completedGamesContainer.appendChild(gamesGrid);
            }
            
            ['live-games', 'upcoming-games', 'tournament-bracket'].forEach(id => {
                const container = document.getElementById(id);
                if (container) {
                    container.innerHTML = '<div class="error">Error loading tournament data. Please try again later.</div>';
                }
            });
        });
}

// Helper function to format odds
function formatOdds(odds) {
    if (!odds || typeof odds.moneyline !== 'number') return 'N/A';
    const ml = odds.moneyline;
    return ml > 0 ? `+${ml}` : ml.toString();
}

// Function to create game card
function createGameCard(game) {
    const card = document.createElement('div');
    card.className = 'game-card';
    if (game.status.state === 'in') {
        card.classList.add('live-game');
    }

    const header = document.createElement('div');
    header.className = 'game-header';
    header.innerHTML = `
        <div class="game-status">${formatGameStatus(game.status)}</div>
        <div class="game-time">${formatDate(game.date)}</div>
    `;

    const teams = document.createElement('div');
    teams.className = 'teams';

    // Home Team
    const homeTeam = document.createElement('div');
    homeTeam.className = `team home ${game.teams.home.winner ? 'winner' : ''}`;
    const homeOdds = game.teams.home.odds ? `<div class="team-odds">ML: ${formatOdds(game.teams.home.odds)}</div>` : '';
    homeTeam.innerHTML = `
        ${game.teams.home.logo ? `<img src="${game.teams.home.logo}" alt="${game.teams.home.name}" class="team-logo">` : ''}
        <div class="team-info">
            <div class="team-seed">${game.teams.home.seed || ''}</div>
            <div class="team-name">${game.teams.home.name}</div>
            <div class="team-score">${game.teams.home.score || ''}</div>
            ${homeOdds}
        </div>
    `;

    // Away Team
    const awayTeam = document.createElement('div');
    awayTeam.className = `team away ${game.teams.away.winner ? 'winner' : ''}`;
    const awayOdds = game.teams.away.odds ? `<div class="team-odds">ML: ${formatOdds(game.teams.away.odds)}</div>` : '';
    awayTeam.innerHTML = `
        ${game.teams.away.logo ? `<img src="${game.teams.away.logo}" alt="${game.teams.away.name}" class="team-logo">` : ''}
        <div class="team-info">
            <div class="team-seed">${game.teams.away.seed || ''}</div>
            <div class="team-name">${game.teams.away.name}</div>
            <div class="team-score">${game.teams.away.score || ''}</div>
            ${awayOdds}
        </div>
    `;

    teams.appendChild(awayTeam);
    teams.appendChild(homeTeam);
    
    card.appendChild(header);
    card.appendChild(teams);

    // Venue and broadcast info
    if (game.venue || (game.broadcasts && game.broadcasts.length > 0)) {
        const info = document.createElement('div');
        info.className = 'game-info';
        
        if (game.venue) {
            const venue = document.createElement('div');
            venue.className = 'venue';
            venue.textContent = `${game.venue.name}, ${game.venue.city}, ${game.venue.state}`;
            info.appendChild(venue);
        }

        if (game.broadcasts && game.broadcasts.length > 0) {
            const broadcast = document.createElement('div');
            broadcast.className = 'broadcast';
            broadcast.textContent = `Watch on: ${game.broadcasts.join(', ')}`;
            info.appendChild(broadcast);
        }

        card.appendChild(info);
    }

    // Add play-by-play section for live games
    if (game.status.state === 'in') {
        const playByPlay = document.createElement('div');
        playByPlay.className = 'play-by-play';
        playByPlay.innerHTML = '<div class="loading"></div>';
        card.appendChild(playByPlay);

        // Fetch initial play-by-play data
        loadPlayByPlay(game.id, playByPlay);
        
        // Store interval ID for cleanup
        const intervalId = setInterval(() => loadPlayByPlay(game.id, playByPlay), 30000);
        playByPlay.setAttribute('data-interval-id', intervalId);
    }

    return card;
}

async function loadPlayByPlay(gameId, container) {
    try {
        const response = await fetchWithRetry(API.playByPlay(gameId));
        
        if (!response || (!response.recentPlays && !response.scoring)) {
            throw new Error('No play-by-play data available');
        }
        
        const playsHTML = `
            <div class="play-by-play-content">
                ${response.recentPlays && response.recentPlays.length > 0 ? `
                    <div class="recent-plays">
                        <h4>Recent Plays</h4>
                        <div class="plays-list">
                            ${response.recentPlays.reverse().map(play => `
                                <div class="play ${play.team ? `team-${play.team.toLowerCase()}` : ''}">
                                    <div class="play-time">${play.period}Q ${play.clock}</div>
                                    <div class="play-text">${play.text}</div>
                                    ${play.scoreValue ? `<div class="play-score">+${play.scoreValue}</div>` : ''}
                                </div>
                            `).join('')}
                        </div>
                    </div>
                ` : ''}
                ${response.scoring && response.scoring.length > 0 ? `
                    <div class="scoring-plays">
                        <h4>Scoring Plays</h4>
                        <div class="plays-list">
                            ${response.scoring.reverse().map(play => `
                                <div class="play scoring ${play.team ? `team-${play.team.toLowerCase()}` : ''}">
                                    <div class="play-time">${play.period}Q ${play.clock}</div>
                                    <div class="play-text">${play.text}</div>
                                    <div class="play-score">+${play.scoreValue}</div>
                                </div>
                            `).join('')}
                        </div>
                    </div>
                ` : ''}
            </div>
        `;
        
        container.innerHTML = playsHTML || '<div class="no-plays">No play-by-play data available</div>';
    } catch (error) {
        console.error('Error loading play-by-play:', error);
        container.innerHTML = `<div class="error">Unable to load play-by-play updates</div>`;
        
        // If the error persists, stop trying to update after 3 failures
        const failCount = (container.getAttribute('data-fail-count') || 0) + 1;
        container.setAttribute('data-fail-count', failCount);
        
        if (failCount >= 3) {
            const intervalId = container.getAttribute('data-interval-id');
            if (intervalId) {
                clearInterval(parseInt(intervalId));
                container.removeAttribute('data-interval-id');
            }
        }
    }
}

// Fetch and display NCAA rankings
async function loadNCAARankings() {
    const elementId = 'ncaa-rankings';
    showLoading(elementId);

    try {
        const response = await fetch(API.rankings);
        const rankings = await response.json();

        const rankingsHTML = `
            <div class="rankings-list">
                ${rankings.map(team => `
                    <div class="ranking-item">
                        <div class="rank">${team.rank}</div>
                        <div class="team-info">
                            ${team.team.logo ? `<img src="${team.team.logo}" alt="${team.team.name}" class="team-logo">` : ''}
                            <div class="team-details">
                                <span class="team-name">${team.team.name}</span>
                                <span class="team-record">${team.record}</span>
                            </div>
                        </div>
                        <div class="rank-change ${team.rank < team.previousRank ? 'up' : team.rank > team.previousRank ? 'down' : ''}">
                            ${team.rank === team.previousRank ? '-' : team.rank < team.previousRank ? '▲' : '▼'}
                        </div>
                    </div>
                `).join('')}
            </div>
        `;

        document.getElementById(elementId).innerHTML = rankingsHTML;
    } catch (error) {
        console.error('Error loading rankings:', error);
        showError(elementId, 'Failed to load NCAA rankings');
    }
}

// Initialize when the DOM is loaded
document.addEventListener('DOMContentLoaded', initApp); 