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
let gramEd = null;          // 어법 커리큘럼(편집형) — 모든 챕터 공통, content.grammar와 동기화
// 저장형 어법 개념 → 편집형 / 편집형 → 저장형
function gramConceptToEdit(c) { c = c || {}; return { title: c.title || '', explain: c.explain || '', quiz: (c.quiz || []).map(quizItemToEdit) }; }
function gramConceptToSaved(c) { return { title: (c.title || '').trim(), explain: (c.explain || '').trim(), quiz: (c.quiz || []).map(quizItemToSaved).filter(Boolean) }; }
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
  content.grammar = Array.isArray(content.grammar) ? content.grammar : [];
  gEd = { studentsText: content.students.join('\n'), classesText: content.classes.join('\n'), sbUrl: content.supabase.url || '', sbKey: content.supabase.anonKey || '' };
  gramEd = content.grammar.map(gramConceptToEdit);
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
  syncEditor();   // 지문 편집기(contenteditable) 최신 내용을 편집 모델에 반영
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
  if (gramEd) {
    // 완전히 빈 개념(제목·설명·문항 모두 없음)은 저장에서 제외
    content.grammar = gramEd.map(gramConceptToSaved).filter(c => c.title || c.explain || c.quiz.length);
  }
}
function setPath(obj, path, val) {
  const ks = path.split('.'); let o = obj;
  for (let i = 0; i < ks.length - 1; i++) o = o[ks[i]];
  o[ks[ks.length - 1]] = val;
}
function toast(msg, type) { ui.msg = msg; ui.msgType = type || ''; }
// 일정 탭: 다른 챕터의 필드를 직접 수정(현재 편집 중인 챕터면 편집 모델에도 반영)
function applySchedField(el) {
  const i = Number(el.dataset.sched);
  const field = el.dataset.schedfield;
  const day = content.days[i];
  if (!day) return;
  const val = el.value;
  const isCur = i === ed.dayIndex;
  if (field === 'date') { day.date = val; if (isCur) ed.day.date = val; }
  else if (field === 'chapter') { day.book = day.book || {}; day.book.chapter = val; if (isCur) ed.day.book.chapter = val; }
  else if (field === 'bookTitle') {
    const oldTitle = (day.book && day.book.title) || '';
    content.days.forEach((x, xi) => {
      if (((x.book && x.book.title) || '') === oldTitle) { x.book = x.book || {}; x.book.title = val; if (xi === ed.dayIndex) ed.day.book.title = val; }
    });
  } else if (field === 'class') { if (val) day.class = val; else delete day.class; if (isCur) ed.day.classTarget = val; }
  else if (['reviewFrom', 'reviewTo', 'previewFrom', 'previewTo'].includes(field)) {
    if (val) day[field] = val; else delete day[field];
    if (isCur) ed.day[field] = val;
  }
}
// 날짜 재정렬 후에도 현재 편집 중이던 챕터 선택을 유지
function resortKeepSel() {
  const cur = content.days[ed.dayIndex];
  content.days.sort((a, b) => (a.date || '').localeCompare(b.date || ''));
  const idx = content.days.indexOf(cur);
  ed.dayIndex = idx < 0 ? 0 : idx;
}

