/* =========================================================
 * Fathom Aquarium — 데이터 (동물 도감 / 등급 / 퀴즈 / 책 본문)
 * ========================================================= */

// 픽셀 스프라이트: px 배열의 각 문자가 pal의 색상 키, '.'은 투명
const SPECIES = [
  {id:'fish',      name:'파랑 열대어',   pal:{c:'#3aa6e6',d:'#1f6fb0',k:'#12324f',w:'#fff'}, px:["..ccc...",".ccccc.d","cwkcccdd",".ccccc.d","..ccc..."]},
  {id:'clown',     name:'흰동가리',     pal:{o:'#f6812f',w:'#fff',d:'#c95a12',k:'#222'}, px:["..ooo...",".owwoo.d","okwoowdd",".owwoo.d","..ooo..."]},
  {id:'jelly',     name:'분홍 해파리',   pal:{j:'#f28fb5',t:'#e06a97',k:'#7a3457'}, px:[".jjjjj.","jjjjjjj","jkjjjkj","jjjjjjj",".t.t.t.","t..t..t"]},
  {id:'crab',      name:'빨간 게',      pal:{r:'#ee5a44',p:'#c8402f',k:'#222'}, px:["p.....p",".p.r.p.","prrrrrp","rkrrrkr","r.r.r.r"]},
  {id:'seahorse',  name:'노랑 해마',     pal:{y:'#f5c130',o:'#e0a416',k:'#222'}, px:[".yyo..","ykyo..",".yyy..","..yyy.",".yyy..","yyy...",".yyy..","yy...."]},
  {id:'turtle',    name:'초록 거북',     pal:{g:'#4fae5a',h:'#8ad78f',f:'#3d8a48'}, px:["..gggg..",".ghhhhg.","fhhhhhhf","fhhhhhhf",".gggggg.",".f....f."]},
  {id:'octopus',   name:'보라 문어',     pal:{p:'#9b6ff0',w:'#fff',k:'#222'}, px:["..ppp..",".ppppp.","pwpppwp","pkpppkp","ppppppp","p.p.p.p"]},
  {id:'whale',     name:'파랑 고래',     pal:{b:'#4176b8',d:'#2a4f86',w:'#fff',k:'#123'}, px:["...bbbb..","..bbbbbbt",".bbbbbbbt","wkbbbbbb.",".bbbbbbb.","..bbbbb.."]},
  {id:'tang',      name:'블루탱',       pal:{b:'#2f8fd8',d:'#1f6fb0',w:'#fff',k:'#123',y:'#f5c130'}, px:["..bbbb..",".bbbbbbd","bwkbbbby","bbbbbbby",".bbbbbbd","..bbbb.."]},
  {id:'guppy',     name:'구피',        pal:{o:'#ff8a3d',r:'#e0592a',w:'#fff',k:'#222'}, px:["..ooo..",".ooooor","owkooor",".ooooor","..oooo.","...oo.."]},
  {id:'angel',     name:'엔젤피시',     pal:{y:'#f6c945',o:'#dd991a',k:'#222',w:'#fff'}, px:[".y..y.","yy.yy.","ywkyyy","yyyyyy","yyoyy.",".yooy.","..oo.."]},
  {id:'puffer',    name:'복어',        pal:{y:'#f2d24b',o:'#d9a521',k:'#222',w:'#fff'}, px:[".k.y.k.","y.yyy.y",".ywkyy.","yyyyyyy",".yyyyy.","y.yyy.y",".k.k.k."]},
  {id:'star',      name:'불가사리',     pal:{o:'#ff9a3c',d:'#e06a1a',w:'#fff'}, px:["...o...","..ooo..","ooooooo",".ooooo.","..o.o..",".o...o."]},
  {id:'shrimp',    name:'새우',        pal:{r:'#ff7a5c',d:'#e0533a',k:'#222'}, px:["......rr",".rrrr.rr","rrrrrrr.","rkrrrr..","rrrr....",".r.r.r.."]},
  {id:'dolphin',   name:'돌고래',       pal:{b:'#6fa8d6',d:'#3f79ad',w:'#eaf3fb',k:'#123'}, px:["...bb....","..bbbbb..",".bbbbbbbb","wkbbbbbb.",".bbbbbb..","..bb..b.."]},
  {id:'ray',       name:'가오리',       pal:{p:'#8a7fd6',d:'#5f52ad',k:'#222',w:'#fff'}, px:["..p...p..",".ppp.ppp.","ppppppppp","pwpppppwp","ppppppppp",".pp...pp.","....k...."]},
  {id:'eel',       name:'곰치',        pal:{g:'#5aa15a',d:'#3d7a3d',k:'#123',w:'#fff'}, px:["gg......","dgg.....","wkgg....","..ggg...","...ggg..","....ggg.",".....ggg"]},
  {id:'squid',     name:'오징어',       pal:{p:'#e785b5',d:'#c85f93',w:'#fff',k:'#7a3457'}, px:["..ppp..",".ppppp.","pwpppwp","pkpppkp",".ppppp.","p.p.p.p","p..p..p"]},
  {id:'shark',     name:'상어',        pal:{g:'#8fa6bd',d:'#5f7791',w:'#fff',k:'#123'}, px:["..g......",".gg...g..","gggg.gg..","wkgggggg.","ggggggggd",".gggg....","..k.k...."]},
  {id:'angler',    name:'아귀',        pal:{d:'#3a4a63',k:'#0f1626',y:'#ffe27a',w:'#fff'}, px:[".....y.","....y..","dd..y..","dddddy.","dwkddd.","dddddd.","d.d.d.d"]},
  {id:'lobster',   name:'랍스터',       pal:{r:'#e0442f',d:'#b8301f',k:'#222'}, px:["r.r...r.r",".r.rrr.r.","rrrrrrrrr","rkrrrrrkr",".rrrrrrr.","r.r.r.r.r"]},
  {id:'narwhal',   name:'외뿔고래',     pal:{b:'#7fb0e0',d:'#4f80b8',w:'#fff',k:'#123',s:'#eaf3fb'}, px:["......s..","...bbbbs.","..bbbbb..",".bbbbbb..","wkbbbbb..",".bbbbbb..","..bbb.b.."]},
  {id:'axolotl',   name:'아홀로틀',     pal:{p:'#ff9ecb',d:'#f070a6',w:'#fff',k:'#7a3457'}, px:["p.p...","pppp..","pwkpp.","ppppp.","pppp..","p..p.."]},
  {id:'seadragon', name:'리프시드래곤', pal:{y:'#f0b84a',g:'#4fae7a',k:'#222',o:'#e08a2a'}, px:[".yy...","yky.g.",".yygg.","..yyg.","g.yy..",".gyy..","..yyg.","..yy.."]},
  {id:'crabHermit',name:'소라게',       pal:{o:'#e08a3a',r:'#d05a2a',w:'#fff',k:'#222'}, px:["..oo...",".oooo..","rroooo.","rwkroo.","rrrr.o.","r.r...."]},
  {id:'nautilus',  name:'앵무조개',     pal:{o:'#e8a24a',c:'#f4d9a8',d:'#c07a2a',k:'#222'}, px:["..ooo..",".occco.","ocdcdco","ocdcdco",".occco.","..k.k.o"]},
  {id:'penguin',   name:'펭귄',        pal:{k:'#20303f',w:'#fff',o:'#f5a623'}, px:["..kkk..",".kkkkk.","kkwwwkk","kwwwwwk","kwwwwwk",".wwwww.","..o.o.."]},
  {id:'jellyBlue', name:'푸른해파리',   pal:{b:'#5fb0e0',t:'#3f90c8',k:'#204a63'}, px:[".bbbbb.","bbbbbbb","bkbbbkb","bbbbbbb",".t.t.t.","t..t..t"]}
];

