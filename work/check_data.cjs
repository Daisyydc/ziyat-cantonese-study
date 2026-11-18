// 校验 dist/jyutping-data.js bundle 完整性
const fs = require('fs'), vm = require('vm'), assert = require('assert');
const context = vm.createContext({ window: {}, console });
vm.runInContext(fs.readFileSync('dist/jyutping-data.js', 'utf8'), context);
const D = context.window.JPDATA;
assert.ok(D && D.meta && D.meta.schema === 'site-bundle-1', 'JPDATA 加载失败');
assert.equal(D.questions.length, 1638, '题目总数（1578 粵拼 + 60 打字）');
assert.equal(new Set(D.questions.map(q => q.id)).size, 1638, '题目 id 唯一');
assert.ok(D.typing && D.typing.fanti.length === 36 && D.typing.commonChars.length === 14 && D.typing.sentences.length === 10, '打字内容完整');
assert.equal(D.lessons.length, 38, '课程数');
assert.equal(D.cards.initials.length + D.cards.finals.length + D.cards.tones.length, 81, '卡片数');
const approved = new Set(D.questions.filter(q => q.reviewStatus === 'approved').map(q => q.id));
assert.equal(approved.size, 714, 'approved 题数');
for (const l of D.lessons) {
  assert.ok(D.stages.some(s => s.id === l.stage), `${l.id} 阶段存在`);
  for (const qid of l.quizQuestionIds) assert.ok(approved.has(qid), `${l.id} 小测含非 approved: ${qid}`);
  for (const qid of [...l.practiceQuestionIds, ...l.quizQuestionIds]) assert.ok(D.questions.some(q => q.id === qid), `${l.id} 题缺失: ${qid}`);
}
const audioSet = new Set(Object.keys(D.audio.files));
for (const [syl, path] of Object.entries(D.audio.files)) {
  assert.ok(fs.existsSync('dist/' + path), `音频文件缺失: ${path}`);
}
const checkCardAudio = c => { for (const e of c.examples) { assert.ok(audioSet.has(e.audio.split('/')[1].replace('.wav', '')), `${c.id} 例字音频坏链: ${e.jyutping}`); } };
[...D.cards.initials, ...D.cards.finals, ...D.cards.tones].forEach(checkCardAudio);
for (const e of D.cards.overview.minimalSet) assert.ok(e.audio, '六调组缺音频');
for (const l of D.lessons) for (const vid of l.vocabIds) assert.ok(D.vocab.some(v => v.id === vid), `${l.id} vocab 缺失: ${vid}`);
assert.ok(D.audio.synthetic === true, '合成音标记');
console.log('PASS: bundle 完整 —', D.questions.length, '题 /', D.lessons.length, '课 /', D.cards.initials.length + D.cards.finals.length + D.cards.tones.length, '卡 /', Object.keys(D.audio.files).length, '音频 /', D.vocab.length, 'vocab');
