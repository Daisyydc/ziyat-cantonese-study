// jyutping.js vm 回归测试：判分 / 抽题 / SRS / 迁移 / 导入校验 / 完成判定 / 路由渲染
const fs = require('fs'), vm = require('vm'), assert = require('assert');

const storage = {};
const elements = {};
function makeEl() {
  return {
    innerHTML: '', textContent: '', title: '', style: {}, files: null,
    classList: { add() { }, remove() { }, toggle() { } },
    addEventListener() { }, setAttribute() { }, getAttribute: () => null,
    appendChild() { }, remove() { }, closest: () => null,
    querySelector: () => null, querySelectorAll: () => [],
  };
}
const ctx = {
  console, Date, JSON, Math, Object, Array, String, Number, Set, Map, Error,
  Promise, RegExp, parseInt, parseFloat, isNaN,
  setTimeout: () => 0, clearTimeout() { }, confirm: () => true,
  location: { hash: '' },
  localStorage: { getItem: k => storage[k], setItem: (k, v) => { storage[k] = v; } },
  document: { querySelector: s => elements[s] || (elements[s] = makeEl()), querySelectorAll: () => [] },
  Audio: class { play() { return Promise.resolve(); } },
  Blob: class { constructor(parts, opts) { this.parts = parts; this.type = opts && opts.type; } },
  URL: { createObjectURL: () => 'blob:x' },
  FileReader: class { },
  addEventListener() { }, scrollTo() { },
};
ctx.window = ctx; // 模擬瀏覽器：window 即全局對象
vm.createContext(ctx);
vm.runInContext(fs.readFileSync('dist/jyutping-data.js', 'utf8'), ctx);
vm.runInContext(fs.readFileSync('dist/jyutping.js', 'utf8'), ctx);
const run = s => vm.runInContext(s, ctx);
const JP = ctx.JP;
const D = ctx.JPDATA;

// ---- 路由 ----
assert.deepEqual(run('JP.parseHash()'), { name: null, arg: null });
run("location.hash='#jp-map'"); assert.deepEqual(run('JP.parseHash()'), { name: 'jp-map', arg: null });
run("location.hash='#jp-lesson/A1'"); assert.deepEqual(run('JP.parseHash()'), { name: 'jp-lesson', arg: 'A1' });
run("location.hash='#home'"); assert.equal(run('JP.parseHash().name'), null);

// ---- 判分 ----
const q = id => D.questions.find(x => x.id === id);
assert.equal(run("JP.gradeQuestion(JP.qById('jp-full:你'),'nei5')"), true);
assert.equal(run("JP.gradeQuestion(JP.qById('jp-full:你'),'Nei 5')"), true, '大小写/空格容忍');
assert.equal(run("JP.gradeQuestion(JP.qById('jp-full:你'),'nei')"), false, '缺声调必须判错');
assert.equal(run("JP.gradeQuestion(JP.qById('jp-word:早晨'),'zou2san4')"), true);
assert.equal(run("JP.gradeQuestion(JP.qById('jp-initial:過'),'gw')"), true);
assert.equal(run("JP.gradeQuestion(JP.qById('jp-initial:過'),'g')"), false, 'gw 不能只写 g');
assert.equal(run("JP.gradeQuestion(JP.qById('jp-initial:唔'),'無')"), true, '零声母填「無」');
assert.equal(run("JP.gradeQuestion(JP.qById('jp-tone:你'),'5')"), true);
assert.equal(run("JP.gradeQuestion(JP.qById('jp-tone:你'),'2')"), false, 'nei2 ≠ nei5');
const mcq = D.questions.find(x => x.type === 'mcq');
assert.equal(run(`JP.gradeQuestion(JP.qById('${mcq.id}'),'${mcq.acceptedAnswers[0]}')`), true);
assert.equal(run(`JP.gradeQuestion(JP.qById('${mcq.id}'),'___錯___')`), false);

// ---- 抽题：只 approved、≤5 ----
const quiz = run("JP.selectQuizQuestions('B1')");
assert.ok(quiz.length > 0 && quiz.length <= 5, 'B1 小测 1–5 题');
assert.ok(quiz.every(x => x.reviewStatus === 'approved'), '小测无 draft');
assert.equal(run("JP.selectQuizQuestions('E3').length"), 0, '无 approved 的课抽不到题');

