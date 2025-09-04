// 로컬 테스트용 스크립트
// Firebase 서비스 계정 파일이 필요합니다: scripts/firebase-service-account.json

const fs = require('fs');
const path = require('path');

// 서비스 계정 파일 확인
const serviceAccountPath = path.join(__dirname, 'firebase-service-account.json');

if (!fs.existsSync(serviceAccountPath)) {
    console.error('⚠️  Firebase 서비스 계정 파일이 없습니다!');
    console.log('\n다음 단계를 따라주세요:');
    console.log('1. Firebase Console에서 프로젝트 설정으로 이동');
    console.log('2. 서비스 계정 탭 클릭');
    console.log('3. "새 비공개 키 생성" 클릭');
    console.log('4. 다운로드한 파일을 scripts/firebase-service-account.json으로 저장');
    console.log('\n참고: 이 파일은 절대 Git에 커밋하지 마세요!');
    process.exit(1);
}

console.log('✅ Firebase 서비스 계정 파일 발견');
console.log('통계 수집을 시작합니다...\n');

// collect-daily-stats.js 실행
require('./collect-daily-stats.js');