/* ---------- 액션 ---------- */
const actions = {
  tab(t) { commit(); ui.tab = t; toast(''); render(); },
  expandPassage() { syncEditor(); ui.expand = true; render(); },   // 지문 크게 편집(전체화면)
  collapsePassage() { syncEditor(); ui.expand = false; render(); },
  expandFontUp() { syncEditor(); ui.expandFont = Math.min(32, ui.expandFont + 2); render(); },
  expandFontDown() { syncEditor(); ui.expandFont = Math.max(12, ui.expandFont - 2); render(); },
  // 선택 영역 서식: 굵게 / 문법(파랑) / 핵심문장(노랑+예습보통) / 어휘(<>) / 서식 지우기
  fmtBold() { const el = activeEditorEl(); if (!el) return; el.focus(); document.execCommand('bold'); syncEditor(); },
  fmtMark() { applyHighlight('y'); },                 // (구버전 호환) 노란 형광펜
  fmtGrammar() { applyHighlight('b'); },              // 문법 = 파란 형광펜
  fmtCore() {                                         // 핵심문장 = 노란 형광펜 + 예습 '보통'에 추가
    const el = activeEditorEl(); if (!el) return;
    const sel = window.getSelection();
    const text = (sel ? sel.toString() : '').replace(/\s+/g, ' ').trim();
    applyHighlight('y');
    if (text) {
      ed.day.core = ed.day.core || [];
      const norm = s => (s || '').replace(/\s+/g, ' ').trim().toLowerCase();
      if (!ed.day.core.some(c => norm(c.text) === norm(text))) {
        ed.day.core.push({ text, subject: [], verb: [], bold: [], italic: [], ko: '' });
      }
      toast('핵심문장으로 표시했어요 · 예습 "보통"에 추가됨(해석은 예습 탭에서 채우세요).', 'ok');
    } else {
      toast('먼저 문장을 드래그해서 선택하세요.', 'err');
    }
    render();
  },
  fmtVocab() {                                        // 어휘 = 선택 단어를 <>로 감싸 팝오버 지정
    const el = activeEditorEl(); if (!el) return; el.focus();
    const sel = window.getSelection();
    const text = (sel ? sel.toString() : '').trim();
    if (!text) { toast('먼저 단어를 드래그해서 선택하세요.', 'err'); render(); return; }
    if (/^<.*>$/.test(text)) { toast('이미 어휘로 표시된 것 같아요.', 'err'); return; }
    document.execCommand('insertText', false, '<' + text + '>');
    syncEditor();
    refreshWords();
    toast('어휘로 표시했어요. 오른쪽 목록에서 뜻을 채워주세요.', 'ok');
    render();
  },
  fmtClear() { const el = activeEditorEl(); if (!el) return; el.focus(); document.execCommand('removeFormat'); syncEditor(); },
  // 어려운(B2+) 단어 자동 <> / <> 모두 지우기
  autoBracket() {
    syncEditor();
    ed.day.passageText = autoBracketHard(ed.day.passageText || '');
    refreshWords();
    toast("어려운 단어에 어휘(<>) 표시를 자동으로 했어요. 이름 등 잘못된 건 지우고, 오른쪽 목록에서 뜻을 채우세요.", 'ok');
    render();
  },
  clearBrackets() {
    syncEditor();
    ed.day.passageText = stripBrackets(ed.day.passageText || '');
    refreshWords();
    toast('지문의 어휘(<>) 표시를 모두 지웠어요.', 'ok');
    render();
  },
  // 팝오버 어휘: 엑셀(CSV) 내려받기 / 올리기
  exportVocab() {
    const csv = vocabToCSV(ed.day.words || []);
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const base = ((ed.day.book && ed.day.book.chapter) || ed.day.label || 'vocab').replace(/[\\/:*?"<>|]+/g, '_').trim() || 'vocab';
    a.href = url; a.download = base + '-어휘.csv';
    document.body.appendChild(a); a.click();
    setTimeout(() => { URL.revokeObjectURL(url); a.remove(); }, 200);
  },
  importVocabClick() { const i = document.getElementById('vocab-import'); if (i) { i.value = ''; i.click(); } },
  importHwpxClick() { const i = document.getElementById('hwpx-import'); if (i) { i.value = ''; i.click(); } },
  selectDay(i) { commit(); openDay(Number(i)); toast(''); render(); },
  addDay() {
    commit();
    // 완전히 빈 새 챕터(지문·문제·단어 없음)
    const nd = { date: _todayKey(), label: '', quote: {}, book: { title: '', author: '', chapter: '', cover: '', spine: '' }, passage: '', vocab: {}, coreSentences: [], quiz: {} };
    content.days.push(nd);
    content.days.sort((a, b) => (a.date || '').localeCompare(b.date || ''));
    openDay(content.days.indexOf(nd));
    ui.tab = 'passage';
    toast('빈 새 챕터를 추가했어요. 지문·문제를 새로 채워주세요.', 'ok');
    render();
  },
  delDay() {
    if (content.days.length <= 1) { toast('최소 1개의 챕터는 남겨야 해요.', 'err'); return; }
    if (!confirm('이 챕터를 삭제할까요?')) return;
    content.days.splice(ed.dayIndex, 1);
    openDay(Math.max(0, ed.dayIndex - 1));
    toast('챕터를 삭제했어요.', 'ok'); render();
  },
  // 일정 탭: 이 챕터를 편집(지문 탭으로 이동)
  editChapter(arg) { commit(); openDay(Number(arg)); ui.tab = 'passage'; toast(''); render(); },
  // 일정 탭: 특정 인덱스의 챕터 삭제(선택 유지)
  delChapterAt(arg) {
    const i = Number(arg);
    if (content.days.length <= 1) { toast('최소 1개의 챕터는 남겨야 해요.', 'err'); return; }
    if (!confirm('이 챕터를 삭제할까요?')) return;
    const wasCur = i === ed.dayIndex;
    content.days.splice(i, 1);
    if (wasCur) openDay(Math.min(Math.max(0, i - 1), content.days.length - 1));
    else if (i < ed.dayIndex) ed.dayIndex -= 1;
    toast('챕터를 삭제했어요.', 'ok'); render();
  },
  // 일정 탭: 이 책에 빈 챕터 추가(책 정보만 복제, 내용은 비움)
  addChapterToBook(bookTitle) {
    commit();
    const src = content.days.find(x => ((x.book && x.book.title) || '') === (bookTitle || '')) || {};
    const book = Object.assign({ title: '', author: '', chapter: '', cover: '', spine: '' }, src.book || {});
    book.chapter = '';
    const nd = { date: _todayKey(), label: '', quote: {}, book, passage: '', vocab: {}, coreSentences: [], quiz: {} };
    if (src.class) nd.class = src.class;
    content.days.push(nd);
    content.days.sort((a, b) => (a.date || '').localeCompare(b.date || ''));
    openDay(content.days.indexOf(nd));
    toast('새 챕터를 추가했어요. 공개 날짜와 이름을 정해주세요.', 'ok');
    render();
  },
  // 지문에서 [단어]를 스캔해 어휘 목록 갱신 (뜻은 유지)
  syncWords() {
    refreshWords();
    toast(ed.day.words.length ? `어휘 ${ed.day.words.length}개를 불러왔어요. 표제어(원형)·뜻을 확인해 주세요.` : '지문에 어휘(<>) 표시가 없어요.', 'ok');
    render();
  },
  // 팝오버 어휘 삭제: 목록에서 빼고 지문의 <단어>를 단어만 남기고 벗김
  delWord(arg) {
    const w = arg;
    syncEditor();   // 편집기 최신 내용 먼저 반영
    const re = new RegExp('<' + w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '>', 'g');
    ed.day.passageText = (ed.day.passageText || '').replace(re, w);
    ed.day.words = (ed.day.words || []).filter(x => x.word !== w);
    toast('"' + w + '" 어휘를 지웠어요 (지문에는 단어만 남겨요).', 'ok');
    render();
  },
  // 지문 편집기에서 이 단어(<word>) 위치로 스크롤하고 잠깐 반짝(비파괴적: 끝나면 원래대로)
  locateInEditor(word) {
    const el = activeEditorEl();
    if (!el) return;
    const target = '<' + word + '>';
    const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT, null);
    let node, found = null, at = -1;
    while ((node = walker.nextNode())) { const i = node.nodeValue.indexOf(target); if (i >= 0) { found = node; at = i; break; } }
    if (!found) { toast('지문에서 "' + word + '"를 찾지 못했어요.', 'err'); render(); return; }
    const range = document.createRange();
    range.setStart(found, at);
    range.setEnd(found, at + target.length);
    let span;
    try { span = document.createElement('span'); span.className = 'ed-locate-flash'; range.surroundContents(span); }
    catch (e) { const sel = window.getSelection(); sel.removeAllRanges(); sel.addRange(range); return; }
    // 인라인 배경을 안 쓰고 CSS 애니메이션으로 반짝(직렬화가 형광펜으로 오해하지 않게)
    span.scrollIntoView({ block: 'center', behavior: 'smooth' });
    setTimeout(() => {   // 끝나면 원래 DOM으로 복구
      if (!span.parentNode) return;
      const parent = span.parentNode;
      while (span.firstChild) parent.insertBefore(span.firstChild, span);
      parent.removeChild(span);
      parent.normalize();
    }, 2000);
  },
  addQ(cat) { ed.day.quiz[cat].push({ type: 'mc', prompt: '', sentence: '', options: ['', '', '', ''], answer: 0, accept: '', wrong: -1, chunksText: '', explain: '' }); render(); },
  delQ(arg) { const [cat, i] = arg.split(':'); ed.day.quiz[cat].splice(Number(i), 1); render(); },
  qFixWrong(arg) {   // 오류 고치기: 틀린 단어 클릭 표시
    const [cat, i, wi] = arg.split(':');
    const q = ed.day.quiz[cat][Number(i)]; if (!q) return;
    q.wrong = Number(q.wrong) === Number(wi) ? -1 : Number(wi);
    render();
  },
  /* 어법 커리큘럼(개념 순서대로 · 모든 챕터 공통) */
  addConcept() { gramEd.push({ title: '', explain: '', quiz: [] }); render(); },
  delConcept(arg) { gramEd.splice(Number(arg), 1); render(); },
  moveConcept(arg) {   // arg = "ci:dir"(dir -1 위 / +1 아래)
    const [ci, dir] = arg.split(':').map(Number);
    const j = ci + dir;
    if (j < 0 || j >= gramEd.length) return;
    const t = gramEd[ci]; gramEd[ci] = gramEd[j]; gramEd[j] = t;
    render();
  },
  addGramQ(ci) { gramEd[Number(ci)].quiz.push({ type: 'mc', prompt: '', sentence: '', options: ['', '', '', ''], answer: 0, accept: '', wrong: -1, chunksText: '', explain: '' }); render(); },
  delGramQ(arg) { const [ci, i] = arg.split(':').map(Number); gramEd[ci].quiz.splice(i, 1); render(); },
  gramFixWrong(arg) {
    const [ci, i, wi] = arg.split(':').map(Number);
    const q = gramEd[ci] && gramEd[ci].quiz[i]; if (!q) return;
    q.wrong = Number(q.wrong) === wi ? -1 : wi;
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
  coreResetOne(arg) { const c = (ed.day.core || [])[Number(arg)]; if (!c) return; c.subject = []; c.verb = []; c.bold = []; c.italic = []; render(); },   // 이 문장 표시(주/동/볼드/이탤릭) 초기화
  coreResetAll() { if (!confirm('모든 핵심문장의 주어·동사·볼드·이탤릭 표시를 지울까요? (문장·해석은 유지)')) return; (ed.day.core || []).forEach(c => { c.subject = []; c.verb = []; c.bold = []; c.italic = []; }); render(); },
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
let _lastAdminSig = null;   // 직전 렌더의 탭·챕터 서명(같으면 스크롤 위치 유지)
function render() {
  const root = document.getElementById('admin');
  if (!ui.loaded) { root.innerHTML = topbar(false) + `<div class="wrap"><div class="card">불러오는 중...</div></div>`; return; }
  const d = ed.day;
  const tabBtn = (id, label) => `<div class="daychip ${ui.tab === id ? 'on' : ''}" data-act="tab" data-arg="${id}">${label}</div>`;

  let panel = '';
  if (ui.tab === 'book') panel = bookTab(d);
  else if (ui.tab === 'passage') panel = passageTab(d);
  else if (ui.tab === 'preview') panel = previewTab(d);
  else if (ui.tab === 'quiz') panel = quizTab(d);
  else if (ui.tab === 'grammar') panel = grammarTab(d);
  else if (ui.tab === 'schedule') panel = scheduleTab();
  else panel = settingsTab();

  const _html = topbar(true) + `
  <div class="wrap">
    <div class="daybar">
      ${content.days.map((day, i) => {
        const md = (day.date || '').slice(5).replace('-', '/');
        const ct = day.class ? ` 〔${esc(day.class)}〕` : '';
        return `<div class="daychip ${i === ed.dayIndex ? 'on' : ''}" data-act="selectDay" data-arg="${i}">${esc(md)}${day.label ? ' · ' + esc(day.label) : ''}${ct}</div>`;
      }).join('')}
      <button class="btn ghost sm" data-act="addDay">＋ 새 챕터</button>
    </div>

    <div class="daybar" style="margin-bottom:16px">
      ${tabBtn('schedule', '📅 챕터 일정')}
      ${tabBtn('book', '📖 책 정보')}
      ${tabBtn('passage', '✍️ 지문 편집')}
      ${tabBtn('preview', '👀 예습 (살살·보통·버닝)')}
      ${tabBtn('quiz', '📝 복습 문제')}
      ${tabBtn('grammar', '📐 어법 퀴즈')}
      ${tabBtn('settings', '⚙️ 학생 · 설정')}
    </div>

    ${panel}
  </div>

  <div class="savebar">
    <div class="msg ${ui.msgType === 'ok' ? 'toast-ok' : ui.msgType === 'err' ? 'toast-err' : ''}">${ui.msg ? esc(ui.msg) : '변경 후 <b>배포</b>를 누르면 모든 기기에 반영됩니다.'}</div>
    <button class="btn danger" data-act="delDay">이 챕터 삭제</button>
    <button class="btn primary" data-act="publish" ${ui.busy ? 'disabled' : ''}>${ui.busy ? '배포 중...' : '🚀 배포하기'}</button>
  </div>
  ${ui.expand ? passageEditorOverlay(d) : ''}`;

  // 같은 탭·챕터를 다시 그릴 땐 스크롤 위치 유지(단어 삭제 등으로 화면이 맨 위로 튀지 않게)
  const _sig = ui.tab + '|' + (ed ? ed.dayIndex : '');
  const _keep = (_sig === _lastAdminSig);
  const _sc = document.scrollingElement || document.documentElement;
  const _winTop = _sc ? _sc.scrollTop : 0;
  const _vl = document.getElementById('vocab-list');
  const _vlTop = _vl ? _vl.scrollTop : 0;
  const _pe = document.getElementById('passage-editor');   // 지문 편집기 내부 스크롤도 보존(단어 삭제 시 맨 위로 튐 방지)
  const _peTop = _pe ? _pe.scrollTop : 0;
  root.innerHTML = _html;
  if (_keep) {
    if (_sc) _sc.scrollTop = _winTop;
    const _nvl = document.getElementById('vocab-list');
    if (_nvl) _nvl.scrollTop = _vlTop;
    const _npe = document.getElementById('passage-editor');
    if (_npe) _npe.scrollTop = _peTop;
  }
  _lastAdminSig = _sig;
  if (ui.expand) { const t = document.getElementById('pv-editor'); if (t && document.activeElement !== t) t.focus(); }
}

/* ---- WYSIWYG 지문 편집(contenteditable) ↔ 저장용 마크업(**굵게** / ==형광펜==) ---- */
// 저장 마크업 → 편집기에 보일 HTML(줄바꿈=div, **→<b>, ==→노랑<mark>, %%→파랑<mark>, <단어>는 글자 그대로)
function markupToEditorHTML(text) {
  text = String(text == null ? '' : text);
  if (!text) return '';
  return text.split('\n').map(line => {
    if (line === '') return '<div><br></div>';
    const h = esc(line)
      .replace(/==([^=]+)==/g, '<mark style="background:#ffe35c;color:#1a1a1a">$1</mark>')
      .replace(/%%([^%]+)%%/g, '<mark style="background:#bcd7fb;color:#12324f">$1</mark>')
      .replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>');
    return '<div>' + h + '</div>';
  }).join('');
}
function _edBold(el) {
  const t = el.tagName; if (t === 'B' || t === 'STRONG') return true;
  const fw = (el.style && el.style.fontWeight) || ''; return /^(bold|[6-9]00)$/.test(fw);
}
// 형광펜 종류: 'y'(노랑=핵심문장) / 'b'(파랑=문법) / null
function _edMarkKind(el) {
  const bg = (el.style && el.style.backgroundColor) || '';
  const has = !!bg && bg !== 'transparent' && !/rgba?\(0,\s*0,\s*0,\s*0\)/.test(bg);
  if (!has) return el.tagName === 'MARK' ? 'y' : null;   // 색 없는 <mark>는 노랑 취급
  const m = bg.match(/(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/);
  if (m) { const r = +m[1], g = +m[2], b = +m[3]; if (b > r + 20 && b >= 150) return 'b'; }
  return 'y';
}
// 선택 영역에 형광펜이 걸려 있는지(끄기 판별용)
function _edMark(el) { return !!_edMarkKind(el); }
// 편집기 DOM → 저장용 마크업 문자열 (==노랑== / %%파랑%% / **굵게**)
function serializeEditor(root) {
  const chars = [];
  (function walk(node, b, my, mb) {
    node.childNodes.forEach(ch => {
      if (ch.nodeType === 3) { for (const c of ch.nodeValue) chars.push({ c, b, my, mb }); return; }
      if (ch.nodeType !== 1) return;
      const tag = ch.tagName;
      if (tag === 'BR') { chars.push({ br: true }); return; }
      const nb = b || _edBold(ch);
      const kind = _edMarkKind(ch);
      const nmy = my || kind === 'y';
      const nmb = mb || kind === 'b';
      if (/^(DIV|P|LI|H[1-6]|SECTION)$/.test(tag) && chars.length && !chars[chars.length - 1].br) chars.push({ br: true });
      walk(ch, nb, nmy, nmb);
    });
  })(root, false, false, false);
  let out = '';
  const cur = { my: false, mb: false, b: false };
  function apply(t) {
    // 하나라도 닫혀야 하면 모두 닫고(중첩 겹침 방지) 필요한 것만 다시 연다
    if ((cur.b && !t.b) || (cur.mb && !t.mb) || (cur.my && !t.my)) {
      if (cur.b) out += '**';
      if (cur.mb) out += '%%';
      if (cur.my) out += '==';
      cur.my = cur.mb = cur.b = false;
    }
    if (!cur.my && t.my) { out += '=='; cur.my = true; }
    if (!cur.mb && t.mb) { out += '%%'; cur.mb = true; }
    if (!cur.b && t.b) { out += '**'; cur.b = true; }
  }
  for (const s of chars) {
    if (s.br) { apply({ my: false, mb: false, b: false }); out += '\n'; continue; }
    apply({ my: !!s.my, mb: !!s.mb, b: !!s.b });
    out += s.c;
  }
  apply({ my: false, mb: false, b: false });
  return out.replace(/\*\*(\s*)\*\*/g, '$1').replace(/==(\s*)==/g, '$1').replace(/%%(\s*)%%/g, '$1').replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n');
}
// 화면에 있는 지문 편집기 요소(메인/오버레이)
function activeEditorEl() { return document.getElementById(ui.expand ? 'pv-editor' : 'passage-editor'); }
// 편집기 내용을 편집 모델에 반영(리렌더 없이)
function syncEditor() { const el = activeEditorEl(); if (el && ed) ed.day.passageText = serializeEditor(el); }
// 선택 영역에 형광펜 적용/해제 — kind 'y'(노랑=핵심문장) / 'b'(파랑=문법). 같은 색이면 끔.
function applyHighlight(kind) {
  const el = activeEditorEl(); if (!el) return; el.focus();
  const sel = window.getSelection();
  let cur = null, n = sel && sel.anchorNode;
  while (n && n !== el) { if (n.nodeType === 1) { const k = _edMarkKind(n); if (k) { cur = k; break; } } n = n.parentNode; }
  document.execCommand('styleWithCSS', false, true);
  const color = kind === 'b' ? '#bcd7fb' : '#ffe35c';
  document.execCommand('hiliteColor', false, cur === kind ? 'transparent' : color);
  syncEditor();
}
// 지문의 <단어>를 스캔해 팝오버 어휘 목록 갱신(기존 뜻 유지 · 새 단어는 표제어 자동 원형화)
function refreshWords() {
  if (!ed) return;
  const found = scanVocab(ed.day.passageText || '');
  ed.day.words = found.map(w => {
    const exist = (ed.day.words || []).find(x => x.word === w);
    if (exist) return exist;
    const row = { word: w, head: '', pos: '', def: '', ex: '' };
    const lm = lemmatize(w);            // 단일 단어면 원형 추정해 표제어로(구/변화없음이면 '')
    if (lm && lm.toLowerCase() !== w.toLowerCase()) row.head = lm;
    return row;
  });
}
// CSV 한 칸 이스케이프
function csvCell(v) { v = String(v == null ? '' : v); return /[",\n\r]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; }
// 팝오버 어휘 → CSV(단어=수정형 head가 있으면 그것, 없으면 지문 원형). 한 단어만 깔끔하게.
function vocabToCSV(words) {
  const rows = [['단어', '품사', '뜻', '예문']].concat((words || []).map(w => [w.head || w.word, w.pos || '', w.def || '', w.ex || '']));
  return rows.map(r => r.map(csvCell).join(',')).join('\r\n');
}
// 아주 단순한 CSV 파서(따옴표·쉼표·줄바꿈 처리)
function parseCSV(text) {
  text = String(text || '').replace(/^﻿/, '');
  const rows = []; let row = [], field = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) {
      if (c === '"') { if (text[i + 1] === '"') { field += '"'; i++; } else q = false; }
      else field += c;
    } else if (c === '"') q = true;
    else if (c === ',') { row.push(field); field = ''; }
    else if (c === '\r') { /* skip */ }
    else if (c === '\n') { row.push(field); rows.push(row); row = []; field = ''; }
    else field += c;
  }
  if (field.length || row.length) { row.push(field); rows.push(row); }
  return rows.filter(r => r.some(x => (x || '').trim() !== ''));
}
// 업로드한 CSV로 팝오버 어휘 뜻 채우기(word 기준 매칭)
function importVocabFile(file) {
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const rows = parseCSV(String(reader.result || ''));
      if (!rows.length) { toast('빈 파일이에요.', 'err'); render(); return; }
      const hdr = rows[0].map(h => (h || '').trim().toLowerCase());
      const idx = (...names) => { for (const n of names) { const i = hdr.indexOf(n); if (i >= 0) return i; } return -1; };
      const cWord = idx('단어', 'word', '표제어'), cHead = idx('head'), cPos = idx('품사', 'pos'), cDef = idx('뜻', 'def'), cEx = idx('예문', 'ex');
      const hasHeader = cWord >= 0 || cPos >= 0 || cDef >= 0;
      // 열 인덱스(헤더 없으면 위치로: 단어, 품사, 뜻, 예문)
      const kWord = hasHeader ? cWord : 0, kHead = hasHeader ? cHead : -1, kPos = hasHeader ? cPos : 1, kDef = hasHeader ? cDef : 2, kEx = hasHeader ? cEx : 3;
      const cell = (r, c) => (c >= 0 && r[c] != null ? String(r[c]).trim() : '');
      // 데이터 행 → 레코드(memorize = 외울 형태, keys = 매칭 후보: 단어열·구버전 head열)
      const recs = [];
      for (let i = hasHeader ? 1 : 0; i < rows.length; i++) {
        const r = rows[i]; const word = cell(r, kWord); const oldHead = cell(r, kHead);
        if (!word && !oldHead) continue;
        recs.push({ memorize: oldHead || word, keys: [word, oldHead].filter(Boolean).map(s => s.toLowerCase()), pos: cell(r, kPos), def: cell(r, kDef), ex: cell(r, kEx) });
      }
      const list = ed.day.words || [];
      const apply = (w, rec) => {
        w.pos = rec.pos; w.def = rec.def; w.ex = rec.ex;
        // 외울 형태가 지문 원형과 다르면 head로, 같으면 head 비움
        w.head = (rec.memorize && rec.memorize.toLowerCase() !== (w.word || '').toLowerCase()) ? rec.memorize : '';
      };
      let filled = 0;
      if (recs.length === list.length && list.length) {
        // 행 수가 같으면 '순서대로' 매칭 — 엑셀에서 단어를 바꿔도 안전(지문 원형은 그대로 유지)
        list.forEach((w, i) => { apply(w, recs[i]); filled++; });
      } else {
        // 행 수가 다르면 단어(원형/head)로 매칭
        const map = {};
        recs.forEach(rec => rec.keys.forEach(k => { if (!(k in map)) map[k] = rec; }));
        list.forEach(w => {
          const rec = map[(w.word || '').toLowerCase()] || (w.head && map[w.head.toLowerCase()]);
          if (rec) { apply(w, rec); filled++; }
        });
      }
      toast(`엑셀에서 ${filled}개 단어를 불러왔어요.`, filled ? 'ok' : 'err');
      render();
    } catch (e) { toast('파일을 읽지 못했어요: ' + e.message, 'err'); render(); }
  };
  reader.readAsText(file, 'utf-8');
}

/* ===== 한글(HWPX) 불러오기: 빨강=어휘(<>) · 노랑 형광펜=핵심문장(==) · 파랑=문법(%%) 자동 인식 =====
   HWPX = ZIP(Deflate) + XML. 브라우저 표준 API(DecompressionStream)만 사용. */
function _u16(dv, o) { return dv.getUint16(o, true); }
function _u32(dv, o) { return dv.getUint32(o, true); }
function zipExtractRaw(buffer, wanted) {
  const bytes = new Uint8Array(buffer); const dv = new DataView(buffer);
  let eocd = -1; const min = Math.max(0, bytes.length - 22 - 65536);
  for (let i = bytes.length - 22; i >= min; i--) { if (_u32(dv, i) === 0x06054b50) { eocd = i; break; } }
  if (eocd < 0) throw new Error('ZIP 구조를 찾지 못했어요');
  const cdCount = _u16(dv, eocd + 10); let p = _u32(dv, eocd + 16); const out = {};
  for (let n = 0; n < cdCount; n++) {
    if (_u32(dv, p) !== 0x02014b50) break;
    const method = _u16(dv, p + 10), compSize = _u32(dv, p + 20), nameLen = _u16(dv, p + 28), extraLen = _u16(dv, p + 30), commentLen = _u16(dv, p + 32), lho = _u32(dv, p + 42);
    const name = new TextDecoder().decode(bytes.subarray(p + 46, p + 46 + nameLen));
    if (wanted.indexOf(name) >= 0) {
      const lNameLen = _u16(dv, lho + 26), lExtraLen = _u16(dv, lho + 28), dataStart = lho + 30 + lNameLen + lExtraLen;
      out[name] = { method, data: bytes.subarray(dataStart, dataStart + compSize) };
    }
    p += 46 + nameLen + extraLen + commentLen;
  }
  return out;
}
async function inflateEntry(entry) {
  if (entry.method === 0) return entry.data;
  if (typeof DecompressionStream === 'undefined') throw new Error('이 브라우저는 압축 해제를 지원하지 않아요(크롬 최신 사용 권장)');
  const ds = new DecompressionStream('deflate-raw');
  const ab = await new Response(new Blob([entry.data]).stream().pipeThrough(ds)).arrayBuffer();
  return new Uint8Array(ab);
}
function _dec(s) { return s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#(\d+);/g, (_, n) => String.fromCharCode(+n)).replace(/&amp;/g, '&'); }
function parseHwpxXml(headerXml, sectionXml) {
  sectionXml = String(sectionXml).replace(/<\?[\s\S]*?\?>/g, '').replace(/<!--[\s\S]*?-->/g, '');
  const colorOf = {};
  const cr = /<hh:charPr id="(\d+)"[^>]*?textColor="([^"]+)"/g; let cm;
  while ((cm = cr.exec(headerXml))) colorOf[cm[1]] = cm[2].toUpperCase();
  const lines = [], core = []; let line = '', curCore = '', inHeader = 0, markpen = false; const colorStack = [];
  const wrap = (txt, open, close) => { const lead = (txt.match(/^\s*/) || [''])[0], trail = (txt.match(/\s*$/) || [''])[0], c = txt.trim(); return c ? lead + open + c + close + trail : txt; };
  const flush = () => {
    if (markpen) { line += '=='; if (curCore.trim()) core.push(curCore.replace(/\s+/g, ' ').trim()); markpen = false; curCore = ''; }
    const t = line.replace(/[ \t]+/g, ' ').trim();
    if (t && t !== 'Memo' && !/^Chapter\s*0?\d+\.?$/i.test(t) && !/^그림입니다/.test(t) && !/^원본 그림/.test(t)) lines.push(t);
    line = '';
  };
  const re = /<(\/?)([\w:]+)([^>]*?)(\/?)>|([^<]+)/g; let m;
  while ((m = re.exec(sectionXml))) {
    if (m[5] != null) {
      if (inHeader) continue; const txt = _dec(m[5]); if (!txt) continue;
      const color = colorStack.length ? colorStack[colorStack.length - 1] : null;
      if (markpen) curCore += txt;
      if (color === '#FF0000') { const pc = line.slice(-1); if (/[A-Za-z]/.test(pc) && /^[A-Za-z]/.test(txt)) line += txt; else line += wrap(txt, '<', '>'); }
      else if (color === '#0000FF') line += wrap(txt, '%%', '%%');
      else line += txt;
      continue;
    }
    const close = m[1] === '/', name = m[2], attrs = m[3] || '', self = m[4] === '/';
    if (name === 'hp:markpenBegin') { if (!inHeader && !markpen) { markpen = true; line += '=='; curCore = ''; } continue; }
    if (name === 'hp:markpenEnd') { if (!inHeader && markpen) { markpen = false; line += '=='; if (curCore.trim()) core.push(curCore.replace(/\s+/g, ' ').trim()); } continue; }
    if ((name === 'hp:header' || name === 'hp:pic') && !self) { inHeader += close ? -1 : 1; continue; }
    if (name === 'hp:run') { if (close) colorStack.pop(); else if (!self) { const c = (attrs.match(/charPrIDRef="(\d+)"/) || [])[1]; colorStack.push(colorOf[c] || null); } continue; }
    if (name === 'hp:p' && (close || self)) flush();
  }
  flush();
  return { passage: lines.join('\n\n'), core };
}
async function hwpxToPassage(buffer) {
  const ent = zipExtractRaw(buffer, ['Contents/header.xml', 'Contents/section0.xml']);
  if (!ent['Contents/section0.xml']) throw new Error('HWPX 형식이 아니에요 (section0.xml 없음)');
  const dec = new TextDecoder('utf-8');
  const header = ent['Contents/header.xml'] ? dec.decode(await inflateEntry(ent['Contents/header.xml'])) : '';
  const section = dec.decode(await inflateEntry(ent['Contents/section0.xml']));
  return parseHwpxXml(header, section);
}
// 업로드한 HWPX를 현재 챕터 지문으로 적용
async function applyHwpx(file) {
  try {
    toast('한글 파일 분석 중...'); render();
    const buf = await file.arrayBuffer();
    const { passage, core } = await hwpxToPassage(buf);
    if (!passage.trim()) { toast('본문 텍스트를 찾지 못했어요.', 'err'); render(); return; }
    const vcount = (passage.match(/<[^>]+>/g) || []).length;
    if (!confirm(`한글 파일에서 인식했어요:\n· 어휘(빨강) ${vcount}개\n· 핵심문장(노랑) ${core.length}개\n· 문법(파랑) 표시\n\n현재 지문을 이 내용으로 바꿀까요?`)) { toast(''); render(); return; }
    ed.day.passageText = passage;
    refreshWords();
    ed.day.core = ed.day.core || [];
    const norm = s => (s || '').replace(/\s+/g, ' ').trim().toLowerCase();
    let added = 0;
    core.forEach(t => { if (t && !ed.day.core.some(c => norm(c.text) === norm(t))) { ed.day.core.push({ text: t, subject: [], verb: [], bold: [], italic: [], ko: '' }); added++; } });
    toast(`불러왔어요 · 어휘 ${ed.day.words.length}개 · 핵심문장 ${added}개 추가 · 문법 표시 완료. 뜻을 채우고 배포하세요.`, 'ok');
    render();
  } catch (e) { toast('한글 파일을 읽지 못했어요: ' + e.message, 'err'); render(); }
}

// 지문 전체화면 편집 오버레이(장편 검토용)
function passageEditorOverlay(d) {
  const paras = (typeof passageToReview === 'function') ? passageToReview(d.passageText).length : 0;
  const chars = (d.passageText || '').length;
  return `<div style="position:fixed;inset:0;z-index:1000;background:#f7f9fc;display:flex;flex-direction:column">
    <div style="display:flex;align-items:center;gap:12px;padding:12px 18px;background:#fff;border-bottom:1px solid #e2e9f2;flex:none">
      <div style="font-size:15px;font-weight:800;color:#14243f;white-space:nowrap">📖 지문 크게 편집${d.label ? ' · ' + esc(d.label) : ''}</div>
      <div style="font-size:12px;color:#7d8aa0">문단=빈 줄 · 페이지=<span class="mono">---</span> · 어휘=<span class="mono">&lt;단어&gt;</span></div>
      <button class="btn ghost sm" data-fmt="1" data-act="fmtBold" title="선택 부분 굵게 (Ctrl+B)"><b>B</b></button>
      <button class="btn ghost sm" data-fmt="1" data-act="fmtVocab" title="선택 단어 어휘(&lt;&gt;)">📌 어휘</button>
      <button class="btn ghost sm" data-fmt="1" data-act="fmtGrammar" title="문법(파란 형광펜)">📐 문법</button>
      <button class="btn ghost sm" data-fmt="1" data-act="fmtCore" title="핵심문장(노란 형광펜)+예습 보통">⭐ 핵심문장</button>
      <button class="btn ghost sm" data-fmt="1" data-act="fmtClear" title="서식 지우기">🧽</button>
      <button class="btn ghost sm" data-act="autoBracket" title="어려운 단어 자동 &lt;&gt;">🔎 자동</button>
      <div style="flex:1"></div>
      <span style="font-size:12px;color:#7d8aa0;white-space:nowrap">${paras}문단 · ${chars.toLocaleString()}자</span>
      <button class="btn ghost sm" data-act="expandFontDown" title="글자 작게">가－</button>
      <span style="font-size:12px;color:#9aa8bd;width:34px;text-align:center">${ui.expandFont}px</span>
      <button class="btn ghost sm" data-act="expandFontUp" title="글자 크게">가＋</button>
      <button class="btn primary sm" data-act="collapsePassage">✓ 완료</button>
    </div>
    <div style="flex:1;overflow:auto;display:flex;justify-content:center;padding:18px">
      <div id="pv-editor" contenteditable="true" spellcheck="false" class="pw-editor" data-ph="여기에 그날 읽을 지문을 붙여넣으세요. 아주 길어도 괜찮아요." style="width:100%;max-width:920px;min-height:100%;background:#fff;border:1px solid #e2e9f2;font-size:${ui.expandFont}px;line-height:1.85;padding:24px 28px;border-radius:12px;white-space:pre-wrap;outline:none">${markupToEditorHTML(d.passageText)}</div>
    </div>
  </div>`;
}

function topbar(loaded) {
  const hasToken = loaded && !!localStorage.getItem(TOKEN_KEY);
  return `<div class="topbar">
    <div class="brand">Reading Aquarium <small>교사 콘텐츠 관리 · 데스크톱 · <b style="color:#2f74e6">v53 (어휘 엑셀은 수정한 단어만·예습 보통 문장칸 크게)</b></small></div>
    <div class="spacer"></div>
    <input id="gh-token" type="password" class="inp" style="max-width:260px" placeholder="${hasToken ? 'GitHub 토큰 저장됨 (변경 시 입력)' : 'GitHub 토큰 (github_pat_...)'}">
    <button class="btn light sm" data-act="saveToken">토큰 저장</button>
    <button class="btn light sm" data-act="reload">↻ 최신 불러오기</button>
    <a class="btn light sm" style="text-decoration:none" href="index.html">앱 열기 ↗</a>
  </div>`;
}

/* ---- 탭: 책 정보 (기본 정보 · 책 · 표지) ---- */
function bookTab(d) {
  const cover = (d.book.cover || '').trim();
  const spine = (d.book.spine || '').trim();
  return `<div class="cols">
      <div class="card">
        <h2>기본 정보 & 책</h2>
        <div class="label">여는 날짜 <span style="font-weight:400;color:#b8c2d2">(이 날짜부터 학생 홈에 노출 · 같은 날짜에 여러 챕터를 둬도 돼요)</span> / 챕터 이름</div>
        <div class="row">
          <input type="date" class="inp" data-bind="date" value="${esc(d.date)}">
          <input class="inp" data-bind="label" value="${esc(d.label)}" placeholder="챕터 이름 (예: Ch1 · 도입부)">
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
  </div>`;
}

/* ---- 탭: 지문 편집 (지문 편집기 + 팝오버 어휘) ---- */
function passageTab(d) {
  return `<div style="display:flex;gap:16px;align-items:flex-start;flex-wrap:wrap;margin-top:2px">
    <div style="flex:2;min-width:340px">
      <div class="card">
        <div style="display:flex;align-items:center;justify-content:space-between;gap:10px">
          <h2 style="margin:0">지문 (그날 읽을 전체 텍스트)</h2>
          <button class="btn primary sm" data-act="expandPassage" title="전체화면으로 크게 편집">⤢ 크게 편집</button>
        </div>
        <div class="hint" style="margin-top:8px">
          문단=<b>빈 줄</b> · e-북 페이지=<span class="mono">---</span> 한 줄 · 아래에서 <b>드래그 선택</b> 후 버튼을 누르세요.<br>
          <b>📌 어휘</b>=팝오버 단어(<span class="mono">&lt;단어&gt;</span>) · <b>📐 문법</b>=<mark style="background:#bcd7fb">파란 표시</mark> · <b>⭐ 핵심문장</b>=<mark style="background:#ffe35c">노란 표시</mark>+예습'보통' · <span class="mono">[대괄호]</span>는 자유롭게 쓰세요(팝오버 아님).<br>
          <b>📄 한글(HWPX) 불러오기</b>: 한글에서 <span style="color:#e2564d;font-weight:700">빨강=어휘</span> · <mark style="background:#ffe35c">노랑 형광펜=핵심문장</mark> · <span style="color:#2f74e6;font-weight:700">파랑=문법</span>으로 표시해 저장하면 자동 인식돼요.
        </div>
        ${editorToolbar()}
        <div style="display:flex;gap:6px;margin:8px 0;flex-wrap:wrap;align-items:center">
          <button class="btn primary sm" data-act="importHwpxClick" title="한글(HWPX) 파일에서 빨강=어휘·노랑 형광펜=핵심문장·파랑=문법을 자동 인식해 지문에 적용">📄 한글(HWPX) 불러오기</button>
          <input type="file" id="hwpx-import" accept=".hwpx" style="display:none">
          <button class="btn ghost sm" data-act="autoBracket" title="B2 이상으로 보이는 어려운 단어에 자동으로 &lt;&gt; 표시">🔎 어려운 단어 자동표시</button>
          <button class="btn ghost sm" data-act="clearBrackets" title="지문의 모든 &lt;&gt; 어휘표시 지우기">⌫ 어휘표시 지우기</button>
        </div>
        <div id="passage-editor" contenteditable="true" spellcheck="false" class="pw-editor" data-ph="여기에 그날 읽을 지문을 붙여넣으세요. 10쪽 이상 아주 길어도 괜찮아요." style="min-height:560px;max-height:72vh;overflow:auto;resize:vertical;line-height:1.7;font-size:15px;background:#fff;border:1px solid #dbe2ec;border-radius:10px;padding:12px 14px;white-space:pre-wrap;outline:none">${markupToEditorHTML(d.passageText)}</div>
        ${(() => {
          const words = (d.passageText.match(/[A-Za-z][A-Za-z'’]*/g) || []).length;
          const ebookPages = (typeof passageToPagesRaw === 'function') ? passageToPagesRaw(d.passageText).length : 0;
          const estPages = Math.max(1, Math.round(words / 280));
          return `<div style="margin-top:8px;font-size:12px;color:#7d8aa0">약 <b style="color:#2f74e6">${words.toLocaleString()}단어</b> · 원서 기준 <b style="color:#2f74e6">약 ${estPages}쪽</b> 분량${ebookPages > 1 ? ` · e-북 <b>${ebookPages}페이지</b>(<span class="mono">---</span>로 나눔)` : ''}</div>`;
        })()}
      </div>
    </div>

    <div style="flex:1;min-width:300px;max-width:460px">
      ${vocabPanel(d)}
    </div>
  </div>`;
}

// 지문 편집기 서식 툴바(메인·오버레이 공용)
function editorToolbar() {
  return `<div style="display:flex;gap:7px;margin:10px 0 4px;flex-wrap:wrap;align-items:center">
    <button class="btn ghost sm" data-fmt="1" data-act="fmtBold" title="선택 부분 굵게 (Ctrl+B)"><b>B</b> 강조</button>
    <button class="btn ghost sm" data-fmt="1" data-act="fmtVocab" title="선택한 단어를 어휘(팝오버)로 — <>로 감쌈">📌 어휘</button>
    <button class="btn ghost sm" data-fmt="1" data-act="fmtGrammar" title="선택 부분 문법 표시(파란 형광펜)">📐 문법</button>
    <button class="btn ghost sm" data-fmt="1" data-act="fmtCore" title="선택 문장을 핵심문장으로(노란 형광펜) — 예습 '보통'에 추가">⭐ 핵심문장</button>
    <button class="btn ghost sm" data-fmt="1" data-act="fmtClear" title="선택 부분 형광펜·굵게 지우기">🧽 지우기</button>
  </div>`;
}

// 팝오버 어휘 목록 패널(오른쪽) — 엑셀 내려받기/올리기 포함
function vocabPanel(d) {
  const rows = d.words.map((w, i) => `
    <div class="qcard" style="margin-top:8px">
      <div class="row" style="align-items:center">
        <input class="inp" style="flex:1;min-width:80px;font-family:'Lora',serif;font-weight:700" data-bind="words.${i}.head" value="${esc(w.head || w.word)}" placeholder="외울 형태" title="팝오버·카드에 뜰 외울 형태(표제어) — 여기서 스펠링을 바로 고치세요. 비우면 지문 단어 그대로 (예: have sth to oneself)">
        <input class="inp" style="flex:.55" data-bind="words.${i}.pos" value="${esc(w.pos)}" placeholder="품사">
        <button class="btn ghost sm" data-act="locateInEditor" data-arg="${esc(w.word)}" title="지문에서 이 단어 위치로 이동해 반짝여요" style="flex:none;padding:6px 9px">📍</button>
        <button class="btn danger sm" data-act="delWord" data-arg="${esc(w.word)}" title="이 어휘 삭제 (지문에서는 &lt;&gt;만 벗기고 단어는 남겨요)" style="flex:none;padding:6px 9px">✕</button>
      </div>
      <div style="font-size:10.5px;color:#9aa8bd;margin:3px 2px 0">지문: <span style="font-family:'Lora',serif;color:#6b7a90">${esc(w.word)}</span></div>
      <input class="inp" style="margin-top:6px" data-bind="words.${i}.def" value="${esc(w.def)}" placeholder="뜻">
    </div>`).join('') || '<div class="empty">아직 어휘가 없어요. 지문에서 단어를 선택하고 <b>📌 어휘</b>를 누르세요.</div>';
  return `<div class="card" style="position:sticky;top:12px;max-height:calc(100vh - 40px);display:flex;flex-direction:column">
    <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;flex-wrap:wrap">
      <div class="cathead" style="margin:0"><div class="name">팝오버 어휘 <span class="cnt">${d.words.length}개</span></div></div>
      <div style="display:flex;gap:6px;flex-wrap:wrap">
        <button class="btn ghost sm" data-act="syncWords" title="지문의 <단어>를 목록으로 불러오기">🔄</button>
        <button class="btn ghost sm" data-act="exportVocab" title="엑셀(CSV)로 내려받기">⬇ 엑셀</button>
        <button class="btn ghost sm" data-act="importVocabClick" title="엑셀(CSV) 올려서 뜻 채우기">⬆ 올리기</button>
      </div>
    </div>
    <div class="hint" style="margin-top:6px">지문에서 단어 드래그 → <b>📌 어휘</b> → 여기에 떠요. 뜻은 직접 적거나, <b>⬇엑셀</b>로 받아 채운 뒤 <b>⬆올리기</b> 하세요(단어 기준 자동 매칭).</div>
    <input type="file" id="vocab-import" accept=".csv,text/csv" style="display:none">
    <div id="vocab-list" style="overflow:auto;margin-top:4px;flex:1;min-height:120px">${rows}</div>
  </div>`;
}

/* ---- 탭 2: 지문 예습 (살살·보통·버닝) ---- */
function previewTab(d) {
  return `<div class="card" style="background:#f4faf6;border-color:#cfe9da">
    <h2>지문 예습 3단계 안내</h2>
    <div class="hint" style="margin:0">
      학생은 예습할 때 난이도를 골라요. 아래에서 각 단계에 쓸 내용을 준비하세요.<br>
      🟢 <b>살살</b> — <b>지문의 어휘(&lt;단어&gt;) 카드</b>로 자동 구성돼요 (지문 탭에서 단어 뜻만 채우면 끝).<br>
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
  // 좌측 플로팅 세로 버튼(마우스 동선 최소화)
  const modeBtnV = (m, icon, label, color) => `<button data-act="coreMode" data-arg="${m}" title="${label}" style="display:flex;flex-direction:column;align-items:center;gap:1px;width:100%;padding:7px 2px;border-radius:10px;cursor:pointer;background:${ui.coreMode === m ? color : '#eef2f8'};color:${ui.coreMode === m ? '#fff' : '#4a5a72'};border:1px solid ${ui.coreMode === m ? color : '#e2e9f2'};font-family:inherit"><span style="font-size:15px;line-height:1">${icon}</span><span style="font-size:9.5px;font-weight:700">${label}</span></button>`;
  const floatBar = `<div style="position:fixed;left:max(8px,calc(50% - 664px));top:50%;transform:translateY(-50%);z-index:40;display:flex;flex-direction:column;gap:6px;background:#fff;border:1.5px solid #cfe0f5;border-radius:14px;padding:9px 8px;box-shadow:0 12px 34px -10px rgba(20,50,90,.55);width:66px">
    <div style="font-size:9.5px;font-weight:800;color:#9aa8bd;text-align:center;letter-spacing:.02em">표시</div>
    ${modeBtnV('subject', '🔵', '주어', '#2f74e6')}
    ${modeBtnV('verb', '🟢', '동사', '#2fa36b')}
    ${modeBtnV('bold', 'B', '볼드', '#14243f')}
    ${modeBtnV('italic', 'I', '이탤릭', '#8a5fd6')}
    ${modeBtnV('clear', '🧽', '지우개', '#b23a32')}
    <div style="height:1px;background:#eef2f8;margin:1px 0"></div>
    <button data-act="coreResetAll" title="모든 문장 표시 초기화" style="width:100%;padding:6px 2px;border-radius:10px;cursor:pointer;background:#fff;color:#8a97a8;border:1px solid #e2e9f2;font-family:inherit;font-size:9.5px;font-weight:700">↺ 전체</button>
  </div>`;
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
      <div class="row" style="align-items:center;margin-bottom:6px">
        <span style="flex:none;font-size:12px;font-weight:700;color:#7d8aa0">문장 ${si + 1}</span>
        <div style="flex:1"></div>
        <button class="btn ghost sm" data-act="coreResetOne" data-arg="${si}" title="이 문장의 주어·동사·강조 표시 초기화">↺ 표시</button>
        <button class="btn danger sm" data-act="coreDelete" data-arg="${si}">삭제</button>
      </div>
      <textarea class="inp" style="width:100%;min-height:56px;line-height:1.55;font-family:'Lora',serif;font-size:15px;resize:vertical" data-bind="core.${si}.text" data-rerender="1" placeholder="핵심 문장(영어)">${esc(c.text)}</textarea>
      ${toks.length ? `<div style="margin:8px 0;line-height:2.1">${toks.map((w, wi) => chip(si, wi, w, c)).join('')}</div>` : '<div class="hint" style="margin:8px 0">문장을 입력하고 <b>다른 곳 클릭</b>하면 단어를 클릭해 표시할 수 있어요.</div>'}
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
    <div class="hint"><b>왼쪽에 떠 있는 툴바</b>에서 모드를 고르고 <b>단어를 클릭</b>해 표시하세요. 🔵주어 · 🟢동사(예습 '보통' 채점에 사용) · 볼드·이탤릭(강조). 해석은 '문장 작문'에 쓰여요. 비워두면 지문 앞 문장 6개가 자동으로 쓰여요.</div>
    ${floatBar}
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
    <h2>복습 문제</h2>
    <div class="hint">문제를 비워두면 그 문항은 출제되지 않아요. 문항이 하나도 없으면 학생 홈에서 숨겨집니다. (어법 퀴즈는 <b>📐 어법 퀴즈</b> 탭에서 따로 관리해요.)</div>
    ${qcat('sentence')}
  </div>`;
}
/* ---- 탭: 어법 커리큘럼(개념 순서대로 · 모든 챕터 공통) ---- */
function grammarTab(d) {
  const list = gramEd || [];
  const total = list.reduce((a, c) => a + (c.quiz || []).length, 0);
  const concepts = list.map((c, ci) => {
    const base = `${ci}`;
    return `<div class="card" style="border-color:#d9e6c9">
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px">
        <span style="flex:none;width:30px;height:30px;border-radius:9px;background:#e7f0d8;color:#4a7a1e;display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:800">${ci + 1}</span>
        <input class="inp" style="flex:1;font-weight:700" data-bind="${base}.title" data-broot="gram" value="${esc(c.title)}" placeholder="개념 제목 (예: 1. 문장의 주어와 동사)">
        <button class="btn ghost sm" data-act="moveConcept" data-arg="${ci}:-1" ${ci === 0 ? 'disabled' : ''} title="위로">▲</button>
        <button class="btn ghost sm" data-act="moveConcept" data-arg="${ci}:1" ${ci === list.length - 1 ? 'disabled' : ''} title="아래로">▼</button>
        <button class="btn danger sm" data-act="delConcept" data-arg="${ci}">삭제</button>
      </div>
      <div class="label">개념 설명 (학생이 문제 풀기 전에 읽어요)</div>
      <textarea class="inp" style="min-height:80px;line-height:1.6" data-bind="${base}.explain" data-broot="gram" placeholder="이 어법 개념을 학생 눈높이로 설명하세요. 예) 영어 문장은 '누가(주어) + 무엇을 한다(동사)'가 뼈대예요. …">${esc(c.explain)}</textarea>
      <div class="label" style="margin-top:10px">이 개념의 어법 문제</div>
      ${quizEditor({ list: c.quiz, basePath: `${ci}.quiz`, ns: 'g' + ci, broot: 'gram', delAct: 'delGramQ', delPrefix: `${ci}:`, fixAct: 'gramFixWrong', addAct: 'addGramQ', addArg: ci, name: '어법 문제', emptyMsg: '이 개념에 문제를 추가해 보세요. 개념 설명만 있어도 학생에게 보여집니다.' })}
    </div>`;
  }).join('');
  return `<div class="card" style="background:#f2f8ea;border-color:#d9e6c9">
    <h2>📐 어법 퀴즈 · 커리큘럼</h2>
    <div class="hint" style="margin:0">문법을 <b>기본부터 순서대로</b> 쌓는 공간이에요. 개념마다 <b>설명 + 문제</b>를 넣고, 위/아래 화살표로 순서를 정하세요. 이 커리큘럼은 <b>모든 챕터 공통</b>이라 특정 챕터와 상관없이 학생 <b>심화 학습</b>에서 순서대로 풀립니다. (총 개념 ${list.length}개 · 문제 ${total}개)</div>
  </div>
  ${concepts}
  <div style="margin:4px 0 10px"><button class="btn ghost" data-act="addConcept">＋ 새 어법 개념</button></div>`;
}
// 퀴즈 문항 편집 카드들(공용) — cfg로 바인딩 대상/액션을 바꿔 챕터 퀴즈·어법 커리큘럼 양쪽에 사용
// cfg: { list, basePath, ns, broot, delAct, delPrefix, fixAct, addAct, addArg, name, addLabel, emptyMsg }
function quizEditor(cfg) {
  const { list, basePath, ns, broot } = cfg;
  const br = broot ? ` data-broot="${broot}"` : '';
  const cards = list.map((q, i) => {
    const base = `${basePath}.${i}`;
    const opts = q.type === 'mc' ? q.options.map((o, oi) => `
      <div class="opt">
        <input type="radio" name="ans-${ns}-${i}" value="${oi}" data-bind="${base}.answer" data-type="number"${br} ${Number(q.answer) === oi ? 'checked' : ''}>
        <input class="inp" data-bind="${base}.options.${oi}"${br} value="${esc(o)}" placeholder="보기 ${oi + 1}${oi < 2 ? '' : ' (선택)'}">
      </div>`).join('') : '';
    return `<div class="qcard">
      <div class="qhead">
        <span class="qnum">Q${i + 1}</span>
        <span style="font-size:11.5px;font-weight:700;color:#7d8aa0">형식</span>
        <select class="inp" style="width:auto;padding:6px 8px" data-bind="${base}.type"${br} data-rerender="1">
          <option value="mc" ${q.type === 'mc' ? 'selected' : ''}>A~D 고르기(객관식)</option>
          <option value="ox" ${q.type === 'ox' ? 'selected' : ''}>O/X (참·거짓)</option>
          <option value="ab" ${q.type === 'ab' ? 'selected' : ''}>[A/B] 고르기</option>
          <option value="fix" ${q.type === 'fix' ? 'selected' : ''}>오류 고치기</option>
          <option value="scramble" ${q.type === 'scramble' ? 'selected' : ''}>Scramble(순서 맞추기)</option>
          <option value="input" ${q.type === 'input' ? 'selected' : ''}>주관식</option>
        </select>
        <div style="flex:1"></div>
        <button class="btn danger sm" data-act="${cfg.delAct}" data-arg="${cfg.delPrefix}${i}">삭제</button>
      </div>
      <input class="inp" data-bind="${base}.prompt"${br} value="${esc(q.prompt)}" placeholder="문제 ${(q.type === 'ab' || q.type === 'scramble') ? '(비워도 됨)' : ''}">
      ${q.type === 'scramble' ? '' : `<input class="inp" style="margin-top:7px" data-bind="${base}.sentence"${br} data-rerender="1" value="${esc(q.sentence)}" placeholder="${q.type === 'ab' ? '문장에 [정답/오답] 넣기 — 예: She [was/were] happy.' : q.type === 'fix' ? '틀린 부분이 든 문장 — 예: She go to school.' : '예문/제시 문장 (선택)'}">`}
      ${q.type === 'mc'
        ? `<div class="label" style="margin-bottom:2px">보기 (동그라미로 정답 선택, 2개 이상)</div>${opts}`
        : q.type === 'ox'
          ? `<div class="label" style="margin:6px 0 2px">위 문장은 맞나요, 틀리나요? (문제 칸에 참/거짓을 판단할 문장을 쓰세요)</div>
             <div class="opt" style="gap:16px">
               <label style="display:flex;align-items:center;gap:5px;cursor:pointer"><input type="radio" name="ox-${ns}-${i}" value="0" data-bind="${base}.answer" data-type="number"${br} ${Number(q.answer) === 0 ? 'checked' : ''}> O (맞음·참)</label>
               <label style="display:flex;align-items:center;gap:5px;cursor:pointer"><input type="radio" name="ox-${ns}-${i}" value="1" data-bind="${base}.answer" data-type="number"${br} ${Number(q.answer) === 1 ? 'checked' : ''}> X (틀림·거짓)</label>
             </div>`
        : q.type === 'ab'
          ? `<div class="label" style="margin:6px 0 2px">둘 중 어느 쪽이 정답인가요?</div>
             <div class="opt" style="gap:16px">
               <label style="display:flex;align-items:center;gap:5px;cursor:pointer"><input type="radio" name="ab-${ns}-${i}" value="0" data-bind="${base}.answer" data-type="number"${br} ${Number(q.answer) === 0 ? 'checked' : ''}> 앞[A] 정답</label>
               <label style="display:flex;align-items:center;gap:5px;cursor:pointer"><input type="radio" name="ab-${ns}-${i}" value="1" data-bind="${base}.answer" data-type="number"${br} ${Number(q.answer) === 1 ? 'checked' : ''}> 뒤[B] 정답</label>
             </div>`
          : q.type === 'fix'
            ? `<div class="label" style="margin:6px 0 2px">문장에서 <b>틀린 단어를 클릭</b>하세요 ${Number(q.wrong) >= 0 ? '✅' : ''}</div>
               <div style="line-height:2.1">${(q.sentence || '').split(/\s+/).filter(Boolean).map((w, wi) => `<span data-act="${cfg.fixAct}" data-arg="${cfg.delPrefix}${i}:${wi}" style="display:inline-block;margin:2px;padding:3px 8px;border-radius:8px;border:1.5px solid ${Number(q.wrong) === wi ? '#e2564d' : '#e2e9f2'};background:${Number(q.wrong) === wi ? '#fbe4e2' : '#fff'};cursor:pointer;font-family:'Lora',serif;font-size:15px">${esc(w)}</span>`).join('') || '<span class="hint" style="margin:0">위 칸에 문장을 먼저 입력하세요</span>'}</div>
               <input class="inp" style="margin-top:7px" data-bind="${base}.accept"${br} value="${esc(q.accept)}" placeholder="바른 표현 (여러 개면 쉼표: goes, went)">`
            : q.type === 'scramble'
              ? `<div class="label" style="margin:6px 0 2px">조각을 <b>정답 순서대로</b>, <b>/</b> 로 구분 (2~3단어씩)</div>
                 <input class="inp" data-bind="${base}.chunksText"${br} value="${esc(q.chunksText || '')}" placeholder="The sea / has always / drawn people.">`
              : `<input class="inp" style="margin-top:7px" data-bind="${base}.accept"${br} value="${esc(q.accept)}" placeholder="정답 (여러 개면 쉼표: retreat, 후퇴하다)">`}
      <input class="inp" style="margin-top:7px" data-bind="${base}.explain"${br} value="${esc(q.explain)}" placeholder="해설">
    </div>`;
  }).join('');
  return `<div class="catbox">
    <div class="cathead">
      <div class="name">${cfg.name} <span class="cnt">${list.length}문항</span></div>
      <button class="btn ghost sm" data-act="${cfg.addAct}" data-arg="${cfg.addArg}">＋ ${cfg.addLabel || '문항'}</button>
    </div>
    ${cards || `<div class="empty">${cfg.emptyMsg || '문항이 없으면 이 항목은 학생 홈에서 숨겨져요.'}</div>`}
  </div>`;
}
function qcat(cat) {
  return quizEditor({ list: ed.day.quiz[cat], basePath: `quiz.${cat}`, ns: cat, broot: '', delAct: 'delQ', delPrefix: `${cat}:`, fixAct: 'qFixWrong', addAct: 'addQ', addArg: cat, name: QUIZ_META[cat].name });
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

/* ---- 탭: 챕터 일정 (책 → 챕터, 공개 날짜 설정) ---- */
function scheduleTab() {
  const classOpts = (sel) => `<option value="">공통(전체)</option>` +
    (content.classes || []).map(c => `<option value="${esc(c)}" ${((sel || '') === c) ? 'selected' : ''}>${esc(c)}</option>`).join('');
  // 책 제목별로 그룹(입력 순서 유지)
  const order = [];
  const groups = {};
  content.days.forEach((d, i) => {
    const bt = (d.book && d.book.title) || '';
    const gkey = bt || '__none__';
    if (!groups[gkey]) { groups[gkey] = []; order.push(gkey); }
    groups[gkey].push(i);
  });
  const cell = 'padding:9px 10px;background:#fff;border:1px solid #e2e9f2;border-radius:10px;font-size:13px';
  const books = order.map(gkey => {
    const bt = gkey === '__none__' ? '' : gkey;
    const idxs = groups[gkey].slice().sort((a, b) => (content.days[a].date || '').localeCompare(content.days[b].date || ''));
    const rows = idxs.map(i => {
      const d = content.days[i];
      const cur = i === ed.dayIndex;
      const dcell = 'padding:6px 8px;background:#fff;border:1px solid #e2e9f2;border-radius:9px;font-size:12px;color-scheme:light;flex:none';
      const rangeField = (field, ph) => `<input type="date" data-sched="${i}" data-schedfield="${field}" value="${esc(d[field] || '')}" title="${ph}" style="${dcell}">`;
      return `<div style="margin-top:8px;padding:10px;background:#f7f9fc;border-radius:14px;${cur ? 'outline:2px solid #bcd4f7;outline-offset:2px' : ''}">
        <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">
          <input type="date" data-sched="${i}" data-schedfield="date" value="${esc(d.date || '')}" title="지문 날짜(수업일)" style="${cell};flex:none;color-scheme:light">
          <input data-sched="${i}" data-schedfield="chapter" value="${esc((d.book && d.book.chapter) || '')}" placeholder="챕터 이름 (예: Ch1 · 도입부)" style="${cell};flex:1;min-width:150px">
          <select data-sched="${i}" data-schedfield="class" style="${cell};flex:none">${classOpts(d.class)}</select>
          <button class="btn ghost sm" data-act="editChapter" data-arg="${i}">✏️ 편집</button>
          <button class="btn danger sm" data-act="delChapterAt" data-arg="${i}">삭제</button>
        </div>
        <div style="display:flex;gap:14px;align-items:center;flex-wrap:wrap;margin-top:9px">
          <div style="display:flex;align-items:center;gap:6px">
            <span style="font-size:11px;font-weight:800;color:#2f74e6;white-space:nowrap">📖 복습 공개</span>
            ${rangeField('reviewFrom', '복습 시작일')}<span style="color:#9aa8bd;font-size:12px">~</span>${rangeField('reviewTo', '복습 종료일')}
          </div>
          <div style="display:flex;align-items:center;gap:6px">
            <span style="font-size:11px;font-weight:800;color:#c98a12;white-space:nowrap">👀 예습 공개</span>
            ${rangeField('previewFrom', '예습 시작일')}<span style="color:#9aa8bd;font-size:12px">~</span>${rangeField('previewTo', '예습 종료일')}
          </div>
        </div>
      </div>`;
    }).join('');
    return `<div class="card">
      <div style="display:flex;align-items:center;gap:8px">
        <span style="font-size:16px">📕</span>
        <input data-sched="${idxs[0]}" data-schedfield="bookTitle" value="${esc(bt)}" placeholder="책 제목 (예: The Curiosity of the Sea)" style="flex:1;font-size:15px;font-weight:700;color:#14243f;border:none;border-bottom:1.5px solid #e2e9f2;padding:4px 2px;background:transparent"${idxs.length > 1 ? ' title="여기서 제목을 바꾸면 이 책의 모든 챕터에 반영돼요"' : ''}>
        <span style="font-size:11.5px;color:#7d8aa0;white-space:nowrap">${idxs.length}챕터</span>
      </div>
      ${rows}
      <button class="btn ghost sm" data-act="addChapterToBook" data-arg="${esc(bt)}" style="margin-top:10px">＋ 이 책에 챕터 추가</button>
    </div>`;
  }).join('');
  return `<div class="card">
    <h2>📅 챕터 일정</h2>
    <div class="hint">책별로 챕터를 정리하고, 각 챕터의 <b>공개 기간</b>을 정하세요. <b>📖 복습 공개</b> 기간엔 학생 홈 <b>복습하기</b>에, <b>👀 예습 공개</b> 기간엔 <b>예습하기</b>에 나타나요. 기간을 비워두면 <b>지문 날짜부터</b> 계속 열립니다. 자세한 내용(지문·단어·문제)은 <b>✏️ 편집</b>으로 채워요.</div>
  </div>
  ${books || '<div class="card">아직 챕터가 없어요.</div>'}
  <div style="margin:4px 0 10px"><button class="btn ghost" data-act="addDay">＋ 새 챕터(새 책)</button></div>`;
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
  if (el.id === 'passage-editor' || el.id === 'pv-editor') { if (ed) ed.day.passageText = serializeEditor(el); return; }
  if (el.dataset.sched != null) { applySchedField(el); return; }   // 일정 탭: 렌더 없이 모델만 갱신(포커스 유지)
  if (el.dataset.gbind) { gEd[el.dataset.gbind] = el.value; return; }
  const bind = el.dataset.bind;
  if (bind && el.type !== 'radio' && el.tagName !== 'SELECT') setPath(el.dataset.broot === 'gram' ? gramEd : ed.day, bind, el.value);
});
// 서식 버튼 클릭 시 편집기 선택이 풀리지 않도록(포커스 뺏김 방지)
rootEl.addEventListener('mousedown', e => { if (e.target.closest('[data-fmt]')) e.preventDefault(); });
// 붙여넣기는 서식 없이 평문으로(외부 HTML 오염 방지)
rootEl.addEventListener('paste', e => {
  const el = e.target.closest && e.target.closest('[contenteditable]');
  if (!el) return;
  e.preventDefault();
  const text = (e.clipboardData || window.clipboardData).getData('text/plain');
  document.execCommand('insertText', false, text);
});
rootEl.addEventListener('change', e => {
  const el = e.target;
  if (el.id === 'vocab-import') { if (el.files && el.files[0]) importVocabFile(el.files[0]); return; }   // 엑셀(CSV) 업로드
  if (el.id === 'hwpx-import') { if (el.files && el.files[0]) applyHwpx(el.files[0]); return; }   // 한글(HWPX) 업로드
  if (el.dataset.sched != null) { applySchedField(el); resortKeepSel(); render(); return; }   // 일정 탭: 확정 시 재정렬+렌더
  const bind = el.dataset.bind;
  if (!bind) return;
  let v = el.value;
  if (el.dataset.type === 'number') v = Number(v);
  setPath(el.dataset.broot === 'gram' ? gramEd : ed.day, bind, v);
  if (el.dataset.rerender) render();
});

// 지문 크게 편집: Esc로 닫기(내용은 이미 저장돼 있어 안전)
document.addEventListener('keydown', e => { if (e.key === 'Escape' && ui.expand) { ui.expand = false; render(); } });

boot();
