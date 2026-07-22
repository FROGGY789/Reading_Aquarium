/* =========================================================
 * Fathom Aquarium — 앱 로직 (상태 관리 + 화면 렌더링)
 * 빌드 없이 동작하는 순수 JS SPA.
 *
 * 콘텐츠 우선순위: 교사 초안(이 기기) > 배포본(data/content.json) > 내장 기본값
 * 학생 진행 상황은 localStorage에 저장되며, '오늘 할 일'은 날마다 리셋됩니다.
 * ========================================================= */

const STORE_KEY = 'er_aquarium_v1';
const DRAFT_KEY = 'er_content_draft_v1';
const TOKEN_KEY = 'er_gh_token';
const CONTENT_URL = 'data/content.json';
const REPO_OWNER = 'FROGGY789';
const REPO_NAME = 'Reading_Aquarium';

const PROFILE_KEY = 'er_profile_v1';
const XP_NEED = 120;      // 레벨업에 필요한 XP
const EGG_PRICE = 50;     // 알 구매 비용(XP)
const HATCH_MS = 5000;    // 부화 연출 길이

const NORM = s => (s || '').toString().toLowerCase().replace(/[^a-z0-9가-힣]/g, '');
const esc = s => String(s == null ? '' : s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const clone = o => JSON.parse(JSON.stringify(o));

function todayKey() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/* ---------- 콘텐츠 ---------- */
let PUBLISHED = null;                    // data/content.json에서 가져온 배포본
// 편집·배포는 데스크톱(admin.html)에서만 해요. 이 기기(폰)에 남아있던 옛 초안은
// 배포본을 덮어써서 옛 콘텐츠가 보이는 문제를 일으키므로 더 이상 사용하지 않고 정리합니다.
let DRAFT = null;
try { localStorage.removeItem(DRAFT_KEY); } catch (e) { /* 무시 */ }

function loadJSON(key) {
  try { return JSON.parse(localStorage.getItem(key) || 'null'); } catch (e) { return null; }
}
function contentSource() {
  const c = PUBLISHED || DEFAULT_CONTENT;   // 항상 배포본 기준(초안 사용 안 함)
  return (c && Array.isArray(c.days) && c.days.length) ? c : DEFAULT_CONTENT;
}
// 배포된 Day들(날짜 오름차순) + 오늘에 가장 가까운 과거 Day 인덱스
function deployedDays() { return contentSource().days.slice().sort((a, b) => (a.date || '').localeCompare(b.date || '')); }
function bestDeployedDayIndex(days) {
  const today = todayKey();
  let best = 0;
  days.forEach((d, i) => { if ((d.date || '') <= today) best = i; });
  return best;
}

/* ---------- 학생 프로필(로그인 없는 이름 선택 — Supabase 미설정 시) ---------- */
let profile = localStorage.getItem(PROFILE_KEY) || '';
function roster() { return contentSource().students || []; }
function needProfile() {
  return !authMode() && roster().length > 0 && (!profile || !roster().includes(profile));
}
function studentName() {
  if (auth && auth.user) return auth.user.name || auth.user.username;
  return profile || '유림';
}
function storeKey() {
  if (auth && auth.user) return STORE_KEY + ':u:' + auth.user.id;
  return profile ? STORE_KEY + ':' + profile : STORE_KEY;
}

/* ---------- 계정(Supabase Auth — 아이디/비밀번호) ---------- */
const AUTH_KEY = 'er_auth_v1';
let auth = loadJSON(AUTH_KEY); // {access_token, refresh_token, user:{id, username, name, is_teacher}}
function authMode() { return !!sbConf(); }
function needLogin() { return authMode() && !auth; }
function isTeacherUser() { return !!(auth && auth.user && auth.user.is_teacher); }
function classes() { return contentSource().classes || []; }
// 로그인했지만 아직 교사 승인 전인 학생
function needApproval() { return authMode() && auth && !isTeacherUser() && auth.user && auth.user.approved === false; }
function saveAuth() {
  try {
    if (auth) localStorage.setItem(AUTH_KEY, JSON.stringify(auth));
    else localStorage.removeItem(AUTH_KEY);
  } catch (e) { /* 무시 */ }
}
// 아이디를 가짜 이메일로 변환(Supabase Auth는 이메일 형식을 요구)
function idToEmail(id) { return id.toLowerCase() + '@fathom-aquarium.app'; }
function sbUrl() { return sbConf().url.replace(/\/+$/, ''); }

// 인증 포함 REST 호출(401이면 토큰 갱신 후 1회 재시도)
async function sbFetch(path, opts, retried) {
  const sb = sbConf();
  const headers = Object.assign(
    { 'apikey': sb.anonKey, 'Content-Type': 'application/json' },
    (opts && opts.headers) || {}
  );
  headers['Authorization'] = 'Bearer ' + (auth ? auth.access_token : sb.anonKey);
  const res = await fetch(sbUrl() + path, Object.assign({}, opts, { headers }));
  if (res.status === 401 && auth && !retried) {
    if (await refreshAuth()) return sbFetch(path, opts, true);
  }
  return res;
}
async function refreshAuth() {
  const sb = sbConf();
  if (!sb || !auth || !auth.refresh_token) return false;
  try {
    const res = await fetch(sbUrl() + '/auth/v1/token?grant_type=refresh_token', {
      method: 'POST',
      headers: { 'apikey': sb.anonKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh_token: auth.refresh_token })
    });
    if (!res.ok) { doLogout(false); return false; }
    const j = await res.json();
    auth.access_token = j.access_token;
    auth.refresh_token = j.refresh_token || auth.refresh_token;
    saveAuth();
    return true;
  } catch (e) { return false; }
}
function doLogout(rerender) {
  const role = state.role; // 보고 있던 화면(학생/교사)은 유지
  clearTimeout(syncTimer);
  auth = null;
  saveAuth();
  state = loadState();
  state.role = role;
  state.intro = false; // 세션 중 로그아웃 → 스플래시 생략
  if (rerender !== false) render();
}
// 가입 직후 프로필 행 생성 / 로그인 시 이름·반·학번·승인·교사 여부 동기화
async function ensureProfile(signupInfo) {
  try {
    const res = await sbFetch('/rest/v1/er_profiles?id=eq.' + auth.user.id + '&select=name,username,is_teacher,approved,class,student_no');
    if (res.ok) {
      const rows = await res.json();
      if (rows.length) {
        auth.user.name = rows[0].name || auth.user.name;
        auth.user.is_teacher = !!rows[0].is_teacher;
        auth.user.approved = !!rows[0].approved;
        auth.user.class = rows[0].class || '';
        auth.user.studentNo = rows[0].student_no || '';
        saveAuth();
        return;
      }
    }
    // 프로필이 없으면 새로 생성 (가입 시 입력값 사용, 미승인 상태)
    const info = signupInfo || {};
    await sbFetch('/rest/v1/er_profiles', {
      method: 'POST',
      headers: { 'Prefer': 'return=minimal' },
      body: JSON.stringify({
        id: auth.user.id, username: auth.user.username, name: auth.user.name,
        class: info.classId || null, student_no: info.studentNo || null, approved: false
      })
    });
    // 서버 기준값(교사·승인 여부)을 다시 읽어옴
    const chk = await sbFetch('/rest/v1/er_profiles?id=eq.' + auth.user.id + '&select=is_teacher,approved,class,student_no');
    if (chk.ok) {
      const rows = await chk.json();
      if (rows.length) {
        auth.user.is_teacher = !!rows[0].is_teacher;
        auth.user.approved = !!rows[0].approved;
        auth.user.class = rows[0].class || '';
        auth.user.studentNo = rows[0].student_no || '';
        saveAuth();
        return;
      }
    }
    auth.user.approved = false;
    auth.user.class = info.classId || '';
    auth.user.studentNo = info.studentNo || '';
    saveAuth();
  } catch (e) { /* 무시 */ }
}
// 교사가 준 알/경험치(부여) 적용
async function pullGrants() {
  if (!auth || isTeacherUser()) return;
  try {
    const res = await sbFetch('/rest/v1/er_grants?user_id=eq.' + auth.user.id + '&applied=eq.false&select=id,eggs,xp');
    if (!res.ok) return;
    const rows = await res.json();
    if (!rows.length) return;
    let eggs = 0, xp = 0, ids = [];
    rows.forEach(g => { eggs += g.eggs || 0; xp += g.xp || 0; ids.push(g.id); });
    state.eggs = (state.eggs || 0) + eggs;
    state.xp = (state.xp || 0) + xp;
    save();
    // 적용됨 표시
    await sbFetch('/rest/v1/er_grants?id=in.(' + ids.join(',') + ')', {
      method: 'PATCH', headers: { 'Prefer': 'return=minimal' }, body: JSON.stringify({ applied: true })
    });
    if (eggs || xp) { ui.grantMsg = `선생님이 ${xp ? 'XP ' + xp : ''}${xp && eggs ? ' · ' : ''}${eggs ? '알 ' + eggs + '개' : ''}를 주셨어요! 🎁`; }
  } catch (e) { /* 무시 */ }
}
// 클라우드에 저장된 진행 상황 내려받기(있으면 이 기기 상태를 덮어씀)
async function pullProgress() {
  try {
    const res = await sbFetch('/rest/v1/er_progress?user_id=eq.' + auth.user.id + '&select=state');
    if (!res.ok) return;
    const rows = await res.json();
    if (rows.length && rows[0].state) {
      localStorage.setItem(storeKey(), JSON.stringify(rows[0].state));
    }
  } catch (e) { /* 무시 */ }
}
// 로그인/가입 실행
async function runAuth(isSignup) {
  if (ui.authBusy) return;
  const sb = sbConf();
  if (!sb) return;
  const id = ui.li.id.trim(), pw = ui.li.pw, name = ui.li.name.trim();
  const studentNo = ui.li.studentNo.trim(), classId = ui.li.classId;
  if (!/^[a-zA-Z0-9_-]{3,20}$/.test(id)) { ui.authMsg = '아이디는 영문/숫자 3~20자로 입력해주세요'; render(); return; }
  if (!pw || pw.length < 6) { ui.authMsg = '비밀번호는 6자 이상이어야 해요'; render(); return; }
  if (isSignup) {
    if (!name) { ui.authMsg = '이름을 입력해주세요'; render(); return; }
    if (!studentNo) { ui.authMsg = '학번을 입력해주세요'; render(); return; }
    if (classes().length && !classId) { ui.authMsg = '반을 선택해주세요'; render(); return; }
  }
  ui.authBusy = true;
  ui.authMsg = isSignup ? '가입하는 중...' : '로그인 중...';
  render();
  try {
    let res, j;
    if (isSignup) {
      res = await fetch(sbUrl() + '/auth/v1/signup', {
        method: 'POST',
        headers: { 'apikey': sb.anonKey, 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: idToEmail(id), password: pw, data: { username: id, name, student_no: studentNo } })
      });
      j = await res.json().catch(() => ({}));
      if (!res.ok) {
        const m = j.msg || j.error_description || j.message || '';
        throw new Error(/already|registered/i.test(m) ? '이미 있는 아이디예요' : (m || '가입에 실패했어요'));
      }
      if (!j.access_token) throw new Error('관리자 설정 필요: Supabase → Authentication → Sign In/Providers → Email에서 "Confirm email"을 꺼주세요');
    } else {
      res = await fetch(sbUrl() + '/auth/v1/token?grant_type=password', {
        method: 'POST',
        headers: { 'apikey': sb.anonKey, 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: idToEmail(id), password: pw })
      });
      j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error('아이디 또는 비밀번호가 맞지 않아요');
    }
    const meta = (j.user && j.user.user_metadata) || {};
    auth = {
      access_token: j.access_token,
      refresh_token: j.refresh_token,
      user: { id: j.user.id, username: meta.username || id, name: meta.name || name || id, is_teacher: false }
    };
    saveAuth();
    await ensureProfile(isSignup ? { classId, studentNo } : null);  // 프로필 생성/동기화(반·학번·승인·교사)
    await pullProgress();    // 클라우드 진행 상황 내려받기
    const role = state.role; // 보고 있던 화면(학생/교사)은 유지
    state = loadState();
    state.role = role;
    state.intro = false; // 로그인 직후에는 스플래시 없이 바로 홈
    if (!isTeacherUser() && auth.user.approved) { await pullGrants(); loadWordbook(); }  // 승인된 학생: 부여·단어장
    ui.authMsg = '';
    ui.li.pw = '';
    ui.signupMode = false;
    if (isTeacherUser()) loadRecords();
  } catch (e) {
    ui.authMsg = '❌ ' + e.message;
  }
  ui.authBusy = false;
  render();
}

// 진행 상황을 클라우드로 올리기(저장 후 1.5초 묶어서 전송)
let syncTimer = null;
function scheduleSync() {
  if (!auth || !sbConf()) return;
  clearTimeout(syncTimer);
  syncTimer = setTimeout(() => {
    if (!auth || !sbConf()) return; // 발화 시점에 로그아웃했을 수 있음
    sbFetch('/rest/v1/er_progress', {
      method: 'POST',
      headers: { 'Prefer': 'resolution=merge-duplicates,return=minimal' },
      body: JSON.stringify({ user_id: auth.user.id, state, updated_at: new Date().toISOString() })
    }).catch(() => {});
  }, 1500);
}

/* ---------- 기록 수집(Supabase) ---------- */
function sbConf() {
  const s = contentSource().supabase;
  return (s && s.url && s.anonKey) ? s : null;
}
async function postRecord(rec) {
  if (!sbConf()) return;
  if (!auth) return; // 계정 기반: 로그인한 상태에서만 기록
  rec.student = studentName();
  try {
    await sbFetch('/rest/v1/er_records', {
      method: 'POST',
      headers: { 'Prefer': 'return=minimal' },
      body: JSON.stringify(rec)
    });
  } catch (e) { /* 오프라인이면 조용히 건너뜀 */ }
}
async function loadRecords() {
  if (!sbConf() || !isTeacherUser()) { ui.records = null; return; }
  ui.recLoading = true; ui.recError = '';
  render();
  try {
    const [r1, r2] = await Promise.all([
      sbFetch('/rest/v1/er_records?date=eq.' + todayKey() + '&select=student,task,kind,score,total,created_at&order=created_at.asc'),
      sbFetch('/rest/v1/er_profiles?is_teacher=eq.false&select=id,name,username,class,student_no,approved&order=class.asc,student_no.asc')
    ]);
    if (!r1.ok) throw new Error('HTTP ' + r1.status);
    ui.records = await r1.json();
    const all = r2.ok ? await r2.json() : [];
    ui.profiles = all.filter(p => p.approved);
    ui.pending = all.filter(p => !p.approved);
  } catch (e) {
    ui.recError = e.message;
    ui.records = null;
  }
  ui.recLoading = false;
  render();
}
/* ---- 교사: 가입 승인/거절, 알·경험치 부여 ---- */
async function approveStudent(id, ok) {
  try {
    if (ok) {
      await sbFetch('/rest/v1/er_profiles?id=eq.' + id, { method: 'PATCH', headers: { 'Prefer': 'return=minimal' }, body: JSON.stringify({ approved: true }) });
    } else {
      await sbFetch('/rest/v1/er_profiles?id=eq.' + id, { method: 'DELETE', headers: { 'Prefer': 'return=minimal' } });
    }
    await loadRecords();
  } catch (e) { ui.recError = e.message; render(); }
}
async function grantReward(id, eggs, xp) {
  ui.grantBusy = id + ':' + eggs + ':' + xp; render();
  try {
    await sbFetch('/rest/v1/er_grants', { method: 'POST', headers: { 'Prefer': 'return=minimal' }, body: JSON.stringify({ user_id: id, eggs, xp }) });
    ui.grantBusy = ''; ui.recError = '';
    // 살짝 안내
    ui.grantToast = '부여 완료! 학생이 다음에 접속하면 반영돼요.';
    setTimeout(() => { ui.grantToast = ''; render(); }, 2500);
  } catch (e) { ui.grantBusy = ''; ui.recError = e.message; }
  render();
}

/* ---- 계정 관리(비밀번호 변경 · 탈퇴 · 교사의 학생 삭제) ---- */
// 본인 비밀번호 변경(Supabase Auth: 세션이 유효하면 이전 비번 없이 변경)
async function changePassword() {
  const p1 = ui.acct.pw1, p2 = ui.acct.pw2;
  if (!p1 || p1.length < 6) { ui.acct.msg = '❌ 새 비밀번호는 6자 이상이어야 해요'; render(); return; }
  if (p1 !== p2) { ui.acct.msg = '❌ 두 비밀번호가 서로 달라요'; render(); return; }
  ui.acct.busy = true; ui.acct.msg = '변경 중...'; render();
  try {
    const res = await sbFetch('/auth/v1/user', { method: 'PUT', body: JSON.stringify({ password: p1 }) });
    if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.msg || e.error_description || ('HTTP ' + res.status)); }
    ui.acct.pw1 = ''; ui.acct.pw2 = ''; ui.acct.msg = '✅ 비밀번호를 바꿨어요!';
  } catch (e) { ui.acct.msg = '❌ 실패: ' + e.message; }
  ui.acct.busy = false; render();
}
// user_id의 학습 데이터 일괄 삭제(프로필은 마지막). 로그인 계정(auth.users)은 관리자만 완전 삭제.
async function purgeUserData(id) {
  await sbFetch('/rest/v1/er_grants?user_id=eq.' + id, { method: 'DELETE', headers: { 'Prefer': 'return=minimal' } });
  await sbFetch('/rest/v1/er_records?user_id=eq.' + id, { method: 'DELETE', headers: { 'Prefer': 'return=minimal' } });
  await sbFetch('/rest/v1/er_progress?user_id=eq.' + id, { method: 'DELETE', headers: { 'Prefer': 'return=minimal' } });
  const res = await sbFetch('/rest/v1/er_profiles?id=eq.' + id, { method: 'DELETE', headers: { 'Prefer': 'return=minimal' } });
  if (!res.ok) throw new Error('프로필 삭제 실패 (HTTP ' + res.status + ')');
}
// 본인 탈퇴: 데이터 삭제 후 로그아웃
async function deleteOwnAccount() {
  if (!auth) return;
  ui.acct.busy = true; ui.acct.msg = '탈퇴 처리 중...'; render();
  try {
    await purgeUserData(auth.user.id);
    try { localStorage.removeItem(storeKey()); } catch (e) { /* 무시 */ }
    ui.acct = { open: false, busy: false, msg: '', pw1: '', pw2: '', confirmDel: false };
    doLogout(false);
    ui.authMsg = '계정에서 탈퇴했어요. 그동안 이용해 주셔서 고마워요 🐠';
    render();
  } catch (e) { ui.acct.busy = false; ui.acct.msg = '❌ 실패: ' + e.message; render(); }
}
// 교사: 학생 삭제(확인 → 데이터 정리 → 목록 갱신)
async function teacherDeleteStudent(id) {
  const p = (ui.profiles || []).find(x => x.id === id) || {};
  const name = p.name || '이 학생';
  if (!confirm(`'${name}' 학생의 계정 기록을 삭제할까요?\n프로필·학습기록·진행·보상이 모두 지워집니다. (되돌릴 수 없어요)`)) return;
  ui.grantBusy = 'del:' + id; render();
  try {
    await purgeUserData(id);
    ui.grantBusy = ''; ui.recError = '';
    await loadRecords();
  } catch (e) { ui.grantBusy = ''; ui.recError = e.message; render(); }
}
// 오늘 날짜와 같거나 가장 가까운 과거 Day를 선택(모두 미래면 첫 Day)
// 지금 화면이 '어느 반' 기준으로 콘텐츠를 볼지. null = 필터 없음(교사 대시보드/로그인 전)
function viewingClass() {
  if (isTeacherUser() && ui.asStudent) return ui.viewClass || '';        // 교사: 학생 미리보기(반 선택)
  if (auth && auth.user && !auth.user.is_teacher) return auth.user.class || '';  // 실제 학생: 자기 반
  return null;
}
// Day가 이 반에게 보이는가: 대상 반이 없으면(공통) 모두에게, 있으면 그 반에게만
function dayMatchesClass(d, cls) {
  const dc = ((d && d.class) || '').trim();
  return !dc || dc === cls;
}
function activeDay() {
  let days = contentSource().days.slice().sort((a, b) => (a.date || '').localeCompare(b.date || ''));
  const cls = viewingClass();
  if (cls !== null) {
    const m = days.filter(d => dayMatchesClass(d, cls));
    if (m.length) days = m;   // 내 반+공통이 있으면 그걸로, 하나도 없으면 안전하게 전체
  }
  const today = todayKey();
  const past = days.filter(d => (d.date || '') <= today);
  return past.length ? past[past.length - 1] : days[0];
}
function dayQuiz(cat) { return (activeDay().quiz && activeDay().quiz[cat]) || []; }

