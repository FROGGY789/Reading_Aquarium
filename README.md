# Fathom Aquarium 🐠

여름방학 예습·복습용 Extensive Reading 학습 웹앱입니다.
할 일(예습/복습/퀴즈)을 끝내면 알을 받고, 부화시켜 나만의 아쿠아리움을 채워요.

빌드 도구 없이 동작하는 순수 HTML/CSS/JS 정적 웹앱이며,
GitHub Pages로 자동 배포되어 아이들이 언제든 링크로 접속할 수 있습니다.

## 접속 주소

푸시하면 GitHub Actions가 자동으로 배포합니다:

**https://froggy789.github.io/Reading_Aquarium/**

> 처음 한 번은 Actions 탭에서 "Deploy to GitHub Pages" 워크플로우가
> 성공했는지 확인하세요. 실패한다면 저장소 Settings → Pages → Source를
> **GitHub Actions**로 지정한 뒤 워크플로우를 다시 실행하면 됩니다.

## 기능

### 학생 모드
- **오프닝** — 물속 거품 연출과 함께 "화면을 탭하여 시작"
- **홈** — 오늘 선생님이 고른 문장, 지금 읽는 책, 오늘 할 일(지문 예습·지문 복습·어휘 복습·문장 복습) + 보너스 학습(어휘 예습·문장 예습·어법 퀴즈)
- **퀴즈** — 객관식 + 주관식(입력), 정답 확인·해설, 결과 화면(점수/오답 다시보기)
- **지문 복습** — 본문 속 단어를 탭하면 뜻 팝오버 표시
- **e-북 리더** — 책 본문 여러 페이지, 진행률 표시
- **보상** — 할 일 완료 시 +15 XP, 오늘 할 일을 모두 끝내면 알 1개, XP 50으로 알 구매
- **부화장** — 부화 시네마틱, 등급 5단계 확률(5회마다 SUPER RARE·10회마다 UNIQUE 보장)
- **아쿠아리움 & 도감** — 픽셀 아트 28종 수집

**오늘 할 일은 날마다 자동으로 리셋**됩니다. XP·레벨·동물·알은 계속 유지돼요.

### 교사 모드
- **대시보드** — 반 현황 (현재는 데모 데이터)
- **콘텐츠 관리** — 날짜별(Day) 콘텐츠 입력 및 배포:
  - 오늘의 문장, 책 정보와 e-북 본문, 지문 복습 지문 + 단어 카드, 6종 퀴즈 문항(객관식/주관식)
  - Day 추가(마지막 Day 복제) / 삭제, 날짜를 지정하면 해당 날짜부터 학생에게 노출
  - **저장** = 이 기기에서 미리보기, **배포** = 모든 기기에 반영

## 교사용: 콘텐츠 배포 설정 (최초 1회)

배포 버튼은 GitHub API로 `data/content.json`을 저장소에 커밋합니다.
이를 위해 GitHub 토큰이 한 번 필요합니다:

1. GitHub → Settings → Developer settings → **Fine-grained tokens** → Generate new token
2. Repository access: **Only select repositories** → `Reading_Aquarium` 선택
3. Permissions → Repository permissions → **Contents: Read and write**
4. 생성된 토큰(`github_pat_...`)을 교사 모드 → 콘텐츠 관리 → 토큰 칸에 붙여넣고 **토큰 저장**

토큰은 그 브라우저의 localStorage에만 저장됩니다. 이후에는 **지금 배포** 버튼만 누르면
1~2분 뒤 아이들 기기에 새 콘텐츠가 반영됩니다.

## 콘텐츠 우선순위

```
교사 초안(편집 중인 기기) → 배포본(data/content.json) → 내장 기본 콘텐츠
```

학생 화면은 오늘 날짜와 같거나 가장 가까운 과거의 Day를 자동으로 보여줍니다.

## 로컬 실행

```bash
python3 -m http.server 8000   # 저장소 루트에서
# http://localhost:8000 접속
```

## 구조

```
index.html                       앱 진입점
css/style.css                    프레임·애니메이션·편집기 스타일
js/data.js                       동물 도감(28종)·등급·기본 콘텐츠(DEFAULT_CONTENT)
js/app.js                        상태 관리 + 렌더링 + 콘텐츠 편집기/배포
data/content.json                배포된 날짜별 콘텐츠 (교사 '배포' 버튼이 갱신)
.github/workflows/deploy-pages.yml  GitHub Pages 자동 배포
```

학습 진행 상황은 브라우저 `localStorage`에 저장됩니다.
초기화: 개발자 도구 콘솔에서 `localStorage.removeItem('er_aquarium_v1')` 후 새로고침.
