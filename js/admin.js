/* =========================================================
 * Reading Aquarium — 교사용 데스크톱 콘텐츠 관리 (admin.html)
 * 지문(passage) 중심 편집: 지문 하나 + 표지 + [단어] 팝오버에서
 * 리더/지문복습/단어카드가 파생됩니다.
 * 변환 로직(dayToEdit/editToDay 등)은 data.js(공용)를 사용합니다.
 * ========================================================= */

const TOKEN_KEY = 'er_gh_token';
const REPO_OWNER = 'FROGGY789';
const REPO_NAME = 'Reading_Aquarium';
const CONTENT_URL = 'data/content.json';

const esc = s => String(s == null ? '' : s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const clone = o => JSON.parse(JSON.stringify(o));

let content = null;         // { version, students[], supabase{}, days[] }
let ed = null;              // { dayIndex, day(편집형) }
let gEd = null;             // { studentsText, sbUrl, sbKey }
const ui = { tab: 'passage', msg: '', msgType: '', busy: false, loaded: false, expand: false, expandFont: 17, coreMode: 'subject', corePickOpen: false };

/* ---------- 로드 ---------- */
async function boot() {
  try {
    const res = await fetch(CONTENT_URL + '?_=' + Date.now(), { cache: 'no-store' });
    if (res.ok) { const j = await res.json(); if (j && Array.isArray(j.days)) content = j; }
  } catch (e) { /* 무시 */ }
  if (!content) content = clone(typeof DEFAULT_CONTENT !== 'undefined' ? DEFAULT_CONTENT : { version: 1, students: [], supabase: { url: '', anonKey: '' }, days: [] });
  content.students = content.students || [];
  content.classes = content.classes || [];
  content.supabase = content.supabase || { url: '', anonKey: '' };
  if (!content.days.length) content.days = [{ date: _todayKey(), label: '', quote: {}, book: {}, passage: '', vocab: {}, quiz: {} }];
  gEd = { studentsText: content.students.join('\n'), classesText: content.classes.join('\n'), sbUrl: content.supabase.url || '', sbKey: content.supabase.anonKey || '' };
  openDay(bestDayIndex());
  ui.loaded = true;
  render();
}
function bestDayIndex() {
  const days = content.days, today = _todayKey();
  let best = 0;
  days.forEach((d, i) => { if ((d.date || '') <= today && (d.date || '') >= (days[best].date || '')) best = i; });
  return best;
}
function openDay(i) { ed = { dayIndex: i, day: dayToEdit(content.days[i]) }; }
function commit() {
  if (ed) {
    content.days[ed.dayIndex] = editToDay(ed.day);
    content.days.sort((a, b) => (a.date || '').localeCompare(b.date || ''));
    ed.dayIndex = content.days.indexOf(content.days[ed.dayIndex]);
    // 재정렬 후 위치 보정
    const cur = editToDay(ed.day);
    const idx = content.days.findIndex(d => d.date === cur.date && d.label === cur.label);
    ed.dayIndex = idx < 0 ? 0 : idx;
  }
  if (gEd) {
    content.students = gEd.studentsText.split('\n').map(s => s.trim()).filter(Boolean);
    content.classes = gEd.classesText.split('\n').map(s => s.trim()).filter(Boolean);
    content.supabase = { url: gEd.sbUrl.trim(), anonKey: gEd.sbKey.trim() };
  }
}
function setPath(obj, path, val) {
  const ks = path.split('.'); let o = obj;
  for (let i = 0; i < ks.length - 1; i++) o = o[ks[i]];
  o[ks[ks.length - 1]] = val;
}
function toast(msg, type) { ui.msg = msg; ui.msgType = type || ''; }

/* ---------- 액션 ---------- */
const actions = {
  tab(t) { commit(); ui.tab = t; toast(''); render(); },
  expandPassage() { ui.expand = true; render(); },   // 지문 크게 편집(전체화면)
  collapsePassage() { ui.expand = false; render(); },
  expandFontUp() { ui.expandFont = Math.min(32, ui.expandFont + 2); render(); },
  expandFontDown() { ui.expandFont = Math.max(12, ui.expandFont - 2); render(); },
  // 지문에서 드래그해 선택한 부분을 강조(**) / 형광펜(==)로 감싸기
  markPassage(marker) {
    const ta = document.getElementById(ui.expand ? 'pv-textarea' : 'passage-textarea');
    if (!ta) return;
    const s = ta.selectionStart | 0, e = ta.selectionEnd | 0;
    const val = ta.value;
    const hasSel = e > s;
    const sel = hasSel ? val.slice(s, e) : (marker === '**' ? '강조할 내용' : '색칠할 내용');
    const next = val.slice(0, s) + marker + sel + marker + val.slice(e);
    setPath(ed.day, 'passageText', next);   // 편집 모델에 즉시 반영(리렌더 없이 포커스 유지)
    ta.value = next;
    ta.focus();
    const inner = s + marker.length;
    ta.setSelectionRange(inner, inner + sel.length);
  },
  // 어려운(B2+) 단어 자동 [ ] / 대괄호 모두 지우기
  autoBracket() {
    const ta = document.getElementById(ui.expand ? 'pv-textarea' : 'passage-textarea');
    const cur = ta ? ta.value : (ed.day.passageText || '');
    ed.day.passageText = autoBracketHard(cur);
    toast("어려운 단어에 [ ]를 자동 표시했어요. 이름 등 잘못 표시된 건 지우고, 아래 '🔄 지문에서 [단어] 불러오기'로 뜻을 채우세요.", 'ok');
    render();
  },
  clearBrackets() {
    const ta = document.getElementById(ui.expand ? 'pv-textarea' : 'passage-textarea');
    const cur = ta ? ta.value : (ed.day.passageText || '');
    ed.day.passageText = stripBrackets(cur);
    toast('지문의 [ ] 표시를 모두 지웠어요.', 'ok');
    render();
  },
  selectDay(i) { commit(); openDay(Number(i)); toast(''); render(); },
  addDay() {
    commit();
    const tpl = clone(content.days[content.days.length - 1] || { date: _todayKey(), label: '', quote: {}, book: {}, passage: '', vocab: {}, quiz: {} });
    tpl.date = _todayKey(); tpl.label = 'Day ' + (content.days.length + 1);
    content.days.push(tpl);
    openDay(content.days.length - 1);
    toast('새 Day를 추가했어요 (마지막 Day 복제).', 'ok');
    render();
  },
  delDay() {
    if (content.days.length <= 1) { toast('최소 1개의 Day는 남겨야 해요.', 'err'); return; }
    if (!confirm('이 Day를 삭제할까요?')) return;
    content.days.splice(ed.dayIndex, 1);
    openDay(Math.max(0, ed.dayIndex - 1));
    toast('Day를 삭제했어요.', 'ok'); render();
  },
  // 지문에서 [단어]를 스캔해 어휘 목록 갱신 (뜻은 유지)
  syncWords() {
    const found = scanVocab(ed.day.passageText);
    const kept = found.map(w => {
      const row = ed.day.words.find(x => x.word === w);
      return row || { word: w, pos: '', def: '', ex: '' };
    });
    ed.day.words = kept;
    toast(kept.length ? `[단어] ${kept.length}개를 불러왔어요. 뜻을 채워주세요.` : '지문에 [대괄호] 단어가 없어요.', 'ok');
    render();
  },
  addQ(cat) { ed.day.quiz[cat].push({ type: 'mc', prompt: '', sentence: '', options: ['', '', '', ''], answer: 0, accept: '', wrong: -1, chunksText: '', explain: '' }); render(); },
  delQ(arg) { const [cat, i] = arg.split(':'); ed.day.quiz[cat].splice(Number(i), 1); render(); },
  qFixWrong(arg) {   // 오류 고치기: 틀린 단어 클릭 표시
    const [cat, i, wi] = arg.split(':');
    const q = ed.day.quiz[cat][Number(i)]; if (!q) return;
    q.wrong = Number(q.wrong) === Number(wi) ? -1 : Number(wi);
    render();
  },
  /* 핵심 문장(리치) 편집 */
  coreMode(m) { ui.coreMode = m; render(); },
  coreTogglePicker() { ui.corePickOpen = !ui.corePickOpen; render(); },
  coreAdd(arg) {   // 지문의 idx번째 문장을 핵심 문장으로 추가
    const s = passageToSentences(ed.day.passageText)[Number(arg)];
    if (!s) return;
    ed.day.core = ed.day.core || [];
    ed.day.core.push({ text: s, subject: [], verb: [], bold: [], italic: [], ko: '' });
    render();
  },
  coreAddBlank() { ed.day.core = ed.day.core || []; ed.day.core.push({ text: '', subject: [], verb: [], bold: [], italic: [], ko: '' }); render(); },
  coreDelete(arg) { ed.day.core.splice(Number(arg), 1); render(); },
  coreWord(arg) {   // arg = "문장i:단어j" — 현재 모드 마크 토글
    const [si, wi] = arg.split(':').map(Number);
    const c = ed.day.core[si]; if (!c) return;
    if (ui.coreMode === 'clear') { ['subject', 'verb', 'bold', 'italic'].forEach(k => { c[k] = (c[k] || []).filter(x => x !== wi); }); }
    else { const arr = c[ui.coreMode] = c[ui.coreMode] || []; const p = arr.indexOf(wi); if (p >= 0) arr.splice(p, 1); else arr.push(wi); }
    render();
  },
  saveToken() {
    const el = document.getElementById('gh-token'); const v = (el.value || '').trim();
    if (v) { localStorage.setItem(TOKEN_KEY, v); toast('토큰을 저장했어요.', 'ok'); }
    else { localStorage.removeItem(TOKEN_KEY); toast('토큰을 지웠어요.', 'ok'); }
    render();
  },
  reload() {
    if (!confirm('배포된 최신 콘텐츠를 다시 불러올까요? 저장하지 않은 편집 내용은 사라집니다.')) return;
    content = null; ed = null; gEd = null; ui.loaded = false; render(); boot();
  },
  publish() { publish(); }
};

/* ---------- GitHub 배포 ---------- */
async function publish() {
  if (ui.busy) return;
  commit();
  const token = localStorage.getItem(TOKEN_KEY);
  if (!token) { toast('⚠️ 먼저 오른쪽 위에 GitHub 토큰을 입력하고 저장해 주세요.', 'err'); render(); return; }
  ui.busy = true; toast('배포하는 중...'); render();
  const api = `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}`;
  const headers = { 'Authorization': 'Bearer ' + token, 'Accept': 'application/vnd.github+json' };
  // 캐시 없이 현재 파일 sha 읽기(GitHub API가 잠깐 옛 sha를 캐시로 돌려주는 문제 회피)
  const getSha = async branch => {
    const cur = await fetch(`${api}/contents/${CONTENT_URL}?ref=${branch}&_=${Date.now()}`, { headers, cache: 'no-store' });
    return cur.ok ? (await cur.json()).sha : undefined;
  };
  const putOnce = (branch, sha) => {
    const body = { message: '콘텐츠 배포(데스크톱): ' + new Date().toLocaleString('ko-KR'), content: b64(JSON.stringify(content, null, 2)), branch };
    if (sha) body.sha = sha;
    return fetch(`${api}/contents/${CONTENT_URL}`, { method: 'PUT', headers, body: JSON.stringify(body) });
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
      if (res.status === 409) throw new Error('다른 기기·창에서 방금 먼저 배포된 것 같아요. ↻ 최신 불러오기 후 다시 시도해 주세요 (이미 반영됐을 수도 있어요).');
      if ([401, 403].includes(res.status)) throw new Error((err.message || '권한 오류') + ' — 토큰 권한(Contents: Read and write)을 확인해 주세요.');
      throw new Error(err.message || ('HTTP ' + res.status));
    }
    toast('✅ 배포 완료! 1~2분 뒤 모든 기기에 반영됩니다.', 'ok');
  } catch (e) { toast('❌ 배포 실패: ' + e.message, 'err'); }
  ui.busy = false; render();
}
function b64(str) { return btoa(unescape(encodeURIComponent(str))); }

