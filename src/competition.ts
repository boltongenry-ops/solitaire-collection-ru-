import {apply,clone,createGame,actions,type State,type Card,type Action,type Game} from './engine';
export interface Personality {id:string;name:string;title:string;initials:string;color:string;rating:number;pace:number;pause:number;error:number;greeting:string;thinking:string[]}
export const bots:Personality[]=[
 {id:'nina',name:'Нина',title:'Вдумчивая садовница',initials:'НИ',color:'#7a9568',rating:920,pace:5,pause:.23,error:.16,greeting:'Чай заварен. Можно и карты разложить.',thinking:['Не спешу. Сначала посмотрю на весь стол.','Кажется, здесь есть ход получше.','Сделаю маленькую паузу.']},
 {id:'mark',name:'Марк',title:'Азартный импровизатор',initials:'МА',color:'#b78966',rating:1180,pace:2,pause:.11,error:.24,greeting:'Ну что, проверим удачу? Поехали!',thinking:['А если попробовать вот так?..','Кажется, я немного поторопился.','Риск — тоже часть игры!']},
 {id:'sonya',name:'Соня',title:'Мечтательная художница',initials:'СО',color:'#a48aab',rating:1050,pace:4,pause:.32,error:.12,greeting:'Красивые карты. А теперь попробую красиво сыграть.',thinking:['На секунду задумалась…','Не заметила эту карту с первого раза.','Люблю, когда всё постепенно складывается.']},
 {id:'lev',name:'Лев',title:'Спокойный аналитик',initials:'ЛЕ',color:'#6e8e9d',rating:1540,pace:3,pause:.14,error:.05,greeting:'Хорошей партии. Посмотрим, что подготовила раздача.',thinking:['Проверю последовательность ещё раз.','Здесь лучше действовать осторожно.','Есть несколько вариантов. Выберу надёжный.']},
 {id:'alisa',name:'Алиса',title:'Быстрая перфекционистка',initials:'АЛ',color:'#ba927b',rating:1790,pace:1,pause:.12,error:.08,greeting:'Люблю быстрые партии. Но ошибки бывают у всех.',thinking:['Так, секунду. Это нужно проверить.','Отлично. Теперь следующий дом.','Чуть не пропустила важную карту.']},
 {id:'artur',name:'Артур',title:'Опытный тактик',initials:'АР',color:'#8b9475',rating:1980,pace:2,pause:.08,error:.025,greeting:'Пусть победит внимательнейший. Удачи!',thinking:['Сначала открою закрытые карты.','Хорошая раздача требует терпения.','Сверю порядок карт — и продолжим.']},
];
export interface PlayerSession {state:State;initial:State;history:State[];seconds:number;daily:null;counted:boolean}
export interface Race {id:string;botId:string;player:PlayerSession;bot:State;botHistory:State[];nextAt:number;rng:number;message:string;recover:boolean;status:'playing'|'win'|'loss';finishedAt:number|null;reward:number}
export const backs=[
 {id:'ornament',name:'Тихий сад',price:0,tag:'КЛАССИКА',desc:'Лесной орнамент'},
 {id:'diamond',name:'Синий ромб',price:0,tag:'КЛАССИКА',desc:'Геометрия спокойствия'},
 {id:'minimal',name:'Минимализм',price:0,tag:'КЛАССИКА',desc:'Ничего лишнего'},
 {id:'sakura',name:'Цветение сакуры',price:120,tag:'НЕЖНОСТЬ',desc:'Лепестки на бархате'},
 {id:'celestial',name:'Звёздный атлас',price:240,tag:'СОЗВЕЗДИЯ',desc:'Ваша маленькая вселенная'},
 {id:'amber',name:'Янтарный вечер',price:180,tag:'ТЁПЛЫЙ СВЕТ',desc:'Золотая геометрия'},
 {id:'ocean',name:'Глубокий океан',price:320,tag:'ГЛУБИНА',desc:'Волны в лунном свете'},
 {id:'royal',name:'Королевский бархат',price:480,tag:'КОЛЛЕКЦИОННАЯ',desc:'Золото на винном шёлке'},
 {id:'aurora',name:'Северное сияние',price:650,tag:'КОЛЛЕКЦИОННАЯ',desc:'Свет над ночным лесом'},
];
export interface TowerRun {game:Game;floor:number;cleared:number[];session:PlayerSession|null;joined:string;failed:boolean;undoUsed:number;hintUsed:number}
export interface Club {coins:number;owned:string[];rating:number;played:number;won:number;rewards:string[];race:Race|null;towers:Partial<Record<Game,TowerRun>>}
export const freshClub=():Club=>({coins:240,owned:['ornament','diamond','minimal'],rating:1000,played:0,won:0,rewards:[],race:null,towers:{}});
export const towerNames=['У ворот','Первый страж','Зал терпения','Хранитель ключа','Тёмный советник','Правая рука','Царь горы'];
export function towerRules(game:Game,floor:number){
 const base={klondike:600,spider:1800,freecell:900,pyramid:360,tripeaks:300,yukon:900,golf:300}[game];
 return {seconds:floor===1?0:Math.round(base*[0,0,1.7,1.4,1.2,1,.9,.8][floor]),hints:[0,3,3,2,2,1,0,0][floor],undos:[0,10,8,6,4,3,1,0][floor],drawCount:floor>=4?3:1,suits:floor<=2?1:floor<=4?2:4,lockedCells:floor<=3?0:floor<=5?1:2,recycles:game==='pyramid'?(floor<=3?2:floor<=5?1:0):(floor<=3?99:Math.max(1,7-floor))};
}
export function joinTower(game:Game):TowerRun{return {game,floor:1,cleared:[],session:null,joined:`${Date.now()}-${Math.random().toString(36).slice(2,8)}`,failed:false,undoUsed:0,hintUsed:0};}
export function startFloor(t:TowerRun,seed:number):void{
 const rules=towerRules(t.game,t.floor),s=createGame(t.game,seed,{drawCount:rules.drawCount,suits:rules.suits});
 s.lockedCells=t.game==='freecell'?rules.lockedCells:0;s.redealLimit=rules.recycles;
 t.session={state:s,initial:clone(s),history:[],seconds:0,daily:null,counted:false};t.failed=false;t.undoUsed=0;t.hintUsed=0;
}
export function clearFloor(c:Club,t:TowerRun):number{if(!t.session?.state.won||t.cleared.includes(t.floor))return 0;t.cleared.push(t.floor);t.session.counted=true;return award(c,`tower:${t.joined}:${t.floor}`,50+t.floor*25);}
function random(r:{rng:number}){r.rng=(Math.imul(r.rng,1664525)+1013904223)>>>0;return r.rng/4294967296;}
/** Assign cards along a legal exposure order and four ascending suit streams.
 * This constructs a standard 1..7-column Klondike deal with a foundation solution.
 * The bot sees only face-up cards and never uses this construction order. */
