# PUBG API 키 설정 가이드

## ⚠️ 중요: API 키 만료

현재 PUBG API 키가 만료되어 통계 수집이 작동하지 않습니다. 새로운 API 키를 발급받아 설정해야 합니다.

## 1. PUBG API 키 발급받기

### 단계별 가이드:

1. **PUBG Developer Portal 접속**
   - https://developer.pubg.com/ 방문
   - Steam 계정으로 로그인

2. **새 앱 생성**
   - 상단 메뉴에서 "My Apps" 클릭
   - "Create New App" 버튼 클릭

3. **앱 정보 입력**
   ```
   App Name: CountShot Clan Stats
   Description: PUBG clan member statistics tracker for CountShot clan
   Website URL: https://soul-sol.github.io/CS/
   Redirect URI: https://soul-sol.github.io/CS/callback (선택사항)
   ```

4. **API 키 복사**
   - 생성된 API 키를 안전한 곳에 복사
   - 형식: `eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9...` (긴 문자열)

## 2. GitHub Secrets 설정

1. GitHub 저장소 페이지로 이동
2. **Settings** → **Secrets and variables** → **Actions**
3. **New repository secret** 클릭
4. 다음 정보 입력:
   - **Name**: `PUBG_API_KEY`
   - **Value**: 복사한 API 키 전체

## 3. 코드 업데이트

### `js/members.js` 파일 수정:
```javascript
// PUBG API 설정
const API_KEY = '여기에_새로운_API_키_입력';
```

### `scripts/collect-daily-stats.js` 파일 수정:
```javascript
// 환경 변수 설정
const PUBG_API_KEY = process.env.PUBG_API_KEY || '여기에_새로운_API_키_입력';
```

## 4. 테스트

### GitHub Actions 테스트:
1. Actions 탭으로 이동
2. "Collect PUBG Stats" 선택
3. "Run workflow" 클릭
4. 실행 로그 확인

### 로컬 테스트:
```bash
cd scripts
npm install
# API 키를 환경 변수로 설정
export PUBG_API_KEY="your-api-key-here"
node test-collection.js
```

## 5. API 키 제한 사항

- **Rate Limit**: 분당 10개 요청
- **유효 기간**: 보통 1년
- **권한**: Read-only (통계 조회만 가능)

## 6. 문제 해결

### 401 Unauthorized 에러:
- API 키가 잘못되었거나 만료됨
- 새 키 발급 필요

### 429 Too Many Requests 에러:
- Rate limit 초과
- 요청 간격 늘리기 (현재 1초)

### 404 Not Found 에러:
- 플레이어 이름이 정확하지 않음
- 대소문자 확인 필요

## 7. 보안 주의사항

⚠️ **절대 하지 말아야 할 것:**
- API 키를 GitHub에 직접 커밋
- 공개 저장소에 API 키 노출
- 클라이언트 사이드 코드에 API 키 하드코딩

✅ **권장 사항:**
- GitHub Secrets 사용
- 환경 변수로 관리
- 정기적으로 키 갱신

## 8. 추가 정보

- [PUBG API Documentation](https://documentation.pubg.com/en/introduction.html)
- [Rate Limits](https://documentation.pubg.com/en/rate-limits.html)
- [API Status](https://pubgapi.statuspage.io/)

---

**마지막 업데이트**: 2024년 1월
**문제 발생 시**: GitHub Issues에 문의
