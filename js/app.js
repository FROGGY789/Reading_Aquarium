/* =========================================================
 * Fathom Aquarium — 앱 로직 (상태 관리 + 화면 렌더링)
 * 빌드 없이 동작하는 순수 JS SPA. 상태는 localStorage에 저장.
 * ========================================================= */

const STORE_KEY = 'er_aquarium_v1';
const STUDENT_NAME = '유림';
const XP_NEED = 120;      // 레벨업에 필요한 XP
const EGG_PRICE = 50;     // 알 구매 비용(XP)
const HATCH_MS = 5000;    // 부화 연출 길이

const NORM = s => (s || '').toString().toLowerCase().replace(/[^a-z0-9가-힣]/g, '');
const esc = s => String(s == null ? '' : s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/* ---------- 상태 ---------- */
const DEFAULT_STATE = {
  role: 'student',
  screen: 'home',
  intro: true,
  introLeaving: false,
  tasks: { preview: false, review: false, vocab: false, sentence: false, vocabPrep: false, sentPrep: false, grammar: false },
  eggs: 0,
  animals: [],
  xp: 0,
  dailyRewarded: false,
  pullCount: 0,
  quizTask: null, quizQi: 0, picks: {}, inputs: {}, checked: {},
  result: null,
  hatchStage: 'idle', hatchSpecies: null,
  pop: null,
  dexOpen: false,
  readerPage: 0
};

let state = loadState();
let hatchTimer = null;
let introTimer = null;

function loadState() {
  let saved = null;
  try { saved = JSON.parse(localStorage.getItem(STORE_KEY) || 'null'); } catch (e) { /* 무시 */ }
  const s = Object.assign({}, DEFAULT_STATE, saved || {});
  s.tasks = Object.assign({}, DEFAULT_STATE.tasks, (saved && saved.tasks) || {});
  s.intro = true;            // 앱을 열 때마다 오프닝을 보여줌
  s.introLeaving = false;
  if (s.hatchStage === 'cracking') s.hatchStage = 'revealed'; // 연출 중 종료된 경우 복구
  return s;
}
function save() {
  try { localStorage.setItem(STORE_KEY, JSON.stringify(state)); } catch (e) { /* 무시 */ }
}
function set(patch) {
  Object.assign(state, patch);
  save();
  render();
}

/* ---------- 파생 값 ---------- */
const level = () => Math.floor(state.xp / XP_NEED) + 1;
const xpInto = () => state.xp % XP_NEED;
const doneCount = () => ['preview', 'review', 'vocab', 'sentence'].filter(k => state.tasks[k]).length;
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
function currentQuiz() { return state.quizTask ? QUIZ[state.quizTask] : null; }
function currentQ() { const q = currentQuiz(); return q ? q.questions[state.quizQi] : null; }
function isRight(q, i) {
  if (!q) return false;
  if (q.type === 'mc') return state.picks[i] === q.answer;
  const v = NORM(state.inputs[i]);
  return !!v && q.accept.some(a => NORM(a) === v || v.includes(NORM(a)));
}
function canCheck() {
  const cq = currentQ();
  if (!cq) return false;
  return cq.type === 'mc'
    ? state.picks[state.quizQi] != null
    : !!(state.inputs[state.quizQi] && state.inputs[state.quizQi].trim());
}

/* =========================================================
 * 액션
 * ========================================================= */
const actions = {
  setRoleStudent() { set({ role: 'student' }); },
  setRoleTeacher() { set({ role: 'teacher' }); },

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

  openReader() { set({ screen: 'reader' }); },
  readerPrev() { if (state.readerPage > 0) set({ readerPage: state.readerPage - 1 }); },
  readerNext() { if (state.readerPage < BOOK.pages.length - 1) set({ readerPage: state.readerPage + 1 }); },

  startTask(t) {
    if (t === 'review') set({ screen: 'review', pop: null });
    else set({ screen: 'quiz', quizTask: t, quizQi: 0, picks: {}, inputs: {}, checked: {} });
  },
  tapWord(w) { set({ pop: state.pop === w ? null : w }); },
  reviewDone() { completeTask('review'); },

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
    const q = currentQuiz();
    if (!q) return;
    if (state.quizQi < q.questions.length - 1) { set({ quizQi: state.quizQi + 1 }); return; }
    // 마지막 문항 → 결과 집계
    let correct = 0; const wrongs = [];
    q.questions.forEach((qq, i) => {
      if (isRight(qq, i)) { correct++; return; }
      const your = qq.type === 'mc'
        ? (state.picks[i] != null ? qq.options[state.picks[i]] : '(무응답)')
        : (state.inputs[i] || '(무응답)');
      wrongs.push({ prompt: qq.prompt, your, correct: qq.type === 'mc' ? qq.options[qq.answer] : qq.accept[0], explain: qq.explain });
    });
    set({
      screen: 'result',
      result: { task: state.quizTask, name: q.name, total: q.questions.length, correct, score: Math.round(correct / q.questions.length * 100), wrongs }
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
  skipHatch() { clearTimeout(hatchTimer); set({ hatchStage: 'revealed' }); }
};

function completeTask(t) {
  const tasks = Object.assign({}, state.tasks);
  const wasDone = tasks[t];
  tasks[t] = true;
  const patch = { tasks, screen: 'home', quizTask: null, result: null, pop: null };
  if (!wasDone) patch.xp = state.xp + 15;
  const all = tasks.preview && tasks.review && tasks.vocab && tasks.sentence;
  if (all && !state.dailyRewarded) { patch.eggs = state.eggs + 1; patch.dailyRewarded = true; }
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
 * 화면 렌더링
 * ========================================================= */
function todayLabel() {
  const now = new Date();
  const days = ['일', '월', '화', '수', '목', '금', '토'];
  return `${now.getMonth() + 1}월 ${now.getDate()}일 ${days[now.getDay()]}요일 · A반 Day 3`;
}

function roleToggleHTML() {
  const tab = on => `font-size:12px;font-weight:600;padding:6px 16px;border-radius:999px;cursor:pointer;color:${on ? '#14243f' : '#cfe0f5'};background:${on ? '#fff' : 'transparent'}`;
  return `<div style="position:absolute;top:14px;left:50%;transform:translateX(-50%);z-index:60;display:flex;gap:3px;background:rgba(11,33,64,.5);backdrop-filter:blur(6px);-webkit-backdrop-filter:blur(6px);border-radius:999px;padding:3px">
    <div data-act="setRoleStudent" style="${tab(state.role === 'student')}">학생</div>
    <div data-act="setRoleTeacher" style="${tab(state.role === 'teacher')}">교사</div>
  </div>`;
}

function introHTML() {
  const leaving = state.introLeaving ? 'animation:diveOut .9s cubic-bezier(.6,0,.2,1) both' : '';
  return `<div data-act="startApp" style="position:absolute;inset:0;z-index:80;cursor:pointer;overflow:hidden;background:linear-gradient(180deg,#5aa7de 0%,#2f6fae 28%,#134279 60%,#07203f 100%);display:flex;flex-direction:column;align-items:center;justify-content:center;color:#fff;${leaving}">
    <div style="position:absolute;inset:0">${introBubblesHTML()}</div>
    <div style="position:absolute;top:-10%;left:18%;width:60%;height:80%;background:linear-gradient(180deg,rgba(255,255,255,.22),transparent);transform:skewX(-13deg);filter:blur(10px)"></div>
    <div style="position:relative;text-align:center;animation:fadeup 1.3s ease-out">
      <div style="font-size:12px;letter-spacing:.42em;opacity:.8;text-transform:uppercase">Extensive Reading</div>
      <div style="font-family:'Lora',serif;font-size:47px;font-weight:600;line-height:1.03;margin:14px 0 0;text-shadow:0 6px 26px rgba(0,0,0,.45)">Fathom<br>Aquarium</div>
      <div style="font-size:12.5px;opacity:.85;margin-top:14px;font-style:italic;font-family:'Lora',serif">깊이 읽고, 깊이 이해하다</div>
    </div>
    <div style="position:absolute;bottom:72px;text-align:center;animation:pulse 1.8s ease-in-out infinite">
      <div style="font-size:13px;font-weight:600;opacity:.95">화면을 탭하여 시작</div>
      <div style="font-size:20px;margin-top:4px">↓</div>
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
  const t = state.tasks;
  const row = done => `display:flex;align-items:center;gap:12px;background:#fff;border:1.5px solid ${done ? '#cfe6da' : '#e2e9f2'};border-radius:16px;padding:13px 15px;cursor:pointer;opacity:${done ? '.72' : '1'}`;
  const badge = done => done
    ? `<div style="font-size:11px;font-weight:700;color:#2fa36b">완료 ✓</div>`
    : `<div style="font-size:11px;font-weight:700;color:#2f74e6">시작 →</div>`;
  const taskRow = (key, act, iconBg, icon, title, sub) => `
    <div data-act="${act}" data-arg="${key}" style="${row(t[key])}">
      <div style="width:40px;height:40px;border-radius:12px;background:${iconBg};display:flex;align-items:center;justify-content:center;font-size:19px">${icon}</div>
      <div style="flex:1"><div style="font-size:14px;font-weight:600;color:#14243f">${title}</div><div style="font-size:11px;color:#7d8aa0;margin-top:1px">${sub}</div></div>
      ${badge(t[key])}
    </div>`;

  const done = doneCount();
  const enter = !state.intro ? 'animation:riseIn .8s cubic-bezier(.2,.7,.2,1) both' : '';

  const eggBanner = state.eggs > 0 ? `
    <div data-act="goHatch" style="display:flex;align-items:center;gap:13px;background:#fff8e6;border:1.5px solid #f0c65a;border-radius:18px;padding:14px 16px;margin-bottom:18px;cursor:pointer;box-shadow:0 8px 20px -12px rgba(240,169,46,.6)">
      <div style="animation:floaty 2.2s ease-in-out infinite;font-size:30px">🥚</div>
      <div style="flex:1"><div style="font-size:13.5px;font-weight:700;color:#8a6412">새로운 알이 도착했어요!</div><div style="font-size:11.5px;color:#b08a2e;margin-top:2px">보유 알 ${state.eggs}개 · 탭해서 부화시키기</div></div>
      <div style="font-size:18px;color:#c9922a">→</div>
    </div>` : '';

  return `<div style="${enter}"><div style="padding:52px 20px 96px">
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px">
      <div style="display:flex;align-items:center;gap:11px">
        <div style="width:44px;height:44px;border-radius:14px;background:#2f74e6;color:#fff;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:16px;box-shadow:0 4px 0 #1f57c4">${esc(STUDENT_NAME.slice(0, 2))}</div>
        <div>
          <div style="font-size:16px;font-weight:700;color:#14243f">안녕하세요, ${esc(STUDENT_NAME)}님 👋</div>
          <div style="font-size:11.5px;color:#7d8aa0;margin-top:2px">${todayLabel()}</div>
        </div>
      </div>
      <div data-act="goAqua" style="display:flex;align-items:center;gap:6px;background:#fff;border:1px solid #e2e9f2;border-radius:14px;padding:7px 11px;cursor:pointer;box-shadow:0 3px 8px -4px rgba(20,36,63,.3)">
        <span style="font-size:15px">🐚</span>
        <div style="line-height:1"><div style="font-size:9px;color:#7d8aa0">레벨</div><div style="font-size:14px;font-weight:700;color:#2f74e6">Lv.${level()}</div></div>
      </div>
    </div>

    <div style="position:relative;background:linear-gradient(150deg,#1f57c4,#2f74e6 55%,#17b0c4);border-radius:22px;padding:20px 20px 18px;color:#fff;box-shadow:0 14px 30px -14px rgba(31,87,196,.7);overflow:hidden;margin-bottom:20px">
      <div style="position:absolute;top:-14px;left:14px;font-family:'Lora',serif;font-size:90px;line-height:1;color:rgba(255,255,255,.16);font-style:italic">“</div>
      <div style="position:relative">
        <div style="font-size:10.5px;font-weight:600;letter-spacing:.06em;opacity:.85;text-transform:uppercase">오늘 선생님이 고른 문장</div>
        <div style="font-family:'Lora',serif;font-size:17px;line-height:1.55;margin:9px 0 8px">"Yet the deeper they went, the more the water kept its silence."</div>
        <div style="font-size:13px;line-height:1.5;color:#e4f0ff">그러나 더 깊이 들어갈수록, 바다는 더욱 침묵을 지켰다.</div>
        <div style="display:flex;align-items:center;gap:7px;margin-top:12px;padding-top:11px;border-top:1px solid rgba(255,255,255,.22)">
          <div style="width:22px;height:22px;border-radius:50%;background:rgba(255,255,255,.25);display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:700">김</div>
          <span style="font-size:11.5px;opacity:.9">김선생님의 한마디 · 침묵의 의미를 생각하며 읽어보세요</span>
        </div>
      </div>
    </div>

    <div style="font-size:12px;font-weight:700;color:#7d8aa0;letter-spacing:.02em;margin-bottom:9px">지금 읽는 책</div>
    <div data-act="openReader" style="display:flex;gap:14px;background:#fff;border:1px solid #e2e9f2;border-radius:18px;padding:14px;margin-bottom:20px;cursor:pointer;box-shadow:0 8px 20px -14px rgba(20,50,90,.5)">
      <div style="width:58px;height:80px;border-radius:8px;flex:none;background:linear-gradient(150deg,#1f57c4,#17b0c4);box-shadow:0 4px 10px -4px rgba(31,87,196,.7);position:relative;overflow:hidden">
        <div style="position:absolute;top:0;left:8px;bottom:0;width:2px;background:rgba(255,255,255,.35)"></div>
        <div style="position:absolute;bottom:9px;left:12px;right:8px;font-family:'Lora',serif;font-size:9px;line-height:1.2;color:#fff;font-style:italic">the sea</div>
      </div>
      <div style="flex:1;display:flex;flex-direction:column">
        <div style="font-family:'Lora',serif;font-size:15px;font-weight:600;color:#14243f;line-height:1.3">${BOOK.title}</div>
        <div style="font-size:11.5px;color:#7d8aa0;margin-top:2px">${BOOK.author}</div>
        <div style="font-size:11px;color:#90867c;margin-top:6px">${BOOK.chapter}</div>
        <div style="margin-top:auto;display:flex;align-items:center;gap:8px">
          <div style="flex:1;height:6px;border-radius:3px;background:#e7edf5;overflow:hidden"><div style="height:100%;width:${readerProgress()};background:linear-gradient(90deg,#2f74e6,#17b0c4);border-radius:3px"></div></div>
          <span style="font-size:11px;font-weight:700;color:#2f74e6">이어 읽기 →</span>
        </div>
      </div>
    </div>

    ${eggBanner}

    <div style="display:flex;align-items:baseline;justify-content:space-between;margin-bottom:11px">
      <div style="font-size:14px;font-weight:700;color:#14243f">오늘 할 일</div>
      <div style="font-size:12px;font-weight:600;color:#2f74e6">${done}/4 완료</div>
    </div>
    <div style="height:8px;border-radius:4px;background:#dde6f1;overflow:hidden;margin-bottom:6px"><div style="height:100%;border-radius:4px;background:linear-gradient(90deg,#2f74e6,#17b0c4);width:${done / 4 * 100}%"></div></div>
    <div style="font-size:11px;color:#7d8aa0;margin-bottom:14px">4개를 모두 끝내면 랜덤 알을 하나 받아요 🥚</div>

    <div style="display:flex;flex-direction:column;gap:10px">
      ${taskRow('preview', 'startTask', '#e7f0fd', '👀', '지문 예습', '수업 전 미리보기 + 예습 퀴즈')}
      ${taskRow('review', 'startTask', '#e0f3ea', '📖', '지문 복습', '단어 팝오버로 다시 읽기')}
      ${taskRow('vocab', 'startTask', '#fdeede', '🔤', '어휘 복습', '뜻·빈칸·스펠링 3문항')}
      ${taskRow('sentence', 'startTask', '#efe7fd', '🧩', '문장 복습', '구조 분석 + 해석 3문항')}
    </div>

    <div style="font-size:13px;font-weight:700;color:#14243f;margin:20px 0 4px">더 해보기</div>
    <div style="font-size:11px;color:#7d8aa0;margin-bottom:11px">보너스 학습 · 원할 때 자유롭게</div>
    <div style="display:flex;flex-direction:column;gap:10px">
      ${taskRow('vocabPrep', 'startTask', '#e7f0fd', '📘', '어휘 예습', '다음 수업 단어 미리보기 2문항')}
      ${taskRow('sentPrep', 'startTask', '#e0f3ea', '✍️', '문장 예습', '핵심 문장 의미 미리보기 2문항')}
      ${taskRow('grammar', 'startTask', '#fdeede', '📐', '어법 퀴즈', '시제·관계사 등 어법 3문항')}
    </div>
  </div></div>`;
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

    <div style="position:relative;padding:52px 20px 0;color:#fff;pointer-events:none">
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
  const wordStyle = active => `background:${active ? '#2f74e6' : '#e7f0fd'};color:${active ? '#fff' : 'inherit'};border-bottom:2px solid #2f74e6;border-radius:3px;padding:0 3px;cursor:pointer`;
  const pop = state.pop ? POP[state.pop] : null;
  const popHTML = pop ? `
    <div style="font-family:'IBM Plex Sans KR',sans-serif;background:#14243f;color:#fff;border-radius:14px;padding:13px 15px;margin:0 0 16px;box-shadow:0 14px 30px -12px rgba(0,0,0,.5)">
      <div style="display:flex;align-items:baseline;gap:9px"><span style="font-family:'Lora',serif;font-size:16px;font-weight:700">${esc(pop.word)}</span><span style="font-size:11px;color:#7fd0e6">${esc(pop.pos)}</span></div>
      <div style="font-size:13px;color:#dbe6f5;margin-top:5px">${esc(pop.def)}</div>
      <div style="font-size:12px;color:#93a6c2;margin-top:6px;font-style:italic;font-family:'Lora',serif">${esc(pop.ex)}</div>
    </div>` : '';

  return `<div style="padding:52px 0 40px">
    <div style="padding:0 20px;display:flex;align-items:center;justify-content:space-between;margin-bottom:6px">
      <div data-act="goHome" style="display:flex;align-items:center;gap:8px;cursor:pointer"><div style="width:30px;height:30px;border-radius:10px;background:#e7f0fd;color:#2f74e6;display:flex;align-items:center;justify-content:center">←</div><span style="font-size:13px;font-weight:600;color:#14243f">지문 복습</span></div>
      <div style="font-size:11px;color:#7d8aa0">단어를 탭해보세요</div>
    </div>
    <div style="padding:16px 22px 0;font-family:'Lora',serif;font-size:18px;line-height:2;color:#26303f">
      <p style="margin:0 0 14px">The sea has always drawn people toward its edge.</p>
      <p style="margin:0 0 14px">Sailors spoke of a <span data-act="tapWord" data-arg="restless" style="${wordStyle(state.pop === 'restless')}">restless</span> horizon that seemed to <span data-act="tapWord" data-arg="retreat" style="${wordStyle(state.pop === 'retreat')}">retreat</span> with every mile.</p>
      ${popHTML}
      <p style="margin:0">Yet the deeper they went, the more the water kept its silence.</p>
    </div>
    <div style="padding:26px 20px 0"><button data-act="reviewDone" style="width:100%;border:none;background:#2f74e6;color:#fff;font-size:14px;font-weight:600;padding:14px;border-radius:15px;box-shadow:0 5px 0 #1f57c4;cursor:pointer">복습 완료 ✓</button></div>
  </div>`;
}

/* ---- 퀴즈 ---- */
function quizHTML() {
  const q = currentQuiz(), cq = currentQ();
  if (!q || !cq) return '';
  const qi = state.quizQi;
  const checked = !!state.checked[qi];
  const pct = ((qi + (checked ? 1 : 0)) / q.questions.length * 100).toFixed(0);
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
    ? `<button data-act="quizNext" style="width:100%;border:none;background:#14243f;color:#fff;font-size:14px;font-weight:600;padding:14px;border-radius:15px;box-shadow:0 5px 0 #0a1526;cursor:pointer">${qi >= q.questions.length - 1 ? '결과 보기' : '다음 →'}</button>`
    : `<button id="check-btn" data-act="quizCheck" class="btn-check ${canCheck() ? 'on' : ''}">확인</button>`;

  return `<div style="padding:52px 20px 40px">
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:14px">
      <div data-act="goHome" style="width:30px;height:30px;border-radius:10px;background:#e7f0fd;color:#2f74e6;display:flex;align-items:center;justify-content:center;cursor:pointer">←</div>
      <div style="flex:1;margin:0 12px"><div style="height:8px;border-radius:4px;background:#dde6f1;overflow:hidden"><div style="height:100%;background:linear-gradient(90deg,#2f74e6,#17b0c4);border-radius:4px;width:${pct}%"></div></div></div>
      <div style="font-size:12px;font-weight:700;color:#14243f">${qi + 1}/${q.questions.length}</div>
    </div>
    <div style="display:inline-flex;align-items:center;gap:6px;background:${tagBg};color:${tagFg};font-size:11px;font-weight:700;padding:5px 11px;border-radius:20px">${esc(q.tag)}</div>
    <div style="font-size:16px;font-weight:700;color:#14243f;margin:13px 0 4px;line-height:1.45">${esc(cq.prompt)}</div>
    ${cq.sentence ? `<div style="background:#fff;border:1px solid #e2e9f2;border-radius:14px;padding:13px 16px;font-family:'Lora',serif;font-size:16px;line-height:1.7;color:#26303f;margin:10px 0 16px">${esc(cq.sentence)}</div>` : ''}
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

  return `<div style="padding:52px 0 40px">
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
function readerProgress() {
  return Math.round((state.readerPage + 1) / BOOK.pages.length * 100) + '%';
}
function readerHTML() {
  const paras = BOOK.pages[state.readerPage] || [];
  return `<div style="position:absolute;inset:0;display:flex;flex-direction:column;background:#f5f0e6">
    <div style="padding:48px 22px 12px;display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid #e7dfce">
      <div data-act="goHome" style="width:30px;height:30px;border-radius:10px;background:#ece3d2;color:#7a6b52;display:flex;align-items:center;justify-content:center;cursor:pointer">←</div>
      <div style="text-align:center">
        <div style="font-family:'Lora',serif;font-size:13px;font-weight:600;color:#3a3222">${BOOK.title}</div>
        <div style="font-size:10.5px;color:#9c8f76;margin-top:1px">${BOOK.chapter}</div>
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
        <span style="font-size:12px;font-weight:600;color:#9c8f76">${state.readerPage + 1} / ${BOOK.pages.length}</span>
        <button data-act="readerNext" style="border:none;background:#c08a3a;color:#fff;font-size:13px;font-weight:600;white-space:nowrap;padding:10px 18px;border-radius:12px;box-shadow:0 4px 0 #a06f28;cursor:pointer">다음 →</button>
      </div>
    </div>
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
        <div style="font-size:11.5px;opacity:.8;margin-top:6px;line-height:1.6">오늘 할 일 4개를 완료하거나<br>XP로 알을 구매하세요</div>
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

  return `<div style="min-height:100%;background:linear-gradient(180deg,#2a6bb0 0%,#123f74 55%,#0b2a52 100%);position:relative;padding:52px 20px 92px">
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

/* ---- 교사 대시보드 ---- */
function teacherHTML() {
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

  return `<div class="scroll" style="background:#eef3fa">
    <div style="padding:52px 18px 30px">
      <div style="font-size:19px;font-weight:700;color:#14243f">여름 특강 A반 · Day 3</div>
      <div style="font-size:12px;color:#7d8aa0;margin-top:2px">${BOOK.title} · 학생 18명</div>

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
      </div>
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
  let html = roleToggleHTML();

  if (state.hatchStage === 'cracking') html += hatchCinematicHTML();

  if (state.role === 'student') {
    let screen = '';
    switch (state.screen) {
      case 'home': screen = homeHTML(); break;
      case 'aquarium': screen = aquariumHTML(); break;
      case 'review': screen = reviewHTML(); break;
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

  if (state.intro) html += introHTML();

  document.getElementById('app').innerHTML = html;
  bindInput();
}

/* 입력창은 키 입력마다 리렌더하면 포커스를 잃으므로 별도 바인딩 */
function bindInput() {
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
document.getElementById('app').addEventListener('click', e => {
  const el = e.target.closest('[data-act]');
  if (!el) return;
  const fn = actions[el.dataset.act];
  if (fn) fn(el.dataset.arg);
});

render();
