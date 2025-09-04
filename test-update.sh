#!/bin/bash

# PUBG 스탯 업데이트 테스트 스크립트
echo "🚀 PUBG 클랜 멤버 스탯 업데이트 테스트"
echo "=================================="

# Firebase 서비스 계정 파일 확인
if [ ! -f "firebase-service-account.json" ]; then
    echo "❌ 오류: firebase-service-account.json 파일이 없습니다."
    echo ""
    echo "📋 설정 방법:"
    echo "1. Firebase Console (https://console.firebase.google.com) 접속"
    echo "2. 프로젝트 설정 → 서비스 계정"
    echo "3. '새 비공개 키 생성' 클릭"
    echo "4. 다운로드한 JSON 파일을 'firebase-service-account.json'으로 저장"
    echo ""
    exit 1
fi

# npm 패키지 설치 확인
echo "📦 패키지 확인 중..."
if ! npm list firebase-admin &>/dev/null; then
    echo "📦 firebase-admin 설치 중..."
    npm install firebase-admin
fi

if ! npm list node-fetch &>/dev/null; then
    echo "📦 node-fetch 설치 중..."
    npm install node-fetch@2
fi

echo ""
echo "✅ 준비 완료!"
echo ""
echo "📊 스탯 업데이트 시작..."
echo "=================================="

# 스크립트 실행
node update-stats.js

echo ""
echo "=================================="
echo "✨ 테스트 완료!"
