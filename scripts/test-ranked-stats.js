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
            console.log(`✅ Current season found: ${currentSeason.id}`);
            return currentSeason.id;
        }
        console.log('❌ No current season found');
        return null;
    } catch (error) {
        console.error('❌ Failed to get current season:', error.message);
        return null;
    }
}

// 랭크 통계 테스트
async function testRankedStats() {
    console.log('=================================');
    console.log('PUBG Ranked Stats Test');
    console.log('=================================\n');
    
    // 1. 현재 시즌 가져오기
    const seasonId = await getCurrentSeason();
    if (!seasonId) {
        console.log('Cannot proceed without season ID');
        return;
    }
    
    // 2. 테스트용 플레이어 ID (이미 알고 있는 ID 사용)
    const playerId = 'account.0deaffe230da419ab7d3fa4e85a7cbac';
    console.log(`\nTesting with player ID: ${playerId}`);
    
    // 3. 랭크 통계 가져오기
    try {
        console.log(`\nFetching ranked stats for season: ${seasonId}`);
        const response = await axios.get(
            `${API_BASE_URL}/players/${playerId}/seasons/${seasonId}/ranked`,
            { headers }
        );
        
        const rankedStats = response.data.data.attributes.rankedGameModeStats;
        
        if (rankedStats.squad) {
            const squad = rankedStats.squad;
            console.log('\n📊 Squad Ranked Stats:');
            console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
            
            // 티어 정보
            if (squad.currentTier) {
                console.log(`🎖️  Current Tier: ${squad.currentTier.tier} ${squad.currentTier.subTier}`);
                console.log(`📈 Current RP: ${squad.currentRankPoint}`);
            }
            
            if (squad.bestTier) {
                console.log(`🏆 Best Tier: ${squad.bestTier.tier} ${squad.bestTier.subTier}`);
                console.log(`⭐ Best RP: ${squad.bestRankPoint}`);
            }
            
            console.log('\n📊 Performance Stats:');
            console.log(`• Games Played: ${squad.roundsPlayed}`);
            console.log(`• KDA: ${squad.kda ? squad.kda.toFixed(2) : '0.00'}`);
            console.log(`• Kills: ${squad.kills}`);
            console.log(`• Deaths: ${squad.deaths}`);
            console.log(`• Assists: ${squad.assists}`);
            console.log(`• Total Damage: ${Math.round(squad.damageDealt)}`);
            console.log(`• Average Damage: ${squad.roundsPlayed > 0 ? Math.round(squad.damageDealt / squad.roundsPlayed) : 0}`);
            console.log(`• Average Rank: ${squad.avgRank ? squad.avgRank.toFixed(1) : 'N/A'}`);
            console.log(`• Win Rate: ${(squad.winRatio * 100).toFixed(2)}%`);
            console.log(`• Top 10 Rate: ${(squad.top10Ratio * 100).toFixed(2)}%`);
            console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        }
        
        if (rankedStats.duo) {
            const duo = rankedStats.duo;
            console.log('\n📊 Duo Ranked Stats:');
            console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
            
            if (duo.currentTier) {
                console.log(`🎖️  Current Tier: ${duo.currentTier.tier} ${duo.currentTier.subTier}`);
                console.log(`📈 Current RP: ${duo.currentRankPoint}`);
            }
            
            console.log(`• Games Played: ${duo.roundsPlayed}`);
            console.log(`• KDA: ${duo.kda ? duo.kda.toFixed(2) : '0.00'}`);
            console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        }
        
    } catch (error) {
        console.error('❌ Error fetching ranked stats:', error.message);
        if (error.response) {
            console.error('Response status:', error.response.status);
            console.error('Response data:', JSON.stringify(error.response.data, null, 2));
        }
    }
}

// 실행
testRankedStats();

