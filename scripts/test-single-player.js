const axios = require('axios');

// PUBG API 설정
const API_KEY = 'eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJqdGkiOiI4MjU3MDQyMC02OTQ4LTAxM2UtNDg5ZC00MjVkMGRiNDBlMGYiLCJpc3MiOiJnYW1lbG9ja2VyIiwiaWF0IjoxNzU2NzIwODcwLCJwdWIiOiJibHVlaG9sZSIsInRpdGxlIjoicHViZyIsImFwcCI6Ii00OTcwY2YwOS0zY2RkLTRlYTUtYjVjMy01MGVmY2VlNzExOTYifQ.JNUWXi2YT78qtXFkTHHiQtCaMIXqKTQRSWwRtimeI94';
const API_BASE_URL = 'https://api.pubg.com/shards/kakao';

const headers = {
    'Authorization': `Bearer ${API_KEY}`,
    'Accept': 'application/vnd.api+json'
};

async function testPlayer(playerName) {
    console.log(`\n========== Testing ${playerName} ==========\n`);
    
    try {
        // 1. 플레이어 ID 조회
        console.log('1. Getting player ID...');
        const playerResponse = await axios.get(
            `${API_BASE_URL}/players?filter[playerNames]=${encodeURIComponent(playerName)}`,
            { headers }
        );
        
        if (!playerResponse.data.data || playerResponse.data.data.length === 0) {
            console.log('Player not found');
            return;
        }
        
        const playerId = playerResponse.data.data[0].id;
        console.log(`   Player ID: ${playerId}`);
        
        // 2. Lifetime 통계 조회
        console.log('\n2. Getting lifetime stats...');
        const statsResponse = await axios.get(
            `${API_BASE_URL}/players/${playerId}/seasons/lifetime`,
            { headers }
        );
        
        const stats = statsResponse.data.data.attributes.gameModeStats;
        
        // 모든 모드 출력
        console.log('\n   All Game Modes:');
        for (const [mode, data] of Object.entries(stats)) {
            if (data && data.roundsPlayed > 0) {
                console.log(`   ${mode}: ${data.roundsPlayed} games, ${data.kills} kills, ${data.deaths} deaths, ${data.assists} assists`);
            }
        }
        
        // Squad 모드만 분석
        const squadTpp = stats['squad'] || {};
        const squadFpp = stats['squad-fpp'] || {};
        
        console.log('\n   Squad Analysis:');
        console.log(`   Squad TPP: ${squadTpp.roundsPlayed || 0} games, ${squadTpp.kills || 0} kills, ${squadTpp.losses || 0} losses`);
        console.log(`   Squad FPP: ${squadFpp.roundsPlayed || 0} games, ${squadFpp.kills || 0} kills, ${squadFpp.losses || 0} losses`);
        
        const totalKills = (squadTpp.kills || 0) + (squadFpp.kills || 0);
        const totalDeaths = (squadTpp.losses || 0) + (squadFpp.losses || 0);
        const totalAssists = (squadTpp.assists || 0) + (squadFpp.assists || 0);
        const totalGames = (squadTpp.roundsPlayed || 0) + (squadFpp.roundsPlayed || 0);
        const totalDamage = (squadTpp.damageDealt || 0) + (squadFpp.damageDealt || 0);
        
        console.log(`\n   Squad Total: ${totalGames} games, ${totalKills} kills, ${totalDeaths} deaths, ${totalAssists} assists`);
        
        const kd = totalDeaths > 0 ? (totalKills / totalDeaths).toFixed(2) : '0.00';
        const kda = totalGames > 0 ? ((totalKills + totalAssists) / totalGames).toFixed(2) : '0.00';
        const avgDamage = totalGames > 0 ? Math.round(totalDamage / totalGames) : 0;
        
        console.log(`\n   Calculated Stats:`);
        console.log(`   K/D: ${kd}`);
        console.log(`   KDA (per game): ${kda}`);
        console.log(`   Avg Damage: ${avgDamage}`);
        
        // 3. 현재 시즌 확인
        console.log('\n3. Getting current season...');
        const seasonsResponse = await axios.get(
            `${API_BASE_URL}/seasons`,
            { headers }
        );
        
        const currentSeason = seasonsResponse.data.data.find(s => s.attributes.isCurrentSeason);
        if (currentSeason) {
            console.log(`   Current Season ID: ${currentSeason.id}`);
            
            // 4. 랭크 통계
            console.log('\n4. Getting ranked stats...');
            try {
                const rankedResponse = await axios.get(
                    `${API_BASE_URL}/players/${playerId}/seasons/${currentSeason.id}/ranked`,
                    { headers }
                );
                
                const rankedStats = rankedResponse.data.data.attributes.rankedGameModeStats;
                const squadRanked = rankedStats?.squad || {};
                
                if (squadRanked.currentTier) {
                    console.log(`   Tier: ${squadRanked.currentTier.tier} ${squadRanked.currentTier.subTier}`);
                    console.log(`   Ranked Games: ${squadRanked.roundsPlayed || 0}`);
                    console.log(`   Ranked KDA: ${squadRanked.kda || 0}`);
                } else {
                    console.log('   No ranked data');
                }
            } catch (e) {
                console.log('   Error getting ranked stats:', e.message);
            }
        }
        
    } catch (error) {
        console.error('Error:', error.message);
        if (error.response) {
            console.error('Response status:', error.response.status);
            console.error('Response data:', JSON.stringify(error.response.data, null, 2));
        }
    }
}

// 테스트할 플레이어
const testPlayers = ['CS_COSMOS', 'CS_WEATHER', 'CS_balssa'];

async function runTests() {
    for (const player of testPlayers) {
        await testPlayer(player);
        // Rate limit 대기
        await new Promise(resolve => setTimeout(resolve, 6000));
    }
}

runTests();
