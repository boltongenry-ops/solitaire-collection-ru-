import type {Game} from './engine';
import {clone,createGame} from './engine';
import {award,freshClub,raceDeal} from './competition';
import type {Data,Session} from './storage';

export interface Activity {wins:number;moves:number;clean:number;duels:number;floors:number;games:Game[]}
export interface WinEvent {key:string;game:Game;kind:'solo'|'daily'|'duel'|'tower'|'marathon';seconds:number;hints:number;undos:number}
export interface Marathon {id:string;games:Game[];stage:number;cleared:number[];session:Session|null;complete:boolean;attempt?:number}
export interface Journey {xp:number;totals:Activity;days:Record<string,Activity>;weeks:Record<string,Activity>;processed:string[];claimed:string[];mastery:Partial<Record<Game,{xp:number;wins:number}>>;recent:{game:Game;day:string;xp:number;kind:string}[];marathon:Marathon|null;tutorialDone:boolean}
export const emptyActivity=():Activity=>({wins:0,moves:0,clean:0,duels:0,floors:0,games:[]});
export function weekKey(day:string){const d=new Date(day+'T12:00:00Z');d.setUTCDate(d.getUTCDate()-((d.getUTCDay()+6)%7));return d.toISOString().slice(0,10);}
export function journey(d:Data):Journey{
 if(!d.journey){const totals=emptyActivity();totals.wins=Object.values(d.stats).reduce((n,s)=>n+s.won,0)+(d.club?.won??0);totals.duels=d.club?.won??0;totals.floors=Object.values(d.club?.towers??{}).reduce((n,t)=>n+(t?.cleared.length??0),0);totals.wins+=totals.floors;totals.games=Object.entries(d.stats).filter(([,s])=>s.won>0).map(([g])=>g as Game);
 d.journey={xp:totals.wins*100,totals,days:{},weeks:{},processed:[...new Set([...(d.club?.rewards??[]).filter(k=>/^(solo|race|tower):/.test(k)).map(k=>k.replace(/^race:/,'duel:')),...Object.entries(d.sessions).filter(([,se])=>se?.counted).map(([g,se])=>`solo:${g}:${se!.state.seed}`)])],claimed:[],mastery:{},recent:[],marathon:null,tutorialDone:Object.values(d.stats).some(s=>s.played>0)};
 for(const [g,s] of Object.entries(d.stats))if(s.won)d.journey.mastery[g as Game]={xp:s.won*100,wins:s.won};}
 return d.journey;
}
function buckets(j:Journey,day:string){const week=weekKey(day);j.days[day]??=emptyActivity();j.weeks[week]??=emptyActivity();for(const old of Object.keys(j.days).sort().slice(0,-14))delete j.days[old];for(const old of Object.keys(j.weeks).sort().slice(0,-8))delete j.weeks[old];return [j.totals,j.days[day],j.weeks[week]];}
export function recordMove(d:Data,day:string){for(const b of buckets(journey(d),day))b.moves++;}
export function recordWin(d:Data,e:WinEvent,day:string):number{
 const j=journey(d);if(j.processed.includes(e.key))return 0;j.processed.push(e.key);
 const clean=e.hints===0&&e.undos===0,xp=(e.kind==='tower'?180:e.kind==='duel'?160:100)+(clean?40:0)+(e.seconds>0&&e.seconds<300?20:0);
 j.xp+=xp;const mastery=j.mastery[e.game]??={xp:0,wins:0};mastery.xp+=xp;mastery.wins++;
 for(const b of buckets(j,day)){b.wins++;if(clean)b.clean++;if(e.kind==='duel')b.duels++;if(e.kind==='tower')b.floors++;if(!b.games.includes(e.game))b.games.push(e.game);}
 j.recent.unshift({game:e.game,day,xp,kind:e.kind});j.recent=j.recent.slice(0,18);return xp;
}
export function level(xp:number){let n=1,base=0,need=200;while(xp>=base+need&&n<100){base+=need;n++;need=200+(n-1)*50;}return {level:n,into:xp-base,need,percent:Math.min(100,(xp-base)/need*100),title:n<3?'Новичок':n<6?'Искатель':n<10?'Знаток':n<16?'Стратег':n<25?'Мастер':'Легенда'};}
export function masteryLevel(xp:number){return xp<300?'Знакомство':xp<900?'Практик':xp<2000?'Знаток':xp<4000?'Мастер':'Виртуоз';}
export const achievements=[
 {id:'first',name:'Всё начинается с туза',desc:'Выиграйте первую партию',field:'wins',target:1,coins:40,xp:60,art:0},
 {id:'ten',name:'Хорошая привычка',desc:'Выиграйте 10 партий',field:'wins',target:10,coins:120,xp:150,art:1},
 {id:'fifty',name:'Мастер своего стола',desc:'Выиграйте 50 партий',field:'wins',target:50,coins:400,xp:500,art:7},
 {id:'clean',name:'Чистая работа',desc:'Победите без подсказок и отмен',field:'clean',target:1,coins:60,xp:80,art:2},
 {id:'clean-ten',name:'Точность — ваш стиль',desc:'10 побед без помощи',field:'clean',target:10,coins:180,xp:200,art:2},
 {id:'diverse',name:'Любопытство вознаграждается',desc:'Победите в трёх разных пасьянсах',field:'games',target:3,coins:100,xp:120,art:3},
 {id:'all-seven',name:'Семь граней мастерства',desc:'Победите во всех семи пасьянсах',field:'games',target:7,coins:350,xp:400,art:7},
 {id:'duel',name:'Первый вызов',desc:'Победите в дуэли',field:'duels',target:1,coins:80,xp:100,art:4},
 {id:'duel-five',name:'С характером',desc:'Пять побед над ботами',field:'duels',target:5,coins:160,xp:180,art:4},
 {id:'floor',name:'Шаг над собой',desc:'Покорите этаж башни',field:'floors',target:1,coins:60,xp:80,art:5},
 {id:'summit',name:'Выше только звёзды',desc:'Пройдите семь этажей башен',field:'floors',target:7,coins:220,xp:250,art:6},
 {id:'moves',name:'Карта за картой',desc:'Сделайте 250 допустимых ходов',field:'moves',target:250,coins:80,xp:100,art:1},
] as const;
export function value(a:Activity,key:keyof Activity){return key==='games'?a.games.length:a[key];}
export function claimAchievement(d:Data,id:string):boolean{const a=achievements.find(a=>a.id===id),j=journey(d),key='achievement:'+id;if(!a||j.claimed.includes(key)||value(j.totals,a.field)<a.target)return false;j.claimed.push(key);j.xp+=a.xp;award(d.club??=freshClub(),key,a.coins);return true;}
export function quests(d:Data,day:string){const j=journey(d),w=weekKey(day),dayStats=j.days[day]??emptyActivity(),weekStats=j.weeks[w]??emptyActivity();return [
 {id:`day:${day}:moves`,name:'Разогреть руки',desc:'Сделайте 30 допустимых ходов',value:dayStats.moves,target:30,coins:30,xp:40,period:'day'},
 {id:`day:${day}:win`,name:'Маленькая победа',desc:'Выиграйте любую партию',value:dayStats.wins,target:1,coins:40,xp:60,period:'day'},
 {id:`day:${day}:diverse`,name:'Сменить перспективу',desc:'Победите в двух разных пасьянсах',value:dayStats.games.length,target:2,coins:60,xp:80,period:'day'},
 {id:`week:${w}:wins`,name:'Неделя в своём ритме',desc:'Выиграйте 8 партий за неделю',value:weekStats.wins,target:8,coins:160,xp:200,period:'week'},
 {id:`week:${w}:tower`,name:'Ближе к вершине',desc:'Пройдите 3 этажа башен за неделю',value:weekStats.floors,target:3,coins:120,xp:150,period:'week'},
 {id:`week:${w}:duel`,name:'Достойный соперник',desc:'Выиграйте 3 дуэли за неделю',value:weekStats.duels,target:3,coins:150,xp:180,period:'week'},
 ].map(q=>({...q,claimed:j.claimed.includes(q.id)}));}
