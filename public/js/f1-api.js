// F1 API Configuration
const F1_API_BASE_URL = 'http://ergast.com/api/f1';

// Function to fetch current season schedule
async function getCurrentSeasonSchedule() {
    try {
        const response = await fetch('http://ergast.com/api/f1/2025.json');
        const data = await response.json();
        const races = data.MRData.RaceTable.Races;
        
        if (!races || races.length === 0) {
            return '2025 season schedule not yet available';
        }

        let scheduleHtml = '';
        races.forEach(race => {
            const date = new Date(race.date);
            const formattedDate = date.toLocaleDateString('en-US', {
                weekday: 'long',
                year: 'numeric',
                month: 'long',
                day: 'numeric'
            });
            scheduleHtml += `<p>${race.raceName} - ${formattedDate}</p>`;
        });
        return scheduleHtml;
    } catch (error) {
        console.error('Error fetching race schedule:', error);
        return 'Unable to load race schedule';
    }
}

// Function to fetch driver standings
async function getDriverStandings() {
    try {
        const response = await fetch('http://ergast.com/api/f1/2025/driverStandings.json');
        const data = await response.json();
        const standings = data.MRData.StandingsTable.StandingsLists[0]?.DriverStandings;
        
        if (!standings || standings.length === 0) {
            return '2025 driver standings not yet available';
        }

        let standingsHtml = '';
        standings.forEach(standing => {
            const driver = standing.Driver;
            standingsHtml += `<p>${standing.position}. ${driver.givenName} ${driver.familyName} - ${standing.points} points</p>`;
        });
        return standingsHtml;
    } catch (error) {
        console.error('Error fetching driver standings:', error);
        return 'Unable to load driver standings';
    }
}

// Function to fetch constructor standings
async function getConstructorStandings() {
    try {
        const response = await fetch('http://ergast.com/api/f1/2025/constructorStandings.json');
        const data = await response.json();
        const standings = data.MRData.StandingsTable.StandingsLists[0]?.ConstructorStandings;
        
        if (!standings || standings.length === 0) {
            return '2025 constructor standings not yet available';
        }

        let standingsHtml = '';
        standings.forEach(standing => {
            const constructor = standing.Constructor;
            standingsHtml += `<p>${standing.position}. ${constructor.name} - ${standing.points} points</p>`;
        });
        return standingsHtml;
    } catch (error) {
        console.error('Error fetching constructor standings:', error);
        return 'Unable to load constructor standings';
    }
}

// Function to fetch last race results
async function getLastRaceResults() {
    try {
        const response = await fetch('http://ergast.com/api/f1/2025/last/results.json');
        const data = await response.json();
        const race = data.MRData.RaceTable.Races[0];
        
        if (!race) {
            return 'No races completed in 2025 season yet';
        }

        const results = race.Results;
        let resultsHtml = `<h4>${race.raceName}</h4>`;
        results.forEach(result => {
            const driver = result.Driver;
            resultsHtml += `<p>${result.position}. ${driver.givenName} ${driver.familyName}</p>`;
        });
        return resultsHtml;
    } catch (error) {
        console.error('Error fetching last race results:', error);
        return 'Unable to load last race results';
    }
}

// Function to update the UI with race data
async function updateRaceData() {
    const scheduleElement = document.getElementById('race-schedule');
    const driverStandingsElement = document.getElementById('driver-standings');
    const constructorStandingsElement = document.getElementById('constructor-standings');
    const lastRaceResultsElement = document.getElementById('last-race-results');

    if (scheduleElement) {
        scheduleElement.innerHTML = await getCurrentSeasonSchedule();
    }
    if (driverStandingsElement) {
        driverStandingsElement.innerHTML = await getDriverStandings();
    }
    if (constructorStandingsElement) {
        constructorStandingsElement.innerHTML = await getConstructorStandings();
    }
    if (lastRaceResultsElement) {
        lastRaceResultsElement.innerHTML = await getLastRaceResults();
    }
}

// Update data every 5 minutes
setInterval(updateRaceData, 300000);

// Initial update when the page loads
document.addEventListener('DOMContentLoaded', updateRaceData); 