// 종별 등급
const RAR = {
  fish:'normal', clown:'normal', jelly:'special', crab:'special', seahorse:'rare', turtle:'rare',
  octopus:'superrare', whale:'unique', tang:'special', guppy:'normal', angel:'special', puffer:'special',
  star:'normal', shrimp:'normal', dolphin:'rare', ray:'rare', eel:'rare', squid:'rare',
  shark:'superrare', angler:'superrare', lobster:'superrare', narwhal:'unique', axolotl:'unique',
  seadragon:'unique', crabHermit:'normal', nautilus:'special', penguin:'rare', jellyBlue:'normal'
};

// 등급 정의(가중치 = 등장 확률 비중)
const RARITY = {
  normal:    {label:'NORMAL',      color:'#9fb2c9', weight:30},
  special:   {label:'SPECIAL',     color:'#2fd08a', weight:16},
  rare:      {label:'RARE',        color:'#4da0ff', weight:8},
  superrare: {label:'SUPER RARE',  color:'#b98cff', weight:4},
  unique:    {label:'✦ UNIQUE ✦', color:'#ffce4d', weight:1}
};

// 퀴즈 카테고리 메타(이름/태그는 고정, 문항만 날짜별 콘텐츠에서 제공)
const QUIZ_META = {
  preview:   {name:'지문 예습', tag:'예습'},
  vocab:     {name:'어휘 복습', tag:'어휘'},
  sentence:  {name:'문장 복습', tag:'문장'},
  vocabPrep: {name:'어휘 예습', tag:'예습'},
  sentPrep:  {name:'문장 예습', tag:'예습'},
  grammar:   {name:'어법 퀴즈', tag:'어법'}
};

