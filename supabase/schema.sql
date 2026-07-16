-- =========================================================
-- Reading Aquarium — Supabase 스키마 (계정 + 반/승인 + 부여, v3)
-- Supabase 대시보드 → SQL Editor에 이 파일 전체를 붙여넣고 Run 하세요.
-- v1/v2 를 이미 실행했어도 안전하게 업그레이드됩니다(add column if not exists 등).
--
-- ⚠️ 함께 해야 하는 설정:
--   Authentication → Sign In / Providers → Email → "Confirm email" 끄기
--   (아이들이 이메일 없이 아이디/비밀번호로 가입하기 위함)
-- =========================================================

-- ---------- 프로필 (계정마다 1행) ----------
create table if not exists public.er_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text unique not null,
  name text not null,
  is_teacher boolean not null default false,
  created_at timestamptz not null default now()
);
-- v3 추가 컬럼: 반 / 학번 / 승인 여부
alter table public.er_profiles add column if not exists class text;
alter table public.er_profiles add column if not exists student_no text;
alter table public.er_profiles add column if not exists approved boolean not null default false;

-- 교사 여부 확인 함수 (RLS 재귀 방지를 위해 security definer)
create or replace function public.is_teacher()
returns boolean
language sql stable security definer set search_path = public
as $$
  select coalesce((select is_teacher from public.er_profiles where id = auth.uid()), false)
$$;

alter table public.er_profiles enable row level security;
drop policy if exists "profiles self insert" on public.er_profiles;
drop policy if exists "profiles read" on public.er_profiles;
drop policy if exists "profiles teacher update" on public.er_profiles;
drop policy if exists "profiles teacher delete" on public.er_profiles;
-- 가입 직후 본인 프로필 생성 (교사 아님 + 미승인 상태로만)
create policy "profiles self insert" on public.er_profiles
  for insert to authenticated with check (id = auth.uid() and is_teacher = false and approved = false);
-- 본인 프로필 + 교사는 전체 조회
create policy "profiles read" on public.er_profiles
  for select to authenticated using (id = auth.uid() or public.is_teacher());
-- 교사는 승인/수정 가능
create policy "profiles teacher update" on public.er_profiles
  for update to authenticated using (public.is_teacher()) with check (public.is_teacher());
-- 교사는 프로필 삭제(가입 거절) 가능
create policy "profiles teacher delete" on public.er_profiles
  for delete to authenticated using (public.is_teacher());

-- ---------- 학습 기록 (할 일 완료마다 1행) ----------
create table if not exists public.er_records (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  student text not null,
  date text not null,
  task text not null,
  kind text not null default 'quiz',
  score int, total int, correct int
);
alter table public.er_records add column if not exists user_id uuid default auth.uid();
create index if not exists er_records_date_idx on public.er_records (date);

alter table public.er_records enable row level security;
drop policy if exists "anon insert" on public.er_records;
drop policy if exists "anon select" on public.er_records;
drop policy if exists "records insert own" on public.er_records;
drop policy if exists "records read own or teacher" on public.er_records;
create policy "records insert own" on public.er_records
  for insert to authenticated with check (user_id = auth.uid());
create policy "records read own or teacher" on public.er_records
  for select to authenticated using (user_id = auth.uid() or public.is_teacher());

-- ---------- 진행 상황 동기화 (계정마다 1행) ----------
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

-- ---------- 보상 부여 (교사 → 학생 알/경험치) ----------
create table if not exists public.er_grants (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  user_id uuid not null,          -- 받는 학생
  eggs int not null default 0,
  xp int not null default 0,
  applied boolean not null default false
);
create index if not exists er_grants_user_idx on public.er_grants (user_id, applied);
alter table public.er_grants enable row level security;
drop policy if exists "grants teacher insert" on public.er_grants;
drop policy if exists "grants read own or teacher" on public.er_grants;
drop policy if exists "grants student apply" on public.er_grants;
-- 교사만 부여 생성
create policy "grants teacher insert" on public.er_grants
  for insert to authenticated with check (public.is_teacher());
-- 본인 것 조회 + 교사 전체 조회
create policy "grants read own or teacher" on public.er_grants
  for select to authenticated using (user_id = auth.uid() or public.is_teacher());
-- 학생은 본인 부여를 '적용됨(applied)'으로만 갱신
create policy "grants student apply" on public.er_grants
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

-- =========================================================
-- 교사 계정 지정 (최초 1회):
-- 앱에서 선생님도 학생처럼 가입한 뒤, 아래에서 아이디만 바꿔 실행하세요.
-- (교사 계정은 승인 대기 없이 바로 사용됩니다)
--
--   update public.er_profiles set is_teacher = true, approved = true where username = '선생님아이디';
-- =========================================================
