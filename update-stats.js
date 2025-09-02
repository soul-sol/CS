#!/usr/bin/env node

/**
 * PUBG 클랜 멤버 스탯 자동 업데이트 스크립트
 * 매일 실행하여 모든 멤버의 최신 통계를 Firebase에 업데이트합니다.
 */

const fetch = require('node-fetch');

// PUBG API 설정
const API_KEY = 'eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJqdGkiOiI4MjU3MDQyMC02OTQ4LTAxM2UtNDg5ZC00MjVkMGRiNDBlMGYiLCJpc3MiOiJnYW1lbG9ja2VyIiwiaWF0IjoxNzU2NzIwODcwLCJwdWIiOiJibHVlaG9sZSIsInRpdGxlIjoicHViZyIsImFwcCI6Ii00OTcwY2YwOS0zY2RkLTRlYTUtYjVjMy01MGVmY2VlNzExOTYifQ.JNUWXi2YT78qtXFkTHHiQtCaMIXqKTQRSWwRtimeI94';
const API_BASE_URL = 'https://api.pubg.com/shards/kakao';

// Firebase 설정 (Firebase Admin SDK 사용)
const admin = require('firebase-admin');

// Firebase 서비스 계정 키 (Firebase Console에서 다운로드)
// 프로젝트 설정 > 서비스 계정 > 새 비공개 키 생성
const serviceAccount = require('./firebase-service-account.json');

// Firebase 초기화
admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    databaseURL: 'https://cs-homepage-5c3c2-default-rtdb.asia-southeast1.firebasedatabase.app'
});

const db = admin.database();

// 통계 추출 함수
function extractStats(modeStats) {
    return {
        wins: modeStats.wins || 0,
        kills: modeStats.kills || 0,
        assists: modeStats.assists || 0,
        damageDealt: Math.round(modeStats.damageDealt || 0),
        roundsPlayed: modeStats.roundsPlayed || 0,
        top10s: modeStats.top10s || 0,
        longestKill: Math.round(modeStats.longestKill || 0),
        headshotKills: modeStats.headshotKills || 0,
        avgDamage: modeStats.roundsPlayed > 0 ? 
            Math.round((modeStats.damageDealt || 0) / modeStats.roundsPlayed) : 0,
        avgKills: modeStats.roundsPlayed > 0 ? 
            ((modeStats.kills || 0) / modeStats.roundsPlayed).toFixed(2) : '0.00',
        kd: modeStats.roundsPlayed > 0 ? 
            ((modeStats.kills || 0) / modeStats.roundsPlayed).toFixed(2) : '0.00',
        winRate: modeStats.roundsPlayed > 0 ? 
            ((modeStats.wins || 0) / modeStats.roundsPlayed * 100).toFixed(1) : '0.0'
    };
}

// 현재 시즌 ID 가져오기
async function getCurrentSeasonId() {
    try {
        const response = await fetch(
            `${API_BASE_URL}/seasons`,
            {
                headers: {
                    'Authorization': `Bearer ${API_KEY}`,
                    'Accept': 'application/vnd.api+json'
                }
            }
        );
        
        if (!response.ok) return null;
        
        const data = await response.json();
        const currentSeason = data.data.find(s => s.attributes.isCurrentSeason);
        return currentSeason ? currentSeason.id : null;
    } catch (error) {
        console.error('시즌 정보 가져오기 실패:', error.message);
        return null;
    }
}