// ---- SRS ----
run('JP.resetState({})');
const rec = (qid, mode, correct, iso, lessonId) => ({ questionId: qid, lessonId, skill: 'jyutping', hintUsed: false, submittedAt: iso, assessmentMode: mode, correct, answer: 'x' });
const kid = q('jp-full:你').knowledgeIds[0];
run(`JP.applyAnswer(JP.state(),${JSON.stringify(rec('jp-full:你', 'practice', true, '2026-11-14T10:00:00Z', 'E2'))})`);
assert.equal(run(`JP.state().knowledge['${kid}'].proficiency`), 'learning', '练习只到 learning');
assert.equal(run(`JP.state().knowledge['${kid}'].nextReviewAt`), null, '练习不设复习时间');
run(`JP.applyAnswer(JP.state(),${JSON.stringify(rec('jp-full:你', 'quiz', true, '2026-11-15T10:00:00Z', 'E2'))})`);
assert.equal(run(`JP.state().knowledge['${kid}'].consecutive`), 1);
assert.equal(run(`JP.state().knowledge['${kid}'].intervalDays`), 1, '首答对 1 天');
run(`JP.applyAnswer(JP.state(),${JSON.stringify(rec('jp-full:你', 'quiz', true, '2026-11-16T10:00:00Z', 'E2'))})`);
run(`JP.applyAnswer(JP.state(),${JSON.stringify(rec('jp-full:你', 'quiz', true, '2026-11-17T10:00:00Z', 'E2'))})`);
assert.equal(run(`JP.state().knowledge['${kid}'].proficiency`), 'mastered', '连对 3 次掌握');
assert.equal(run(`JP.state().knowledge['${kid}'].intervalDays`), 4);
run(`JP.applyAnswer(JP.state(),${JSON.stringify(rec('jp-full:你', 'quiz', false, '2026-11-18T10:00:00Z', 'E2'))})`);
assert.equal(run(`JP.state().knowledge['${kid}'].consecutive`), 0, '答错重置');
assert.equal(run(`JP.state().knowledge['${kid}'].proficiency`), 'learning');
run(`JP.applyAnswer(JP.state(),${JSON.stringify(rec('jp-full:你', 'quiz', true, '2026-11-19T10:00:00Z', 'E2'))})`);
run(`JP.applyAnswer(JP.state(),${JSON.stringify(rec('jp-full:你', 'quiz', true, '2026-11-19T11:00:00Z', 'E2'))})`);
assert.equal(run(`JP.state().knowledge['${kid}'].consecutive`), 1, '同日重考不计掌握');
assert.equal(run(`JP.state().attempts.length`), 7);

// ---- 到期派生 ----
run('JP.resetState({knowledge:{"initial:b":{proficiency:"learning",nextReviewAt:"2020-01-01T00:00:00Z",intervalDays:1,correctCount:0,consecutive:0}}})');
assert.deepEqual(run('JP.dueKnowledge()'), ['initial:b'], '过期知识点进队列');
run('JP.resetState({knowledge:{"initial:b":{proficiency:"learning",nextReviewAt:"2999-01-01T00:00:00Z",intervalDays:1,correctCount:0,consecutive:0}}})');
assert.deepEqual(run('JP.dueKnowledge()'), [], '未到期不出队');

// ---- v1 迁移 ----
storage['ziyat-study-v1'] = JSON.stringify({ version: 1, lessons: { 0: { done: true }, 1: { done: false } }, chars: { 學: { status: 'mastered' }, 好: { status: 'learning' } }, activity: ['2026-11-01', '2026-11-02'] });
run('JP.resetState({})'); run('JP.migrateFromV1()');
assert.equal(run('JP.state().legacy.lessonsCompleted'), 1);
assert.deepEqual(run('JP.state().legacy.masteredChars'), ['學']);
assert.deepEqual(run('JP.state().knowledge'), {}, '迁移不生成 knowledge');
assert.equal(storage['ziyat-study-v1'].indexOf('"version":1') >= 0, true, 'v1 原样不动');
run('JP.migrateFromV1()');
assert.equal(run('JP.state().legacy.lessonsCompleted'), 1, '幂等');