/* ---- 플래시카드(예습 살살 · 어휘 복습) 공용 헬퍼 ---- */
// 오늘(activeDay) 다음의 Day — 예습 살살에 쓰는 '다음 수업' (반 필터 반영)
function nextDayAfterActive() {
  const cur = activeDay();
  const cls = viewingClass();
  let days = contentSource().days.slice().sort((a, b) => (a.date || '').localeCompare(b.date || ''));
  if (cls !== null) { const m = days.filter(d => dayMatchesClass(d, cls)); if (m.length) days = m; }
  const after = days.filter(d => (d.date || '') > (cur.date || ''));
  return after.length ? after[0] : null;
}
// 브라우저 내장 음성으로 영어 발음 재생
function speak(text) {
  try {
    if (!window.speechSynthesis || !text) return;
    const u = new SpeechSynthesisUtterance(text);
    u.lang = 'en-US'; u.rate = 0.9;
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(u);
  } catch (e) { /* 미지원 브라우저 무시 */ }
}
// 어휘 복습 힌트: 그 단어가 들어있던 지문 문장(영어)
function wordHintSentence(word) {
  const sents = passageToReviewSentences(dayPassage(activeDay()));
  const hit = sents.find(s => s.includes('[' + word + ']'))
    || sents.find(s => new RegExp('\\b' + word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\b', 'i').test(stripBrackets(s)));
  return hit ? stripBrackets(hit) : '';
}
// 플래시카드 덱: preview=다음날 어휘 10개 / vocab=오늘 어휘(선택 개수)
function flashcardCards(mode) {
  if (mode === 'preview') return dayVocabCards(nextDayAfterActive() || activeDay()).slice(0, 10);
  return dayVocabCards(activeDay()).slice(0, state.vrCount || 0);
}
// 현재 보고 있는 플래시카드
function fcCurrentCard() {
  const mode = state.screen === 'previewVocab' ? 'preview' : 'vocab';
  const cards = flashcardCards(mode);
  return cards[Math.min(state.fcI || 0, cards.length - 1)] || null;
}
// 오늘부터 n일 뒤 날짜키(YYYY-MM-DD)
function addDaysKey(n) {
  const d = new Date(); d.setDate(d.getDate() + (n || 0));
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
// 간격반복(SM-2 간소화): 정답이면 간격↑, 오답이면 초기화
function scheduleWord(e, correct) {
  if (correct) {
    e.reps = (e.reps || 0) + 1;
    if (e.reps === 1) e.interval = 1;
    else if (e.reps === 2) e.interval = 3;
    else e.interval = Math.max(1, Math.round((e.interval || 1) * (e.ease || 2.5)));
    e.ease = Math.min(2.8, (e.ease || 2.5) + 0.1);
  } else {
    e.reps = 0; e.interval = 0; e.lapses = (e.lapses || 0) + 1;
    e.ease = Math.max(1.3, (e.ease || 2.5) - 0.2);
  }
  e.due = addDaysKey(e.interval);
}
// 오늘 복습할 단어(due <= 오늘), 예정일 빠른 순
function dueWords() {
  return (state.wordbook || []).filter(w => (w.due || todayKey()) <= todayKey())
    .sort((a, b) => (a.due || '').localeCompare(b.due || ''));
}
function shuffleArr(a) { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1));[a[i], a[j]] = [a[j], a[i]]; } return a; }
// 2단계 보통: 다음 문장으로(마지막이면 예습 완료)
function pmAdvance() {
  const sents = dayCoreSentencesRich(activeDay());
  if ((state.pmIndex || 0) >= sents.length - 1) { completeTask('preview'); return; }
  set({ pmIndex: (state.pmIndex || 0) + 1, pmPhaseIdx: 0, pmSel: [], pmMsg: '' });
}
// '몰라요' 단어를 내 단어장에 담기(중복 제거) + 클라우드 저장
function addToWordbook(card) {
  if (!card || !card.word) return;
  const wb = state.wordbook || (state.wordbook = []);
  if (wb.some(w => w.word === card.word)) return;
  const e = { word: card.word, def: card.def || '', pos: card.pos || '', ex: card.ex || '', reps: 0, interval: 0, ease: 2.5, lapses: 0, due: todayKey(), ts: Date.now() };
  wb.push(e);
  upsertWord(e);   // 클라우드에도 저장(로그인+Supabase 시)
}
// 단어 한 개를 서버에 upsert(없으면 추가, 있으면 스케줄 갱신)
async function upsertWord(e) {
  if (!sbConf() || !auth || isTeacherUser()) return;
  try {
    await sbFetch('/rest/v1/er_wordbook?on_conflict=user_id,word', {
      method: 'POST',
      headers: { 'Prefer': 'resolution=merge-duplicates,return=minimal' },
      body: JSON.stringify({ user_id: auth.user.id, word: e.word, def: e.def, pos: e.pos, ex: e.ex, reps: e.reps, interval: e.interval, ease: e.ease, lapses: e.lapses, due: e.due, updated_at: new Date().toISOString() })
    });
  } catch (err) { /* 오프라인 무시 */ }
}
// 로그인 시 서버 단어장을 내려받아 로컬과 병합(서버 우선)
async function loadWordbook() {
  if (!sbConf() || !auth || isTeacherUser()) return;
  try {
    const res = await sbFetch('/rest/v1/er_wordbook?user_id=eq.' + auth.user.id + '&select=word,def,pos,ex,reps,interval,ease,lapses,due');
    if (!res.ok) return;
    const rows = await res.json();
    const byWord = {}; (state.wordbook || []).forEach(w => { byWord[w.word] = w; });
    rows.forEach(r => { byWord[r.word] = Object.assign(byWord[r.word] || {}, r); });
    state.wordbook = Object.values(byWord);
    save();
    render();
  } catch (err) { /* 무시 */ }
}

// 오늘 할 일 구성(문항이 있는 카테고리만 노출)
const MAIN_TASKS = [
  { key: 'review',   icon: '📖',  bg: '#e0f3ea', sub: () => '단어 팝오버로 다시 읽기' },
  { key: 'sentence', icon: '🧩',  bg: '#efe7fd', sub: n => `어법 유형 문제 ${n}문항` },
  { key: 'vocab',    icon: '🔤',  bg: '#fdeede', sub: () => `플래시카드로 단어 복습 (알아요/몰라요)` },
  { key: 'preview',  icon: '👀',  bg: '#e7f0fd', sub: () => `난이도 선택 · 살살 🟢 보통 🟡 버닝 🔴` }
];
const BONUS_TASKS = [
  { key: 'vocabPrep', icon: '📘', bg: '#e7f0fd', sub: n => `다음 수업 단어 미리보기 ${n}문항` },
  { key: 'sentPrep',  icon: '✍️', bg: '#e0f3ea', sub: n => `핵심 문장 의미 미리보기 ${n}문항` },
  { key: 'grammar',   icon: '📐', bg: '#fdeede', sub: n => `시제·관계사 등 어법 ${n}문항` }
];
function taskAvailable(key) {
  if (key === 'review') return passageToReview(dayPassage(activeDay())).length > 0;
  if (key === 'vocab') return dayVocabCards(activeDay()).length > 0;   // 어휘 복습 = 플래시카드
  if (key === 'preview') {
    // 세 난이도 중 하나라도 가능하면 노출 (어휘/핵심문장/지문+이해도)
    const d = activeDay();
    return dayVocabCards(d).length > 0 || dayCoreSentences(d).length > 0 || dayPassage(d).trim().length > 0 || dayQuiz('preview').length > 0;
  }
  return dayQuiz(key).length > 0;
}
function requiredKeys() { return MAIN_TASKS.map(t => t.key).filter(taskAvailable); }

/* ---------- 상태 ---------- */
const DEFAULT_STATE = {
  role: 'student',
  screen: 'home',
  intro: true,
  introLeaving: false,
  daily: null,              // {date, tasks:{...}, rewarded} — 날마다 리셋
  eggs: 0,
  animals: [],
  xp: 0,
  pullCount: 0,
  quizTask: null, quizQi: 0, picks: {}, inputs: {}, checked: {},
  result: null,
  hatchStage: 'idle', hatchSpecies: null,
  pop: null,
  dexOpen: false,
  readerPage: 0,
  wordbook: []              // '몰라요' 한 단어 모음 [{word,def,pos,ex,ts}] (5번에서 클라우드 동기화)
};

let state = loadState();
let hatchTimer = null;
let introTimer = null;
let reviewTimer = null;
let _lastRevIndex = -1;   // 문장이 바뀔 때만 등장 애니메이션 재생(단어 탭 리렌더엔 재생 안 함)
// 지문 복습: 현재 문장을 최소 2초 읽은 뒤에야 '다음'이 열리도록
function armReviewGate() {
  ui.revReady = false;
  _lastRevIndex = -1;
  clearTimeout(reviewTimer);
  reviewTimer = setTimeout(() => { ui.revReady = true; render(); }, 2000);
}

// 화면에만 쓰이는 임시 UI 상태(저장 안 함)
const ui = {
  teacherTab: 'dash', pubMsg: '', pubBusy: false, edMsg: '',
  records: null, recLoading: false, recError: '', profiles: [],
  signupMode: false, authMsg: '', authBusy: false, asStudent: false, grantMsg: '',
  pending: [], grantBusy: '',   // 교사: 가입 대기 목록 / 부여 진행중 표시
  li: { id: '', pw: '', name: '', studentNo: '', classId: '' },   // 로그인 폼 입력값(리렌더에도 유지)
  dashClass: '',   // 교사 대시보드: 반별 보기 필터('' = 전체)
  viewClass: '',   // 교사가 학생 미리보기 시 볼 반('' = 공통만)
  presDay: null,   // 핸드폰 발표: 선택한 배포 Day 인덱스
  revReady: false, // 지문 복습: 현재 문장 2초 경과(다음 버튼 활성)
  acct: { open: false, busy: false, msg: '', pw1: '', pw2: '', confirmDel: false },   // 내 계정(비번 변경/탈퇴)
  present: { on: false, i: 0, sents: [], title: '' }   // 수업용 전체화면 발표(PPT처럼 한 문장씩)
};
// 학생 화면 상단 여백: 교사 미리보기(토글 있음)일 때만 넉넉히, 실제 학생은 좁게
function topPad() {
  if (isTeacherUser() && ui.asStudent) return classes().length ? '94px' : '52px';  // 미리보기: 역할토글+반선택 바 공간
  return isTeacherUser() ? '52px' : '28px';
}
let ed = null;  // 콘텐츠 편집기 상태 {dayIndex, day(편집용 형태)}
let gEd = null; // 전역 설정 편집(학생 명단·Supabase)

// 등장 애니메이션은 '화면이 바뀔 때'만 재생. 같은 화면의 클릭 리렌더에는 재생 안 함(위아래 움찔 방지)
let freshView = true;
let _prevViewKey = null;
function currentViewKey() {
  if (state.intro && state.role === 'student') return 'intro';
  if (state.role === 'student' && needLogin()) return 'login';
  if (state.role === 'student' && needApproval()) return 'pending';
  if (state.role === 'student' && needProfile()) return 'profile';
  if (state.role === 'teacher') return 'teacher:' + ui.teacherTab;
  return 'student:' + state.screen;
}

function loadState() {
  const saved = loadJSON(storeKey());
  const s = Object.assign({}, DEFAULT_STATE, saved || {});
  s.intro = true;            // 앱을 열 때마다 오프닝을 보여줌
  s.introLeaving = false;
  if (s.hatchStage === 'cracking') s.hatchStage = 'revealed'; // 연출 중 종료된 경우 복구
  ensureDaily(s);
  return s;
}
function ensureDaily(s) {
  if (!s.daily || s.daily.date !== todayKey()) {
    s.daily = { date: todayKey(), tasks: {}, rewarded: false };
    if (s.screen === 'quiz' || s.screen === 'result' || s.screen === 'review') s.screen = 'home';
  }
}
function save() {
  try { localStorage.setItem(storeKey(), JSON.stringify(state)); } catch (e) { /* 무시 */ }
  scheduleSync(); // 로그인 상태면 클라우드에도 동기화
}
function set(patch) {
  Object.assign(state, patch);
  save();
  render();
}

/* ---------- 파생 값 ---------- */
const level = () => Math.floor(state.xp / XP_NEED) + 1;
const xpInto = () => state.xp % XP_NEED;
const doneCount = () => requiredKeys().filter(k => state.daily.tasks[k]).length;
const speciesCount = () => new Set(state.animals).size;

// 결정적 의사난수(수조 배치가 리렌더마다 흔들리지 않게)
function rnd(i, k) {
  const x = Math.sin((i + 1) * 12.9898 + k * 78.233) * 43758.5453;
  return x - Math.floor(x);
}

/* ---------- 픽셀 스프라이트 ---------- */
function spriteHTML(id, scale, extraStyle) {
  const sp = SPECIES.find(s => s.id === id);
  if (!sp) return '';
  const cols = Math.max(...sp.px.map(r => r.length));
  let cells = '';
  sp.px.forEach(row => {
    for (let x = 0; x < cols; x++) {
      const ch = row[x] || '.';
      const color = ch === '.' ? null : sp.pal[ch];
      cells += `<div style="width:${scale}px;height:${scale}px;${color ? 'background:' + color : ''}"></div>`;
    }
  });
  return `<div style="display:grid;grid-template-columns:repeat(${cols},${scale}px);grid-auto-rows:${scale}px;line-height:0;${extraStyle || ''}">${cells}</div>`;
}

/* ---------- 수조(헤엄치는 동물 + 거품) ---------- */
function tankHTML(full) {
  let html = '';
  state.animals.forEach((id, i) => {
    const top = (8 + rnd(i, 1) * 58) + '%';
    const left = (3 + rnd(i, 6) * 10) + '%';
    const sw = (50 + rnd(i, 5) * (full ? 150 : 70)).toFixed(0) + 'px';
    const dur = (9 + rnd(i, 3) * 9).toFixed(1) + 's';
    const delay = (-rnd(i, 4) * 11).toFixed(1) + 's';
    const scale = full ? (3 + Math.floor(rnd(i, 2) * 3)) : 2;
    const bobDur = (2.6 + rnd(i, 7) * 2.4).toFixed(1) + 's';
    html += `<div style="position:absolute;top:${top};left:${left};--sw:${sw};animation:patrol ${dur} ease-in-out ${delay} infinite alternate">
      <div style="animation:bob ${bobDur} ease-in-out infinite">${spriteHTML(id, scale)}</div>
    </div>`;
  });
  for (let i = 0; i < 5; i++) {
    const sz = 5 + i % 3;
    html += `<div style="position:absolute;bottom:6%;left:${12 + i * 18}%;width:${sz}px;height:${sz}px;border-radius:50%;background:rgba(255,255,255,.5);animation:rise ${(5 + i * 1.3).toFixed(1)}s linear ${(-i * 1.7).toFixed(1)}s infinite"></div>`;
  }
  return `<div style="position:absolute;inset:0;overflow:hidden">${html}</div>`;
}

/* ---------- 도감 그리드 ---------- */
function collectionHTML() {
  const counts = {};
  state.animals.forEach(id => counts[id] = (counts[id] || 0) + 1);
  const cells = SPECIES.map(sp => {
    const c = counts[sp.id] || 0, un = c > 0, rar = RARITY[RAR[sp.id]];
    return `<div style="background:#fff;border:1px solid #e2e9f2;border-radius:14px;padding:14px 6px 9px;display:flex;flex-direction:column;align-items:center;gap:5px;position:relative;overflow:hidden">
      <div style="position:absolute;top:0;left:0;right:0;height:4px;background:${un ? rar.color : '#e2e9f2'}"></div>
      ${c > 1 ? `<div style="position:absolute;top:8px;right:7px;background:#2f74e6;color:#fff;font-size:9px;font-weight:700;border-radius:8px;padding:1px 5px">×${c}</div>` : ''}
      <div style="height:44px;display:flex;align-items:flex-end">${spriteHTML(sp.id, 4, un ? '' : 'opacity:.14;filter:grayscale(1)')}</div>
      <div style="font-size:10px;font-weight:600;color:${un ? '#14243f' : '#b8c2d2'}">${un ? sp.name : '???'}</div>
      <div style="font-size:7.5px;font-weight:700;letter-spacing:.03em;color:${un ? rar.color : '#c8d2e0'}">${un ? rar.label : '—'}</div>
    </div>`;
  }).join('');
  return `<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:9px">${cells}</div>`;
}

/* ---------- 등급 확률 안내 ---------- */
function rarityLegendHTML() {
  const order = ['normal', 'special', 'rare', 'superrare', 'unique'];
  const total = order.reduce((a, k) => a + RARITY[k].weight, 0);
  return `<div style="display:flex;flex-direction:column;gap:6px">` + order.map(k => {
    const r = RARITY[k], pct = Math.round(r.weight / total * 100);
    return `<div style="display:flex;align-items:center;gap:8px">
      <div style="width:10px;height:10px;border-radius:3px;background:${r.color}"></div>
      <div style="flex:1;font-size:11px;font-weight:700;color:#fff;letter-spacing:.03em">${r.label}</div>
      <div style="font-size:11px;color:#bcd0ea">${pct}%</div>
    </div>`;
  }).join('') + `</div>`;
}

/* ---------- 인트로 거품 ---------- */
function introBubblesHTML() {
  let b = '';
  for (let i = 0; i < 16; i++) {
    const sz = 4 + Math.round(rnd(i, 2) * 11);
    const alpha = (0.14 + rnd(i, 5) * 0.3).toFixed(2);
    const dur = (6 + rnd(i, 4) * 7).toFixed(1);
    const delay = (-rnd(i, 6) * 9).toFixed(1);
    b += `<div style="position:absolute;bottom:-24px;left:${(rnd(i, 3) * 100).toFixed(1)}%;width:${sz}px;height:${sz}px;border-radius:50%;background:rgba(255,255,255,${alpha});animation:rise ${dur}s linear ${delay}s infinite"></div>`;
  }
  return `<div style="position:absolute;inset:0;overflow:hidden">${b}</div>`;
}

/* ---------- 퀴즈 헬퍼 ---------- */
function currentQs() { return state.quizTask ? dayQuiz(state.quizTask) : []; }
function currentQ() { return currentQs()[state.quizQi] || null; }
function isRight(q, i) {
  if (!q) return false;
  if (q.type === 'mc' || q.type === 'ab') return state.picks[i] === q.answer;
  const v = NORM(state.inputs[i]);
  return !!v && (q.accept || []).some(a => NORM(a) === v || v.includes(NORM(a)));
}
function canCheck() {
  const cq = currentQ();
  if (!cq) return false;
  return (cq.type === 'mc' || cq.type === 'ab')
    ? state.picks[state.quizQi] != null
    : !!(state.inputs[state.quizQi] && state.inputs[state.quizQi].trim());
}

/* =========================================================
 * 액션
 * ========================================================= */
