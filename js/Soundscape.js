import {musicTheme} from './musicTheme.js';
const clamp=v=>Math.max(0,Math.min(1,Number(v)||0));
export class Soundscape{
 constructor(){
  this.context=null;this.master=null;this.effects=null;this.music=null;
  this.volume=.65;this.musicVolume=.55;this.muted=false;this.hidden=false;
  this.theme=null;this.track=null;this.buffers=new Map();this.voices=new Set();this.serial=0;this.mix=1;this.lastBark=-Infinity;this.duckUntil=0;this.closed=false;
  try{const saved=JSON.parse(localStorage.getItem('pug-audio-v1')||'null');if(saved){this.volume=clamp(saved.effects);this.musicVolume=clamp(saved.music);this.muted=!!saved.muted;}}catch{}
 }
 saveSettings(){try{localStorage.setItem('pug-audio-v1',JSON.stringify({effects:this.volume,music:this.musicVolume,muted:this.muted}));}catch{}}
 async unlock(){
  if(this.closed)return false;
  try{
   if(!this.context){
    const Audio=window.AudioContext||window.webkitAudioContext;if(!Audio)return false;
    this.context=new Audio();this.master=this.context.createGain();this.effects=this.context.createGain();this.music=this.context.createGain();
    this.effects.connect(this.master);this.music.connect(this.master);this.master.connect(this.context.destination);this.applyLevels();
   }
   if(this.context.state==='suspended')await this.context.resume();
   if(this.context.state==='running'){this.buffer('bark').catch(()=>{});if(this.wantedTheme&&!this.track)this.playTheme(this.wantedTheme);return true;}
  }catch(error){this.lastError=error.message;}
  return false;
 }
 applyLevels(){if(!this.context)return;const t=this.context.currentTime;this.master.gain.setTargetAtTime(this.muted||this.hidden?0:1,t,.12);this.effects.gain.setTargetAtTime(this.volume,t,.04);this.music.gain.setTargetAtTime(this.musicVolume*this.mix,t,.14);}
 setVolume(value){this.volume=clamp(value);this.saveSettings();this.applyLevels();}
 setMusicVolume(value){this.musicVolume=clamp(value);this.saveSettings();this.applyLevels();}
 setMuted(value){this.muted=!!value;this.saveSettings();this.applyLevels();}
 setHidden(value){this.hidden=!!value;this.applyLevels();}
 async buffer(name){
  if(!this.buffers.has(name)){
   const pending=fetch('assets/audio/'+name+'.wav').then(r=>{if(!r.ok)throw Error('Не загружено аудио '+name);return r.arrayBuffer();}).then(data=>this.context.decodeAudioData(data));
   this.buffers.set(name,pending);pending.catch(()=>this.buffers.delete(name));
  }
  return this.buffers.get(name);
 }
 async playTheme(name){
  this.wantedTheme=name;if(!this.context||this.context.state!=='running'||this.closed)return;
  if(this.theme===name)return;this.theme=name;const request=++this.serial;
  try{
   const buffer=await this.buffer(name);if(request!==this.serial||this.closed)return;
   const c=this.context,t=c.currentTime,old=this.track,source=c.createBufferSource(),gain=c.createGain();
   source.buffer=buffer;source.loop=true;gain.gain.setValueAtTime(0,t);gain.gain.linearRampToValueAtTime(1,t+2);
   source.connect(gain);gain.connect(this.music);source.start(t);
   const voice={source,gain,name};this.voices.add(voice);this.track=voice;
   source.onended=()=>{source.disconnect();gain.disconnect();this.voices.delete(voice);};
   if(old){old.gain.gain.cancelScheduledValues(t);old.gain.gain.setValueAtTime(old.gain.gain.value,t);old.gain.gain.linearRampToValueAtTime(0,t+2);old.source.stop(t+2.05);}
   for(const key of this.buffers.keys())if(!['bark',name,old?.name].includes(key))this.buffers.delete(key);
   this.lastError=null;this.onTheme?.(name);
  }catch(error){if(request===this.serial){this.lastError=error.message;this.theme=null;this.retryAt=Date.now()+5000;this.onError?.();}}
 }
 update(game){
  const theme=musicTheme(game);this.wantedTheme=theme;
  if(this.context?.state==='running'&&this.theme!==theme&&Date.now()>=(this.retryAt||0))this.playTheme(theme);
  const t=this.context?.currentTime||0;
  const mix=game.state==='paused' ? .22 : game.state==='dialogue' ? .45 : game.sniffing ? .7 : 1;
  const next=t<this.duckUntil?Math.min(mix,.23):mix;
  if(next!==this.mix){this.mix=next;this.applyLevels();}
 }
 duck(seconds=.8){if(this.context){this.duckUntil=Math.max(this.duckUntil,this.context.currentTime+seconds);this.mix=.23;this.applyLevels();}}
 async bark(){
  const c=this.context;if(!c||c.state!=='running'||this.muted||this.hidden||this.closed||this.volume<=0)return false;
  if(this.barkPending||c.currentTime-this.lastBark<.55)return false;this.lastBark=c.currentTime;this.barkPending=true;
  try{
   const buffer=await this.buffer('bark');if(this.closed||this.muted||this.hidden||this.volume<=0||c.state!=='running')return false;
   const source=c.createBufferSource(),gain=c.createGain();source.buffer=buffer;gain.gain.value=.85;source.connect(gain);gain.connect(this.effects);source.start();this.lastBark=c.currentTime;this.duck(.6);
   source.onended=()=>{source.disconnect();gain.disconnect();};return true;
  }catch(error){this.lastError=error.message;return false;}finally{this.barkPending=false;}
 }
 creak(){
  const c=this.context;if(!c||c.state!=='running'||this.muted||this.hidden||this.volume<=0)return;this.duck(1.2);
  const duration=.85,t=c.currentTime,buffer=c.createBuffer(1,Math.ceil(c.sampleRate*duration),c.sampleRate),data=buffer.getChannelData(0);
  for(let i=0;i<data.length;i++){const x=i/data.length;data[i]=(Math.random()*2-1)*Math.pow(Math.sin(x*Math.PI),2);}
  const noise=c.createBufferSource();noise.buffer=buffer;const filter=c.createBiquadFilter();filter.type='bandpass';filter.frequency.setValueAtTime(450,t);filter.frequency.exponentialRampToValueAtTime(900,t+.3);filter.frequency.exponentialRampToValueAtTime(220,t+.75);filter.Q.value=4;
  const gain=c.createGain();gain.gain.setValueAtTime(0,t);gain.gain.linearRampToValueAtTime(.22,t+.08);gain.gain.linearRampToValueAtTime(.1,t+.25);gain.gain.linearRampToValueAtTime(.2,t+.4);gain.gain.exponentialRampToValueAtTime(.001,t+.85);
  noise.connect(filter);filter.connect(gain);gain.connect(this.effects);noise.start(t);noise.stop(t+duration);noise.onended=()=>{noise.disconnect();filter.disconnect();gain.disconnect();};
  const tone=c.createOscillator(),tg=c.createGain();tone.type='triangle';tone.frequency.setValueAtTime(115,t);tone.frequency.linearRampToValueAtTime(77,t+.5);tg.gain.setValueAtTime(.018,t);tg.gain.exponentialRampToValueAtTime(.001,t+.75);tone.connect(tg);tg.connect(this.effects);tone.start(t);tone.stop(t+.8);tone.onended=()=>{tone.disconnect();tg.disconnect();};
 }
 close(){this.closed=true;++this.serial;for(const voice of this.voices){try{voice.source.stop();}catch{}}this.buffers.clear();if(this.context)this.context.close().catch(()=>{});}
}
