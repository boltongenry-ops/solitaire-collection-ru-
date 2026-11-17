export type Game = 'klondike' | 'spider' | 'freecell' | 'pyramid' | 'tripeaks' | 'yukon' | 'golf';
export type Suit = 0 | 1 | 2 | 3;
export interface Card { id:number; rank:number; suit:Suit; up:boolean }
export interface Place { zone:'columns'|'cells'|'foundations'|'waste'; pile:number; index:number }
export type Action = {type:'move';from:Place;to:Omit<Place,'index'>}|{type:'draw'}|{type:'pair';ids:number[]};
export interface State { game:Game; seed:number; columns:Card[][]; stock:Card[]; waste:Card[]; foundations:Card[][]; cells:Card[][]; removed:Card[]; score:number; moves:number; recycles:number; drawCount:number; suits:number; won:boolean;lockedCells?:number;redealLimit?:number }
export const symbols=['♠','♥','♣','♦'];
export const ranks=['','Т','2','3','4','5','6','7','8','9','10','В','Д','К'];
export const red=(c:Card)=>c.suit===1||c.suit===3;
export function shuffled(seed:number,suits=4,decks=1):Card[]{
  const cards:Card[]=[];let x=seed>>>0;
  for(let d=0;d<decks;d++)for(let s=0;s<4;s++)for(let r=1;r<=13;r++)cards.push({id:cards.length,rank:r,suit:(s%suits) as Suit,up:false});
  for(let i=cards.length-1;i>0;i--){x=(Math.imul(x,1664525)+1013904223)>>>0;const j=x%(i+1);[cards[i],cards[j]]=[cards[j],cards[i]];}
  return cards;
}
export function createGame(game:Game,seed=Date.now()>>>0,options:{drawCount?:number;suits?:number}={}):State{
  const s:State={game,seed,columns:[],stock:[],waste:[],foundations:Array.from({length:game==='spider'?8:4},()=>[]),cells:Array.from({length:4},()=>[]),removed:[],score:0,moves:0,recycles:0,drawCount:options.drawCount===3?3:1,suits:[1,2,4].includes(options.suits??1)?options.suits??1:1,won:false};
  const deck=shuffled(seed,game==='spider'?s.suits:4,game==='spider'?2:1);
  const take=(up:boolean)=>({...deck.pop()!,up});
  if(game==='klondike')for(let i=0;i<7;i++){s.columns.push([]);for(let j=0;j<=i;j++)s.columns[i].push(take(j===i));}
  if(game==='yukon')for(let i=0;i<7;i++){s.columns.push([]);const n=i===0?1:i+5;for(let j=0;j<n;j++)s.columns[i].push(take(i===0||j>=i));}
  if(game==='golf'){s.columns=Array.from({length:7},()=>Array.from({length:5},()=>take(true)));s.waste.push(take(true));}
  if(game==='freecell'){s.columns=Array.from({length:8},()=>[]);for(let i=0;deck.length;i++)s.columns[i%8].push(take(true));}
  if(game==='spider')for(let i=0;i<10;i++){const n=i<4?6:5;s.columns.push([]);for(let j=0;j<n;j++)s.columns[i].push(take(j===n-1));}
  if(game==='pyramid'||game==='tripeaks'){s.columns=Array.from({length:28},()=>[take(true)]);if(game==='tripeaks')s.waste.push(take(true));}
  s.stock=deck;return s;
}
export const clone=(s:State):State=>structuredClone(s);
export function pile(s:State,p:Omit<Place,'index'>):Card[]{return p.zone==='waste'?s.waste:s[p.zone][p.pile]??[];}
function chain(cards:Card[],sameSuit:boolean){return cards.length>0&&cards.every((c,i)=>c.up&&(!i||(cards[i-1].rank===c.rank+1&&(sameSuit?cards[i-1].suit===c.suit:red(cards[i-1])!==red(c)))));}
export function exposed(s:State,index:number):boolean{
  if(!s.columns[index]?.length)return false;
  let below:number[]=[];
  if(s.game==='pyramid'){
    const row=Math.floor((Math.sqrt(8*index+1)-1)/2);const col=index-row*(row+1)/2;
    if(row<6)below=[(row+1)*(row+2)/2+col,(row+1)*(row+2)/2+col+1];
  }else if(s.game==='tripeaks'){
    if(index<3)below=[3+index*2,4+index*2];
    else if(index<9){const i=index-3;const base=9+Math.floor(i/2)*3+i%2;below=[base,base+1];}
    else if(index<18)below=[18+index-9,19+index-9];
  }
  return below.every(i=>!s.columns[i].length);
}
export function canMove(s:State,from:Place,to:Omit<Place,'index'>):boolean{
  if(s.won||s.game==='pyramid'||s.game==='tripeaks'||s.game==='golf'||(from.zone===to.zone&&from.pile===to.pile))return false;
  if((from.zone==='foundations'&&(s.game==='spider'||s.game==='yukon'))||(from.zone==='cells'&&s.game!=='freecell'))return false;
  if(!Number.isInteger(from.index)||!Number.isInteger(from.pile)||!Number.isInteger(to.pile)||from.pile<0||to.pile<0)return false;
  if((from.zone!=='waste'&&!s[from.zone]?.[from.pile])||(to.zone!=='waste'&&!s[to.zone]?.[to.pile]))return false;
  const src=pile(s,from),dst=pile(s,to),cards=src.slice(from.index),first=cards[0],last=dst.at(-1);
  if(!first||from.index<0||!first.up||to.zone==='waste')return false;
  if(from.zone!=='columns'&&cards.length!==1)return false;
  if(to.zone==='foundations')return s.game!=='spider'&&cards.length===1&&first.suit===to.pile&&(!last?first.rank===1:last.suit===first.suit&&first.rank===last.rank+1);
  if(to.zone==='cells')return s.game==='freecell'&&to.pile<4-(s.lockedCells??0)&&cards.length===1&&!dst.length;
  if(to.zone!=='columns'||(s.game==='yukon'?!cards.every(c=>c.up):!chain(cards,s.game==='spider')))return false;
  if(s.game==='spider')return !last||last.rank===first.rank+1;
  if(s.game==='klondike'||s.game==='yukon')return !last?first.rank===13:last.up&&last.rank===first.rank+1&&red(last)!==red(first);
  const emptyCells=s.cells.filter((p,i)=>!p.length&&i<4-(s.lockedCells??0)).length;
  const emptyColumns=s.columns.filter((p,i)=>!p.length&&i!==to.pile).length;
  return cards.length<=(emptyCells+1)*2**emptyColumns&&(!last||(last.rank===first.rank+1&&red(last)!==red(first)));
}
function finish(s:State){
  if(s.game==='spider')for(const col of s.columns){let tail=col.slice(-13);while(tail.length===13&&tail[0].rank===13&&chain(tail,true)){
    const dest=s.foundations.find(p=>!p.length);if(!dest)break;dest.push(...col.splice(-13));s.score+=100;if(col.at(-1))col.at(-1)!.up=true;tail=col.slice(-13);
  }}
  s.won=s.game==='pyramid'||s.game==='tripeaks'||s.game==='golf'?s.columns.every(p=>!p.length):s.foundations.reduce((n,p)=>n+p.length,0)===(s.game==='spider'?104:52);
}
function pairCards(s:State,ids:number[]):Card[]|null{
  if(new Set(ids).size!==ids.length)return null;
  const available=[...s.columns.flatMap((p,i)=>exposed(s,i)?s.game==='golf'?[p.at(-1)!]:p:[]),...(s.waste.at(-1)?[s.waste.at(-1)!]:[])];
  const cards=ids.map(id=>available.find(c=>c.id===id));
  if(cards.some(c=>!c))return null;
  return cards as Card[];
}
export function apply(s:State,a:Action):State|null{
  if(s.won)return null;const next=clone(s);
  if(a.type==='move'){
    if(!canMove(s,a.from,a.to))return null;
    const src=pile(next,a.from),dst=pile(next,a.to);dst.push(...src.splice(a.from.index));
    if(src.at(-1)&&!src.at(-1)!.up){src.at(-1)!.up=true;next.score+=5;}
    if(a.to.zone==='foundations')next.score+=10;
    if(a.from.zone==='foundations')next.score=Math.max(0,next.score-10);
  }else if(a.type==='draw'){
    if(s.game==='freecell'||s.game==='yukon')return null;
    if(s.game==='spider'){
      if(next.stock.length<10||next.columns.some(p=>!p.length))return null;
      for(const col of next.columns)col.push({...next.stock.pop()!,up:true});
    }else if(next.stock.length){
      const count=s.game==='klondike'?s.drawCount:1;
      for(let i=0;i<count&&next.stock.length;i++)next.waste.push({...next.stock.pop()!,up:true});
    }else if(next.waste.length&&(s.game==='klondike'||s.game==='pyramid')&&s.recycles<(s.redealLimit??(s.game==='pyramid'?2:Infinity))){
      next.stock=next.waste.reverse().map(c=>({...c,up:false}));next.waste=[];next.recycles++;
    }else return null;
  }else{
    const cards=pairCards(s,a.ids);if(!cards)return null;
    if(s.game==='pyramid'){
      if(!((cards.length===1&&cards[0].rank===13)||(cards.length===2&&cards[0].rank+cards[1].rank===13)))return null;
    }else if(s.game==='tripeaks'||s.game==='golf'){
      if(cards.length!==1||s.waste.at(-1)?.id===cards[0].id)return null;
      const rank=s.waste.at(-1)?.rank;if(!rank||!(s.game==='golf'?[1]:[1,12]).includes(Math.abs(cards[0].rank-rank)))return null;
    }else return null;
    for(const card of cards){for(const col of next.columns)if((s.game==='golf'?col.at(-1):col[0])?.id===card.id)col.pop();if(next.waste.at(-1)?.id===card.id)next.waste.pop();}
    if(s.game==='tripeaks'||s.game==='golf')next.waste.push({...cards[0],up:true});else next.removed.push(...cards);
    next.score+=s.game==='pyramid'?cards.length*10:10;
  }
  next.moves++;finish(next);return next;
}
export function actions(s:State,includeDraw=true):Action[]{
  const result:Action[]=[];
  if(s.won)return result;
  if(s.game==='pyramid'||s.game==='tripeaks'||s.game==='golf'){
    const cards=[...s.columns.flatMap((p,i)=>exposed(s,i)?s.game==='golf'?[p.at(-1)!]:p:[]),...(s.game==='pyramid'&&s.waste.at(-1)?[s.waste.at(-1)!]:[])];
    for(let i=0;i<cards.length;i++){
      const single:Action={type:'pair',ids:[cards[i].id]};if(apply(s,single))result.push(single);
      if(s.game==='pyramid')for(let j=i+1;j<cards.length;j++){const a:Action={type:'pair',ids:[cards[i].id,cards[j].id]};if(apply(s,a))result.push(a);}
    }
  }else{
    const sources:Place[]=[];
    for(const zone of ['columns','cells','foundations'] as const)for(let p=0;p<s[zone].length;p++)for(let i=zone==='columns'?0:s[zone][p].length-1;i<s[zone][p].length;i++)if(i>=0&&s[zone][p][i].up)sources.push({zone,pile:p,index:i});
    if(s.waste.length)sources.push({zone:'waste',pile:0,index:s.waste.length-1});
    for(const from of sources)for(const zone of ['foundations','columns','cells'] as const)for(let p=0;p<s[zone].length;p++){
      const to={zone,pile:p};if(canMove(s,from,to))result.push({type:'move',from,to});
    }
  }
  if(includeDraw&&apply(s,{type:'draw'}))result.push({type:'draw'});
  return result;
}
export function hint(s:State):Action|null{
  const list=actions(s);
  return list.find(a=>a.type==='pair'||(a.type==='move'&&a.to.zone==='foundations'))??list.find(a=>a.type==='move'&&a.from.zone==='columns'&&a.from.index>0&&!s.columns[a.from.pile][a.from.index-1].up)??list.find(a=>a.type==='move'&&!(a.from.index===0&&a.to.zone==='columns'&&!pile(s,a.to).length))??list[0]??null;
}
