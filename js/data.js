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
  sentence:  {name:'어법 복습', tag:'어법'},
  vocabPrep: {name:'어휘 예습', tag:'예습'},
  sentPrep:  {name:'문장 예습', tag:'예습'},
  grammar:   {name:'어법 퀴즈', tag:'어법'}
};

// [A/B] 고르기(어법) 문장 파싱: "She [was/were] happy." → {before,a,b,after,options}
function abParse(sentence) {
  const m = (sentence || '').match(/\[([^\]/]*)\/([^\]]*)\]/);
  if (!m) return { before: sentence || '', a: '', b: '', after: '', options: [] };
  return { before: sentence.slice(0, m.index), a: m[1].trim(), b: m[2].trim(), after: sentence.slice(m.index + m[0].length), options: [m[1].trim(), m[2].trim()] };
}

// 기본(내장) 콘텐츠 — 배포된 data/content.json이 없을 때 사용되는 예시 Day
const DEFAULT_CONTENT = {
  version: 1,
  // 학생 명단(이름 선택 화면) — 비워두면 이름 선택 없이 단일 프로필로 동작
  students: [],
  // 반 목록 — 학생이 가입할 때 여기서 반을 골라요(교사가 관리)
  classes: [],
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
        cover: '',
        spine: ''
      },
      // 지문(그날 읽을 전체 텍스트) — 문단은 빈 줄, 페이지는 --- , 팝오버 단어는 <꺾쇠>.
      // e-북 리더와 지문 복습이 모두 이 하나의 지문에서 나옵니다.
      passage:
        "The sea has always drawn people toward its edge, whispering of places no map has ever named.\n\n" +
        "For centuries, sailors spoke of a <restless> horizon — a line that seemed to <retreat> with every mile they gained, as if the ocean itself were guarding a secret.\n\n" +
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
function daySpine(day) { return (day && day.book && day.book.spine) || ''; }
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
// 팝오버 단어 표시(<꺾쇠>)를 벗겨 안쪽 단어만 남김. [대괄호]는 교사 자유 표기라 그대로 둠.
function stripBrackets(s) { return (s || '').replace(/<([^>]+)>/g, '$1'); }
// 본문 강조 마크업: **굵게** / ==노란 형광펜(핵심문장)== / %%파란 형광펜(문법)%% → HTML (입력은 이미 esc 처리된 문자열이어야 함)
function renderMarks(escaped, emColor) {
  return String(escaped == null ? '' : escaped)
    .replace(/==([^=]+)==/g, '<mark style="background:#ffe35c;color:#1a1a1a;padding:0 .14em;border-radius:.14em;box-decoration-break:clone;-webkit-box-decoration-break:clone">$1</mark>')
    .replace(/%%([^%]+)%%/g, '<mark style="background:#bcd7fb;color:#12324f;padding:0 .14em;border-radius:.14em;box-decoration-break:clone;-webkit-box-decoration-break:clone">$1</mark>')
    .replace(/\*\*([^*]+)\*\*/g, `<strong style="color:${emColor || '#e0483d'};font-weight:800">$1</strong>`);
}
// 마크업 기호(**, ==, %%) 제거 — 평문으로 보여줄 때
function stripMarks(s) { return String(s == null ? '' : s).replace(/==([^=]+)==/g, '$1').replace(/%%([^%]+)%%/g, '$1').replace(/\*\*([^*]+)\*\*/g, '$1'); }
// 형광펜/굵게(==, %%, **)가 문장 경계를 넘어갈 때, 각 문장이 스스로 열고 닫히도록 보정
// (문장 단위로 보여주는 지문 복습·발표에서 마크가 짝이 안 맞아 == 가 그대로 보이는 문제 해결)
function balanceMarks(sentences) {
  const marks = ['==', '%%', '**'];
  const open = { '==': false, '%%': false, '**': false };
  const count = (s, m) => { let n = 0, i = 0; while ((i = s.indexOf(m, i)) !== -1) { n++; i += m.length; } return n; };
  return sentences.map(s => {
    let out = '';
    marks.forEach(m => { if (open[m]) out += m; });   // 이전 문장에서 열린 마크 이어서 열기
    out += s;
    marks.forEach(m => { if (count(s, m) % 2 === 1) open[m] = !open[m]; });   // 이 문장에서의 토글 반영
    marks.forEach(m => { if (open[m]) out += m; });   // 아직 열려 있으면 이 문장 안에서 닫기
    // 경계에서 생긴 '닫고 바로 열기'(====, %%%%, ****)는 서로 상쇄 → 제거
    return out.replace(/====/g, '').replace(/%%%%/g, '').replace(/\*\*\*\*/g, '');
  });
}