/* ---------- 렌더 ---------- */
function render() {
  const root = document.getElementById('admin');
  if (!ui.loaded) { root.innerHTML = topbar(false) + `<div class="wrap"><div class="card">불러오는 중...</div></div>`; return; }
  const d = ed.day;
  const tabBtn = (id, label) => `<div class="daychip ${ui.tab === id ? 'on' : ''}" data-act="tab" data-arg="${id}">${label}</div>`;

  let panel = '';
  if (ui.tab === 'passage') panel = passageTab(d);
  else if (ui.tab === 'preview') panel = previewTab(d);
  else if (ui.tab === 'quiz') panel = quizTab(d);
  else panel = settingsTab();

  root.innerHTML = topbar(true) + `
  <div class="wrap">
    <div class="daybar">
      ${content.days.map((day, i) => {
        const md = (day.date || '').slice(5).replace('-', '/');
        const ct = day.class ? ` 〔${esc(day.class)}〕` : '';
        return `<div class="daychip ${i === ed.dayIndex ? 'on' : ''}" data-act="selectDay" data-arg="${i}">${esc(md)}${day.label ? ' · ' + esc(day.label) : ''}${ct}</div>`;
      }).join('')}
      <button class="btn ghost sm" data-act="addDay">＋ 새 Day</button>
    </div>

    <div class="daybar" style="margin-bottom:16px">
      ${tabBtn('passage', '📖 지문 · 책')}
      ${tabBtn('preview', '👀 예습 (살살·보통·버닝)')}
      ${tabBtn('quiz', '📝 복습 · 퀴즈')}
      ${tabBtn('settings', '⚙️ 학생 · 설정')}
    </div>

    ${panel}
  </div>

  <div class="savebar">
    <div class="msg ${ui.msgType === 'ok' ? 'toast-ok' : ui.msgType === 'err' ? 'toast-err' : ''}">${ui.msg ? esc(ui.msg) : '변경 후 <b>배포</b>를 누르면 모든 기기에 반영됩니다.'}</div>
    <button class="btn danger" data-act="delDay">이 Day 삭제</button>
    <button class="btn primary" data-act="publish" ${ui.busy ? 'disabled' : ''}>${ui.busy ? '배포 중...' : '🚀 배포하기'}</button>
  </div>
  ${ui.expand ? passageEditorOverlay(d) : ''}`;

  if (ui.expand) { const t = document.getElementById('pv-textarea'); if (t && document.activeElement !== t) { t.focus(); t.setSelectionRange(t.value.length, t.value.length); } }
}