const actions = {
  setRoleStudent() { ui.asStudent = true; if (!ui.viewClass) ui.viewClass = classes()[0] || ''; set({ screen: 'home' }); },   // 교사: 학생 화면 미리보기
  setRoleTeacher() { ui.asStudent = false; render(); },
  setViewClass(arg) { ui.viewClass = arg || ''; set({ screen: 'home', pop: null }); },   // 교사 미리보기: 볼 반 선택

  startApp() {
    if (state.introLeaving) return;
    set({ introLeaving: true });
    clearTimeout(introTimer);
    introTimer = setTimeout(() => set({ intro: false, introLeaving: false }), 900);
  },

  goHome() { set({ screen: 'home', pop: null, dexOpen: false }); },
  goAqua() { set({ screen: 'aquarium', pop: null, dexOpen: false }); },
  goHatch() { set({ screen: 'hatchery', hatchStage: 'idle', hatchSpecies: null, pop: null, dexOpen: false }); },

  openDex() { set({ dexOpen: true }); },
  closeDex() { set({ dexOpen: false }); },

  openReader() { set({ screen: 'reader', readerBurning: false, readerPage: 0, readerBookKey: (activeDay().book || {}).title || '' }); },
  openBook(i) { const b = allBooks()[Number(i)]; if (b) set({ screen: 'reader', readerBurning: false, readerPage: 0, readerBookKey: b.title }); },
  readerPrev() { if (state.readerPage > 0) set({ readerPage: state.readerPage - 1 }); },
  readerNext() { if (state.readerPage < readerPages().length - 1) set({ readerPage: state.readerPage + 1 }); },

  startTask(t) {
    if (!taskAvailable(t)) return;
    if (t === 'review') { armReviewGate(); set({ screen: 'review', pop: null, revIndex: 0 }); }
    else if (t === 'preview') set({ screen: 'preview', pop: null });   // 3단계 난이도 선택
    else if (t === 'vocab') set({ screen: 'vocabReview', vrCount: null, fcI: 0, fcFlipped: false, fcHint: false });   // 어휘 복습(플래시카드)
    else set({ screen: 'quiz', quizTask: t, quizQi: 0, picks: {}, inputs: {}, checked: {} });
  },
  // 지문 예습 난이도 선택 — 살살: 다음날 어휘 플래시카드
  previewEasy() { if (flashcardCards('preview').length) set({ screen: 'previewVocab', fcI: 0, fcFlipped: false, fcHint: false }); },
  previewMedium() {
    if (!dayCoreSentencesRich(activeDay()).length) return;
    set({ screen: 'previewMedium', pmIndex: 0, pmPhaseIdx: 0, pmSel: [], pmMsg: '' });
  },
  previewHard() { set({ screen: 'reader', readerBurning: true, readerPage: 0 }); },
  // 2단계 보통: 주어/동사 클릭 채점
  pmToggle(arg) {
    const wi = Number(arg);
    const sel = (state.pmSel || []).slice();
    const p = sel.indexOf(wi);
    if (p >= 0) sel.splice(p, 1); else sel.push(wi);
    set({ pmSel: sel, pmMsg: '' });
  },
  pmCheck() {
    const sents = dayCoreSentencesRich(activeDay());
    const c = sents[state.pmIndex]; if (!c) return;
    const phases = ['subject', 'verb'].filter(k => (c[k] || []).length);
    const phase = phases[state.pmPhaseIdx];
    const target = (c[phase] || []).slice().sort((a, b) => a - b);
    const sel = (state.pmSel || []).slice().sort((a, b) => a - b);
    const ok = target.length === sel.length && target.every((v, i) => v === sel[i]);
    if (!ok) { set({ pmMsg: 'wrong' }); return; }
    if (state.pmPhaseIdx < phases.length - 1) { set({ pmPhaseIdx: state.pmPhaseIdx + 1, pmSel: [], pmMsg: '' }); return; }
    pmAdvance();
  },
  pmNext() { pmAdvance(); },   // 표시 마크가 없는 문장: 읽고 다음
  // 어휘 복습: 개수 선택
  vrPick(n) {
    const total = dayVocabCards(activeDay()).length;
    set({ vrCount: n === 'all' ? total : Math.min(Number(n), total), fcI: 0, fcFlipped: false, fcHint: false });
  },
  // 플래시카드 공용: 알아요/몰라요(뒤집기+발음) → 다음
  fcKnow() { const c = fcCurrentCard(); if (!c) return; speak(c.word); set({ fcFlipped: true }); },
  fcDontKnow() { const c = fcCurrentCard(); if (!c) return; speak(c.word); addToWordbook(c); set({ fcFlipped: true }); },
  fcSpeak() { const c = fcCurrentCard(); if (c) speak(c.word); },
  fcSpeakWord(arg) { speak(arg); },
  fcHint() { set({ fcHint: !state.fcHint }); },
  fcNext() {
    const mode = state.screen === 'previewVocab' ? 'preview' : 'vocab';
    const cards = flashcardCards(mode);
    if ((state.fcI || 0) >= cards.length - 1) { completeTask(mode === 'preview' ? 'preview' : 'vocab'); return; }
    set({ fcI: (state.fcI || 0) + 1, fcFlipped: false, fcHint: false });
  },
  // 오늘의 단어시험(보너스): 복습 예정 단어를 간격반복 순서로 30문항
  startWordTest() {
    const due = dueWords();
    if (!due.length) return;
    const pool = (state.wordbook || []).filter(w => w.def);
    const deck = due.slice(0, 30).map(e => {
      const others = shuffleArr(pool.filter(x => x.word !== e.word).map(x => x.def).filter(Boolean));
      const opts = shuffleArr([e.def].concat(others.slice(0, 3)));
      return { word: e.word, options: opts, answer: opts.indexOf(e.def) };
    });
    set({ screen: 'wordTest', wtDeck: deck, wtI: 0, wtPick: null, wtScore: 0, wtDone: false });
  },
  wtPick(arg) {
    if (state.wtPick != null) return;
    const i = Number(arg);
    const q = state.wtDeck[state.wtI]; if (!q) return;
    const correct = i === q.answer;
    const e = (state.wordbook || []).find(w => w.word === q.word);
    if (e) { scheduleWord(e, correct); upsertWord(e); }
    set({ wtPick: i, wtScore: state.wtScore + (correct ? 1 : 0) });
  },
  wtNext() {
    if (state.wtI >= state.wtDeck.length - 1) { set({ wtDone: true }); return; }
    set({ wtI: state.wtI + 1, wtPick: null });
  },
  previewReadDone() { completeTask('preview'); },
  goPreview() { set({ screen: 'preview' }); },
  // 버닝: 리더 끝까지 읽고 → comprehension check(quiz.preview) → 없으면 바로 완료
  burnToComprehension() {
    if (dayQuiz('preview').length) set({ screen: 'quiz', quizTask: 'preview', quizQi: 0, picks: {}, inputs: {}, checked: {}, readerBurning: false });
    else completeTask('preview');
  },
  tapWord(w) { set({ pop: state.pop === w ? null : w }); },
  reviewDone() { completeTask('review'); },
  reviewNext() {
    if (!ui.revReady) return;   // 2초 전에는 무시
    const total = passageToReviewSentences(dayPassage(activeDay())).length;
    if ((state.revIndex || 0) >= total - 1) { completeTask('review'); return; }
    armReviewGate();
    set({ revIndex: (state.revIndex || 0) + 1, pop: null });
  },

  pickOption(arg) {
    if (state.checked[state.quizQi]) return;
    const picks = Object.assign({}, state.picks);
    picks[state.quizQi] = Number(arg);
    set({ picks });
  },
  quizCheck() {
    if (!canCheck() || state.checked[state.quizQi]) return;
    const checked = Object.assign({}, state.checked);
    checked[state.quizQi] = true;
    set({ checked });
  },
  quizNext() {
    const qs = currentQs();
    if (!qs.length) return;
    if (state.quizQi < qs.length - 1) { set({ quizQi: state.quizQi + 1 }); return; }
    // 마지막 문항 → 결과 집계
    let correct = 0; const wrongs = [];
    qs.forEach((qq, i) => {
      if (isRight(qq, i)) { correct++; return; }
      const abo = qq.type === 'ab' ? abParse(qq.sentence).options : null;
      const your = qq.type === 'mc'
        ? (state.picks[i] != null ? qq.options[state.picks[i]] : '(무응답)')
        : qq.type === 'ab'
          ? (state.picks[i] != null ? abo[state.picks[i]] : '(무응답)')
          : (state.inputs[i] || '(무응답)');
      const corr = qq.type === 'mc' ? qq.options[qq.answer] : qq.type === 'ab' ? abo[qq.answer] : (qq.accept || [])[0] || '';
      wrongs.push({ prompt: qq.prompt || qq.sentence, your, correct: corr, explain: qq.explain });
    });
    set({
      screen: 'result',
      result: { task: state.quizTask, name: QUIZ_META[state.quizTask].name, total: qs.length, correct, score: Math.round(correct / qs.length * 100), wrongs }
    });
  },
  finishTask() { if (state.result) completeTask(state.result.task); },

  buyEgg() { if (state.xp < EGG_PRICE) return; set({ xp: state.xp - EGG_PRICE, eggs: state.eggs + 1 }); },
  crackEgg() {
    if (state.eggs <= 0) return;
    const pull = (state.pullCount || 0) + 1;
    // 천장(pity): 10회마다 UNIQUE, 5회마다 SUPER RARE 보장
    const rarity = pull % 10 === 0 ? 'unique' : (pull % 5 === 0 ? 'superrare' : rollRarity());
    const cands = SPECIES.filter(s => RAR[s.id] === rarity);
    const id = cands[Math.floor(Math.random() * cands.length)].id;
    clearTimeout(hatchTimer);
    set({
      hatchStage: 'cracking', hatchSpecies: id, pullCount: pull,
      eggs: state.eggs - 1, animals: state.animals.concat([id]), xp: state.xp + 40
    });
    hatchTimer = setTimeout(() => set({ hatchStage: 'revealed' }), HATCH_MS);
  },
  skipHatch() { clearTimeout(hatchTimer); set({ hatchStage: 'revealed' }); },

  /* ---- 학생 프로필(Supabase 미설정 시) ---- */
  pickProfile(name) {
    profile = name;
    localStorage.setItem(PROFILE_KEY, name);
    state = loadState();
    render();
  },
  switchProfile() {
    if (authMode()) { actions.doLogout(); return; }
    if (!roster().length) return;
    profile = '';
    localStorage.removeItem(PROFILE_KEY);
    render();
  },

  /* ---- 계정(로그인/가입/로그아웃) ---- */
  toggleSignup() { ui.signupMode = !ui.signupMode; ui.authMsg = ''; render(); },
  doLogout() { doLogout(); },
  async doLogin() { await runAuth(false); },
  async doSignup() { await runAuth(true); },
  async recheckApproval() {
    await ensureProfile();
    if (auth && auth.user.approved) { await pullProgress(); await pullGrants(); state = loadState(); state.intro = false; }
    render();
  },
  dismissGrant() { ui.grantMsg = ''; render(); },

  /* ---- 교사 ---- */
  pickClass(arg) { ui.li.classId = (ui.li.classId === arg) ? '' : arg; ui.authMsg = ''; render(); },  // 가입: 반 칩 선택/해제
  setDashClass(arg) { ui.dashClass = arg || ''; render(); },  // 대시보드: 반별 필터

  /* 내 계정(비밀번호 변경 · 탈퇴) */
  openAccount() { ui.acct = { open: true, busy: false, msg: '', pw1: '', pw2: '', confirmDel: false }; render(); },
  closeAccount() { ui.acct.open = false; ui.acct.confirmDel = false; render(); },
  changePw() { changePassword(); },
  askDeleteSelf() { ui.acct.confirmDel = true; ui.acct.msg = ''; render(); },
  cancelDeleteSelf() { ui.acct.confirmDel = false; render(); },
  deleteSelf() { deleteOwnAccount(); },
  delStudent(arg) { teacherDeleteStudent(arg); },  // 교사: 학생 삭제

  teacherTabDash() { ui.teacherTab = 'dash'; render(); if (sbConf() && isTeacherUser()) loadRecords(); },
  teacherTabContent() { ui.teacherTab = 'content'; render(); },
  dashRefresh() { loadRecords(); },
  approveStudent(id) { approveStudent(id, true); },
  rejectStudent(id) { if (confirm('이 학생의 가입 신청을 거절할까요?')) approveStudent(id, false); },
  grant(arg) { const [id, eggs, xp] = arg.split(':'); grantReward(id, Number(eggs), Number(xp)); },

  /* ---- 수업용 전체화면 발표(PPT처럼 한 문장씩) ---- */
  openPresent() {
    const days = deployedDays();
    const idx = (ui.presDay == null || ui.presDay >= days.length) ? bestDeployedDayIndex(days) : ui.presDay;
    const d = days[idx] || activeDay();
    const sents = passageToSentences(dayPassage(d));
    if (!sents.length) return;   // 지문이 없으면 버튼이 이미 비활성 안내 상태
    ui.present = { on: true, i: 0, sents, title: d.label || '' };
    requestFS();
    render();
  },
  presentNext() { const p = ui.present; if (p.on && p.i < p.sents.length - 1) { p.i++; render(); } },
  presentPrev() { const p = ui.present; if (p.on && p.i > 0) { p.i--; render(); } },
  presentGo(arg) { const p = ui.present; const i = Number(arg); if (p.on && i >= 0 && i < p.sents.length) { p.i = i; render(); } },
  presentClose() { ui.present.on = false; exitFS(); render(); },

  edSelectDay(arg) { commitDayEdit(); openDay(Number(arg)); render(); },
  edSelectDayView(arg) { ui.presDay = Number(arg); render(); },  // 발표용: 배포 Day 선택
  edAddDay() {
    commitDayEdit();
    const days = DRAFT.days;
    const tpl = clone(days[days.length - 1] || DEFAULT_CONTENT.days[0]);
    tpl.date = todayKey();
    tpl.label = `Day ${days.length + 1}`;
    days.push(tpl);
    saveDraft();
    openDay(days.length - 1);
    ui.edMsg = '새 Day를 추가했어요 (마지막 Day를 복제)';
    render();
  },
  edDelDay() {
    if (DRAFT.days.length <= 1) { ui.edMsg = '최소 1개의 Day는 남겨야 해요'; render(); return; }
    DRAFT.days.splice(ed.dayIndex, 1);
    saveDraft();
    openDay(Math.max(0, ed.dayIndex - 1));
    ui.edMsg = 'Day를 삭제했어요';
    render();
  },
  edAddQ(arg) {
    ed.day.quiz[arg].push({ type: 'mc', prompt: '', sentence: '', options: ['', '', '', ''], answer: 0, accept: '', explain: '' });
    render();
  },
  edDelQ(arg) {
    const [cat, i] = arg.split(':');
    ed.day.quiz[cat].splice(Number(i), 1);
    render();
  },
  edAddWord() { ed.day.words.push({ word: '', pos: '', def: '', ex: '' }); render(); },
  edDelWord(arg) { ed.day.words.splice(Number(arg), 1); render(); },

  edSaveDay() {
    commitDayEdit();
    commitGlobalEdit();
    ui.edMsg = '저장했어요! 이 기기의 학생 화면에 바로 반영됩니다.';
    render();
  },
  edSaveToken() {
    const el = document.getElementById('gh-token');
    if (!el) return;
    const v = el.value.trim();
    if (v) { localStorage.setItem(TOKEN_KEY, v); ui.pubMsg = '토큰을 저장했어요.'; }
    else { localStorage.removeItem(TOKEN_KEY); ui.pubMsg = '토큰을 지웠어요.'; }
    render();
  },
  edPublish() { publishContent(); },
  edDiscardDraft() {
    DRAFT = null;
    localStorage.removeItem(DRAFT_KEY);
    ed = null;
    gEd = null;
    ensureEditor();
    ui.edMsg = '초안을 버리고 배포본 기준으로 되돌렸어요.';
    render();
  }
};

function completeTask(t) {
  // 기록 전송(Supabase 설정 시) — 결과가 초기화되기 전에 먼저 보냄
  const r = state.result;
  postRecord({
    student: studentName(),
    date: todayKey(),
    task: t,
    kind: r ? 'quiz' : 'review',
    score: r ? r.score : null,
    total: r ? r.total : null,
    correct: r ? r.correct : null
  });

  const tasks = Object.assign({}, state.daily.tasks);
  const wasDone = tasks[t];
  tasks[t] = true;
  const daily = Object.assign({}, state.daily, { tasks });
  const patch = { daily, screen: 'home', quizTask: null, result: null, pop: null };
  if (!wasDone) patch.xp = state.xp + 15;
  const allDone = requiredKeys().every(k => tasks[k]);
  if (allDone && !state.daily.rewarded) { patch.eggs = state.eggs + 1; daily.rewarded = true; }
  set(patch);
}

function rollRarity() {
  const pool = [];
  Object.keys(RARITY).forEach(k => { for (let i = 0; i < RARITY[k].weight; i++) pool.push(k); });
  return pool[Math.floor(Math.random() * pool.length)];
}

function hexA(h, a) {
  const n = h.replace('#', '');
  return `rgba(${parseInt(n.slice(0, 2), 16)},${parseInt(n.slice(2, 4), 16)},${parseInt(n.slice(4, 6), 16)},${a})`;
}

/* =========================================================
 * 교사 콘텐츠 편집기
 * ========================================================= */
function ensureEditor() {
  if (!DRAFT) { DRAFT = clone(PUBLISHED || DEFAULT_CONTENT); saveDraft(); }
  if (!gEd) {
    const sb = DRAFT.supabase || {};
    gEd = { studentsText: (DRAFT.students || []).join('\n'), classesText: (DRAFT.classes || []).join('\n'), sbUrl: sb.url || '', sbKey: sb.anonKey || '' };
  }
  if (!ed) openDay(bestDayIndex());
}
function commitGlobalEdit() {
  if (!gEd || !DRAFT) return;
  DRAFT.students = gEd.studentsText.split('\n').map(s => s.trim()).filter(Boolean);
  DRAFT.classes = gEd.classesText.split('\n').map(s => s.trim()).filter(Boolean);
  DRAFT.supabase = { url: gEd.sbUrl.trim(), anonKey: gEd.sbKey.trim() };
  saveDraft();
}
function bestDayIndex() {
  const days = DRAFT.days, today = todayKey();
  let best = 0;
  days.forEach((d, i) => { if ((d.date || '') <= today && (d.date || '') >= (days[best].date || '')) best = i; });
  return best;
}
function saveDraft() {
  try { localStorage.setItem(DRAFT_KEY, JSON.stringify(DRAFT)); } catch (e) { /* 무시 */ }
}

// dayToEdit / editToDay 는 data.js(공용)에 정의되어 있습니다.

function openDay(i) {
  ed = { dayIndex: i, day: dayToEdit(DRAFT.days[i]) };
}
function commitDayEdit() {
  if (!ed || !DRAFT) return;
  DRAFT.days[ed.dayIndex] = editToDay(ed.day);
  DRAFT.days.sort((a, b) => (a.date || '').localeCompare(b.date || ''));
  // 정렬 후 현재 Day 위치 다시 찾기
  const cur = editToDay(ed.day);
  ed.dayIndex = DRAFT.days.findIndex(d => d.date === cur.date && d.label === cur.label);
  if (ed.dayIndex < 0) ed.dayIndex = 0;
  saveDraft();
}

// 점 경로("quote.en", "quiz.vocab.0.prompt")로 편집 객체에 값 쓰기
function setPath(obj, path, val) {
  const ks = path.split('.');
  let o = obj;
  for (let i = 0; i < ks.length - 1; i++) o = o[ks[i]];
  o[ks[ks.length - 1]] = val;
}

/* ---- GitHub로 배포 ---- */
async function publishContent() {
  if (ui.pubBusy) return;
  commitDayEdit();
  commitGlobalEdit();
  const token = localStorage.getItem(TOKEN_KEY);
  if (!token) { ui.pubMsg = '⚠️ 먼저 GitHub 토큰을 입력하고 저장해 주세요.'; render(); return; }
  ui.pubBusy = true; ui.pubMsg = '배포 중...'; render();
  const api = `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}`;
  const headers = { 'Authorization': 'Bearer ' + token, 'Accept': 'application/vnd.github+json' };
  // 캐시 없이 현재 파일 sha 읽기(GitHub API가 잠깐 옛 sha를 캐시로 돌려주는 문제 회피)
  const getSha = async branch => {
    const cur = await fetch(`${api}/contents/data/content.json?ref=${branch}&_=${Date.now()}`, { headers, cache: 'no-store' });
    return cur.ok ? (await cur.json()).sha : undefined;
  };
  const putOnce = (branch, sha) => {
    const body = {
      message: '콘텐츠 배포: ' + new Date().toLocaleString('ko-KR'),
      content: btoa(unescape(encodeURIComponent(JSON.stringify(DRAFT, null, 2)))),
      branch
    };
    if (sha) body.sha = sha;
    return fetch(`${api}/contents/data/content.json`, { method: 'PUT', headers, body: JSON.stringify(body) });
  };
  try {
    const repoRes = await fetch(api, { headers, cache: 'no-store' });
    if (!repoRes.ok) {
      if ([401, 403, 404].includes(repoRes.status)) throw new Error('저장소에 접근할 수 없어요 — 토큰 권한(Contents: Read and write)과 저장소 선택을 확인해 주세요. (HTTP ' + repoRes.status + ')');
      throw new Error('HTTP ' + repoRes.status);
    }
    const branch = (await repoRes.json()).default_branch || 'main';
    let res = await putOnce(branch, await getSha(branch));
    // sha 충돌(다른 곳에서 먼저 저장됨) → 최신 sha로 한 번 더 시도
    if (res.status === 409) res = await putOnce(branch, await getSha(branch));
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      if (res.status === 409) throw new Error('다른 기기·창에서 방금 먼저 배포된 것 같아요. 새로고침 후 다시 시도해 주세요 (이미 반영됐을 수도 있어요).');
      if ([401, 403].includes(res.status)) throw new Error((err.message || '권한 오류') + ' — 토큰 권한(Contents: Read and write)을 확인해 주세요.');
      throw new Error(err.message || ('HTTP ' + res.status));
    }
    PUBLISHED = clone(DRAFT);
    ui.pubMsg = '✅ 배포 완료! 1~2분 뒤 모든 기기에 반영됩니다.';
  } catch (e) {
    ui.pubMsg = '❌ 배포 실패: ' + e.message;
  }
  ui.pubBusy = false;
  render();
}

/* =========================================================
 * 화면 렌더링
 * ========================================================= */
function todayLabel() {
  const now = new Date();
  const days = ['일', '월', '화', '수', '목', '금', '토'];
  const label = activeDay().label;
  return `${now.getMonth() + 1}월 ${now.getDate()}일 ${days[now.getDay()]}요일${label ? ' · ' + label : ''}`;
}

// 교사 계정 전용: 학생 화면 미리보기 토글
function roleToggleHTML() {
  const tab = on => `font-size:12px;font-weight:600;padding:6px 16px;border-radius:999px;cursor:pointer;color:${on ? '#14243f' : '#cfe0f5'};background:${on ? '#fff' : 'transparent'}`;
  return `<div style="position:absolute;top:12px;left:50%;transform:translateX(-50%);z-index:60;display:flex;gap:3px;background:rgba(11,33,64,.55);backdrop-filter:blur(6px);-webkit-backdrop-filter:blur(6px);border-radius:999px;padding:3px;box-shadow:0 4px 14px -6px rgba(0,0,0,.5)">
    <div data-act="setRoleStudent" style="${tab(ui.asStudent)}">학생</div>
    <div data-act="setRoleTeacher" style="${tab(!ui.asStudent)}">교사</div>
  </div>`;
}

// 교사가 학생 미리보기 중일 때: 어느 반의 콘텐츠를 볼지 고르는 바(상단)
function previewClassBarHTML() {
  const cs = classes();
  if (!cs.length) return '';
  const chip = (c, label) => {
    const on = (ui.viewClass || '') === c;
    return `<div data-act="setViewClass" data-arg="${esc(c)}" style="flex:none;font-size:11.5px;font-weight:700;padding:6px 13px;border-radius:999px;cursor:pointer;white-space:nowrap;color:${on ? '#14243f' : '#eaf2ff'};background:${on ? '#fff' : 'rgba(255,255,255,.16)'};border:1px solid ${on ? '#fff' : 'rgba(255,255,255,.28)'}">${esc(label)}</div>`;
  };
  return `<div style="position:absolute;top:46px;left:10px;right:10px;z-index:59;display:flex;align-items:center;gap:6px;overflow-x:auto;padding:6px 8px;background:rgba(11,33,64,.55);backdrop-filter:blur(6px);-webkit-backdrop-filter:blur(6px);border-radius:999px;box-shadow:0 4px 14px -6px rgba(0,0,0,.5)">
    <span style="flex:none;font-size:10.5px;font-weight:700;color:#bcd4f5;padding-left:5px">미리보기 반</span>
    ${chip('', '공통')}
    ${cs.map(c => chip(c, c)).join('')}
  </div>`;
}

// 내 계정(비밀번호 변경 · 로그아웃 · 회원 탈퇴)
function accountHTML() {
  const u = (auth && auth.user) || {};
  const a = ui.acct;
  const infoRow = (k, v) => `<div style="display:flex;justify-content:space-between;font-size:12.5px;padding:3px 0"><span style="color:#7d8aa0">${k}</span><b style="color:#14243f">${v}</b></div>`;
  return `<div style="position:absolute;inset:0;z-index:70;overflow-y:auto;background:rgba(6,20,40,.55);backdrop-filter:blur(3px);-webkit-backdrop-filter:blur(3px)">
    <div data-act="closeAccount" style="position:absolute;inset:0"></div>
    <div style="position:relative;max-width:420px;margin:0 auto;min-height:100%;display:flex;align-items:center;justify-content:center;padding:24px 18px">
      <div style="width:100%;background:#fff;border-radius:22px;padding:20px 18px 18px;box-shadow:0 20px 50px -18px rgba(0,0,0,.6)">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:14px">
          <div style="font-size:16px;font-weight:800;color:#14243f">내 계정</div>
          <div data-act="closeAccount" style="font-size:16px;color:#9aa8bd;cursor:pointer;padding:4px 8px">✕</div>
        </div>
        <div style="background:#f4f8fd;border:1px solid #e2e9f2;border-radius:14px;padding:12px 14px;margin-bottom:16px">
          ${infoRow('이름', esc(u.name || ''))}
          ${infoRow('아이디', esc(u.username || ''))}
          ${u.class || u.studentNo ? infoRow('반 · 학번', `${esc(u.class || '-')}${u.studentNo ? ' · ' + esc(u.studentNo) : ''}`) : ''}
          <div style="font-size:10.5px;color:#b8c2d2;margin-top:5px">아이디는 로그인에 쓰여서 바꿀 수 없어요.</div>
        </div>

        <div style="font-size:12.5px;font-weight:700;color:#14243f;margin-bottom:7px">🔑 비밀번호 변경</div>
        <input id="acct-pw1" class="ed-input" type="password" value="${esc(a.pw1)}" placeholder="새 비밀번호 (6자 이상)" autocomplete="new-password" style="margin-bottom:6px">
        <input id="acct-pw2" class="ed-input" type="password" value="${esc(a.pw2)}" placeholder="새 비밀번호 확인" autocomplete="new-password">
        <button data-act="changePw" class="ed-btn primary" style="width:100%;margin-top:9px;${a.busy ? 'opacity:.6' : ''}">${a.busy && !a.confirmDel ? '처리 중...' : '비밀번호 변경'}</button>
        ${a.msg ? `<div style="font-size:12px;margin-top:9px;padding:9px 11px;border-radius:10px;line-height:1.5;background:${a.msg.startsWith('❌') ? '#fbe4e2' : '#e0f3ea'};color:${a.msg.startsWith('❌') ? '#b23a32' : '#1f7a4d'}">${esc(a.msg)}</div>` : ''}

        <div style="height:1px;background:#eef2f8;margin:16px 0"></div>

        ${a.confirmDel ? `
          <div style="background:#fbe4e2;border:1px solid #f3c7c2;border-radius:12px;padding:12px 13px">
            <div style="font-size:12.5px;font-weight:700;color:#b23a32">정말 탈퇴할까요?</div>
            <div style="font-size:11.5px;color:#8a4b45;line-height:1.6;margin-top:4px">내 아쿠아리움·경험치·학습기록이 모두 삭제되고 되돌릴 수 없어요.</div>
            <div style="display:flex;gap:8px;margin-top:10px">
              <button data-act="cancelDeleteSelf" class="ed-btn ghost" style="flex:1">취소</button>
              <button data-act="deleteSelf" class="ed-btn danger" style="flex:1;${a.busy ? 'opacity:.6' : ''}">${a.busy ? '처리 중...' : '탈퇴할게요'}</button>
            </div>
          </div>` : `
          <div style="display:flex;gap:8px">
            <button data-act="doLogout" class="ed-btn ghost" style="flex:1">로그아웃</button>
            <button data-act="askDeleteSelf" class="ed-btn danger" style="flex:1">회원 탈퇴</button>
          </div>`}
      </div>
    </div>
  </div>`;
}

function introHTML() {
  const leaving = state.introLeaving ? 'animation:diveOut .9s cubic-bezier(.6,0,.2,1) both' : '';
  return `<div data-act="startApp" style="position:absolute;inset:0;z-index:80;cursor:pointer;overflow:hidden;background:linear-gradient(180deg,#5aa7de 0%,#2f6fae 28%,#134279 60%,#07203f 100%);display:flex;flex-direction:column;align-items:center;justify-content:center;color:#fff;${leaving}">
    <div style="position:absolute;inset:0">${introBubblesHTML()}</div>
    <div style="position:absolute;top:-10%;left:18%;width:60%;height:80%;background:linear-gradient(180deg,rgba(255,255,255,.22),transparent);transform:skewX(-13deg);filter:blur(10px)"></div>
    <div style="position:relative;text-align:center;${freshView ? 'animation:fadeup 1.3s ease-out' : ''}">
      <div style="font-size:12px;letter-spacing:.38em;opacity:.8;text-transform:uppercase">Reading Companion</div>
      <div style="font-family:'Lora',serif;font-size:47px;font-weight:600;line-height:1.03;margin:14px 0 0;text-shadow:0 6px 26px rgba(0,0,0,.45)">Reading<br>Aquarium</div>
      <div style="font-size:12.5px;opacity:.85;margin-top:14px;font-style:italic;font-family:'Lora',serif">나와 함께 성장하는 아쿠아리움</div>
    </div>
    <div style="position:absolute;bottom:96px;text-align:center;animation:pulse 1.8s ease-in-out infinite">
      <div style="font-size:13px;font-weight:600;opacity:.95">화면을 탭하여 시작</div>
      <div style="font-size:20px;margin-top:4px">↓</div>
    </div>
    <div style="position:absolute;bottom:34px;text-align:center;opacity:.6;font-size:11px;letter-spacing:.02em">신당고등학교 · 최유림T</div>
  </div>`;
}

