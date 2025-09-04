# GitHub Actions 통계 수집 설정 가이드

## 개요
이 시스템은 매일 자동으로 PUBG API에서 클랜 멤버들의 통계를 수집하고 Firebase에 저장합니다.

## 설정 단계

### 1. Firebase 서비스 계정 생성

1. [Firebase Console](https://console.firebase.google.com)에 접속
2. 프로젝트 선택 → ⚙️ 설정 → 서비스 계정
3. "새 비공개 키 생성" 클릭
4. JSON 파일 다운로드

### 2. GitHub Secrets 설정

GitHub 저장소에서 Settings → Secrets and variables → Actions로 이동하여 다음 시크릿 추가:

#### `FIREBASE_SERVICE_ACCOUNT`
- 다운로드한 JSON 파일의 **전체 내용**을 복사하여 붙여넣기
- 예시:
```json
{
  "type": "service_account",
  "project_id": "cs-homepage-5c3c2",
  "private_key_id": "...",
  "private_key": "...",
  ...
}
```

#### `PUBG_API_KEY` (선택사항)
- 현재 코드에 하드코딩되어 있지만, 보안을 위해 시크릿으로 관리 권장
- [PUBG Developer Portal](https://developer.pubg.com/)에서 발급

### 3. 워크플로우 활성화

1. Actions 탭으로 이동
2. "I understand my workflows, go ahead and enable them" 클릭
3. `Collect PUBG Stats` 워크플로우 확인

### 4. 수동 실행 테스트

1. Actions → Collect PUBG Stats 선택
2. "Run workflow" 버튼 클릭
3. 실행 결과 확인

## 자동 실행 스케줄

- **매일 한국시간 오전 9시** (UTC 00:00)에 자동 실행
- cron 표현식: `0 0 * * *`
- 변경하려면 `.github/workflows/collect-stats.yml` 파일 수정

## 수집되는 데이터

### 멤버별 통계
- K/D (Kill/Death Ratio)
- 평균 데미지
- 총 킬 수
- 승리 횟수
- 게임 수
- Top 10 진입 횟수
- 헤드샷 킬
- 최장 거리 킬
- 어시스트
- 부활 횟수

### 데이터 저장 구조

```
Firebase Realtime Database
├── stats/
│   ├── daily/
│   │   └── 2024-01-15/  # 일별 전체 스냅샷
│   │       └── {memberKey}/
│   │           ├── name
│   │           ├── playerId
│   │           ├── stats/
│   │           └── timestamp
│   ├── history/
│   │   └── {memberKey}/
│   │       └── 2024-01-15/  # 멤버별 일별 기록 (30일 보관)
│   │           ├── kd
│   │           ├── avgDamage
│   │           ├── kills
│   │           ├── wins
│   │           └── roundsPlayed
│   └── metadata/
│       └── lastCollection/
│           ├── date
│           ├── timestamp
│           ├── membersProcessed
│           └── errors
└── members/
    └── {memberKey}/
        └── currentStats/  # 최신 통계
```

## 로컬 테스트

### 사전 준비
1. Node.js 18+ 설치
2. Firebase 서비스 계정 JSON 파일을 `scripts/firebase-service-account.json`으로 저장

### 실행
```bash
cd scripts
npm install
npm run test
```

## 문제 해결

### 통계가 수집되지 않는 경우
1. GitHub Actions 실행 로그 확인
2. Firebase 서비스 계정 권한 확인
3. PUBG API 키 유효성 확인
4. 멤버 이름이 정확한지 확인

### API 제한 문제
- PUBG API는 분당 10회 요청 제한
- 스크립트는 각 요청 사이 1초 딜레이 포함
- 멤버가 많은 경우 실행 시간이 길어질 수 있음

### 데이터 보관 정책
- 일별 스냅샷: 무제한 보관
- 멤버별 히스토리: 최근 30일만 보관 (자동 정리)

## 통계 확인

웹사이트의 [통계 분석 페이지](/stats.html)에서 확인 가능:
- 개인별 성장 그래프
- 클랜 평균 추이
- TOP 5 랭킹
- 기간별 비교

## 보안 주의사항

⚠️ **절대 하지 말아야 할 것들:**
- Firebase 서비스 계정 파일을 Git에 커밋
- API 키를 공개 저장소에 노출
- 서비스 계정 파일을 다른 사람과 공유

## 지원

문제가 있으면 Issues 탭에서 문의해주세요.
