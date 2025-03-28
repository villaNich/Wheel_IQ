// Function to load live play-by-play data
async function loadLivePlayByPlay(gameId) {
    try {
        console.log('[Client] Fetching play-by-play for game:', gameId);
        const response = await fetch(`/api/ncaaw/game/${gameId}/playbyplay`);
        const data = await response.json();
        
        console.log('[Client] Play-by-play response:', {
            status: response.status,
            data: data
        });
        
        if (!response.ok) {
            console.error('[Client] Failed to fetch play-by-play data:', response.status, data);
            return `
                <div class="live-play-by-play">
                    <h3>Live Updates</h3>
                    <div class="plays-list">
                        <div class="play">
                            <div class="play-text">Game has not started yet. Play-by-play will be available once the game begins.</div>
                        </div>
                    </div>
                </div>
            `;
        }
        
        if (data.recentPlays && data.recentPlays.length > 0) {
            console.log('[Client] Rendering play-by-play with', data.recentPlays.length, 'plays');
            return `
                <div class="live-play-by-play">
                    <h3>Live Updates</h3>
                    <div class="plays-list">
                        ${data.recentPlays.map(play => `
                            <div class="play">
                                <div class="play-time">${play.period}Q ${play.clock}</div>
                                <div class="play-text">${play.text}</div>
                                ${play.scoreValue ? `<div class="play-score">+${play.scoreValue}</div>` : ''}
                            </div>
                        `).join('')}
                    </div>
                </div>
            `;
        } else {
            console.log('[Client] No recent plays found in the data');
            return `
                <div class="live-play-by-play">
                    <h3>Live Updates</h3>
                    <div class="plays-list">
                        <div class="play">
                            <div class="play-text">Game has not started yet. Play-by-play will be available once the game begins.</div>
                        </div>
                    </div>
                </div>
            `;
        }
    } catch (error) {
        console.error('[Client] Error loading play-by-play:', error);
        return `
            <div class="live-play-by-play">
                <h3>Live Updates</h3>
                <div class="plays-list">
                    <div class="play">
                        <div class="play-text">Unable to load play-by-play data. Please try again later.</div>
                    </div>
                </div>
            </div>
        `;
    }
}

// Function to create game card HTML
async function createGameCard(game) {
    console.log('[Client] Creating game card for:', {
        id: game.id,
        status: game.status.state,
        name: game.name,
        clock: game.status.clock
    });
    
    // Only show play-by-play for games that are actually in progress
    const isLive = game.status.state === 'in' && game.status.clock !== '0:00';
    console.log('[Client] Game live status:', isLive);
    
    const playByPlayHtml = isLive ? await loadLivePlayByPlay(game.id) : '';
    console.log('[Client] Play-by-play HTML:', playByPlayHtml ? 'Generated' : 'Empty');
    
    return `
        <div class="game-card">
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
            ${playByPlayHtml}
        </div>
    `;
}

// Function to load and display games
async function loadGames() {
    try {
        const response = await fetch('/api/ncaaw/tournament');
        if (!response.ok) throw new Error('Failed to fetch tournament data');
        
        const data = await response.json();
        
        // Update live games
        const liveGamesContainer = document.getElementById('live-games');
        if (data.games.live.length > 0) {
            const liveGamesHtml = await Promise.all(data.games.live.map(game => createGameCard(game)));
            liveGamesContainer.innerHTML = `
                <h2>Live Games</h2>
                <div class="games-grid">
                    ${liveGamesHtml.join('')}
                </div>
            `;
        } else {
            liveGamesContainer.innerHTML = '<div class="no-games-message">No live games at the moment</div>';
        }
        
        // Update upcoming games
        const upcomingGamesContainer = document.getElementById('upcoming-games');
        if (data.games.upcoming.length > 0) {
            const upcomingGamesHtml = await Promise.all(data.games.upcoming.map(game => createGameCard(game)));
            upcomingGamesContainer.innerHTML = `
                <h2>Upcoming Games</h2>
                <div class="games-grid">
                    ${upcomingGamesHtml.join('')}
                </div>
            `;
        } else {
            upcomingGamesContainer.innerHTML = '<div class="no-games-message">No upcoming games scheduled</div>';
        }
        
        // Update completed games
        const completedGamesContainer = document.getElementById('completed-games');
        if (data.games.completed.length > 0) {
            const completedGamesHtml = await Promise.all(data.games.completed.map(game => createGameCard(game)));
            completedGamesContainer.innerHTML = `
                <h2>Completed Games</h2>
                <div class="games-grid">
                    ${completedGamesHtml.join('')}
                </div>
            `;
        } else {
            completedGamesContainer.innerHTML = '<div class="no-games-message">No completed games to display</div>';
        }
        
        // Update last updated timestamp
        document.getElementById('last-updated').textContent = `Last updated: ${new Date().toLocaleTimeString()}`;
        
    } catch (error) {
        console.error('Error loading games:', error);
        document.getElementById('live-games').innerHTML = '<div class="error">Failed to load games</div>';
    }
} 