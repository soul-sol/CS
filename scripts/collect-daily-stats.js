const admin = require('firebase-admin');
const axios = require('axios');

// 환경 변수 설정
const PUBG_API_KEY = process.env.PUBG_API_KEY || 'eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJqdGkiOiI4MjU3MDQyMC02OTQ4LTAxM2UtNDg5ZC00MjVkMGRiNDBlMGYiLCJpc3MiOiJnYW1lbG9ja2VyIiwiaWF0IjoxNzU2NzIwODcwLCJwdWIiOiJibHVlaG9sZSIsInRpdGxlIjoicHViZyIsImFwcCI6Ii00OTcwY2YwOS0zY2RkLTRlYTUtYjVjMy01MGVmY2VlNzExOTYifQ.JNUWXi2YT78qtXFkTHHiQtCaMIXqKTQRSWwRtimeI94';
const API_BASE_URL = 'https://api.pubg.com/shards/kakao';

// Firebase Admin 초기화
let serviceAccount;
if (process.env.FIREBASE_SERVICE_ACCOUNT) {
    serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
} else {
    // 로컬 테스트용
    try {
        serviceAccount = require('./firebase-service-account.json');
    } catch (error) {
        console.error('Firebase service account not found. Please set FIREBASE_SERVICE_ACCOUNT environment variable.');
        process.exit(1);
    }
}

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    databaseURL: "https://cs-homepage-5c3c2-default-rtdb.asia-southeast1.firebasedatabase.app"
});

const db = admin.database();

// PUBG API 헤더
const headers = {
    'Authorization': `Bearer ${PUBG_API_KEY}`,
    'Accept': 'application/vnd.api+json'
};

// Rate limiting을 위한 변수
let lastRequestTime = 0;
const MIN_REQUEST_INTERVAL = 10000; // 10초 (분당 6개 요청 - 더 안전한 간격)

// Rate limit을 고려한 대기 함수
async function waitForRateLimit() {
    const now = Date.now();
    const timeSinceLastRequest = now - lastRequestTime;
    if (timeSinceLastRequest < MIN_REQUEST_INTERVAL) {
        const waitTime = MIN_REQUEST_INTERVAL - timeSinceLastRequest;
        console.log(`Rate limit: waiting ${Math.ceil(waitTime/1000)} seconds...`);
        await new Promise(resolve => setTimeout(resolve, waitTime));
    }
    lastRequestTime = Date.now();
}

// 플레이어 ID 가져오기 (캐싱 지원)
async function getPlayerId(playerName, memberKey = null) {
    try {
        // memberKey가 있으면 먼저 캐시된 ID 확인
        if (memberKey) {
            const cachedIdSnapshot = await db.ref(`members/${memberKey}/playerId`).once('value');
            const cachedId = cachedIdSnapshot.val();
            if (cachedId) {
                console.log(`  Using cached player ID for ${playerName}`);
                return cachedId;
            }
        }
        
        // 캐시가 없으면 API 호출
        await waitForRateLimit(); // Rate limit 대기
        const response = await axios.get(
            `${API_BASE_URL}/players?filter[playerNames]=${encodeURIComponent(playerName)}`,
            { headers }
        );
        
        if (response.data.data && response.data.data.length > 0) {
            const playerId = response.data.data[0].id;
            
            // memberKey가 있으면 ID를 캐싱
            if (memberKey) {
                await db.ref(`members/${memberKey}/playerId`).set(playerId);
                console.log(`  Cached player ID for ${playerName}`);
            }
            
            return playerId;
        }
        return null;
    } catch (error) {
        console.error(`Error fetching player ID for ${playerName}:`, error.message);
        return null;
    }
}

