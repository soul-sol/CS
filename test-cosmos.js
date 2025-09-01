const fetch = require('node-fetch');

const API_KEY = 'eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJqdGkiOiJmOGY3MzE2MC1hMGY2LTAxM2QtNDU0Zi0xMmU1NjE0MmFkOGQiLCJpc3MiOiJnYW1lbG9ja2VyIiwiaWF0IjoxNzM0NjgxNzAyLCJwdWIiOiJibHVlaG9sZSIsInRpdGxlIjoicHViZyIsImFwcCI6ImJhdHRsZWdyb3VuZC1jIn0.K2KJxFYfX1HXI5bX8vz8nEUhI7kOoYwqyTQ0EQvEjDI';
const API_BASE_URL = 'https://api.pubg.com/shards/kakao';

async function testPlayer(playerName) {
    console.log(`\n========== Testing player: ${playerName} ==========\n`);
    
    try {
        // 1. 플레이어 검색
        console.log('1. Searching for player...');
        const searchResponse = await fetch(
            `${API_BASE_URL}/players?filter[playerNames]=${playerName}`,
            {
                headers: {
                    'Authorization': `Bearer ${API_KEY}`,
                    'Accept': 'application/vnd.api+json'
                }
            }
        );
        
        if (!searchResponse.ok) {
            console.log('Player search failed:', searchResponse.status);
            return;
        }
        
        const searchData = await searchResponse.json();
        
        if (!searchData.data || searchData.data.length === 0) {
            console.log('Player not found');
            return;
        }
        
        const player = searchData.data[0];
        console.log('Player found:', {
            id: player.id,
            name: player.attributes.name,
            shardId: player.attributes.shardId
        });
        
        // 2. 랭크 통계 시도
        console.log('\n2. Fetching ranked stats...');
        const currentSeasonId = 'division.bro.official.pc-2018-29';
        
        const rankedResponse = await fetch(
            `${API_BASE_URL}/players/${player.id}/seasons/${currentSeasonId}/ranked`,
            {
                headers: {
                    'Authorization': `Bearer ${API_KEY}`,
                    'Accept': 'application/vnd.api+json'
                }
            }
        );
        
        if (rankedResponse.ok) {
            const rankedData = await rankedResponse.json();
            if (rankedData.data && rankedData.data.attributes && rankedData.data.attributes.rankedGameModeStats) {
                const rankedStats = rankedData.data.attributes.rankedGameModeStats;
                console.log('Ranked stats available!');
                
                // 스쿼드 랭크 통계
                const squadRanked = rankedStats['squad-fpp'] || rankedStats['squad'] || {};
                if (squadRanked.roundsPlayed > 0) {
                    console.log('Squad Ranked Stats:', {
                        rounds: squadRanked.roundsPlayed,
                        kills: squadRanked.kills,
                        deaths: squadRanked.deaths,
                        damage: squadRanked.damageDealt,
                        kd: squadRanked.kills && squadRanked.deaths ? (squadRanked.kills / squadRanked.deaths).toFixed(2) : '0.00',
                        avgDamage: Math.round(squadRanked.damageDealt / squadRanked.roundsPlayed)
                    });
                }
            }
        } else {
            console.log('No ranked stats (Status:', rankedResponse.status + ')');
        }
        
        // 3. 일반 시즌 통계
        console.log('\n3. Fetching season stats...');
        const seasonResponse = await fetch(
            `${API_BASE_URL}/players/${player.id}/seasons/${currentSeasonId}`,
            {
                headers: {
                    'Authorization': `Bearer ${API_KEY}`,
                    'Accept': 'application/vnd.api+json'
                }
            }
        );
        
        if (seasonResponse.ok) {
            const seasonData = await seasonResponse.json();
            const stats = seasonData.data.attributes.gameModeStats;
            
            // 각 모드별 통계 확인
            const modes = ['squad-fpp', 'squad', 'duo-fpp', 'duo', 'solo-fpp', 'solo'];
            
            for (const mode of modes) {
                if (stats[mode] && stats[mode].roundsPlayed > 0) {
                    const modeStats = stats[mode];
                    console.log(`\n${mode.toUpperCase()} Stats:`, {
                        rounds: modeStats.roundsPlayed,
                        kills: modeStats.kills,
                        deaths: modeStats.deaths || modeStats.losses,
                        damage: modeStats.damageDealt,
                        kd: modeStats.kills && (modeStats.deaths || modeStats.losses) ? 
                            (modeStats.kills / (modeStats.deaths || modeStats.losses)).toFixed(2) : '0.00',
                        avgDamage: Math.round(modeStats.damageDealt / modeStats.roundsPlayed)
                    });
                }
            }
        } else {
            console.log('No season stats (Status:', seasonResponse.status + ')');
            
            // 4. Lifetime 통계 시도
            console.log('\n4. Fetching lifetime stats...');
            const lifetimeResponse = await fetch(
                `${API_BASE_URL}/players/${player.id}/seasons/lifetime`,
                {
                    headers: {
                        'Authorization': `Bearer ${API_KEY}`,
                        'Accept': 'application/vnd.api+json'
                    }
                }
            );
            
            if (lifetimeResponse.ok) {
                const lifetimeData = await lifetimeResponse.json();
                const stats = lifetimeData.data.attributes.gameModeStats;
                
                const squadStats = stats['squad-fpp'] || stats['squad'] || {};
                if (squadStats.roundsPlayed > 0) {
                    console.log('Lifetime Squad Stats:', {
                        rounds: squadStats.roundsPlayed,
                        kills: squadStats.kills,
                        deaths: squadStats.deaths || squadStats.losses,
                        damage: squadStats.damageDealt,
                        kd: squadStats.kills && (squadStats.deaths || squadStats.losses) ? 
                            (squadStats.kills / (squadStats.deaths || squadStats.losses)).toFixed(2) : '0.00',
                        avgDamage: Math.round(squadStats.damageDealt / squadStats.roundsPlayed)
                    });
                }
            }
        }
        
    } catch (error) {
        console.error('Error:', error.message);
    }
}

// CS_COSMOS 테스트
testPlayer('CS_COSMOS');
