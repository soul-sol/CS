const admin = require('firebase-admin');
const axios = require('axios');

// 환경 변수 설정
const PUBG_API_KEY = 'eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJqdGkiOiI4MjU3MDQyMC02OTQ4LTAxM2UtNDg5ZC00MjVkMGRiNDBlMGYiLCJpc3MiOiJnYW1lbG9ja2VyIiwiaWF0IjoxNzU2NzIwODcwLCJwdWIiOiJibHVlaG9sZSIsInRpdGxlIjoicHViZyIsImFwcCI6Ii00OTcwY2YwOS0zY2RkLTRlYTUtYjVjMy01MGVmY2VlNzExOTYifQ.JNUWXi2YT78qtXFkTHHiQtCaMIXqKTQRSWwRtimeI94';
const API_BASE_URL = 'https://api.pubg.com/shards/kakao';

// PUBG API 헤더
const headers = {
    'Authorization': `Bearer ${PUBG_API_KEY}`,
    'Accept': 'application/vnd.api+json'
};

// 현재 시즌 ID 가져오기
async function getCurrentSeason() {
    try {
        const response = await axios.get(
            `${API_BASE_URL}/seasons`,
            { headers }
        );
        
        const currentSeason = response.data.data.find(s => s.attributes.isCurrentSeason);
        if (currentSeason) {
            console.log(`Current season found: ${currentSeason.id}`);
            return currentSeason.id;
        }
        console.log('No current season found');
        return null;
    } catch (error) {
        console.error('Failed to get current season:', error.message);
        return null;
    }
}

// 플레이어 ID 가져오기
async function getPlayerId(playerName) {
    try {
        const response = await axios.get(
            `${API_BASE_URL}/players?filter[playerNames]=${encodeURIComponent(playerName)}`,
            { headers }
        );
        
        if (response.data.data && response.data.data.length > 0) {
            return response.data.data[0].id;
        }
        return null;
    } catch (error) {
        console.error(`Error fetching player ID for ${playerName}:`, error.message);
        return null;
    }
}

// 플레이어 통계 가져오기 (랭크 통계만)
async function getPlayerStats(playerId, playerName) {
    try {
        const currentSeasonId = await getCurrentSeason();
        if (!currentSeasonId) {
            console.log(`  No current season found for ${playerName}`);
            return null;
        }
        
        const response = await axios.get(
            `${API_BASE_URL}/players/${playerId}/seasons/${currentSeasonId}/ranked`,
            { headers }
        );
        
        const rankedStats = response.data.data.attributes.rankedGameModeStats;
        const squadRanked = rankedStats?.squad || {};
        
        if (!squadRanked.roundsPlayed || squadRanked.roundsPlayed === 0) {
            console.log(`  No ranked games played for ${playerName}`);
            return null;
        }
        
        // 티어 정보 추출
        let tier = null;
        let subTier = null;
        if (squadRanked.currentTier) {
            tier = squadRanked.currentTier.tier;
            subTier = squadRanked.currentTier.subTier;
        }
        
        // 평균 데미지 계산
        const avgDamage = squadRanked.damageDealt && squadRanked.roundsPlayed ? 
            Math.round(squadRanked.damageDealt / squadRanked.roundsPlayed) : 0;
        
        // K/D 계산
        const kd = squadRanked.deaths > 0 ? 
            (squadRanked.kills / squadRanked.deaths) : 0;
        
        console.log(`\n📊 ${playerName} Ranked Stats:`);
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log(`🎖️  Tier: ${tier} ${subTier}`);
        console.log(`📈 Current RP: ${squadRanked.currentRankPoint}`);
        console.log(`⚔️  KDA: ${squadRanked.kda?.toFixed(2) || '0.00'}`);
        console.log(`🎯 K/D: ${kd.toFixed(2)}`);
        console.log(`💥 Avg DMG: ${avgDamage}`);
        console.log(`🎮 Games: ${squadRanked.roundsPlayed}`);
        console.log(`🏆 Wins: ${squadRanked.wins} (${(squadRanked.winRatio * 100).toFixed(2)}%)`);
        console.log(`📊 Stats: ${squadRanked.kills}K / ${squadRanked.assists}A / ${squadRanked.deaths}D`);
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        
        return {
            tier: tier,
            subTier: subTier,
            kda: squadRanked.kda?.toFixed(2) || '0.00',
            kd: kd.toFixed(2),
            avgDamage: avgDamage,
            kills: squadRanked.kills || 0,
            assists: squadRanked.assists || 0,
            deaths: squadRanked.deaths || 0,
            roundsPlayed: squadRanked.roundsPlayed || 0,
            wins: squadRanked.wins || 0,
            winRate: squadRanked.winRatio ? (squadRanked.winRatio * 100).toFixed(2) : '0.00'
        };
    } catch (error) {
        console.error(`Error fetching stats for ${playerName}:`, error.message);
        return null;
    }
}

// 테스트 실행
async function testRankedOnly() {
    console.log('=================================');
    console.log('Testing Ranked-Only Stats Collection');
    console.log('=================================\n');
    
    const testPlayers = ['CS_COSMOS', 'CS_WEATHER', 'CS_balssa'];
    
    for (const playerName of testPlayers) {
        const playerId = await getPlayerId(playerName);
        if (playerId) {
            await getPlayerStats(playerId, playerName);
        } else {
            console.log(`❌ Could not find player: ${playerName}`);
        }
        
        // Rate limit 대기
        await new Promise(resolve => setTimeout(resolve, 2000));
    }
}

testRankedOnly();

