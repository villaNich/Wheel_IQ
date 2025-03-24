// Get game ID from URL parameters
const urlParams = new URLSearchParams(window.location.search);
const gameId = urlParams.get('id');

// Function to format date
function formatDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { 
        weekday: 'long',
        month: 'long',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        timeZoneName: 'short'
    });
}

// Function to format game status
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

// Function to load game details
async function loadGameDetails() {
    const gameDetailsContainer = document.getElementById('game-details');
    
    try {
        const response = await fetch(`/api/ncaaw/game/${gameId}`);
        if (!response.ok) throw new Error('Failed to fetch game details');
        
        const game = await response.json();
        
        // Create detailed game view
        const gameHTML = `
            <div class="game-details-card">
                <div class="game-header">
                    <div class="game-status">${formatGameStatus(game.status)}</div>
                    <div class="game-time">${formatDate(game.date)}</div>
                </div>
                
                <div class="teams">
                    <div class="team away ${game.teams.away.winner ? 'winner' : ''}">
                        ${game.teams.away.logo ? `<img src="${game.teams.away.logo}" alt="${game.teams.away.name}" class="team-logo">` : ''}
                        <div class="team-info">
                            <div class="team-seed">${game.teams.away.seed || ''}</div>
                            <div class="team-name">${game.teams.away.name}</div>
                            <div class="team-score">${game.teams.away.score || ''}</div>
                        </div>
                    </div>
                    
                    <div class="team home ${game.teams.home.winner ? 'winner' : ''}">
                        ${game.teams.home.logo ? `<img src="${game.teams.home.logo}" alt="${game.teams.home.name}" class="team-logo">` : ''}
                        <div class="team-info">
                            <div class="team-seed">${game.teams.home.seed || ''}</div>
                            <div class="team-name">${game.teams.home.name}</div>
                            <div class="team-score">${game.teams.home.score || ''}</div>
                        </div>
                    </div>
                </div>

                ${game.venue ? `
                    <div class="game-info">
                        <div class="venue">
                            <h4>Venue</h4>
                            <p>${game.venue.name}</p>
                            <p>${game.venue.city}, ${game.venue.state}</p>
                        </div>
                    </div>
                ` : ''}

                ${game.broadcasts && game.broadcasts.length > 0 ? `
                    <div class="game-info">
                        <div class="broadcast">
                            <h4>Broadcast</h4>
                            <p>${game.broadcasts.join(', ')}</p>
                        </div>
                    </div>
                ` : ''}

                ${game.status.state === 'in' ? `
                    <div class="play-by-play">
                        <h4>Live Updates</h4>
                        <div class="play-by-play-content">
                            <div class="loading">Loading play-by-play...</div>
                        </div>
                    </div>
                ` : ''}

                ${game.status.state === 'post' ? `
                    <div class="game-stats">
                        <h4>Game Statistics</h4>
                        <div class="stats-grid">
                            <div class="stat-item">
                                <span class="stat-label">Field Goals</span>
                                <span class="stat-value">${game.teams.home.stats?.fieldGoals || '0'}/${game.teams.home.stats?.fieldGoalAttempts || '0'}</span>
                                <span class="stat-value">${game.teams.away.stats?.fieldGoals || '0'}/${game.teams.away.stats?.fieldGoalAttempts || '0'}</span>
                            </div>
                            <div class="stat-item">
                                <span class="stat-label">3-Pointers</span>
                                <span class="stat-value">${game.teams.home.stats?.threePointers || '0'}/${game.teams.home.stats?.threePointAttempts || '0'}</span>
                                <span class="stat-value">${game.teams.away.stats?.threePointers || '0'}/${game.teams.away.stats?.threePointAttempts || '0'}</span>
                            </div>
                            <div class="stat-item">
                                <span class="stat-label">Free Throws</span>
                                <span class="stat-value">${game.teams.home.stats?.freeThrows || '0'}/${game.teams.home.stats?.freeThrowAttempts || '0'}</span>
                                <span class="stat-value">${game.teams.away.stats?.freeThrows || '0'}/${game.teams.away.stats?.freeThrowAttempts || '0'}</span>
                            </div>
                            <div class="stat-item">
                                <span class="stat-label">Rebounds</span>
                                <span class="stat-value">${game.teams.home.stats?.rebounds || '0'}</span>
                                <span class="stat-value">${game.teams.away.stats?.rebounds || '0'}</span>
                            </div>
                        </div>
                    </div>
                ` : ''}
            </div>
        `;

        gameDetailsContainer.innerHTML = gameHTML;

        // If game is live, load play-by-play
        if (game.status.state === 'in') {
            loadPlayByPlay();
        }
    } catch (error) {
        console.error('Error loading game details:', error);
        gameDetailsContainer.innerHTML = '<div class="error">Failed to load game details</div>';
    }
}

// Function to load play-by-play data
async function loadPlayByPlay() {
    const playByPlayContainer = document.querySelector('.play-by-play-content');
    
    try {
        const response = await fetch(`/api/ncaaw/game/${gameId}/playbyplay`);
        if (!response.ok) throw new Error('Failed to fetch play-by-play');
        
        const data = await response.json();
        
        if (data.recentPlays && data.recentPlays.length > 0) {
            playByPlayContainer.innerHTML = `
                <div class="plays-list">
                    ${data.recentPlays.reverse().map(play => `
                        <div class="play ${play.team ? `team-${play.team.toLowerCase()}` : ''}">
                            <div class="play-time">${play.period}Q ${play.clock}</div>
                            <div class="play-text">${play.text}</div>
                            ${play.scoreValue ? `<div class="play-score">+${play.scoreValue}</div>` : ''}
                        </div>
                    `).join('')}
                </div>
            `;
        } else {
            playByPlayContainer.innerHTML = '<div class="no-data">No play-by-play data available</div>';
        }
    } catch (error) {
        console.error('Error loading play-by-play:', error);
        playByPlayContainer.innerHTML = '<div class="error">Failed to load play-by-play updates</div>';
    }
}

// Load game details when page loads
document.addEventListener('DOMContentLoaded', () => {
    if (gameId) {
        loadGameDetails();
    } else {
        document.getElementById('game-details').innerHTML = '<div class="error">No game ID provided</div>';
    }
}); 