/* ---- 로그인/가입 폼(학생 풀스크린 + 교사 대시보드 공용) ---- */
function loginFormHTML(compact) {
  const s = ui.signupMode;
  return `
    <div style="display:flex;flex-direction:column;gap:9px">
      <input id="li-id" class="ed-input" value="${esc(ui.li.id)}" placeholder="아이디 (영문/숫자 3~20자)" autocomplete="username" style="padding:12px 14px;font-size:14px">
      <input id="li-pw" class="ed-input" type="password" value="${esc(ui.li.pw)}" placeholder="비밀번호 (6자 이상)" autocomplete="${s ? 'new-password' : 'current-password'}" style="padding:12px 14px;font-size:14px">
      ${s ? `
      <div style="display:flex;gap:8px">
        <input id="li-name" class="ed-input" value="${esc(ui.li.name)}" placeholder="이름" style="flex:1.2;padding:12px 14px;font-size:14px">
        <input id="li-studentno" class="ed-input" value="${esc(ui.li.studentNo)}" placeholder="학번" style="flex:.9;padding:12px 14px;font-size:14px">
      </div>
      ${classes().length ? `
      <div style="font-size:12px;font-weight:600;margin:2px 0 -1px;color:${compact ? '#7d8aa0' : 'rgba(255,255,255,.85)'}">반을 선택하세요</div>
      <div style="display:flex;flex-wrap:wrap;gap:7px">
        ${classes().map(c => {
          const on = ui.li.classId === c;
          const idle = compact ? 'background:#fff;border:1.5px solid #e2e9f2;color:#4a5a72' : 'background:rgba(255,255,255,.12);border:1.5px solid rgba(255,255,255,.35);color:#eaf2ff';
          const sel = 'background:#2f74e6;border:1.5px solid #2f74e6;color:#fff;box-shadow:0 4px 12px -5px rgba(47,116,230,.8)';
          return `<div data-act="pickClass" data-arg="${esc(c)}" style="flex:none;font-size:13.5px;font-weight:700;padding:10px 17px;border-radius:12px;cursor:pointer;${on ? sel : idle}">${esc(c)}</div>`;
        }).join('')}
      </div>` : ''}` : ''}
      <button data-act="${s ? 'doSignup' : 'doLogin'}" class="ed-btn primary" style="padding:13px;font-size:14px;${ui.authBusy ? 'opacity:.6' : ''}">${ui.authBusy ? '잠시만요...' : (s ? '가입하고 시작하기 🐠' : '로그인')}</button>
      ${ui.authMsg ? `<div style="font-size:12px;line-height:1.5;color:${ui.authMsg.startsWith('❌') ? '#ffb4ad' : '#dbe6f5'};background:rgba(0,0,0,${compact ? '.06' : '.25'});border-radius:10px;padding:9px 11px;${compact ? 'color:#b23a32;background:#fbe4e2' : ''}">${esc(ui.authMsg)}</div>` : ''}
      <div data-act="toggleSignup" style="text-align:center;font-size:12.5px;font-weight:600;cursor:pointer;padding:6px;${compact ? 'color:#2f74e6' : 'color:#cfe3ff;text-decoration:underline'}">${s ? '이미 계정이 있어요 → 로그인' : '처음이에요 → 가입하기'}</div>
    </div>`;
}

/* ---- 학생 로그인 화면(풀스크린, 세로 중앙 배치) ---- */
function loginScreenHTML() {
  return `<div style="position:absolute;inset:0;z-index:58;overflow-y:auto;background:linear-gradient(180deg,#5aa7de 0%,#2f6fae 28%,#134279 60%,#07203f 100%)">
    <div style="position:absolute;inset:0;pointer-events:none">${introBubblesHTML()}</div>
    <div style="position:relative;min-height:100%;display:flex;flex-direction:column;justify-content:center;padding:44px 30px 20px">
      <div style="text-align:center;color:#fff;margin-bottom:26px;${freshView ? 'animation:fadeup 1s ease-out' : ''}">
        <div style="font-size:11px;letter-spacing:.34em;opacity:.8;text-transform:uppercase">Reading Companion</div>
        <div style="font-family:'Lora',serif;font-size:38px;font-weight:600;line-height:1.05;margin-top:12px;text-shadow:0 4px 18px rgba(0,0,0,.4)">Reading<br>Aquarium</div>
        <div style="font-size:12.5px;opacity:.9;margin-top:12px;font-style:italic;font-family:'Lora',serif">나와 함께 성장하는 아쿠아리움</div>
        <div style="font-size:12px;opacity:.8;margin-top:16px">${ui.signupMode ? '아이디를 만들면 나만의 아쿠아리움이 생겨요 🐠' : '내 계정으로 이어서 키워요'}</div>
      </div>
      <div style="${freshView ? 'animation:fadeup 1.2s ease-out' : ''}">${loginFormHTML(false)}</div>
      <div style="text-align:center;color:#fff;opacity:.6;font-size:11px;margin-top:26px;letter-spacing:.02em">신당고등학교 · 최유림T</div>
    </div>
  </div>`;
}

/* ---- 승인 대기 화면 ---- */
function pendingHTML() {
  const u = auth.user;
  return `<div style="position:absolute;inset:0;z-index:58;overflow-y:auto;background:linear-gradient(180deg,#5aa7de 0%,#2f6fae 28%,#134279 60%,#07203f 100%)">
    <div style="position:absolute;inset:0;pointer-events:none">${introBubblesHTML()}</div>
    <div style="position:relative;min-height:100%;display:flex;flex-direction:column;justify-content:center;padding:44px 30px;text-align:center;color:#fff">
      <div style="font-size:52px;margin-bottom:10px">⏳</div>
      <div style="font-size:20px;font-weight:700">가입 신청이 접수됐어요</div>
      <div style="font-size:13px;opacity:.9;margin-top:12px;line-height:1.7">
        <b>${esc(u.name)}</b> (${esc(u.username)})<br>
        ${u.class ? esc(u.class) + ' · ' : ''}${u.studentNo ? '학번 ' + esc(u.studentNo) : ''}<br><br>
        선생님이 승인하면 바로 시작할 수 있어요.<br>승인 후 아래 버튼을 눌러 새로고침하세요.
      </div>
      <div style="display:flex;flex-direction:column;gap:9px;margin-top:22px">
        <button data-act="recheckApproval" class="ed-btn primary" style="padding:13px;font-size:14px">승인됐어요 · 새로고침 🔄</button>
        <div data-act="doLogout" style="text-align:center;font-size:12.5px;font-weight:600;cursor:pointer;padding:6px;color:#cfe3ff;text-decoration:underline">로그아웃</div>
      </div>
    </div>
  </div>`;
}

/* ---- 학생 이름 선택(로그인 없는 프로필) ---- */
function profilePickerHTML() {
  const cards = roster().map(n => `
    <div data-act="pickProfile" data-arg="${esc(n)}" style="display:flex;align-items:center;gap:12px;background:rgba(255,255,255,.95);border-radius:16px;padding:14px 16px;cursor:pointer;box-shadow:0 10px 24px -12px rgba(0,0,0,.5)">
      <div style="width:40px;height:40px;border-radius:13px;background:#2f74e6;color:#fff;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:14px;box-shadow:0 3px 0 #1f57c4">${esc(n.slice(0, 2))}</div>
      <div style="flex:1;font-size:15px;font-weight:700;color:#14243f">${esc(n)}</div>
      <div style="font-size:16px;color:#2f74e6">→</div>
    </div>`).join('');
  return `<div style="position:absolute;inset:0;z-index:58;overflow-y:auto;background:linear-gradient(180deg,#5aa7de 0%,#2f6fae 28%,#134279 60%,#07203f 100%)">
    <div style="position:absolute;inset:0;pointer-events:none">${introBubblesHTML()}</div>
    <div style="position:relative;padding:80px 26px 40px">
      <div style="text-align:center;color:#fff;margin-bottom:26px;${freshView ? 'animation:fadeup 1s ease-out' : ''}">
        <div style="font-size:11px;letter-spacing:.34em;opacity:.8;text-transform:uppercase">Reading Aquarium</div>
        <div style="font-size:23px;font-weight:700;margin-top:10px">누구인가요?</div>
        <div style="font-size:12.5px;opacity:.85;margin-top:6px">이름을 고르면 나만의 아쿠아리움이 열려요 🐠</div>
      </div>
      <div style="display:flex;flex-direction:column;gap:11px;${freshView ? 'animation:fadeup 1.2s ease-out' : ''}">${cards}</div>
      <div style="text-align:center;color:#fff;opacity:.6;font-size:11px;margin-top:26px">신당고등학교 · 최유림T</div>
    </div>
  </div>`;
}

/* ---- 부화 시네마틱(풀스크린) ---- */
function hatchCinematicHTML() {
  const sp = state.hatchSpecies ? SPECIES.find(x => x.id === state.hatchSpecies) : null;
  const rar = sp ? RARITY[RAR[sp.id]] : RARITY.normal;
  const c = rar.color;

  let beams = '';
  for (let i = 0; i < 14; i++) {
    beams += `<div style="position:absolute;top:0;left:-9px;width:18px;height:58vh;transform-origin:top center;transform:rotate(${i * (360 / 14)}deg);background:linear-gradient(${c}, transparent 76%);filter:blur(4px);opacity:.7;animation:beam5 5s ease-in both"></div>`;
  }
  const beamWrap = `<div style="position:absolute;top:46%;left:50%;width:0;height:0;animation:spin 26s linear infinite">${beams}</div>`;
  const glow = `<div style="position:absolute;top:46%;left:50%;width:300px;height:300px;margin-left:-150px;margin-top:-150px;border-radius:50%;background:${c};filter:blur(62px);animation:leakGrow2 5s ease-in both"></div>`;

  const shellGrad = 'radial-gradient(circle at 40% 24%, #fbf7ef, #e6dfce 58%, #c4b8a1)';
  const topPoly = 'polygon(0 0,100% 0,100% 47%,82% 42%,66% 52%,50% 41%,34% 52%,18% 42%,0 47%)';
  const botPoly = 'polygon(0 47%,18% 42%,34% 52%,50% 41%,66% 52%,82% 42%,100% 47%,100% 100%,0 100%)';
  const cup = `<div style="position:absolute;inset:0;border-radius:50% 50% 50% 50% / 60% 60% 42% 42%;background:${shellGrad};clip-path:${botPoly};box-shadow:inset -10px -14px 26px rgba(0,0,0,.2);z-index:2"></div>`;
  const lid = `<div style="position:absolute;inset:0;border-radius:50% 50% 50% 50% / 60% 60% 42% 42%;background:${shellGrad};clip-path:${topPoly};box-shadow:inset -8px -5px 16px rgba(0,0,0,.13);transform-origin:76% 56%;animation:lidOpen 5s cubic-bezier(.3,1.45,.5,1) both;z-index:3"></div>`;

  // 균열이 지그재그 이음선을 따라 번져나감(쩌저적)
  const verts = [[0, 92], [18, 84], [34, 100], [50, 82], [66, 100], [82, 84], [100, 92]];
  const W = 150;
  let segs = '';
  for (let i = 0; i < verts.length - 1; i++) {
    const x1 = verts[i][0] / 100 * W, y1 = verts[i][1], x2 = verts[i + 1][0] / 100 * W, y2 = verts[i + 1][1];
    const dx = x2 - x1, dy = y2 - y1, len = Math.sqrt(dx * dx + dy * dy), ang = Math.atan2(dy, dx) * 180 / Math.PI;
    segs += `<div style="position:absolute;left:${x1}px;top:${y1}px;width:${len}px;height:4px;background:${c};box-shadow:0 0 9px 1px ${c};transform-origin:0 50%;transform:rotate(${ang.toFixed(1)}deg);border-radius:2px;animation:crackSeg .4s ease-out ${(0.9 + i * 0.45).toFixed(2)}s both;z-index:5"></div>`;
  }

  const fish = `<div style="position:absolute;top:46%;left:50%;animation:fishPop 5s cubic-bezier(.3,1.4,.5,1) both;z-index:4">${spriteHTML(sp ? sp.id : 'fish', 7)}</div>`;
  const eggWrap = `<div style="position:relative;width:150px;height:196px;animation:eggShake 5s ease-in-out both">${cup}${fish}${lid}${segs}</div>`;
  const label = `<div style="color:#fff;font-size:12.5px;font-weight:700;letter-spacing:.16em;white-space:nowrap;text-shadow:0 2px 8px rgba(0,0,0,.5);margin-top:26px;animation:labelFade 5s ease-in-out both">부화 중...</div>`;
  const flash = `<div style="position:absolute;inset:0;background:${c};opacity:0;animation:popFlash 5s ease-in both;pointer-events:none;z-index:6"></div>`;
  const tint = `<div style="position:absolute;inset:0;background:radial-gradient(90% 70% at 50% 46%, ${hexA(c, .32)}, transparent 62%);pointer-events:none"></div>`;

  return `<div style="position:absolute;inset:0;z-index:85;overflow:hidden">
    <div style="position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;overflow:hidden;background:#05101f">
      ${tint}${beamWrap}${glow}
      <div style="position:relative;display:flex;flex-direction:column;align-items:center;z-index:2">${eggWrap}${label}</div>
      ${flash}
    </div>
    <div data-act="skipHatch" style="position:absolute;bottom:22px;right:20px;z-index:90;background:rgba(255,255,255,.16);backdrop-filter:blur(6px);-webkit-backdrop-filter:blur(6px);border:1px solid rgba(255,255,255,.32);color:#fff;font-size:12px;font-weight:600;padding:9px 16px;border-radius:999px;cursor:pointer">스킵하기 ›</div>
  </div>`;
}

/* ---- 홈 ---- */
function homeHTML() {
  const day = activeDay();
  const t = state.daily.tasks;
  const row = done => `display:flex;align-items:center;gap:12px;background:#fff;border:1.5px solid ${done ? '#cfe6da' : '#e2e9f2'};border-radius:16px;padding:13px 15px;cursor:pointer;opacity:${done ? '.72' : '1'}`;
  const badge = done => done
    ? `<div style="font-size:11px;font-weight:700;color:#2fa36b">완료 ✓</div>`
    : `<div style="font-size:11px;font-weight:700;color:#2f74e6">시작 →</div>`;
  const taskRow = cfg => {
    if (!taskAvailable(cfg.key)) return '';
    const n = dayQuiz(cfg.key).length;
    return `<div data-act="startTask" data-arg="${cfg.key}" style="${row(t[cfg.key])}">
      <div style="width:40px;height:40px;border-radius:12px;background:${cfg.bg};display:flex;align-items:center;justify-content:center;font-size:19px">${cfg.icon}</div>
      <div style="flex:1"><div style="font-size:14px;font-weight:600;color:#14243f">${QUIZ_META[cfg.key] ? QUIZ_META[cfg.key].name : '지문 복습'}</div><div style="font-size:11px;color:#7d8aa0;margin-top:1px">${cfg.sub(n)}</div></div>
      ${badge(t[cfg.key])}
    </div>`;
  };

  const req = requiredKeys();
  const done = doneCount();
  const enter = (!state.intro && freshView) ? 'animation:riseIn .8s cubic-bezier(.2,.7,.2,1) both' : '';

  const eggBanner = state.eggs > 0 ? `
    <div data-act="goHatch" style="display:flex;align-items:center;gap:13px;background:#fff8e6;border:1.5px solid #f0c65a;border-radius:18px;padding:14px 16px;margin-bottom:18px;cursor:pointer;box-shadow:0 8px 20px -12px rgba(240,169,46,.6)">
      <div style="animation:floaty 2.2s ease-in-out infinite;font-size:30px">🥚</div>
      <div style="flex:1"><div style="font-size:13.5px;font-weight:700;color:#8a6412">새로운 알이 도착했어요!</div><div style="font-size:11.5px;color:#b08a2e;margin-top:2px">보유 알 ${state.eggs}개 · 탭해서 부화시키기</div></div>
      <div style="font-size:18px;color:#c9922a">→</div>
    </div>` : '';

  const bonusRows = BONUS_TASKS.map(taskRow).join('');
  const dueN = dueWords().length;
  const wordTestCard = (state.wordbook && state.wordbook.length) ? `
    <div ${dueN ? 'data-act="startWordTest"' : ''} style="display:flex;align-items:center;gap:13px;background:#fff;border:1px solid #e2e9f2;border-radius:16px;padding:13px 15px;cursor:${dueN ? 'pointer' : 'default'};opacity:${dueN ? '1' : '.6'}">
      <div style="width:40px;height:40px;border-radius:12px;background:#e7f0fd;display:flex;align-items:center;justify-content:center;font-size:19px">📒</div>
      <div style="flex:1"><div style="font-size:14px;font-weight:600;color:#14243f">오늘의 단어시험</div><div style="font-size:11px;color:#7d8aa0;margin-top:1px">${dueN ? `복습할 단어 ${dueN}개 · 망각곡선 맞춤 출제` : '오늘 복습할 단어가 없어요 — 잘하고 있어요!'}</div></div>
      <div style="font-size:11px;font-weight:700;color:${dueN ? '#2f74e6' : '#b8c2d2'}">${dueN ? '시작 →' : '—'}</div>
    </div>` : '';

  return `<div style="${enter}"><div style="padding:${topPad()} 20px 96px">
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px">
      <div ${!authMode() && roster().length ? 'data-act="switchProfile"' : ''} style="display:flex;align-items:center;gap:11px;${!authMode() && roster().length ? 'cursor:pointer' : ''}" ${!authMode() && roster().length ? 'title="탭해서 다른 친구로 바꾸기"' : ''}>
        <div style="width:44px;height:44px;border-radius:14px;background:#2f74e6;color:#fff;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:16px;box-shadow:0 4px 0 #1f57c4">${esc(studentName().slice(0, 2))}</div>
        <div>
          <div style="font-size:16px;font-weight:700;color:#14243f">안녕하세요, ${esc(studentName())}님 👋</div>
          <div style="font-size:11.5px;color:#7d8aa0;margin-top:2px">${esc(todayLabel())}</div>
        </div>
      </div>
      <div data-act="goAqua" style="display:flex;align-items:center;gap:6px;background:#fff;border:1px solid #e2e9f2;border-radius:14px;padding:7px 11px;cursor:pointer;box-shadow:0 3px 8px -4px rgba(20,36,63,.3)">
        <span style="font-size:15px">🐚</span>
        <div style="line-height:1"><div style="font-size:9px;color:#7d8aa0">레벨</div><div style="font-size:14px;font-weight:700;color:#2f74e6">Lv.${level()}</div></div>
      </div>
    </div>

    ${day.quote && day.quote.en ? `
    <div style="position:relative;background:linear-gradient(150deg,#1f57c4,#2f74e6 55%,#17b0c4);border-radius:22px;padding:20px 20px 18px;color:#fff;box-shadow:0 14px 30px -14px rgba(31,87,196,.7);overflow:hidden;margin-bottom:20px">
      <div style="position:absolute;top:-14px;left:14px;font-family:'Lora',serif;font-size:90px;line-height:1;color:rgba(255,255,255,.16);font-style:italic">“</div>
      <div style="position:relative">
        <div style="font-size:10.5px;font-weight:600;letter-spacing:.06em;opacity:.85;text-transform:uppercase">오늘 선생님이 고른 문장</div>
        <div style="font-family:'Lora',serif;font-size:17px;line-height:1.55;margin:9px 0 8px">"${esc(day.quote.en)}"</div>
        <div style="font-size:13px;line-height:1.5;color:#e4f0ff">${esc(day.quote.ko)}</div>
        ${day.quote.teacher || day.quote.comment ? `
        <div style="display:flex;align-items:center;gap:7px;margin-top:12px;padding-top:11px;border-top:1px solid rgba(255,255,255,.22)">
          <div style="width:22px;height:22px;border-radius:50%;background:rgba(255,255,255,.25);display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:700">${esc((day.quote.teacher || '샘').slice(0, 1))}</div>
          <span style="font-size:11.5px;opacity:.9">${esc(day.quote.teacher)}의 한마디${day.quote.comment ? ' · ' + esc(day.quote.comment) : ''}</span>
        </div>` : ''}
      </div>
    </div>` : ''}

    ${dayPassage(day).trim() ? `
    <div style="font-size:12px;font-weight:700;color:#7d8aa0;letter-spacing:.02em;margin-bottom:9px">지금 읽는 책</div>
    <div data-act="openReader" style="display:flex;gap:14px;background:#fff;border:1px solid #e2e9f2;border-radius:18px;padding:14px;margin-bottom:20px;cursor:pointer;box-shadow:0 8px 20px -14px rgba(20,50,90,.5)">
      <div style="position:relative;flex:none;width:58px;height:80px">
      ${dayCover(day)
        ? `<img src="${esc(dayCover(day))}" alt="" style="width:58px;height:80px;border-radius:8px;object-fit:cover;box-shadow:0 4px 10px -4px rgba(31,87,196,.5);display:block">`
        : `<div style="width:58px;height:80px;border-radius:8px;background:linear-gradient(150deg,#1f57c4,#17b0c4);box-shadow:0 4px 10px -4px rgba(31,87,196,.7);position:relative;overflow:hidden">
        <div style="position:absolute;top:0;left:8px;bottom:0;width:2px;background:rgba(255,255,255,.35)"></div>
        <div style="position:absolute;bottom:9px;left:12px;right:8px;font-family:'Lora',serif;font-size:9px;line-height:1.2;color:#fff;font-style:italic">${esc((day.book.title || '').split(' ').slice(-2).join(' ').toLowerCase())}</div>
      </div>`}
        ${chapterTag(day.book.chapter) ? `<div style="position:absolute;top:5px;left:5px;background:rgba(15,30,55,.85);color:#fff;font-size:9px;font-weight:800;line-height:1;padding:3px 6px;border-radius:6px;box-shadow:0 1px 4px rgba(0,0,0,.4)">${esc(chapterTag(day.book.chapter))}</div>` : ''}
      </div>
      <div style="flex:1;display:flex;flex-direction:column">
        <div style="font-family:'Lora',serif;font-size:15px;font-weight:600;color:#14243f;line-height:1.3">${esc(day.book.title)}</div>
        <div style="font-size:11.5px;color:#7d8aa0;margin-top:2px">${esc(day.book.author)}</div>
        <div style="font-size:11px;color:#90867c;margin-top:6px">${esc(day.book.chapter)}</div>
        <div style="margin-top:auto;display:flex;align-items:center;gap:8px">
          <div style="flex:1;height:6px;border-radius:3px;background:#e7edf5;overflow:hidden"><div style="height:100%;width:${readerProgress()};background:linear-gradient(90deg,#2f74e6,#17b0c4);border-radius:3px"></div></div>
          <span style="font-size:11px;font-weight:700;color:#2f74e6">이어 읽기 →</span>
        </div>
      </div>
    </div>` : ''}

    ${ui.grantMsg ? `<div data-act="dismissGrant" style="display:flex;align-items:center;gap:11px;background:linear-gradient(150deg,#fff0d0,#ffe0a8);border:1.5px solid #f0c65a;border-radius:16px;padding:13px 15px;margin-bottom:16px;cursor:pointer">
      <div style="font-size:24px">🎁</div>
      <div style="flex:1;font-size:13px;font-weight:700;color:#8a6412">${esc(ui.grantMsg)}</div>
      <div style="font-size:15px;color:#c9922a">✕</div>
    </div>` : ''}

    ${eggBanner}

    <div style="display:flex;align-items:baseline;justify-content:space-between;margin-bottom:11px">
      <div style="font-size:14px;font-weight:700;color:#14243f">오늘 할 일</div>
      <div style="font-size:12px;font-weight:600;color:#2f74e6">${done}/${req.length} 완료</div>
    </div>
    <div style="height:8px;border-radius:4px;background:#dde6f1;overflow:hidden;margin-bottom:6px"><div style="height:100%;border-radius:4px;background:linear-gradient(90deg,#2f74e6,#17b0c4);width:${req.length ? done / req.length * 100 : 0}%"></div></div>
    <div style="font-size:11px;color:#7d8aa0;margin-bottom:14px">${req.length}개를 모두 끝내면 랜덤 알을 하나 받아요 🥚 (매일 리셋)</div>

    <div style="display:flex;flex-direction:column;gap:10px">
      ${MAIN_TASKS.map(taskRow).join('')}
    </div>

    ${(bonusRows || wordTestCard) ? `
    <div style="font-size:13px;font-weight:700;color:#14243f;margin:20px 0 4px">더 해보기</div>
    <div style="font-size:11px;color:#7d8aa0;margin-bottom:11px">보너스 학습 · 원할 때 자유롭게</div>
    <div style="display:flex;flex-direction:column;gap:10px">${wordTestCard}${bonusRows}</div>` : ''}

    ${shelfHTML()}

    ${authMode() ? `
    <div style="margin-top:26px;display:flex;justify-content:center;gap:8px">
      <div data-act="openAccount" style="display:inline-flex;align-items:center;gap:6px;font-size:12.5px;font-weight:600;color:#4a5a72;background:#fff;border:1px solid #e2e9f2;border-radius:12px;padding:10px 18px;cursor:pointer">⚙️ 내 계정</div>
      <div data-act="doLogout" style="display:inline-flex;align-items:center;gap:6px;font-size:12.5px;font-weight:600;color:#7d8aa0;background:#fff;border:1px solid #e2e9f2;border-radius:12px;padding:10px 18px;cursor:pointer">↩︎ 로그아웃</div>
    </div>` : ''}

  </div></div>`;
}

