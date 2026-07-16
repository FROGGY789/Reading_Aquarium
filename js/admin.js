/* =========================================================
 * Reading Aquarium — 교사용 데스크톱 콘텐츠 관리 (admin.html)
 * data/content.json 을 불러와 편집하고, GitHub에 배포합니다.
 * 학생 앱(app.js)의 편집 로직과 동일한 데이터 형식을 사용합니다.
 * ========================================================= */

const TOKEN_KEY = 'er_gh_token';
const REPO_OWNER = 'FROGGY789';
const REPO_NAME = 'Reading_Aquarium';
const CONTENT_URL = 'data/content.json';

const esc = s => String(s == null ? '' : s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const clone = o => JSON.parse(JSON.stringify(o));
function todayKey() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// 전체 콘텐츠(편집 중), 현재 Day 편집 모델, UI 상태
let content = null;   // { version, students[], supabase{}, days[] }
let ed = null;        // { dayIndex, day(편집용) }
let gEd = null;       // { studentsText, sbUrl, sbKey }
const ui = { msg: '', msgType: '', busy: false, loaded: false };

/* ---------- 로드 ---------- */
async function boot() {
  try {
    const res = await fetch(CONTENT_URL + '?_=' + Date.now(), { cache: 'no-store' });
    if (res.ok) {
      const j = await res.json();
      if (j && Array.isArray(j.days)) content = j;
    }
  } catch (e) { /* 무시 */ }
  if (!content) content = clone(typeof DEFAULT_CONTENT !== 'undefined' ? DEFAULT_CONTENT : { version: 1, students: [], supabase: { url: '', anonKey: '' }, days: [] });
  content.students = content.students || [];
  content.supabase = content.supabase || { url: '', anonKey: '' };
  if (!content.days.length) content.days = [blankDay()];
  gEd = { studentsText: content.students.join('\n'), sbUrl: content.supabase.url || '', sbKey: content.supabase.anonKey || '' };
  openDay(bestDayIndex());
  ui.loaded = true;
  render();
}

function blankDay() {
  return {
    date: todayKey(), label: '',
    quote: { en: '', ko: '', teacher: '', comment: '' },
    book: { title: '', author: '', chapter: '', pages: [] },
    review: { paragraphs: [], words: {} },
    quiz: {}
  };
}
function bestDayIndex() {
  const days = content.days, today = todayKey();
  let best = 0;
  days.forEach((d, i) => { if ((d.date || '') <= today && (d.date || '') >= (days[best].date || '')) best = i; });
  return best;
}

/* ---------- 형식 변환 (app.js와 동일) ---------- */
function dayToEdit(d) {
  d = clone(d);
  const quiz = {};
  Object.keys(QUIZ_META).forEach(cat => {
    quiz[cat] = ((d.quiz && d.quiz[cat]) || []).map(q => ({
      type: q.type || 'mc',
      prompt: q.prompt || '',
      sentence: q.sentence || '',
      options: (q.options || []).concat(['', '', '', '']).slice(0, 4),
      answer: q.answer || 0,
      accept: (q.accept || []).join(', '),
      explain: q.explain || ''
    }));
  });
  return {
    date: d.date || todayKey(),
    label: d.label || '',
    quote: Object.assign({ en: '', ko: '', teacher: '', comment: '' }, d.quote || {}),
    book: Object.assign({ title: '', author: '', chapter: '' }, d.book || {}),
    pagesText: ((d.book && d.book.pages) || []).map(pg => pg.join('\n\n')).join('\n---\n'),
    reviewText: ((d.review && d.review.paragraphs) || []).join('\n\n'),
    words: Object.entries((d.review && d.review.words) || {}).map(([word, w]) => ({ word, pos: w.pos || '', def: w.def || '', ex: w.ex || '' })),
    quiz
  };
}
function editToDay(e) {
  const pages = (e.pagesText || '')
    .split(/\n\s*-{3,}\s*\n/)
    .map(pg => pg.split(/\n\s*\n/).map(p => p.trim().replace(/\s*\n\s*/g, ' ')).filter(Boolean))
    .filter(pg => pg.length);
  const paragraphs = (e.reviewText || '')
    .split(/\n\s*\n/).map(p => p.trim().replace(/\s*\n\s*/g, ' ')).filter(Boolean);
  const words = {};
  (e.words || []).forEach(w => {
    const key = (w.word || '').trim();
    if (key) words[key] = { pos: (w.pos || '').trim(), def: (w.def || '').trim(), ex: (w.ex || '').trim() };
  });
  const quiz = {};
  Object.keys(QUIZ_META).forEach(cat => {
    quiz[cat] = (e.quiz[cat] || [])
      .filter(q => (q.prompt || '').trim())
      .map(q => {
        const base = { type: q.type, prompt: q.prompt.trim(), explain: (q.explain || '').trim() };
        if ((q.sentence || '').trim()) base.sentence = q.sentence.trim();
        if (q.type === 'mc') {
          base.options = q.options.map(o => (o || '').trim()).filter(Boolean);
          base.answer = Math.min(Math.max(0, Number(q.answer) || 0), Math.max(0, base.options.length - 1));
        } else {
          base.accept = (q.accept || '').split(',').map(a => a.trim()).filter(Boolean);
        }
        return base;
      })
      .filter(q => q.type === 'mc' ? q.options.length >= 2 : q.accept.length >= 1);
  });
  return {
    date: e.date || todayKey(),
    label: (e.label || '').trim(),
    quote: { en: e.quote.en.trim(), ko: e.quote.ko.trim(), teacher: e.quote.teacher.trim(), comment: e.quote.comment.trim() },
    book: { title: e.book.title.trim(), author: e.book.author.trim(), chapter: e.book.chapter.trim(), pages },
    review: { paragraphs, words },
    quiz
  };
}
function openDay(i) { ed = { dayIndex: i, day: dayToEdit(content.days[i]) }; }
function commitDay() {
  if (!ed) return;
  content.days[ed.dayIndex] = editToDay(ed.day);
  content.days.sort((a, b) => (a.date || '').localeCompare(b.date || ''));
  const cur = content.days[ed.dayIndex];
  ed.dayIndex = content.days.indexOf(cur);
  if (ed.dayIndex < 0) ed.dayIndex = 0;
}
function commitGlobal() {
  if (!gEd) return;
  content.students = gEd.studentsText.split('\n').map(s => s.trim()).filter(Boolean);
  content.supabase = { url: gEd.sbUrl.trim(), anonKey: gEd.sbKey.trim() };
}
function setPath(obj, path, val) {
  const ks = path.split('.');
  let o = obj;
  for (let i = 0; i < ks.length - 1; i++) o = o[ks[i]];
  o[ks[ks.length - 1]] = val;
}

/* ---------- 액션 ---------- */
const actions = {
  selectDay(i) { commitDay(); commitGlobal(); openDay(Number(i)); toast(''); render(); },
  addDay() {
    commitDay(); commitGlobal();
    const tpl = clone(content.days[content.days.length - 1] || blankDay());
    tpl.date = todayKey(); tpl.label = 'Day ' + (content.days.length + 1);
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
    toast('Day를 삭제했어요.', 'ok');
    render();
  },
  addQ(cat) { ed.day.quiz[cat].push({ type: 'mc', prompt: '', sentence: '', options: ['', '', '', ''], answer: 0, accept: '', explain: '' }); render(); },
  delQ(arg) { const [cat, i] = arg.split(':'); ed.day.quiz[cat].splice(Number(i), 1); render(); },
  addWord() { ed.day.words.push({ word: '', pos: '', def: '', ex: '' }); render(); },
  delWord(i) { ed.day.words.splice(Number(i), 1); render(); },
  saveToken() {
    const el = document.getElementById('gh-token');
    const v = (el.value || '').trim();
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

function toast(msg, type) { ui.msg = msg; ui.msgType = type || ''; }

/* ---------- GitHub 배포 ---------- */
async function publish() {
  if (ui.busy) return;
  commitDay(); commitGlobal();
  const token = localStorage.getItem(TOKEN_KEY);
  if (!token) { toast('⚠️ 먼저 GitHub 토큰을 입력하고 저장해 주세요.', 'err'); render(); return; }
  ui.busy = true; toast('배포하는 중...'); render();
  const api = `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}`;
  const headers = { 'Authorization': 'Bearer ' + token, 'Accept': 'application/vnd.github+json' };
  try {
    const repo = await (await fetch(api, { headers })).json();
    const branch = repo.default_branch || 'main';
    let sha;
    const cur = await fetch(`${api}/contents/${CONTENT_URL}?ref=${branch}`, { headers });
    if (cur.ok) sha = (await cur.json()).sha;
    const body = {
      message: '콘텐츠 배포(데스크톱): ' + new Date().toLocaleString('ko-KR'),
      content: b64(JSON.stringify(content, null, 2)),
      branch
    };
    if (sha) body.sha = sha;
    const res = await fetch(`${api}/contents/${CONTENT_URL}`, { method: 'PUT', headers, body: JSON.stringify(body) });
    if (!res.ok) { const err = await res.json().catch(() => ({})); throw new Error(err.message || ('HTTP ' + res.status)); }
    toast('✅ 배포 완료! 1~2분 뒤 모든 기기에 반영됩니다.', 'ok');
  } catch (e) {
    toast('❌ 배포 실패: ' + e.message + ' (토큰 권한을 확인해 주세요)', 'err');
  }
  ui.busy = false;
  render();
}
function b64(str) { return btoa(unescape(encodeURIComponent(str))); }

/* ---------- 렌더 ---------- */
function render() {
  const root = document.getElementById('admin');
  if (!ui.loaded) { root.innerHTML = `<div class="topbar"><div class="brand">Reading Aquarium <small>콘텐츠 관리</small></div></div><div class="wrap"><div class="card">불러오는 중...</div></div>`; return; }
  const hasToken = !!localStorage.getItem(TOKEN_KEY);
  const d = ed.day;

  const dayChips = content.days.map((day, i) => {
    const md = (day.date || '').slice(5).replace('-', '/');
    return `<div class="daychip ${i === ed.dayIndex ? 'on' : ''}" data-act="selectDay" data-arg="${i}">${esc(md)}${day.label ? ' · ' + esc(day.label) : ''}</div>`;
  }).join('');

  root.innerHTML = `
  <div class="topbar">
    <div class="brand">Reading Aquarium <small>교사 콘텐츠 관리 · 데스크톱</small></div>
    <div class="spacer"></div>
    <input id="gh-token" type="password" class="inp" style="max-width:280px" placeholder="${hasToken ? 'GitHub 토큰 저장됨 (변경 시 입력)' : 'GitHub 토큰 (github_pat_...)'}">
    <button class="btn light sm" data-act="saveToken">토큰 저장</button>
    <button class="btn light sm" data-act="reload">↻ 최신 불러오기</button>
    <a class="btn light sm" style="text-decoration:none" href="index.html">앱 열기 ↗</a>
  </div>

  <div class="wrap">
    <div class="daybar">
      ${dayChips}
      <button class="btn ghost sm" data-act="addDay">＋ 새 Day</button>
    </div>

    <div class="cols">
      <!-- 왼쪽: 기본/문장/책/지문 -->
      <div>
        <div class="card">
          <h2>기본 정보</h2>
          <div class="label">수업 날짜 <span style="font-weight:400;color:#b8c2d2">(이 날짜부터 학생에게 노출)</span></div>
          <div class="row">
            <input type="date" class="inp" data-bind="date" value="${esc(d.date)}">
            <input class="inp" data-bind="label" value="${esc(d.label)}" placeholder="라벨 (예: A반 Day 3)">
          </div>
        </div>

        <div class="card">
          <h2>오늘 선생님이 고른 문장</h2>
          <div class="label">영어 문장</div>
          <input class="inp" data-bind="quote.en" value="${esc(d.quote.en)}">
          <div class="label">우리말 해석</div>
          <input class="inp" data-bind="quote.ko" value="${esc(d.quote.ko)}">
          <div class="label">선생님 이름 / 한마디</div>
          <div class="row">
            <input class="inp" style="flex:.7" data-bind="quote.teacher" value="${esc(d.quote.teacher)}" placeholder="김선생님">
            <input class="inp" style="flex:1.4" data-bind="quote.comment" value="${esc(d.quote.comment)}" placeholder="한마디">
          </div>
        </div>

        <div class="card">
          <h2>책 · e-북 본문</h2>
          <div class="label">제목 / 저자 / 챕터</div>
          <input class="inp" data-bind="book.title" value="${esc(d.book.title)}" placeholder="책 제목">
          <div class="row" style="margin-top:8px">
            <input class="inp" data-bind="book.author" value="${esc(d.book.author)}" placeholder="저자">
            <input class="inp" style="flex:1.5" data-bind="book.chapter" value="${esc(d.book.chapter)}" placeholder="챕터">
          </div>
          <div class="label">본문 — 문단은 빈 줄로, 페이지는 <span class="mono">---</span> 한 줄로 구분</div>
          <textarea class="inp" data-bind="pagesText" rows="12">${esc(d.pagesText)}</textarea>
        </div>

        <div class="card">
          <h2>지문 복습</h2>
          <div class="hint">문단은 빈 줄로 구분하고, 탭하면 뜻이 뜨는 단어는 <span class="mono">[대괄호]</span>로 감싸세요.</div>
          <textarea class="inp" data-bind="reviewText" rows="7">${esc(d.reviewText)}</textarea>
          <div class="cathead" style="margin-top:14px">
            <div class="name">단어 카드 <span class="cnt">${d.words.length}개</span></div>
            <button class="btn ghost sm" data-act="addWord">＋ 단어 추가</button>
          </div>
          ${d.words.map((w, i) => `
            <div class="qcard">
              <div class="row">
                <input class="inp" style="flex:1.2" data-bind="words.${i}.word" value="${esc(w.word)}" placeholder="단어 (영어)">
                <input class="inp" style="flex:.8" data-bind="words.${i}.pos" value="${esc(w.pos)}" placeholder="품사">
                <button class="btn danger sm" style="flex:none" data-act="delWord" data-arg="${i}">삭제</button>
              </div>
              <input class="inp" style="margin-top:7px" data-bind="words.${i}.def" value="${esc(w.def)}" placeholder="뜻">
              <input class="inp" style="margin-top:7px" data-bind="words.${i}.ex" value="${esc(w.ex)}" placeholder="예문 (선택)">
            </div>`).join('')}
        </div>
      </div>

      <!-- 오른쪽: 퀴즈 6종 + 학생/Supabase -->
      <div>
        <div class="card">
          <h2>퀴즈 문항</h2>
          <div class="hint">문제를 비워두면 그 문항은 학생에게 출제되지 않아요. 문항이 하나도 없는 카테고리는 학생 홈에서 숨겨집니다.</div>
          ${Object.keys(QUIZ_META).map(qEditor).join('')}
        </div>

        <div class="card">
          <h2>학생 명단 <span style="font-size:12px;color:#7d8aa0;font-weight:600">(Supabase 미사용 시)</span></h2>
          <div class="hint">한 줄에 한 명씩. Supabase(아래)가 설정돼 있으면 아이디/비밀번호 로그인이 대신 사용돼 이 명단은 무시됩니다.</div>
          <textarea class="inp" data-gbind="studentsText" rows="4" placeholder="이지민&#10;박서준&#10;최하윤">${esc(gEd.studentsText)}</textarea>
        </div>

        <div class="card">
          <h2>📡 기록 수집 (Supabase)</h2>
          <div class="hint">설정하면 학생 로그인 + 점수 기록이 켜집니다. Supabase 프로젝트의 URL과 anon public 키를 넣으세요.</div>
          <div class="label">Project URL</div>
          <input class="inp" data-gbind="sbUrl" value="${esc(gEd.sbUrl)}" placeholder="https://xxxx.supabase.co">
          <div class="label">anon public key</div>
          <input class="inp" data-gbind="sbKey" value="${esc(gEd.sbKey)}" placeholder="eyJ...">
        </div>

        <div class="card" style="border-color:#f0c65a;background:#fffdf5">
          <h2>미리보기</h2>
          <div class="hint">배포 전에 학생 화면이 어떻게 보이는지 확인하려면 새 탭에서 앱을 열고 교사 → 콘텐츠 관리에서 확인하세요. 이 페이지의 편집 내용은 <b>배포해야</b> 반영됩니다.</div>
        </div>
      </div>
    </div>
  </div>

  <div class="savebar">
    <div class="msg ${ui.msgType === 'ok' ? 'toast-ok' : ui.msgType === 'err' ? 'toast-err' : ''}">${esc(ui.msg) || '변경 후 <b>배포</b>를 누르면 모든 기기에 반영됩니다.'.replace('&lt;b&gt;','<b>').replace('&lt;/b&gt;','</b>')}</div>
    <button class="btn danger" data-act="delDay">Day 삭제</button>
    <button class="btn primary" data-act="publish" ${ui.busy ? 'disabled' : ''}>${ui.busy ? '배포 중...' : '🚀 배포하기'}</button>
  </div>`;
}

function qEditor(cat) {
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
        <select class="inp" style="width:auto;padding:6px 8px" data-bind="${base}.type" data-rerender="1">
          <option value="mc" ${q.type === 'mc' ? 'selected' : ''}>객관식</option>
          <option value="input" ${q.type === 'input' ? 'selected' : ''}>주관식</option>
        </select>
        <div style="flex:1"></div>
        <button class="btn danger sm" data-act="delQ" data-arg="${cat}:${i}">삭제</button>
      </div>
      <input class="inp" data-bind="${base}.prompt" value="${esc(q.prompt)}" placeholder="문제">
      <input class="inp" style="margin-top:7px" data-bind="${base}.sentence" value="${esc(q.sentence)}" placeholder="예문/제시 문장 (선택)">
      ${q.type === 'mc'
        ? `<div class="label" style="margin-bottom:2px">보기 (동그라미로 정답 선택, 2개 이상)</div>${opts}`
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

/* ---------- 이벤트 바인딩 ---------- */
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

boot();