// 지문 전체화면 편집 오버레이(장편 검토용)
function passageEditorOverlay(d) {
  const paras = (typeof passageToReview === 'function') ? passageToReview(d.passageText).length : 0;
  const chars = (d.passageText || '').length;
  return `<div style="position:fixed;inset:0;z-index:1000;background:#f7f9fc;display:flex;flex-direction:column">
    <div style="display:flex;align-items:center;gap:12px;padding:12px 18px;background:#fff;border-bottom:1px solid #e2e9f2;flex:none">
      <div style="font-size:15px;font-weight:800;color:#14243f;white-space:nowrap">📖 지문 크게 편집${d.label ? ' · ' + esc(d.label) : ''}</div>
      <div style="font-size:12px;color:#7d8aa0">문단=빈 줄 · 페이지=<span class="mono">---</span> · 팝오버=<span class="mono">[단어]</span></div>
      <button class="btn ghost sm" data-act="markPassage" data-arg="**" title="선택한 부분을 굵게 강조"><b>B</b> 강조</button>
      <button class="btn ghost sm" data-act="markPassage" data-arg="==" title="선택한 부분에 형광펜 색">🖍 형광펜</button>
      <button class="btn primary sm" data-act="autoBracket" title="어려운(B2+) 단어 자동 [ ]">🔎 자동 [ ]</button>
      <button class="btn ghost sm" data-act="clearBrackets" title="[ ] 모두 지우기">⌫ [ ]</button>
      <div style="flex:1"></div>
      <span style="font-size:12px;color:#7d8aa0;white-space:nowrap">${paras}문단 · ${chars.toLocaleString()}자</span>
      <button class="btn ghost sm" data-act="expandFontDown" title="글자 작게">가－</button>
      <span style="font-size:12px;color:#9aa8bd;width:34px;text-align:center">${ui.expandFont}px</span>
      <button class="btn ghost sm" data-act="expandFontUp" title="글자 크게">가＋</button>
      <button class="btn primary sm" data-act="collapsePassage">✓ 완료</button>
    </div>
    <div style="flex:1;overflow:auto;display:flex;justify-content:center;padding:18px">
      <textarea id="pv-textarea" class="inp" data-bind="passageText" spellcheck="false" style="width:100%;max-width:920px;height:100%;resize:none;font-size:${ui.expandFont}px;line-height:1.85;padding:24px 28px;border-radius:12px" placeholder="여기에 그날 읽을 지문을 붙여넣으세요. 아주 길어도 괜찮아요.">${esc(d.passageText)}</textarea>
    </div>
  </div>`;
}

