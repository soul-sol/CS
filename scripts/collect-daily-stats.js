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

// 플레이어 ID 가져오기
async function getPlayerId(playerName) {
    try {
        await waitForRateLimit(); // Rate limit 대기
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

// 현재 시즌 ID 가져오기
async function getCurrentSeason() {
    try {
        await waitForRateLimit();
        const response = await axios.get(
            `${API_BASE_URL}/seasons`,
            { headers }
        );
        
        const currentSeason = response.data.data.find(s => s.attributes.isCurrentSeason);
        return currentSeason ? currentSeason.id : null;
    } catch (error) {
        console.error('Failed to get current season:', error.message);
        return null;
    }
}

// 플레이어 통계 가져오기
async function getPlayerStats(playerId, playerName) {
    try {
        // 1. Lifetime 통계 가져오기
        await waitForRateLimit(); // Rate limit 대기
        const response = await axios.get(
            `${API_BASE_URL}/players/${playerId}/seasons/lifetime`,
            { headers }
        );
        
        const stats = response.data.data.attributes.gameModeStats;
        
        // Squad 모드만 수집 (TPP + FPP 합산)
        const squadTpp = stats['squad'] || {};
        const squadFpp = stats['squad-fpp'] || {};
        
        // 디버그: 원본 데이터 확인
        console.log(`  Squad TPP: ${squadTpp.roundsPlayed || 0} games, ${squadTpp.kills || 0} kills, ${squadTpp.deaths || 0} deaths`);
        console.log(`  Squad FPP: ${squadFpp.roundsPlayed || 0} games, ${squadFpp.kills || 0} kills, ${squadFpp.deaths || 0} deaths`);
        
        // Squad TPP와 FPP 통계 합산
        const mainStats = {
            kills: (squadTpp.kills || 0) + (squadFpp.kills || 0),
            deaths: (squadTpp.deaths || 0) + (squadFpp.deaths || 0),
            assists: (squadTpp.assists || 0) + (squadFpp.assists || 0),
            damageDealt: (squadTpp.damageDealt || 0) + (squadFpp.damageDealt || 0),
            roundsPlayed: (squadTpp.roundsPlayed || 0) + (squadFpp.roundsPlayed || 0),
            wins: (squadTpp.wins || 0) + (squadFpp.wins || 0),
            top10s: (squadTpp.top10s || 0) + (squadFpp.top10s || 0),
            headshotKills: (squadTpp.headshotKills || 0) + (squadFpp.headshotKills || 0),
            longestKill: Math.max(squadTpp.longestKill || 0, squadFpp.longestKill || 0),
            dBNOs: (squadTpp.dBNOs || 0) + (squadFpp.dBNOs || 0),
            revives: (squadTpp.revives || 0) + (squadFpp.revives || 0),
            teamKills: (squadTpp.teamKills || 0) + (squadFpp.teamKills || 0),
            timeSurvived: (squadTpp.timeSurvived || 0) + (squadFpp.timeSurvived || 0),
            walkDistance: (squadTpp.walkDistance || 0) + (squadFpp.walkDistance || 0),
            rideDistance: (squadTpp.rideDistance || 0) + (squadFpp.rideDistance || 0),
            swimDistance: (squadTpp.swimDistance || 0) + (squadFpp.swimDistance || 0)
        };
        
        // 2. 현재 시즌 랭크 통계 가져오기 (티어 정보)
        let tier = null;
        let rankedKda = '0.0';
        let rankedAvgDamage = 0;
        
        const currentSeasonId = await getCurrentSeason();
        if (currentSeasonId) {
            try {
                await waitForRateLimit();
                const rankedResponse = await axios.get(
                    `${API_BASE_URL}/players/${playerId}/seasons/${currentSeasonId}/ranked`,
                    { headers }
                );
                
                const rankedStats = rankedResponse.data.data.attributes.rankedGameModeStats;
                const squadRanked = rankedStats?.squad || {};
                
                if (squadRanked.roundsPlayed && squadRanked.roundsPlayed > 0) {
                    // 티어 정보 추출
                    if (squadRanked.currentTier) {
                        const tierName = squadRanked.currentTier.tier.charAt(0).toUpperCase() + 
                                       squadRanked.currentTier.tier.slice(1).toLowerCase();
                        tier = `${tierName} ${squadRanked.currentTier.subTier}`;
                    }
                    
                    rankedKda = squadRanked.kda ? squadRanked.kda.toFixed(2) : '0.0';
                    rankedAvgDamage = squadRanked.damageDealt && squadRanked.roundsPlayed ? 
                        Math.round(squadRanked.damageDealt / squadRanked.roundsPlayed) : 0;
                }
            } catch (rankedError) {
                console.log(`  Ranked stats not available for ${playerName}`);
            }
        }
        
        // 디버그: 합산된 통계 확인
        console.log(`  Total: ${mainStats.roundsPlayed} games, ${mainStats.kills} kills, ${mainStats.deaths} deaths, ${mainStats.assists} assists`);
        
        // K/D 계산 (kills / deaths)
        const kd = mainStats.deaths > 0 ? 
            (mainStats.kills || 0) / mainStats.deaths : 0;
        
        // KDA 계산 ((kills + assists) / roundsPlayed) - 게임당 평균 기여도
        const kda = mainStats.roundsPlayed > 0 ? 
            ((mainStats.kills || 0) + (mainStats.assists || 0)) / mainStats.roundsPlayed : 0;
        
        console.log(`  Calculated: K/D=${kd.toFixed(2)}, KDA=${kda.toFixed(2)}`);
        
        return {
            // 일반 통계
            kills: mainStats.kills || 0,
            deaths: mainStats.deaths || 0,
            kd: kd.toFixed(2),
            kda: kda.toFixed(2),
            avgDamage: mainStats.damageDealt && mainStats.roundsPlayed ? 
                Math.round(mainStats.damageDealt / mainStats.roundsPlayed) : 0,
            wins: mainStats.wins || 0,
            top10s: mainStats.top10s || 0,
            roundsPlayed: mainStats.roundsPlayed || 0,
            winRate: mainStats.wins && mainStats.roundsPlayed ? 
                ((mainStats.wins / mainStats.roundsPlayed) * 100).toFixed(2) : '0.00',
            headshotKills: mainStats.headshotKills || 0,
            longestKill: Math.round(mainStats.longestKill || 0),
            assists: mainStats.assists || 0,
            dBNOs: mainStats.dBNOs || 0,
            revives: mainStats.revives || 0,
            teamKills: mainStats.teamKills || 0,
            timeSurvived: mainStats.timeSurvived || 0,
            walkDistance: Math.round(mainStats.walkDistance || 0),
            rideDistance: Math.round(mainStats.rideDistance || 0),
            swimDistance: Math.round(mainStats.swimDistance || 0),
            // 랭크 통계
            tier: tier,
            rankedKda: rankedKda,
            rankedAvgDamage: rankedAvgDamage
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
            
            // 플레이어 ID 가져오기 (waitForRateLimit이 내부에 포함됨)
            const playerId = await getPlayerId(playerName);
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
            
            console.log(`✓ ${playerName}: K/D ${stats.kd}, KDA ${stats.kda}, Avg Damage ${stats.avgDamage}, Tier: ${stats.tier || 'Unranked'}`);
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
                kd: data.stats.kd,
                kda: data.stats.kda,  // KDA 추가
                avgDamage: data.stats.avgDamage,
                kills: data.stats.kills,
                wins: data.stats.wins,
                roundsPlayed: data.stats.roundsPlayed,
                tier: data.stats.tier,  // 티어 정보 추가
                rankedKda: data.stats.rankedKda,  // 랭크 KDA 추가
                rankedAvgDamage: data.stats.rankedAvgDamage,  // 랭크 평균 데미지 추가
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
