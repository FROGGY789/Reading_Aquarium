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
const ui = { tab: 'passage', msg: '', msgType: '', busy: false, loaded: false };

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
  addQ(cat) { ed.day.quiz[cat].push({ type: 'mc', prompt: '', sentence: '', options: ['', '', '', ''], answer: 0, accept: '', explain: '' }); render(); },
  delQ(arg) { const [cat, i] = arg.split(':'); ed.day.quiz[cat].splice(Number(i), 1); render(); },
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
  try {
    const repo = await (await fetch(api, { headers })).json();
    const branch = repo.default_branch || 'main';
    let sha;
    const cur = await fetch(`${api}/contents/${CONTENT_URL}?ref=${branch}`, { headers });
    if (cur.ok) sha = (await cur.json()).sha;
    const body = { message: '콘텐츠 배포(데스크톱): ' + new Date().toLocaleString('ko-KR'), content: b64(JSON.stringify(content, null, 2)), branch };
    if (sha) body.sha = sha;
    const res = await fetch(`${api}/contents/${CONTENT_URL}`, { method: 'PUT', headers, body: JSON.stringify(body) });
    if (!res.ok) { const err = await res.json().catch(() => ({})); throw new Error(err.message || ('HTTP ' + res.status)); }
    toast('✅ 배포 완료! 1~2분 뒤 모든 기기에 반영됩니다.', 'ok');
  } catch (e) { toast('❌ 배포 실패: ' + e.message + ' (토큰 권한을 확인해 주세요)', 'err'); }
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
        return `<div class="daychip ${i === ed.dayIndex ? 'on' : ''}" data-act="selectDay" data-arg="${i}">${esc(md)}${day.label ? ' · ' + esc(day.label) : ''}</div>`;
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
  </div>`;
}

function topbar(loaded) {
  const hasToken = loaded && !!localStorage.getItem(TOKEN_KEY);
  return `<div class="topbar">
    <div class="brand">Reading Aquarium <small>교사 콘텐츠 관리 · 데스크톱</small></div>
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
        <h2>지문 (그날 읽을 전체 텍스트)</h2>
        <div class="hint">
          · 문단은 <b>빈 줄</b>로 구분<br>
          · e-북 페이지는 <span class="mono">---</span> 를 한 줄에 넣어 구분<br>
          · 팝오버로 뜻을 보여줄 단어는 <span class="mono">[대괄호]</span>로 감싸기 (예: a <span class="mono">[restless]</span> horizon)<br>
          이 지문 하나에서 <b>e-북 리더</b>와 <b>지문 복습(팝오버)</b>이 모두 나와요.
        </div>
        <textarea class="inp" data-bind="passageText" rows="20" placeholder="여기에 그날 읽을 지문을 붙여넣으세요. 아주 길어도 괜찮아요.">${esc(d.passageText)}</textarea>
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
  const coreN = (d.previewCoreText || '').split('\n').map(s => s.trim()).filter(Boolean).length;
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
    <div class="card">
      <h2>🟡 보통 · 핵심 문장 <span style="font-size:12px;color:#7d8aa0;font-weight:600">${coreN}문장</span></h2>
      <div class="hint">한 줄에 한 문장씩. 비워두면 지문 앞부분 문장 6개가 자동으로 쓰여요.</div>
      <textarea class="inp" data-bind="previewCoreText" rows="8" placeholder="The sea has always drawn people toward its edge.&#10;Sailors spoke of a restless horizon.">${esc(d.previewCoreText)}</textarea>
    </div>
    <div class="card">
      <h2>🔴 버닝 · 이해도 확인 (comprehension)</h2>
      <div class="hint">지문 전체를 읽은 뒤 풀 문항이에요. 비워두면 읽기만으로 완료돼요.</div>
      ${qcat('preview')}
    </div>
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

boot();
