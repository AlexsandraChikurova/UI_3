import {Renderer} from './Renderer.js';
export class SceneRenderer extends Renderer{
 constructor(canvas){
  super(canvas);this.art={};for(const name of ['park','park-night','shop-clean','square','door','case-board','pug-walk','portraits']){if(typeof Image!=='undefined'){const im=new Image();im.src='assets/art/'+name+'.png';this.art[name]=im;}}
 }
 ready(im){return im?.complete&&im.naturalWidth>0;}
 cover(im,w,h){const s=Math.max(w/im.naturalWidth,h/im.naturalHeight);this.ctx.drawImage(im,(w-im.naturalWidth*s)/2,(h-im.naturalHeight*s)/2,im.naturalWidth*s,im.naturalHeight*s);}
 sprite(p){
  const im=this.art['pug-walk'],c=this.ctx,center=p.center;
  this.ellipse(center.x,center.y+13,18,6,'#17281e55');
  if(!this.ready(im))return;
  const row=Math.abs(p.facing.x)>.4?(p.facing.x<0?1:2):p.facing.y<0?3:0;
  const frame=p.vx||p.vy?Math.floor(p.walk*.6)%4:0,sw=im.naturalWidth/4,sh=im.naturalHeight/4;
  c.drawImage(im,frame*sw,row*sh,sw,sh,center.x-43,center.y-62-(p.z||0),86,86);
 }
 guardian(k,t){
  const im=this.art.portraits;if(!this.ready(im))return;const index=k.name==='Шелест'?1:k.name==='Тихон'?2:3;
  const sw=im.naturalWidth/2,sh=im.naturalHeight/2,bob=Math.sin(t*2)*2;
  this.glow(k.x,k.y,35,'#b4dc9228');this.ellipse(k.x,k.y+19,19,5,'#122c2540');this.ctx.drawImage(im,(index%2)*sw,Math.floor(index/2)*sh,sw,sh,k.x-26,k.y-42+bob,52,62);
 }
 chair(chair){
  const x=chair.x,y=chair.y,c=this.ctx;
  this.ellipse(x+18,y+30,26,7,'#181c2345');this.line([[x+5,y+4],[x+29,y-3],[x+32,y+18],[x+10,y+26],[x+5,y+4]],'#503626',4);this.line([[x+7,y+10],[x+30,y+3]],'#ba8a50',4);this.line([[x+9,y+18],[x+31,y+10]],'#bc905a',3);
  c.fillStyle='#ac7b47';c.beginPath();c.moveTo(x+2,y+24);c.lineTo(x+30,y+15);c.lineTo(x+43,y+25);c.lineTo(x+14,y+35);c.closePath();c.fill();this.line([[x+4,y+27],[x+4,y+44]],'#4e3324',4);this.line([[x+37,y+28],[x+37,y+43]],'#4e3324',4);
 }
 scene(game){
  const c=this.ctx,l=game.level,bg=this.art[l.mood==='shop'?'shop-clean':l.mood==='park'&&game.night?'park-night':l.mood];if(!this.ready(bg))return;
  c.drawImage(bg,0,0,1100,600);
  if(game.night){if(l.mood!=='park')this.rect(0,0,1100,600,'#10263c55');for(const p of [l.landmark,l.exit])this.glow(p.x,p.y,110,'#e7b45730');}
  if(game.sniffing)for(const trace of game.traces){
   c.save();c.strokeStyle=trace.kind==='secret'?'#d6a8ee':trace.kind==='keeper'?'#9fdcdb':'#eccc86';c.lineWidth=1;c.globalAlpha=.38;c.setLineDash([2,10]);c.beginPath();trace.points.forEach((p,i)=>i?c.lineTo(p.x,p.y):c.moveTo(p.x,p.y));c.stroke();c.restore();
   trace.points.forEach((p,i)=>{if(i%2)return;const wobble=Math.sin(game.time*2+i)*2;const color=trace.kind==='secret'?'#d9b2ed':trace.kind==='keeper'?'#a4e1da':trace.kind==='false'?'#c9ac6a70':'#f2d79a';this.ellipse(p.x,p.y+wobble,trace.kind==='false'?1:2,2,color);});
  }
  const actors=[];
  if(game.night)actors.push({y:l.keeper.y+16,draw:()=>this.guardian(l.keeper,game.time)});
  for(const item of l.items)if(!game.collected.has(item.id)&&game.itemVisible(item))actors.push({y:item.y+15,draw:()=>{this.glow(item.x,item.y,22,'#f2cf6a22');this.item(item,game.time);}});
  if(l.herbs)for(const herb of l.herbs)if(!game.resources.harvested.includes(herb.id))actors.push({y:herb.y+10,draw:()=>{this.ellipse(herb.x,herb.y,6,5,'#dfc279');this.line([[herb.x,herb.y+7],[herb.x,herb.y-5]],'#496637',2);this.ellipse(herb.x-4,herb.y-4,5,3,'#97b765');}});
  if(game.garden?.planted&&l.garden){const g=l.garden;actors.push({y:g.y+12,draw:()=>{this.line([[g.x,g.y+10],[g.x,g.y-8]],'#729558',3);this.ellipse(g.x,g.y-10,7,5,game.garden.watered&&game.night?'#edf4cc':'#a8bf76');if(game.garden.watered&&game.night)this.glow(g.x,g.y-10,55,'#d9ed973f');}});}
  if(game.chair)actors.push({y:game.chair.y+30,draw:()=>this.chair(game.chair)});
  actors.push({y:game.player.y+28,draw:()=>this.sprite(game.player)});actors.sort((a,b)=>a.y-b.y).forEach(a=>a.draw());
  if(game.night&&(l.mood!=='square'||game.clockAwake)){this.glow(l.exit.x+20,l.exit.y+20,45,game.roomComplete?'#e3dc9344':'#759d9024');}
  for(let i=0;i<15;i++){const x=(i*137+game.time*(2+i%3))%1100,y=170+(i*53)%390+Math.sin(game.time+i)*7;this.ellipse(x,y,1,1,'#e8d69075');}
  const near=game.nearby();if(near&&game.state==='playing'){const p=game.player.center;this.ellipse(p.x,p.y-60-(game.player.z||0),10,10,'#243b2ed9');this.text('F',p.x,p.y-56-(game.player.z||0),'#e6d7b3',11,'Georgia','center');}
 }
 render(game){
  const box=this.canvas.getBoundingClientRect(),dpr=Math.min(window.devicePixelRatio||1,1.5),w=Math.round(box.width*dpr),h=Math.round(box.height*dpr);
  if(this.canvas.width!==w||this.canvas.height!==h){this.canvas.width=w;this.canvas.height=h;}
  const c=this.ctx;c.setTransform(1,0,0,1,0,0);c.clearRect(0,0,w,h);c.fillStyle='#162a24';c.fillRect(0,0,w,h);c.imageSmoothingEnabled=true;
  if(['menu','confirm','paused'].includes(game.state)){const board=this.art['case-board'];if(this.ready(board))this.cover(board,w,h);return;}
  const doorScene=['door','house','keep','some'].includes(game.scene);
  const nightPark=game.level.mood==='park'&&(game.scene==='night'||game.night)&&game.scene!=='day'&&game.scene!=='return';
  const bg=this.art[doorScene?'door':game.level.mood==='shop'?'shop-clean':nightPark?'park-night':game.level.mood];if(!this.ready(bg))return;
  if(game.scene){this.cover(bg,w,h);if(!doorScene&&!nightPark&&game.scene!=='day'&&game.scene!=='return'){c.fillStyle='#14263775';c.fillRect(0,0,w,h);}return;}
  const scale=Math.max(w/1100,h/600)*1.13,viewW=w/scale,viewH=h/scale,p=game.player.center;
  const x=Math.max(0,Math.min(1100-viewW,p.x-viewW*.5)),y=Math.max(0,Math.min(600-viewH,p.y-viewH*.56));
  c.save();c.scale(scale,scale);c.translate(-x,-y);this.scene(game);c.restore();
  const shade=c.createRadialGradient(w/2,h*.5,h*.2,w/2,h*.5,Math.max(w,h)*.75);shade.addColorStop(0,'#102c2000');shade.addColorStop(1,'#10251c44');c.fillStyle=shade;c.fillRect(0,0,w,h);
 }
}
