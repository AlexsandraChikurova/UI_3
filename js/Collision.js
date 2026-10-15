export const overlaps=(a,b)=>a.x<b.x+b.w&&a.x+a.w>b.x&&a.y<b.y+b.h&&a.y+a.h>b.y;
export function moveAndCollide(body,obstacles,dt){
  body.x+=body.vx*dt;
  for(const o of obstacles)if(overlaps(body,o))body.x=body.vx>0?o.x-body.w:body.vx<0?o.x+o.w:body.x;
  body.x=Math.max(20,Math.min(1080-body.w,body.x));
  body.y+=body.vy*dt;
  for(const o of obstacles)if(overlaps(body,o))body.y=body.vy>0?o.y-body.h:body.vy<0?o.y+o.h:body.y;
  body.y=Math.max(30,Math.min(580-body.h,body.y));
}
// BFS обходит мебель с учётом размера персонажа. Возвращает дорожку запаха.
export function findPath(start,target,obstacles){
  const size=22,cols=50,rows=27;
  const cell=p=>[Math.max(1,Math.min(cols-2,Math.floor(p.x/size))),Math.max(2,Math.min(rows-2,Math.floor(p.y/size)))];
  const [sx,sy]=cell(start),[tx,ty]=cell(target),key=(x,y)=>y*cols+x;
  const blocked=(x,y)=>x<1||y<2||x>=cols-1||y>=rows-1||obstacles.some(o=>overlaps({x:x*size-3,y:y*size-3,w:28,h:28},o));
  const queue=[[sx,sy]],parents=new Map([[key(sx,sy),null]]);let end=null;
  for(let head=0;head<queue.length;head++){
    const [x,y]=queue[head];if(Math.abs(x-tx)+Math.abs(y-ty)<=1){end=[x,y];break;}
    for(const [dx,dy]of [[1,0],[-1,0],[0,1],[0,-1]]){const nx=x+dx,ny=y+dy,k=key(nx,ny);if(!parents.has(k)&&!blocked(nx,ny)){parents.set(k,[x,y]);queue.push([nx,ny]);}}
  }
  if(!end)return [];
  const route=[];for(let p=end;p;p=parents.get(key(...p)))route.push({x:Math.min(1066,p[0]*size+size/2),y:p[1]*size+size/2});
  return route.reverse();
}