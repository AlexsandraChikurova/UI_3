import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {Soundscape} from '../js/Soundscape.js';
import {musicTheme} from '../js/musicTheme.js';
import {Game} from '../js/Game.js';

class Param {
 constructor(){this.value=1;}
 setValueAtTime(v){this.value=v;}
 setTargetAtTime(v){this.value=v;}
 linearRampToValueAtTime(v){this.value=v;}
 exponentialRampToValueAtTime(v){this.value=v;}
 cancelScheduledValues(){}
}
class Node {
 constructor(){this.gain=new Param();this.frequency=new Param();this.Q=new Param();this.disconnected=false;}
 connect(){}
 disconnect(){this.disconnected=true;}
}
class Source extends Node {
 constructor(context){super();this.context=context;this.loop=false;this.started=false;this.ended=false;this.stopAt=Infinity;}
 start(){this.started=true;this.context.started.push(this);if(!this.loop)this.stopAt=this.context.currentTime+(this.buffer?.duration||1);}
 stop(t=this.context.currentTime){this.stopAt=Math.min(this.stopAt,t);this.context.flush();}
}
class AudioContext {
 constructor(){this.state='suspended';this.currentTime=0;this.sampleRate=24000;this.started=[];this.destination=new Node();}
 createGain(){return new Node();}
 createBufferSource(){return new Source(this);}
 createOscillator(){return new Source(this);}
 createBiquadFilter(){return new Node();}
 createBuffer(channels,size){return {getChannelData:()=>new Float32Array(size),duration:size/this.sampleRate};}
 async decodeAudioData(data){return {name:data.name,duration:1};}
 async resume(){this.state='running';}
 async close(){this.state='closed';for(const source of this.started){source.stopAt=this.currentTime;}this.flush();}
 advance(seconds){this.currentTime+=seconds;this.flush();}
 flush(){for(const source of this.started)if(!source.ended&&source.stopAt<=this.currentTime){source.ended=true;source.onended?.();}}
}
function deferred(){let resolve;const promise=new Promise(r=>resolve=r);return {promise,resolve};}
const settle=async()=>{for(let i=0;i<12;i++)await Promise.resolve();};
function setup(pending=new Map()){
 const storage=new Map();globalThis.localStorage={getItem:key=>storage.get(key)||null,setItem:(key,value)=>storage.set(key,value)};
 globalThis.window={AudioContext,addEventListener(){}};
 globalThis.fetch=async url=>{const name=url.split('/').at(-1).replace('.wav','');if(pending.has(name))await pending.get(name).promise;return {ok:true,arrayBuffer:async()=>({name})};};
 return new Soundscape();
}
const game=(state='playing',mood='park',night=false,scene=null)=>({state,level:{mood},night,scene,sniffing:false});
const activeMusic=audio=>audio.context.started.filter(source=>source.loop&&!source.ended);

test('Музыкальные темы соответствуют меню, всем местам, времени суток и дому',()=>{
 for(const state of ['menu','confirm'])assert.equal(musicTheme(game(state)),'menu');
 assert.equal(musicTheme({...game('help'),overlayReturn:'menu'}),'menu');
 for(const mood of ['park','shop','square'])for(const night of [false,true]){
  assert.equal(musicTheme(game('playing',mood,night)),mood+'-'+(night?'night':'day'));
  assert.equal(musicTheme(game('paused',mood,night)),mood+'-'+(night?'night':'day'));
 }
 for(const scene of ['door','house','keep','some'])assert.equal(musicTheme(game('cutscene','square',true,scene)),'house');
 for(const state of ['choice','selection'])assert.equal(musicTheme(game(state,'square',true)),'house');
 assert.equal(musicTheme(game('ended','square',true,'return')),'square-day');
 assert.equal(musicTheme(game('cutscene','park',true,'day')),'park-day');
 assert.equal(musicTheme(game('cutscene','park',false,'night')),'park-night');
});

test('До действия пользователя музыка не стартует; unlock запускает выбранную тему ровно один раз',async()=>{
 const audio=setup();audio.update(game('menu'));assert.equal(audio.context,null);await audio.unlock();await settle();
 assert.equal(activeMusic(audio).length,1);assert.equal(audio.track.name,'menu');
 await audio.unlock();audio.update(game('menu'));await settle();assert.equal(activeMusic(audio).length,1);audio.close();
});

test('При быстрых переходах после crossfade остаётся ровно один музыкальный источник',async()=>{
 const audio=setup();await audio.unlock();await audio.playTheme('menu');
 for(const name of ['park-day','park-night','shop-night','square-day'])await audio.playTheme(name);
 assert.ok(activeMusic(audio).length>1,'Переход должен временно сохранять предыдущую музыку');
 audio.context.advance(2.1);assert.equal(activeMusic(audio).length,1);assert.equal(audio.track.name,'square-day');assert.equal(audio.voices.size,1);audio.close();
});

test('Поздно загрузившаяся старая тема не перезапускает музыку после нового выбора',async()=>{
 const first=deferred(),audio=setup(new Map([['menu',first]])),announced=[];audio.onTheme=name=>announced.push(name);await audio.unlock();const old=audio.playTheme('menu');
 await audio.playTheme('park-day');first.resolve();await old;await settle();
 assert.equal(audio.track.name,'park-day');assert.equal(activeMusic(audio).length,1);assert.deepEqual(announced,['park-day']);audio.close();
});

