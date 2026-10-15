import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Player} from '../js/Player.js';
import {moveAndCollide,findPath,overlaps} from '../js/Collision.js';
import {LEVELS,activeObstacles,visibleItem} from '../js/levels.js';
const input=(...directions)=>({held:a=>directions.includes(a)});
test('Персонаж не проходит через препятствие справа и снизу',()=>{
 const p={x:71,y:180,w:28,h:28,vx:190,vy:0};moveAndCollide(p,[{x:100,y:100,w:30,h:180}],1/120);assert.equal(p.x,72);
 const q={x:150,y:71,w:28,h:28,vx:0,vy:190};moveAndCollide(q,[{x:100,y:100,w:180,h:30}],1/120);assert.equal(q.y,72);
});
test('Диагональ не увеличивает скорость',()=>{
 const a=new Player(),b=new Player();a.reset({x:100,y:100});b.reset({x:100,y:100});a.update(.1,input('right'),[]);b.update(.1,input('right','down'),[]);
 assert.ok(Math.abs(Math.hypot(b.x-100,b.y-100)-(a.x-100))<1e-8);
});
test('Одинаковое движение при 30, 60 и 144 Гц',()=>{
 const run=hz=>{const p=new Player();let acc=0;for(let f=0;f<hz;f++){acc+=1/hz;while(acc+1e-10>=1/120){p.update(1/120,input('right'),[]);acc-=1/120;}}return p.x;};
 assert.ok(Math.abs(run(30)-run(144))<.01);assert.ok(Math.abs(run(60)-run(144))<.01);
});
test('Каждая вещь, хранитель и выход доступны ночью, даже при перемещении стула',()=>{
 for(const l of LEVELS)for(const position of l.chair?.positions||[null]){
  const chair=position?{...l.chair,...position}:null,obs=activeObstacles(l,true,chair);
  const start={x:l.spawn.x+14,y:l.spawn.y+14};
  for(const target of [...l.items,l.keeper,{x:l.exit.x-15,y:l.exit.y+15}]){
   const path=findPath(start,target,obs);assert.ok(path.length,l.name+' → '+JSON.stringify(target));
   // Все ячейки маршрута, кроме точки старта, вмещают мопса.
   for(const p of path.slice(1))assert.ok(!obs.some(o=>overlaps({x:p.x-14,y:p.y-14,w:28,h:28},o)));
  }
 }
});
test('В каждой дневной карте можно подойти к месту ожидания полуночи',()=>{
 for(const l of LEVELS){const target=l.landmark.kind==='clock'?{x:l.landmark.x,y:l.landmark.y+85}:l.landmark;
 assert.ok(findPath({x:l.spawn.x+14,y:l.spawn.y+14},target,activeObstacles(l,false,l.chair)).length,l.name);}
});
test('Ограда исчезает ночью; скрытая вещь требует и ночи, и нюха',()=>{
 const l=LEVELS[0];assert.ok(activeObstacles(l,false).some(o=>o.kind==='gate'));assert.ok(!activeObstacles(l,true).some(o=>o.kind==='gate'));
 const hidden=l.items.find(i=>i.hidden);assert.equal(visibleItem(hidden,false,true),false);assert.equal(visibleItem(hidden,true,false),false);assert.equal(visibleItem(hidden,true,true),true);
});
test('Прыжок пересекает низкую преграду, а высокая стена остаётся непроходимой',()=>{
 const run=kind=>{const p=new Player();p.reset({x:100,y:300});let first=true;for(let i=0;i<75;i++){p.update(1/120,{held:a=>a==='right',take:a=>a==='jump'&&first},[{x:150,y:280,w:24,h:70,kind}]);first=false;}return p;};
 const low=run('log'),high=run('house');assert.ok(low.x>174);assert.equal(low.z,0);assert.equal(high.x,122);
});
test('Посадка внутри препятствия возвращает мопса на место перед прыжком',()=>{
 const p=new Player();p.reset({x:100,y:300});let first=true;
 for(let i=0;i<72;i++){p.update(1/120,{held:a=>a==='right',take:a=>a==='jump'&&first},[{x:150,y:280,w:180,h:70,kind:'log'}]);first=false;}
 assert.equal(p.x,100);assert.equal(p.z,0);
});

