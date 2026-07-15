-- Fathom Aquarium 기록 수집 테이블
-- Supabase 대시보드 → SQL Editor에 이 파일 전체를 붙여넣고 Run 하세요.

create table if not exists public.er_records (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  student text not null,          -- 학생 이름
  date text not null,             -- YYYY-MM-DD (학생 기기 기준)
  task text not null,             -- preview / review / vocab / sentence / vocabPrep / sentPrep / grammar
  kind text not null default 'quiz',  -- quiz | review
  score int,                      -- 퀴즈 점수(0~100), 지문 복습은 null
  total int,                      -- 문항 수
  correct int                     -- 정답 수
);

create index if not exists er_records_date_idx on public.er_records (date);

alter table public.er_records enable row level security;

-- 로그인 없는 소규모 학급용 정책: 익명(anon) 키로 기록 추가/조회 허용
create policy "anon insert" on public.er_records
  for insert to anon with check (true);
create policy "anon select" on public.er_records
  for select to anon using (true);
