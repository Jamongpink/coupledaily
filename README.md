# Jieun — Personal Web App

매일의 생각, 프로젝트, 좋아하는 것을 기록하기 위한 개인 웹앱입니다.
React와 Vite를 기반으로 하며 모바일과 데스크톱 환경에 대응합니다.

## 시작하기

```bash
npm install
npm run dev
```

개발 서버가 표시하는 주소를 브라우저에서 열면 웹앱을 확인할 수 있습니다.

## 명령어

- `npm run dev`: 개발 서버 실행
- `npm run lint`: 코드 정적 분석
- `npm run build`: 프로덕션 빌드 생성
- `npm run preview`: 프로덕션 빌드 미리보기

## 현재 구조

```text
src/
├─ assets/       정적 이미지
├─ App.jsx       메인 화면과 콘텐츠
├─ App.css       메인 화면 스타일
├─ index.css     전역 스타일과 디자인 토큰
└─ main.jsx      React 진입점
```

화면이나 기능이 늘어나면 `pages`, `components`, `features` 단위로 점진적으로
분리하는 것을 권장합니다.
