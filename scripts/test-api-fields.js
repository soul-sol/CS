const axios = require('axios');

// 환경 변수 설정
const PUBG_API_KEY = 'eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJqdGkiOiI4MjU3MDQyMC02OTQ4LTAxM2UtNDg5ZC00MjVkMGRiNDBlMGYiLCJpc3MiOiJnYW1lbG9ja2VyIiwiaWF0IjoxNzU2NzIwODcwLCJwdWIiOiJibHVlaG9sZSIsInRpdGxlIjoicHViZyIsImFwcCI6Ii00OTcwY2YwOS0zY2RkLTRlYTUtYjVjMy01MGVmY2VlNzExOTYifQ.JNUWXi2YT78qtXFkTHHiQtCaMIXqKTQRSWwRtimeI94';
const API_BASE_URL = 'https://api.pubg.com/shards/kakao';

// PUBG API 헤더
const headers = {
    'Authorization': `Bearer ${PUBG_API_KEY}`,
    'Accept': 'application/vnd.api+json'
};

async function testApiFields() {
    try {
        const playerId = 'account.0deaffe230da419ab7d3fa4e85a7cbac';
        
        console.log('Fetching lifetime stats to check available fields...\n');
        
        const response = await axios.get(
            `${API_BASE_URL}/players/${playerId}/seasons/lifetime`,
            { headers }
        );
        
        const stats = response.data.data.attributes.gameModeStats;
        const squadTpp = stats['squad'] || {};
        
        console.log('Available fields in Squad TPP stats:');
        console.log('=====================================');
        
        // 모든 필드 출력
        Object.keys(squadTpp).forEach(key => {
            console.log(`• ${key}: ${squadTpp[key]}`);
        });
        
        console.log('\n\nImportant observations:');
        console.log('========================');
        console.log(`roundsPlayed: ${squadTpp.roundsPlayed}`);
        console.log(`wins: ${squadTpp.wins}`);
        console.log(`losses: ${squadTpp.losses}`);
        console.log(`kills: ${squadTpp.kills}`);
        
        // deaths 필드 확인
        if (squadTpp.deaths !== undefined) {
            console.log(`deaths: ${squadTpp.deaths} ✅ (deaths 필드 존재!)`);
        } else {
            console.log(`deaths: undefined ❌ (deaths 필드 없음)`);
        }
        
        console.log('\n\nCalculation check:');
        console.log('==================');
        console.log(`wins + losses = ${squadTpp.wins + squadTpp.losses}`);
        console.log(`roundsPlayed = ${squadTpp.roundsPlayed}`);
        console.log(`Match: ${(squadTpp.wins + squadTpp.losses) === squadTpp.roundsPlayed ? '✅' : '❌'}`);
        
    } catch (error) {
        console.error('Error:', error.message);
    }
}

testApiFields();

