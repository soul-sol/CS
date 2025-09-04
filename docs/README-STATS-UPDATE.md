# PUBG 클랜 멤버 스탯 자동 업데이트 설정 가이드

## 📋 개요
Firebase에 저장된 클랜원들의 PUBG 스탯을 하루에 한 번 자동으로 업데이트하는 시스템입니다.

## 🚀 설정 방법

### 1. Firebase Admin SDK 설정

⚠️ **중요**: 현재 Firebase 프로젝트는 **cs-homepage-5c3c2**를 사용합니다.
- Database URL: https://cs-homepage-5c3c2-default-rtdb.asia-southeast1.firebasedatabase.app

#### Step 1: Firebase 서비스 계정 키 생성
1. [Firebase Console](https://console.firebase.google.com)에 접속
2. 프로젝트 선택 (**cs-homepage-5c3c2**)
3. ⚙️ 프로젝트 설정 클릭
4. "서비스 계정" 탭 선택
5. "새 비공개 키 생성" 버튼 클릭
6. JSON 파일 다운로드
7. 파일명을 `firebase-service-account.json`으로 변경
8. 프로젝트 루트에 저장

> ⚠️ **중요**: `firebase-service-account.json` 파일은 절대 Git에 커밋하지 마세요!

#### Step 2: .gitignore에 추가
```bash
echo "firebase-service-account.json" >> .gitignore
```

### 2. 필요한 패키지 설치

```bash
npm install firebase-admin
```

### 3. 로컬에서 테스트

```bash
# 스크립트 실행 권한 부여
chmod +x update-stats.js

# 테스트 실행
node update-stats.js
```

## 🔄 자동화 방법

### 방법 1: GitHub Actions (추천) ✅

GitHub Actions를 사용하면 서버 없이 매일 자동으로 실행할 수 있습니다.

#### 설정 방법:

1. **GitHub Secrets 설정**
   - 저장소 Settings → Secrets and variables → Actions
   - "New repository secret" 클릭
   - Name: `FIREBASE_SERVICE_ACCOUNT`
   - Value: `firebase-service-account.json` 파일의 전체 내용 복사하여 붙여넣기

2. **워크플로우 파일 생성**
   - `.github/workflows/update-stats.yml` 파일이 자동 생성됨 (아래 참조)

3. **동작 확인**
   - Actions 탭에서 워크플로우 실행 상태 확인
   - 매일 오전 3시(한국 시간)에 자동 실행

### 방법 2: 로컬 크론잡 (macOS/Linux)

```bash
# crontab 편집
crontab -e

# 매일 오전 3시에 실행 (경로는 실제 경로로 변경)
0 3 * * * cd /Users/cylim_1/git/cs && /usr/local/bin/node update-stats.js >> /var/log/pubg-stats-update.log 2>&1
```

### 방법 3: Node.js 서버 (Heroku, AWS 등)

서버에 배포하여 크론잡으로 실행할 수 있습니다.

## 📊 Firebase 데이터 구조

업데이트 시 다음과 같은 구조로 저장됩니다:

```json
{
  "members": {
    "account_id": {
      "name": "플레이어명",
      "stats": {
        "assists": 100,
        "avgDamage": 250,
        "avgKills": "2.50",
        "solo": { ... },
        "duo": { ... },
        "squad": { ... }
      },
      "lastStatsUpdate": "2025-01-01T03:00:00.000Z"
    }
  },
  "lastUpdate": {
    "timestamp": "2025-01-01T03:00:00.000Z",
    "successCount": 10,
    "failCount": 0,
    "totalMembers": 10
  }
}
```

## 🛠️ 문제 해결

### API 키 만료
- PUBG Developer Portal에서 새 API 키 발급
- `update-stats.js` 파일의 `API_KEY` 값 업데이트

### Firebase 권한 오류
- Firebase Console에서 Realtime Database 규칙 확인
- 서비스 계정 키가 올바른지 확인

### 통계 업데이트 안됨
- PUBG API 상태 확인
- 플레이어 ID가 올바른지 확인
- API 호출 제한 확인 (분당 10회)

## 📝 로그 확인

### GitHub Actions
- Actions 탭 → 워크플로우 선택 → 실행 기록 확인

### 로컬 실행
```bash
node update-stats.js
```

## 🔐 보안 주의사항

1. **절대 커밋하지 말아야 할 파일:**
   - `firebase-service-account.json`
   - API 키가 포함된 환경 변수 파일

2. **GitHub Secrets 사용:**
   - 민감한 정보는 항상 GitHub Secrets에 저장

3. **API 키 관리:**
   - 주기적으로 API 키 갱신
   - 키 노출 시 즉시 재발급

## 📧 문의
문제가 발생하거나 도움이 필요하면 이슈를 생성해주세요.
