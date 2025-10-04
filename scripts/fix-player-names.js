const admin = require('firebase-admin');

// Firebase Admin 초기화
const serviceAccount = require('./firebase-service-account.json');

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    databaseURL: "https://cs-homepage-5c3c2-default-rtdb.asia-southeast1.firebasedatabase.app"
});

const db = admin.database();

async function checkAndFixPlayers() {
    console.log('플레이어 이름 확인 및 수정 시작...\n');
    
    // 문제가 있는 플레이어들
    const problemPlayers = {
        'CS_RYEONG': 'CS_RYEONG',  // 404 에러 - 닉네임 변경 가능성
        'CS_METEOR': 'CS_METEOR',   // 404 에러 - 닉네임 변경 가능성
        'CS_PROTEEN': 'CS_PROTEEN', // 429 에러지만 확인 필요
        'CS_START': 'CS_START'       // 429 에러지만 확인 필요
    };
    
    try {
        // 현재 멤버 목록 가져오기
        const membersSnapshot = await db.ref('members').once('value');
        const members = membersSnapshot.val() || {};
        
        console.log(`총 ${Object.keys(members).length}명의 멤버 확인\n`);
        
        // 문제가 있는 플레이어 찾기
        for (const [memberKey, memberData] of Object.entries(members)) {
            if (problemPlayers[memberData.name]) {
                console.log(`발견: ${memberData.name}`);
                console.log(`  - Firebase Key: ${memberKey}`);
                console.log(`  - Status: ${memberData.status || 'online'}`);
                console.log(`  - Last Stats Update: ${memberData.lastStatsUpdate || 'Never'}`);
                
                // 만약 오프라인 상태가 아니라면 표시
                if (!memberData.status || memberData.status === 'online') {
                    console.log(`  ⚠️  온라인으로 표시되어 있지만 API에서 찾을 수 없음`);
                    
                    // 오프라인으로 변경할지 물어보기
                    console.log(`  → 임시로 'offline' 상태로 변경 권장`);
                }
                console.log('');
            }
        }
        
        // CS_RYEONG과 CS_METEOR를 오프라인으로 변경
        const updates = {};
        for (const [memberKey, memberData] of Object.entries(members)) {
            if (memberData.name === 'CS_RYEONG' || memberData.name === 'CS_METEOR') {
                updates[`members/${memberKey}/status`] = 'offline';
                updates[`members/${memberKey}/note`] = '플레이어를 찾을 수 없음 - 닉네임 변경 확인 필요';
                console.log(`✅ ${memberData.name}을(를) 오프라인으로 변경`);
            }
        }
        
        if (Object.keys(updates).length > 0) {
            await db.ref().update(updates);
            console.log('\n✅ Firebase 업데이트 완료');
        }
        
    } catch (error) {
        console.error('오류 발생:', error);
    }
    
    process.exit(0);
}

checkAndFixPlayers();