// 플레이어 통계 가져오기
async function fetchPlayerStats(playerId, playerName) {
    try {
        console.log(`  📊 ${playerName}의 통계 가져오는 중...`);
        
        // 현재 시즌 ID 가져오기
        const seasonId = await getCurrentSeasonId();
        if (!seasonId) {
            console.log(`  ⚠️  현재 시즌 정보를 가져올 수 없습니다`);
            return null;
        }
        
        // Ranked 통계 먼저 시도
        const rankedResponse = await fetch(
            `${API_BASE_URL}/players/${playerId}/seasons/${seasonId}/ranked`,
            {
                headers: {
                    'Authorization': `Bearer ${API_KEY}`,
                    'Accept': 'application/vnd.api+json'
                }
            }
        );
        
        if (rankedResponse.ok) {
            // Ranked 통계가 있는 경우
            const rankedData = await rankedResponse.json();
            const squadRanked = rankedData.data.attributes.rankedGameModeStats?.squad || {};
            
            // 티어 정보
            let tier = null;
            if (squadRanked.currentTier) {
                tier = `${squadRanked.currentTier.tier}-${squadRanked.currentTier.subTier}`;
            }
            
            // 평균 데미지 계산
            const avgDamage = squadRanked.roundsPlayed > 0 ? 
                Math.round(squadRanked.damageDealt / squadRanked.roundsPlayed) : 0;
            
            return {
                // Ranked 통계
                tier: tier,
                kda: squadRanked.kda ? squadRanked.kda.toFixed(1) : '0.0',
                kills: squadRanked.kills || 0,
                deaths: squadRanked.deaths || 0,
                assists: squadRanked.assists || 0,
                avgDamage: avgDamage,  // 평균 데미지
                damageDealt: Math.round(squadRanked.damageDealt || 0),
                roundsPlayed: squadRanked.roundsPlayed || 0,
                wins: squadRanked.wins || 0,
                winRatio: squadRanked.winRatio ? (squadRanked.winRatio * 100).toFixed(1) : '0.0',
                top10Ratio: squadRanked.top10Ratio ? (squadRanked.top10Ratio * 100).toFixed(1) : '0.0',
                avgRank: squadRanked.avgRank ? squadRanked.avgRank.toFixed(1) : '0.0',
                dBNOs: squadRanked.dBNOs || 0,  // 다운시킨 수
                currentRankPoint: squadRanked.currentRankPoint || 0,
                bestTier: squadRanked.bestTier ? `${squadRanked.bestTier.tier}-${squadRanked.bestTier.subTier}` : null,
                isRanked: true
            };
        }
        
        // Ranked 통계가 없으면 일반 시즌 통계 사용
        console.log(`  ℹ️  ${playerName}의 Ranked 통계가 없어 일반 통계를 사용합니다`);
        
        const normalResponse = await fetch(
            `${API_BASE_URL}/players/${playerId}/seasons/${seasonId}`,
            {
                headers: {
                    'Authorization': `Bearer ${API_KEY}`,
                    'Accept': 'application/vnd.api+json'
                }
            }
        );
        
        if (!normalResponse.ok) {
            console.log(`  ⚠️  ${playerName}의 통계를 가져올 수 없습니다 (${normalResponse.status})`);
            return null;
        }
        
        const normalData = await normalResponse.json();
        const stats = normalData.data.attributes.gameModeStats;
        const squadStats = stats['squad'] || stats['squad-fpp'] || {};
        
        // KDA 계산 (kills + assists / deaths)
        const deaths = squadStats.losses || (squadStats.roundsPlayed - squadStats.wins) || 1;
        const kda = deaths > 0 ? 
            ((squadStats.kills + squadStats.assists) / deaths).toFixed(1) : 
            squadStats.kills.toFixed(1);
        
        // 평균 데미지 계산
        const avgDamage = squadStats.roundsPlayed > 0 ? 
            Math.round(squadStats.damageDealt / squadStats.roundsPlayed) : 0;
        
        return {
            // 일반 통계
            tier: null,
            kda: kda,
            kills: squadStats.kills || 0,
            deaths: deaths,
            assists: squadStats.assists || 0,
            avgDamage: avgDamage,  // 평균 데미지
            damageDealt: Math.round(squadStats.damageDealt || 0),
            roundsPlayed: squadStats.roundsPlayed || 0,
            wins: squadStats.wins || 0,
            winRatio: squadStats.roundsPlayed > 0 ? 
                ((squadStats.wins / squadStats.roundsPlayed) * 100).toFixed(1) : '0.0',
            top10Ratio: squadStats.roundsPlayed > 0 ? 
                ((squadStats.top10s / squadStats.roundsPlayed) * 100).toFixed(1) : '0.0',
            dBNOs: squadStats.dBNOs || 0,  // 다운시킨 수
            isRanked: false
        };
        
    } catch (error) {
        console.error(`  ❌ ${playerName} 통계 가져오기 실패:`, error.message);
        return null;
    }
}

