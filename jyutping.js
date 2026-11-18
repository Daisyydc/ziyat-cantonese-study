/* 粵拼入門模塊：路由 #jp-*、存儲 v2、判分、SRS、頁面渲染。
 * 與舊 app.js 並行掛載：舊路由走舊 render（app.js 已打補丁對 jp-* 直接 return）。
 * 全程 IIFE，避免與舊 app.js 的全局聲明衝突；可測邏輯掛在 window.JP。
 */
(function () {
  'use strict';

  /* ================= 純函數核心（零 DOM） ================= */
  var KEY = 'ziyat-study-v2';
  var PREBK_KEY = 'ziyat-study-v2-prebk';
  var INTERVALS = [1, 2, 4, 7, 14];
  var DAY = 86400000;
  var MAX_ATTEMPTS = 1500;
  var PRACTICE_BATCH = 10;
  var PRACTICE_MIN_DONE = 10;

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function qById(id) {
    for (var i = 0; i < JPDATA.questions.length; i++) {
      if (JPDATA.questions[i].id === id) return JPDATA.questions[i];
    }
    return null;
  }

  function normJyutping(s) {
    return String(s || '').normalize('NFKC').toLowerCase()
      .replace(/[\s　]+/g, '').replace(/[^a-z0-9]/g, '');
  }

  /* 中文答案歸一：去空白與中英文標點，保留漢字/字母/數字 */
  function normSentence(s) {
    return String(s || '').normalize('NFKC')
      .replace(/[\s　，。！？、；：「」『』（）《》〈〉,.!?;:'"“”‘’—…·\-~～]/g, '')
      .toLowerCase();
  }

  /* 客觀判分：文本題全等（含聲調數字）；分項題容許輸入多餘數字；MCQ 比選項文本；
     打字題（typing-*）按整句歸一後對任一參考答案判分（標點空格不判錯） */
  function gradeQuestion(q, answer) {
    if (!q) return false;
    var a = String(answer == null ? '' : answer).trim();
    if (q.type === 'mcq') return a === String((q.acceptedAnswers || [])[0] || '').trim();
    if (q.id.indexOf('typing-') === 0) {
      var ans = normSentence(a);
      for (var i = 0; i < (q.acceptedAnswers || []).length; i++) {
        if (ans === normSentence(q.acceptedAnswers[i])) return true;
      }
      return false;
    }
    var input = normJyutping(a);
    var expected = normJyutping((q.acceptedAnswers || [])[0] || '');
    if (q.id.indexOf('jp-initial:') === 0 || q.id.indexOf('jp-final:') === 0) {
      return input.replace(/\d/g, '') === expected.replace(/\d/g, '');
    }
    if (q.id.indexOf('jp-tone:') === 0) {
      var digits = input.match(/\d/g);
      return digits ? digits.join('') === expected.slice(-1) : false;
    }
    return input === expected;
  }

  /* ================= 存儲 v2 ================= */
  function defaultState() {
    return {
      schemaVersion: 2, settings: { audio: true },
      lessons: {}, attempts: [], knowledge: {}, legacy: null, lastRoute: 'jp-map',
    };
  }
  var state = defaultState();

  function saveV2() {
    try { localStorage.setItem(KEY, JSON.stringify(state)); return true; }
    catch (e) { return false; }
  }

  function loadV2() {
    var raw = null;
    try { raw = localStorage.getItem(KEY); } catch (e) { }
    if (raw) {
      try {
        var s = JSON.parse(raw);
        if (s && s.schemaVersion === 2) state = Object.assign(defaultState(), s);
      } catch (e) { }
    } else {
      migrateFromV1();
    }
    return state;
  }

  /* v1 只讀遷移：快照舊進度為 legacy，絕不寫 v1 key、不生成 knowledge */
  function migrateFromV1() {
    if (state.legacy && state.legacy.importedAt) return state;
    var v1 = null;
    try { v1 = JSON.parse(localStorage.getItem('ziyat-study-v1')); } catch (e) { }
    if (!v1 || typeof v1 !== 'object') return state;
    var done = 0, mastered = [];
    Object.keys(v1.lessons || {}).forEach(function (k) {
      if (v1.lessons[k] && v1.lessons[k].done) done++;
    });
    Object.keys(v1.chars || {}).forEach(function (t) {
      if (v1.chars[t] && v1.chars[t].status === 'mastered') mastered.push(t);
    });
    state.legacy = {
      importedAt: new Date().toISOString(), sourceKey: 'ziyat-study-v1',
      lessonsCompleted: done, masteredChars: mastered,
      activityDays: (v1.activity || []).length,
      note: '原站進度僅供展示，不計入粵拼掌握',
    };
    saveV2();
    return state;
  }

  function lessonRec(id) {
    if (!state.lessons[id]) {
      state.lessons[id] = {
        status: 'not_started', lastVisitedAt: null, lastPosition: 'goal',
        startedAt: null, completedAt: null,
        steps: { cardsSeen: [], practiceAnswered: [], selfAssessed: false, quizSubmitted: false },
      };
    }
    return state.lessons[id];
  }

  function sameDay(isoA, isoB) {
    return String(isoA || '').slice(0, 10) === String(isoB || '').slice(0, 10);
  }

  /* SRS：練習只 unseen→learning；小測/複習首答對推進間隔，答錯重置，重考不計掌握 */
  function applyAnswer(target, rec, now) {
    now = now || Date.now();
    var prev = target.attempts.filter(function (a) {
      return a.questionId === rec.questionId && a.lessonId === rec.lessonId &&
        a.assessmentMode === rec.assessmentMode && sameDay(a.submittedAt, rec.submittedAt);
    });
    rec.attemptCount = prev.length + 1;
    rec.firstAnswerCorrect = rec.attemptCount === 1 && rec.correct;
    target.attempts.push(rec);
    if (target.attempts.length > MAX_ATTEMPTS) target.attempts = target.attempts.slice(-MAX_ATTEMPTS);

    var q = qById(rec.questionId);
    var kids = q ? (q.knowledgeIds || []) : [];
    kids.forEach(function (kid) {
      var k = target.knowledge[kid] || (target.knowledge[kid] = {
        proficiency: 'unseen', nextReviewAt: null, intervalDays: 0,
        correctCount: 0, consecutive: 0, lastPracticedAt: null,
      });
      k.lastPracticedAt = rec.submittedAt;
      if (rec.assessmentMode === 'practice') {
        if (k.proficiency === 'unseen') k.proficiency = 'learning';
        if (rec.correct === false) {
          /* 練習答錯 → 加入次日複習隊列（錯題） */
          k.nextReviewAt = new Date(now + DAY).toISOString();
          k.intervalDays = 1;
        }
        return;
      }
      if (rec.correct === false) {
        k.consecutive = 0; k.intervalDays = 1;
        k.nextReviewAt = new Date(now + DAY).toISOString();
        k.proficiency = 'learning';
      } else if (rec.firstAnswerCorrect) {
        k.consecutive = (k.consecutive || 0) + 1;
        k.correctCount = (k.correctCount || 0) + 1;
        k.intervalDays = INTERVALS[Math.min(k.consecutive - 1, INTERVALS.length - 1)];
        k.nextReviewAt = new Date(now + k.intervalDays * DAY).toISOString();
        k.proficiency = k.consecutive >= 3 ? 'mastered' : 'learning';
      }
      /* 重考答對（attemptCount>1）：不推進也不重置 */
    });
    return target;
  }

  /* 「到期」為派生態 */
  function dueKnowledge(now) {
    now = now || Date.now();
    var nowIso = new Date(now).toISOString();
    return Object.keys(state.knowledge)
      .filter(function (id) {
        var k = state.knowledge[id];
        return k.proficiency !== 'unseen' && k.nextReviewAt && k.nextReviewAt <= nowIso;
      })
      .sort(function (a, b) { return state.knowledge[a].nextReviewAt < state.knowledge[b].nextReviewAt ? -1 : 1; });
  }

  function buildKnowledgeIndex() {
    var idx = {};
    var sorted = JPDATA.questions.slice().sort(function (a, b) {
      return (a.reviewStatus === 'approved' ? 0 : 1) - (b.reviewStatus === 'approved' ? 0 : 1);
    });
    sorted.forEach(function (q) {
      (q.knowledgeIds || []).forEach(function (kid) {
        (idx[kid] = idx[kid] || []).push(q.id);
      });
    });
    return idx;
  }

  /* 小測抽題：只取 approved（防禦性雙保險），>5 題時以 課+日 為種子抽 5 題 */
  function selectQuizQuestions(lessonId) {
    var lesson = null;
    JPDATA.lessons.forEach(function (l) { if (l.id === lessonId) lesson = l; });
    if (!lesson) return [];
    var pool = lesson.quizQuestionIds.map(qById)
      .filter(function (q) { return q && q.reviewStatus === 'approved'; });
    if (pool.length <= 5) return pool;
    var seedStr = lessonId + '|' + new Date().toISOString().slice(0, 10);
    var h = 0;
    for (var i = 0; i < seedStr.length; i++) h = (h * 31 + seedStr.charCodeAt(i)) >>> 0;
    function rnd() { h = (h * 1664525 + 1013904223) >>> 0; return h / 4294967296; }
    var arr = pool.slice();
    for (var j = arr.length - 1; j > 0; j--) {
      var k = Math.floor(rnd() * (j + 1));
      var tmp = arr[j]; arr[j] = arr[k]; arr[k] = tmp;
    }
    return arr.slice(0, 5);
  }

  /* 完成判定：卡看過 + 練習達標 + 自評 +（有測則）測已交；完成 ≠ 掌握 */
  function checkCompletion(lessonId) {
    var lesson = null;
    JPDATA.lessons.forEach(function (l) { if (l.id === lessonId) lesson = l; });
    if (!lesson) return false;
    var r = lessonRec(lessonId);
    var st = r.steps;
    var cardsDone = lesson.knowledgeCardIds.every(function (c) { return st.cardsSeen.indexOf(c) >= 0; }) &&
      (lesson.knowledgeCardIds.length === 0 || st.cardsSeen.length > 0);
    var need = Math.min(lesson.practiceQuestionIds.length || 0, PRACTICE_MIN_DONE);
    var practiceDone = st.practiceAnswered.length >= need;
    var quizDone = lesson.quizQuestionIds.length === 0 || st.quizSubmitted;
    if (cardsDone && practiceDone && st.selfAssessed && quizDone) {
      r.status = 'completed';
      if (!r.completedAt) r.completedAt = new Date().toISOString();
    }
    saveV2();
    return r.status === 'completed';
  }

  /* 導入校驗：任一失敗零改動 */
  function validateImport(obj) {
    if (!obj || typeof obj !== 'object') return { ok: false, reason: '檔案不是物件' };
    if (obj.app !== 'ziyat-jp' || obj.schemaVersion !== 2)
      return { ok: false, reason: '不是本應用第 2 版備份，或版本不符' };
    var s = obj.state;
    if (!s || typeof s !== 'object') return { ok: false, reason: '缺少 state' };
    if (typeof s.lessons !== 'object' || s.lessons === null) return { ok: false, reason: 'state.lessons 無效' };
    if (typeof s.knowledge !== 'object' || s.knowledge === null) return { ok: false, reason: 'state.knowledge 無效' };
    if (!Array.isArray(s.attempts)) return { ok: false, reason: 'state.attempts 無效' };
    for (var i = 0; i < s.attempts.length; i++) {
      var a = s.attempts[i];
      if (!a || typeof a.questionId !== 'string' || typeof a.submittedAt !== 'string' ||
        ['practice', 'quiz', 'review'].indexOf(a.assessmentMode) < 0)
        return { ok: false, reason: 'attempts 記錄缺少必要字段' };
    }
    for (var kid in s.knowledge) {
      var k = s.knowledge[kid];
      if (!k || ['unseen', 'learning', 'mastered'].indexOf(k.proficiency) < 0)
        return { ok: false, reason: 'knowledge 狀態無效' };
    }
    return { ok: true };
  }

  function exportJSON() {
    return { app: 'ziyat-jp', schemaVersion: 2, exportedAt: new Date().toISOString(), state: state };
  }

  /* ================= 路由 ================= */
  function parseHash() {
    var h = (location.hash || '').slice(1);
    if (h.indexOf('jp-lesson/') === 0) return { name: 'jp-lesson', arg: h.slice('jp-lesson/'.length) };
    if (h.indexOf('jp-typing/') === 0) return { name: 'jp-typing', arg: h.slice('jp-typing/'.length) };
    if (h.indexOf('jp-') === 0) return { name: h, arg: null };
    return { name: null, arg: null };
  }

  var lastLessonId = null;
  var practiceBatch = 0;
  var quizFeedback = null;
  var reviewQueue = null;
  var reviewIndex = -1;
  var reviewFeedback = null;

  /* ================= 視圖 ================= */

  function audioBtn(jp, label) {
    var path = JPDATA.audio.files[jp];
    if (!path) return '<span class="noaudio">（無音頻）' + esc(label) + '</span>';
    if (state.settings.audio === false) return '<span class="muted">' + esc(label) + '</span>';
    return '<button type="button" class="audiobtn" data-audio="' + esc(path) + '"' +
      ' aria-label="播放合成音 ' + esc(jp) + '（' + esc(label) + '）">▶ ' + esc(label) + '</button>';
  }

  function syntheticBanner() {
    return '<div class="notice jp-banner">音頻為 <b>TTS 合成音</b>（Cantone，MIT），僅供跟讀，不作精確辨音考試。</div>';
  }

  function stepBar(id) {
    var r = lessonRec(id);
    var steps = ['goal', 'cards', 'practice', 'paper', 'quiz', 'summary'];
    var labels = { goal: '目標', cards: '知識卡', practice: '練習', paper: '紙筆', quiz: '小測', summary: '總結' };
    return '<div class="steps">' + steps.map(function (s) {
      return '<span class="' + (r.lastPosition === s ? 'now' : '') + '">' + labels[s] + '</span>';
    }).join('') + '</div>';
  }

  function homeView() {
    var due = dueKnowledge().length;
    var cont = null, contRec = null;
    JPDATA.lessons.forEach(function (l) {
      var r = state.lessons[l.id];
      if (!r) return;
      if (r.status !== 'completed' && (!contRec || (r.lastVisitedAt || '') > (contRec.lastVisitedAt || ''))) {
        cont = l; contRec = r;
      }
    });
    var contHtml = cont
      ? '<section class="panel jp-continue"><h3>繼續上次學習</h3><p>' + esc(cont.title) +
        '<span class="muted"> · ' + (contRec.lastPosition === 'goal' ? '開始新課' : '上次到「' + posLabel(contRec.lastPosition) + '」') + '</span></p>' +
        '<a class="primary" href="#jp-lesson/' + esc(cont.id) + '">繼續　↗</a></section>'
      : '<section class="panel jp-continue"><h3>開始學習</h3><p>從課程地圖選一課開始。</p><a class="primary" href="#jp-map">課程地圖　↗</a></section>';
    var doneLessons = JPDATA.lessons.filter(function (l) {
      var r = state.lessons[l.id];
      return r && r.status === 'completed';
    }).length;
    var mastered = 0;
    Object.keys(state.knowledge).forEach(function (k) {
      if (state.knowledge[k].proficiency === 'mastered') mastered++;
    });
    var typedCount = state.attempts.filter(function (a) { return a.questionId.indexOf('typing-') === 0; }).length;
    var legacyHtml = state.legacy
      ? '<p class="muted">原站記錄：完成 ' + state.legacy.lessonsCompleted + ' 課（不計入本頁統計）</p>' : '';
    return '<div class="heading"><div class="eyebrow">字日 · 自由學習</div>' +
      '<h1>今天，學你想學的。</h1><p>繁體字、香港粵語、粵拼，從任何一課開始，不限次數。</p></div>' +
      '<div class="jp-grid">' + contHtml +
      '<section class="panel"><h3>今日待複習</h3><p>' + (due > 0 ? '<b>' + due + '</b> 個知識點到期' : '今天沒有到期複習') + '</p>' +
      (due > 0 ? '<a class="secondary" href="#jp-review">開始複習　↗</a>' : '<p class="muted">答錯的題會自動加入次日複習。</p>') +
      '</section></div>' +
      '<div class="jp-grid"><section class="panel"><h3>開始粵語打字訓練</h3><p>繁體字輸入、粵語常用字、句子打字。</p>' +
      '<a class="primary" href="#jp-typing">進入訓練　↗</a></section>' +
      '<section class="panel"><h3>開始繁體字訓練</h3><p>60 課原課程：生字、詞語、例句。</p>' +
      '<a class="primary" href="#plan">進入課程　↗</a></section>' +
      '<section class="panel"><h3>進入粵拼音頻課程</h3><p>19 聲母、56 韻母、6 聲調，逐個聽。</p>' +
      '<a class="primary" href="#jp-cards">進入課程　↗</a></section>' +
      '<section class="panel"><h3>實際學習進度</h3>' +
      '<p>粵拼課程完成 <b>' + doneLessons + '</b> / ' + JPDATA.lessons.length + ' 課 · 打字練習 <b>' + typedCount + '</b> 次 · 累計作答 <b>' + state.attempts.length + '</b> 次</p>' +
      '<p>熟練度：學習中 <b>' + (Object.keys(state.knowledge).length - mastered) + '</b> · 已掌握 <b>' + mastered + '</b></p>' +
      '<p class="muted">掌握 = 小測/複習中連續 3 次首次答對；點「完成」不計掌握。</p>' +
      legacyHtml + '</section></div>';
  }

  function posLabel(p) {
    return { goal: '目標', cards: '知識卡', practice: '練習', paper: '紙筆', quiz: '小測', summary: '總結' }[p] || p;
  }

  function legacyDoneSet() {
    var done = {};
    try {
      var v1 = JSON.parse(localStorage.getItem('ziyat-study-v1') || 'null');
      if (v1) Object.keys(v1.lessons || {}).forEach(function (k) {
        if (v1.lessons[k] && v1.lessons[k].done) done[k] = true;
      });
    } catch (e) { }
    return done;
  }

  /* 原 60 課列表（繁體字學習頁與課程地圖共用）：點擊進入舊課程流程 */
  function legacyLessonsHtml() {
    var legacyLessons = (typeof window.DATA !== 'undefined' && window.DATA.lessons) || [];
    if (!legacyLessons.length) return '';
    var doneSet = legacyDoneSet();
    return legacyLessons.map(function (l) {
      var done = doneSet[String(l.id)] ? '✓' : '○';
      return '<button type="button" class="jp-lesson jp-legacy" data-legacy="' + l.id + '">' +
        '<span class="licon">' + done + '</span><span><strong>第 ' + l.week + ' 週 · ' + l.title + '</strong>' +
        '<small class="muted">' + (l.characters || []).join(' · ') + '</small></span></button>';
    }).join('');
  }

  /* 繁體字學習：原 60 課自由課程 + 繁簡打字訓練入口（不再展示 12 週計劃框架） */
  function fantiView() {
    var list = legacyLessonsHtml();
    return '<div class="heading"><div class="eyebrow">TRADITIONAL CHINESE</div><h1>繁體字學習</h1>' +
      '<p>60 課自由課程：生字、詞語、例句、手寫與小測。不限日期、不限次數，隨時可學、可重學。</p></div>' +
      '<section class="panel"><h3>繁簡易混字訓練</h3><p>學習→學習、發展 vs 頭髮——先搞懂一對多轉換，再動手打字。</p>' +
      '<a class="primary" href="#jp-typing/fanti">開始繁簡訓練　↗</a></section>' +
      '<section class="panel"><h2>課程列表<span class="muted"> ' +
      ((typeof window.DATA !== 'undefined' && window.DATA.lessons) || []).length + ' 課</span></h2>' +
      '<p class="muted">進度沿用原站記錄；點課程進入（生字 → 手寫 → 打字 → 小測）。</p>' +
      '<div class="jp-lessons">' + list + '</div></section>';
  }

  function mapView() {
    var html = '<div class="heading"><div class="eyebrow">COURSE MAP</div><h1>課程地圖</h1>' +
      '<p>不限日期、不限次數，從任何一課開始。</p></div>';

    /* ① 繁體字基礎：原 60 課遷入，只讀展示原站完成狀態 */
    var legacyCount = ((typeof window.DATA !== 'undefined' && window.DATA.lessons) || []).length;
    if (legacyCount) {
      html += '<section class="panel jp-stage"><h2>① 繁體字基礎<span class="muted"> 原課程 ' + legacyCount + ' 課</span></h2>' +
        '<p class="muted">原 12 週課程已遷入課程地圖；進度沿用原站記錄，可隨時重學。</p>' +
        '<div class="jp-lessons">' + legacyLessonsHtml() + '</div></section>';
    }

    /* ②–④ 打字訓練入口 */
    var t = JPDATA.typing;
    html += '<section class="panel jp-stage"><h2>② 繁簡易混字<span class="muted"> 粵語打字 · ' + t.fanti.length + ' 組</span></h2>' +
      '<p class="muted">學習 → 學習、發展 vs 頭髮——一對多的轉換規則。</p>' +
      '<a class="primary" href="#jp-typing/fanti">開始訓練　↗</a></section>';
    html += '<section class="panel jp-stage"><h2>③ 香港粵語常用字<span class="muted"> 粵語打字 · ' + t.commonChars.length + ' 字</span></h2>' +
      '<p class="muted">佢、冇、嘅、咗、喺、啲…… 字形、解釋、粵拼、例句、音頻、輸入練習。</p>' +
      '<a class="primary" href="#jp-typing/common">開始訓練　↗</a></section>';
    html += '<section class="panel jp-stage"><h2>④ 粵語短句輸入<span class="muted"> 粵語打字 · ' + t.sentences.length + ' 句</span></h2>' +
      '<p class="muted">普通話意思 → 自然香港粵語；多種合理答案，標點空格不判錯。</p>' +
      '<a class="primary" href="#jp-typing/sentence">開始訓練　↗</a>　<a class="soft" href="#jp-typing/ime">輸入法教學　↗</a></section>';

    /* ⑤ 粵拼入門與音頻（A–E） */
    html += '<section class="panel jp-stage"><h2>⑤ 粵拼入門與音頻</h2><p class="muted">' +
      '先聽聲音，再學規則。<a href="#jp-cards">直接瀏覽全部聲韻調音頻卡　↗</a></p>' +
      '<div class="jp-lessons">' + stageLessonsHtml(['A', 'B', 'C', 'D', 'E']) + '</div></section>';

    /* ⑥ 香港生活與職場書面表達（F 主題，部分內容） */
    html += '<section class="panel jp-stage"><h2>⑥ 香港生活與職場書面表達<span class="badge warn">部分內容</span></h2>' +
      '<p class="muted">主題詞彙 + 拼寫練習已可用；句子與對話素材待補。</p>' +
      '<div class="jp-lessons">' + stageLessonsHtml(['F']) + '</div></section>';
    return html;
  }

  function stageLessonsHtml(stageIds) {
    return JPDATA.lessons.filter(function (l) { return stageIds.indexOf(l.stage) >= 0; })
      .map(function (l) {
        var r = state.lessons[l.id];
        var icon = r && r.status === 'completed' ? '✓' : (r && r.status === 'in_progress' ? '◐' : '○');
        var badges = '';
        if (l.quizQuestionIds.length === 0) badges += '<span class="badge">練習課</span>';
        if ((l.notes || '').indexOf('待補') >= 0) badges += '<span class="badge warn">部分內容</span>';
        return '<a class="jp-lesson" href="#jp-lesson/' + esc(l.id) + '">' +
          '<span class="licon">' + icon + '</span><span><strong>' + esc(l.id) + ' · ' + esc(l.title) + '</strong>' +
          '<small class="muted">' + esc(l.goal) + '</small></span>' + badges + '</a>';
      }).join('');
  }

  function lessonView(id) {
    var l = JPDATA.lessons.find(function (x) { return x.id === id; });
    if (!l) return '<div class="panel"><p>課程不存在。 <a href="#jp-map">回課程地圖</a></p></div>';
    lastLessonId = id;
    var r = lessonRec(id);
    if (r.status === 'not_started') { r.status = 'in_progress'; r.startedAt = new Date().toISOString(); }
    r.lastVisitedAt = new Date().toISOString();
    state.lastRoute = 'jp-lesson/' + id;
    saveV2();
    var pos = r.lastPosition;
    return '<div class="heading"><div class="eyebrow">第 ' + esc(l.stage) + ' 階段 · ' + esc(l.id) + '</div>' +
      '<h1>' + esc(l.title) + '</h1><p>' + esc(l.goal) + '</p>' +
      (l.notes ? '<p class="muted">' + esc(l.notes) + '</p>' : '') + '</div>' + stepBar(id) +
      '<div id="jp-step">' + stepView(l, r, pos) + '</div>';
  }

  function stepView(l, r, pos) {
    if (pos === 'goal') return goalStep(l);
    if (pos === 'cards') return cardsStep(l, r);
    if (pos === 'practice') return practiceStep(l, r);
    if (pos === 'paper') return paperStep(l, r);
    if (pos === 'quiz') return quizStep(l, r);
    return summaryStep(l, r);
  }

  function goalStep(l) {
    return '<section class="panel"><h2>本課目標</h2><p>' + esc(l.goal) + '</p>' +
      (l.notes ? '<p class="muted">' + esc(l.notes) + '</p>' : '') +
      '<button class="primary" data-pos="cards">開始　↗</button></section>';
  }

  function cardHTML(c) {
    var ex = (c.examples || []).map(function (e) {
      return '<span class="exitem">' + esc(e.char) + ' <code>' + esc(e.jyutping) + '</code> ' + audioBtn(e.jyutping, '') + '</span>';
    }).join('');
    return '<div class="jp-card"><h3>' + esc(c.symbol || c.tone) +
      '<span class="sub">' + esc(c.name || c.group || '') + '</span>' +
      (c.ipa ? ' <span class="ipa">' + esc(c.ipa) + '</span>' : '') + '</h3>' +
      (c.articulation ? '<p>' + esc(c.articulation) + '</p>' : (c.note ? '<p>' + esc(c.note) + '</p>' : '')) +
      (c.mandarinComparison ? '<p class="mp">普通話：' + esc(c.mandarinComparison) + '</p>' : '') +
      (c.warning ? '<p class="warn">⚠ ' + esc(c.warning) + '</p>' : '') +
      '<p class="ex">例字：' + ex + '</p></div>';
  }

  function cardsStep(l, r) {
    if (l.knowledgeCardIds.length === 0) {
      var ov = JPDATA.cards.overview;
      return '<section class="panel"><h2>總覽</h2><p>' + esc(ov.text) + '</p>' +
        '<p class="muted">' + esc(ov.checkedToneNote) + '</p>' + syntheticBanner() +
        '<button class="primary" data-pos="practice">下一步：練習　↗</button></section>';
    }
    var cards = l.knowledgeCardIds.map(function (cid) {
      var c = findCard(cid);
      return c ? cardHTML(c) : '';
    }).join('');
    return syntheticBanner() + cards +
      '<button class="primary" data-pos="practice">下一步：練習　↗</button>';
  }

  /* 粵拼與音頻：全部聲韻調卡片 + 六調最小對立組 */
  function cardsView() {
    var minSet = JPDATA.cards.overview.minimalSet.map(function (e) {
      return '<span class="minitem">' + esc(e.char) + ' <code>' + esc(e.jyutping) + '</code> ' + audioBtn(e.jyutping, '') + '</span>';
    }).join('');
    var ov = JPDATA.cards.overview;
    return '<div class="heading"><div class="eyebrow">JYUTPING · AUDIO</div><h1>粵拼與音頻</h1>' +
      '<p>先聽聲音，再學規則。每張卡可反覆播放；進入課程地圖可做對應練習。</p></div>' +
      syntheticBanner() +
      '<section class="panel"><h3>六調總覽</h3><p>' + esc(ov.text) + '</p>' +
      '<p><b>六調最小對立組</b>（詩史試時市是）：</p><div class="minset">' + minSet + '</div>' +
      '<p class="muted">' + esc(ov.checkedToneNote) + '</p></section>' +
      '<h2 class="jp-h2">聲母（19）</h2>' + JPDATA.cards.initials.map(cardHTML).join('') +
      '<h2 class="jp-h2">韻母（56）</h2>' + JPDATA.cards.finals.map(cardHTML).join('') +
      '<h2 class="jp-h2">聲調（6）</h2>' + JPDATA.cards.tones.map(cardHTML).join('') +
      '<p><a class="primary" href="#jp-map">去課程地圖做練習　↗</a></p>';
  }

  function findCard(cid) {
    var all = JPDATA.cards.initials.concat(JPDATA.cards.finals, JPDATA.cards.tones);
    for (var i = 0; i < all.length; i++) if (all[i].id === cid) return all[i];
    return null;
  }

  function practiceStep(l, r) {
    var ids = l.practiceQuestionIds;
    if (ids.length === 0) {
      return '<section class="panel"><h2>練習</h2><p>本課以聽讀為主，沒有文字練習。</p>' +
        '<button class="primary" data-pos="paper">下一步：紙筆　↗</button></section>';
    }
    var total = ids.length;
    var batchIds = ids.slice(practiceBatch * PRACTICE_BATCH, (practiceBatch + 1) * PRACTICE_BATCH);
    var forms = batchIds.map(function (qid) {
      var q = qById(qid);
      if (!q) return '';
      var answered = r.steps.practiceAnswered.indexOf(qid) >= 0;
      var badge = q.reviewStatus === 'draft' ? '<span class="badge warn">草稿·未審核</span>' : '';
      if (q.type === 'mcq') {
        var opts = q.options.map(function (o) {
          return '<label class="opt"><input type="radio" name="pq-' + esc(qid) + '" value="' + esc(o.text) + '">' +
            esc(o.text) + ' <code>' + esc(o.jyutping) + '</code></label>';
        }).join('');
        return '<div class="jp-q" data-qid="' + esc(qid) + '">' + badge + '<p class="qprompt">' + esc(q.prompt) + '</p>' +
          '<div class="opts">' + opts + '</div>' +
          '<button class="soft" data-practice-submit>核對</button>' +
          '<button class="inlinebtn" data-hint>提示</button>' +
          '<div class="jp-feedback" ' + (answered ? '' : 'hidden') + '></div></div>';
      }
      return '<div class="jp-q" data-qid="' + esc(qid) + '">' + badge + '<p class="qprompt">' + esc(q.prompt) + '</p>' +
        '<input class="pq-input" maxlength="40" autocomplete="off" placeholder="輸入答案"> ' +
        '<button class="soft" data-practice-submit>核對</button>' +
        '<button class="inlinebtn" data-hint>提示</button>' +
        '<div class="jp-feedback" ' + (answered ? '' : 'hidden') + '></div></div>';
    }).join('');
    var progress = '本批 ' + (practiceBatch * PRACTICE_BATCH + 1) + '–' +
      Math.min((practiceBatch + 1) * PRACTICE_BATCH, total) + ' / 共 ' + total + ' 題 · 已答 ' + r.steps.practiceAnswered.length;
    var nextBtn = (practiceBatch + 1) * PRACTICE_BATCH < total
      ? '<button class="secondary" data-practice-next>換一批</button>' : '';
    var done = r.steps.practiceAnswered.length >= Math.min(total, PRACTICE_MIN_DONE);
    return '<section class="panel"><h2>練習</h2><p class="muted">' + progress + '</p>' + forms +
      '<div class="row">' + nextBtn +
      (done ? '<button class="primary" data-pos="paper">下一步：紙筆　↗</button>' : '') + '</div></section>';
  }

  function paperStep(l, r) {
    var targets = (l.knowledgeCardIds.length
      ? l.knowledgeCardIds.map(findCard).filter(Boolean).slice(0, 4).map(function (c) {
        var e = (c.examples || [])[0];
        return e ? e.char + '（' + e.jyutping + '）' : c.symbol;
      })
      : JPDATA.cards.overview.minimalSet.map(function (e) { return e.char + '（' + e.jyutping + '）'; }));
    return '<section class="panel"><h2>紙筆練習（自評）</h2>' +
      '<p>請在本子上抄寫：<b>' + esc(targets.join('、')) + '</b></p>' +
      '<p class="warn">自評只記錄完成，<b>不計入正確率</b>。寫完後自己核對。</p>' +
      (r.steps.selfAssessed
        ? '<p class="good">✓ 已完成自評。想重寫一次？<button class="inlinebtn" data-selfassess="redo">再寫一遍</button></p>'
        : '<div class="row"><button class="soft" data-selfassess="easy">我已完成 · 容易</button>' +
          '<button class="soft" data-selfassess="normal">我已完成 · 普通</button>' +
          '<button class="soft" data-selfassess="hard">我已完成 · 困難</button></div>') +
      '<button class="primary" data-pos="quiz">下一步：小測　↗</button></section>';
  }

  function quizStep(l, r) {
    if (quizFeedback) {
      var fb = quizFeedback;
      var html = '<section class="panel"><h2>小測結果</h2><p><b>答對 ' + fb.score + ' / ' + fb.total + '</b></p>' +
        fb.items.map(function (it) {
          return '<p class="' + (it.correct ? 'good' : 'bad') + '">' +
            (it.correct ? '✓' : '✗') + ' ' + esc(it.prompt) +
            '<br><span class="muted">你的答案：' + esc(it.your) + '　正確：' + esc(it.expected) + '</span>' +
            '<br><span class="muted">' + esc(it.explanation) + '</span></p>';
        }).join('') +
        '<p class="muted">首次獨立作答才計入掌握；重考不影響熟練度。</p>' +
        '<div class="row"><button class="soft" data-pos="quiz-retake">重考</button>' +
        '<button class="primary" data-pos="summary">查看總結　↗</button></div></section>';
      return html;
    }
    var pool = selectQuizQuestions(l.id);
    if (pool.length === 0) {
      return '<section class="panel"><h2>無提示小測</h2><p class="muted">本課暫無小測。</p>' +
        '<button class="primary" data-pos="summary">查看總結　↗</button></section>';
    }
    var forms = pool.map(function (q, i) {
      if (q.type === 'mcq') {
        var opts = q.options.map(function (o) {
          return '<label class="opt"><input type="radio" name="qz-' + i + '" value="' + esc(o.text) + '">' +
            esc(o.text) + ' <code>' + esc(o.jyutping) + '</code></label>';
        }).join('');
        return '<div class="jp-q"><p class="qprompt">' + (i + 1) + '. ' + esc(q.prompt) + '</p>' +
          '<div class="opts">' + opts + '</div></div>';
      }
      return '<div class="jp-q"><p class="qprompt">' + (i + 1) + '. ' + esc(q.prompt) + '</p>' +
        '<input name="qz-' + i + '" maxlength="40" autocomplete="off"></div>';
    }).join('');
    return '<section class="panel"><h2>無提示小測</h2>' +
      '<p class="warn">提交前不會顯示答案；只記錄首次獨立作答。</p>' +
      '<form data-quiz-submit>' + forms +
      '<button class="primary" type="submit">提交小測</button></form></section>';
  }

  function summaryStep(l, r) {
    var quizPool = selectQuizQuestions(l.id).length;
    var due = dueKnowledge().length;
    var next = null;
    JPDATA.lessons.forEach(function (x) {
      if (!next && x.id > l.id && x.stage === l.stage) next = x;
    });
    return '<section class="panel"><h2>本課總結</h2>' +
      '<p>' + (r.status === 'completed' ? '✓ 本課已完成。' : '課程已完成度：卡片 ' +
        r.steps.cardsSeen.length + '/' + l.knowledgeCardIds.length + ' · 練習 ' +
        r.steps.practiceAnswered.length + ' 題 · 自評 ' + (r.steps.selfAssessed ? '✓' : '✗') +
        ' · 小測 ' + (r.steps.quizSubmitted ? '✓' : '✗')) + '</p>' +
      '<p class="muted">「完成」與「掌握」分開記錄：掌握程度在複習頁按到期知識點檢驗。</p>' +
      (due > 0 ? '<p>今天有 <b>' + due + '</b> 個知識點到期複習。</p>' : '') +
      '<div class="row">' +
      (next ? '<a class="primary" href="#jp-lesson/' + esc(next.id) + '">下一課：' + esc(next.id) + '　↗</a>' : '') +
      '<a class="secondary" href="#jp-map">返回課程地圖</a></div></section>';
  }

  function reviewStatsHtml() {
    var learning = 0, mastered = 0;
    Object.keys(state.knowledge).forEach(function (k) {
      if (state.knowledge[k].proficiency === 'mastered') mastered++; else learning++;
    });
    return '<section class="panel"><h3>熟練度</h3><p>學習中 <b>' + learning + '</b> · 已掌握 <b>' + mastered +
      '</b> · 累計作答 <b>' + state.attempts.length + '</b> 次</p>' +
      '<p class="muted">掌握 = 連續 3 次首次答對；點「完成」不計掌握。</p>' +
      '<a class="soft" href="#jp-progress">詳細進度　↗</a></section>';
  }

  function reviewView() {
    if (reviewQueue === null) {
      reviewQueue = dueKnowledge();
      reviewIndex = -1;
      reviewFeedback = null;
    }
    if (reviewFeedback) {
      var fb = reviewFeedback;
      var html = '<section class="panel"><p class="' + (fb.correct ? 'good' : 'bad') + '">' +
        (fb.correct ? '✓ 答對' : '✗ 答錯') + '　' + esc(fb.prompt) +
        '<br><span class="muted">正確：' + esc(fb.expected) + '</span><br><span class="muted">' + esc(fb.explanation) + '</span></p>' +
        '<button class="primary" data-review-next>下一題　↗</button></section>';
      return html + reviewStatsHtml();
    }
    if (reviewQueue.length === 0) {
      return '<div class="heading"><div class="eyebrow">REVIEW</div><h1>複習與進度</h1></div>' +
        '<section class="panel"><p>今天沒有到期複習。🎉</p>' +
        '<p class="muted">到期規則：首答對 1 天後、再對 3/7/14/30 天，答錯次日再來。</p>' +
        '<a class="primary" href="#jp-map">去課程地圖　↗</a></section>' +
        reviewStatsHtml();
    }
    // 找下一題：按到期最早的知識點取 approved 題，避開最近用過的 5 題
    var recent = state.attempts.slice(-5).map(function (a) { return a.questionId; });
    var idx = buildKnowledgeIndex();
    var question = null, kid = null;
    for (var i = 0; i < reviewQueue.length; i++) {
      var candidates = (idx[reviewQueue[i]] || []).filter(function (qid) { return recent.indexOf(qid) < 0; });
      if (candidates.length) { kid = reviewQueue[i]; question = qById(candidates[0]); break; }
    }
    if (!question) {
      return '<div class="heading"><div class="eyebrow">REVIEW</div><h1>複習</h1></div>' +
        '<section class="panel"><p>到期題目都在最近做過，稍後再來。</p></section>';
    }
    reviewIndex++;
    var form = question.type === 'mcq'
      ? '<div class="opts">' + question.options.map(function (o) {
        return '<label class="opt"><input type="radio" name="rv" value="' + esc(o.text) + '">' +
          esc(o.text) + ' <code>' + esc(o.jyutping) + '</code></label>';
      }).join('') + '</div>'
      : '<input name="rv" maxlength="40" autocomplete="off">';
    return '<div class="heading"><div class="eyebrow">REVIEW</div><h1>複習</h1>' +
      '<p class="muted">待複習 ' + reviewQueue.length + ' 個知識點 · 當前：' + esc(kid) + '</p></div>' +
      '<section class="panel"><form data-review-submit data-qid="' + esc(question.id) +
      '" data-kid="' + esc(kid) + '"><p class="qprompt">' + esc(question.prompt) + '</p>' + form +
      '<button class="primary" type="submit">提交</button></form></section>';
  }

  function settingsView() {
    var legacyHtml = state.legacy
      ? '<section class="panel"><h3>原站進度（legacy）</h3><p>完成 <b>' + state.legacy.lessonsCompleted + '</b> 課 · 掌握 <b>' +
        state.legacy.masteredChars.length + '</b> 字 · 學習 <b>' + state.legacy.activityDays + '</b> 天</p>' +
        '<p class="warn">' + esc(state.legacy.note) + '</p></section>'
      : '';
    return '<div class="heading"><div class="eyebrow">SETTINGS</div><h1>設置與數據管理</h1>' +
      '<p class="muted">進度只存在此瀏覽器；換設備或清除瀏覽器資料會丟失，請定期備份。</p></div>' +
      '<div class="jp-grid"><section class="panel"><h3>顯示與音頻</h3>' +
      '<label class="opt"><input type="checkbox" data-audio-toggle ' + (state.settings.audio === false ? '' : 'checked') + '>' +
      '播放合成音頻（音頻為 TTS 合成音，僅供跟讀）</label>' +
      '<p class="muted">原站設定（繁簡顯示、打字難度、倉頡開關）：<a href="#settings">打開原站設置　↗</a></p></section>' +
      '<section class="panel"><h3>數據管理</h3>' +
      '<p><button class="primary" data-export>匯出 JSON 備份</button></p>' +
      '<p class="muted">匯入會覆蓋目前的粵拼進度（覆蓋前自動留底，可一鍵還原）。</p>' +
      '<p><input type="file" accept=".json,application/json" data-import></p>' +
      '<p id="jp-import-msg"></p>' +
      '<p><button class="soft" data-restore ' + (hasPrebk() ? '' : 'disabled') + '>還原覆蓋前備份</button>　' +
      '<button class="danger" data-clear>清除粵拼進度（不影響原站）</button></p></section></div>' +
      legacyHtml;
  }

  function backupView() { return settingsView(); }

  /* 粵語打字訓練：繁體輸入 / 常用字 / 句子 / 輸入法教學 */
  var typingTabs = { fanti: '繁體字輸入', common: '粵語常用字', sentence: '句子打字', ime: '輸入法教學' };

  function typingAnsweredCount(prefix) {
    return state.attempts.filter(function (a) { return a.questionId.indexOf(prefix) === 0; }).length;
  }

  function typingItem(qid, promptHtml, inputName, wide) {
    return '<div class="jp-q tp-item" data-qid="' + esc(qid) + '">' + promptHtml +
      '<input class="tp-input' + (wide ? ' wide' : '') + '" maxlength="60" autocomplete="off" ' +
      'placeholder="先試著自己輸入，不顯示答案" name="' + esc(inputName) + '"> ' +
      '<button class="soft" data-typing-submit>核對</button>' +
      '<div class="jp-feedback" hidden></div></div>';
  }

  function typingView(tab) {
    tab = typingTabs[tab] ? tab : 'fanti';
    var t = JPDATA.typing;
    var tabsHtml = Object.keys(typingTabs).map(function (k) {
      return '<a class="soft jp-tab' + (k === tab ? ' active' : '') + '" href="#jp-typing/' + k + '">' + typingTabs[k] + '</a>';
    }).join(' ');
    var body = '';
    if (tab === 'fanti') {
      body = '<div class="heading"><div class="eyebrow">TYPING · 繁體字輸入</div><h1>繁體字輸入</h1>' +
        '<p>顯示簡體，獨立輸入對應繁體字。注意：一個簡體字可能對應多個繁體字。</p></div>' +
        '<p class="muted">已練習 <b>' + typingAnsweredCount('typing-fanti:') + '</b> / ' + t.fanti.length + ' 組</p>' +
        t.fanti.map(function (e) {
          return typingItem('typing-fanti:' + e.simp,
            '<p class="qprompt">請用繁體字輸入「' + esc(e.simp) + '」　<span class="muted">（提示：' + esc(e.hint) + '）</span></p>',
            'tf-' + e.id);
        }).join('');
    } else if (tab === 'common') {
      body = '<div class="heading"><div class="eyebrow">TYPING · 常用字</div><h1>香港粵語常用字</h1>' +
        '<p>佢、冇、嘅…… 每字：字形、普通話解釋、粵拼、例句、音頻，然後自己輸入一次。</p></div>' +
        '<p class="muted">已練習 <b>' + typingAnsweredCount('typing-cc:') + '</b> / ' + t.commonChars.length + ' 字</p>' +
        t.commonChars.map(function (e) {
          return '<div class="jp-card"><h3>' + esc(e.char) + ' <code>' + esc(e.jyutping) + '</code> ' +
            audioBtn(e.jyutping, e.char) + '</h3>' +
            '<p>普通話：' + esc(e.mandarin) + '</p>' +
            '<p>例句：' + esc(e.exampleYue) + '<br><span class="muted">＝ ' + esc(e.examplePu) + '</span></p>' +
            '<div class="jp-q tp-item" data-qid="typing-cc:' + esc(e.char) + '">' +
            '<p class="qprompt">請輸入這個字（' + esc(e.mandarin) + '）：</p>' +
            '<input class="tp-input" maxlength="10" autocomplete="off" placeholder="先試著自己輸入"> ' +
            '<button class="soft" data-typing-submit>核對</button>' +
            '<div class="jp-feedback" hidden></div></div></div>';
        }).join('');
    } else if (tab === 'sentence') {
      body = '<div class="heading"><div class="eyebrow">TYPING · 句子</div><h1>句子打字</h1>' +
        '<p>看普通話意思，寫出自然的香港粵語句子。支援多種合理說法；標點和空格不判錯。</p></div>' +
        '<p class="muted">已練習 <b>' + typingAnsweredCount('typing-s:') + '</b> / ' + t.sentences.length + ' 句</p>' +
        t.sentences.map(function (e) {
          return typingItem('typing-s:' + e.id,
            '<p class="qprompt">普通話：' + esc(e.pu) + '</p>', 'ts-' + e.id, true);
        }).join('');
    } else {
      var im = t.inputMethods;
      var list = function (items) {
        return '<ol>' + items.map(function (x) { return '<li>' + esc(x) + '</li>'; }).join('') + '</ol>';
      };
      body = '<div class="heading"><div class="eyebrow">TYPING · IME</div><h1>輸入法教學</h1>' +
        '<p>兩條實際打字路徑：普通話拼音打繁體、粵拼打粵語字。</p></div>' +
        '<div class="jp-grid">' +
        '<section class="panel"><h3>用普通話拼音輸入繁體字</h3>' +
        '<p class="sub">macOS</p>' + list(im.macPinyinTrad) +
        '<p class="sub">Windows</p>' + list(im.winPinyinTrad) + '</section>' +
        '<section class="panel"><h3>用粵拼輸入粵語字</h3>' + list(im.jyutpingIME) + '</section></div>' +
        '<div class="notice jp-banner">' + esc(im.note) + '</div>' +
        '<p class="badge warn">輸入法指引為草稿，請按實際系統核實</p>';
    }
    return '<div class="jp-tabs">' + tabsHtml + '</div>' + body +
      '<div class="notice jp-banner">本頁訓練內容為模型草稿，正在人工審核；審核前僅作練習，不進入小測。</div>';
  }

  function hasPrebk() {
    try { return !!localStorage.getItem(PREBK_KEY); } catch (e) { return false; }
  }

  function progressView() {
    var counts = { unseen: 0, learning: 0, mastered: 0, due: 0 };
    Object.keys(state.knowledge).forEach(function (id) {
      var k = state.knowledge[id];
      if (k.proficiency === 'unseen') { counts.unseen++; return; }
      if (k.proficiency === 'mastered') counts.mastered++; else counts.learning++;
    });
    counts.due = dueKnowledge().length;
    var stageHtml = JPDATA.stages.filter(function (s) { return !s.upcoming; }).map(function (s) {
      var lessons = JPDATA.lessons.filter(function (l) { return l.stage === s.id; });
      var done = lessons.filter(function (l) { var r = state.lessons[l.id]; return r && r.status === 'completed'; }).length;
      return '<p>' + esc(s.id) + ' ' + esc(s.title) + '：<b>' + done + '</b>/' + lessons.length + ' 課完成</p>';
    }).join('');
    var legacyHtml = state.legacy
      ? '<section class="panel"><h3>原站進度（legacy）</h3><p>完成 ' + state.legacy.lessonsCompleted + ' 課 · 掌握 ' +
        state.legacy.masteredChars.length + ' 字<span class="warn">（不計入粵拼掌握）</span></p></section>'
      : '';
    return '<div class="heading"><div class="eyebrow">PROGRESS</div><h1>粵拼進度</h1></div>' +
      '<div class="jp-grid"><section class="panel"><h3>知識點熟練度</h3>' +
      '<p>未學 ' + counts.unseen + ' · 學習中 ' + counts.learning + ' · 已掌握 ' + counts.mastered +
      ' · 到期待複習 ' + counts.due + '</p>' +
      '<p class="muted">掌握 = 小測/複習中連續 3 次首次答對。未答過客觀題時不會有「已掌握」。</p></section>' +
      '<section class="panel"><h3>課程完成</h3>' + stageHtml +
      '<p class="muted">累計作答 ' + state.attempts.length + ' 次</p></section></div>' + legacyHtml;
  }

  /* ================= 渲染與事件 ================= */
  var views = {
    'jp-home': homeView, 'jp-map': mapView, 'jp-lesson': lessonView,
    'jp-review': reviewView, 'jp-backup': settingsView, 'jp-settings': settingsView,
    'jp-typing': typingView, 'jp-cards': cardsView, 'jp-progress': progressView,
    'jp-fanti': fantiView,
  };

  function render() {
    var route = parseHash();
    if (!route.name) return; // 非本模塊路由，交給舊 app
    var view = views[route.name];
    var app = document.querySelector('#app');
    if (!view || !app) return;
    app.innerHTML = view(route.arg);
    var breadcrumb = document.querySelector('#breadcrumb');
    var titles = {
      'jp-home': '學習首頁', 'jp-map': '課程地圖', 'jp-lesson': '課程',
      'jp-review': '複習與進度', 'jp-backup': '設置與數據', 'jp-settings': '設置與數據',
      'jp-typing': '粵語打字', 'jp-cards': '粵拼與音頻', 'jp-progress': '粵拼進度',
      'jp-fanti': '繁體字學習',
    };
    var title = titles[route.name] || '粵拼入門';
    if (breadcrumb) breadcrumb.textContent = '粵拼入門 / ' + title;
    document.title = title + ' · 字日';
    syncNav(route.name);
    bind();
    if (window.scrollTo) window.scrollTo(0, 0);
  }

  var NAV_HREF = {
    'jp-home': '#jp-home', 'jp-map': '#jp-map', 'jp-lesson': '#jp-map',
    'jp-review': '#jp-review', 'jp-settings': '#jp-settings', 'jp-backup': '#jp-settings',
    'jp-typing': '#jp-typing', 'jp-cards': '#jp-cards', 'jp-progress': '#jp-review',
    'jp-fanti': '#jp-fanti',
  };

  function syncNav(name) {
    var target = NAV_HREF[name] || null;
    document.querySelectorAll('nav a').forEach(function (a) {
      var href = a.getAttribute('href') || '';
      var active = target !== null && href === target;
      if (active) a.classList.add('active'); else a.classList.remove('active');
    });
  }

  function toast(msg) {
    var t = document.querySelector('#toast');
    if (!t) return;
    t.textContent = msg;
    t.classList.add('show');
    setTimeout(function () { t.classList.remove('show'); }, 2800);
  }

  function bind() {
    document.querySelectorAll('#app [data-pos]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var pos = btn.getAttribute('data-pos');
        var r = lessonRec(lastLessonId);
        if (pos === 'quiz-retake') { quizFeedback = null; r.lastPosition = 'quiz'; }
        else {
          if (pos === 'cards') {
            JPDATA.lessons.forEach(function (l) {
              if (l.id === lastLessonId) l.knowledgeCardIds.forEach(function (c) {
                if (r.steps.cardsSeen.indexOf(c) < 0) r.steps.cardsSeen.push(c);
              });
            });
          }
          if (pos === 'quiz') quizFeedback = null;
          if (pos === 'summary') checkCompletion(lastLessonId);
          r.lastPosition = pos;
        }
        saveV2();
        render();
      });
    });
    document.querySelectorAll('#app [data-audio]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var a = new Audio(btn.getAttribute('data-audio'));
        a.play().catch(function () { toast('音頻播放失敗'); });
      });
    });
    document.querySelectorAll('#app [data-practice-submit]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var box = btn.closest('.jp-q');
        var qid = box.getAttribute('data-qid');
        var q = qById(qid);
        var answer;
        var radio = box.querySelector('input[type=radio]:checked');
        var input = box.querySelector('input.pq-input');
        if (radio) answer = radio.value; else if (input) answer = input.value;
        if (!answer && answer !== '0') { toast('請先輸入答案'); return; }
        var hintBtn = box.querySelector('[data-hint]');
        var hintUsed = hintBtn && hintBtn.getAttribute('data-hinted') === '1';
        var correct = gradeQuestion(q, answer);
        var rec = {
          questionId: qid, lessonId: q.lessonId, skill: 'jyutping',
          hintUsed: !!hintUsed, submittedAt: new Date().toISOString(),
          assessmentMode: 'practice', correct: correct, answer: answer,
        };
        applyAnswer(state, rec);
        var r = lessonRec(lastLessonId);
        if (r.steps.practiceAnswered.indexOf(qid) < 0) r.steps.practiceAnswered.push(qid);
        saveV2();
        var fb = box.querySelector('.jp-feedback');
        fb.hidden = false;
        fb.innerHTML = '<p class="' + (correct ? 'good' : 'bad') + '">' + (correct ? '✓ 正確' : '✗ 答錯') +
          '　正確：' + esc((q.acceptedAnswers || []).join(' / ')) + '</p>' +
          '<p class="muted">' + esc(q.explanation) + '</p>' +
          '<p class="muted">練習不計入掌握。</p>';
        box.querySelectorAll('input').forEach(function (i) { i.disabled = true; });
      });
    });
    document.querySelectorAll('#app [data-hint]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        btn.setAttribute('data-hinted', '1');
        btn.textContent = '已看提示';
        toast('已記錄「看了提示」，本題不計入掌握');
      });
    });
    /* 打字訓練逐題核對：答案先不顯示，提交後給反饋；答錯自動入次日複習 */
    document.querySelectorAll('#app [data-typing-submit]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var box = btn.closest('.tp-item');
        var qid = box.getAttribute('data-qid');
        var q = qById(qid);
        var input = box.querySelector('input.tp-input');
        var answer = input ? input.value : '';
        if (!answer) { toast('請先輸入答案'); return; }
        var correct = gradeQuestion(q, answer);
        var rec = {
          questionId: qid, lessonId: q.lessonId, skill: q.skill || 'vocabulary',
          hintUsed: false, submittedAt: new Date().toISOString(),
          assessmentMode: 'practice', correct: correct, answer: answer,
        };
        applyAnswer(state, rec);
        saveV2();
        var fb = box.querySelector('.jp-feedback');
        fb.hidden = false;
        fb.innerHTML = '<p class="' + (correct ? 'good' : 'bad') + '">' + (correct ? '✓ 正確' : '✗ 答錯') +
          '　參考答案：' + esc((q.acceptedAnswers || []).join(' ／ ')) + '</p>' +
          '<p class="muted">' + esc(q.explanation) + '</p>' +
          (correct ? '' : '<p class="warn">答錯的題已自動加入次日複習。</p>');
        input.disabled = true;
        btn.disabled = true;
      });
    });
    /* 原課程（繁體字基礎）跳轉：經舊站 setLesson 進入舊課程流程 */
    document.querySelectorAll('#app [data-legacy]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var n = Number(btn.getAttribute('data-legacy'));
        if (!isNaN(n) && typeof window.setLesson === 'function') window.setLesson(n);
        location.hash = '#lesson';
      });
    });
    /* 音頻開關 */
    document.querySelectorAll('#app [data-audio-toggle]').forEach(function (cb) {
      cb.addEventListener('change', function () {
        state.settings.audio = !cb.checked ? false : true;
        saveV2();
        toast(cb.checked ? '已開啟合成音頻' : '已關閉合成音頻');
      });
    });
    document.querySelectorAll('#app [data-practice-next]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var l = JPDATA.lessons.find(function (x) { return x.id === lastLessonId; });
        var total = l ? l.practiceQuestionIds.length : 0;
        practiceBatch = Math.min(practiceBatch + 1, Math.ceil(total / PRACTICE_BATCH) - 1);
        render();
      });
    });
    document.querySelectorAll('#app [data-selfassess]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var r = lessonRec(lastLessonId);
        if (btn.getAttribute('data-selfassess') === 'redo') {
          r.steps.selfAssessed = false;
        } else {
          r.steps.selfAssessed = true;
        }
        saveV2();
        render();
      });
    });
    var quizForm = document.querySelector('#app [data-quiz-submit]');
    if (quizForm) {
      quizForm.addEventListener('submit', function (ev) {
        ev.preventDefault();
        var pool = selectQuizQuestions(lastLessonId);
        var score = 0;
        var items = [];
        pool.forEach(function (q, i) {
          var els = quizForm.querySelectorAll('[name="qz-' + i + '"]');
          var answer = '';
          if (els.length) {
            if (els[0].type === 'radio') {
              for (var j = 0; j < els.length; j++) {
                if (els[j].checked) { answer = els[j].value; break; }
              }
            } else {
              answer = els[0].value || '';
            }
          }
          var correct = gradeQuestion(q, answer);
          if (correct) score++;
          var rec = {
            questionId: q.id, lessonId: q.lessonId, skill: 'jyutping',
            hintUsed: false, submittedAt: new Date().toISOString(),
            assessmentMode: 'quiz', correct: correct, answer: answer,
          };
          applyAnswer(state, rec);
          items.push({
            prompt: q.prompt, correct: correct, your: answer,
            expected: (q.acceptedAnswers || []).join(' / '), explanation: q.explanation,
          });
        });
        var r = lessonRec(lastLessonId);
        r.steps.quizSubmitted = true;
        quizFeedback = { score: score, total: pool.length, items: items };
        saveV2();
        render();
      });
    }
    var reviewForm = document.querySelector('#app [data-review-submit]');
    if (reviewForm) {
      reviewForm.addEventListener('submit', function (ev) {
        ev.preventDefault();
        var qid = reviewForm.getAttribute('data-qid');
        var q = qById(qid);
        var radio = reviewForm.querySelector('input[type=radio]:checked');
        var input = reviewForm.querySelector('input[name=rv]');
        var answer = radio ? radio.value : (input ? input.value : '');
        var correct = gradeQuestion(q, answer);
        var rec = {
          questionId: qid, lessonId: q.lessonId, skill: 'jyutping',
          hintUsed: false, submittedAt: new Date().toISOString(),
          assessmentMode: 'review', correct: correct, answer: answer,
        };
        applyAnswer(state, rec);
        reviewQueue = reviewQueue.filter(function (kid) { return kid !== reviewForm.getAttribute('data-kid'); });
        reviewFeedback = {
          correct: correct, prompt: q.prompt,
          expected: (q.acceptedAnswers || []).join(' / '), explanation: q.explanation,
        };
        saveV2();
        render();
      });
    }
    document.querySelectorAll('#app [data-review-next]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        reviewFeedback = null;
        render();
      });
    });
    document.querySelectorAll('#app [data-export]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var blob = new Blob([JSON.stringify(exportJSON(), null, 2)], { type: 'application/json' });
        var a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        var d = new Date();
        a.download = 'ziyat-jp-backup-' + d.toISOString().slice(0, 10) + '.json';
        document.body.appendChild(a);
        a.click();
        a.remove();
        toast('備份已下載');
      });
    });
    document.querySelectorAll('#app [data-import]').forEach(function (input) {
      input.addEventListener('change', function () {
        var file = input.files && input.files[0];
        if (!file) return;
        var reader = new FileReader();
        reader.onload = function () {
          var msg = document.querySelector('#jp-import-msg');
          var obj = null;
          try { obj = JSON.parse(String(reader.result)); }
          catch (e) { if (msg) msg.textContent = '檔案不是合法 JSON，未覆蓋任何進度。'; return; }
          var v = validateImport(obj);
          if (!v.ok) { if (msg) msg.textContent = '匯入失敗：' + v.reason + '（現有進度未變動）'; return; }
          if (!confirm('匯入會覆蓋目前的粵拼進度，確定？')) return;
          try { localStorage.setItem(PREBK_KEY, JSON.stringify(state)); } catch (e) { }
          state = Object.assign(defaultState(), obj.state);
          saveV2();
          toast('匯入成功');
          render();
        };
        reader.readAsText(file);
      });
    });
    document.querySelectorAll('#app [data-restore]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var raw = null;
        try { raw = localStorage.getItem(PREBK_KEY); } catch (e) { }
        if (!raw) { toast('沒有可還原的備份'); return; }
        if (!confirm('還原覆蓋前的進度？')) return;
        state = Object.assign(defaultState(), JSON.parse(raw));
        saveV2();
        toast('已還原');
        render();
      });
    });
    document.querySelectorAll('#app [data-clear]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        if (!confirm('清除所有粵拼進度？原站（字日）進度不受影響。')) return;
        state = defaultState();
        saveV2();
        toast('已清除粵拼進度');
        render();
      });
    });
  }

  /* ================= 啟動 ================= */
  window.addEventListener('hashchange', render);
  window.JP = {
    esc: esc, normJyutping: normJyutping, gradeQuestion: gradeQuestion,
    selectQuizQuestions: selectQuizQuestions, applyAnswer: applyAnswer,
    migrateFromV1: migrateFromV1, validateImport: validateImport,
    exportJSON: exportJSON, loadV2: loadV2, saveV2: saveV2,
    lessonRec: lessonRec, checkCompletion: checkCompletion,
    dueKnowledge: dueKnowledge, buildKnowledgeIndex: buildKnowledgeIndex,
    parseHash: parseHash, render: render, qById: qById,
    state: function () { return state; },
    resetState: function (s) { state = Object.assign(defaultState(), s || {}); return state; },
    KEY: KEY, PREBK_KEY: PREBK_KEY,
  };
  loadV2();
  render();
})();