// 현재 시즌 ID 가져오기
async function getCurrentSeason() {
    try {
        await waitForRateLimit();
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

// 플레이어 통계 가져오기 (랭크 통계만)
async function getPlayerStats(playerId, playerName) {
    try {
        const currentSeasonId = await getCurrentSeason();
        if (!currentSeasonId) {
            console.log(`  No current season found for ${playerName}`);
            return null;
        }
        
        await waitForRateLimit();
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
        
        console.log(`  ${playerName} Ranked Stats:`);
        console.log(`    Tier: ${tier} ${subTier}`);
        console.log(`    KDA: ${squadRanked.kda?.toFixed(2) || '0.00'}`);
        console.log(`    K/D: ${kd.toFixed(2)}`);
        console.log(`    Avg DMG: ${avgDamage}`);
        console.log(`    Games: ${squadRanked.roundsPlayed}`);
        
        return {
            // 랭크 통계만 저장
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
            winRate: squadRanked.winRatio ? (squadRanked.winRatio * 100).toFixed(2) : '0.00',
            top10Ratio: squadRanked.top10Ratio ? (squadRanked.top10Ratio * 100).toFixed(2) : '0.00',
            avgRank: squadRanked.avgRank?.toFixed(1) || '0.0',
            damageDealt: Math.round(squadRanked.damageDealt || 0),
            dBNOs: squadRanked.dBNOs || 0,
            headshotKills: squadRanked.headshotKills || 0,
            longestKill: Math.round(squadRanked.longestKill || 0),
            revives: squadRanked.revives || 0,
            heals: squadRanked.heals || 0,
            boosts: squadRanked.boosts || 0,
            currentRankPoint: squadRanked.currentRankPoint || 0,
            bestRankPoint: squadRanked.bestRankPoint || 0
        };
    } catch (error) {
        console.error(`Error fetching stats for player ID ${playerId}:`, error.message);
        return null;
    }
}

// 메인 함수
async function collectDailyStats() {
    console.log('Starting daily stats collection...');
    const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD 형식
    
    try {
        // 현재 멤버 목록 가져오기
        const membersSnapshot = await db.ref('members').once('value');
        const members = membersSnapshot.val() || {};
        
        console.log(`Found ${Object.keys(members).length} members`);
        
        const dailyStats = {};
        const errors = [];
        
        // 각 멤버의 통계 수집
        for (const [memberKey, memberData] of Object.entries(members)) {
            const playerName = memberData.name;
            console.log(`Processing ${playerName}...`);
            
            // 플레이어 ID 가져오기 (캐싱 지원, memberKey 전달)
            const playerId = await getPlayerId(playerName, memberKey);
            if (!playerId) {
                console.error(`Could not find player ID for ${playerName}`);
                errors.push(`${playerName}: Player not found`);
                continue;
            }
            
            // 통계 가져오기 (waitForRateLimit이 내부에 포함됨)
            const stats = await getPlayerStats(playerId, playerName);
            if (!stats) {
                console.error(`Could not fetch stats for ${playerName}`);
                errors.push(`${playerName}: Stats fetch failed`);
                continue;
            }
            
            // 통계 저장
            dailyStats[memberKey] = {
                name: playerName,
                playerId: playerId,
                stats: stats,
                timestamp: Date.now()
            };
            
            const tierDisplay = stats.tier ? `${stats.tier} ${stats.subTier}` : 'Unranked';
            console.log(`✓ ${playerName}: Tier: ${tierDisplay}, KDA: ${stats.kda}, K/D: ${stats.kd}, Avg DMG: ${stats.avgDamage}, Games: ${stats.roundsPlayed}`);
        }
        
        // Firebase에 저장
        // 1. 오늘 날짜의 스냅샷 저장
        await db.ref(`stats/daily/${today}`).set(dailyStats);
        console.log(`Saved daily snapshot for ${today}`);
        
        // 2. 각 멤버의 최신 통계 업데이트
        for (const [memberKey, data] of Object.entries(dailyStats)) {
            await db.ref(`members/${memberKey}/currentStats`).set(data.stats);
            
            // 3. 멤버별 히스토리에 추가 (최대 30일 보관)
            await db.ref(`stats/history/${memberKey}/${today}`).set({
                tier: data.stats.tier,
                subTier: data.stats.subTier,
                kda: data.stats.kda,
                kd: data.stats.kd,
                avgDamage: data.stats.avgDamage,
                kills: data.stats.kills,
                assists: data.stats.assists,
                deaths: data.stats.deaths,
                roundsPlayed: data.stats.roundsPlayed,
                wins: data.stats.wins,
                winRate: data.stats.winRate,
                top10Ratio: data.stats.top10Ratio,
                avgRank: data.stats.avgRank,
                currentRankPoint: data.stats.currentRankPoint,
                timestamp: data.timestamp
            });
        }
        
        // 4. 30일 이상 된 데이터 정리
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        const cutoffDate = thirtyDaysAgo.toISOString().split('T')[0];
        
        const historySnapshot = await db.ref('stats/history').once('value');
        const history = historySnapshot.val() || {};
        
        for (const memberKey of Object.keys(history)) {
            const memberHistory = history[memberKey] || {};
            for (const date of Object.keys(memberHistory)) {
                if (date < cutoffDate) {
                    await db.ref(`stats/history/${memberKey}/${date}`).remove();
                    console.log(`Removed old data: ${memberKey}/${date}`);
                }
            }
        }
        
        // 5. 수집 메타데이터 저장
        await db.ref('stats/metadata/lastCollection').set({
            date: today,
            timestamp: Date.now(),
            membersProcessed: Object.keys(dailyStats).length,
            errors: errors,
            success: true
        });
        
        console.log('=================================');
        console.log(`Stats collection completed!`);
        console.log(`Processed: ${Object.keys(dailyStats).length} members`);
        console.log(`Errors: ${errors.length}`);
        if (errors.length > 0) {
            console.log('Error details:', errors);
        }
        
    } catch (error) {
        console.error('Fatal error during stats collection:', error);
        
        // 에러 메타데이터 저장
        await db.ref('stats/metadata/lastCollection').set({
            date: today,
            timestamp: Date.now(),
            error: error.message,
            success: false
        });
        
        process.exit(1);
    }
    
    process.exit(0);
}

// 실행
collectDailyStats();