// Следуем маршруту настоящими обновлениями Player, а не телепортируем
// персонажа к предмету. Проверка BFS сама по себе не проверяет коллизии движения.
function walkRoute(player,path,obstacles){
 for(const point of path){
  for(const [axis,negative,positive] of [['x','left','right'],['y','up','down']]){
   let attempts=0;
   while(Math.abs(player.center[axis]-point[axis])>.01){
    const difference=point[axis]-player.center[axis],before=player[axis];
    player.update(Math.min(1/120,Math.abs(difference)/190),input(difference<0?negative:positive),obstacles);
    assert.ok(Math.abs(player[axis]-before)>.00001,'Движение заблокировано на '+JSON.stringify(point));
    assert.ok(++attempts<200,'Маршрут не достигает следующей точки');
   }
  }
  assert.ok(!obstacles.some(o=>overlaps(player,o)),'Маршрут пересёк препятствие');
 }
}

test('Дневные семена, колодец и клумба доступны обычным движением от входа',()=>{
 for(const l of LEVELS){
  const obstacles=activeObstacles(l,false,l.chair);
  for(const target of [...(l.herbs||[]),l.well,l.garden].filter(Boolean)){
   const player=new Player();player.reset(l.spawn);
   const path=findPath(player.center,target,obstacles);
   assert.ok(path.length,l.name+' → дневное действие '+JSON.stringify(target));
   walkRoute(player,path,obstacles);
   assert.ok(Math.hypot(player.center.x-target.x,player.center.y-target.y)<52,'Персонаж не дошёл до радиуса взаимодействия');
  }
 }
});

test('Все ночные улики, хранители, рычаг и выход достижимы настоящим движением',()=>{
 for(const l of LEVELS)for(const position of l.chair?.positions||[null]){
  const chair=position?{...l.chair,...position}:null,obstacles=activeObstacles(l,true,chair);
  const targets=[...l.items,l.keeper,l.puzzle,{x:l.exit.x+l.exit.w/2,y:l.exit.y+l.exit.h/2}].filter(Boolean);
  for(const target of targets){
   const player=new Player();player.reset(l.spawn);
   const path=findPath(player.center,target,obstacles);
   assert.ok(path.length,l.name+' → '+JSON.stringify(target));
   walkRoute(player,path,obstacles);
   assert.ok(Math.hypot(player.center.x-target.x,player.center.y-target.y)<53,'Персонаж не дошёл до радиуса взаимодействия');
  }
 }
});

test('Точки входа свободны, к фонарям и часам можно подойти без прыжка',()=>{
 for(const l of LEVELS)for(const night of [false,true]){
  const obstacles=activeObstacles(l,night,l.chair),player=new Player();player.reset(l.spawn);
  assert.ok(!obstacles.some(o=>overlaps(player,o)),l.name+' — вход внутри препятствия');
  // Часы являются препятствием: нужна доступная точка в радиусе осмотра,
  // а не возможность пройти внутрь здания.
  const candidates=[l.landmark,...[[0,66],[0,88],[-66,0],[66,0],[0,-66]].map(([x,y])=>({x:l.landmark.x+x,y:l.landmark.y+y}))];
  const path=candidates.map(target=>findPath(player.center,target,obstacles)).find(p=>p.length&&Math.hypot(p.at(-1).x-l.landmark.x,p.at(-1).y-l.landmark.y)<99);
  assert.ok(path,l.name+' — фонарь или часы недоступны');
  walkRoute(player,path,obstacles);
  assert.ok(Math.hypot(player.center.x-l.landmark.x,player.center.y-l.landmark.y)<99,'Цель вне радиуса осмотра');
 }
});

test('Прыжок не пересекает воду и заканчивается в допустимых границах карты',()=>{
 const player=new Player();player.reset({x:100,y:300});let first=true;
 for(let i=0;i<90;i++){
  player.update(1/120,{held:a=>a==='right',take:a=>a==='jump'&&first},[{x:150,y:280,w:24,h:70,kind:'pond'}]);first=false;
 }
 assert.equal(player.x,122);assert.equal(player.jumpTimer,0);assert.equal(player.z,0);
 const edge=new Player();edge.reset({x:1040,y:535});first=true;
 for(let i=0;i<90;i++){
  edge.update(1/120,{held:a=>a==='right'||a==='down',take:a=>a==='jump'&&first},[]);first=false;
 }
 assert.equal(edge.x,1080-edge.w);assert.equal(edge.y,580-edge.h);assert.equal(edge.z,0);
});
