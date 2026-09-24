const {JSDOM}=require('jsdom');const fs=require('fs');const assert=require('node:assert/strict');const html=fs.readFileSync('index.html','utf8');
function open(shared=false,saved){return new JSDOM(html,{url:'https://example.com/'+(shared?'#sheet=00000000-0000-0000-0000-000000000001':''),runScripts:'dangerously',beforeParse(w){w.confirm=()=>true;if(saved)w.localStorage.setItem('refleet_trpg_staff_sheet_v01',JSON.stringify(saved));}})}
const d=open(),w=d.window,q=s=>w.document.querySelector(s);const click=n=>[...w.document.querySelectorAll('button')].find(b=>b.getAttribute('aria-label')===n).click();
click('体力の成長値を増やす');click('体力の成長値を増やす');click('運動の成長値を増やす');click('運動の成長値を増やす');click('運動の成長値を増やす');
assert.match(q('#parameterOutput').value,/体力=4/);assert.match(q('#chatPaletteOutput').value,/\/\/運動=3/);assert.match(q('#abilityPreview').textContent,/体力4/);assert.match(q('#skillPreview').textContent,/運動3/);
q('[data-key=customSkillName]').value='料理';q('[data-key=customSkillName]').dispatchEvent(new w.Event('input'));click('自由技能の成長値を増やす');assert.match(q('#chatPaletteOutput').value,/\/\/料理=1/);
const saved=w.RefleetSheet.snapshot();assert.equal(saved.abilities.body,2);assert.equal(saved.abilityGrowth.body,2);assert.equal(saved.skillGrowth.exercise,3);
const r=open(false,saved);assert.match(r.window.document.querySelector('#parameterOutput').value,/体力=4/);
const shared=open(true);shared.window.RefleetSheet.load(JSON.parse(JSON.stringify(saved)));assert.match(shared.window.document.querySelector('#skillPreview').textContent,/運動3/);assert.equal(shared.window.localStorage.length,0);
const legacy=JSON.parse(JSON.stringify(saved));delete legacy.abilityGrowth;delete legacy.skillGrowth;w.RefleetSheet.load(legacy);assert.match(q('#parameterOutput').value,/体力=2/);assert.equal(q('#growth-abilities-body').value,'0');
const bad=JSON.parse(JSON.stringify(saved));bad.skillGrowth.exercise=-1;assert.throws(()=>w.RefleetSheet.load(bad));assert.match(q('#parameterOutput').value,/体力=2/);
w.RefleetSheet.load(saved);q('#resetBtn').click();assert.equal(q('#growth-abilities-body').value,'0');
for(const x of [d,r,shared])x.window.close();console.log('PASS growth: totals, palette, custom skill, JSON round trip, local reload, shared view, legacy data, invalid data, reset');