/* ---- 홈 하단 서가(자유 읽기) ---- */
const SPINE_COLORS = [
  ['#1f57c4', '#2f74e6'], ['#17827a', '#1fae9e'], ['#b8480f', '#e0691f'],
  ['#6d3fb0', '#8a5fd6'], ['#a5760f', '#d19a1a'], ['#b23a5c', '#e05a80'],
  ['#2a6b4f', '#3e9a72'], ['#3a4a6b', '#5f74a0']
];
// 챕터 문자열 → 짧은 배지("Ch.1"). 숫자를 못 찾으면 짧은 라벨은 그대로, 아니면 빈 값.
function chapterTag(chapter) {
  const s = (chapter || '').trim();
  if (!s) return '';
  const m = s.match(/(?:ch(?:apter|apt|\.)?|챕터|제)\s*0*(\d+)/i) || s.match(/\b0*(\d+)\b/);
  if (m) return 'Ch.' + m[1];
  return s.length <= 5 ? s : '';
}
// 서가 책(챕터 여러 개 병합 가능) → 대표 챕터 배지. 여러 챕터면 범위로("Ch.1–3").
function bookChapterTag(b) {
  const tags = ((b && b.chapters) || []).map(c => chapterTag(c.chapter)).filter(Boolean);
  if (!tags.length) return chapterTag(b && b.chapter);
  if (tags.length === 1) return tags[0];
  const nums = tags.map(t => parseInt(t.replace(/\D/g, ''), 10)).filter(n => !isNaN(n));
  if (nums.length === tags.length) return 'Ch.' + Math.min(...nums) + '–' + Math.max(...nums);
  return tags[0];
}
// 지문(본문) 글자 수에 비례한 책등 너비(px). 본문이 많을수록 두껍게 — 실제 책처럼.
function spineWidth(b) {
  const len = ((b && b.passage) || '').replace(/\s+/g, ' ').trim().length;
  const t = Math.min(1, Math.max(0, (len - 500) / 3500));
  return Math.round(28 + t * 40); // 28 ~ 68px
}
// 책등 위 챕터 배지(이미지·자동생성 공통)
function spineChapterBadge(tag) {
  if (!tag) return '';
  return `<div style="position:absolute;top:5px;left:50%;transform:translateX(-50%);z-index:3;background:rgba(15,30,55,.82);color:#fff;font-size:8px;font-weight:800;letter-spacing:.01em;line-height:1;padding:3px 5px;border-radius:5px;white-space:nowrap;box-shadow:0 1px 3px rgba(0,0,0,.45)">${esc(tag)}</div>`;
}
function shelfHTML() {
  const books = allBooks();
  if (!books.length) return '';
  const spines = books.map((b, i) => {
    const [c1, c2] = SPINE_COLORS[i % SPINE_COLORS.length];
    const w = spineWidth(b);
    const badge = spineChapterBadge(bookChapterTag(b));
    const inner = b.spine
      ? `<img src="${esc(b.spine)}" alt="${esc(b.title)}" style="width:100%;height:100%;object-fit:cover;display:block" onerror="this.parentElement.dataset.fallback='1';this.remove()">`
      : `<div style="position:absolute;inset:0;background:linear-gradient(90deg,${c1},${c2});display:flex;align-items:center;justify-content:center">
           <div style="writing-mode:vertical-rl;transform:rotate(180deg);font-family:'Lora',serif;font-size:11px;font-weight:600;color:rgba(255,255,255,.95);letter-spacing:.02em;white-space:nowrap;max-height:110px;overflow:hidden;text-overflow:ellipsis;padding:6px 0">${esc(b.title)}</div>
         </div>`;
    return `<div data-act="openBook" data-arg="${i}" title="${esc(b.title)}" style="flex:none;position:relative;width:${w}px;height:140px;border-radius:2px 5px 5px 2px;overflow:hidden;cursor:pointer;box-shadow:2px 3px 8px -3px rgba(20,40,70,.55),inset -3px 0 5px -3px rgba(0,0,0,.4);background:linear-gradient(90deg,${c1},${c2})">
      <div style="position:absolute;top:0;bottom:0;left:3px;width:2px;background:rgba(255,255,255,.25)"></div>
      ${inner}
      ${badge}
    </div>`;
  }).join('');
  return `
    <div style="display:flex;align-items:baseline;justify-content:space-between;margin:24px 0 4px">
      <div style="font-size:13px;font-weight:700;color:#14243f">📚 나의 서가</div>
      <div style="font-size:11px;color:#7d8aa0">${books.length}권 · 자유롭게 읽어요</div>
    </div>
    <div style="background:linear-gradient(180deg,#fbf7ef,#f1e7d6);border:1px solid #e6dcc7;border-radius:16px;padding:16px 14px 0;box-shadow:inset 0 2px 8px -4px rgba(120,90,40,.25)">
      <div style="display:flex;gap:8px;align-items:flex-end;overflow-x:auto;padding-bottom:0">${spines}</div>
      <div style="height:12px;margin:0 -14px;background:linear-gradient(180deg,#caa96e,#a9834f);border-top:2px solid #8a6836;box-shadow:0 4px 8px -4px rgba(90,60,20,.5)"></div>
    </div>`;
}

/* ---- 아쿠아리움 ---- */
function aquariumHTML() {
  const eggCTA = state.eggs > 0 ? `
    <div data-act="goHatch" style="position:absolute;top:150px;left:20px;right:20px;background:rgba(255,255,255,.94);border-radius:14px;padding:11px 14px;display:flex;align-items:center;gap:10px;cursor:pointer;box-shadow:0 10px 24px -12px rgba(0,0,0,.5);z-index:15">
      <div style="animation:floaty 2.2s ease-in-out infinite;font-size:22px">🥚</div>
      <div style="flex:1"><div style="font-size:12.5px;font-weight:700;color:#14243f">알 ${state.eggs}개 부화 가능</div></div>
      <div style="background:#2f74e6;color:#fff;font-size:11px;font-weight:700;padding:7px 12px;border-radius:9px">부화장 →</div>
    </div>` : '';

  const emptyHint = state.animals.length === 0 ? `
    <div style="position:absolute;left:0;right:0;top:44%;text-align:center;color:#fff;padding:0 40px;pointer-events:none">
      <div style="font-size:40px;margin-bottom:10px">🫧</div>
      <div style="font-size:13.5px;font-weight:600">아직 텅 비었어요</div>
      <div style="font-size:12px;opacity:.85;margin-top:6px;line-height:1.6">할 일을 마치면 알을 받고,<br>부화시키면 이곳에 친구가 헤엄쳐요!</div>
    </div>` : '';

  const dex = state.dexOpen ? `
    <div data-act="closeDex" style="position:absolute;inset:0;background:rgba(6,20,40,.55);backdrop-filter:blur(2px);-webkit-backdrop-filter:blur(2px);z-index:55"></div>
    <div style="position:absolute;left:0;right:0;bottom:0;max-height:80%;overflow-y:auto;background:#eef3fa;border-radius:26px 26px 0 0;padding:14px 18px 30px;z-index:56;box-shadow:0 -16px 44px -10px rgba(0,0,0,.55)">
      <div style="display:flex;justify-content:center;margin-bottom:12px"><div style="width:40px;height:5px;border-radius:3px;background:#c8d4e2"></div></div>
      <div style="display:flex;align-items:baseline;justify-content:space-between;margin-bottom:14px">
        <div style="font-size:15px;font-weight:700;color:#14243f">도감</div>
        <div style="font-size:12px;color:#7d8aa0">${speciesCount()} / ${SPECIES.length} 종 발견</div>
      </div>
      ${collectionHTML()}
      <div data-act="closeDex" style="margin-top:16px;text-align:center;background:#2f74e6;color:#fff;font-size:13px;font-weight:600;padding:12px;border-radius:14px;cursor:pointer">닫기</div>
    </div>` : '';

  return `<div style="position:absolute;inset:0;overflow:hidden;background:linear-gradient(180deg,#5bb3de 0%,#3487c4 18%,#1d63a2 40%,#123f74 66%,#0a2a52 100%)">
    <div style="position:absolute;inset:0">${tankHTML(true)}</div>
    <div style="position:absolute;top:-8%;left:12%;width:46%;height:66%;background:linear-gradient(180deg,rgba(255,255,255,.20),transparent);transform:skewX(-13deg);filter:blur(16px);pointer-events:none"></div>
    <div style="position:absolute;top:-6%;right:16%;width:26%;height:52%;background:linear-gradient(180deg,rgba(255,255,255,.14),transparent);transform:skewX(10deg);filter:blur(14px);pointer-events:none"></div>
    <div style="position:absolute;left:0;right:0;bottom:0;height:96px;background:linear-gradient(180deg,rgba(216,193,132,0),#d8c184 80%);pointer-events:none"></div>

    <div style="position:relative;padding:${topPad()} 20px 0;color:#fff;pointer-events:none">
      <div style="display:flex;align-items:center;justify-content:space-between">
        <div>
          <div style="font-size:19px;font-weight:700;text-shadow:0 2px 8px rgba(0,0,0,.4)">나의 아쿠아리움</div>
          <div style="font-size:12px;opacity:.92;margin-top:2px;text-shadow:0 1px 5px rgba(0,0,0,.35)">Lv.${level()} 사육사 · ${state.animals.length}마리 사육 중</div>
        </div>
        <div style="text-align:right;background:rgba(11,33,64,.4);backdrop-filter:blur(4px);-webkit-backdrop-filter:blur(4px);border-radius:14px;padding:8px 12px">
          <div style="font-size:10px;opacity:.85">보유 알</div>
          <div style="font-size:16px;font-weight:700">🥚 ${state.eggs}</div>
        </div>
      </div>
      <div style="margin-top:12px;background:rgba(11,33,64,.3);backdrop-filter:blur(4px);-webkit-backdrop-filter:blur(4px);border-radius:12px;padding:9px 12px">
        <div style="display:flex;justify-content:space-between;align-items:baseline;font-size:10.5px;opacity:.92;margin-bottom:5px;white-space:nowrap"><span>다음 레벨까지</span><span>${xpInto()} / ${XP_NEED} XP</span></div>
        <div style="height:7px;border-radius:4px;background:rgba(255,255,255,.25);overflow:hidden"><div style="height:100%;background:#ffd76a;border-radius:4px;width:${xpInto() / XP_NEED * 100}%"></div></div>
      </div>
    </div>

    ${eggCTA}
    ${emptyHint}

    <div data-act="openDex" style="position:absolute;left:50%;transform:translateX(-50%);bottom:82px;display:flex;align-items:center;gap:8px;background:#fff;border-radius:999px;padding:11px 18px;box-shadow:0 8px 22px -8px rgba(0,0,0,.55);cursor:pointer;z-index:20">
      <span style="font-size:16px">📖</span>
      <span style="font-size:13px;font-weight:700;color:#14243f">도감</span>
      <span style="font-size:11px;font-weight:700;color:#2f74e6;background:#e7f0fd;border-radius:8px;padding:2px 7px">${speciesCount()}/${SPECIES.length}</span>
    </div>

    ${dex}
  </div>`;
}

/* ---- 지문 복습 ---- */
function reviewHTML() {
  const words = dayVocab(activeDay());
  const sents = passageToReviewSentences(dayPassage(activeDay()));
  const total = sents.length || 1;
  const i = Math.min(state.revIndex || 0, total - 1);
  const last = i >= total - 1;
  const sentence = sents[i] || '';
  const animate = _lastRevIndex !== i; _lastRevIndex = i;   // 문장 바뀔 때만 페이드

  const wordStyle = active => `background:${active ? '#2f74e6' : '#e7f0fd'};color:${active ? '#fff' : 'inherit'};border-bottom:2px solid #2f74e6;border-radius:3px;padding:0 3px;cursor:pointer`;
  const sentHTML = esc(sentence).replace(/\[([^\]]+)\]/g, (m, w) =>
    words[w]
      ? `<span data-act="tapWord" data-arg="${esc(w)}" style="${wordStyle(state.pop === w)}">${esc(w)}</span>`
      : esc(w));
  const pop = state.pop && words[state.pop] && sentence.includes('[' + state.pop + ']')
    ? Object.assign({ word: state.pop }, words[state.pop]) : null;
  const popHTML = pop ? `
    <div style="font-family:'IBM Plex Sans KR',sans-serif;background:#14243f;color:#fff;border-radius:14px;padding:13px 15px;margin:18px 0 0;box-shadow:0 14px 30px -12px rgba(0,0,0,.5);text-align:left">
      <div style="display:flex;align-items:baseline;gap:9px"><span style="font-family:'Lora',serif;font-size:16px;font-weight:700">${esc(pop.word)}</span><span style="font-size:11px;color:#7fd0e6">${esc(pop.pos)}</span></div>
      <div style="font-size:13px;color:#dbe6f5;margin-top:5px">${esc(pop.def)}</div>
      ${pop.ex ? `<div style="font-size:12px;color:#93a6c2;margin-top:6px;font-style:italic;font-family:'Lora',serif">${esc(pop.ex)}</div>` : ''}
    </div>` : '';

  const btn = ui.revReady
    ? `<button data-act="reviewNext" style="width:100%;border:none;background:${last ? '#2fa36b' : '#2f74e6'};color:#fff;font-size:14px;font-weight:700;padding:14px;border-radius:15px;box-shadow:0 5px 0 ${last ? '#1f7a4d' : '#1f57c4'};cursor:pointer">${last ? '복습 완료 ✓' : '다음 문장 →'}</button>`
    : `<button disabled style="width:100%;border:none;background:#c3d2e6;color:#fff;font-size:13.5px;font-weight:600;padding:14px;border-radius:15px;cursor:default">잠깐 읽어볼까요… ⏳</button>`;

  return `<div style="position:absolute;inset:0;display:flex;flex-direction:column;padding:${topPad()} 20px 24px">
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px">
      <div data-act="goHome" style="display:flex;align-items:center;gap:8px;cursor:pointer"><div style="width:30px;height:30px;border-radius:10px;background:#e7f0fd;color:#2f74e6;display:flex;align-items:center;justify-content:center">←</div><span style="font-size:13px;font-weight:600;color:#14243f">지문 복습</span></div>
      <div style="font-size:12px;font-weight:700;color:#7d8aa0">${i + 1} / ${total}</div>
    </div>
    <div style="height:5px;border-radius:3px;background:#e7edf5;overflow:hidden;margin-bottom:6px"><div style="height:100%;width:${Math.round((i + 1) / total * 100)}%;background:linear-gradient(90deg,#2f74e6,#17b0c4);border-radius:3px;transition:width .3s"></div></div>
    <div style="flex:1;overflow-y:auto;display:flex;flex-direction:column;justify-content:center;padding:10px 4px">
      <div style="font-family:'Lora',serif;font-size:23px;line-height:1.75;color:#26303f;text-align:center;${animate ? 'animation:fadeup .35s ease' : ''}">${sentHTML}</div>
      ${popHTML}
    </div>
    <div style="font-size:11px;color:#9aa8bd;text-align:center;margin-bottom:10px">밑줄 친 단어를 탭하면 뜻이 나와요</div>
    ${btn}
  </div>`;
}

/* ---- 퀴즈 ---- */
function quizHTML() {
  const qs = currentQs(), cq = currentQ();
  if (!qs.length || !cq) return homeHTML();
  const qi = state.quizQi;
  const meta = QUIZ_META[state.quizTask];
  const checked = !!state.checked[qi];
  const pct = ((qi + (checked ? 1 : 0)) / qs.length * 100).toFixed(0);
  const tagBg = cq.type === 'input' ? '#efe7fd' : '#dff0f3';
  const tagFg = cq.type === 'input' ? '#7a5bd0' : '#178a9c';

  let body = '';
  if (cq.type === 'mc') {
    body = `<div style="display:flex;flex-direction:column;gap:10px;margin-top:8px">` + cq.options.map((txt, i) => {
      const picked = state.picks[qi] === i, correct = i === cq.answer;
      let bg = '#fff', bd = '#e2e9f2', bbg = '#eef2f8', bfg = '#7d8aa0';
      if (!checked && picked) { bg = '#e7f0fd'; bd = '#2f74e6'; bbg = '#2f74e6'; bfg = '#fff'; }
      if (checked && correct) { bg = '#e0f3ea'; bd = '#2fa36b'; bbg = '#2fa36b'; bfg = '#fff'; }
      if (checked && picked && !correct) { bg = '#fbe4e2'; bd = '#e2564d'; bbg = '#e2564d'; bfg = '#fff'; }
      return `<div data-act="pickOption" data-arg="${i}" style="display:flex;align-items:center;gap:12px;background:${bg};border:1.5px solid ${bd};border-radius:14px;padding:13px 15px;cursor:${checked ? 'default' : 'pointer'}">
        <div style="width:24px;height:24px;border-radius:50%;background:${bbg};color:${bfg};display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:700;flex:none">${String.fromCharCode(65 + i)}</div>
        <div style="flex:1;font-size:14px;font-weight:500;color:#26303f;font-family:'Lora',serif">${esc(txt)}</div>
      </div>`;
    }).join('') + `</div>`;
  } else if (cq.type === 'ab') {
    const p = abParse(cq.sentence);
    const opt = (idx, label) => {
      const picked = state.picks[qi] === idx, correct = idx === cq.answer;
      let bg = '#fff', bd = '#c8d4e2', color = '#26303f';
      if (!checked && picked) { bg = '#e7f0fd'; bd = '#2f74e6'; color = '#1f57c4'; }
      if (checked && correct) { bg = '#e0f3ea'; bd = '#2fa36b'; color = '#1f7a4d'; }
      if (checked && picked && !correct) { bg = '#fbe4e2'; bd = '#e2564d'; color = '#b23a32'; }
      return `<span ${checked ? '' : `data-act="pickOption" data-arg="${idx}"`} style="display:inline-block;margin:0 4px;padding:4px 12px;border-radius:10px;border:1.5px solid ${bd};background:${bg};color:${color};font-weight:700;cursor:${checked ? 'default' : 'pointer'}">${esc(label)}</span>`;
    };
    body = `<div style="background:#fff;border:1px solid #e2e9f2;border-radius:14px;padding:16px 16px;font-family:'Lora',serif;font-size:18px;line-height:2.1;color:#26303f;margin-top:10px;text-align:center">
      ${esc(p.before)}${opt(0, p.a)}<span style="color:#b8c2d2;font-weight:700">/</span>${opt(1, p.b)}${esc(p.after)}
    </div>
    <div style="text-align:center;font-size:11px;color:#9aa8bd;margin-top:8px">둘 중 어법에 맞는 표현을 고르세요</div>`;
  } else {
    const ok = isRight(cq, qi);
    const inputBd = checked ? (ok ? '#2fa36b' : '#e2564d') : '#e2e9f2';
    body = `<div style="margin-top:10px">
      <input id="quiz-input" value="${esc(state.inputs[qi] || '')}" placeholder="여기에 입력하세요" ${checked ? 'readonly' : ''} style="width:100%;border:1.5px solid ${inputBd};background:#fff;border-radius:14px;padding:14px 16px;font-family:'Lora',serif;font-size:16px;color:#14243f;outline:none">
    </div>`;
  }

  let feedback = '';
  if (checked) {
    const ok = isRight(cq, qi);
    feedback = `<div style="margin-top:14px;border-radius:14px;padding:12px 14px;background:${ok ? '#e0f3ea' : '#fbe4e2'};color:${ok ? '#1f7a4d' : '#b23a32'}">
      <div style="font-size:13px;font-weight:700;margin-bottom:5px">${ok ? '정답이에요! 🎉' : '아쉬워요'}</div>
      <div style="font-size:12.5px;line-height:1.6;opacity:.92">${esc(cq.explain)}</div>
    </div>`;
  }

  const footer = checked
    ? `<button data-act="quizNext" style="width:100%;border:none;background:#14243f;color:#fff;font-size:14px;font-weight:600;padding:14px;border-radius:15px;box-shadow:0 5px 0 #0a1526;cursor:pointer">${qi >= qs.length - 1 ? '결과 보기' : '다음 →'}</button>`
    : `<button id="check-btn" data-act="quizCheck" class="btn-check ${canCheck() ? 'on' : ''}">확인</button>`;

  return `<div style="padding:${topPad()} 20px 40px">
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:14px">
      <div data-act="goHome" style="width:30px;height:30px;border-radius:10px;background:#e7f0fd;color:#2f74e6;display:flex;align-items:center;justify-content:center;cursor:pointer">←</div>
      <div style="flex:1;margin:0 12px"><div style="height:8px;border-radius:4px;background:#dde6f1;overflow:hidden"><div style="height:100%;background:linear-gradient(90deg,#2f74e6,#17b0c4);border-radius:4px;width:${pct}%"></div></div></div>
      <div style="font-size:12px;font-weight:700;color:#14243f">${qi + 1}/${qs.length}</div>
    </div>
    <div style="display:inline-flex;align-items:center;gap:6px;background:${tagBg};color:${tagFg};font-size:11px;font-weight:700;padding:5px 11px;border-radius:20px">${esc(meta.tag)}</div>
    <div style="font-size:16px;font-weight:700;color:#14243f;margin:13px 0 4px;line-height:1.45">${esc(cq.prompt)}</div>
    ${cq.sentence && cq.type !== 'ab' ? `<div style="background:#fff;border:1px solid #e2e9f2;border-radius:14px;padding:13px 16px;font-family:'Lora',serif;font-size:16px;line-height:1.7;color:#26303f;margin:10px 0 16px">${esc(cq.sentence)}</div>` : ''}
    ${body}
    ${feedback}
    <div style="margin-top:20px">${footer}</div>
  </div>`;
}