// ---- 导入校验 ----
const good = run('JP.exportJSON()');
assert.equal(run('JP.validateImport(' + JSON.stringify(good) + ').ok'), true);
assert.equal(run('JP.validateImport({app:"other"}).ok'), false);
assert.equal(run('JP.validateImport({app:"ziyat-jp",schemaVersion:1,state:{}}).ok'), false, '版本不符拒绝');
assert.equal(run('JP.validateImport({app:"ziyat-jp",schemaVersion:2,state:{lessons:{},knowledge:{},attempts:[{questionId:1}]}}).ok'), false, 'attempts 缺字段拒绝');
assert.equal(run('JP.validateImport({app:"ziyat-jp",schemaVersion:2,state:{lessons:{},knowledge:{x:{proficiency:"bad"}},attempts:[]}}).ok'), false);
assert.equal(run('JP.validateImport("not json").ok'), false);

// ---- 完成判定 ----
run('JP.resetState({})');
run("JP.lessonRec('A1')"); run("JP.lessonRec('A1').steps.selfAssessed=true");
assert.equal(run("JP.checkCompletion('A1')"), true, 'A1 无卡无题课：自评即完成');
run('JP.resetState({})');
run("JP.lessonRec('B1')");
assert.equal(run("JP.checkCompletion('B1')"), false, 'B1 未学完');
run(`['initial:b','initial:p','initial:m','initial:f'].forEach(c=>JP.lessonRec('B1').steps.cardsSeen.push(c))`);
assert.equal(run("JP.checkCompletion('B1')"), false, '缺练习/自评/小测');
run(`JPDATA.lessons.find(l=>l.id==='B1').practiceQuestionIds.slice(0,10).forEach(q=>JP.lessonRec('B1').steps.practiceAnswered.push(q))`);
run("JP.lessonRec('B1').steps.selfAssessed=true");
assert.equal(run("JP.checkCompletion('B1')"), false, '缺小测');
run("JP.lessonRec('B1').steps.quizSubmitted=true");
assert.equal(run("JP.checkCompletion('B1')"), true);
assert.equal(run("JP.lessonRec('B1').status"), 'completed');

// ---- 渲染冒烟 ----
run("location.hash='#jp-map'"); run('JP.render()');
assert.ok(elements['#app'].innerHTML.includes('課程地圖'), '地图渲染');
assert.ok(elements['#app'].innerHTML.includes('粵拼入門與音頻'), '粤拼分类渲染');
run("location.hash='#jp-lesson/B6'"); run("JP.lessonRec('B6').lastPosition='cards'"); run('JP.render()');
assert.ok(elements['#app'].innerHTML.includes('最容易錯的 j'), '课程页渲染');
assert.ok(elements['#app'].innerHTML.includes('合成音'), '合成音标注');
assert.ok(elements['#app'].innerHTML.includes('衣 yī'), 'j 卡普通话对比');
run("location.hash='#jp-review'"); run('JP.render()');
assert.ok(elements['#app'].innerHTML.includes('複習'), '复习页渲染');
run("location.hash='#jp-backup'"); run('JP.render()');
assert.ok(elements['#app'].innerHTML.includes('備份'), '备份页渲染');
run("location.hash='#jp-progress'"); run('JP.render()');
assert.ok(elements['#app'].innerHTML.includes('粵拼進度'), '进度页渲染');
run("location.hash='#home'");
const beforeOld = elements['#app'].innerHTML;
run('JP.render()');
assert.equal(elements['#app'].innerHTML, beforeOld, '旧路由下本模块不碰 #app');
run("location.hash=''"); run('JP.render()');