test('Выключенный звук и скрытая вкладка заглушают музыку; возвращение восстанавливает уровни',async()=>{
 const audio=setup();await audio.unlock();await audio.playTheme('park-day');audio.setVolume(.6);audio.setMusicVolume(.4);
 audio.setMuted(true);assert.equal(audio.master.gain.value,0);await audio.bark();assert.equal(audio.context.started.filter(s=>!s.loop).length,0);
 audio.setHidden(true);audio.setMuted(false);assert.equal(audio.master.gain.value,0);await audio.bark();assert.equal(audio.context.started.filter(s=>!s.loop).length,0);
 audio.setHidden(false);assert.equal(audio.master.gain.value,1);assert.equal(audio.effects.gain.value,.6);assert.equal(audio.music.gain.value,.4);audio.close();
});

test('При громкости эффектов ноль гав и скрип не приглушают музыку',async()=>{
 const audio=setup();await audio.unlock();audio.setVolume(0);audio.update(game());await settle();const before=audio.context.started.length;
 await audio.bark();audio.creak();assert.equal(audio.context.started.length,before);assert.equal(audio.mix,1);assert.equal(audio.duckUntil,0);audio.close();
});

test('Duck заканчивается и возвращает уровень диалога, паузы или обычной прогулки',async()=>{
 const audio=setup();await audio.unlock();audio.duck(.75);assert.equal(audio.mix,.23);audio.context.advance(.8);audio.update(game('dialogue'));assert.equal(audio.mix,.45);
 audio.update(game('paused'));assert.equal(audio.mix,.22);audio.update(game());assert.equal(audio.mix,1);audio.close();
});

test('Close отменяет отложенные загрузки и прекращает все музыкальные источники',async()=>{
 const first=deferred(),audio=setup(new Map([['shop-day',first]]));await audio.unlock();await audio.playTheme('menu');const waiting=audio.playTheme('shop-day');audio.close();first.resolve();await waiting;await settle();
 assert.equal(audio.context.state,'closed');assert.equal(activeMusic(audio).length,0);assert.equal(await audio.unlock(),false);await audio.bark();audio.creak();assert.equal(activeMusic(audio).length,0);
});

test('Две одновременные реплики гав дают один источник, даже если файл ещё загружается',async()=>{
 const first=deferred(),audio=setup(new Map([['bark',first]]));await audio.unlock();const a=audio.bark(),b=audio.bark();first.resolve();await Promise.all([a,b]);
 assert.equal(audio.context.started.filter(s=>!s.loop).length,1);audio.close();
});

test('Пока гав загружается, повторное нажатие через полсекунды не создаёт звуковой залп',async()=>{
 const first=deferred(),audio=setup(new Map([['bark',first]]));await audio.unlock();const a=audio.bark();audio.context.advance(.5);const b=audio.bark();first.resolve();await Promise.all([a,b]);
 assert.equal(audio.context.started.filter(s=>!s.loop).length,1);audio.close();
});

test('Выключение эффектов, mute, скрытие или close во время загрузки гав отменяют звук и duck',async()=>{
 for(const disable of [audio=>audio.setVolume(0),audio=>audio.setMuted(true),audio=>audio.setHidden(true),audio=>audio.close()]){
  const first=deferred(),audio=setup(new Map([['bark',first]]));await audio.unlock();const waiting=audio.bark();disable(audio);first.resolve();assert.equal(await waiting,false);
  assert.equal(audio.context.started.length,0);assert.equal(audio.mix,1);audio.close();
 }
});

class Element{
 constructor(tag='div'){this.tagName=tag;this.children=[];this.dataset={};this.listeners={};}
 addEventListener(name,fn){this.listeners[name]=fn;}
 append(...nodes){this.children.push(...nodes);}
 replaceChildren(...nodes){this.children=[...nodes];}
 setAttribute(){}
 focus(){}
 querySelector(){return this.children[0]||null;}
 getContext(){return {};}
}
test('F рядом с хранителем и строка «гав?» в его диалоге не дублируют звук',async()=>{
 const audio=setup(),nodes=new Map();globalThis.document={getElementById:id=>{if(!nodes.has(id))nodes.set(id,new Element());return nodes.get(id);},createElement:tag=>new Element(tag),createTextNode:text=>({textContent:text}),querySelectorAll:()=>[],addEventListener(){}};
 globalThis.requestAnimationFrame=()=>1;globalThis.cancelAnimationFrame=()=>{};
 const g=new Game(new Element('canvas'));g.audio=audio;await audio.unlock();await settle();g.night=true;g.enterRoom();g.player.x=g.level.keeper.x-14;g.player.y=g.level.keeper.y-14;g.interact();await settle();
 assert.equal(g.state,'dialogue');assert.equal(audio.context.started.filter(s=>!s.loop).length,1);g.destroy();audio.close();
});

test('Все восемь тем и гав существуют как PCM WAV, а не битые ссылки',async()=>{
 for(const name of ['menu','park-day','park-night','shop-day','shop-night','square-day','square-night','house','bark']){
  const bytes=await readFile(new URL('../assets/audio/'+name+'.wav',import.meta.url));
  assert.equal(bytes.toString('ascii',0,4),'RIFF',name);assert.equal(bytes.toString('ascii',8,12),'WAVE',name);assert.equal(bytes.toString('ascii',12,16),'fmt ',name);
  assert.equal(bytes.readUInt16LE(20),1,name+' должен иметь PCM формат');assert.ok(bytes.readUInt32LE(24)>=22050,name+' частота дискретизации');assert.ok(bytes.length>44,name+' пустой файл');
  assert.equal(bytes.readUInt32LE(4)+8,bytes.length,name+' длина RIFF');
 }
});
