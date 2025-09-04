const admin = require('firebase-admin');
const axios = require('axios');

// 환경 변수 설정
// 새로운 API 키가 필요합니다. https://developer.pubg.com/에서 발급받으세요.
const PUBG_API_KEY = process.env.PUBG_API_KEY || 'YOUR_API_KEY_HERE';
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
const MIN_REQUEST_INTERVAL = 6000; // 6초 (분당 10개 요청)

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

// 플레이어 통계 가져오기
async function getPlayerStats(playerId) {
    try {
        await waitForRateLimit(); // Rate limit 대기
        const response = await axios.get(
            `${API_BASE_URL}/players/${playerId}/seasons/lifetime`,
            { headers }
        );
        
        const stats = response.data.data.attributes.gameModeStats;
        
        // 스쿼드 FPP 통계를 우선으로, 없으면 스쿼드 통계 사용
        const squadFpp = stats['squad-fpp'] || {};
        const squad = stats['squad'] || {};
        const soloFpp = stats['solo-fpp'] || {};
        const solo = stats['solo'] || {};
        
        // 가장 많이 플레이한 모드의 통계 사용
        const mainStats = [squadFpp, squad, soloFpp, solo].reduce((prev, current) => {
            return (current.roundsPlayed || 0) > (prev.roundsPlayed || 0) ? current : prev;
        }, {});
        
        return {
            kills: mainStats.kills || 0,
            deaths: mainStats.deaths || 0,
            kd: mainStats.deaths > 0 ? 
                (mainStats.kills / mainStats.deaths).toFixed(2) : 
                (mainStats.kills > 0 ? mainStats.kills.toFixed(2) : '0.00'),
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
            swimDistance: Math.round(mainStats.swimDistance || 0)
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
            const stats = await getPlayerStats(playerId);
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
            
            console.log(`✓ ${playerName}: KD ${stats.kd}, Avg Damage ${stats.avgDamage}`);
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
                avgDamage: data.stats.avgDamage,
                kills: data.stats.kills,
                wins: data.stats.wins,
                roundsPlayed: data.stats.roundsPlayed,
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
