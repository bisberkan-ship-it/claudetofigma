const fs = require('fs');
const data = JSON.parse(fs.readFileSync('local-library-analysis.json', 'utf8'));

const comps = Object.values(data.components).filter(c => c && c.name);

const keywords = ['slider', 'range', 'slide', 'track', 'progress', 'scrubber', 'knob'];
const sliders = comps.filter(c => keywords.some(k => c.name.toLowerCase().includes(k)));

console.log('=== Slider/Range bileşenleri ===');
if (sliders.length === 0) console.log('(bulunamadı)');
sliders.forEach(c => console.log(c.name, '| key:', c.key));

const chipKeywords = ['chip', 'segment', 'tab', 'toggle', 'select', 'filter'];
const chips = comps.filter(c => chipKeywords.some(k => c.name.toLowerCase().includes(k)));
console.log('\n=== Chip/Segment/Tab bileşenleri (ilk 30) ===');
chips.slice(0, 30).forEach(c => console.log(c.name, '| key:', c.key));

// Also check component sets
const sets = Object.values(data.componentSets).filter(c => c && c.name);
const sliderSets = sets.filter(c => keywords.some(k => c.name.toLowerCase().includes(k)));
console.log('\n=== Component Sets - Slider ===');
sliderSets.forEach(c => console.log(c.name, '| key:', c.key, '| node:', c.node_id));