function topbar(loaded) {
  const hasToken = loaded && !!localStorage.getItem(TOKEN_KEY);
  return `<div class="topbar">
    <div class="brand">Reading Aquarium <small>교사 콘텐츠 관리 · 데스크톱 · <b style="color:#2f74e6">v23 (어려운 단어 자동 [ ])</b></small></div>
    <div class="spacer"></div>
    <input id="gh-token" type="password" class="inp" style="max-width:260px" placeholder="${hasToken ? 'GitHub 토큰 저장됨 (변경 시 입력)' : 'GitHub 토큰 (github_pat_...)'}">
    <button class="btn light sm" data-act="saveToken">토큰 저장</button>
    <button class="btn light sm" data-act="reload">↻ 최신 불러오기</button>
    <a class="btn light sm" style="text-decoration:none" href="index.html">앱 열기 ↗</a>
  </div>`;
}

/* ---- 탭 1: 지문 · 책 ---- */
function passageTab(d) {
  const cover = (d.book.cover || '').trim();
  const spine = (d.book.spine || '').trim();
  return `<div class="cols">
    <div>
      <div class="card">
        <h2>기본 정보 & 책</h2>
        <div class="label">수업 날짜 <span style="font-weight:400;color:#b8c2d2">(이 날짜부터 학생에게 노출)</span> / 라벨</div>
        <div class="row">
          <input type="date" class="inp" data-bind="date" value="${esc(d.date)}">
          <input class="inp" data-bind="label" value="${esc(d.label)}" placeholder="라벨 (예: A반 Day 3)">
        </div>
        <div class="label">📢 대상 반 <span style="font-weight:400;color:#b8c2d2">(이 반에게만 배포 · '공통'이면 모든 반에게 보여요)</span></div>
        <select class="inp" data-bind="classTarget" data-rerender="1">
          <option value="" ${!d.classTarget ? 'selected' : ''}>공통 (모든 반)</option>
          ${(content.classes || []).map(c => `<option value="${esc(c)}" ${d.classTarget === c ? 'selected' : ''}>${esc(c)}</option>`).join('')}
        </select>
        ${(content.classes || []).length ? '' : `<div class="hint" style="margin-top:6px">아직 반이 없어요 — 아래 <b>학생·설정</b> 탭에서 반을 먼저 만들면 여기서 고를 수 있어요.</div>`}
        <div class="label">책 제목 / 저자 / 챕터</div>
        <input class="inp" data-bind="book.title" value="${esc(d.book.title)}" placeholder="책 제목">
        <div class="row" style="margin-top:8px">
          <input class="inp" data-bind="book.author" value="${esc(d.book.author)}" placeholder="저자">
          <input class="inp" style="flex:1.4" data-bind="book.chapter" value="${esc(d.book.chapter)}" placeholder="챕터">
        </div>
      </div>

      <div class="card">
        <h2>책 표지 · 책등(서가)</h2>
        <div class="hint">표지 이미지 <b>주소(URL)</b>를 붙여넣으면 학생 홈·리더에 표지로 나와요. 책등 이미지는 홈 <b>서가</b>에 세워진 모습으로 보여요. (이미지에 우클릭 → "이미지 주소 복사")</div>
        <div class="label">표지 이미지 URL</div>
        <input class="inp" data-bind="book.cover" data-rerender="1" value="${esc(cover)}" placeholder="https://.../cover.jpg">
        <div class="label">책등(서가) 이미지 URL <span style="font-weight:400;color:#b8c2d2">— 비우면 제목이 세로로 적힌 책등이 자동 생성돼요</span></div>
        <input class="inp" data-bind="book.spine" data-rerender="1" value="${esc(spine)}" placeholder="https://.../spine.jpg (선택)">
        <div style="margin-top:12px;display:flex;gap:14px;align-items:flex-start">
          ${cover
            ? `<img src="${esc(cover)}" alt="표지 미리보기" style="width:96px;height:132px;object-fit:cover;border-radius:10px;border:1px solid #e2e9f2" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'">
               <div style="display:none;width:96px;height:132px;border-radius:10px;border:1px dashed #e2564d;color:#b23a32;align-items:center;justify-content:center;font-size:12px;text-align:center;padding:8px">이미지를<br>불러올 수 없어요</div>`
            : `<div style="width:96px;height:132px;border-radius:10px;border:1px dashed #c8d4e2;color:#9aa8bd;display:flex;align-items:center;justify-content:center;font-size:12px;text-align:center">표지<br>없음</div>`}
          ${spine
            ? `<img src="${esc(spine)}" alt="책등 미리보기" style="width:40px;height:132px;object-fit:cover;border-radius:2px 5px 5px 2px;border:1px solid #e2e9f2" onerror="this.style.display='none'">`
            : `<div style="width:40px;height:132px;border-radius:2px 5px 5px 2px;background:linear-gradient(90deg,#1f57c4,#2f74e6);display:flex;align-items:center;justify-content:center"><div style="writing-mode:vertical-rl;transform:rotate(180deg);font-family:'Lora',serif;font-size:10px;color:#fff;padding:6px 0;max-height:120px;overflow:hidden">${esc(d.book.title || '제목')}</div></div>`}
          <div style="font-size:12px;color:#7d8aa0;line-height:1.7">← 표지 / 책등 →<br>서가에는 책등이 세워져 보이고,<br>탭하면 표지와 함께 읽기가 열려요.</div>
        </div>
      </div>
    </div>

    <div>
      <div class="card">
        <div style="display:flex;align-items:center;justify-content:space-between;gap:10px">
          <h2 style="margin:0">지문 (그날 읽을 전체 텍스트)</h2>
          <button class="btn primary sm" data-act="expandPassage" title="전체화면으로 크게 편집">⤢ 크게 편집</button>
        </div>
        <div class="hint" style="margin-top:10px">
          · 문단은 <b>빈 줄</b>로 구분<br>
          · e-북 페이지는 <span class="mono">---</span> 를 한 줄에 넣어 구분<br>
          · 팝오버로 뜻을 보여줄 단어는 <span class="mono">[대괄호]</span>로 감싸기 (예: a <span class="mono">[restless]</span> horizon)<br>
          · <b>강조/색</b>: 굵게는 <span class="mono">**이렇게**</span>, 형광펜은 <span class="mono">==이렇게==</span> — 발표·리더·복습에 그대로 나와요<br>
          · <b>🔎 어려운 단어 자동 [ ]</b>: 대략 B2 이상으로 보이는 단어에 자동으로 대괄호를 쳐요(근사치 — 이름 등은 확인 후 지우세요)<br>
          이 지문 하나에서 <b>e-북 리더</b>와 <b>지문 복습(팝오버)</b>이 모두 나와요.
        </div>
        <div style="display:flex;gap:7px;margin:10px 0 8px;flex-wrap:wrap;align-items:center">
          <button class="btn ghost sm" data-act="markPassage" data-arg="**" title="선택한 부분을 굵게 강조 (**...**)"><b>B</b> 강조</button>
          <button class="btn ghost sm" data-act="markPassage" data-arg="==" title="선택한 부분에 형광펜 색 (==...==)">🖍 형광펜</button>
          <span class="hint" style="margin:0">← <b>드래그 선택</b> 후 누르기</span>
          <span style="flex:1"></span>
          <button class="btn primary sm" data-act="autoBracket" title="B2 이상으로 보이는 어려운 단어에 자동으로 [ ] 표시">🔎 어려운 단어 자동 [ ]</button>
          <button class="btn ghost sm" data-act="clearBrackets" title="지문의 모든 [ ]를 지우기">⌫ [ ] 지우기</button>
        </div>
        <textarea id="passage-textarea" class="inp" data-bind="passageText" rows="20" placeholder="여기에 그날 읽을 지문을 붙여넣으세요. 아주 길어도 괜찮아요.">${esc(d.passageText)}</textarea>
        <div style="display:flex;align-items:center;justify-content:space-between;margin-top:12px">
          <div class="cathead" style="margin:0"><div class="name">팝오버 어휘 <span class="cnt">${d.words.length}개</span></div></div>
          <button class="btn ghost sm" data-act="syncWords">🔄 지문에서 [단어] 불러오기</button>
        </div>
        <div class="hint" style="margin-top:6px">지문에 <span class="mono">[단어]</span>를 넣은 뒤 위 버튼을 누르면 아래 목록이 채워져요. 각 단어의 뜻·품사·예문을 한 번만 적어두면 지문 복습에서 팝오버로 떠요.</div>
        ${d.words.map((w, i) => `
          <div class="qcard">
            <div class="row" style="align-items:center">
              <div style="flex:none;min-width:110px;font-family:'Lora',serif;font-weight:700;font-size:15px;color:#14243f">${esc(w.word)}</div>
              <input class="inp" style="flex:.7" data-bind="words.${i}.pos" value="${esc(w.pos)}" placeholder="품사 (형용사)">
            </div>
            <input class="inp" style="margin-top:7px" data-bind="words.${i}.def" value="${esc(w.def)}" placeholder="뜻">
            <input class="inp" style="margin-top:7px" data-bind="words.${i}.ex" value="${esc(w.ex)}" placeholder="예문 (선택)">
          </div>`).join('') || '<div class="empty">아직 팝오버 단어가 없어요. 지문에 [대괄호]를 넣고 위 버튼을 누르세요.</div>'}
      </div>
    </div>
  </div>`;
}

