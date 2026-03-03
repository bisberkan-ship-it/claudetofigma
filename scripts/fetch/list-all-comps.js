const fs = require('fs');
const data = JSON.parse(fs.readFileSync('local-library-analysis.json', 'utf8'));

console.log('=== Components sample ===');
const comps = Object.entries(data.components);
console.log('Total:', comps.length);
comps.slice(0, 30).forEach(([id, c]) => {
  console.log(c ? c.name : '(null)', '| key:', c ? c.key : '?');
});

console.log('\n=== ComponentSets sample ===');
const sets = Object.entries(data.componentSets);
sets.slice(0, 20).forEach(([id, c]) => {
  console.log(c ? c.name : '(null)', '| key:', c ? c.key : '?');
});
