import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Game} from '../js/Game.js';
import {SaveStore,SAVE_KEY} from '../js/SaveStore.js';
class Element{
 constructor(tag='div'){this.tagName=tag;this.children=[];this.dataset={};this.hidden=false;this.attrs={};this.listeners={};this.textContent='';}
 addEventListener(name,callback){this.listeners[name]=callback;}
 append(...nodes){this.children.push(...nodes);}
 replaceChildren(...nodes){this.children=[...nodes];}
 setAttribute(name,value){this.attrs[name]=value;}
 focus(){}
 closest(selector){return selector.split(',').includes(this.tagName)?this:null;}
 querySelector(selector){return this.querySelectorAll(selector)[0]||null;}
 querySelectorAll(selector){const result=[];const visit=e=>{if(selector==='button'&&e.tagName==='button'||selector==='input:checked'&&e.tagName==='input'&&e.checked)result.push(e);for(const c of e.children||[])visit(c);};visit(this);return result;}
 getContext(){return {};}
}
const nodes=new Map(),storage=new Map(),windowHandlers=new Map();
globalThis.document={getElementById:id=>{if(!nodes.has(id))nodes.set(id,new Element());return nodes.get(id);},createElement:t=>new Element(t),createTextNode:t=>({textContent:t}),querySelectorAll:()=>[],addEventListener:()=>{}};
globalThis.window={addEventListener:(name,handler)=>windowHandlers.set(name,handler)};
globalThis.localStorage={getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v)};
globalThis.requestAnimationFrame=()=>1;globalThis.cancelAnimationFrame=()=>{};
const action=(g,text)=>{const b=g.ui['screen-actions'].children.find(b=>b.textContent.includes(text));assert.ok(b,text);b.listeners.click();};
const at=(g,target)=>{g.player.x=target.x-14;g.player.y=target.y-14;};
test('Прохождение трёх ночей: обязательные вещи, лай-диалоги, часы, кат-сцена и финал',()=>{
 storage.clear();const g=new Game(new Element('canvas'));
 assert.equal(g.state,'menu');g.newGame();assert.equal(g.state,'cutscene');action(g,'Пропустить');assert.equal(g.state,'playing');assert.equal(g.night,false);
 for(let room=0;room<3;room++){
  assert.equal(g.levelIndex,room);
  if(!g.night){g.toggleNight();action(g,'Начать прогулку');}
  if(room===0){g.night=false;g.environmentAction({kind:'herb',herb:g.level.herbs[0]});g.environmentAction({kind:'garden'});action(g,'Липа');g.environmentAction({kind:'well'});g.environmentAction({kind:'garden'});assert.equal(g.garden.watered,true);g.night=true;}
  if(room===1){at(g,g.level.items.find(i=>i.id==='photo'));g.interact();action(g,'Положить');at(g,g.level.keeper);g.interact();action(g,'Тихонько');action(g,'Спасибо');g.environmentAction({kind:'puzzle'});action(g,'нижней');g.chairPosition=1;g.environmentAction({kind:'puzzle'});assert.equal(g.shopUnlocked,true);}
  // Без вещи и разговора выход закрыт.
  at(g,{x:g.level.exit.x+20,y:g.level.exit.y+20});g.interact();assert.equal(g.state,'playing');assert.equal(g.roomComplete,false);
  const item=g.level.items.find(i=>i.essential);at(g,item);g.interact();assert.ok(g.collected.has(item.id));action(g,'Положить');
  at(g,g.level.keeper);g.interact();assert.equal(g.state,'dialogue');action(g,'Тихонько');assert.ok(g.talked.has(room));action(g,'Спасибо');
  if(room===2){assert.equal(g.roomComplete,false);at(g,{x:g.level.landmark.x,y:g.level.landmark.y+80});g.interact();assert.equal(g.clockAwake,false);action(g,'00:00');assert.equal(g.clockAwake,true);action(g,'Начать прогулку');}
  assert.equal(g.roomComplete,true);at(g,{x:g.level.exit.x+20,y:g.level.exit.y+20});g.interact();assert.equal(g.state,'cutscene');action(g,'Пропустить');
 }
 assert.equal(g.state,'choice');assert.equal(g.collected.size,4);action(g,'Вернуть всё');assert.equal(g.state,'ended');assert.equal(g.ending,'return');assert.equal(g.returned.length,4);
 const saved=new SaveStore().load();assert.equal(saved.ending,'return');assert.equal(saved.level,2);assert.equal(saved.collected.length,4);assert.equal(saved.deductions.length,3);g.destroy();
});
test('Выбор отдельных воспоминаний формирует третий финал',()=>{
 storage.clear();const g=new Game(new Element('canvas'));g.collected=new Set(['bell','key','clock','card']);g.chooseEnding();action(g,'Выбрать');assert.equal(g.state,'selection');
 // По умолчанию отмечены три сюжетные вещи, открытка остаётся в доме.
 action(g,'Вернуть выбранные');assert.equal(g.ending,'some');assert.deepEqual(g.returned,['bell','key','clock']);g.destroy();
});
test('Пауза очищает ввод, а выход в меню сохраняет продолжение',()=>{
 storage.clear();const g=new Game(new Element('canvas'));g.newGame();action(g,'Пропустить');
 g.input.press('KeyD','right');g.pause();assert.equal(g.state,'paused');assert.equal(g.input.held('right'),false);g.title();assert.ok(g.saved);action(g,'Продолжить');assert.equal(g.state,'playing');g.destroy();
});
test('Повреждённое сохранение не ломает меню',()=>{
 storage.set(SAVE_KEY,'{broken');assert.equal(new SaveStore().load(),null);
 storage.set(SAVE_KEY,JSON.stringify({version:1,level:99,collected:[],talked:[]}));assert.equal(new SaveStore().load(),null);storage.clear();
});
test('Лунник требует семян, дневной посадки и воды, а результаты сохраняются',()=>{
 storage.clear();const g=new Game(new Element('canvas'));g.newGame();action(g,'Пропустить');const bell=g.level.items.find(i=>i.id==='bell');
 assert.equal(g.itemVisible(bell),false);
 g.environmentAction({kind:'garden'});assert.equal(g.garden.planted,false);
 g.night=false;g.environmentAction({kind:'garden'});assert.equal(g.garden.planted,false);
 g.environmentAction({kind:'herb',herb:g.level.herbs[0]});assert.equal(g.resources.seeds,1);
 g.environmentAction({kind:'garden'});action(g,'Липа');assert.equal(g.garden.planted,true);assert.equal(g.resources.seeds,0);
 g.environmentAction({kind:'garden'});assert.equal(g.garden.watered,false);
 g.environmentAction({kind:'well'});g.environmentAction({kind:'garden'});assert.equal(g.garden.watered,true);assert.equal(g.resources.water,false);
 g.night=true;assert.equal(g.itemVisible(bell),true);g.save();const saved=new SaveStore().load();assert.equal(saved.garden.watered,true);assert.deepEqual(saved.resources.harvested,['seed-a']);g.destroy();
});
test('Рычаг зависит от положения стула, а неверное время часов не открывает дверь',()=>{
 storage.clear();const g=new Game(new Element('canvas'));g.levelIndex=1;g.enterRoom();g.night=true;g.environmentAction({kind:'puzzle'});assert.equal(g.shopUnlocked,false);
 g.collected.add('photo');g.talked.add(1);g.environmentAction({kind:'puzzle'});action(g,'верхнему');assert.equal(g.deductions.has('shop'),false);g.environmentAction({kind:'puzzle'});action(g,'нижней');g.chairPosition=1;g.environmentAction({kind:'puzzle'});assert.equal(g.shopUnlocked,true);
 g.levelIndex=2;g.setClock('00:00');assert.equal(g.clockAwake,false);g.collected.add('clock');g.talked.add(2);g.setClock('03:15');assert.equal(g.clockAwake,false);g.setClock('00:00');assert.equal(g.clockAwake,true);g.destroy();
});
test('Неверная версия семени не расходует ресурс; один стручок нельзя собирать повторно',()=>{
 storage.clear();const g=new Game(new Element('canvas'));g.night=false;const herb=g.level.herbs[0];g.environmentAction({kind:'herb',herb});g.environmentAction({kind:'herb',herb});assert.equal(g.resources.seeds,1);g.environmentAction({kind:'garden'});action(g,'Мёд');assert.equal(g.resources.seeds,1);assert.equal(g.garden.planted,false);g.environmentAction({kind:'garden'});action(g,'Липа');assert.equal(g.resources.seeds,0);assert.ok(g.deductions.has('garden'));g.destroy();
});
test('Карта и дело останавливают движение, не телепортируют и закрываются через паузу',()=>{
 storage.clear();const g=new Game(new Element('canvas'));g.enterRoom();const position={x:g.player.x,y:g.player.y};g.input.press('KeyD','right');g.map();assert.equal(g.state,'map');assert.equal(g.input.held('right'),false);assert.deepEqual({x:g.player.x,y:g.player.y},position);assert.match(g.ui['screen-extra'].children[0].innerHTML,/ДОМ №0/);g.pause();assert.equal(g.state,'playing');g.journal();assert.equal(g.state,'journal');g.pause();assert.equal(g.state,'playing');g.pause();g.map();g.pause();assert.equal(g.state,'paused');g.destroy();
});
test('Продолжение восстанавливает место мопса, стул и выводы; перекрытые позиции заменяются входом',()=>{
 storage.clear();const g=new Game(new Element('canvas'));g.levelIndex=1;g.night=true;g.enterRoom();g.player.x=140;g.player.y=450;g.chairPosition=1;g.deductions.add('shop');g.save();g.title();g.restore();assert.equal(g.player.x,140);assert.equal(g.player.y,450);assert.equal(g.chairPosition,1);assert.equal(g.chair.x,g.level.chair.positions[1].x);assert.ok(g.deductions.has('shop'));g.player.x=330;g.player.y=180;g.save();g.title();g.restore();assert.equal(g.player.x,g.level.spawn.x);g.destroy();
});
test('Стул звучит при движении, а мысль появляется лишь после обратного взгляда',()=>{
 storage.clear();const g=new Game(new Element('canvas'));g.levelIndex=1;g.night=true;g.enterRoom();let sounds=0;g.audio={creak:()=>sounds++};g.player.x=200;g.player.y=330;g.player.facing={x:-1,y:0};g.updateChair(.1);assert.equal(sounds,1);assert.equal(g.chairNotice,true);assert.equal(g.thought,'');g.player.facing={x:1,y:0};g.updateChair(.1);assert.equal(g.chairNotice,false);assert.match(g.thought,/поменялось/);g.destroy();
});
test('Escape работает при фокусе на кнопке, но ввод текста не перехватывается',()=>{
 storage.clear();const g=new Game(new Element('canvas'));g.enterRoom();g.pause();let prevented=false;windowHandlers.get('keydown')({code:'Escape',target:new Element('button'),repeat:false,preventDefault:()=>prevented=true});assert.equal(prevented,true);assert.equal(g.input.take('pause'),true);g.pause();assert.equal(g.state,'playing');prevented=false;windowHandlers.get('keydown')({code:'KeyJ',target:new Element('input'),repeat:false,preventDefault:()=>prevented=true});assert.equal(prevented,false);assert.equal(g.input.take('journal'),false);g.destroy();
});