/* ---- 결과 ---- */
function resultHTML() {
  const r = state.result;
  if (!r) return '';
  const wrongs = r.wrongs.map(w => `
    <div style="background:#fff;border:1px solid #e2e9f2;border-left:4px solid #e2564d;border-radius:12px;padding:13px 15px">
      <div style="font-size:13px;font-weight:600;color:#14243f;margin-bottom:9px">${esc(w.prompt)}</div>
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:5px"><span style="font-size:11px;color:#e2564d;font-weight:700;width:40px">내 답</span><span style="font-size:13px;color:#e2564d;font-family:'Lora',serif">${esc(w.your)}</span></div>
      <div style="display:flex;align-items:center;gap:8px"><span style="font-size:11px;color:#2fa36b;font-weight:700;width:40px">정답</span><span style="font-size:13px;color:#2fa36b;font-weight:600;font-family:'Lora',serif">${esc(w.correct)}</span></div>
      <div style="font-size:12px;line-height:1.55;color:#5f7794;background:#f4f8fd;border-radius:9px;padding:8px 10px;margin-top:9px">${esc(w.explain)}</div>
    </div>`).join('');

  return `<div style="padding:${topPad()} 0 40px">
    <div style="text-align:center;padding:20px 24px 22px;margin:0 16px;background:linear-gradient(160deg,#e7f0fd,#dff3f6);border-radius:22px">
      <div style="font-size:12px;font-weight:600;color:#2f74e6">${esc(r.name)} 완료 🎉</div>
      <div style="font-size:46px;font-weight:700;color:#14243f;line-height:1.1;margin:6px 0 2px">${r.score}<span style="font-size:17px;color:#7d8aa0;font-weight:600">점</span></div>
      <div style="font-size:12px;color:#5f7794">${r.total}문항 중 ${r.correct}문항 정답</div>
    </div>
    ${r.wrongs.length ? `
    <div style="padding:18px 20px 0">
      <div style="font-size:13px;font-weight:700;color:#14243f;margin-bottom:11px">오답 다시보기</div>
      <div style="display:flex;flex-direction:column;gap:11px">${wrongs}</div>
    </div>` : `
    <div style="text-align:center;padding:26px 20px 6px;color:#2fa36b;font-size:13px;font-weight:600">완벽해요! 오답이 없어요 ⭐</div>`}
    <div style="padding:22px 20px 0"><button data-act="finishTask" style="width:100%;border:none;background:#2f74e6;color:#fff;font-size:14px;font-weight:600;padding:14px;border-radius:15px;box-shadow:0 5px 0 #1f57c4;cursor:pointer">완료하고 홈으로</button></div>
  </div>`;
}

/* ---- e-북 리더 ---- */
// 서가: 지문이 있는 Day들을 책 제목으로 묶어 한 권씩 (여러 Day = 여러 챕터)
function allBooks() {
  const map = {};
  const cls = viewingClass();
  contentSource().days.forEach(d => {
    if (cls !== null && !dayMatchesClass(d, cls)) return;   // 다른 반 책은 서가에서 제외(공통은 포함)
    const p = dayPassage(d);
    if (!p.trim()) return;
    const title = ((d.book && d.book.title) || '').trim() || '제목 없는 책';
    if (!map[title]) map[title] = { title, author: (d.book && d.book.author) || '', cover: '', spine: '', chapters: [] };
    map[title].chapters.push({ date: d.date || '', chapter: (d.book && d.book.chapter) || '', passage: p });
    if (!map[title].cover && dayCover(d)) map[title].cover = dayCover(d);
    if (!map[title].spine && daySpine(d)) map[title].spine = daySpine(d);
    if (!map[title].author && d.book && d.book.author) map[title].author = d.book.author;
  });
  return Object.values(map).map(b => {
    b.chapters.sort((x, y) => (x.date || '').localeCompare(y.date || ''));
    b.passage = b.chapters.map(c => c.passage).join('\n---\n');
    return b;
  });
}
function currentBook() {
  const books = allBooks();
  const found = books.find(b => b.title === state.readerBookKey);
  if (found) return found;
  // 폴백: 오늘 Day
  const d = activeDay();
  return { title: (d.book && d.book.title) || '', author: (d.book && d.book.author) || '', chapter: (d.book && d.book.chapter) || '', cover: dayCover(d), spine: daySpine(d), passage: dayPassage(d) };
}
function readerPages() { return passageToPages(currentBook().passage); }
function readerProgress() {
  const total = readerPages().length || 1;
  return Math.round((Math.min(state.readerPage, total - 1) + 1) / total * 100) + '%';
}
function readerHTML() {
  const book = currentBook();
  const pages = readerPages();
  const page = Math.min(state.readerPage, Math.max(0, pages.length - 1));
  const paras = pages[page] || [];
  return `<div style="position:absolute;inset:0;display:flex;flex-direction:column;background:#f5f0e6">
    <div style="padding:48px 22px 12px;display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid #e7dfce">
      <div data-act="goHome" style="width:30px;height:30px;border-radius:10px;background:#ece3d2;color:#7a6b52;display:flex;align-items:center;justify-content:center;cursor:pointer">←</div>
      <div style="text-align:center">
        <div style="font-family:'Lora',serif;font-size:13px;font-weight:600;color:#3a3222">${esc(book.title)}</div>
        <div style="font-size:10.5px;color:#9c8f76;margin-top:1px">${esc(book.chapter || book.author || '')}</div>
      </div>
      <div style="width:30px;height:30px;border-radius:10px;background:#ece3d2;color:#7a6b52;display:flex;align-items:center;justify-content:center;font-size:13px">Aa</div>
    </div>
    <div style="flex:1;overflow-y:auto;padding:26px 26px 20px;font-family:'Lora',serif;font-size:18px;line-height:2;color:#33302b">
      ${paras.map(p => `<p style="margin:0 0 18px;text-indent:1.1em;text-wrap:pretty">${esc(p)}</p>`).join('')}
    </div>
    <div style="padding:12px 22px 22px;border-top:1px solid #e7dfce;background:#f5f0e6">
      <div style="height:5px;border-radius:3px;background:#e3d9c6;overflow:hidden;margin-bottom:12px"><div style="height:100%;width:${readerProgress()};background:#c08a3a;border-radius:3px"></div></div>
      <div style="display:flex;align-items:center;justify-content:space-between">
        <button data-act="readerPrev" style="border:1.5px solid #dccfb7;background:#fff;color:#7a6b52;font-size:13px;font-weight:600;white-space:nowrap;padding:10px 18px;border-radius:12px;cursor:pointer">← 이전</button>
        <span style="font-size:12px;font-weight:600;color:#9c8f76">${page + 1} / ${pages.length}</span>
        ${page < pages.length - 1
          ? `<button data-act="readerNext" style="border:none;background:#c08a3a;color:#fff;font-size:13px;font-weight:600;white-space:nowrap;padding:10px 18px;border-radius:12px;box-shadow:0 4px 0 #a06f28;cursor:pointer">다음 →</button>`
          : state.readerBurning
            ? `<button data-act="burnToComprehension" style="border:none;background:#e2564d;color:#fff;font-size:13px;font-weight:700;white-space:nowrap;padding:10px 18px;border-radius:12px;box-shadow:0 4px 0 #b23a32;cursor:pointer">이해도 확인 🔥</button>`
            : `<button data-act="goHome" style="border:none;background:#2fa36b;color:#fff;font-size:13px;font-weight:600;white-space:nowrap;padding:10px 18px;border-radius:12px;box-shadow:0 4px 0 #1f7a4d;cursor:pointer">다 읽었어요 ✓</button>`}
      </div>
    </div>
  </div>`;
}

/* ---- 지문 예습: 난이도 선택 ---- */
function previewLevelsHTML() {
  const d = activeDay();
  const easyN = flashcardCards('preview').length;   // 살살 = 다음 수업 어휘
  const coreN = dayCoreSentences(d).length;
  const compN = dayQuiz('preview').length;
  const card = (act, stage, emoji, color, name, en, desc, disabled) => `
    <div ${disabled ? '' : `data-act="${act}"`} style="display:flex;align-items:center;gap:14px;background:#fff;border:1.5px solid ${disabled ? '#eef2f7' : '#e2e9f2'};border-left:5px solid ${color};border-radius:16px;padding:15px 16px;cursor:${disabled ? 'default' : 'pointer'};opacity:${disabled ? '.5' : '1'};box-shadow:0 6px 16px -12px rgba(20,50,90,.5)">
      <div style="display:flex;flex-direction:column;align-items:center;gap:2px;flex:none;width:40px">
        <div style="font-size:26px;line-height:1">${emoji}</div>
        <span style="font-size:9.5px;font-weight:800;color:${color};background:${color}1a;padding:1px 6px;border-radius:6px">${stage}단계</span>
      </div>
      <div style="flex:1">
        <div style="display:flex;align-items:baseline;gap:7px"><span style="font-size:16px;font-weight:700;color:#14243f">${name}</span><span style="font-size:11px;font-weight:700;color:${color}">${en}</span></div>
        <div style="font-size:12px;color:#7d8aa0;margin-top:3px;line-height:1.5">${desc}</div>
      </div>
      <div style="font-size:16px;color:${disabled ? '#c8d2e0' : color}">${disabled ? '—' : '→'}</div>
    </div>`;
  return `<div style="padding:${topPad()} 20px 40px">
    <div style="display:flex;align-items:center;gap:8px;margin-bottom:4px">
      <div data-act="goHome" style="width:30px;height:30px;border-radius:10px;background:#e7f0fd;color:#2f74e6;display:flex;align-items:center;justify-content:center;cursor:pointer">←</div>
      <span style="font-size:15px;font-weight:700;color:#14243f">지문 예습</span>
    </div>
    <div style="font-size:12.5px;color:#7d8aa0;margin:8px 2px 6px;line-height:1.6">1·2·3단계 중 골라 예습해요. <b>하나만 완료해도</b> 오늘 할 일에 체크돼요 🐠</div>
    <div style="display:flex;align-items:center;gap:7px;background:#fff8e6;border:1px solid #f0d79a;border-radius:12px;padding:9px 12px;margin-bottom:14px">
      <span style="font-size:16px">🎁</span><span style="font-size:11.5px;font-weight:600;color:#8a6412;line-height:1.5">3단계를 <b>모두</b> 완료하면 <b>보너스 경험치</b>를 받아요!</span>
    </div>
    <div style="display:flex;flex-direction:column;gap:12px">
      ${card('previewEasy', 1, '🟢', '#2fa36b', '살살', 'EASY', easyN ? `다음 수업 어휘 ${easyN}개 미리보기 (플래시카드)` : '다음 수업 어휘가 아직 없어요', easyN === 0)}
      ${card('previewMedium', 2, '🟡', '#e0a41a', '보통', 'MEDIUM', coreN ? `핵심 문장 ${coreN}개 · 주어·동사 찾기` : '핵심 문장이 없어요', coreN === 0)}
      ${card('previewHard', 3, '🔴', '#e2564d', '버닝', 'BURNING', `지문 전체 읽기${compN ? ` + 이해도 확인 ${compN}문항` : ''}`, dayPassage(d).trim() === '')}
    </div>
  </div>`;
}

/* ---- 플래시카드 화면 (예습 살살 · 어휘 복습 공용) ---- */
function flashcardScreenHTML(mode) {
  const isPreview = mode === 'preview';
  const cards = flashcardCards(mode);
  const total = cards.length || 1;
  const i = Math.min(state.fcI || 0, total - 1);
  const c = cards[i] || { word: '', pos: '', def: '', ex: '' };
  const last = i >= total - 1;
  const flipped = !!state.fcFlipped;
  const inWb = (state.wordbook || []).some(w => w.word === c.word);
  const badge = isPreview
    ? `<span style="display:inline-flex;align-items:center;gap:6px;background:#e0f3ea;color:#1f7a4d;font-size:11px;font-weight:700;padding:5px 11px;border-radius:20px">🟢 1단계 살살 · 다음 수업 어휘</span>`
    : `<span style="display:inline-flex;align-items:center;gap:6px;background:#fdeede;color:#b8480f;font-size:11px;font-weight:700;padding:5px 11px;border-radius:20px">🔤 어휘 복습</span>`;
  const hintSent = (!isPreview && state.fcHint) ? wordHintSentence(c.word) : '';

  const face = `<div style="width:100%;background:#fff;border:1px solid #e2e9f2;border-radius:22px;padding:30px 22px;text-align:center;box-shadow:0 16px 36px -20px rgba(20,50,90,.6);${flipped ? 'animation:pop .35s ease' : ''}">
    <div style="display:flex;align-items:center;justify-content:center;gap:10px">
      <div style="font-family:'Lora',serif;font-size:34px;font-weight:600;color:#14243f">${esc(c.word)}</div>
      <div data-act="fcSpeak" title="발음 듣기" style="width:34px;height:34px;border-radius:50%;background:#e7f0fd;color:#2f74e6;display:flex;align-items:center;justify-content:center;cursor:pointer;font-size:16px">🔊</div>
    </div>
    ${flipped ? `
      ${c.pos ? `<div style="font-size:12px;color:#7fb0d8;font-weight:700;margin-top:6px">${esc(c.pos)}</div>` : ''}
      <div style="height:1px;background:#eef2f8;margin:16px 0"></div>
      <div style="font-size:18px;color:#26303f;line-height:1.6">${esc(c.def) || '<span style=\"color:#b8c2d2\">뜻이 없어요</span>'}</div>
      ${c.ex ? `<div style="font-size:14px;color:#93a6c2;margin-top:12px;font-style:italic;font-family:'Lora',serif">${esc(c.ex)}</div>` : ''}
      ${inWb ? `<div style="margin-top:14px;display:inline-flex;align-items:center;gap:5px;background:#fff0d0;color:#8a6412;font-size:11.5px;font-weight:700;padding:5px 11px;border-radius:20px">📒 내 단어장에 담았어요</div>` : ''}
    ` : `
      <div style="font-size:12px;color:#b8c2d2;margin-top:14px">뜻을 아는지 아래에서 골라보세요</div>
      ${hintSent ? `<div style="margin-top:14px;background:#f4f8fd;border:1px solid #dbeafe;border-radius:12px;padding:11px 13px;font-family:'Lora',serif;font-size:14px;color:#3a5578;line-height:1.6">${esc(hintSent)}</div>` : ''}
    `}
  </div>`;

  const controls = flipped
    ? `<button data-act="fcNext" style="width:100%;border:none;background:${last ? '#2fa36b' : '#2f74e6'};color:#fff;font-size:14px;font-weight:700;padding:14px;border-radius:15px;box-shadow:0 5px 0 ${last ? '#1f7a4d' : '#1f57c4'};cursor:pointer">${last ? (isPreview ? '예습 완료 ✓' : '복습 완료 ✓') : '다음 →'}</button>`
    : `${!isPreview ? `<button data-act="fcHint" style="width:100%;border:1.5px solid ${state.fcHint ? '#2f74e6' : '#dbe4ef'};background:#fff;color:${state.fcHint ? '#2f74e6' : '#5f7794'};font-size:12.5px;font-weight:700;padding:10px;border-radius:13px;cursor:pointer;margin-bottom:9px">💡 힌트 — 이 단어가 든 문장 보기</button>` : ''}
      <div style="display:flex;gap:10px">
        <button data-act="fcDontKnow" style="flex:1;border:1.5px solid #f3c7c2;background:#fff;color:#c0392b;font-size:15px;font-weight:700;padding:14px;border-radius:15px;cursor:pointer">🤔 몰라요</button>
        <button data-act="fcKnow" style="flex:1;border:none;background:#2fa36b;color:#fff;font-size:15px;font-weight:700;padding:14px;border-radius:15px;box-shadow:0 5px 0 #1f7a4d;cursor:pointer">🙂 알아요</button>
      </div>`;

  return `<div style="padding:${topPad()} 20px 30px;min-height:100%;display:flex;flex-direction:column">
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px">
      <div data-act="${isPreview ? 'goPreview' : 'goHome'}" style="width:30px;height:30px;border-radius:10px;background:#e7f0fd;color:#2f74e6;display:flex;align-items:center;justify-content:center;cursor:pointer">←</div>
      ${badge}
      <span style="font-size:12px;font-weight:700;color:#14243f">${i + 1}/${total}</span>
    </div>
    <div style="font-size:11px;color:#9aa8bd;text-align:center;margin-bottom:2px">🔈 뒤집으면 발음이 나와요 — 휴대폰 음량을 올려 주세요!</div>
    <div style="flex:1;display:flex;align-items:center;justify-content:center;padding:6px 0">${face}</div>
    <div style="margin-top:10px">${controls}</div>
  </div>`;
}
function previewVocabHTML() { return flashcardScreenHTML('preview'); }
/* ---- 오늘의 단어시험(보너스): 단어장 간격반복 ---- */
function wordTestHTML() {
  const deck = state.wtDeck || [];
  const total = deck.length || 1;
  if (state.wtDone) {
    const pct = Math.round((state.wtScore || 0) / total * 100);
    return `<div style="padding:${topPad()} 20px 40px;min-height:100%;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center">
      <div style="font-size:48px;margin-bottom:8px">📒</div>
      <div style="font-size:18px;font-weight:800;color:#14243f">오늘의 단어시험 완료!</div>
      <div style="font-size:44px;font-weight:800;color:#2f74e6;margin:12px 0 2px">${state.wtScore || 0}<span style="font-size:18px;color:#7d8aa0;font-weight:600"> / ${total}</span></div>
      <div style="font-size:12.5px;color:#7d8aa0;line-height:1.6;margin-bottom:22px">맞힌 단어는 복습 간격이 늘어나고,<br>틀린 단어는 곧 다시 나와요 🔁</div>
      <button data-act="goHome" style="width:100%;max-width:280px;border:none;background:#2f74e6;color:#fff;font-size:14px;font-weight:700;padding:14px;border-radius:15px;box-shadow:0 5px 0 #1f57c4;cursor:pointer">완료하고 홈으로</button>
    </div>`;
  }
  const i = Math.min(state.wtI || 0, total - 1);
  const q = deck[i] || { word: '', options: [], answer: 0 };
  const picked = state.wtPick;
  const answered = picked != null;
  const last = i >= total - 1;
  const optBtn = (o, oi) => {
    let bg = '#fff', bd = '#e2e9f2', color = '#14243f';
    if (answered) {
      if (oi === q.answer) { bg = '#e0f3ea'; bd = '#2fa36b'; color = '#1f7a4d'; }
      else if (oi === picked) { bg = '#fbe4e2'; bd = '#e2564d'; color = '#b23a32'; }
    }
    return `<div ${answered ? '' : `data-act="wtPick" data-arg="${oi}"`} style="background:${bg};border:1.5px solid ${bd};color:${color};border-radius:14px;padding:14px 15px;font-size:14.5px;cursor:${answered ? 'default' : 'pointer'};display:flex;align-items:center;gap:8px">${answered && oi === q.answer ? '✓ ' : ''}${esc(o)}</div>`;
  };
  return `<div style="padding:${topPad()} 20px 30px;min-height:100%;display:flex;flex-direction:column">
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px">
      <div data-act="goHome" style="width:30px;height:30px;border-radius:10px;background:#e7f0fd;color:#2f74e6;display:flex;align-items:center;justify-content:center;cursor:pointer">←</div>
      <span style="display:inline-flex;align-items:center;gap:6px;background:#e7f0fd;color:#1f57c4;font-size:11px;font-weight:700;padding:5px 11px;border-radius:20px">📒 오늘의 단어시험</span>
      <span style="font-size:12px;font-weight:700;color:#14243f">${i + 1}/${total}</span>
    </div>
    <div style="flex:1;display:flex;flex-direction:column;justify-content:center">
      <div style="text-align:center;margin-bottom:6px"><span style="font-size:11px;color:#9aa8bd">이 단어의 뜻은?</span></div>
      <div style="display:flex;align-items:center;justify-content:center;gap:10px;margin-bottom:20px">
        <div style="font-family:'Lora',serif;font-size:32px;font-weight:600;color:#14243f">${esc(q.word)}</div>
        <div data-act="fcSpeakWord" data-arg="${esc(q.word)}" style="width:34px;height:34px;border-radius:50%;background:#e7f0fd;color:#2f74e6;display:flex;align-items:center;justify-content:center;cursor:pointer;font-size:16px">🔊</div>
      </div>
      <div style="display:flex;flex-direction:column;gap:10px">${q.options.map(optBtn).join('')}</div>
    </div>
    ${answered ? `<button data-act="wtNext" style="width:100%;border:none;background:#14243f;color:#fff;font-size:14px;font-weight:700;padding:14px;border-radius:15px;box-shadow:0 5px 0 #0a1526;cursor:pointer;margin-top:12px">${last ? '결과 보기' : '다음 →'}</button>` : ''}
  </div>`;
}
// 어휘 복습: 개수 선택 → 플래시카드
function vocabReviewHTML() {
  if (state.vrCount != null) return flashcardScreenHTML('vocab');
  const total = dayVocabCards(activeDay()).length;
  const opts = [30, 50].filter(n => total > n);
  const btn = (label, val) => `<button data-act="vrPick" data-arg="${val}" style="border:1.5px solid #e2e9f2;background:#fff;color:#14243f;font-size:16px;font-weight:700;padding:16px;border-radius:15px;cursor:pointer;box-shadow:0 5px 14px -10px rgba(20,50,90,.5)">${label}</button>`;
  return `<div style="padding:${topPad()} 20px 40px">
    <div style="display:flex;align-items:center;gap:8px;margin-bottom:4px">
      <div data-act="goHome" style="width:30px;height:30px;border-radius:10px;background:#e7f0fd;color:#2f74e6;display:flex;align-items:center;justify-content:center;cursor:pointer">←</div>
      <span style="font-size:15px;font-weight:700;color:#14243f">어휘 복습</span>
    </div>
    <div style="font-size:12.5px;color:#7d8aa0;margin:8px 2px 16px;line-height:1.6">오늘 지문의 단어를 플래시카드로 복습해요. 몇 개를 볼까요? (총 ${total}개)</div>
    <div style="display:flex;flex-direction:column;gap:11px">
      ${opts.map(n => btn(n + '개', n)).join('')}
      ${btn('전체 ' + total + '개', 'all')}
    </div>
  </div>`;
}