export function raceDeal(seed:number):State{
  const s=createGame('klondike',seed),r={rng:seed};const cursors=s.columns.map(p=>p.length-1);let stock=23;const next=[1,1,1,1];
  for(let n=0;n<52;n++){
    const targets=cursors.map((v,i)=>v>=0?i:-1).filter(i=>i>=0);if(stock>=0)targets.push(7);
    const target=targets[Math.floor(random(r)*targets.length)],suits=next.map((v,i)=>v<=13?i:-1).filter(i=>i>=0),suit=suits[Math.floor(random(r)*suits.length)],rank=next[suit]++;
    const c:Card={id:suit*13+rank-1,suit:suit as Card['suit'],rank,up:target!==7&&cursors[target]===target};
    if(target===7)s.stock[stock--]=c;else s.columns[target][cursors[target]--]=c;
  }
  return s;
}
export function newRace(botId:string,seed:number):Race{
  const initial=raceDeal(seed),person=bots.find(b=>b.id===botId)??bots[0];
  return {id:`${seed}:${person.id}`,botId:person.id,player:{state:clone(initial),initial:clone(initial),history:[],seconds:0,daily:null,counted:false},bot:clone(initial),botHistory:[],nextAt:3,rng:seed^7919,message:person.greeting,recover:false,status:'playing',finishedAt:null,reward:0};
}
/** One human-like decision, scheduled in active match seconds. No hidden-card access. */
export function botStep(r:Race):void{
  const b=bots.find(b=>b.id===r.botId)!;const now=r.player.seconds;
  if(r.status!=='playing'||now<r.nextAt)return;
  const pace=Math.max(1,Math.round(b.pace*(.7+random(r)*.9)));
  r.nextAt=now+pace;
  if(r.recover&&r.botHistory.length){r.bot=r.botHistory.pop()!;r.recover=false;r.message='Поспешный ход. Лучше вернуться и попробовать иначе.';return;}
  if(random(r)<b.pause){r.nextAt+=2+Math.floor(random(r)*4);r.message=b.thinking[Math.floor(random(r)*b.thinking.length)];return;}
  const possible=actions(r.bot),home=possible.filter(a=>a.type==='move'&&a.to.zone==='foundations');
  const side=possible.filter(a=>a.type==='move'&&a.to.zone==='columns');let a:Action|undefined;
  if(side.length&&random(r)<b.error){a=side[Math.floor(random(r)*side.length)];r.recover=true;r.message='Попробую переложить эту последовательность…';}
  else if(home.length){a=home[Math.floor(random(r)*home.length)];r.message=['Карта отправилась в дом.','Вот и следующий ход.','Постепенно всё складывается.'][Math.floor(random(r)*3)];}
  else {a=possible.find(a=>a.type==='draw')??side[0];r.message=a?.type==='draw'?'Посмотрю, что дальше в колоде.':'Поищу другой путь.';}
  if(a){const next=apply(r.bot,a);if(next){r.botHistory.push(clone(r.bot));if(r.botHistory.length>150)r.botHistory.shift();r.bot=next;}}
}
export function award(c:Club,key:string,amount:number):number{if(c.rewards.includes(key))return 0;c.rewards.push(key);c.coins+=amount;return amount;}
export function purchase(c:Club,id:string):'bought'|'owned'|'poor'|'unknown'{const item=backs.find(b=>b.id===id);if(!item)return 'unknown';if(c.owned.includes(id))return 'owned';if(c.coins<item.price)return 'poor';c.coins-=item.price;c.owned.push(id);return 'bought';}
export function finishRace(c:Club,result:'win'|'loss'):number{
  const r=c.race;if(!r||r.status!=='playing')return 0;r.status=result;r.finishedAt=r.player.seconds;c.played++;if(result==='win')c.won++;c.rating=Math.max(400,c.rating+(result==='win'?24:-12));r.reward=award(c,'race:'+r.id,result==='win'?120:(r.player.seconds>=30&&r.player.state.foundations.flat().length>=4?15:0));return r.reward;
}
export interface LeagueRow {id:string;name:string;title:string;color:string;initials:string;rating:number;delta:number;rank:number;movement:number;player:boolean}
export function league(date:string,c:Club):LeagueRow[]{
  const previous=new Date(date+'T12:00:00Z');previous.setUTCDate(previous.getUTCDate()-1);const yesterday=previous.toISOString().slice(0,10);
  const extra=['Мира','Тимур','Ева','Виктор','Лада','Феликс','Даша','Роман','Ольга','Борис'];
  const people=[...bots,...extra.map((name,i)=>({id:'extra'+i,name,title:'Участник виртуальной лиги',initials:name.slice(0,2).toUpperCase(),color:['#7f9676','#b28f76','#8294a5'][i%3],rating:820+i*130}))];
  const rate=(id:string,day:string)=>{const r={rng:0};for(const char of id+day)r.rng=(Math.imul(r.rng,31)+char.charCodeAt(0))>>>0;r.rng^=r.rng>>>16;r.rng=Math.imul(r.rng,0x7feb352d);r.rng^=r.rng>>>15;r.rng=Math.imul(r.rng,0x846ca68b);r.rng^=r.rng>>>16;return Math.floor(random(r)*201)-100;};
  const rows=people.map(p=>({id:p.id,name:p.name,title:p.title,color:p.color,initials:p.initials,rating:p.rating+rate(p.id,date),delta:rate(p.id,date)-rate(p.id,yesterday),rank:0,movement:0,player:false}));
  rows.push({id:'you',name:'Вы',title:'Ваши настоящие результаты дуэлей',color:'#d0b97e',initials:'ВЫ',rating:c.rating,delta:0,rank:0,movement:0,player:true});
  const before=[...people.map(p=>({id:p.id,rating:p.rating+rate(p.id,yesterday)})),{id:'you',rating:c.rating}].sort((a,b)=>b.rating-a.rating||a.id.localeCompare(b.id));
  rows.sort((a,b)=>b.rating-a.rating||a.id.localeCompare(b.id));return rows.map((r,i)=>({...r,rank:i+1,movement:before.findIndex(p=>p.id===r.id)-i}));
}
