// API endpoints for PWHL
const API = {
    games: '/api/pwhl/games',
    standings: '/api/pwhl/standings',
    news: '/api/pwhl/news'
};

// Helper function to format date
function formatDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });
}

// Helper function to format time
function formatTime(dateString) {
    const date = new Date(dateString);
    return date.toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true
    });
}

// Create game card
function createGameCard(game) {
    const gameCard = document.createElement('div');
    gameCard.className = 'game-card';
    
    // Format game time
    const gameTime = game.status.type === 'STATUS_SCHEDULED' 
        ? formatTime(game.date)
        : game.status.displayClock || 'Final';

    gameCard.innerHTML = `
        <div class="game-header">
            <div class="game-date">${formatDate(game.date)}</div>
            <div class="game-time">${gameTime}</div>
        </div>
        <div class="game-teams">
            <div class="team away ${game.teams.away.winner ? 'winner' : ''}">
                ${game.teams.away.logo ? `<img src="${game.teams.away.logo}" alt="${game.teams.away.name}" class="team-logo">` : ''}
                <div class="team-info">
                    <div class="team-name">${game.teams.away.name}</div>
                    <div class="team-record">${game.teams.away.records?.find(r => r.type === 'total')?.summary || ''}</div>
                    <div class="team-score">${game.teams.away.score || ''}</div>
                </div>
            </div>
            <div class="team home ${game.teams.home.winner ? 'winner' : ''}">
                ${game.teams.home.logo ? `<img src="${game.teams.home.logo}" alt="${game.teams.home.name}" class="team-logo">` : ''}
                <div class="team-info">
                    <div class="team-name">${game.teams.home.name}</div>
                    <div class="team-record">${game.teams.home.records?.find(r => r.type === 'total')?.summary || ''}</div>
                    <div class="team-score">${game.teams.home.score || ''}</div>
                </div>
            </div>
        </div>
        ${game.venue ? `
            <div class="game-venue">
                <span class="venue-name">${game.venue.name}</span>
                <span class="venue-location">${game.venue.city}, ${game.venue.state}</span>
            </div>
        ` : ''}
        ${game.broadcasts.length > 0 ? `
            <div class="game-broadcast">
                ${game.broadcasts.join(', ')}
            </div>
        ` : ''}
    `;

    return gameCard;
}

// Create standings row
function createStandingsRow(team) {
    const row = document.createElement('div');
    row.className = 'standings-row';
    row.innerHTML = `
        <div class="team-info">
            <span class="team-rank">${team.rank}</span>
            ${team.logo ? `<img src="${team.logo}" alt="${team.name}" class="team-logo">` : ''}
            <span class="team-name">${team.name}</span>
        </div>
        <div class="team-stats">
            <span class="games-played">${team.gamesPlayed}</span>
            <span class="wins">${team.wins}</span>
            <span class="losses">${team.losses}</span>
            <span class="overtime-losses">${team.overtimeLosses}</span>
            <span class="points">${team.points}</span>
        </div>
    `;
    return row;
}

// Create news article card
function createNewsCard(article) {
    const card = document.createElement('div');
    card.className = 'news-card';
    card.innerHTML = `
        ${article.image ? `<img src="${article.image}" alt="${article.title}" class="news-image">` : ''}
        <div class="news-content">
            <h3>${article.title}</h3>
            <p>${article.summary}</p>
            <div class="news-meta">
                <span class="news-date">${formatDate(article.date)}</span>
                <a href="${article.url}" target="_blank" class="read-more">Read More</a>
            </div>
        </div>
    `;
    return card;
}

// Load games data
function loadGamesData() {
    fetch(API.games)
        .then(response => response.json())
        .then(data => {
            const liveGames = document.getElementById('live-games');
            const upcomingGames = document.getElementById('upcoming-games');
            const completedGames = document.getElementById('completed-games');

            // Clear existing content
            liveGames.innerHTML = '';
            upcomingGames.innerHTML = '';
            completedGames.innerHTML = '';

            // Populate live games
            if (data.live.length > 0) {
                data.live.forEach(game => {
                    liveGames.appendChild(createGameCard(game));
                });
            } else {
                liveGames.innerHTML = '<p class="no-data">No live games at the moment</p>';
            }

            // Populate upcoming games
            if (data.upcoming.length > 0) {
                data.upcoming.forEach(game => {
                    upcomingGames.appendChild(createGameCard(game));
                });
            } else {
                upcomingGames.innerHTML = '<p class="no-data">No upcoming games scheduled</p>';
            }

            // Populate completed games
            if (data.completed.length > 0) {
                data.completed.forEach(game => {
                    completedGames.appendChild(createGameCard(game));
                });
            } else {
                completedGames.innerHTML = '<p class="no-data">No completed games</p>';
            }
        })
        .catch(error => {
            console.error('Error loading games:', error);
        });
}

// Load standings data
function loadStandingsData() {
    fetch(API.standings)
        .then(response => response.json())
        .then(data => {
            const standingsContainer = document.getElementById('pwhl-standings');
            standingsContainer.innerHTML = '';

            // Create standings header
            const header = document.createElement('div');
            header.className = 'standings-header';
            header.innerHTML = `
                <div class="team-info">Team</div>
                <div class="team-stats">
                    <span>GP</span>
                    <span>W</span>
                    <span>L</span>
                    <span>OTL</span>
                    <span>PTS</span>
                </div>
            `;
            standingsContainer.appendChild(header);

            // Add team rows
            data.forEach(team => {
                standingsContainer.appendChild(createStandingsRow(team));
            });
        })
        .catch(error => {
            console.error('Error loading standings:', error);
        });
}

// Load news data
function loadNewsData() {
    fetch(API.news)
        .then(response => response.json())
        .then(data => {
            const newsContainer = document.getElementById('pwhl-news');
            newsContainer.innerHTML = '';

            if (data.length > 0) {
                data.forEach(article => {
                    newsContainer.appendChild(createNewsCard(article));
                });
            } else {
                newsContainer.innerHTML = '<p class="no-data">No news articles available</p>';
            }
        })
        .catch(error => {
            console.error('Error loading news:', error);
        });
}

// Initialize the page
document.addEventListener('DOMContentLoaded', () => {
    loadGamesData();
    loadStandingsData();
    loadNewsData();
}); 