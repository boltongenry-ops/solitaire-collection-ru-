import test from 'node:test';
import assert from 'node:assert/strict';
import {actions,apply,clone,createGame,type Card} from './engine';
import {fresh,normalizeData,validData,validState} from './storage';
import {freshClub,raceDeal} from './competition';
import {journey,recordWin,recordMove,claimAchievement,claimQuest,quests,weekKey,level,createMarathon,startMarathonStage,finishMarathonStage} from './journey';
const c=(rank:number,suit=0,id=rank):Card=>({rank,suit:suit as Card['suit'],id,up:true});
test('Yukon deals 52 cards with 31 open cards, no stock and correct column sizes',()=>{
 const s=createGame('yukon',26);assert.deepEqual(s.columns.map(p=>p.length),[1,6,7,8,9,10,11]);assert.equal(s.columns.flat().filter(c=>c.up).length,31);assert.equal(s.stock.length,0);assert.equal(apply(s,{type:'draw'}),null);assert(validState(s));
});
test('Yukon transfers unordered groups but enforces placement, king-only empties and source exposure',()=>{
 const s=createGame('yukon',2);s.columns=Array.from({length:7},()=>[]);s.columns[0]=[{...c(4,0,4),up:false},c(9,0,9),c(2,1,2),c(12,0,12)];s.columns[1]=[c(10,1,10)];const a={type:'move' as const,from:{zone:'columns' as const,pile:0,index:1},to:{zone:'columns' as const,pile:1}};
 const n=apply(s,a)!;assert(n);assert.equal(n.columns[1].length,4);assert(n.columns[0][0].up);assert(!s.columns[0][0].up);assert.equal(apply(s,{...a,to:{zone:'columns',pile:2}}),null);s.columns[0][1]=c(13);assert(apply(s,{...a,to:{zone:'columns',pile:2}}));
});
test('Golf exposes only the top card, forbids ace–king wrap and wins after all columns clear',()=>{
 const s=createGame('golf',5);assert.equal(s.columns.flat().length,35);assert.equal(s.stock.length,16);assert.equal(s.waste.length,1);assert(validState(s));
 s.columns=Array.from({length:7},()=>[]);s.columns[0]=[c(3,0,3),c(2,1,2)];s.waste=[c(4,0,4)];s.stock=[];assert.equal(apply(s,{type:'pair',ids:[3]}),null);s.waste=[c(1,0,1)];const n=apply(s,{type:'pair',ids:[2]})!;assert(n);assert.equal(n.columns[0].length,1);assert(apply(n,{type:'pair',ids:[3]})!.won);s.columns[0]=[c(13,0,13)];assert.equal(apply(s,{type:'pair',ids:[13]}),null);assert.equal(apply(s,{type:'draw'}),null);
});
test('both new games preserve all cards throughout seeded legal play',()=>{
 for(const g of ['yukon','golf'] as const)for(let seed=1;seed<=8;seed++){let s=createGame(g,seed);for(let i=0;i<80;i++){const before=clone(s),list=actions(s);if(!list.length)break;const n=apply(s,list[(i*7+seed)%list.length])!;assert(validState(n));assert.deepEqual(s,before);s=n;}}
});
test('experience and mastery award once per unique result, with accurate clean and speed bonuses',()=>{
 const d=fresh();const event={key:'solo:1',game:'golf' as const,kind:'solo' as const,seconds:120,hints:0,undos:0};assert.equal(recordWin(d,event,'2026-11-17'),160);assert.equal(recordWin(d,event,'2026-11-17'),0);const j=journey(d);assert.equal(j.totals.wins,1);assert.equal(j.totals.clean,1);assert.equal(j.mastery.golf!.xp,160);assert.equal(j.days['2026-11-17'].wins,1);assert.equal(recordWin(d,{...event,key:'solo:2',hints:1,seconds:600},'2026-11-17'),100);assert.equal(j.totals.clean,1);
});
test('achievement rewards cannot be claimed early or more than once',()=>{
 const d=fresh();d.club=freshClub();assert(!claimAchievement(d,'first'));recordWin(d,{key:'win',game:'yukon',kind:'solo',seconds:500,hints:0,undos:1},'2026-11-17');assert(claimAchievement(d,'first'));assert.equal(d.club.coins,280);assert.equal(journey(d).xp,160);assert(!claimAchievement(d,'first'));assert(!claimAchievement(d,'missing'));assert.equal(d.club.coins,280);
});
test('daily and weekly tasks use Moscow day keys, and old daily tasks cannot be claimed next day',()=>{
 const d=fresh();for(let i=0;i<30;i++)recordMove(d,'2026-11-22');let q=quests(d,'2026-11-22').find(q=>q.id.endsWith(':moves'))!;assert.equal(q.value,30);assert(!claimQuest(d,q.id,'2026-11-23'));assert(claimQuest(d,q.id,'2026-11-22'));assert(!claimQuest(d,q.id,'2026-11-22'));assert.equal(quests(d,'2026-11-23').find(q=>q.id.endsWith(':moves'))!.value,0);assert.equal(weekKey('2026-11-22'),'2026-11-16');assert.equal(weekKey('2026-11-23'),'2026-11-23');
 recordWin(d,{key:'week-win',game:'golf',kind:'duel',seconds:600,hints:0,undos:0},'2026-11-22');assert.equal(quests(d,'2026-11-23').find(q=>q.id.endsWith(':duel'))!.value,0);
});
test('retained recent activity is bounded while lifetime totals and XP remain correct',()=>{
 const d=fresh();for(let i=0;i<25;i++){const dt=new Date('2026-10-01T12:00:00Z');dt.setUTCDate(dt.getUTCDate()+i);recordWin(d,{key:String(i),game:'klondike',kind:'solo',seconds:600,hints:0,undos:1},dt.toISOString().slice(0,10));}const j=journey(d);assert.equal(Object.keys(j.days).length,14);assert.equal(j.recent.length,18);assert.equal(j.totals.wins,25);assert.equal(j.xp,2500);assert(validData(d));
});
test('marathon progresses only after real wins and pays its final bonus once',()=>{
 const d=fresh(),j=journey(d),m=createMarathon(42);j.marathon=m;d.club=freshClub();for(let stage=0;stage<3;stage++){m.stage=stage;startMarathonStage(m);assert(validState(m.session!.state));assert(!finishMarathonStage(d));m.session!.state.won=true;assert(finishMarathonStage(d));assert(!finishMarathonStage(d));assert.equal(m.cleared.length,stage+1);}assert(m.complete);assert.equal(d.club.coins,240+3*60+180);assert.equal(j.xp,250);assert(validData(JSON.parse(JSON.stringify(d))));
});
test('marathon retry changes only the current deal and keeps the completed stages',()=>{
 const m=createMarathon(43);m.stage=1;m.cleared=[0];startMarathonStage(m);const before=clone(m.session!.state);m.attempt=1;startMarathonStage(m);assert.notDeepEqual(m.session!.state,before);assert.deepEqual(m.cleared,[0]);assert(validState(m.session!.state));
});
test('legacy 1.0 saves migrate without losing sessions, wins, coins or purchased backs',()=>{
 const d=fresh();Reflect.deleteProperty(d.stats,'yukon');Reflect.deleteProperty(d.stats,'golf');d.stats.klondike.won=3;d.stats.klondike.played=4;d.club=freshClub();d.club.coins=890;d.club.owned.push('royal');d.sessions.klondike={state:createGame('klondike',8),initial:createGame('klondike',8),history:[],seconds:30,daily:null,counted:false};assert(validData(d));const migrated=normalizeData(d);const j=journey(migrated);assert.equal(j.xp,300);assert.equal(migrated.club!.coins,890);assert(migrated.club!.owned.includes('royal'));assert.equal(migrated.sessions.klondike!.state.seed,8);assert.equal(migrated.stats.golf.played,0);assert(validData(migrated));
});
test('corrupted journey state is rejected, valid profile survives JSON roundtrip',()=>{
 const d=fresh();journey(d);assert(validData(JSON.parse(JSON.stringify(d))));d.journey!.xp=-1;assert.equal(validData(d),false);d.journey!.xp=20;d.journey!.marathon=createMarathon(1);d.journey!.marathon.games=['spider','golf','golf'];assert.equal(validData(d),false);
});
test('level curve increases requirements monotonically with no level decreases',()=>{
 assert.equal(level(0).level,1);assert.equal(level(199).level,1);assert.equal(level(200).level,2);assert.equal(level(449).level,2);assert.equal(level(450).level,3);assert(level(10000).level>level(1000).level);assert(level(10000).percent<=100);
});
test('migration remembers paid legacy results so replay cannot grant XP a second time',()=>{
 const d=fresh();d.stats.klondike.played=1;d.stats.klondike.won=1;d.club=freshClub();d.club.rewards=['solo:klondike:42','race:91:lev','tower:old:1'];const j=journey(d),xp=j.xp;assert(j.processed.includes('solo:klondike:42'));assert(j.processed.includes('duel:91:lev'));assert.equal(recordWin(d,{key:'solo:klondike:42',game:'klondike',kind:'solo',seconds:50,hints:0,undos:0},'2026-11-17'),0);assert.equal(j.xp,xp);
});