/* =========================================================
 * 어려운 단어 자동 [ ] — 대략 A1~B1(흔한 단어)를 빼고, B2 이상으로 보이는 단어에 대괄호
 * (근사치: 빈도 기반 흔한 단어 목록 + 어미 제거로 판별. 편집기에서 손으로 수정 가능)
 * ========================================================= */
// 흔한(대략 A1~B1) 영단어 — 여기 없는 내용어를 '어려운 단어'로 봄
const CEFR_COMMON_WORDS = (
  // 기능어·대명사·전치사·접속사·조동사
  "i you he she it we they me him her us them my your his its our their mine yours hers ours theirs myself yourself himself herself itself ourselves themselves " +
  "this that these those who whom whose which what where when why how here there a an the some any no none every each all both half few little many much more most less least other another such same own several enough " +
  "am is are was were be been being have has had having do does did done doing will would shall should can could may might must ought need dare used get gets got gotten " +
  "of to in on at by for with from into onto up down out off over under above below across through between among around behind before after during since until till toward towards near beside besides against without within about along beyond upon inside outside " +
  "and or but so because if though although while as than then that whether unless once yet nor either neither also too very just only even still again ever never always often sometimes usually rarely almost quite rather really perhaps maybe indeed however therefore thus instead " +
  // 매우 흔한 동사(원형 위주)
  "go come get make take see know think say tell give find want use work call ask try leave put keep begin seem help talk turn start show hear play run move live believe bring happen write provide sit stand lose pay meet include continue set learn change lead understand watch follow stop create speak read allow add spend grow open walk win offer remember love consider appear buy wait serve die send build stay fall cut reach kill remain suggest raise pass sell decide return explain hope develop carry break receive agree support hit produce eat cover catch draw choose look feel become let mean seem need face bring join wear pick lay push wish drop plan rise report pull carry save fill hold sound speak listen touch smile laugh cry sleep wake dream walk climb jump swim throw kick clean wash cook drink taste smell hurt drive ride fly count check share visit follow point spell learn teach study answer question " +
  // 매우 흔한 명사
  "time year people way day man woman child boy girl kid baby friend family father mother parent sister brother son daughter husband wife man men woman women person life world thing part place case week month hour minute second morning afternoon evening night home house room door window wall floor school class student teacher book word name number letter page story question answer group team game money food water bread milk egg meat fish fruit rice tea coffee tree flower grass sky sun moon star rain snow wind fire sea river lake mountain hill road street city town country land air ground animal dog cat bird horse cow work job business company office market shop store car bus train bike plane boat body head hand arm leg foot eye ear nose mouth face hair heart mind idea reason fact point kind sort side end top bottom front back left right color light dark sound voice music art color paper pen table chair bed bag box key ball toy clock phone computer picture film movie news paper problem answer help love hope feeling matter thing stuff " +
  // 매우 흔한 형용사·부사
  "good bad big small large little long short high low old new young early late fast slow hot cold warm cool easy hard difficult simple clear right wrong true false real full empty happy sad angry afraid tired sick well ill nice kind mean fair free busy quiet loud clean dirty rich poor strong weak heavy light soft dark light bright important great sure ready able open close near far deep wide narrow thick thin round flat straight sharp quick sweet sour salt bitter fresh whole main same other next last first second third final only own such certain sorry glad " +
  // 색·숫자·시간·요일·달·계절
  "red blue green yellow black white brown orange pink purple gray grey gold silver " +
  "one two three four five six seven eight nine ten eleven twelve thirteen fourteen fifteen sixteen seventeen eighteen nineteen twenty thirty forty fifty sixty seventy eighty ninety hundred thousand million zero first second third once twice " +
  "today tomorrow yesterday now soon later monday tuesday wednesday thursday friday saturday sunday january february march april may june july august september october november december spring summer autumn fall winter week weekend month year season " +
  "yes no ok okay please thanks thank sorry hello hi bye goodbye mr mrs ms miss sir madam " +
  // 흔한 일상·자연·장소·이야기 단어(아동 도서 빈출)
  "ocean wave beach shore sand shell ship sail boat storm cloud sky rock stone hill field forest wood garden park farm village castle bridge gate path grass leaf branch root seed plant bush pond stream valley cave island desert jungle cliff shore " +
  "king queen prince princess knight giant dragon witch fairy monster ghost magic wizard sword crown gold treasure map ring bell drum horn " +
  "morning noon midnight sunrise sunset shadow light candle lamp fire smoke ash dust mud ice snow rain wind thunder lightning rainbow " +
  "smile laugh cry shout whisper nod wave point wink stare frown yawn sigh " +
  "happy sad angry scared afraid brave kind cruel wise silly lazy busy lonely proud shy calm gentle wild quiet loud strange funny scary lovely pretty ugly clever foolish " +
  "run walk jump climb crawl swim fly float sink dive slide roll spin bounce chase hide seek follow lead carry drag lift drop toss grab hold squeeze knock tap kick push pull " +
  "breakfast lunch dinner supper meal cake pie soup bean corn nut honey sugar salt butter cheese cream jam candy sweet " +
  "sheep goat pig hen duck goose rabbit mouse rat frog snake fox wolf bear deer lion tiger monkey elephant whale shark bee ant fly spider worm bird fish " +
  "hat coat shirt dress skirt sock shoe boot glove scarf button pocket cap ribbon " +
  "wall roof gate fence yard garden kitchen bedroom bathroom stair step chimney basement attic cottage cabin hut palace tower " +
  "north south east west left right front back top bottom middle corner edge side inside outside upstairs downstairs " +
  "week hour clock watch calendar birthday holiday party gift present card game toy doll ball kite balloon " +
  "loud soft quiet gentle rough smooth sharp bright dark deep shallow empty full heavy light tiny huge giant round square flat curved straight " +
  "voice sound noise word name letter story song poem tale rhyme dream wish secret promise plan trick joke lie truth " +
  // 흔한 불규칙 과거·과거분사(어미 제거로 못 잡는 것)
  "was were been had said made went gone got gotten came come saw seen knew known took taken gave given found told thought became begun began ran run met paid held kept meant sat stood lost sent built spent sold heard read put cut set let grew grown drew drawn threw thrown flew flown chose chosen spoke spoken broke broken woke drove driven rode ridden rose risen fell fallen felt dealt bought caught taught fought sought brought understood won did done left brought wrote written swam swum sang sung rang rung drank drunk swore worn wore ate eaten fed led hid hidden shone shut spread struck stuck bit bitten"
).split(/\s+/).filter(Boolean).reduce((s, w) => (s.add(w), s), new Set());