// 기본(내장) 콘텐츠 — 배포된 data/content.json이 없을 때 사용되는 예시 Day
const DEFAULT_CONTENT = {
  version: 1,
  // 학생 명단(이름 선택 화면) — 비워두면 이름 선택 없이 단일 프로필로 동작
  students: [],
  // 기록 수집(Supabase) 설정 — 코드에 고정(모든 기기에서 항상 로그인).
  // 교사 콘텐츠 관리에서 값을 넣고 배포하면 이 기본값을 덮어쓸 수 있어요.
  supabase: {
    url: 'https://jhmglwmxhpsgfskuvmzg.supabase.co',
    anonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpobWdsd214aHBzZ2Zza3V2bXpnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQxMDMwMDUsImV4cCI6MjA5OTY3OTAwNX0.VxBQU-B-yn2-rNnW4TxcuInbHqLnEcIcNOngintPEEY'
  },
  days: [
    {
      date: '2026-07-15',
      label: 'A반 Day 3',
      quote: {
        en: 'Yet the deeper they went, the more the water kept its silence.',
        ko: '그러나 더 깊이 들어갈수록, 바다는 더욱 침묵을 지켰다.',
        teacher: '김선생님',
        comment: '침묵의 의미를 생각하며 읽어보세요'
      },
      book: {
        title: 'The Curiosity of the Sea',
        author: 'E. M. Hartwell',
        chapter: 'Chapter 3 · The Silent Horizon',
        cover: ''
      },
      // 지문(그날 읽을 전체 텍스트) — 문단은 빈 줄, 페이지는 --- , 팝오버 단어는 [대괄호].
      // e-북 리더와 지문 복습이 모두 이 하나의 지문에서 나옵니다.
      passage:
        "The sea has always drawn people toward its edge, whispering of places no map has ever named.\n\n" +
        "For centuries, sailors spoke of a [restless] horizon — a line that seemed to [retreat] with every mile they gained, as if the ocean itself were guarding a secret.\n\n" +
        "They rowed and sailed and drifted, yet the water kept its silence, offering neither answer nor apology.\n" +
        "---\n" +
        "Young Mira had heard these stories all her life. Her grandfather, a fisherman with salt in his beard and storms in his memory, would trace maps in the sand at low tide.\n\n" +
        "\"The deeper you go,\" he told her, \"the more the sea asks of you. And the less it explains.\"\n\n" +
        "She had not understood him then. But standing now at the bow of the little boat, watching the shoreline dissolve into haze, she began to.\n" +
        "---\n" +
        "The morning light broke across the swells in long silver ribbons. Somewhere beneath her, in water darker than any night, creatures moved that no human eye had witnessed.\n\n" +
        "Mira leaned over the rail and let her fingers trail through the cold. The sea did not answer. But for the first time, she felt it listening.\n\n" +
        "And that, she decided, was enough to begin.",
      vocab: {
        restless: {pos:'형용사', def:'가만히 있지 못하는, 끊임없이 움직이는', ex:'"a restless horizon"'},
        retreat:  {pos:'동사',   def:'물러나다, 후퇴하다',                 ex:'"seemed to retreat"'}
      },
      quiz: {
        preview: [
          {type:'mc', prompt:'이 글은 주로 무엇에 관한 글일까요?', options:['바다에 대한 인간의 호기심','항해 기술의 발전','어업의 역사','해양 날씨 예보'], answer:0, explain:'바다의 수평선과 침묵을 통해 인간의 끝없는 호기심을 그리고 있어요.'},
          {type:'mc', prompt:'"restless horizon"에서 느껴지는 분위기로 가장 알맞은 것은?', options:['가만히 있지 않고 계속 멀어지는 느낌','평온하고 고요한 느낌','위험하고 공포스러운 느낌','따뜻하고 포근한 느낌'], answer:0, explain:'restless는 "가만히 있지 못하는"이라는 뜻이에요.'}
        ],
        vocab: [
          {type:'mc', prompt:'restless의 뜻으로 알맞은 것은?', options:['가만히 있지 못하는','아주 조용한','매우 깊은','환하게 빛나는'], answer:0, explain:'restless = 가만히 있지 못하는, 끊임없이 움직이는.'},
          {type:'mc', prompt:'빈칸에 알맞은 단어는? "The sailors watched the ___ far away." (멀리 있는 수평선을 보았다)', options:['horizon','silence','edge','mile'], answer:0, explain:'horizon = 수평선.'},
          {type:'input', prompt:'"물러나다, 후퇴하다"에 해당하는 영단어를 쓰세요.', accept:['retreat'], explain:'retreat = 물러나다, 후퇴하다. 스펠링에 유의하세요.'}
        ],
        sentence: [
          {type:'mc', prompt:'이 문장의 주어는?', sentence:'Sailors spoke of a restless horizon.', options:['Sailors','a restless horizon','spoke'], answer:0, explain:'문장의 주어는 Sailors(선원들)입니다.'},
          {type:'mc', prompt:'이 문장의 동사는?', sentence:'Sailors spoke of a restless horizon.', options:['spoke','Sailors','horizon'], answer:0, explain:'동사는 spoke(speak의 과거형)입니다.'},
          {type:'input', prompt:'"kept its silence"를 우리말로 해석하면?', accept:['침묵을 지켰다','침묵했다','조용히 있었다','침묵'], explain:'kept its silence = 침묵을 지켰다.'}
        ],
        vocabPrep: [
          {type:'mc', prompt:'다음 수업에 나올 단어 horizon의 뜻은?', options:['수평선','파도','조류','해안'], answer:0, explain:'horizon = 수평선.'},
          {type:'mc', prompt:'silence의 뜻으로 알맞은 것은?', options:['침묵','속삭임','폭풍','비밀'], answer:0, explain:'silence = 침묵, 고요.'}
        ],
        sentPrep: [
          {type:'mc', prompt:'다음 문장의 의미로 가장 알맞은 것은?', sentence:'The water kept its silence.', options:['물은 침묵을 지켰다','물이 소리쳤다','물이 사라졌다','물이 넘쳤다'], answer:0, explain:'kept its silence = 침묵을 지켰다.'},
          {type:'input', prompt:'"toward its edge"를 우리말로 해석하면?', accept:['가장자리로','가장자리를 향해','끝을 향해','가장자리 쪽으로'], explain:'toward its edge = 그 가장자리를 향해.'}
        ],
        grammar: [
          {type:'mc', prompt:'빈칸에 알맞은 것은? "The sea has always ___ people."', options:['drawn','draw','drawing','draws'], answer:0, explain:'have/has + 과거분사(drawn) → 현재완료.'},
          {type:'mc', prompt:'밑줄 친 that의 역할은? "a horizon that seemed to retreat"', options:['주격 관계대명사','목적격 관계대명사','접속사','지시대명사'], answer:0, explain:'선행사 horizon을 수식하는 주격 관계대명사.'},
          {type:'input', prompt:'"seemed to retreat"에서 seem 뒤에 오는 형태는? (to + ___)', accept:['동사원형','원형','retreat','동사'], explain:'seem to + 동사원형.'}
        ]
      }
    }
  ]
};

