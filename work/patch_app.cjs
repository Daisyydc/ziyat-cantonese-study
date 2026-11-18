// 旧站 app.js 最小补丁：P1 jp 路由分治 + P2 抄写计分题改客观 MCQ。
// 每条补丁的 find 必须恰好出现 1 次才替换；幂等（已应用则跳过）。
const fs = require('fs');
const path = 'dist/app.js';
let src = fs.readFileSync(path, 'utf8');

const patches = [
  {
    name: 'P1 jp 路由分治',
    find: "function render(){let route=location.hash.slice(1)||'home';",
    replace: "function render(){let route=location.hash.slice(1)||'home';if(route.indexOf('jp-')===0)return;",
  },
  {
    name: 'P2 抄写题改客观选择',
    find: '{label:`請用繁體字抄寫：${cs[5].example}`,answer:cs[5].example,t:cs[5].t}',
    replace: '{label:`「${cs[5].s}」對應哪個繁體字？`,answer:cs[5].t,options:[cs[4].t,cs[5].t,cs[3].t],t:cs[5].t}',
  },
  {
    name: 'P3 計劃頁標題改繁體字學習',
    find: "plan:'12 週學習計劃'",
    replace: "plan:'繁體字學習'",
  },
  {
    name: 'P4 默認落地頁改新首頁',
    find: "let route=location.hash.slice(1)||'home';",
    replace: "let route=location.hash.slice(1)||'jp-home';",
  },
  {
    name: 'P5 舊課完成後跳新首頁',
    find: "go('home')",
    replace: "go('jp-home')",
  },
];

let applied = 0;
for (const p of patches) {
  if (src.includes(p.replace)) {
    console.log(`跳过（已应用）: ${p.name}`);
    continue;
  }
  const count = src.split(p.find).length - 1;
  if (count !== 1) {
    console.error(`✗ ${p.name}: find 出现 ${count} 次（必须恰好 1 次）`);
    process.exit(1);
  }
  src = src.replace(p.find, p.replace);
  applied++;
  console.log(`✓ 已应用: ${p.name}`);
}
if (applied) fs.writeFileSync(path, src);
console.log(applied ? `完成，共 ${applied} 条` : '无变化（全部已应用）');