/* ---- 탭 2: 지문 예습 (살살·보통·버닝) ---- */
function previewTab(d) {
  return `<div class="card" style="background:#f4faf6;border-color:#cfe9da">
    <h2>지문 예습 3단계 안내</h2>
    <div class="hint" style="margin:0">
      학생은 예습할 때 난이도를 골라요. 아래에서 각 단계에 쓸 내용을 준비하세요.<br>
      🟢 <b>살살</b> — <b>지문의 [단어] 어휘 카드</b>로 자동 구성돼요 (지문 탭에서 단어 뜻만 채우면 끝).<br>
      🟡 <b>보통</b> — 아래 <b>핵심 문장</b>을 읽어요.<br>
      🔴 <b>버닝</b> — 지문 전체를 읽고 아래 <b>이해도 확인</b> 문항을 풀어요.
    </div>
  </div>
  <div class="cols">
    ${coreEditor(d)}
    <div class="card">
      <h2>🔴 버닝 · 이해도 확인 (comprehension)</h2>
      <div class="hint">지문 전체를 읽은 뒤 풀 문항이에요. 비워두면 읽기만으로 완료돼요.</div>
      ${qcat('preview')}
    </div>
  </div>`;
}

// 🟡 보통 · 핵심 문장 리치 편집기(주어/동사 표시 + 볼드/이탤릭 + 해석)
function coreEditor(d) {
  const core = d.core || [];
  const modeBtn = (m, label, color) => `<button class="btn sm" data-act="coreMode" data-arg="${m}" style="background:${ui.coreMode === m ? color : '#eef2f8'};color:${ui.coreMode === m ? '#fff' : '#4a5a72'};border:1px solid ${ui.coreMode === m ? color : '#e2e9f2'}">${label}</button>`;
  const chip = (si, wi, w, c) => {
    const isS = (c.subject || []).includes(wi), isV = (c.verb || []).includes(wi), isB = (c.bold || []).includes(wi), isI = (c.italic || []).includes(wi);
    let bg = '#fff', bd = '#e2e9f2';
    if (isS) { bg = '#dbeafe'; bd = '#2f74e6'; }
    if (isV) { bg = '#dcfce7'; bd = '#2fa36b'; }
    if (isS && isV) { bg = 'linear-gradient(90deg,#dbeafe,#dcfce7)'; }
    return `<span data-act="coreWord" data-arg="${si}:${wi}" style="display:inline-block;margin:2px;padding:4px 8px;border-radius:8px;cursor:pointer;border:1px solid ${bd};background:${bg};color:#14243f;font-weight:${isB ? '800' : '500'};font-style:${isI ? 'italic' : 'normal'};font-family:'Lora',serif;font-size:15px">${esc(w)}</span>`;
  };
  const cards = core.map((c, si) => {
    const toks = (c.text || '').split(/\s+/).filter(Boolean);
    return `<div class="qcard">
      <div class="row" style="align-items:center;margin-bottom:8px">
        <span style="flex:none;font-size:12px;font-weight:700;color:#7d8aa0">문장 ${si + 1}</span>
        <input class="inp" style="flex:1" data-bind="core.${si}.text" data-rerender="1" value="${esc(c.text)}" placeholder="핵심 문장(영어)">
        <button class="btn danger sm" data-act="coreDelete" data-arg="${si}">삭제</button>
      </div>
      ${toks.length ? `<div style="margin-bottom:8px;line-height:2.1">${toks.map((w, wi) => chip(si, wi, w, c)).join('')}</div>` : '<div class="hint" style="margin:0 0 8px">문장을 입력하고 <b>Enter</b>(또는 다른 곳 클릭) 하면 단어를 클릭해 표시할 수 있어요.</div>'}
      <input class="inp" data-bind="core.${si}.ko" value="${esc(c.ko)}" placeholder="우리말 해석 (문장 작문·채점에 사용)">
    </div>`;
  }).join('') || '<div class="empty">아직 핵심 문장이 없어요. 아래에서 지문 문장을 골라 추가하세요.</div>';
  const psents = passageToSentences(d.passageText);
  const picker = ui.corePickOpen ? `
    <div style="margin-top:8px;border:1px solid #e2e9f2;border-radius:12px;padding:8px 10px;max-height:240px;overflow:auto;background:#fafcff">
      ${psents.length ? psents.map((s, i) => `<div style="display:flex;align-items:center;gap:8px;padding:5px 0;border-bottom:1px solid #f0f4f9">
        <button class="btn ghost sm" data-act="coreAdd" data-arg="${i}" style="flex:none">＋</button>
        <span style="font-size:13px;color:#4a5a72;font-family:'Lora',serif">${esc(s)}</span>
      </div>`).join('') : '<div class="hint" style="margin:0">지문이 비어 있어요. 지문 탭에서 먼저 입력하세요.</div>'}
    </div>` : '';
  return `<div class="card">
    <h2>🟡 보통 · 핵심 문장 <span style="font-size:12px;color:#7d8aa0;font-weight:600">${core.length}문장</span></h2>
    <div class="hint"><b>모드를 고르고 단어를 클릭</b>해 표시하세요. 🔵주어 · 🟢동사(예습 '보통' 채점에 사용) · 볼드·이탤릭(강조). 해석은 '문장 작문'에 쓰여요. 비워두면 지문 앞 문장 6개가 자동으로 쓰여요.</div>
    <div style="display:flex;flex-wrap:wrap;gap:6px;margin:10px 0">
      ${modeBtn('subject', '🔵 주어', '#2f74e6')}
      ${modeBtn('verb', '🟢 동사', '#2fa36b')}
      ${modeBtn('bold', '볼드', '#14243f')}
      ${modeBtn('italic', '이탤릭', '#8a5fd6')}
      ${modeBtn('clear', '🧽 지우개', '#b23a32')}
    </div>
    ${cards}
    <div style="display:flex;gap:8px;margin-top:10px">
      <button class="btn ghost sm" data-act="coreTogglePicker">${ui.corePickOpen ? '▲ 닫기' : '📄 지문에서 문장 고르기'}</button>
      <button class="btn ghost sm" data-act="coreAddBlank">＋ 직접 입력</button>
    </div>
    ${picker}
  </div>`;
}

