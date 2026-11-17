import test from 'node:test';
import assert from 'node:assert/strict';
import {actions,apply,canMove,clone,createGame,exposed,hint,shuffled,type Card,type Game,type State} from './engine';
import {dailySeed,fresh,games,moscowDate,validData,validState} from './storage';
const card=(rank:number,suit=0,id=rank,up=true):Card=>({rank,suit:suit as Card['suit'],id,up});
function empty(game:Game){const s=createGame(game,1);s.columns=s.columns.map(()=>[]);s.stock=[];s.waste=[];s.cells=s.cells.map(()=>[]);s.foundations=s.foundations.map(()=>[]);return s;}
test('all seven games deal the correct deck, layout, faces and deterministic seed',()=>{
  for(const g of games){const s=createGame(g,1741);assert(validState(s));assert.deepEqual(s,createGame(g,1741));assert.notDeepEqual(shuffled(1741),shuffled(1742));}
  const k=createGame('klondike',1);assert.deepEqual(k.columns.map(p=>p.length),[1,2,3,4,5,6,7]);assert.equal(k.columns.flat().filter(c=>c.up).length,7);assert.equal(k.stock.length,24);
  const spider=createGame('spider',1);assert.equal(spider.stock.length,50);assert.equal(spider.columns.flat().length,54);assert.equal(new Set(spider.columns.flat().map(c=>c.suit)).size,1);
  assert.deepEqual(createGame('freecell',1).columns.map(p=>p.length),[7,7,7,7,6,6,6,6]);
  assert.equal(createGame('pyramid',1).stock.length,24);assert.equal(createGame('tripeaks',1).stock.length,23);
});
test('klondike alternates colors, requires descending runs and only kings in empty columns',()=>{
  const s=empty('klondike');s.columns[0]=[card(9,0),card(8,1)];s.columns[1]=[card(10,1)];
  assert(canMove(s,{zone:'columns',pile:0,index:0},{zone:'columns',pile:1}));
  assert(!canMove(s,{zone:'columns',pile:0,index:1},{zone:'columns',pile:1}));
  assert(!canMove(s,{zone:'columns',pile:0,index:0},{zone:'columns',pile:2}));
  s.columns[0]=[card(13)];assert(canMove(s,{zone:'columns',pile:0,index:0},{zone:'columns',pile:2}));
  s.columns[0]=[card(9,0),card(8,0)];assert(!canMove(s,{zone:'columns',pile:0,index:0},{zone:'columns',pile:1}));
});
test('foundations start with ace, follow suit, reject multiple cards and uncover source',()=>{
  let s=empty('klondike');s.columns[0]=[card(7,0,9,false),card(1,1,1)];const from={zone:'columns' as const,pile:0,index:1},to={zone:'foundations' as const,pile:1};
  const next=apply(s,{type:'move',from,to})!;assert.equal(next.foundations[1][0].rank,1);assert(next.columns[0][0].up);assert.equal(next.score,15);assert.equal(s.columns[0].length,2);assert(!s.columns[0][0].up);
  s=next;s.columns[1]=[card(2,0)];assert(!canMove(s,{zone:'columns',pile:1,index:0},to));s.columns[1]=[card(2,1)];assert(canMove(s,{zone:'columns',pile:1,index:0},to));
});
test('draw three, waste top restriction and recycling retain deck order',()=>{
  const s=empty('klondike');s.drawCount=3;s.stock=[card(2,0,1,false),card(3,0,2,false),card(4,0,3,false),card(5,0,4,false)];
  const a=apply(s,{type:'draw'})!;assert.deepEqual(a.waste.map(c=>c.rank),[5,4,3]);assert.equal(a.stock.length,1);
  assert(!canMove(a,{zone:'waste',pile:0,index:0},{zone:'columns',pile:0}));
  const b=apply(a,{type:'draw'})!,c=apply(b,{type:'draw'})!;assert.equal(c.waste.length,0);assert.deepEqual(c.stock.map(c=>c.rank),[2,3,4,5]);assert.equal(c.recycles,1);
});
test('freecell transfer capacity excludes empty destination and supports single cells',()=>{
  const s=empty('freecell');s.columns=Array.from({length:8},()=>[card(13)]);s.columns[0]=[card(9,0),card(8,1),card(7,0)];s.columns[1]=[];s.cells=[[card(2)],[card(3)],[card(4)],[]];
  const from={zone:'columns' as const,pile:0,index:0},to={zone:'columns' as const,pile:1};assert(!canMove(s,from,to));
  s.cells[2]=[];assert(canMove(s,from,to));s.cells[2]=[card(4)];s.columns[2]=[];assert(canMove(s,from,to));
  assert(!canMove(s,from,{zone:'cells',pile:3}));assert(canMove(s,{...from,index:2},{zone:'cells',pile:3}));assert(!canMove(s,{...from,index:2},{zone:'cells',pile:0}));
});
test('spider permits mixed-suit placement but only moves same-suit sequences',()=>{
  const s=empty('spider');s.columns[0]=[card(8,0),card(7,1)];s.columns[1]=[card(9,1)];
  assert(!canMove(s,{zone:'columns',pile:0,index:0},{zone:'columns',pile:1}));s.columns[0][1].suit=0;assert(canMove(s,{zone:'columns',pile:0,index:0},{zone:'columns',pile:1}));
  s.foundations[0]=Array.from({length:13},(_,i)=>card(13-i));s.columns[2]=[card(2)];assert(!canMove(s,{zone:'foundations',pile:0,index:12},{zone:'columns',pile:2}));
});
test('spider completes K–A automatically, reveals source and blocks dealing into empty columns',()=>{
  const s=empty('spider');s.columns[0]=[card(3,0,55,false),...Array.from({length:12},(_,i)=>card(13-i))];s.columns[1]=[card(1)];
  const next=apply(s,{type:'move',from:{zone:'columns',pile:1,index:0},to:{zone:'columns',pile:0}})!;assert.equal(next.foundations[0].length,13);assert.equal(next.columns[0].length,1);assert(next.columns[0][0].up);assert.equal(next.score,100);
  const dealt=createGame('spider',10);dealt.columns[0]=[];assert.equal(apply(dealt,{type:'draw'}),null);
  const normal=createGame('spider',10);const n=apply(normal,{type:'draw'})!;assert.equal(n.stock.length,40);for(let i=0;i<10;i++)assert.equal(n.columns[i].length,normal.columns[i].length+1);
});
test('pyramid exposes cards only after both children clear and enforces sum 13',()=>{
  const s=createGame('pyramid',20);assert(!exposed(s,14));assert(exposed(s,21));s.columns[19]=[];assert(!exposed(s,14));s.columns[20]=[];assert(exposed(s,14));
  const p=empty('pyramid');p.columns[21]=[card(5,0,5)];p.columns[22]=[card(8,1,8)];p.columns[23]=[card(13,2,13)];p.columns[24]=[card(9,3,9)];
  assert.equal(apply(p,{type:'pair',ids:[5,9]}),null);assert.equal(apply(p,{type:'pair',ids:[5,5]}),null);const next=apply(p,{type:'pair',ids:[5,8]})!;assert.equal(next.removed.length,2);assert.equal(next.score,20);assert.equal(apply(p,{type:'pair',ids:[13]})!.removed.length,1);
});
test('pyramid can pair reserve with table; reserve allows exactly two recycles',()=>{
  const s=empty('pyramid');s.columns[27]=[card(12,0,12)];s.waste=[card(1,1,1)];assert(apply(s,{type:'pair',ids:[12,1]})!.won);
  s.recycles=1;assert(apply(s,{type:'draw'}));s.recycles=2;assert.equal(apply(s,{type:'draw'}),null);
});
test('tripeaks dependency graph, ace wrap and finite stock',()=>{
  const s=createGame('tripeaks',34);assert(!exposed(s,0));assert(exposed(s,18));s.columns[18]=[];assert(!exposed(s,9));s.columns[19]=[];assert(exposed(s,9));
  const t=empty('tripeaks');t.columns[27]=[card(13,0,13)];t.waste=[card(1,1,1)];const n=apply(t,{type:'pair',ids:[13]})!;assert(n.won);assert.equal(n.waste.at(-1)?.rank,13);
  t.columns[27]=[card(2,0,2)];assert(apply(t,{type:'pair',ids:[2]}));t.columns[27]=[card(3,0,3)];assert.equal(apply(t,{type:'pair',ids:[3]}),null);assert.equal(apply(t,{type:'draw'}),null);
});
test('winning moves work for foundation games and completed games reject further moves',()=>{
  for(const g of ['klondike','freecell'] as const){const s=empty(g);s.foundations=Array.from({length:4},(_,suit)=>Array.from({length:suit===3?12:13},(_,r)=>card(r+1,suit,suit*13+r)));s.columns[0]=[card(13,3,51)];const n=apply(s,{type:'move',from:{zone:'columns',pile:0,index:0},to:{zone:'foundations',pile:3}})!;assert(n.won);assert.equal(apply(n,{type:'draw'}),null);assert.deepEqual(actions(n),[]);}
});
test('legal random play preserves every card, leaves original immutable and yields executable hints',()=>{
  for(const g of games)for(let seed=1;seed<=3;seed++){
    let s=createGame(g,seed,{suits:seed===3?4:1});for(let step=0;step<45;step++){
      const before=clone(s),list=actions(s);assert.deepEqual(s,before);if(!list.length)break;
      const h=hint(s);assert(h&&apply(s,h));const a=list[(step*17+seed)%list.length];const next=apply(s,a)!;assert(next);assert(validState(next),`${g} seed ${seed} step ${step}`);assert.deepEqual(s,before);assert.equal(next.moves,s.moves+1);s=next;
    }
  }
});
test('saved data rejects malformed and duplicate cards and roundtrips complete sessions',()=>{
  const d=fresh();assert(validData(d));d.sessions.klondike={state:createGame('klondike',5),initial:createGame('klondike',5),history:[],seconds:12,daily:null,counted:false};assert(validData(JSON.parse(JSON.stringify(d))));
  d.sessions.klondike.state.columns[0][0].rank=20;assert.equal(validData(d),false);d.sessions.klondike.state=createGame('klondike',5);d.sessions.klondike.state.stock[0].id=d.sessions.klondike.state.stock[1].id;assert.equal(validData(d),false);
  assert(!validData({version:2}));assert(!validState(null));
});
test('daily seed and date switch at Moscow midnight, independently of system timezone',()=>{
  assert.equal(moscowDate(new Date('2026-11-17T20:59:59Z')),'2026-11-17');assert.equal(moscowDate(new Date('2026-11-17T21:00:00Z')),'2026-11-18');assert.equal(dailySeed('2026-11-17','klondike'),dailySeed('2026-11-17','klondike'));assert.notEqual(dailySeed('2026-11-17','klondike'),dailySeed('2026-11-18','klondike'));
});