export function claimQuest(d:Data,id:string,day:string):boolean{const q=quests(d,day).find(q=>q.id===id),j=journey(d);if(!q||q.claimed||q.value<q.target)return false;j.claimed.push(id);j.xp+=q.xp;award(d.club??=freshClub(),id,q.coins);return true;}
export function pendingRewards(d:Data,day:string){const j=journey(d);return achievements.filter(a=>value(j.totals,a.field)>=a.target&&!j.claimed.includes('achievement:'+a.id)).length+quests(d,day).filter(q=>q.value>=q.target&&!q.claimed).length;}
export function createMarathon(seed:number):Marathon{return {id:String(seed),games:['golf','klondike','tripeaks'],stage:0,cleared:[],session:null,complete:false};}
export function startMarathonStage(m:Marathon){const seed=(Number(m.id)+m.stage*7919+(m.attempt??0)*104729)>>>0,s=m.games[m.stage]==='klondike'?raceDeal(seed):createGame(m.games[m.stage],seed);m.session={state:s,initial:clone(s),history:[],seconds:0,daily:null,counted:false};}
export function finishMarathonStage(d:Data):boolean{const j=journey(d),m=j.marathon;if(!m?.session?.state.won||m.cleared.includes(m.stage))return false;m.cleared.push(m.stage);m.session.counted=true;award(d.club??=freshClub(),`marathon:${m.id}:${m.stage}`,60);if(m.stage===2){m.complete=true;award(d.club!,`marathon:${m.id}:complete`,180);j.xp+=250;}return true;}
export function validJourney(j:Journey,checkSession:(s:Session)=>boolean):boolean{
 const validActivity=(a:Activity)=>!!a&&['wins','moves','clean','duels','floors'].every(k=>Number.isInteger(a[k as keyof Activity])&&Number(a[k as keyof Activity])>=0)&&Array.isArray(a.games)&&a.games.every(g=>['klondike','spider','freecell','pyramid','tripeaks','yukon','golf'].includes(g));
 if(!j||!Number.isFinite(j.xp)||j.xp<0||!validActivity(j.totals)||!j.days||!j.weeks||![...Object.values(j.days),...Object.values(j.weeks)].every(validActivity)||!Array.isArray(j.processed)||!j.processed.every(s=>typeof s==='string')||!Array.isArray(j.claimed)||!j.claimed.every(s=>typeof s==='string')||!j.mastery||!Object.entries(j.mastery).every(([g,v])=>!!v&&['klondike','spider','freecell','pyramid','tripeaks','yukon','golf'].includes(g)&&Number.isFinite(v.xp)&&v.xp>=0&&Number.isInteger(v.wins)&&v.wins>=0)||!Array.isArray(j.recent)||!j.recent.every(r=>!!r&&['klondike','spider','freecell','pyramid','tripeaks','yukon','golf'].includes(r.game)&&typeof r.day==='string'&&Number.isFinite(r.xp)&&typeof r.kind==='string')||typeof j.tutorialDone!=='boolean')return false;
 const m=j.marathon;return !m||(typeof m.id==='string'&&/^\d{1,10}$/.test(m.id)&&Array.isArray(m.games)&&m.games.length===3&&m.games.join(',')==='golf,klondike,tripeaks'&&Number.isInteger(m.stage)&&m.stage>=0&&m.stage<=2&&Array.isArray(m.cleared)&&m.cleared.every(v=>Number.isInteger(v)&&v>=0&&v<=2)&&typeof m.complete==='boolean'&&(m.attempt===undefined||(Number.isInteger(m.attempt)&&m.attempt>=0))&&(!m.session||(checkSession(m.session)&&m.session.state.game===m.games[m.stage])));
}
