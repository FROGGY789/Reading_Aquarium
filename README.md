# Fathom Aquarium 🐠

여름방학 예습·복습용 Extensive Reading 학습 웹앱입니다.
할 일(예습/복습/퀴즈)을 끝내면 알을 받고, 부화시켜 나만의 아쿠아리움을 채워요.

빌드 도구 없이 동작하는 순수 HTML/CSS/JS 정적 웹앱이며,
GitHub Pages로 자동 배포되어 아이들이 언제든 링크로 접속할 수 있습니다.

## 접속 주소

푸시하면 GitHub Actions가 자동으로 배포합니다:

**https://froggy789.github.io/Reading_Aquarium/**

### ⚠️ 최초 1회 설정 (저장소 공개 전환)

현재 이 저장소는 **비공개(private)** 인데, GitHub 무료 계정은 비공개 저장소에서
Pages를 쓸 수 없어 배포가 실패합니다. 아래 한 번만 해주면 됩니다:

1. 저장소 **Settings → General** 맨 아래 **Danger Zone → Change visibility → Public** 으로 전환
2. **Actions 탭 → "Deploy to GitHub Pages" → Re-run all jobs** 클릭
3. 1~2분 뒤 위 주소로 접속 확인

> 저장소를 공개로 바꾸면 코드와 콘텐츠가 공개됩니다. 비공개를 유지하고 싶다면
> GitHub Pro 요금제(비공개 저장소 Pages 지원)를 쓰거나, Netlify 등 다른 호스팅을
> 사용해야 합니다. Pages 사이트 자체는 어느 경우든 링크를 아는 사람이 볼 수 있습니다.

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

## 학생 이름 선택 & 기록 수집 (Supabase, 선택 사항)

로그인 없이 아이별로 학습을 구분하고, 교사가 점수를 모아 볼 수 있습니다.

**1) 학생 이름 선택** — 교사 모드 → 콘텐츠 관리 → 「👧 학생 명단」에 이름을
한 줄씩 입력하고 저장/배포하면, 학생 화면에 "누구인가요?" 선택이 생기고
아이별로 진행(XP·물고기·오늘 할 일)이 따로 저장됩니다. 홈에서 아바타를
탭하면 다른 아이로 바꿀 수 있어요. 백엔드 없이도 동작합니다.

**2) 기록 수집(교사 대시보드 실데이터)** — Supabase 무료 프로젝트가 필요합니다:

1. https://supabase.com 가입 → New project 생성 (무료 플랜)
2. 왼쪽 메뉴 **SQL Editor** → 이 저장소의 `supabase/schema.sql` 내용을 붙여넣고 **Run**
3. **Settings → API** 에서 두 값을 복사:
   - Project URL (`https://xxxx.supabase.co`)
   - `anon` `public` 키
4. 앱의 교사 모드 → 콘텐츠 관리 → 「📡 기록 수집」에 붙여넣고 **배포**

이후 아이가 할 일을 끝낼 때마다 점수가 자동 기록되고,
교사 대시보드에 학생별 완료 현황·평균 점수가 실시간으로 표시됩니다.

> Vercel은 필요 없습니다 — Supabase는 브라우저에서 직접 호출하며,
> 호스팅은 GitHub Pages를 그대로 사용합니다. anon 키는 공개되어도 되는
> 키이며(그래서 콘텐츠와 함께 배포됨), 테이블 접근 범위는 schema.sql의
> RLS 정책으로 제한됩니다.

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