// ---- V3：打字判分 ----
run("location.hash='#jp-typing/fanti'"); assert.deepEqual(run('JP.parseHash()'), { name: 'jp-typing', arg: 'fanti' });
assert.equal(run("JP.gradeQuestion(JP.qById('typing-fanti:学习'),'學習')"), true);
assert.equal(run("JP.gradeQuestion(JP.qById('typing-fanti:学习'),'学习')"), false, '简体不算对');
assert.equal(run("JP.gradeQuestion(JP.qById('typing-fanti:发展'),'發展')"), true);
assert.equal(run("JP.gradeQuestion(JP.qById('typing-fanti:发展'),'髮展')"), false, '发→髮 是错的一对多');
assert.equal(run("JP.gradeQuestion(JP.qById('typing-cc:佢'),'佢')"), true);
assert.equal(run("JP.gradeQuestion(JP.qById('typing-s:s-01'),'佢今日冇返工。')"), true, '标点不判错');
assert.equal(run("JP.gradeQuestion(JP.qById('typing-s:s-01'),'佢今日冇返工 ')"), true, '空格不判错');
assert.equal(run("JP.gradeQuestion(JP.qById('typing-s:s-01'),'佢今日冇返工呀')"), false);

// ---- V3：练习答错入次日复习 ----
run('JP.resetState({})');
run(`JP.applyAnswer(JP.state(),{questionId:'typing-cc:佢',lessonId:'T2',skill:'vocabulary',hintUsed:false,submittedAt:'2026-11-17T10:00:00Z',assessmentMode:'practice',correct:false,answer:'佢'})`);
assert.ok(run("JP.state().knowledge['typing:cc:佢'].nextReviewAt") !== null, '答错入复习队列');
assert.deepEqual(run('JP.dueKnowledge(new Date("2026-11-19T00:00:00Z").getTime())'), ['typing:cc:佢'], '次日到期');
const idx = run('JP.buildKnowledgeIndex()');
assert.ok(idx['typing:cc:佢'].includes('typing-cc:佢'), '打字题进入复习出题索引');

// ---- V3：新页面渲染 ----
ctx.DATA = { lessons: [{ id: 0, week: 1, title: '由「我」開始', characters: ['我', '你', '好'] }] };
run("location.hash='#jp-home'"); run('JP.render()');
assert.ok(elements['#app'].innerHTML.includes('開始粵語打字訓練'), '首页打字入口');
assert.ok(elements['#app'].innerHTML.includes('實際學習進度'), '首页真实进度');
run("location.hash='#jp-map'"); run('JP.render()');
assert.ok(elements['#app'].innerHTML.includes('繁體字基礎'), '地图繁体基础');
assert.ok(elements['#app'].innerHTML.includes('原課程'), '地图含旧课程');
assert.ok(elements['#app'].innerHTML.includes('繁簡易混字'), '地图打字分类');
assert.ok(!elements['#app'].innerHTML.includes('即將推出'), '隐藏即将推出');
run("location.hash='#jp-typing/common'"); run('JP.render()');
assert.ok(elements['#app'].innerHTML.includes('香港粵語常用字'), '常用字页');
assert.ok(elements['#app'].innerHTML.includes('佢'), '常用字内容');
run("location.hash='#jp-typing/ime'"); run('JP.render()');
assert.ok(elements['#app'].innerHTML.includes('輸入法教學'), '输入法页');
assert.ok(elements['#app'].innerHTML.includes('無法可靠檢測'), '不假装检测输入法');
run("location.hash='#jp-cards'"); run('JP.render()');
assert.ok(elements['#app'].innerHTML.includes('粵拼與音頻'), '音频卡页');
assert.ok(elements['#app'].innerHTML.includes('詩'), '六调组');
run("location.hash='#jp-settings'"); run('JP.render()');
assert.ok(elements['#app'].innerHTML.includes('數據管理'), '设置页含数据管理');
assert.ok(elements['#app'].innerHTML.includes('匯出'), '备份在设置页');
run("location.hash='#jp-backup'"); run('JP.render()');
assert.ok(elements['#app'].innerHTML.includes('數據管理'), '旧备份路由重定向到设置');
run("location.hash='#jp-fanti'"); run('JP.render()');
assert.ok(elements['#app'].innerHTML.includes('繁體字學習'), '繁体字学习页');
assert.ok(elements['#app'].innerHTML.includes('由「我」開始'), '繁体页含旧课程列表');
assert.ok(!elements['#app'].innerHTML.includes('12 週'), '繁体页不再展示 12 周框架');
run("location.hash=''"); run('JP.render()');

console.log('PASS: jyutping 路由/判分/抽题/SRS/迁移/导入校验/完成判定/渲染/V3打字判分与新页面。');
