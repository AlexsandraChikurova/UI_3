import {ALL_ITEMS} from './levels.js';
export const SAVE_KEY='pug-after-midnight-pixel-v2';
export class SaveStore{
  constructor(){this.available=true;}
  load(){
    try{
      const raw=localStorage.getItem(SAVE_KEY);if(!raw)return null;
      const data=JSON.parse(raw),ids=new Set(ALL_ITEMS.map(i=>i.id));
      if(![1,2].includes(data.version)||!Number.isInteger(data.level)||data.level<0||data.level>2||!Array.isArray(data.collected)||!Array.isArray(data.talked))return null;
      const deductions=Array.isArray(data.deductions)?data.deductions.filter(id=>['garden','shop','clock'].includes(id)):[];
      if(data.version===1){if(data.garden?.watered)deductions.push('garden');if(data.shopUnlocked)deductions.push('shop');if(data.clockAwake)deductions.push('clock');}
      const position=Number.isFinite(data.position?.x)&&Number.isFinite(data.position?.y)&&data.position.x>=20&&data.position.x<=1072&&data.position.y>=20&&data.position.y<=572?{x:data.position.x,y:data.position.y}:null;
      return {level:data.level,collected:[...new Set(data.collected.filter(id=>ids.has(id)))],talked:[...new Set(data.talked.filter(i=>Number.isInteger(i)&&i>=0&&i<=2))],deductions:[...new Set(deductions)],witnessQuestions:Array.isArray(data.witnessQuestions)?data.witnessQuestions.filter(id=>['park','shop','square'].includes(id)):[],position,chairPosition:data.chairPosition===1?1:0,resources:{seeds:Math.max(0,Math.min(3,Number.isInteger(data.resources?.seeds)?data.resources.seeds:0)),water:Boolean(data.resources?.water),harvested:Array.isArray(data.resources?.harvested)?[...new Set(data.resources.harvested.filter(s=>['seed-a','seed-b','seed-c'].includes(s)))]:[]},garden:{planted:Boolean(data.garden?.planted),watered:Boolean(data.garden?.watered)},shopUnlocked:Boolean(data.shopUnlocked),night:Boolean(data.night),clockAwake:Boolean(data.clockAwake),returned:Array.isArray(data.returned)?data.returned.filter(id=>ids.has(id)):[],ending:['return','keep','some'].includes(data.ending)?data.ending:null};
    }catch{this.available=false;return null;}
  }
  save(game){try{localStorage.setItem(SAVE_KEY,JSON.stringify({version:2,level:game.levelIndex,collected:[...game.collected],talked:[...game.talked],deductions:[...(game.deductions||[])],witnessQuestions:[...(game.witnessQuestions||[])],position:game.player?{x:game.player.x,y:game.player.y}:null,chairPosition:game.chairPosition||0,resources:game.resources,garden:game.garden,shopUnlocked:game.shopUnlocked,night:game.night,clockAwake:game.clockAwake,returned:game.returned,ending:game.ending}));return true;}catch{this.available=false;return false;}}
}
