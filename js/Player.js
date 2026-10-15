import {moveAndCollide,overlaps} from './Collision.js';
const LOW=new Set(['bench','log','chair']);
export class Player{
 constructor(){this.w=28;this.h=28;this.reset({x:145,y:470});}
 reset(spawn){this.x=spawn.x;this.y=spawn.y;this.vx=0;this.vy=0;this.facing={x:0,y:-1};this.walk=0;this.z=0;this.jumpTimer=0;this.jumpOrigin=null;}
 get center(){return {x:this.x+this.w/2,y:this.y+this.h/2};}
 update(dt,input,obstacles){
  if(input.take?.('jump')&&!this.jumpTimer){this.jumpTimer=.6;this.jumpOrigin={x:this.x,y:this.y};}
  const dx=Number(input.held('right'))-Number(input.held('left')),dy=Number(input.held('down'))-Number(input.held('up')),length=Math.hypot(dx,dy)||1;
  this.vx=dx/length*190;this.vy=dy/length*190;if(dx||dy)this.facing={x:dx/length,y:dy/length};
  const airborne=this.jumpTimer>0;
  moveAndCollide(this,airborne?obstacles.filter(o=>!LOW.has(o.kind)):obstacles,dt);
  if(airborne){
   this.jumpTimer=Math.max(0,this.jumpTimer-dt);this.z=Math.sin((1-this.jumpTimer/.6)*Math.PI)*36;
   if(!this.jumpTimer){this.z=0;if(obstacles.some(o=>overlaps(this,o))){this.x=this.jumpOrigin.x;this.y=this.jumpOrigin.y;}}
  }
  this.walk+=Math.hypot(this.vx,this.vy)*dt*.07;
 }
}