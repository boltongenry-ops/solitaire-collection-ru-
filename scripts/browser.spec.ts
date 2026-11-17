import {test,expect,type Page} from '@playwright/test';
import {readFileSync,mkdirSync} from 'node:fs';
import {createGame,shuffled,clone,type Game,type State} from '../src/engine';
import {fresh,validData,moscowDate,dailySeed,type Data} from '../src/storage';
const key='solitaire-collection-ru-v1';
async function stored(page:Page):Promise<Data>{return page.evaluate(k=>JSON.parse(localStorage.getItem(k)!),key);}
async function inject(page:Page,g:Game,s:State){const d=fresh();d.last=g;d.stats[g].played=1;d.sessions[g]={state:s,initial:clone(s),history:[],seconds:1,daily:null,counted:false};await page.addInitScript(({k,d})=>localStorage.setItem(k,JSON.stringify(d)),{k:key,d});}
test('collection, Russian navigation and mobile layout',async({page})=>{
  const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));await page.goto('/');await expect(page.getByRole('heading',{name:'Игра в удовольствие'})).toBeVisible();await expect(page.locator('.game-tile')).toHaveCount(7);
  const artifacts=process.env.CI?'artifacts':'/workspace/artifacts';mkdirSync(artifacts,{recursive:true});await page.screenshot({path:artifacts+'/solitaire-home.png',fullPage:true});
  await page.setViewportSize({width:390,height:844});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBeTruthy();await page.screenshot({path:artifacts+'/solitaire-mobile.png',fullPage:true});
  await page.locator('[data-nav="stats"]').first().click();await expect(page.getByRole('heading',{name:'Ваши маленькие победы'})).toBeVisible();await expect(page.locator('tbody tr')).toHaveCount(7);expect(errors).toEqual([]);
});
for(const [g,cards] of [['klondike',28],['spider',54],['freecell',52],['pyramid',28],['tripeaks',28],['yukon',52],['golf',35]] as const)test(`${g}: real board, rules, hint and no runtime errors`,async({page})=>{
  const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));await page.goto('/');await page.locator(`.game-tile[data-game="${g}"]`).click();await expect(page.locator('.game-table')).toBeVisible();
  await expect(page.locator('.columns .card,.triangle-cards .card')).toHaveCount(cards);await page.locator('[data-action="rules"]').click();await expect(page.getByRole('dialog')).toBeVisible();await page.keyboard.press('Escape');await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.locator('[data-action="hint"]').click();await expect(page.locator('#toast')).toHaveClass(/show/);await expect(page.locator('.hinted')).not.toHaveCount(0);
  if(g==='klondike')await page.screenshot({path:(process.env.CI?'artifacts':'/workspace/artifacts')+'/solitaire-table.png',fullPage:true});
  await page.setViewportSize({width:390,height:844});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBeTruthy();
  expect(errors).toEqual([]);
});
test('loaded production app plays all seven games with the network disabled',async({page,context})=>{
  await page.goto('/');await page.locator('.game-tile[data-game="klondike"]').click();await page.locator('.nav-item[data-nav="home"]').click();await context.setOffline(true);await expect(page.getByRole('heading',{name:'Игра в удовольствие'})).toBeVisible();await page.locator('.game-tile[data-game="klondike"]').click();await page.locator('[data-action="draw"]').click();await expect(page.locator('.waste .card')).toHaveCount(1);expect((await stored(page)).sessions.klondike!.state.moves).toBe(1);for(const g of ['spider','freecell','pyramid','tripeaks','yukon','golf']){await page.locator(`[data-game="${g}"]`).first().click();await expect(page.locator('.game-table')).toBeVisible();}
});
test('draw, undo, persistence and pause timer',async({page})=>{
  await page.goto('/');await page.locator('.game-tile[data-game="klondike"]').click();const before=(await stored(page)).sessions.klondike!.state;
  await page.locator('[data-action="draw"]').click();await expect(page.locator('.waste .card')).toHaveCount(1);const after=(await stored(page)).sessions.klondike!.state;expect(after.moves).toBe(1);expect(after.stock.length).toBe(23);
  await page.reload();await page.locator('.hero [data-game]').click();await expect(page.locator('.waste .card')).toHaveCount(1);await page.locator('[data-action="undo"]').click();expect((await stored(page)).sessions.klondike!.state).toEqual(before);
  await page.locator('[data-action="pause"]').first().click();const timer=await page.locator('#timer').textContent();await page.waitForTimeout(1200);await expect(page.locator('#timer')).toHaveText(timer!);await page.locator('.pause-overlay [data-action="pause"]').click();await expect(page.locator('.pause-overlay')).toHaveCount(0);
});
test('freecell click transfer and drag/drop with exact undo',async({page})=>{
  await page.goto('/');await page.locator('.game-tile[data-game="freecell"]').click();const before=(await stored(page)).sessions.freecell!.state;const last=before.columns[0].length-1;
  await page.locator(`[data-card="columns:0:${last}"]`).click();await page.locator('[data-target="cells:0"]').click();await expect(page.locator('[data-target="cells:0"] .card')).toHaveCount(1);
  await page.locator('[data-action="undo"]').click();expect((await stored(page)).sessions.freecell!.state).toEqual(before);
  await page.locator(`[data-card="columns:0:${last}"]`).dragTo(page.locator('[data-target="cells:1"]'));await expect(page.locator('[data-target="cells:1"] .card')).toHaveCount(1);
});
test('pyramid removes pairs and king, undo restores removed cards',async({page})=>{
  const s=createGame('pyramid',50),deck=shuffled(50).map(c=>({...c,up:true}));const five=deck.find(c=>c.rank===5)!,eight=deck.find(c=>c.rank===8)!,king=deck.find(c=>c.rank===13)!;s.columns=s.columns.map(()=>[]);s.columns[21]=[five];s.columns[22]=[eight];s.columns[23]=[king];s.stock=deck.filter(c=>![five.id,eight.id,king.id].includes(c.id));s.waste=[];
  await inject(page,'pyramid',s);await page.goto('/');await page.locator('.hero [data-game]').click();await page.locator(`[data-id="${five.id}"]`).click();await page.locator(`[data-id="${eight.id}"]`).click();await expect(page.locator('.triangle-cards .card')).toHaveCount(1);
  await page.locator('[data-action="undo"]').click();await expect(page.locator('.triangle-cards .card')).toHaveCount(3);expect((await stored(page)).sessions.pyramid!.state).toEqual(s);
  await page.locator(`[data-id="${king.id}"]`).click();await expect(page.locator('.triangle-cards .card')).toHaveCount(2);
});
test('foundation victory persists stats once, including after replay',async({page})=>{
  const s=createGame('klondike',1),deck=shuffled(1).map(c=>({...c,up:true}));s.columns=s.columns.map(()=>[]);s.stock=[];s.foundations=Array.from({length:4},(_,suit)=>deck.filter(c=>c.suit===suit).sort((a,b)=>a.rank-b.rank));const last=s.foundations[3].pop()!;s.columns[0]=[last];
  await inject(page,'klondike',s);await page.goto('/');await page.locator('.hero [data-game]').click();await page.locator('[data-action="auto"]').click();await expect(page.getByRole('heading',{name:'Всё сложилось!'})).toBeVisible();expect((await stored(page)).stats.klondike.won).toBe(1);
  await page.keyboard.press('Escape');await page.locator('[data-action="new"]').click();await page.locator('[data-action="restart"]').click();await page.locator('[data-action="auto"]').click();expect((await stored(page)).stats.klondike.won).toBe(1);
});
test('daily seed is deterministic and uses fixed options',async({page})=>{
  await page.goto('/');await page.locator('[data-nav="daily"]').first().click();await page.locator('[data-daily="spider"]').click();const d=await stored(page);const se=d.sessions.spider!;expect(se.daily).toBe(moscowDate());expect(se.state).toEqual(createGame('spider',dailySeed(moscowDate(),'spider'),{suits:1}));
});
test('settings, backup export and validated import',async({page})=>{
  await page.goto('/');await page.locator('[data-nav="settings"]').first().click();await page.locator('[data-theme="midnight"]').click();await page.locator('[data-back="diamond"]').click();await page.locator('[data-toggle="sound"]').click();
  const download=page.waitForEvent('download');await page.locator('[data-action="export"]').click();const path=await (await download).path();const exported=JSON.parse(readFileSync(path!,'utf8'));expect(validData(exported)).toBeTruthy();expect(exported.settings.theme).toBe('midnight');
  await page.locator('[data-theme="plum"]').click();page.once('dialog',dialog=>dialog.accept());await page.locator('#import-file').setInputFiles({name:'backup.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(exported))});await expect(page.locator('[data-theme="midnight"]')).toHaveClass(/chosen/);
  await page.locator('#import-file').setInputFiles({name:'broken.json',mimeType:'application/json',buffer:Buffer.from('{"version":99}')});await expect(page.locator('#toast')).toContainText('повреждён');
});
