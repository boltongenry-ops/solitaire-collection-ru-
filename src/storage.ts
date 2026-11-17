import type {Game,State} from './engine';
import {validJourney,type Journey} from './journey';
import {backs,type Club} from './competition';
export const games:Game[]=['klondike','spider','freecell','pyramid','tripeaks','yukon','golf'];
export interface Session {state:State;initial:State;history:State[];seconds:number;daily:string|null;counted:boolean;hintsUsed?:number;undosUsed?:number;variant?:'guided'|'calm'|'numbered'}
export interface RecordEntry {played:number;won:number;best:number|null;seconds:number}
export interface Data {version:1;sessions:Partial<Record<Game,Session>>;stats:Record<Game,RecordEntry>;daily:string[];settings:{theme:string;back:string;sound:boolean;motion:boolean;faces?:'ornate'|'classic'};last:Game;club?:Club;journey?:Journey}
export function fresh():Data{return {version:1,sessions:{},stats:Object.fromEntries(games.map(g=>[g,{played:0,won:0,best:null,seconds:0}])) as Data['stats'],daily:[],settings:{theme:'forest',back:'ornament',sound:true,motion:true},last:'klondike'};}
export function validState(s:unknown):s is State{
  if(!s||typeof s!=='object')return false;const x=s as State;
  if(!games.includes(x.game)||!Number.isFinite(x.seed)||!Number.isInteger(x.moves)||x.moves<0||!Number.isFinite(x.score)||typeof x.won!=='boolean'||![1,3].includes(x.drawCount)||![1,2,4].includes(x.suits)||!Number.isInteger(x.recycles))return false;
  if(x.lockedCells!==undefined&&(!Number.isInteger(x.lockedCells)||x.lockedCells<0||x.lockedCells>3))return false;
  if(x.redealLimit!==undefined&&(!Number.isInteger(x.redealLimit)||x.redealLimit<0))return false;
  const cols={klondike:7,spider:10,freecell:8,pyramid:28,tripeaks:28,yukon:7,golf:7};
  if(!Array.isArray(x.columns)||x.columns.length!==cols[x.game]||!Array.isArray(x.cells)||x.cells.length!==4||!Array.isArray(x.foundations)||x.foundations.length!==(x.game==='spider'?8:4)||!Array.isArray(x.stock)||!Array.isArray(x.waste)||!Array.isArray(x.removed))return false;
  const piles=[...x.columns,...x.cells,...x.foundations,x.stock,x.waste,x.removed];if(piles.some(p=>!Array.isArray(p)))return false;
  const cards=piles.flat(),size=x.game==='spider'?104:52;
  return cards.length===size&&new Set(cards.map(c=>c?.id)).size===size&&cards.every(c=>c&&Number.isInteger(c.id)&&c.id>=0&&c.id<size&&Number.isInteger(c.rank)&&c.rank>=1&&c.rank<=13&&[0,1,2,3].includes(c.suit)&&typeof c.up==='boolean');
}
export function validData(input:unknown):input is Data{
  if(!input||typeof input!=='object')return false;const d=input as Data;
  return d.version===1&&games.includes(d.last)&&!!d.settings&&['forest','midnight','plum'].includes(d.settings.theme)&&backs.some(b=>b.id===d.settings.back)&&typeof d.settings.sound==='boolean'&&typeof d.settings.motion==='boolean'&&(d.settings.faces===undefined||['ornate','classic'].includes(d.settings.faces))&&Array.isArray(d.daily)&&d.daily.every(v=>typeof v==='string')&&!!d.stats&&games.every(g=>{const r=d.stats[g];if(!r&&['yukon','golf'].includes(g))return true;return r&&[r.played,r.won,r.seconds].every(n=>Number.isFinite(n)&&n>=0)&&r.won<=r.played&&(r.best===null||Number.isFinite(r.best));})&&!!d.sessions&&Object.entries(d.sessions).every(([g,v])=>games.includes(g as Game)&&v&&validState(v.state)&&v.state.game===g&&validState(v.initial)&&v.initial.game===g&&validSession(v))&&(d.club===undefined||validClub(d.club))&&(d.journey===undefined||validJourney(d.journey,validSession));
}
function validSession(v:Session):boolean{return !!v&&validState(v.state)&&validState(v.initial)&&v.initial.game===v.state.game&&Array.isArray(v.history)&&v.history.length<=150&&v.history.every(h=>validState(h)&&h.game===v.state.game)&&Number.isFinite(v.seconds)&&v.seconds>=0&&(v.daily===null||typeof v.daily==='string')&&typeof v.counted==='boolean'&&(v.variant===undefined||['guided','calm','numbered'].includes(v.variant))&&[v.hintsUsed??0,v.undosUsed??0].every(n=>Number.isInteger(n)&&n>=0);}
function validClub(c:Club):boolean{
 if(!c||![c.coins,c.rating,c.played,c.won].every(n=>Number.isInteger(n)&&n>=0)||c.won>c.played||!Array.isArray(c.owned)||!c.owned.every(id=>backs.some(b=>b.id===id))||!Array.isArray(c.rewards)||!c.rewards.every(k=>typeof k==='string')||!c.towers)return false;
 if(c.race){const r=c.race;if(!['nina','mark','sonya','lev','alisa','artur'].includes(r.botId)||typeof r.id!=='string'||!validSession(r.player)||!validState(r.bot)||r.bot.game!=='klondike'||r.player.state.game!=='klondike'||!Array.isArray(r.botHistory)||r.botHistory.length>150||!r.botHistory.every(validState)||!['playing','win','loss'].includes(r.status)||!Number.isFinite(r.nextAt)||!Number.isFinite(r.rng)||typeof r.message!=='string'||typeof r.recover!=='boolean'||!Number.isFinite(r.reward))return false;}
 return Object.entries(c.towers).every(([g,t])=>games.includes(g as Game)&&!!t&&t.game===g&&Number.isInteger(t.floor)&&t.floor>=1&&t.floor<=7&&Array.isArray(t.cleared)&&t.cleared.every(n=>Number.isInteger(n)&&n>=1&&n<=7)&&typeof t.joined==='string'&&typeof t.failed==='boolean'&&Number.isInteger(t.undoUsed)&&t.undoUsed>=0&&Number.isInteger(t.hintUsed)&&t.hintUsed>=0&&(!t.session||(validSession(t.session)&&t.session.state.game===g)));
}
const KEY='solitaire-collection-ru-v1';
export function load():Data{try{const raw=localStorage.getItem(KEY);if(raw){const d=JSON.parse(raw);if(validData(d))return normalizeData(d);}}catch{}return fresh();}
export function save(d:Data):boolean{try{localStorage.setItem(KEY,JSON.stringify(d));return true;}catch{return false;}}
export function moscowDate(date=new Date()):string{return new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Moscow',year:'numeric',month:'2-digit',day:'2-digit'}).format(date);}
export function dailySeed(date:string,game:Game):number{let h=2166136261;for(const c of date+game)h=Math.imul(h^c.charCodeAt(0),16777619);return h>>>0;}

export function normalizeData(d:Data):Data{for(const g of games)d.stats[g]??={played:0,won:0,best:null,seconds:0};return d;}
