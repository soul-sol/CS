# PUBG 클랜 홈페이지

배틀그라운드 클랜 정보를 조회할 수 있는 웹 애플리케이션입니다.

## 기능

- 클랜명으로 클랜 검색
- 클랜 기본 정보 표시 (레벨, 멤버 수, 태그)
- 클랜원 목록 및 상세 정보 표시
- 플랫폼 선택 지원 (Steam, Kakao, Xbox, PlayStation, Console)
- 반응형 디자인으로 모바일 지원

## 설치 및 실행

### 1. 의존성 설치
```bash
npm install
```

### 2. 개발 서버 실행
```bash
npm start
```

브라우저에서 `http://localhost:8080` 접속

## 사용 방법

1. 클랜명 입력란에 검색하고자 하는 클랜명을 입력합니다.
2. 플랫폼을 선택합니다 (기본값: Steam).
3. 검색 버튼을 클릭하거나 Enter 키를 누릅니다.
4. 클랜 정보와 멤버 목록이 표시됩니다.

## 기술 스택

- HTML5
- CSS3 (그라디언트, 애니메이션, 반응형 디자인)
- Vanilla JavaScript
- PUBG API

## 주요 파일

- `index.html` - 메인 HTML 구조
- `styles.css` - 스타일링 및 애니메이션
- `script.js` - API 연동 및 동적 기능 구현
- `package.json` - 프로젝트 설정 및 의존성

## API 정보

이 프로젝트는 PUBG 공식 API를 사용합니다.
- API 문서: https://documentation.pubg.com/

## 참고 사항

- PUBG API의 클랜 기능이 제한적일 수 있어, 일부 데이터는 데모 데이터로 표시될 수 있습니다.
- API 키는 보안상 환경 변수로 관리하는 것을 권장합니다.
- Rate Limit에 주의하여 사용하세요.

## 라이선스

이 프로젝트는 개인 학습 및 데모 목적으로 제작되었습니다.