/* ---- 지문 예습: 보통(2단계) — 주어/동사 클릭 채점 ---- */
function previewMediumHTML() {
  const sents = dayCoreSentencesRich(activeDay());
  const total = sents.length || 1;
  const i = Math.min(state.pmIndex || 0, total - 1);
  const c = sents[i] || { text: '', subject: [], verb: [] };
  const toks = (c.text || '').split(/\s+/).filter(Boolean);
  const phases = ['subject', 'verb'].filter(k => (c[k] || []).length);
  const grading = phases.length > 0;
  const phase = phases[state.pmPhaseIdx || 0];   // 'subject' | 'verb' | undefined
  const sel = state.pmSel || [];
  const phaseColor = phase === 'verb' ? '#2fa36b' : '#2f74e6';
  const subPassed = phases.indexOf('subject') > -1 && phases.indexOf('subject') < (state.pmPhaseIdx || 0);

  const chip = (w, wi) => {
    const isSel = !!phase && sel.includes(wi);
    const isConfSub = subPassed && (c.subject || []).includes(wi);
    let bg = '#fff', bd = '#e2e9f2';
    if (isConfSub) { bg = '#dbeafe'; bd = '#2f74e6'; }
    if (isSel) { bg = phase === 'verb' ? '#dcfce7' : '#dbeafe'; bd = phaseColor; }
    return `<span ${phase ? `data-act="pmToggle" data-arg="${wi}"` : ''} style="display:inline-block;margin:3px;padding:5px 10px;border-radius:9px;border:1.5px solid ${bd};background:${bg};color:#26303f;font-family:'Lora',serif;font-size:18px;cursor:${phase ? 'pointer' : 'default'}">${esc(w)}</span>`;
  };
  const prompt = !grading ? '문장을 소리 내어 읽어보세요'
    : phase === 'subject' ? '👆 주어(주부)를 모두 클릭하세요'
      : '👆 동사를 클릭하세요';
  const btn = grading
    ? `<button data-act="pmCheck" style="width:100%;border:none;background:${phaseColor};color:#fff;font-size:14px;font-weight:700;padding:14px;border-radius:15px;box-shadow:0 5px 0 ${phase === 'verb' ? '#1f7a4d' : '#1f57c4'};cursor:pointer">확인</button>`
    : `<button data-act="pmNext" style="width:100%;border:none;background:${i >= total - 1 ? '#2fa36b' : '#2f74e6'};color:#fff;font-size:14px;font-weight:700;padding:14px;border-radius:15px;box-shadow:0 5px 0 ${i >= total - 1 ? '#1f7a4d' : '#1f57c4'};cursor:pointer">${i >= total - 1 ? '예습 완료 ✓' : '다음 문장 →'}</button>`;
  const feedback = state.pmMsg === 'wrong'
    ? `<div style="text-align:center;font-size:13px;font-weight:700;color:#c0392b;background:#fbe4e2;border-radius:12px;padding:10px;margin-top:12px">다시 체크해 보세요 🤔</div>` : '';

  return `<div style="padding:${topPad()} 20px 30px;min-height:100%;display:flex;flex-direction:column">
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px">
      <div data-act="goPreview" style="width:30px;height:30px;border-radius:10px;background:#e7f0fd;color:#2f74e6;display:flex;align-items:center;justify-content:center;cursor:pointer">←</div>
      <span style="display:inline-flex;align-items:center;gap:6px;background:#fdf3dd;color:#a5760f;font-size:11px;font-weight:700;padding:5px 11px;border-radius:20px">🟡 2단계 보통 · 문장 구조</span>
      <span style="font-size:12px;font-weight:700;color:#14243f">${i + 1}/${total}</span>
    </div>
    <div style="text-align:center;font-size:13.5px;font-weight:700;color:${phase === 'verb' ? '#2fa36b' : (grading ? '#2f74e6' : '#7d8aa0')};margin:6px 0 4px">${prompt}</div>
    ${subPassed ? `<div style="text-align:center;font-size:10.5px;color:#9aa8bd;margin-bottom:2px">🔵 주어 완료 — 이제 동사예요</div>` : ''}
    <div style="flex:1;display:flex;flex-direction:column;justify-content:center">
      <div style="text-align:center;line-height:2.2">${toks.map(chip).join('')}</div>
      ${c.ko ? `<div style="text-align:center;font-size:13px;color:#9aa8bd;margin-top:14px;font-family:'IBM Plex Sans KR',sans-serif">${esc(c.ko)}</div>` : ''}
      ${feedback}
    </div>
    <div style="margin-top:12px">${btn}</div>
  </div>`;
}

/* ---- 지문 예습: 보통(핵심 문장 읽기 — 구버전 폴백) ---- */
function previewReadHTML() {
  const sents = dayCoreSentences(activeDay());
  return `<div style="padding:${topPad()} 20px 40px">
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px">
      <div data-act="goPreview" style="width:30px;height:30px;border-radius:10px;background:#e7f0fd;color:#2f74e6;display:flex;align-items:center;justify-content:center;cursor:pointer">←</div>
      <span style="display:inline-flex;align-items:center;gap:6px;background:#fdf3dd;color:#a5760f;font-size:11px;font-weight:700;padding:5px 11px;border-radius:20px">🟡 보통 · 핵심 문장</span>
      <span style="width:30px"></span>
    </div>
    <div style="font-size:12.5px;color:#7d8aa0;margin:0 2px 14px">오늘의 핵심 문장을 소리 내어 읽어보세요.</div>
    <div style="display:flex;flex-direction:column;gap:11px">
      ${sents.map((s, i) => `
        <div style="display:flex;gap:11px;background:#fff;border:1px solid #e2e9f2;border-radius:14px;padding:14px 15px">
          <div style="width:22px;height:22px;flex:none;border-radius:50%;background:#fdf3dd;color:#a5760f;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:700">${i + 1}</div>
          <div style="font-family:'Lora',serif;font-size:16px;line-height:1.6;color:#26303f">${esc(stripBrackets(s))}</div>
        </div>`).join('')}
    </div>
    <div style="margin-top:22px"><button data-act="previewReadDone" style="width:100%;border:none;background:#2fa36b;color:#fff;font-size:14px;font-weight:700;padding:14px;border-radius:15px;box-shadow:0 5px 0 #1f7a4d;cursor:pointer">다 읽었어요 · 예습 완료 ✓</button></div>
  </div>`;
}

/* ---- 부화장 ---- */
function hatcheryHTML() {
  const canBuy = state.xp >= EGG_PRICE;
  const buyBtn = `font-size:11.5px;font-weight:700;padding:9px 12px;border-radius:11px;white-space:nowrap;cursor:${canBuy ? 'pointer' : 'default'};background:${canBuy ? '#ffd76a' : 'rgba(255,255,255,.18)'};color:${canBuy ? '#5a4410' : 'rgba(255,255,255,.5)'}`;

  let body = '';
  if (state.hatchStage === 'idle') {
    body = state.eggs > 0 ? `
      <div style="text-align:center;margin-top:18px">
        <div data-act="crackEgg" style="font-size:120px;cursor:pointer;animation:eggwig 1.1s ease-in-out infinite;filter:drop-shadow(0 16px 22px rgba(0,0,0,.4))">🥚</div>
        <div style="color:#fff;font-size:13px;opacity:.9;margin-top:6px">탭해서 부화시키기</div>
      </div>` : `
      <div style="text-align:center;margin-top:30px;color:#dbe8fb">
        <div style="font-size:52px;opacity:.5">🥚</div>
        <div style="font-size:13px;font-weight:600;margin-top:10px">부화할 알이 없어요</div>
        <div style="font-size:11.5px;opacity:.8;margin-top:6px;line-height:1.6">오늘 할 일을 모두 완료하거나<br>XP로 알을 구매하세요</div>
      </div>`;
  } else if (state.hatchStage === 'revealed') {
    const sp = SPECIES.find(x => x.id === state.hatchSpecies);
    const rar = sp ? RARITY[RAR[sp.id]] : RARITY.normal;
    body = `
      <div style="text-align:center;margin-top:14px">
        <div style="font-size:12px;font-weight:700;letter-spacing:.1em;margin-bottom:8px;color:${rar.color}">${rar.label}</div>
        <div style="display:inline-block;padding:24px;background:rgba(255,255,255,.12);border-radius:24px;box-shadow:0 0 42px ${rar.color};animation:pop .5s ease-out">${sp ? spriteHTML(sp.id, 9) : ''}</div>
        <div style="color:#fff;font-size:20px;font-weight:700;margin-top:18px">${sp ? sp.name : ''}</div>
        <div style="color:#cfe3ff;font-size:12.5px;margin-top:6px">아쿠아리움에 새 친구가 추가됐어요! (+40 XP)</div>
        <div style="display:flex;gap:10px;justify-content:center;margin-top:22px">
          <button data-act="goAqua" style="border:none;background:#fff;color:#1f5fa0;font-size:13px;font-weight:700;padding:12px 18px;border-radius:14px;cursor:pointer">아쿠아리움 보기</button>
          ${state.eggs > 0 ? `<button data-act="crackEgg" style="border:1.5px solid rgba(255,255,255,.5);background:transparent;color:#fff;font-size:13px;font-weight:600;padding:12px 18px;border-radius:14px;cursor:pointer">계속 부화 (${state.eggs})</button>` : ''}
        </div>
      </div>`;
  }

  return `<div style="min-height:100%;background:linear-gradient(180deg,#2a6bb0 0%,#123f74 55%,#0b2a52 100%);position:relative;padding:${topPad()} 20px 92px">
    <div style="text-align:center;color:#fff">
      <div style="font-size:20px;font-weight:700;text-shadow:0 2px 6px rgba(0,0,0,.3)">부화장</div>
      <div style="font-size:12px;opacity:.85;margin-top:3px">알을 부화시켜 새 친구를 만나요</div>
    </div>

    <div style="margin-top:18px;background:rgba(255,255,255,.12);backdrop-filter:blur(6px);-webkit-backdrop-filter:blur(6px);border:1px solid rgba(255,255,255,.2);border-radius:18px;padding:14px 16px;display:flex;align-items:center;gap:12px;color:#fff">
      <div style="font-size:26px">🥚</div>
      <div style="flex:1"><div style="font-size:13px;font-weight:700">보유 알 ${state.eggs}개</div><div style="font-size:11px;opacity:.8;margin-top:1px">보유 XP ${state.xp}</div></div>
      <div data-act="buyEgg" style="${buyBtn}">＋ 알 구매 · ${EGG_PRICE}XP</div>
    </div>

    ${body}

    <div style="margin-top:24px;background:rgba(11,33,64,.35);border-radius:16px;padding:13px 15px">
      <div style="font-size:11px;font-weight:700;color:#fff;opacity:.85;margin-bottom:9px">등급 · 등장 확률</div>
      ${rarityLegendHTML()}
    </div>
  </div>`;
}

/* =========================================================
 * 교사 화면
 * ========================================================= */
function teacherHTML() {
  const tab = on => `flex:1;text-align:center;font-size:12.5px;font-weight:700;padding:10px;border-radius:12px;cursor:pointer;color:${on ? '#fff' : '#4a5a72'};background:${on ? '#2f74e6' : '#fff'};border:1px solid ${on ? '#2f74e6' : '#e2e9f2'}`;
  return `<div class="scroll" style="background:#eef3fa">
    <div style="padding:52px 18px 30px">
      <div style="display:flex;gap:8px;margin-bottom:16px">
        <div data-act="teacherTabDash" style="${tab(ui.teacherTab === 'dash')}">📊 대시보드</div>
        <div data-act="teacherTabContent" style="${tab(ui.teacherTab === 'content')}">📝 콘텐츠 관리</div>
      </div>
      ${ui.teacherTab === 'dash' ? teacherDashHTML() : editorHTML()}
    </div>
  </div>`;
}

function teacherDashHTML() {
  const studentRow = (bg, initial, name, done, score, thought, highlight) => `
    <div style="display:grid;grid-template-columns:1.3fr .8fr .7fr .9fr;padding:12px 15px;border-bottom:1px solid #f4f7fb;align-items:center${highlight ? ';background:#f7faff' : ''}">
      <div style="display:flex;align-items:center;gap:8px"><div style="width:26px;height:26px;border-radius:50%;background:${bg};color:#fff;display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:700">${initial}</div><span style="font-size:12.5px;font-weight:600;color:#14243f">${name}</span></div>
      <div>${done
        ? `<span style="font-size:10.5px;font-weight:600;color:#2fa36b;background:#e0f3ea;padding:3px 7px;border-radius:7px">완료</span>`
        : `<span style="font-size:10.5px;font-weight:600;color:#e2564d;background:#fbe4e2;padding:3px 7px;border-radius:7px">미완료</span>`}</div>
      <div style="font-size:12.5px;${score === '–' ? 'color:#b8c2d2' : 'font-weight:600;color:#14243f'}">${score}</div>
      <div>${thought
        ? `<span style="font-size:10.5px;font-weight:600;color:#2fa36b">✓ 작성</span>`
        : `<span style="font-size:10.5px;color:#7d8aa0">미작성</span>`}</div>
    </div>`;

  const day = activeDay();
  if (sbConf()) {
    if (!auth) return `
      <div class="ed-card" style="margin-top:4px">
        <div style="font-size:14px;font-weight:700;color:#14243f">🔐 교사 로그인</div>
        <div style="font-size:11.5px;color:#7d8aa0;margin:6px 0 12px;line-height:1.6">학생 기록을 보려면 교사 계정으로 로그인하세요.<br>처음이라면 가입 후, Supabase SQL Editor에서 교사로 지정해야 해요 (README 참고).</div>
        ${loginFormHTML(true)}
      </div>`;
    if (!isTeacherUser()) return `
      <div class="ed-card" style="margin-top:4px">
        <div style="font-size:14px;font-weight:700;color:#14243f">🔐 교사 권한이 없어요</div>
        <div style="font-size:12px;color:#5f7794;margin:8px 0;line-height:1.7">지금 <b>${esc(studentName())}</b>(${esc(auth.user.username)}) 계정으로 로그인되어 있어요.<br>이 계정을 교사로 지정하려면 Supabase → SQL Editor에서 실행:<br><code style="font-size:11px;background:#f4f8fd;padding:2px 6px;border-radius:5px">update public.er_profiles set is_teacher = true where username = '${esc(auth.user.username)}';</code><br>실행 후 로그아웃했다가 다시 로그인하면 적용돼요.</div>
        <button data-act="doLogout" class="ed-btn ghost" style="width:100%">로그아웃</button>
      </div>`;
    return liveDashHTML(day);
  }
  return `
    <div style="font-size:19px;font-weight:700;color:#14243f">여름 특강 A반${day.label ? ' · ' + esc(day.label) : ''}</div>
    <div style="font-size:12px;color:#7d8aa0;margin-top:2px">${esc(day.book.title)} · 학생 18명</div>
    <div style="font-size:10.5px;color:#b8c2d2;margin-top:4px">* 아래 수치는 데모 데이터입니다 — 콘텐츠 관리에서 Supabase를 설정하면 실제 기록이 표시돼요</div>

    <div style="display:grid;grid-template-columns:1fr 1fr;gap:11px;margin-top:16px">
      <div style="background:#fff;border:1px solid #e2e9f2;border-radius:16px;padding:14px 15px"><div style="font-size:11.5px;color:#7d8aa0">복습 완료율</div><div style="font-size:24px;font-weight:700;color:#14243f;margin:4px 0 7px">78<span style="font-size:13px;color:#7d8aa0">%</span></div><div style="height:6px;border-radius:3px;background:#dde6f1;overflow:hidden"><div style="width:78%;height:100%;background:#2f74e6"></div></div></div>
      <div style="background:#fff;border:1px solid #e2e9f2;border-radius:16px;padding:14px 15px"><div style="font-size:11.5px;color:#7d8aa0">어휘시험 평균</div><div style="font-size:24px;font-weight:700;color:#14243f;margin:4px 0 7px">86<span style="font-size:13px;color:#7d8aa0">점</span></div><div style="font-size:11px;color:#2fa36b;font-weight:600">▲ 지난주 +4</div></div>
      <div style="background:#fff;border:1px solid #e2e9f2;border-radius:16px;padding:14px 15px"><div style="font-size:11.5px;color:#7d8aa0">사색질문 답변률</div><div style="font-size:24px;font-weight:700;color:#14243f;margin:4px 0 7px">61<span style="font-size:13px;color:#7d8aa0">%</span></div><div style="height:6px;border-radius:3px;background:#dde6f1;overflow:hidden"><div style="width:61%;height:100%;background:#f0a92e"></div></div></div>
      <div style="background:#fff;border:1px solid #e2e9f2;border-radius:16px;padding:14px 15px"><div style="font-size:11.5px;color:#7d8aa0">미완료 학생</div><div style="font-size:24px;font-weight:700;color:#e2564d;margin:4px 0 7px">4<span style="font-size:13px;color:#7d8aa0">명</span></div><div style="font-size:11px;color:#7d8aa0">복습·시험 미제출</div></div>
    </div>

    <div style="font-size:14px;font-weight:700;color:#14243f;margin:22px 0 10px">학생별 현황</div>
    <div style="background:#fff;border:1px solid #e2e9f2;border-radius:16px;overflow:hidden">
      <div style="display:grid;grid-template-columns:1.3fr .8fr .7fr .9fr;padding:11px 15px;border-bottom:1px solid #eef2f8;font-size:10.5px;font-weight:600;color:#7d8aa0"><div>학생</div><div>복습</div><div>점수</div><div>사색</div></div>
      ${studentRow('#2f74e6', '지민', '이지민', true, '92', true, true)}
      ${studentRow('#17b0c4', '서준', '박서준', true, '88', false)}
      ${studentRow('#f0a92e', '하윤', '최하윤', false, '–', false)}
      ${studentRow('#6d7cf0', '도윤', '정도윤', true, '79', true)}
    </div>

    <div style="font-size:14px;font-weight:700;color:#14243f;margin:22px 0 10px">사색 질문 답변</div>
    <div style="background:#fff;border:1px solid #e2e9f2;border-radius:16px;padding:15px 16px">
      <div style="font-size:12px;color:#5f7794;line-height:1.5;background:#f4f8fd;border-radius:10px;padding:10px 12px;margin-bottom:13px">Q. 바다가 끝내 침묵한다는 것은 무엇을 의미할까?</div>
      <div style="border-bottom:1px solid #f0f4f9;padding-bottom:12px;margin-bottom:12px">
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px"><div style="width:22px;height:22px;border-radius:50%;background:#2f74e6;color:#fff;display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:700">지민</div><span style="font-size:12px;font-weight:600;color:#14243f">이지민</span></div>
        <div style="font-size:12.5px;line-height:1.6;color:#4a5a72">인간이 아무리 탐구해도 자연에는 끝내 닿을 수 없는 영역이 있다는 뜻 같아요.</div>
      </div>
      <div>
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px"><div style="width:22px;height:22px;border-radius:50%;background:#6d7cf0;color:#fff;display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:700">도윤</div><span style="font-size:12px;font-weight:600;color:#14243f">정도윤</span></div>
        <div style="font-size:12.5px;line-height:1.6;color:#4a5a72">답을 주지 않는 게 오히려 계속 궁금하게 만드는 힘인 것 같습니다.</div>
      </div>
    </div>`;
}