// 모든 멤버 업데이트
async function updateAllMembers() {
    console.log('🚀 PUBG 클랜 멤버 스탯 업데이트 시작...');
    console.log('⏰ 시작 시간:', new Date().toLocaleString('ko-KR'));
    console.log('');
    
    try {
        // Firebase에서 모든 멤버 가져오기
        const snapshot = await db.ref('members').once('value');
        const members = snapshot.val();
        
        if (!members) {
            console.log('❌ 등록된 멤버가 없습니다.');
            return;
        }
        
        const memberIds = Object.keys(members);
        console.log(`📋 총 ${memberIds.length}명의 멤버를 업데이트합니다.\n`);
        
        let successCount = 0;
        let failCount = 0;
        const updates = {};
        
        // 각 멤버의 통계 업데이트
        for (const memberId of memberIds) {
            const member = members[memberId];
            console.log(`👤 ${member.name} 업데이트 중...`);
            
            // API 호출 제한을 위한 딜레이 (2초로 증가)
            await new Promise(resolve => setTimeout(resolve, 2000));
            
            // 플레이어 통계 가져오기 (originalId 사용)
            const playerId = member.originalId || memberId;
            const stats = await fetchPlayerStats(playerId, member.name);
            
            if (stats) {
                // 업데이트할 데이터 준비
                updates[`members/${memberId}/stats`] = stats;
                updates[`members/${memberId}/lastStatsUpdate`] = new Date().toISOString();
                
                console.log(`  ✅ ${member.name} 업데이트 성공`);
                if (stats.tier) {
                    console.log(`     - 티어: ${stats.tier} | KDA: ${stats.kda} | 승률: ${stats.winRatio}% | 평균 데미지: ${stats.avgDamage}`);
                } else {
                    console.log(`     - KDA: ${stats.kda} | 승률: ${stats.winRatio}% | 평균 데미지: ${stats.avgDamage}`);
                }
                successCount++;
            } else {
                console.log(`  ⚠️  ${member.name} 업데이트 실패 (통계를 가져올 수 없음)`);
                failCount++;
            }
            
            console.log('');
        }
        
        // 배치 업데이트 실행
        if (Object.keys(updates).length > 0) {
            console.log('💾 Firebase에 업데이트 저장 중...');
            await db.ref().update(updates);
            console.log('✅ Firebase 업데이트 완료!\n');
        }
        
        // 결과 요약
        console.log('=' * 50);
        console.log('📊 업데이트 완료 요약');
        console.log('=' * 50);
        console.log(`✅ 성공: ${successCount}명`);
        console.log(`❌ 실패: ${failCount}명`);
        console.log(`⏰ 완료 시간: ${new Date().toLocaleString('ko-KR')}`);
        
        // 다음 업데이트 시간 기록
        await db.ref('lastUpdate').set({
            timestamp: new Date().toISOString(),
            successCount: successCount,
            failCount: failCount,
            totalMembers: memberIds.length
        });
        
    } catch (error) {
        console.error('❌ 업데이트 중 오류 발생:', error);
        process.exit(1);
    }
}

// 스크립트 실행
if (require.main === module) {
    updateAllMembers()
        .then(() => {
            console.log('\n✨ 모든 작업이 완료되었습니다!');
            process.exit(0);
        })
        .catch(error => {
            console.error('❌ 치명적 오류:', error);
            process.exit(1);
        });
}

module.exports = { updateAllMembers };
