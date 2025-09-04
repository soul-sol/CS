const admin = require('firebase-admin');
const path = require('path');

// Firebase Admin SDK 초기화
const serviceAccount = require('../firebase-service-account.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: "https://cs-homepage-5c3c2-default-rtdb.firebaseio.com"
});

const db = admin.database();

async function removeUndefinedMember() {
  console.log('🔧 undefined 멤버 제거 시작...\n');
  
  try {
    const membersRef = db.ref('members');
    const snapshot = await membersRef.once('value');
    const members = snapshot.val() || {};
    
    console.log('현재 멤버 수:', Object.keys(members).length);
    
    // undefined 멤버 찾기 및 제거
    let removedCount = 0;
    for (const [key, member] of Object.entries(members)) {
      if (key === 'undefined' || !member.name || member.name === 'undefined') {
        console.log(`❌ 제거: ${key} - ${member.name || 'undefined'}`);
        await membersRef.child(key).remove();
        removedCount++;
      }
    }
    
    if (removedCount > 0) {
      console.log(`\n✅ ${removedCount}개의 잘못된 멤버 데이터를 제거했습니다.`);
    } else {
      console.log('\n✅ 제거할 잘못된 멤버가 없습니다.');
    }
    
    // 최종 멤버 수 확인
    const finalSnapshot = await membersRef.once('value');
    const finalMembers = finalSnapshot.val() || {};
    console.log('최종 멤버 수:', Object.keys(finalMembers).length);
    
  } catch (error) {
    console.error('❌ 오류 발생:', error);
  }
  
  process.exit(0);
}

removeUndefinedMember();