/* =========================================================
 * 콘텐츠 모델 공용 헬퍼 (app.js · admin.js 공유)
 * 지문(passage) 중심: 지문 하나 + 팝오버 어휘(vocab) + 표지(cover)에서
 * e-북 리더/지문 복습/단어 카드가 모두 파생됩니다.
 * ========================================================= */
function _todayKey() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function dayCover(day) { return (day && day.book && day.book.cover) || ''; }
// 지문 원문(대괄호 포함). 구버전(book.pages) 콘텐츠도 자동 변환.
function dayPassage(day) {
  if (day && typeof day.passage === 'string' && day.passage.trim()) return day.passage;
  const pages = (day && day.book && day.book.pages) || [];
  if (pages.length) return pages.map(p => Array.isArray(p) ? p.join('\n\n') : p).join('\n---\n');
  // 아주 구버전: review.paragraphs만 있던 경우
  const rp = (day && day.review && day.review.paragraphs) || [];
  return rp.join('\n\n');
}
function dayVocab(day) { return (day && day.vocab) || (day && day.review && day.review.words) || {}; }
function stripBrackets(s) { return (s || '').replace(/\[([^\]]+)\]/g, '$1'); }
// 지문에서 [단어] 토큰을 순서대로(중복 제거) 뽑기
function scanVocab(text) {
  const out = []; const re = /\[([^\]]+)\]/g; let m;
  while ((m = re.exec(text || '')) !== null) { const w = m[1].trim(); if (w && !out.includes(w)) out.push(w); }
  return out;
}
// 지문 → 리더 페이지 [[문단,...], ...] (대괄호 제거)
function passageToPages(passage) {
  return (passage || '')
    .split(/\n\s*-{3,}\s*\n/)
    .map(pg => pg.split(/\n\s*\n/).map(p => stripBrackets(p.trim().replace(/\s*\n\s*/g, ' '))).filter(Boolean))
    .filter(pg => pg.length);
}
// 지문 → 복습 문단 [문단(대괄호 유지), ...] (페이지 구분 무시, 전체)
function passageToReview(passage) {
  return (passage || '')
    .replace(/\n\s*-{3,}\s*\n/g, '\n\n')
    .split(/\n\s*\n/).map(p => p.trim().replace(/\s*\n\s*/g, ' ')).filter(Boolean);
}

