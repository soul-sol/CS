# Firebase 권한 오류 해결 가이드

## 문제
웹사이트에서 Firebase 데이터베이스 접근 시 "permission_denied at /members" 오류 발생

## 해결 방법

### 1. Firebase Console 접속
1. [Firebase Console](https://console.firebase.google.com) 접속
2. **cs-homepage-5c3c2** 프로젝트 선택

### 2. Realtime Database 규칙 수정

#### 현재 규칙 (문제 있음):
```json
{
  "rules": {
    ".read": false,
    ".write": false
  }
}
```

#### 수정된 규칙 (옵션 1 - 공개 읽기, 인증된 쓰기):
```json
{
  "rules": {
    ".read": true,
    ".write": "auth != null"
  }
}
```

#### 수정된 규칙 (옵션 2 - 완전 공개, 개발용):
```json
{
  "rules": {
    ".read": true,
    ".write": true
  }
}
```

#### 수정된 규칙 (옵션 3 - 특정 경로만 공개):
```json
{
  "rules": {
    "members": {
      ".read": true,
      ".write": "auth != null"
    },
    "stats": {
      ".read": true,
      ".write": "auth != null"
    },
    "dailyStats": {
      ".read": true,
      ".write": "auth != null"
    }
  }
}
```

### 3. 규칙 적용 방법
1. Firebase Console에서 **Realtime Database** 선택
2. **규칙** 탭 클릭
3. 위의 규칙 중 하나를 복사하여 붙여넣기
4. **게시** 버튼 클릭

### 4. 테스트
1. 브라우저 새로고침 (F5)
2. 개발자 도구 콘솔 확인
3. "permission_denied" 오류가 사라지고 데이터가 정상 로드되는지 확인

## 보안 고려사항
- **옵션 1**을 추천 (읽기는 공개, 쓰기는 인증 필요)
- 프로덕션 환경에서는 더 세밀한 규칙 설정 필요
- 서비스 계정을 사용하는 서버 스크립트는 규칙과 무관하게 작동

## 추가 정보
- [Firebase 보안 규칙 문서](https://firebase.google.com/docs/database/security)
- 현재 프로젝트 ID: `cs-homepage-5c3c2`
- Database URL: `https://cs-homepage-5c3c2-default-rtdb.asia-southeast1.firebasedatabase.app`
