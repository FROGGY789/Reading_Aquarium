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

## 학생 계정 & 기록 수집 (Supabase)

Supabase를 연결하면 **아이디/비밀번호 계정** 방식으로 동작합니다.
130명 규모까지 무리 없이 관리할 수 있어요 (무료 플랜으로 충분).

- 학생: 처음에 아이디·비밀번호·이름으로 **가입** → 이후 어느 기기에서
  로그인해도 자기 아쿠아리움·XP·오늘 할 일이 그대로 이어집니다 (클라우드 동기화)
- 할 일을 끝낼 때마다 점수·완료 기록이 계정에 묶여 자동 저장
- 교사: **교사 계정**으로 로그인해야 대시보드(학생별 완료 현황·평균 점수)가
  보입니다 — 학생 계정으로는 다른 아이 기록을 볼 수 없어요 (DB 권한으로 차단)

### 설정 순서 (최초 1회)

1. https://supabase.com 가입 → **New project** 생성 (무료 플랜)
2. **Authentication → Sign In / Providers → Email**에서 **"Confirm email" 끄기**
   (아이들이 이메일 없이 아이디만으로 가입하기 위해 필수!)
3. **SQL Editor** → 이 저장소의 `supabase/schema.sql` 전체를 붙여넣고 **Run**
4. **Settings → API**에서 Project URL(`https://xxxx.supabase.co`)과 `anon public` 키 복사
5. 앱의 교사 모드 → 콘텐츠 관리 → 「📡 기록 수집」에 붙여넣고 **배포**

### 교사 계정 만들기

1. 앱에서 선생님도 학생처럼 가입 (예: 아이디 `teacher`)
2. Supabase SQL Editor에서 실행:
   ```sql
   update public.er_profiles set is_teacher = true, approved = true where username = 'teacher';
   ```
3. 앱에서 로그아웃 후 다시 로그인 → 교사 대시보드 활성화

### 반 · 가입 승인 · 보상 (v3)

- **반 만들기** — admin.html → ⚙️ 학생·설정 → 「반 목록」에 반 이름을 한 줄씩 넣고 배포하면, 학생 가입 화면에 반 선택이 생겨요.
- **가입 승인** — 학생은 아이디/비번/이름/**학번**/**반**으로 가입하면 "승인 대기" 상태가 돼요. 교사 대시보드 상단 「가입 대기」에서 **승인/거절**하면 학생이 시작할 수 있어요.
- **알·경험치 주기** — 대시보드의 학생별 현황에서 **경험치 +10/+30/+50**, **알 +1/+3/+5** 버튼으로 보상을 줘요. 학생이 다음에 접속하면 자동 반영됩니다.

> ⚠️ v3 스키마를 처음 적용하면 **기존 학생 계정도 "미승인"이 됩니다.**
> 이미 쓰던 학생들이 있다면 SQL Editor에서 한 번만:
> `update public.er_profiles set approved = true;` (현재 계정 모두 승인)

> Vercel은 필요 없습니다 — Supabase는 브라우저에서 직접 호출하며,
> 호스팅은 GitHub Pages를 그대로 사용합니다. anon 키는 공개용 키이고,
> 데이터 접근 권한은 schema.sql의 RLS 정책이 통제합니다
> (학생은 자기 기록만 쓰고/보고, 교사만 전체 조회).

### Supabase 없이 쓰기

Supabase를 설정하지 않으면 이전처럼 동작합니다: 「👧 학생 명단」에 이름을
입력하면 로그인 없는 이름 선택 화면이 뜨고, 진행은 기기별로만 저장됩니다.

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