/* ---- 편집 모델 변환 (교사 편집기 공용) ---- */
// 저장형 Day → 편집형(폼)
function dayToEdit(day) {
  day = JSON.parse(JSON.stringify(day || {}));
  const quiz = {};
  Object.keys(QUIZ_META).forEach(cat => {
    quiz[cat] = ((day.quiz && day.quiz[cat]) || []).map(q => ({
      type: q.type || 'mc',
      prompt: q.prompt || '',
      sentence: q.sentence || '',
      options: (q.options || []).concat(['', '', '', '']).slice(0, 4),
      answer: q.answer || 0,
      accept: (q.accept || []).join(', '),
      explain: q.explain || ''
    }));
  });
  const passageText = dayPassage(day);
  const vdict = dayVocab(day);
  const words = scanVocab(passageText).map(w => ({ word: w, pos: (vdict[w] || {}).pos || '', def: (vdict[w] || {}).def || '', ex: (vdict[w] || {}).ex || '' }));
  return {
    date: day.date || _todayKey(),
    label: day.label || '',
    quote: Object.assign({ en: '', ko: '', teacher: '', comment: '' }, day.quote || {}),
    book: Object.assign({ title: '', author: '', chapter: '', cover: '' }, day.book || {}),
    passageText,
    words,
    quiz
  };
}
// 편집형(폼) → 저장형 Day
function editToDay(e) {
  const vocab = {};
  scanVocab(e.passageText).forEach(w => {
    const row = (e.words || []).find(x => x.word === w) || {};
    vocab[w] = { pos: (row.pos || '').trim(), def: (row.def || '').trim(), ex: (row.ex || '').trim() };
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
    date: e.date || _todayKey(),
    label: (e.label || '').trim(),
    quote: { en: e.quote.en.trim(), ko: e.quote.ko.trim(), teacher: e.quote.teacher.trim(), comment: e.quote.comment.trim() },
    book: { title: e.book.title.trim(), author: e.book.author.trim(), chapter: e.book.chapter.trim(), cover: (e.book.cover || '').trim() },
    passage: (e.passageText || '').trim(),
    vocab,
    quiz
  };
}