/* ---- 탭 3: 복습 · 퀴즈 ---- */
function quizTab(d) {
  return `<div class="card">
    <h2>오늘 선생님이 고른 문장</h2>
    <div class="row">
      <input class="inp" data-bind="quote.en" value="${esc(d.quote.en)}" placeholder="영어 문장">
      <input class="inp" data-bind="quote.ko" value="${esc(d.quote.ko)}" placeholder="우리말 해석">
    </div>
    <div class="row" style="margin-top:8px">
      <input class="inp" style="flex:.6" data-bind="quote.teacher" value="${esc(d.quote.teacher)}" placeholder="선생님 이름">
      <input class="inp" style="flex:1.4" data-bind="quote.comment" value="${esc(d.quote.comment)}" placeholder="한마디">
    </div>
  </div>
  <div class="card">
    <h2>복습 · 보조 퀴즈</h2>
    <div class="hint">문제를 비워두면 그 문항은 출제되지 않아요. 문항이 하나도 없는 카테고리는 학생 홈에서 숨겨집니다.</div>
    <div class="cols">
      <div>${['vocab', 'sentence'].map(qcat).join('')}</div>
      <div>${['grammar', 'vocabPrep', 'sentPrep'].map(qcat).join('')}</div>
    </div>
  </div>`;
}
function qcat(cat) {
  const meta = QUIZ_META[cat];
  const list = ed.day.quiz[cat];
  const cards = list.map((q, i) => {
    const base = `quiz.${cat}.${i}`;
    const opts = q.type === 'mc' ? q.options.map((o, oi) => `
      <div class="opt">
        <input type="radio" name="ans-${cat}-${i}" value="${oi}" data-bind="${base}.answer" data-type="number" ${Number(q.answer) === oi ? 'checked' : ''}>
        <input class="inp" data-bind="${base}.options.${oi}" value="${esc(o)}" placeholder="보기 ${oi + 1}${oi < 2 ? '' : ' (선택)'}">
      </div>`).join('') : '';
    return `<div class="qcard">
      <div class="qhead">
        <span class="qnum">Q${i + 1}</span>
        <span style="font-size:11.5px;font-weight:700;color:#7d8aa0">형식</span>
        <select class="inp" style="width:auto;padding:6px 8px" data-bind="${base}.type" data-rerender="1">
          <option value="mc" ${q.type === 'mc' ? 'selected' : ''}>A~D 고르기(객관식)</option>
          <option value="ab" ${q.type === 'ab' ? 'selected' : ''}>[A/B] 고르기</option>
          <option value="fix" ${q.type === 'fix' ? 'selected' : ''}>오류 고치기</option>
          <option value="scramble" ${q.type === 'scramble' ? 'selected' : ''}>Scramble(순서 맞추기)</option>
          <option value="input" ${q.type === 'input' ? 'selected' : ''}>주관식</option>
        </select>
        <div style="flex:1"></div>
        <button class="btn danger sm" data-act="delQ" data-arg="${cat}:${i}">삭제</button>
      </div>
      <input class="inp" data-bind="${base}.prompt" value="${esc(q.prompt)}" placeholder="문제 ${(q.type === 'ab' || q.type === 'scramble') ? '(비워도 됨)' : ''}">
      ${q.type === 'scramble' ? '' : `<input class="inp" style="margin-top:7px" data-bind="${base}.sentence" data-rerender="1" value="${esc(q.sentence)}" placeholder="${q.type === 'ab' ? '문장에 [정답/오답] 넣기 — 예: She [was/were] happy.' : q.type === 'fix' ? '틀린 부분이 든 문장 — 예: She go to school.' : '예문/제시 문장 (선택)'}">`}
      ${q.type === 'mc'
        ? `<div class="label" style="margin-bottom:2px">보기 (동그라미로 정답 선택, 2개 이상)</div>${opts}`
        : q.type === 'ab'
          ? `<div class="label" style="margin:6px 0 2px">둘 중 어느 쪽이 정답인가요?</div>
             <div class="opt" style="gap:16px">
               <label style="display:flex;align-items:center;gap:5px;cursor:pointer"><input type="radio" name="ab-${cat}-${i}" value="0" data-bind="${base}.answer" data-type="number" ${Number(q.answer) === 0 ? 'checked' : ''}> 앞[A] 정답</label>
               <label style="display:flex;align-items:center;gap:5px;cursor:pointer"><input type="radio" name="ab-${cat}-${i}" value="1" data-bind="${base}.answer" data-type="number" ${Number(q.answer) === 1 ? 'checked' : ''}> 뒤[B] 정답</label>
             </div>`
          : q.type === 'fix'
            ? `<div class="label" style="margin:6px 0 2px">문장에서 <b>틀린 단어를 클릭</b>하세요 ${Number(q.wrong) >= 0 ? '✅' : ''}</div>
               <div style="line-height:2.1">${(q.sentence || '').split(/\s+/).filter(Boolean).map((w, wi) => `<span data-act="qFixWrong" data-arg="${cat}:${i}:${wi}" style="display:inline-block;margin:2px;padding:3px 8px;border-radius:8px;border:1.5px solid ${Number(q.wrong) === wi ? '#e2564d' : '#e2e9f2'};background:${Number(q.wrong) === wi ? '#fbe4e2' : '#fff'};cursor:pointer;font-family:'Lora',serif;font-size:15px">${esc(w)}</span>`).join('') || '<span class="hint" style="margin:0">위 칸에 문장을 먼저 입력하세요</span>'}</div>
               <input class="inp" style="margin-top:7px" data-bind="${base}.accept" value="${esc(q.accept)}" placeholder="바른 표현 (여러 개면 쉼표: goes, went)">`
            : q.type === 'scramble'
              ? `<div class="label" style="margin:6px 0 2px">조각을 <b>정답 순서대로</b>, <b>/</b> 로 구분 (2~3단어씩)</div>
                 <input class="inp" data-bind="${base}.chunksText" value="${esc(q.chunksText || '')}" placeholder="The sea / has always / drawn people.">`
              : `<input class="inp" style="margin-top:7px" data-bind="${base}.accept" value="${esc(q.accept)}" placeholder="정답 (여러 개면 쉼표: retreat, 후퇴하다)">`}
      <input class="inp" style="margin-top:7px" data-bind="${base}.explain" value="${esc(q.explain)}" placeholder="해설">
    </div>`;
  }).join('');
  return `<div class="catbox">
    <div class="cathead">
      <div class="name">${meta.name} <span class="cnt">${list.length}문항</span></div>
      <button class="btn ghost sm" data-act="addQ" data-arg="${cat}">＋ 문항</button>
    </div>
    ${cards || '<div class="empty">문항이 없으면 이 항목은 학생 홈에서 숨겨져요.</div>'}
  </div>`;
}

