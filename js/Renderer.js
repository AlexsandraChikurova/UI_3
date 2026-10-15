export class Renderer{
  constructor(canvas){this.canvas=canvas;this.ctx=canvas.getContext('2d');}
  rect(x,y,w,h,color,r=0){const c=this.ctx;c.fillStyle=color;c.beginPath();c.roundRect(x,y,w,h,r);c.fill();}
  ellipse(x,y,rx,ry,color){const c=this.ctx;c.fillStyle=color;c.beginPath();c.ellipse(x,y,rx,ry,0,0,Math.PI*2);c.fill();}
  line(points,color,width=2){const c=this.ctx;c.strokeStyle=color;c.lineWidth=width;c.beginPath();points.forEach(([x,y],i)=>i?c.lineTo(x,y):c.moveTo(x,y));c.stroke();}
  text(text,x,y,color='#c4d3c2',size=12,font='Arial',align='left'){const c=this.ctx;c.fillStyle=color;c.font=size+'px '+font;c.textAlign=align;c.fillText(text,x,y);}
  glow(x,y,r,color){const c=this.ctx,g=c.createRadialGradient(x,y,0,x,y,r);g.addColorStop(0,color);g.addColorStop(1,color.slice(0,7)+'00');c.fillStyle=g;c.fillRect(x-r,y-r,r*2,r*2);}
  item(item,t){
    const c=this.ctx;c.save();c.translate(item.x,item.y+Math.sin(t*2+item.x)*2);c.shadowColor='#e0bf7c';c.shadowBlur=13;
    this.ellipse(0,0,15,15,'#d7b76c20');
    if(item.kind==='bell'){this.rect(-7,-8,14,14,'#e1c68c',6);this.rect(-10,4,20,4,'#f0dba6',2);this.ellipse(0,9,3,3,'#f0dba6');}
    else if(item.kind==='key'){this.ellipse(-6,-3,6,6,'#e1c68c');this.ellipse(-6,-3,3,3,'#314b47');this.rect(0,-5,17,4,'#e1c68c');this.rect(11,-3,4,7,'#e1c68c');}
    else if(item.kind==='ribbon'){this.ellipse(-6,0,8,6,'#e1c68c');this.ellipse(6,0,8,6,'#e1c68c');this.rect(-3,-4,6,8,'#f1dba1');}
    else if(item.kind==='clock'){this.ellipse(0,0,12,12,'#e1c68c');this.ellipse(0,0,9,9,'#314947');this.line([[0,-6],[0,0],[5,0]],'#f1dba1',2);}
    else if(item.kind==='spool'){this.rect(-8,-10,16,20,'#e1c68c',3);this.line([[-11,-10],[11,-10]],'#f1dba1',3);this.line([[-11,10],[11,10]],'#f1dba1',3);}
    else{this.rect(-13,-9,26,18,'#dfc992',2);this.line([[-10,-6],[0,2],[10,-6]],'#857857',1);}
    c.restore();
  }
}
