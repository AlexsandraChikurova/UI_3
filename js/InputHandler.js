const keys={Space:'jump',ArrowLeft:'left',KeyA:'left',ArrowRight:'right',KeyD:'right',KeyW:'up',ArrowUp:'up',KeyS:'down',ArrowDown:'down',KeyE:'sniff',KeyF:'interact',KeyN:'night',KeyP:'pause',Escape:'pause',KeyM:'map',KeyJ:'journal'};
export class InputHandler{
  constructor(canvas){
    this.down=new Set();this.pressed=new Set();this.pulses=new Map();this.abort=new AbortController();
    const options={signal:this.abort.signal};
    window.addEventListener('keydown',e=>{
      const action=keys[e.code];if(!action||e.target.closest('input,textarea,select')||action!=='pause'&&e.target.closest('button,a'))return;
      e.preventDefault();if(!e.repeat)this.press(e.code,action);
    },options);
    window.addEventListener('keyup',e=>this.release(e.code),options);
    window.addEventListener('blur',()=>this.clear(),options);
    document.querySelectorAll('[data-action]').forEach(button=>{
      const action=button.dataset.action;
      button.addEventListener('pointerdown',e=>{e.preventDefault();button.setPointerCapture(e.pointerId);this.press('pointer:'+action,action);button.classList.add('active');},options);
      const release=()=>{this.release('pointer:'+action);button.classList.remove('active');};
      button.addEventListener('pointerup',release,options);button.addEventListener('pointercancel',release,options);button.addEventListener('lostpointercapture',release,options);
      button.addEventListener('click',e=>{if(e.detail===0){this.pressed.add(action);this.pulses.set(action,.2);canvas.focus({preventScroll:true});}},options);
    });
  }
  advance(dt){for(const [k,t]of this.pulses)if(t<=dt)this.pulses.delete(k);else this.pulses.set(k,t-dt);}
  press(source,action){if(!this.down.has(source))this.pressed.add(action);this.down.add(source);}
  release(source){this.down.delete(source);}
  held(action){return this.pulses.has(action)||[...this.down].some(k=>(keys[k]||k.replace('pointer:',''))===action);}
  take(action){const value=this.pressed.has(action);this.pressed.delete(action);return value;}
  clear(){this.down.clear();this.pressed.clear();this.pulses.clear();document.querySelectorAll('.dpad .active').forEach(b=>b.classList.remove('active'));}
  destroy(){this.abort.abort();this.clear();}
}