/* ---- 탭 3: 학생 · 설정 ---- */
function settingsTab() {
  return `<div class="cols">
    <div>
      <div class="card">
        <h2>🏫 반 목록</h2>
        <div class="hint">한 줄에 한 반씩. 학생이 가입할 때 여기서 반을 골라요. (예: A반, B반, 3학년 2반)</div>
        <textarea class="inp" data-gbind="classesText" rows="5" placeholder="A반&#10;B반&#10;C반">${esc(gEd.classesText)}</textarea>
      </div>
      <div class="card">
        <h2>👧 학생 명단 <span style="font-size:12px;color:#7d8aa0;font-weight:600">(Supabase 미사용 시)</span></h2>
        <div class="hint">한 줄에 한 명씩. Supabase(오른쪽)가 설정돼 있으면 아이디/비밀번호 로그인이 대신 사용돼 이 명단은 무시됩니다.</div>
        <textarea class="inp" data-gbind="studentsText" rows="6" placeholder="이지민&#10;박서준&#10;최하윤">${esc(gEd.studentsText)}</textarea>
      </div>
    </div>
    <div class="card">
      <h2>📡 기록 수집 (Supabase)</h2>
      <div class="hint">설정하면 학생 로그인 + 점수 기록이 켜집니다. 보통은 코드에 이미 고정돼 있어 비워둬도 돼요.</div>
      <div class="label">Project URL</div>
      <input class="inp" data-gbind="sbUrl" value="${esc(gEd.sbUrl)}" placeholder="https://xxxx.supabase.co">
      <div class="label">anon public key</div>
      <input class="inp" data-gbind="sbKey" value="${esc(gEd.sbKey)}" placeholder="eyJ...">
    </div>
  </div>`;
}

/* ---------- 이벤트 ---------- */
const rootEl = document.getElementById('admin');
rootEl.addEventListener('click', e => {
  const el = e.target.closest('[data-act]');
  if (!el || el.tagName === 'A') return;
  const fn = actions[el.dataset.act];
  if (fn) fn(el.dataset.arg);
});
rootEl.addEventListener('input', e => {
  const el = e.target;
  if (el.id === 'gh-token') return;
  if (el.dataset.gbind) { gEd[el.dataset.gbind] = el.value; return; }
  const bind = el.dataset.bind;
  if (bind && el.type !== 'radio' && el.tagName !== 'SELECT') setPath(ed.day, bind, el.value);
});
rootEl.addEventListener('change', e => {
  const el = e.target;
  const bind = el.dataset.bind;
  if (!bind) return;
  let v = el.value;
  if (el.dataset.type === 'number') v = Number(v);
  setPath(ed.day, bind, v);
  if (el.dataset.rerender) render();
});

// 지문 크게 편집: Esc로 닫기(내용은 이미 저장돼 있어 안전)
document.addEventListener('keydown', e => { if (e.key === 'Escape' && ui.expand) { ui.expand = false; render(); } });

boot();
