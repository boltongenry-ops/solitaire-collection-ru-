import test from 'node:test';
import assert from 'node:assert/strict';
import {actions,apply,clone,createGame} from './engine';
import {award,bots,botStep,clearFloor,finishRace,freshClub,joinTower,league,newRace,purchase,raceDeal,startFloor,towerRules} from './competition';
import {fresh,games,validData,validState} from './storage';
test('constructed duel deals have standard shape and an executable foundation solution',()=>{
 for(let seed=0;seed<35;seed++){
  let s=raceDeal(seed);assert(validState(s));assert.deepEqual(s.columns.map(p=>p.length),[1,2,3,4,5,6,7]);assert.equal(s.stock.length,24);
  for(let i=0;i<1000&&!s.won;i++){const options=actions(s);const a=options.find(a=>a.type==='move'&&a.to.zone==='foundations')??options.find(a=>a.type==='draw');assert(a,`seed ${seed}`);s=apply(s,a)!;assert(validState(s));}assert(s.won,`seed ${seed} did not finish`);
 }
});
test('all six bot personalities finish a real game without losing cards',()=>{
 const times:number[]=[];
 for(const b of bots){const r=newRace(b.id,12571);assert.deepEqual(r.bot,r.player.state);for(let second=0;second<6000&&!r.bot.won;second++){r.player.seconds=second;botStep(r);assert(validState(r.bot));}assert(r.bot.won,b.name);times.push(r.player.seconds);}
 assert(new Set(times).size>=5);assert(times[0]>times[4]);
});
test('bot decision scheduling pauses, makes reversible mistakes and preserves human board',()=>{
 const r=newRace('mark',112),before=clone(r.player.state);let recovered=false,paused=false;
 for(let i=0;i<2000&&!r.bot.won;i++){r.player.seconds=i;const was=r.recover;botStep(r);if(was&&!r.recover)recovered=true;if(r.nextAt-i>5)paused=true;}
 assert(recovered);assert(paused);assert.deepEqual(r.player.state,before);
});
test('coins, purchases and rewards are persistent and idempotent',()=>{
 const c=freshClub();assert.equal(c.coins,240);assert.equal(purchase(c,'sakura'),'bought');assert.equal(c.coins,120);assert.equal(purchase(c,'sakura'),'owned');assert.equal(c.coins,120);assert.equal(purchase(c,'royal'),'poor');assert.equal(purchase(c,'unknown'),'unknown');
 assert.equal(award(c,'win:123',60),60);assert.equal(award(c,'win:123',60),0);assert.equal(c.coins,180);assert(c.owned.includes('sakura'));
});
test('duel result settles rating and coins only once',()=>{
 const c=freshClub();c.race=newRace('lev',77);c.race.player.seconds=123;assert.equal(finishRace(c,'win'),120);assert.equal(c.rating,1024);assert.equal(c.played,1);assert.equal(c.won,1);assert.equal(c.race.finishedAt,123);assert.equal(finishRace(c,'win'),0);assert.equal(c.coins,360);c.race=newRace('alisa',78);finishRace(c,'loss');assert.equal(c.rating,1012);assert.equal(c.won,1);assert.equal(c.played,2);
});
test('fictional league is deterministic within a day and updates ratings and ranks next day',()=>{
 const c=freshClub(),a=league('2026-11-17',c),b=league('2026-11-18',c);assert.deepEqual(a,league('2026-11-17',c));assert.notDeepEqual(a,b);assert.equal(a.length,17);assert.equal(a.filter(r=>r.player).length,1);assert(a.every((r,i)=>r.rank===i+1));assert(b.some(r=>r.movement!==0));assert.equal(a.find(r=>r.player)!.rating,c.rating);assert(a.some(r=>r.delta!==0));
});
test('all seven towers have seven increasingly strict levels with valid decks',()=>{
 for(const g of games){const t=joinTower(g);let hints=100,undos=100;
  for(let floor=1;floor<=7;floor++){t.floor=floor;startFloor(t,100+floor);assert(validState(t.session!.state));const r=towerRules(g,floor);assert(r.hints<=hints);assert(r.undos<=undos);hints=r.hints;undos=r.undos;assert.equal(t.hintUsed,0);assert.equal(t.undoUsed,0);assert(!t.failed);}
 }
 assert.equal(towerRules('spider',7).suits,4);assert.equal(towerRules('freecell',7).lockedCells,2);assert.equal(towerRules('pyramid',7).recycles,0);assert.equal(towerRules('klondike',7).drawCount,3);assert(towerRules('tripeaks',7).seconds<towerRules('tripeaks',2).seconds);
});
test('tower restrictions change engine legality and cannot be bypassed by moving a sequence',()=>{
 const t=joinTower('freecell');t.floor=7;startFloor(t,1);const s=t.session!.state,from={zone:'columns' as const,pile:0,index:s.columns[0].length-1};assert(apply(s,{type:'move',from,to:{zone:'cells',pile:0}}));assert.equal(apply(s,{type:'move',from,to:{zone:'cells',pile:3}}),null);
 const p=createGame('pyramid',1);p.stock=[];p.redealLimit=0;p.waste=[p.columns[27].pop()!];assert.equal(apply(p,{type:'draw'}),null);
});
test('clearing a floor grants exactly one reward and leaves other towers untouched',()=>{
 const c=freshClub(),t=joinTower('tripeaks');c.towers.tripeaks=t;startFloor(t,55);assert.equal(clearFloor(c,t),0);t.session!.state.won=true;assert.equal(clearFloor(c,t),75);assert.deepEqual(t.cleared,[1]);assert.equal(clearFloor(c,t),0);assert.equal(c.coins,315);assert.equal(c.towers.spider,undefined);
});
test('legacy data migrates and complete club state validates and survives roundtrip',()=>{
 const d=fresh();assert(validData(d));d.club=freshClub();d.club.race=newRace('sonya',12);d.club.towers.pyramid=joinTower('pyramid');startFloor(d.club.towers.pyramid,55);assert(validData(JSON.parse(JSON.stringify(d))));
 d.club.coins=-1;assert.equal(validData(d),false);d.club.coins=12;d.club.race.bot.stock[0].rank=100;assert.equal(validData(d),false);
});