/* ---- 실데이터 대시보드(Supabase 설정 시) ---- */
function liveDashHTML(day) {
  const req = requiredKeys();
  const recs = ui.records || [];
  const profiles = ui.profiles || [];
  const pending = ui.pending || [];

  const byStu = {};
  recs.forEach(r => { (byStu[r.student] = byStu[r.student] || []).push(r); });

  // 승인된 학생을 기준으로, 기록만 있는 이름도 뒤에 붙임(계정 없는 데모용)
  const students = profiles.map(p => ({ id: p.id, name: p.name, cls: p.class, no: p.student_no }));
  recs.forEach(r => { if (!students.some(s => s.name === r.student)) students.push({ id: null, name: r.student }); });

  // 반별 보기: 반 목록 수집 + 선택된 반으로 학생/기록 필터
  const nameClass = {}; profiles.forEach(p => { nameClass[p.name] = p.class || ''; });
  const classSet = [];
  students.forEach(s => { const c = s.cls || ''; if (c && !classSet.includes(c)) classSet.push(c); });
  classes().forEach(c => { if (c && !classSet.includes(c)) classSet.push(c); });
  classSet.sort();
  if (ui.dashClass && !classSet.includes(ui.dashClass)) ui.dashClass = '';  // 사라진 반이 선택돼 있으면 전체로
  const filt = ui.dashClass;
  const shown = filt ? students.filter(s => (s.cls || '') === filt) : students;
  const shownRecs = filt ? recs.filter(r => (nameClass[r.student] || '') === filt) : recs;
  const classChips = classSet.length ? `
    <div style="display:flex;align-items:center;gap:7px;overflow-x:auto;padding-bottom:2px;margin-top:14px">
      ${['', ...classSet].map(c => {
        const on = filt === c;
        return `<div data-act="setDashClass" data-arg="${esc(c)}" style="flex:none;font-size:12px;font-weight:700;padding:7px 14px;border-radius:11px;cursor:pointer;white-space:nowrap;color:${on ? '#fff' : '#4a5a72'};background:${on ? '#2f74e6' : '#fff'};border:1px solid ${on ? '#2f74e6' : '#e2e9f2'}">${c ? esc(c) : '전체'}${c ? ` <span style="opacity:.7;font-weight:500">${students.filter(s => (s.cls || '') === c).length}</span>` : ''}</div>`;
      }).join('')}
    </div>` : '';

  const grantBtns = (id) => id ? `
    <div style="display:flex;flex-wrap:wrap;gap:5px;margin-top:9px;align-items:center">
      <span style="font-size:10px;font-weight:700;color:#7d8aa0;width:34px">경험치</span>
      ${[10, 30, 50].map(x => `<button data-act="grant" data-arg="${id}:0:${x}" style="border:1px solid #cfe0f5;background:#eef5ff;color:#2f74e6;font-size:11px;font-weight:700;padding:5px 9px;border-radius:8px;cursor:pointer">+${x}</button>`).join('')}
      <span style="font-size:10px;font-weight:700;color:#7d8aa0;width:20px;margin-left:6px">알</span>
      ${[1, 3, 5].map(e => `<button data-act="grant" data-arg="${id}:${e}:0" style="border:1px solid #f0d79a;background:#fff7e6;color:#b0851f;font-size:11px;font-weight:700;padding:5px 9px;border-radius:8px;cursor:pointer">🥚+${e}</button>`).join('')}
      <div style="flex:1"></div>
      <button data-act="delStudent" data-arg="${id}" title="학생 계정 삭제" style="border:1px solid #f3c7c2;background:#fff;color:#c0392b;font-size:11px;font-weight:700;padding:5px 9px;border-radius:8px;cursor:pointer">${ui.grantBusy === 'del:' + id ? '삭제 중…' : '🗑 삭제'}</button>
    </div>` : '';

  const rows = shown.map(s => {
    const rs = byStu[s.name] || [];
    const doneSet = new Set(rs.map(r => r.task));
    const doneReq = req.filter(k => doneSet.has(k)).length;
    const scores = rs.filter(r => r.score != null);
    const avg = scores.length ? Math.round(scores.reduce((a, r) => a + r.score, 0) / scores.length) : null;
    const allDone = req.length > 0 && doneReq >= req.length;
    const badge = allDone
      ? `<span style="font-size:10.5px;font-weight:600;color:#2fa36b;background:#e0f3ea;padding:3px 8px;border-radius:7px">완료 ${doneReq}/${req.length}</span>`
      : rs.length
        ? `<span style="font-size:10.5px;font-weight:600;color:#2f74e6;background:#e7f0fd;padding:3px 8px;border-radius:7px">진행 ${doneReq}/${req.length}</span>`
        : `<span style="font-size:10.5px;font-weight:600;color:#e2564d;background:#fbe4e2;padding:3px 8px;border-radius:7px">시작 전</span>`;
    return `<div style="padding:12px 14px;border-bottom:1px solid #f4f7fb">
      <div style="display:flex;align-items:center;gap:9px">
        <div style="width:28px;height:28px;border-radius:50%;background:${allDone ? '#2fa36b' : (rs.length ? '#2f74e6' : '#c3ceda')};color:#fff;display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:700">${esc(s.name.slice(0, 2))}</div>
        <div style="flex:1;min-width:0">
          <div style="font-size:13px;font-weight:700;color:#14243f">${esc(s.name)}${s.cls || s.no ? ` <span style="font-size:10.5px;color:#9aa8bd;font-weight:500">${esc(s.cls || '')}${s.cls && s.no ? ' · ' : ''}${s.no ? s.no + '번' : ''}</span>` : ''}</div>
        </div>
        ${badge}
        <div style="font-size:12px;font-weight:700;color:${avg == null ? '#c3ceda' : '#14243f'};width:34px;text-align:right">${avg == null ? '–' : avg}</div>
      </div>
      ${grantBtns(s.id)}
    </div>`;
  }).join('');

  const totalDone = shown.filter(s => {
    const doneSet = new Set((byStu[s.name] || []).map(r => r.task));
    return req.length > 0 && req.every(k => doneSet.has(k));
  }).length;
  const allScores = shownRecs.filter(r => r.score != null);
  const avgAll = allScores.length ? Math.round(allScores.reduce((a, r) => a + r.score, 0) / allScores.length) : null;

  const pendingSection = pending.length ? `
    <div style="font-size:14px;font-weight:700;color:#14243f;margin:20px 0 10px">가입 대기 <span style="font-size:11px;color:#fff;background:#e2564d;border-radius:8px;padding:2px 7px">${pending.length}</span></div>
    <div style="display:flex;flex-direction:column;gap:9px">
      ${pending.map(p => `<div style="background:#fff;border:1px solid #f0c65a;border-radius:14px;padding:12px 14px;display:flex;align-items:center;gap:10px">
        <div style="width:30px;height:30px;border-radius:50%;background:#f0a92e;color:#fff;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:700">${esc((p.name || '').slice(0, 2))}</div>
        <div style="flex:1;min-width:0">
          <div style="font-size:13px;font-weight:700;color:#14243f">${esc(p.name)} <span style="font-size:11px;color:#9aa8bd;font-weight:500">${esc(p.username)}</span></div>
          <div style="font-size:11px;color:#7d8aa0;margin-top:1px">${esc(p.class || '반 미지정')}${p.student_no ? ' · 학번 ' + esc(p.student_no) : ''}</div>
        </div>
        <button data-act="rejectStudent" data-arg="${p.id}" style="border:1px solid #f3c7c2;background:#fff;color:#c0392b;font-size:11.5px;font-weight:700;padding:7px 11px;border-radius:9px;cursor:pointer">거절</button>
        <button data-act="approveStudent" data-arg="${p.id}" style="border:none;background:#2fa36b;color:#fff;font-size:11.5px;font-weight:700;padding:7px 13px;border-radius:9px;cursor:pointer">승인</button>
      </div>`).join('')}
    </div>` : '';

  return `
    <div style="display:flex;align-items:center;justify-content:space-between">
      <div>
        <div style="font-size:19px;font-weight:700;color:#14243f">오늘의 학습 현황${filt ? ' · ' + esc(filt) : ''}</div>
        <div style="font-size:12px;color:#7d8aa0;margin-top:2px">${esc(day.book.title)} · ${shown.length}명${filt ? ` (전체 ${students.length})` : ''} · ${todayKey()}</div>
      </div>
      <div style="display:flex;gap:6px">
        <button data-act="dashRefresh" class="ed-btn ghost" style="padding:8px 13px;font-size:11.5px">${ui.recLoading ? '⏳' : '🔄'}</button>
        <button data-act="doLogout" class="ed-btn ghost" style="padding:8px 11px;font-size:11.5px" title="교사 계정 로그아웃">↩︎</button>
      </div>
    </div>
    ${ui.recError ? `<div style="font-size:11.5px;color:#b23a32;background:#fbe4e2;border-radius:10px;padding:9px 12px;margin-top:10px">불러오지 못했어요: ${esc(ui.recError)}</div>` : ''}
    ${ui.grantToast ? `<div style="font-size:11.5px;color:#1f7a4d;background:#e0f3ea;border-radius:10px;padding:9px 12px;margin-top:10px">${esc(ui.grantToast)}</div>` : ''}

    ${pendingSection}

    ${classChips}

    <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:11px;margin-top:14px">
      <div style="background:#fff;border:1px solid #e2e9f2;border-radius:16px;padding:13px 14px"><div style="font-size:11px;color:#7d8aa0">오늘 다 끝낸 학생</div><div style="font-size:22px;font-weight:700;color:#14243f;margin-top:4px">${totalDone}<span style="font-size:12px;color:#7d8aa0">/${shown.length}</span></div></div>
      <div style="background:#fff;border:1px solid #e2e9f2;border-radius:16px;padding:13px 14px"><div style="font-size:11px;color:#7d8aa0">퀴즈 평균</div><div style="font-size:22px;font-weight:700;color:#14243f;margin-top:4px">${avgAll == null ? '–' : avgAll}<span style="font-size:12px;color:#7d8aa0">점</span></div></div>
      <div style="background:#fff;border:1px solid #e2e9f2;border-radius:16px;padding:13px 14px"><div style="font-size:11px;color:#7d8aa0">오늘 기록</div><div style="font-size:22px;font-weight:700;color:#14243f;margin-top:4px">${shownRecs.length}<span style="font-size:12px;color:#7d8aa0">건</span></div></div>
    </div>

    <div style="font-size:14px;font-weight:700;color:#14243f;margin:20px 0 10px">학생별 현황 · 보상 주기${filt ? ' · ' + esc(filt) : ''}</div>
    <div style="background:#fff;border:1px solid #e2e9f2;border-radius:16px;overflow:hidden">
      ${rows || '<div style="padding:18px;text-align:center;font-size:12px;color:#b8c2d2">아직 학생이 없어요</div>'}
    </div>
    <div style="font-size:10.5px;color:#b8c2d2;margin-top:8px">경험치·알 버튼을 누르면 학생이 다음에 접속할 때 자동으로 반영돼요.</div>`;
}

/* ---- 콘텐츠 관리(핸드폰): 편집은 컴퓨터에서, 여기선 배포본 발표만 ---- */
function editorHTML() {
  const days = deployedDays();
  if (ui.presDay == null || ui.presDay >= days.length) ui.presDay = bestDeployedDayIndex(days);
  const d = days[ui.presDay] || days[0] || {};
  const passage = dayPassage(d);
  const sentN = passage.trim() ? passageToSentences(passage).length : 0;

  // 발표할 날짜 고르기(배포된 Day 기준)
  const dayChips = days.map((day, i) => {
    const on = i === ui.presDay;
    const md = (day.date || '').slice(5).replace('-', '/');
    const ct = day.class ? ` 〔${esc(day.class)}〕` : '';
    return `<div data-act="edSelectDayView" data-arg="${i}" style="flex:none;font-size:11.5px;font-weight:700;padding:8px 13px;border-radius:11px;cursor:pointer;white-space:nowrap;color:${on ? '#fff' : '#4a5a72'};background:${on ? '#14243f' : '#fff'};border:1px solid ${on ? '#14243f' : '#e2e9f2'}">${esc(md)}${day.label ? ' · ' + esc(day.label) : ''}${ct}</div>`;
  }).join('');

  return `
    <div class="ed-card" style="background:linear-gradient(150deg,#14243f,#1f3a63);border:none;color:#fff">
      <div style="font-size:14px;font-weight:800">🖥️ 콘텐츠 편집은 컴퓨터에서</div>
      <div style="font-size:12px;opacity:.88;line-height:1.75;margin-top:7px">문제·지문·책 정보 편집과 <b>배포</b>는 화면이 넓은 <b>컴퓨터</b>에서 하는 게 편해요.<br>핸드폰에서는 <b>학생 현황(대시보드)</b> 확인과, 아래 <b>수업용 전체화면 발표</b>를 하세요.<br><span style="opacity:.75">여기 목록은 <b>지금 배포된</b> 콘텐츠예요.</span></div>
      <a href="admin.html" style="display:block;margin-top:12px;text-align:center;background:#2f74e6;color:#fff;font-size:13px;font-weight:800;padding:13px;border-radius:12px;text-decoration:none">🖥️ 컴퓨터에서 편집하기 (콘텐츠 관리 페이지)</a>
    </div>

    <div class="ed-card">
      <div style="font-size:13px;font-weight:700;color:#14243f;margin-bottom:8px">📅 어떤 날을 띄울까요?</div>
      <div style="display:flex;align-items:center;gap:7px;overflow-x:auto;padding-bottom:4px">${dayChips || '<span style="font-size:12px;color:#b8c2d2">아직 배포된 Day가 없어요</span>'}</div>
    </div>

    <div class="ed-card" style="background:linear-gradient(150deg,#0b243f,#123a63);border:none;color:#fff">
      <div style="font-size:13.5px;font-weight:700">🖥️ 수업용 전체화면 (PPT처럼)</div>
      <div style="font-size:11.5px;opacity:.85;line-height:1.6;margin-top:5px">선택한 날${d.label ? `(<b>${esc(d.label)}</b>)` : ''}의 지문을 <b>한 화면에 한 문장씩</b> 크게 띄워요. 화면을 탭하거나 ← → 키로 넘기고, Esc로 닫습니다.
      ${sentN ? `지금 <b>${sentN}문장</b>을 띄울 수 있어요.` : '이 날은 지문이 비어 있어요 — 컴퓨터에서 지문을 입력해 주세요.'}</div>
      <button data-act="openPresent" class="ed-btn primary" style="width:100%;margin-top:10px;background:#2f74e6;box-shadow:0 4px 0 #1f57c4;${sentN ? '' : 'opacity:.5'}">▶ 전체화면으로 띄우기</button>
    </div>
    <div style="height:20px"></div>`;
}

/* =========================================================
 * 수업용 전체화면 발표 (PPT처럼 한 문장씩)
 * ========================================================= */
function requestFS() {
  try { const el = document.documentElement; if (el.requestFullscreen && !document.fullscreenElement) el.requestFullscreen().catch(() => {}); } catch (e) { /* 무시 */ }
}
function exitFS() {
  try { if (document.fullscreenElement && document.exitFullscreen) document.exitFullscreen().catch(() => {}); } catch (e) { /* 무시 */ }
}
function presentHTML() {
  const p = ui.present;
  const total = p.sents.length;
  const i = Math.min(p.i, total - 1);
  const sentence = p.sents[i] || '';
  const atFirst = i <= 0;
  const atLast = i >= total - 1;

  // 진행 점(문장이 많으면 막대로 대체)
  const progress = total <= 24
    ? `<div style="display:flex;gap:6px;align-items:center;justify-content:center;flex-wrap:wrap;max-width:70vw">
        ${p.sents.map((_, k) => `<div data-act="presentGo" data-arg="${k}" style="width:${k === i ? '22px' : '8px'};height:8px;border-radius:99px;background:${k === i ? '#7db4ff' : 'rgba(255,255,255,.28)'};cursor:pointer;transition:width .2s"></div>`).join('')}
      </div>`
    : `<div style="width:min(60vw,520px);height:6px;border-radius:99px;background:rgba(255,255,255,.16);overflow:hidden">
        <div style="width:${((i + 1) / total) * 100}%;height:100%;background:#7db4ff;transition:width .2s"></div>
      </div>`;

  const navBtn = (act, label, disabled) => `<div ${disabled ? '' : `data-act="${act}"`} style="display:flex;align-items:center;justify-content:center;width:52px;height:52px;border-radius:50%;background:rgba(255,255,255,${disabled ? '.05' : '.14'});color:#fff;font-size:22px;cursor:${disabled ? 'default' : 'pointer'};opacity:${disabled ? '.3' : '1'};-webkit-user-select:none;user-select:none">${label}</div>`;

  return `<div style="position:fixed;inset:0;z-index:2147483000;background:radial-gradient(120% 130% at 50% -10%,#123a63 0%,#0b243f 46%,#061627 100%);color:#fff;overflow:hidden">
    <!-- 좌우 탭 영역: 왼쪽 30% 이전, 오른쪽 70% 다음 -->
    <div ${atFirst ? '' : 'data-act="presentPrev"'} style="position:absolute;top:0;left:0;width:30%;height:100%;z-index:1;cursor:${atFirst ? 'default' : 'w-resize'}"></div>
    <div ${atLast ? '' : 'data-act="presentNext"'} style="position:absolute;top:0;right:0;width:70%;height:100%;z-index:1;cursor:${atLast ? 'default' : 'e-resize'}"></div>

    <!-- 상단 바 -->
    <div style="position:absolute;top:0;left:0;right:0;z-index:3;display:flex;align-items:center;justify-content:space-between;padding:16px 20px;pointer-events:none">
      <div style="font-size:13px;font-weight:600;letter-spacing:.3px;color:rgba(255,255,255,.6)">${esc(p.title) || '수업 자료'}</div>
      <div style="display:flex;gap:9px;pointer-events:auto">
        <div data-act="presentClose" title="닫기 (Esc)" style="display:flex;align-items:center;gap:6px;padding:0 15px;height:40px;border-radius:12px;background:rgba(255,255,255,.12);cursor:pointer;font-size:13px;font-weight:700">✕ 닫기</div>
      </div>
    </div>

    <!-- 문장(가운데, 크고 깔끔하게) -->
    <div style="position:absolute;inset:0;z-index:2;display:flex;align-items:center;justify-content:center;padding:9vh 8vw;pointer-events:none">
      <div key="${i}" style="font-family:'Lora',Georgia,serif;font-weight:500;line-height:1.4;text-align:center;font-size:clamp(30px,5.4vw,68px);max-width:1100px;text-wrap:balance;animation:fadeup .4s ease">${esc(sentence)}</div>
    </div>

    <!-- 하단 바: 이전/진행/다음 -->
    <div style="position:absolute;bottom:0;left:0;right:0;z-index:3;display:flex;flex-direction:column;align-items:center;gap:14px;padding:0 20px 26px;pointer-events:none">
      <div style="display:flex;align-items:center;gap:26px;pointer-events:auto">
        ${navBtn('presentPrev', '‹', atFirst)}
        <div style="font-size:14px;font-weight:700;color:rgba(255,255,255,.75);min-width:64px;text-align:center;font-variant-numeric:tabular-nums">${i + 1} / ${total}</div>
        ${navBtn('presentNext', '›', atLast)}
      </div>
      <div style="pointer-events:auto">${progress}</div>
      <div style="font-size:11.5px;color:rgba(255,255,255,.4)">← → 또는 화면 탭으로 넘기기 · Esc 닫기</div>
    </div>
  </div>`;
}

/* ---- 하단 내비게이션 ---- */
function navHTML() {
  const item = (act, icon, label, on) => `
    <div data-act="${act}" style="display:flex;flex-direction:column;align-items:center;gap:3px;cursor:pointer;width:72px">
      <span style="font-size:20px;filter:${on ? 'none' : 'grayscale(1) opacity(.6)'}">${icon}</span>
      <span style="font-size:10px;font-weight:600;color:${on ? '#2f74e6' : '#9aa8bd'}">${label}</span>
    </div>`;
  return `<div style="position:absolute;left:0;right:0;bottom:0;height:66px;background:rgba(255,255,255,.94);backdrop-filter:blur(10px);-webkit-backdrop-filter:blur(10px);border-top:1px solid #e2e9f2;display:flex;align-items:center;justify-content:space-around;padding-bottom:6px;z-index:50">
    ${item('goHome', '🏠', '홈', state.screen === 'home')}
    ${item('goHatch', '🥚', '부화장', state.screen === 'hatchery')}
    ${item('goAqua', '🐠', '아쿠아리움', state.screen === 'aquarium')}
  </div>`;
}

/* ---- 전체 렌더 ---- */
function render() {
  // 날짜가 바뀌면(자정 넘김 포함) 오늘 할 일 리셋
  const before = state.daily && state.daily.date;
  ensureDaily(state);
  if (before !== state.daily.date) save();

  // 역할은 계정으로 자동 결정. 교사는 '학생' 토글로 학생 화면을 미리 볼 수 있음.
  if (authMode()) state.role = (isTeacherUser() && !ui.asStudent) ? 'teacher' : 'student';

  // 화면이 바뀌었을 때만 등장 애니메이션 재생(같은 화면 클릭 리렌더는 애니메이션·스크롤 유지)
  const vk = currentViewKey();
  freshView = (vk !== _prevViewKey);
  _prevViewKey = vk;

  let html = '';
  if (isTeacherUser()) html += roleToggleHTML();  // 교사 계정에만 학생|교사 토글 표시
  if (isTeacherUser() && ui.asStudent && state.role === 'student'
      && !['reader', 'quiz', 'result', 'review', 'previewVocab', 'previewRead', 'previewMedium', 'vocabReview', 'wordTest'].includes(state.screen)) {
    html += previewClassBarHTML();  // 미리보기: 반 선택 바(몰입 화면 제외)
  }

  if (state.hatchStage === 'cracking') html += hatchCinematicHTML();

  if (state.role === 'student') {
    let screen = '';
    switch (state.screen) {
      case 'home': screen = homeHTML(); break;
      case 'aquarium': screen = aquariumHTML(); break;
      case 'review': screen = reviewHTML(); break;
      case 'preview': screen = previewLevelsHTML(); break;
      case 'previewVocab': screen = previewVocabHTML(); break;
      case 'vocabReview': screen = vocabReviewHTML(); break;
      case 'wordTest': screen = wordTestHTML(); break;
      case 'previewMedium': screen = previewMediumHTML(); break;
      case 'previewRead': screen = previewReadHTML(); break;
      case 'quiz': screen = quizHTML(); break;
      case 'result': screen = resultHTML(); break;
      case 'reader': screen = readerHTML(); break;
      case 'hatchery': screen = hatcheryHTML(); break;
    }
    html += `<div class="scroll">${screen}</div>`;
    if (['home', 'aquarium', 'hatchery'].includes(state.screen)) html += navHTML();
  } else {
    html += teacherHTML();
  }

  if (state.role === 'student' && needLogin()) html += loginScreenHTML();
  else if (state.role === 'student' && needApproval()) html += pendingHTML();
  else if (state.role === 'student' && needProfile()) html += profilePickerHTML();
  else if (state.intro && state.role === 'student') html += introHTML();

  if (auth && ui.acct.open) html += accountHTML();  // 내 계정(비번 변경/탈퇴)
  if (ui.present.on) html += presentHTML();  // 수업용 전체화면 발표(최상단)

  const appEl = document.getElementById('app');
  // 같은 화면의 리렌더면 스크롤 위치 보존(초기화되는 느낌 방지)
  const oldScroller = appEl.querySelector('.scroll');
  const savedTop = oldScroller ? oldScroller.scrollTop : 0;
  appEl.innerHTML = html;
  if (!freshView && savedTop) {
    const newScroller = appEl.querySelector('.scroll');
    if (newScroller) newScroller.scrollTop = savedTop;
  }
  bindQuizInput();
}

/* 퀴즈 입력창은 키 입력마다 리렌더하면 포커스를 잃으므로 별도 바인딩 */
function bindQuizInput() {
  const inp = document.getElementById('quiz-input');
  if (!inp) return;
  inp.addEventListener('input', e => {
    state.inputs[state.quizQi] = e.target.value;
    save();
    const btn = document.getElementById('check-btn');
    if (btn) btn.classList.toggle('on', canCheck());
  });
  inp.addEventListener('keydown', e => {
    if (e.key !== 'Enter') return;
    if (state.checked[state.quizQi]) actions.quizNext();
    else actions.quizCheck();
  });
}

/* 이벤트 위임 */
const appEl = document.getElementById('app');
appEl.addEventListener('click', e => {
  const el = e.target.closest('[data-act]');
  if (!el) return;
  // 편집기 카드 내부의 입력 요소 클릭은 액션으로 취급하지 않음
  if (e.target.matches('input, textarea, select') && !e.target.dataset.act) return;
  const fn = actions[el.dataset.act];
  if (fn) fn(el.dataset.arg);
});
// 로그인 폼에서 Enter로 제출
appEl.addEventListener('keydown', e => {
  if (e.key !== 'Enter') return;
  if (['li-id', 'li-pw', 'li-name'].includes(e.target.id)) {
    actions[ui.signupMode ? 'doSignup' : 'doLogin']();
  }
});
// 수업용 발표: 키보드로 넘기기(← → Space PageUp/Down)·Esc 닫기
document.addEventListener('keydown', e => {
  if (!ui.present.on) return;
  if (['ArrowRight', ' ', 'Spacebar', 'PageDown'].includes(e.key)) { e.preventDefault(); actions.presentNext(); }
  else if (['ArrowLeft', 'PageUp'].includes(e.key)) { e.preventDefault(); actions.presentPrev(); }
  else if (e.key === 'Escape') { e.preventDefault(); actions.presentClose(); }
});
// 브라우저 전체화면을 사용자가 직접 끄면(F11/Esc) 발표 오버레이도 함께 닫기
document.addEventListener('fullscreenchange', () => {
  if (!document.fullscreenElement && ui.present.on) { ui.present.on = false; render(); }
});
// 편집기 입력 바인딩(리렌더 없이 편집 객체에 즉시 반영)
appEl.addEventListener('input', e => {
  const el = e.target;
  if (el.id === 'quiz-input' || el.id === 'gh-token') return;
  if (el.id === 'acct-pw1') { ui.acct.pw1 = el.value; return; }
  if (el.id === 'acct-pw2') { ui.acct.pw2 = el.value; return; }
  if (el.id === 'li-id') { ui.li.id = el.value; return; }
  if (el.id === 'li-pw') { ui.li.pw = el.value; return; }
  if (el.id === 'li-name') { ui.li.name = el.value; return; }
  if (el.id === 'li-studentno') { ui.li.studentNo = el.value; return; }
  if (el.dataset.gbind && gEd) { gEd[el.dataset.gbind] = el.value; return; }
  const bind = el.dataset.bind;
  if (bind && ed && el.type !== 'radio' && el.tagName !== 'SELECT') {
    setPath(ed.day, bind, el.value);
  }
});
appEl.addEventListener('change', e => {
  const el = e.target;
  if (el.id === 'li-class') { ui.li.classId = el.value; return; }
  const bind = el.dataset.bind;
  if (!bind || !ed) return;
  let v = el.value;
  if (el.dataset.type === 'number') v = Number(v);
  setPath(ed.day, bind, v);
  if (el.dataset.rerender) render();
});

/* ---- 시작: 먼저 그리고, 배포본을 백그라운드로 가져옴 ---- */
render();
(async () => {
  try {
    const res = await fetch(CONTENT_URL + '?_=' + Date.now(), { cache: 'no-store' });
    if (res.ok) {
      const json = await res.json();
      if (json && Array.isArray(json.days)) {
        PUBLISHED = json;
        if (!DRAFT) render(); // 초안이 없으면 배포본으로 다시 그림
      }
    }
  } catch (e) { /* 오프라인/로컬 파일이면 내장 콘텐츠 사용 */ }
  // 승인된 학생: 접속 시 교사가 준 알/경험치 부여를 적용 + 단어장 동기화
  if (auth && !isTeacherUser() && auth.user && auth.user.approved) {
    await pullGrants();
    loadWordbook();
    render();
  }
})();
