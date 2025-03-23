// API endpoints
const BASE_URL = window.location.hostname === 'localhost' 
    ? '' // Empty for local development
    : 'https://womens-march-madness.onrender.com'; // Replace with your Render URL

const API = {
    tournament: `${BASE_URL}/api/ncaaw/tournament`,
    rankings: `${BASE_URL}/api/ncaaw/rankings`,
    playByPlay: (gameId) => `${BASE_URL}/api/ncaaw/game/${gameId}/playbyplay`
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
        return status.type;
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
        const tweetsContainer = document.getElementById('news-section');
        if (!tweetsContainer) return;

        tweetsContainer.innerHTML = '<div class="loading"></div>';

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

        tweetsContainer.innerHTML = `
            <h2>March Madness Buzz</h2>
            <div class="tweets-container">
                ${tweetsList.outerHTML}
            </div>
        `;
    } catch (error) {
        console.error('Error loading tweets:', error);
        const tweetsContainer = document.getElementById('news-section');
        if (tweetsContainer) {
            tweetsContainer.innerHTML = '<div class="error">Failed to load tweets</div>';
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

// Update the fetch calls to use fetchWithRetry
function loadTournamentData() {
    fetchWithRetry(API.tournament)
        .then(data => {
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
            if (data.games.completed.length > 0) {
                const gamesGrid = document.createElement('div');
                gamesGrid.className = 'games-grid';
                data.games.completed.forEach(game => {
                    gamesGrid.appendChild(createGameCard(game));
                });
                completedGamesContainer.innerHTML = '';
                completedGamesContainer.appendChild(gamesGrid);
            } else {
                completedGamesContainer.innerHTML = '<div class="no-games">No completed games</div>';
            }

            // Also load the tournament bracket
            const bracketContainer = document.getElementById('tournament-bracket');
            if (data.rounds.length > 0) {
                const bracketHTML = data.rounds.map(round => `
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
            ['live-games', 'upcoming-games', 'completed-games', 'tournament-bracket'].forEach(id => {
                const container = document.getElementById(id);
                if (container) {
                    container.innerHTML = '<div class="error">Error loading tournament data. Please try again later.</div>';
                }
            });
        });
}

function createSection(title, games) {
    const section = document.createElement('div');
    section.className = 'games-section';
    
    const header = document.createElement('h2');
    header.textContent = title;
    section.appendChild(header);
    
    const gamesGrid = document.createElement('div');
    gamesGrid.className = 'games-grid';
    games.forEach(game => {
        gamesGrid.appendChild(createGameCard(game));
    });
    section.appendChild(gamesGrid);
    
    return section;
}

function createGameCard(game) {
    const card = document.createElement('div');
    card.className = 'game-card';
    if (game.status.state === 'in') {
        card.classList.add('live-game');
        card.setAttribute('data-game-id', game.id);
    }

    const header = document.createElement('div');
    header.className = 'game-header';
    header.innerHTML = `
        <div class="game-status">${formatGameStatus(game.status)}</div>
        <div class="game-date">${formatDate(game.date)}</div>
    `;
    card.appendChild(header);

    const teams = document.createElement('div');
    teams.className = 'teams';
    
    // Home Team
    const homeTeam = document.createElement('div');
    homeTeam.className = 'team home';
    homeTeam.innerHTML = `
        ${game.teams.home.logo ? `<img src="${game.teams.home.logo}" alt="${game.teams.home.name}" class="team-logo">` : ''}
        <div class="team-info">
            <div class="team-seed">${game.teams.home.seed || ''}</div>
            <div class="team-name">${game.teams.home.name}</div>
            <div class="team-score">${game.teams.home.score || ''}</div>
        </div>
    `;
    if (game.teams.home.winner) homeTeam.classList.add('winner');
    
    // Away Team
    const awayTeam = document.createElement('div');
    awayTeam.className = 'team away';
    awayTeam.innerHTML = `
        ${game.teams.away.logo ? `<img src="${game.teams.away.logo}" alt="${game.teams.away.name}" class="team-logo">` : ''}
        <div class="team-info">
            <div class="team-seed">${game.teams.away.seed || ''}</div>
            <div class="team-name">${game.teams.away.name}</div>
            <div class="team-score">${game.teams.away.score || ''}</div>
        </div>
    `;
    if (game.teams.away.winner) awayTeam.classList.add('winner');
    
    teams.appendChild(awayTeam);
    teams.appendChild(homeTeam);
    card.appendChild(teams);

    // Add play-by-play section for live games
    if (game.status.state === 'in') {
        const playByPlay = document.createElement('div');
        playByPlay.className = 'play-by-play';
        playByPlay.innerHTML = '<div class="loading"></div>';
        card.appendChild(playByPlay);
        
        // Fetch initial play-by-play data
        loadPlayByPlay(game.id, playByPlay);
        
        // Update play-by-play every 30 seconds for live games
        setInterval(() => loadPlayByPlay(game.id, playByPlay), 30000);
    }

    // Venue information
    if (game.venue) {
        const venue = document.createElement('div');
        venue.className = 'venue';
        venue.textContent = `${game.venue.name}, ${game.venue.city}, ${game.venue.state}`;
        card.appendChild(venue);
    }

    // Broadcast information
    if (game.broadcasts && game.broadcasts.length > 0) {
        const broadcast = document.createElement('div');
        broadcast.className = 'broadcast';
        broadcast.textContent = `Watch on: ${game.broadcasts.join(', ')}`;
        card.appendChild(broadcast);
    }

    return card;
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

// Function to load play-by-play data
async function loadPlayByPlay(gameId, container) {
    try {
        const response = await fetch(API.playByPlay(gameId));
        const data = await response.json();
        
        // Create play-by-play HTML
        const playsHTML = `
            <div class="play-by-play-content">
                <div class="recent-plays">
                    <h4>Recent Plays</h4>
                    <div class="plays-list">
                        ${data.recentPlays.reverse().map(play => `
                            <div class="play ${play.team ? `team-${play.team.toLowerCase()}` : ''}">
                                <div class="play-time">${play.period}Q ${play.clock}</div>
                                <div class="play-text">${play.text}</div>
                                ${play.scoreValue ? `<div class="play-score">+${play.scoreValue}</div>` : ''}
                            </div>
                        `).join('')}
                    </div>
                </div>
                <div class="scoring-plays">
                    <h4>Scoring Plays</h4>
                    <div class="plays-list">
                        ${data.scoring.reverse().map(play => `
                            <div class="play scoring ${play.team ? `team-${play.team.toLowerCase()}` : ''}">
                                <div class="play-time">${play.period}Q ${play.clock}</div>
                                <div class="play-text">${play.text}</div>
                                <div class="play-score">+${play.scoreValue}</div>
                            </div>
                        `).join('')}
                    </div>
                </div>
            </div>
        `;
        
        container.innerHTML = playsHTML;
    } catch (error) {
        console.error('Error loading play-by-play:', error);
        container.innerHTML = '<div class="error">Unable to load play-by-play updates</div>';
    }
}

// Initialize when the DOM is loaded
document.addEventListener('DOMContentLoaded', initApp); 