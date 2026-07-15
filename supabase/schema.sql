-- =========================================================
-- Fathom Aquarium — Supabase 스키마 (계정 기반, v2)
-- Supabase 대시보드 → SQL Editor에 이 파일 전체를 붙여넣고 Run 하세요.
-- (v1 스키마를 이미 실행했더라도 안전하게 업그레이드됩니다)
--
-- ⚠️ 추가로 꼭 해야 하는 설정:
--   Authentication → Sign In / Providers → Email → "Confirm email" 끄기
--   (아이들이 이메일 없이 아이디/비밀번호만으로 가입하기 위함)
-- =========================================================

-- ---------- 프로필 (계정마다 1행: 아이디·이름·교사 여부) ----------
create table if not exists public.er_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text unique not null,
  name text not null,
  is_teacher boolean not null default false,
  created_at timestamptz not null default now()
);

-- 교사 여부 확인 함수 (RLS 재귀를 피하기 위해 security definer)
create or replace function public.is_teacher()
returns boolean
language sql stable security definer set search_path = public
as $$
  select coalesce((select is_teacher from public.er_profiles where id = auth.uid()), false)
$$;

alter table public.er_profiles enable row level security;
drop policy if exists "profiles self insert" on public.er_profiles;
drop policy if exists "profiles read" on public.er_profiles;
-- 가입 직후 자기 프로필 생성 (is_teacher는 스스로 켤 수 없음)
create policy "profiles self insert" on public.er_profiles
  for insert to authenticated with check (id = auth.uid() and is_teacher = false);
-- 본인 프로필 + 교사는 전체 조회
create policy "profiles read" on public.er_profiles
  for select to authenticated using (id = auth.uid() or public.is_teacher());

-- ---------- 학습 기록 (할 일 완료마다 1행) ----------
create table if not exists public.er_records (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  student text not null,          -- 표시용 이름
  date text not null,             -- YYYY-MM-DD (학생 기기 기준)
  task text not null,             -- preview / review / vocab / sentence / vocabPrep / sentPrep / grammar
  kind text not null default 'quiz',  -- quiz | review
  score int,
  total int,
  correct int
);
alter table public.er_records add column if not exists user_id uuid default auth.uid();
create index if not exists er_records_date_idx on public.er_records (date);

alter table public.er_records enable row level security;
drop policy if exists "anon insert" on public.er_records;
drop policy if exists "anon select" on public.er_records;
drop policy if exists "records insert own" on public.er_records;
drop policy if exists "records read own or teacher" on public.er_records;
-- 자기 기록만 추가 가능
create policy "records insert own" on public.er_records
  for insert to authenticated with check (user_id = auth.uid());
-- 본인 기록 + 교사는 전체 조회
create policy "records read own or teacher" on public.er_records
  for select to authenticated using (user_id = auth.uid() or public.is_teacher());

-- ---------- 진행 상황 동기화 (계정마다 1행: XP·동물·오늘 할 일) ----------
create table if not exists public.er_progress (
  user_id uuid primary key references auth.users(id) on delete cascade,
  state jsonb,
  updated_at timestamptz not null default now()
);
alter table public.er_progress enable row level security;
drop policy if exists "progress own insert" on public.er_progress;
drop policy if exists "progress own update" on public.er_progress;
drop policy if exists "progress own read" on public.er_progress;
create policy "progress own insert" on public.er_progress
  for insert to authenticated with check (user_id = auth.uid());
create policy "progress own update" on public.er_progress
  for update to authenticated using (user_id = auth.uid());
create policy "progress own read" on public.er_progress
  for select to authenticated using (user_id = auth.uid() or public.is_teacher());

-- =========================================================
-- 교사 계정 지정 (최초 1회):
-- 앱에서 선생님도 학생처럼 가입한 뒤, 아래에서 아이디만 바꿔 실행하세요.
--
--   update public.er_profiles set is_teacher = true where username = '선생님아이디';
-- =========================================================