// 어미를 제거한 후보들로 흔한 단어인지 판별
function _stemCandidates(w) {
  const c = [w];
  const add = x => { if (x && x.length >= 2) c.push(x); };
  if (/'s$/.test(w)) add(w.slice(0, -2));
  if (/ies$/.test(w)) add(w.slice(0, -3) + 'y');
  if (/(ches|shes|sses|xes|zes|oes)$/.test(w)) add(w.slice(0, -2));
  if (/es$/.test(w)) add(w.slice(0, -2));
  if (/s$/.test(w)) add(w.slice(0, -1));
  if (/ied$/.test(w)) add(w.slice(0, -3) + 'y');
  if (/ed$/.test(w)) { add(w.slice(0, -2)); add(w.slice(0, -1)); if (w.length > 4 && w[w.length - 3] === w[w.length - 4]) add(w.slice(0, -3)); }
  if (/ing$/.test(w)) { add(w.slice(0, -3)); add(w.slice(0, -3) + 'e'); if (w.length > 5 && w[w.length - 4] === w[w.length - 5]) add(w.slice(0, -4)); }
  if (/ily$/.test(w)) add(w.slice(0, -3) + 'y');
  if (/ly$/.test(w)) add(w.slice(0, -2));
  if (/ier$/.test(w)) add(w.slice(0, -3) + 'y');
  if (/iest$/.test(w)) add(w.slice(0, -4) + 'y');
  if (/er$/.test(w)) { add(w.slice(0, -2)); add(w.slice(0, -1)); }
  if (/est$/.test(w)) { add(w.slice(0, -3)); add(w.slice(0, -2)); }
  return c;
}
function isCommonWord(w) {
  w = (w || '').toLowerCase().replace(/[’']/g, "'");
  if (!w) return true;
  return _stemCandidates(w).some(x => CEFR_COMMON_WORDS.has(x));
}
// 불규칙 원형(자주 나오는 것만) — 표제어 자동 원형화용
const _IRREG_LEMMA = {
  was: 'be', were: 'be', been: 'be', 'being': 'be', is: 'be', are: 'be', am: 'be',
  had: 'have', has: 'have', having: 'have', went: 'go', gone: 'go', going: 'go',
  did: 'do', done: 'do', made: 'make', making: 'make', said: 'say', took: 'take', taken: 'take', taking: 'take',
  came: 'come', coming: 'come', saw: 'see', seen: 'see', seeing: 'see', knew: 'know', known: 'know',
  got: 'get', gotten: 'get', getting: 'get', gave: 'give', given: 'give', giving: 'give',
  found: 'find', finding: 'find', told: 'tell', telling: 'tell', thought: 'think', thinking: 'think',
  became: 'become', becoming: 'become', ran: 'run', running: 'run', met: 'meet', meeting: 'meet',
  paid: 'pay', held: 'hold', holding: 'hold', kept: 'keep', keeping: 'keep', left: 'leave', leaving: 'leave',
  built: 'build', building: 'build', spent: 'spend', sold: 'sell', selling: 'sell', heard: 'hear', hearing: 'hear',
  felt: 'feel', feeling: 'feel', dealt: 'deal', bought: 'buy', buying: 'buy', caught: 'catch', catching: 'catch',
  taught: 'teach', teaching: 'teach', fought: 'fight', sought: 'seek', brought: 'bring', bringing: 'bring',
  wrote: 'write', written: 'write', writing: 'write', swam: 'swim', swimming: 'swim', sang: 'sing', singing: 'sing',
  rang: 'ring', drank: 'drink', drinking: 'drink', spoke: 'speak', spoken: 'speak', speaking: 'speak',
  broke: 'break', broken: 'break', breaking: 'break', drove: 'drive', driven: 'drive', driving: 'drive',
  rode: 'ride', riding: 'ride', rose: 'rise', rising: 'rise', fell: 'fall', fallen: 'fall', falling: 'fall',
  ate: 'eat', eaten: 'eat', eating: 'eat', led: 'lead', leading: 'lead', fed: 'feed', hid: 'hide', hidden: 'hide', hiding: 'hide',
  struck: 'strike', striking: 'strike', stuck: 'stick', bit: 'bite', biting: 'bite', lying: 'lie',
  children: 'child', men: 'man', women: 'woman', feet: 'foot', teeth: 'tooth', mice: 'mouse',
  people: 'person', lives: 'life', knives: 'knife', wolves: 'wolf', leaves: 'leaf', shelves: 'shelf'
};
// 영단어 원형(표제어) 추정 — 규칙 기반 근사(불완전). 팝오버/단어장 표시용, 교사가 수정 가능.
function lemmatize(word) {
  const w = String(word == null ? '' : word).trim();
  if (!w || /\s/.test(w) || w.length < 3 || /[^A-Za-z'’-]/.test(w)) return '';
  const lower = w.toLowerCase().replace(/[’]/g, "'");
  const cap = /^[A-Z]/.test(w);
  const R = b => cap ? b.charAt(0).toUpperCase() + b.slice(1) : b;
  if (Object.prototype.hasOwnProperty.call(_IRREG_LEMMA, lower)) return R(_IRREG_LEMMA[lower]);
  const dbl = s => (s.length >= 3 && s[s.length - 1] === s[s.length - 2] && !/[aeiou]/.test(s[s.length - 1])) ? s.slice(0, -1) : s;
  let base = null;
  if (/ies$/.test(lower)) base = lower.slice(0, -3) + 'y';
  else if (/ied$/.test(lower)) base = lower.slice(0, -3) + 'y';
  else if (/(ches|shes|sses|xes|zzes|zes)$/.test(lower)) base = lower.slice(0, -2);
  else if (/ing$/.test(lower)) base = dbl(lower.slice(0, -3));
  else if (/ed$/.test(lower)) base = dbl(lower.slice(0, -2));
  else if (/s$/.test(lower) && !/(ss|us|is|ous)$/.test(lower)) base = lower.slice(0, -1);
  if (!base || base === lower || base.length < 2) return '';
  return R(base);
}
// 지문을 토큰으로 분해([단어]·마크업·낱말·기타 보존)
function _passageTokens(text) {
  const re = /(<[^>]*>)|(\*\*|==|%%)|([A-Za-z]+(?:['’][A-Za-z]+)?)|([^A-Za-z]+)/g;
  const toks = []; let m;
  while ((m = re.exec(text)) !== null) {
    if (m[1] != null) toks.push({ t: 'br', v: m[1] });
    else if (m[2] != null) toks.push({ t: 'mk', v: m[2] });
    else if (m[3] != null) toks.push({ t: 'w', v: m[3] });
    else toks.push({ t: 'o', v: m[4] });
  }
  return toks;
}
// 지문에서 B2 이상으로 보이는 단어를 [ ]로 감싸기 (이미 [ ]·고유명사·흔한 단어·짧은 단어는 제외)
function autoBracketHard(text) {
  const toks = _passageTokens(String(text || ''));
  // 문장 시작 여부(고유명사 판별용)
  let atStart = true; const flags = [];
  toks.forEach(tk => {
    if (tk.t === 'w') { flags.push(atStart); atStart = false; }
    else if (tk.t === 'br') atStart = false;
    else if (tk.t === 'o') { if (/[.!?]/.test(tk.v)) atStart = true; }
  });
  // 문장 중간에 대문자로 나오는 낱말 = 고유명사(이름 등) → 어디서든 제외
  const proper = new Set(); let wi = 0;
  toks.forEach(tk => {
    if (tk.t !== 'w') return;
    const st = flags[wi++];
    if (!st && /^[A-Z]/.test(tk.v) && !/^[A-Z]+$/.test(tk.v)) proper.add(tk.v.toLowerCase());
  });
  wi = 0;
  return toks.map(tk => {
    if (tk.t !== 'w') return tk.v;
    const st = flags[wi++]; const w = tk.v;
    if (w.length < 4) return w;                      // 짧은 단어는 대체로 쉬움
    if (/^[A-Z]+$/.test(w)) return w;                // 전부 대문자(약어·제목)
    if (proper.has(w.toLowerCase())) return w;       // 반복되는 고유명사
    if (/^[A-Z]/.test(w) && !st) return w;           // 문장 중간 대문자(고유명사)
    if (isCommonWord(w)) return w;                   // 흔한 단어(A1~B1)
    return '<' + w + '>';
  }).join('');
}
// 지문에서 <단어> 토큰을 순서대로(중복 제거) 뽑기
function scanVocab(text) {
  const out = []; const re = /<([^>]+)>/g; let m;
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
// 지문 → 리더 페이지 (대괄호 [단어] 유지 — 버닝 팝오버용)
function passageToPagesRaw(passage) {
  return (passage || '')
    .split(/\n\s*-{3,}\s*\n/)
    .map(pg => pg.split(/\n\s*\n/).map(p => p.trim().replace(/\s*\n\s*/g, ' ')).filter(Boolean))
    .filter(pg => pg.length);
}
// 지문 → 복습 문단 [문단(대괄호 유지), ...] (페이지 구분 무시, 전체)
function passageToReview(passage) {
  return (passage || '')
    .replace(/\n\s*-{3,}\s*\n/g, '\n\n')
    .split(/\n\s*\n/).map(p => p.trim().replace(/\s*\n\s*/g, ' ')).filter(Boolean);
}
// 지문 → 문장 배열 ([단어] 토큰 유지 — 지문 복습 팝오버용). 문단 순서 유지.
function passageToReviewSentences(passage) {
  const out = [];
  passageToReview(passage).forEach(para => {
    const p = (para || '').trim();
    if (!p) return;
    const parts = p.match(/[^.!?…]+(?:[.!?…]+["'”’)\]]*|$)/g);
    if (parts) parts.forEach(s => { const t = s.trim(); if (t) out.push(t); });
    else out.push(p);
  });
  return out;
}
// 지문 → 문장 배열 (수업용 전체화면 발표: 한 화면에 한 문장). 대괄호 제거, 문단 순서 유지.
function passageToSentences(passage) {
  const out = [];
  passageToReview(passage).forEach(para => {
    const p = stripBrackets(para).trim();
    if (!p) return;
    // 종결부호(. ! ? …)로 문장 분리 + 뒤따르는 따옴표/괄호 포함, 마지막 미종결 조각도 포함
    const parts = p.match(/[^.!?…]+(?:[.!?…]+["'”’)\]]*|$)/g);
    if (parts) parts.forEach(s => { const t = s.trim(); if (t) out.push(t); });
    else out.push(p);
  });
  return out;
}

/* ---- 편집 모델 변환 (교사 편집기 공용) ---- */
// 저장형 Day → 편집형(폼)
// 저장형 퀴즈 문항 1개 → 편집형(폼)
function quizItemToEdit(q) {
  q = q || {};
  return {
    type: q.type || 'mc',
    prompt: q.prompt || '',
    sentence: q.sentence || '',
    options: (q.options || []).concat(['', '', '', '']).slice(0, 4),
    answer: q.answer || 0,
    accept: (q.accept || []).join(', '),
    wrong: q.wrong != null ? q.wrong : -1,            // 오류 고치기: 틀린 단어 인덱스
    chunksText: (q.chunks || []).join(' / '),          // Scramble: 조각(정답 순서)
    ko: q.ko || '',                                    // Scramble: 우리말 뜻(먼저 보여주고 배열)
    explain: q.explain || ''
  };
}
// 편집형(폼) 퀴즈 문항 1개 → 저장형(유효하지 않으면 null)
function quizItemToSaved(q) {
  if (!((q.prompt || '').trim() || (q.sentence || '').trim())) return null;
  const base = { type: q.type, prompt: (q.prompt || '').trim(), explain: (q.explain || '').trim() };
  if ((q.sentence || '').trim()) base.sentence = q.sentence.trim();
  if (q.type === 'mc') {
    base.options = q.options.map(o => (o || '').trim()).filter(Boolean);
    base.answer = Math.min(Math.max(0, Number(q.answer) || 0), Math.max(0, base.options.length - 1));
  } else if (q.type === 'ab' || q.type === 'ox') {
    base.answer = Math.min(1, Math.max(0, Number(q.answer) || 0));   // ab: 0=A/1=B · ox: 0=O(참)/1=X(거짓)
  } else if (q.type === 'fix') {
    base.wrong = Number(q.wrong);   // 틀린 단어 인덱스
    base.accept = (q.accept || '').split(',').map(a => a.trim()).filter(Boolean);
  } else if (q.type === 'scramble') {
    base.chunks = (q.chunksText || '').split('/').map(c => c.trim()).filter(Boolean);
    if ((q.ko || '').trim()) base.ko = q.ko.trim();   // 우리말 뜻(있으면 학생에게 먼저 보여줌)
  } else if (q.type === 'free') {
    // 자유형: 정답 없음 — 문제(prompt)만 있으면 됨
  } else {
    base.accept = (q.accept || '').split(',').map(a => a.trim()).filter(Boolean);
  }
  const ok = base.type === 'mc' ? base.options.length >= 2
    : base.type === 'ab' ? /\[[^\]/]*\/[^\]]*\]/.test(base.sentence || '')
      : base.type === 'ox' ? (base.prompt || '').trim().length > 0
        : base.type === 'fix' ? ((base.sentence || '').trim() && base.accept.length >= 1 && base.wrong >= 0)
          : base.type === 'scramble' ? base.chunks.length >= 2
            : base.type === 'free' ? (base.prompt || '').trim().length > 0
              : base.accept.length >= 1;
  return ok ? base : null;
}
function dayToEdit(day) {
  day = JSON.parse(JSON.stringify(day || {}));
  const quiz = {};
  Object.keys(QUIZ_META).forEach(cat => {
    quiz[cat] = ((day.quiz && day.quiz[cat]) || []).map(quizItemToEdit);
  });
  const passageText = dayPassage(day);
  const vdict = dayVocab(day);
  const words = scanVocab(passageText).map(w => ({ word: w, head: (vdict[w] || {}).head || '', pos: (vdict[w] || {}).pos || '', def: (vdict[w] || {}).def || '', ex: (vdict[w] || {}).ex || '' }));
  return {
    date: day.date || _todayKey(),
    label: day.label || '',
    classTarget: day.class || '',   // 대상 반('' = 공통/전체)
    reviewFrom: day.reviewFrom || '', reviewTo: day.reviewTo || '',     // 복습 문제 공개 기간(비우면 지문 날짜 기준)
    previewFrom: day.previewFrom || '', previewTo: day.previewTo || '',  // 예습 문제 공개 기간
    shelfHidden: !!day.shelfHidden,   // 서가 미공개(체크 시 학생 서가에서 숨김)
    quote: Object.assign({ en: '', ko: '', teacher: '', comment: '' }, day.quote || {}),
    book: Object.assign({ title: '', author: '', chapter: '', cover: '', spine: '' }, day.book || {}),
    passageText,
    words,
    // 핵심 문장(리치): 저장값이 있으면 그걸, 없으면 빈 배열(자동생성은 학생 화면에서만)
    core: (day.coreSentences && day.coreSentences.length)
      ? day.coreSentences.map(normCore)
      : (day.previewCore || []).map(t => normCore({ text: t })),
    quiz
  };
}
// 편집형(폼) → 저장형 Day
function editToDay(e) {
  const vocab = {};
  scanVocab(e.passageText).forEach(w => {
    const row = (e.words || []).find(x => x.word === w) || {};
    vocab[w] = { pos: (row.pos || '').trim(), def: (row.def || '').trim(), ex: (row.ex || '').trim() };
    const head = (row.head || '').trim();
    if (head && head !== w) vocab[w].head = head;   // 표제어(외울 형태) — 지문 단어와 다를 때만 저장
  });
  const quiz = {};
  Object.keys(QUIZ_META).forEach(cat => {
    quiz[cat] = (e.quiz[cat] || []).map(quizItemToSaved).filter(Boolean);
  });
  // 핵심 문장(리치): 빈 문장 제거, 마크 인덱스는 현재 단어 수 범위로 정리
  const coreSentences = (e.core || []).map(c => {
    const n = normCore(c);
    const cnt = n.text.split(/\s+/).filter(Boolean).length;
    const clamp = a => a.filter(x => x >= 0 && x < cnt);
    return { text: n.text, subject: clamp(n.subject), verb: clamp(n.verb), bold: clamp(n.bold), italic: clamp(n.italic), ko: n.ko };
  }).filter(c => c.text);
  const out = {
    date: e.date || _todayKey(),
    label: (e.label || '').trim(),
    quote: { en: e.quote.en.trim(), ko: e.quote.ko.trim(), teacher: e.quote.teacher.trim(), comment: e.quote.comment.trim() },
    book: { title: e.book.title.trim(), author: e.book.author.trim(), chapter: e.book.chapter.trim(), cover: (e.book.cover || '').trim(), spine: (e.book.spine || '').trim() },
    passage: (e.passageText || '').trim(),
    vocab,
    coreSentences,
    quiz
  };
  const cls = (e.classTarget || '').trim();
  if (cls) out.class = cls;   // 대상 반이 있으면 저장('' 공통은 필드 생략)
  ['reviewFrom', 'reviewTo', 'previewFrom', 'previewTo'].forEach(k => {
    const v = (e[k] || '').trim();
    if (v) out[k] = v;   // 공개 기간(비우면 필드 생략 → 지문 날짜 기준 폴백)
  });
  if (e.shelfHidden) out.shelfHidden = true;   // 서가 미공개
  return out;
}

/* ---- 지문 예습 3단계 헬퍼 ---- */
// 핵심 문장 1개 정규화: {text, subject[], verb[], bold[], italic[], ko}
function normCore(c) {
  c = c || {};
  return {
    text: (c.text || '').trim(),
    subject: Array.isArray(c.subject) ? c.subject.slice() : [],
    verb: Array.isArray(c.verb) ? c.verb.slice() : [],
    bold: Array.isArray(c.bold) ? c.bold.slice() : [],
    italic: Array.isArray(c.italic) ? c.italic.slice() : [],
    ko: (c.ko || '').trim()
  };
}
// 핵심 문장(리치): 교사가 지정한 coreSentences → 구버전 previewCore → 지문 앞 문장 6개
function dayCoreSentencesRich(day) {
  if (day && Array.isArray(day.coreSentences) && day.coreSentences.length) return day.coreSentences.map(normCore).filter(c => c.text);
  if (day && Array.isArray(day.previewCore) && day.previewCore.length) return day.previewCore.map(t => normCore({ text: t }));
  const plain = stripBrackets(passageToReview(dayPassage(day)).join(' '));
  const sents = plain.match(/[^.!?]+[.!?]+/g) || (plain ? [plain] : []);
  return sents.map(s => s.trim()).filter(Boolean).slice(0, 6).map(t => normCore({ text: t }));
}
// 보통 난이도 핵심 문장(텍스트만) — 기존 호출부 호환
function dayCoreSentences(day) { return dayCoreSentencesRich(day).map(c => c.text); }
// 살살 난이도 어휘 카드: [{word,pos,def,ex}]
function dayVocabCards(day) {
  const v = dayVocab(day);
  return Object.keys(v).map(w => Object.assign({ word: w }, v[w]));
}
