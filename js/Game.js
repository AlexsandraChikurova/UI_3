import {LEVELS,ALL_ITEMS,activeObstacles,visibleItem} from './levels.js';
import {Player} from './Player.js';
import {InputHandler} from './InputHandler.js';
import {SceneRenderer} from './SceneRenderer.js';
import {SaveStore} from './SaveStore.js';
import {findPath,overlaps} from './Collision.js';
const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
const EVIDENCE={bell:'Колокольчик пахнет лунником. Магазин и парк связаны одним исчезновением.',card:'На обороте: «Встречаемся у часов, когда погаснет последний фонарь».',ribbon:'Лента повторяет запах колокольчика. Кто-то ходил из парка в магазин.',key:'Бирка «0» не совпадает ни с одним городским адресом.',photo:'На снимке стул стоит у нижней полки, а мопс — перед дверью с цифрой 0.',thread:'Красная нить связывает обрывки воспоминаний. Это работа хранителей.',clock:'Без стрелки часы не могут указать путь. Но какое время они должны показать?',letter:'«Когда погаснет последний фонарь, будет ровно полночь. Возвращайся по запаху липы».',sign:'Дом №0 существует на ночной карте, хотя на дневной его нет.'};
const DEDUCTIONS={garden:['Живой след','Лунник пахнет липой и дождём. Цветок, выросший днём, раскрывает ночной след.'],shop:['Фотография не врёт','Стул должен стоять у нижней полки, как на снимке. Пока на него смотрят, он не двигается.'],clock:['Время встречи','Открытка, письмо и рассказ Эхо указывают на полночь. Дом №0 — хранилище забытых вещей.']};
export class Game{
  constructor(canvas){
    this.canvas=canvas;this.player=new Player();this.input=new InputHandler(canvas);this.renderer=new SceneRenderer(canvas);this.store=new SaveStore();this.abort=new AbortController();
    this.resources={seeds:0,water:false,harvested:[]};this.garden={planted:false,watered:false};this.deductions=new Set();this.witnessQuestions=new Set();this.shopUnlocked=false;this.state='menu';this.scene='night';this.levelIndex=0;this.collected=new Set();this.talked=new Set();this.returned=[];this.ending=null;this.night=false;this.clockAwake=false;this.sniffing=false;this.chair=null;this.traces=[];this.traceTimer=0;this.time=0;this.last=0;this.accumulator=0;this.barkTimer=0;this.chairTimer=0;this.chairAway=false;
    this.ui=Object.fromEntries(['screen','screen-label','screen-title','screen-text','screen-extra','screen-actions','screen-footnote','hud','play-controls','objective','pause','inventory','help','sniff','night','mission','score','chapter-title','chapter-number','phase-label','resources','announcement','map','journal'].map(id=>[id,document.getElementById(id)]));
    const opts={signal:this.abort.signal};
    this.ui.pause.addEventListener('click',()=>this.pause(),opts);
    this.ui.inventory.addEventListener('click',()=>this.inventory(),opts);
    this.ui.help.addEventListener('click',()=>this.help(),opts);
    this.ui.map?.addEventListener('click',()=>this.map(),opts);
    this.ui.journal?.addEventListener('click',()=>this.journal(),opts);
    this.ui.sniff.addEventListener('click',()=>{if(this.state==='playing'){this.toggleSniff();canvas.focus({preventScroll:true});}},opts);
    this.ui.night.addEventListener('click',()=>{if(this.state==='playing')this.toggleNight();},opts);
    document.addEventListener('visibilitychange',()=>{if(document.hidden&&this.state==='playing')this.pause();},opts);
    window.addEventListener('blur',()=>{if(this.state==='playing')this.pause();},opts);
    document.getElementById('fullscreen').addEventListener('click',async()=>{
      try{if(document.fullscreenElement)await document.exitFullscreen();else await document.getElementById('app').requestFullscreen();}
      catch{this.announce('Этот браузер не разрешил полный экран. Игра доступна в окне.');}
    },opts);
    this.title();this.tick=this.tick.bind(this);this.frame=requestAnimationFrame(this.tick);
  }
  get level(){return LEVELS[this.levelIndex];}
  get obstacles(){return activeObstacles(this.level,this.night,this.chair);}
  get essentialsFound(){return this.level.items.filter(i=>i.essential).every(i=>this.collected.has(i.id));}
  get roomComplete(){return this.night&&this.essentialsFound&&this.talked.has(this.levelIndex)&&(this.levelIndex!==2||this.clockAwake);}
  itemVisible(i){if(i.id==='bell'&&!this.garden.watered)return false;if(i.id==='key'&&!this.shopUnlocked)return false;return visibleItem(i,this.night,this.sniffing);}
  announce(text){this.ui.announcement.textContent=text;}
  save(){if(!this.store.save(this)&&!this.saveWarned){this.saveWarned=true;this.announce('Браузер не разрешил сохранение. Прогресс останется только в текущей вкладке.');}}
  screen(mode,label,title,text,actions,footnote=''){
    this.input.clear();this.ui.hud.hidden=true;this.ui.objective.hidden=true;this.ui['play-controls'].hidden=true;this.ui.screen.hidden=false;this.ui.screen.className='screen '+mode;
    this.ui['screen-label'].textContent=label;this.ui['screen-title'].textContent=title;this.ui['screen-text'].textContent=text;this.ui['screen-footnote'].textContent=footnote;this.ui['screen-extra'].replaceChildren();this.ui['screen-actions'].replaceChildren();
    this.ui.screen.dataset.chapter=this.level.mood;this.ui.screen.dataset.speaker=mode==='dialogue'&&title===this.level.keeper.name?this.level.keeper.name:'';
    this.canvas.tabIndex=-1;this.ui.hud.inert=true;this.ui['play-controls'].inert=true;
    if(mode==='dialogue'&&/гав/i.test(text))this.audio?.bark?.();
    for(const [name,action]of actions){const b=document.createElement('button');b.textContent=name;if(!this.ui['screen-actions'].children.length)b.className='primary';b.addEventListener('click',()=>{if(/гав/i.test(name))this.audio?.bark?.();action();},{once:true});this.ui['screen-actions'].append(b);}
    this.ui['screen-actions'].querySelector('button')?.focus({preventScroll:true});this.announce(title+'. '+text);
  }
  title(){
    this.state='menu';this.scene='night';this.saved=this.store.load();
    this.ui.hud.hidden=true;this.ui.objective.hidden=true;this.ui['play-controls'].hidden=true;
    this.screen('title-screen','ИСТОРИЯ О ГОРОДЕ, КОТОРЫЙ ЗАБЫЛ','Мопс: После полуночи','Некоторые дороги видит только хороший нос.',[
      ...(this.saved?[['Продолжить',()=>this.restore()]]:[]),['Новая игра',()=>this.saved?this.confirmNew():this.newGame()],['Как играть',()=>this.help(true)]
    ],'Три ночи. Девять забытых вещей. Один неизвестный адрес.');
  }
  confirmNew(){
    this.state='confirm';this.screen('title-screen','НОВАЯ ИСТОРИЯ','Начать сначала?','Прежние находки будут заменены новой прогулкой.',[['Начать новую игру',()=>this.newGame()],['Оставить сохранение',()=>this.title()]]);
  }
  newGame(){
    this.resources={seeds:0,water:false,harvested:[]};this.garden={planted:false,watered:false};this.deductions.clear();this.witnessQuestions.clear();this.shopUnlocked=false;this.collected.clear();this.talked.clear();this.levelIndex=0;this.returned=[];this.ending=null;this.clockAwake=false;this.night=false;this.sniffing=false;
    this.cinematic([
      ['day','ДО ТОГО, КАК ГОРОД УСНУЛ','Самый обычный день.','Мопс знает здесь каждый угол: парк, магазин, старые часы. Он уверен, что ничто не может его удивить.'],
      ['night','00:00','Но полночь пахнет иначе.','Фонарь пахнет дождём, хотя небо ясное. Из-за ограды тянется запах колокольчика. За ней появляется переулок, которого днём не было.'],
      ['night','ПЕРВАЯ НОЧЬ','Нос помнит дорогу.','Мопс замечает след и решает узнать, куда он ведёт. В ночном городе живёт кто-то ещё. Может быть, стоит сначала поздороваться?']
    ],()=>{this.night=false;this.enterRoom();this.save();});
  }
  cinematic(slides,done){
    this.state='cutscene';let n=0;
    const next=()=>{if(n>=slides.length){this.scene=null;done();return;}const [scene,label,title,text]=slides[n++];this.scene=scene;this.screen('cinematic',label,title,text,[[n===slides.length?'Начать прогулку →':'Дальше →',next],['Пропустить',()=>{this.scene=null;done();}]],'Кат-сцена · текст можно читать в своём темпе');};
    next();
  }
  restore(){
    const s=this.saved;if(!s)return;
    this.resources=s.resources;this.garden=s.garden;this.deductions=new Set(s.deductions);this.witnessQuestions=new Set(s.witnessQuestions);this.shopUnlocked=s.shopUnlocked;this.levelIndex=s.level;this.collected=new Set(s.collected);this.talked=new Set(s.talked);this.night=s.night;this.clockAwake=s.clockAwake;this.returned=s.returned;this.ending=s.ending;
    if(s.ending){this.showEnding(s.ending,s.returned);return;}this.enterRoom(s.position,s.chairPosition);
  }
  enterRoom(position=null,chairPosition=0){
    this.scene=null;this.chairPosition=chairPosition===1?1:0;this.chair=this.level.chair?{...this.level.chair,...this.level.chair.positions[this.chairPosition]}:null;this.player.reset(position||this.level.spawn);if(this.obstacles.some(o=>overlaps(this.player,o)))this.player.reset(this.level.spawn);this.chairAway=false;this.chairTimer=0;this.chairNotice=false;this.thought='';this.thoughtTimer=0;const thought=document.getElementById('thought');if(thought)thought.hidden=true;this.sniffing=false;this.traceTimer=0;this.traces=[];this.syncUI();this.resume();this.updateMission();
  }
  resume(){
    this.state='playing';this.scene=null;this.input.clear();this.accumulator=0;this.ui.screen.hidden=true;this.ui.hud.hidden=false;this.ui.objective.hidden=false;this.ui['play-controls'].hidden=false;this.ui.hud.inert=false;this.ui['play-controls'].inert=false;this.canvas.tabIndex=0;this.canvas.focus({preventScroll:true});
  }
  setMission(text){this.ui.mission.textContent=text;this.announce(text);}
  pause(){
    if(this.state==='paused'){this.resume();return;}if(['map','journal','inventory','help'].includes(this.state)){if(this.overlayReturn==='menu'){this.title();return;}if(this.overlayReturn==='ended'){this.showEnding(this.ending,this.returned);return;}if(this.overlayReturn==='paused'){this.resume();this.pause();return;}this.resume();return;}if(this.state!=='playing')return;
    this.state='paused';this.save();this.screen('title-screen','ПАУЗА','Город подождёт.','Прогулка сохранена. Все твои находки остались в кармане.',[['Продолжить →',()=>this.resume()],['Карман',()=>this.inventory()],['Управление',()=>this.help()],['В главное меню',()=>this.title()]]);
  }
  help(fromMenu=false){
    const previous=this.state;this.overlayReturn=fromMenu?'menu':previous;this.state='help';
    this.screen('panel-screen','УПРАВЛЕНИЕ','Доверься своему носу.','Осматривай вещи и разговаривай с существами. Бои и смерти в этой истории не нужны.',[['Понятно →',()=>fromMenu?this.title():previous==='paused'?(this.resume(),this.pause()):this.resume()]],'На телефоне удобнее повернуть экран горизонтально.');
    const dl=document.createElement('dl');dl.className='control-list';
    for(const [key,text]of [['WASD / ↑↓←→','Ходить по городу'],['E · Нюх','Видеть следы запахов: золотой — вещь, голубой — хранитель, фиолетовый — путь'],['F · Осмотреть','Собрать улику, поговорить или открыть дверь'],['Space · Прыжок','Перепрыгнуть ветку, скамейку или стул'],['N · Полночь','Сравнить дневной и ночной город'],['M · Карта','Открыть карту и проверить, где ты находишься'],['J · Дело','Сопоставить найденные улики и показания'],['P / Esc · Пауза','Пауза; закрыть карту, журнал или карман'],['⛶','Полный экран']]){const dt=document.createElement('dt');dt.textContent=key;const dd=document.createElement('dd');dd.textContent=text;dl.append(dt,dd);}
    this.ui['screen-extra'].append(dl);
  }
  inventory(){
    const previous=this.state;this.overlayReturn=previous;this.state='inventory';
    this.screen('panel-screen','НАЙДЕННЫЕ ИСТОРИИ','Карман воспоминаний',this.collected.size+' из 9 вещей. Колокольчик, ключ и стрелка открывают путь дальше. Остальные вещи раскрывают историю.',[['Закрыть карман →',()=>previous==='paused'?(this.resume(),this.pause()):this.resume()]]);
    this.memoryCards(this.ui['screen-extra']);
  }
  closeOverlay(previous){if(previous==='paused'){this.resume();this.pause();}else this.resume();}
  map(){
    if(!['playing','paused'].includes(this.state))return;const previous=this.state;this.overlayReturn=previous;this.state='map';
    this.screen('panel-screen map-screen','КАРТА ОКРЕСТНОСТЕЙ','Тропы после полуночи','Знакомые места, забытые истории — и дорога, которая появляется ночью.',[['Сложить карту',()=>this.closeOverlay(previous)]],'Карта показывает маршрут. Переходы открываются по мере расследования.');
    const pane=document.createElement('div');pane.className='map-pane';
    pane.innerHTML=`<div class="illustrated-map"><img src="assets/art/town-map.png" alt="Рисованная карта осеннего города: парк с прудом, лавка, площадь с часами и лесная тропа."/><div class="map-mystery ${this.clockAwake?'revealed':''}"></div>${[{x:19,y:86,name:'Парк',n:1},{x:48,y:52,name:'Лавка',n:2},{x:75,y:67,name:'Площадь',n:3},{x:89,y:22,name:this.clockAwake?'ДОМ №0':'Неизвестный путь',n:'?'}].map((place,index)=>`<div class="map-stop ${index===this.levelIndex?'is-current':''} ${index>this.levelIndex&&!(index===3&&this.clockAwake)?'is-locked':''}" style="left:${place.x}%;top:${place.y}%"><span class="map-number">${index===this.levelIndex?'●':place.n}</span><span class="map-name">${place.name}</span>${index===this.levelIndex?'<span class="map-you"><svg viewBox="0 0 20 20" aria-hidden="true"><ellipse cx="10" cy="13" rx="5" ry="4"/><ellipse cx="4" cy="8" rx="2" ry="2.7"/><ellipse cx="8" cy="5" rx="2" ry="2.7"/><ellipse cx="13" cy="5" rx="2" ry="2.7"/><ellipse cx="17" cy="8" rx="2" ry="2.7"/></svg>Ты здесь</span>':''}</div>`).join('')}<div class="map-compass" aria-hidden="true">✧<small>С</small></div><span class="map-secret-note">ДОМ №0 · ${this.clockAwake?'путь открыт':'пока не найден'}</span></div>`;
    this.ui['screen-extra'].append(pane);const legend=document.createElement('div');legend.className='map-legend';
    [...LEVELS.map(l=>l.short),'ДОМ №0'].forEach((name,index)=>{const p=document.createElement('p');p.textContent=(index===this.levelIndex?'● Ты здесь · ':index<=this.levelIndex||index===3&&this.clockAwake?'✓ ':'◇ ')+name+(index>this.levelIndex&&(index!==3||!this.clockAwake)?' · путь ещё закрыт':'');legend.append(p);});this.ui['screen-extra'].append(legend);
  }
  journal(){
    if(!['playing','paused'].includes(this.state))return;const previous=this.state;this.overlayReturn=previous;this.state='journal';
    this.screen('panel-screen journal-screen','ДЕЛО №0','Адрес, которого нет',`${this.collected.size} улик · ${this.talked.size} свидетелей · ${this.deductions.size} выводов. Почему город теряет вещи, а мопс узнаёт их запах?`,[['Закрыть дело',()=>this.closeOverlay(previous)]],'Улики записываются автоматически. Выводы появляются, когда ты проверяешь свою версию.');
    const grid=document.createElement('div');grid.className='journal-cards';
    for(const [id,[title,text]] of Object.entries(DEDUCTIONS)){const card=document.createElement('article');card.className='deduction-card';const h=document.createElement('h3');h.textContent=this.deductions.has(id)?'✓ '+title:'? Непроверенная версия';const p=document.createElement('p');p.textContent=this.deductions.has(id)?text:{garden:'Какой цветок удерживает запах ночного переулка?',shop:'Что изменилось в лавке после полуночи?',clock:'В какое время открывается улица без адреса?'}[id];card.append(h,p);grid.append(card);}
    for(const item of ALL_ITEMS.filter(i=>this.collected.has(i.id))){const card=document.createElement('article');card.className='evidence-card';const h=document.createElement('h3');h.textContent=item.name;const p=document.createElement('p');p.textContent=EVIDENCE[item.id];const meta=document.createElement('span');meta.className='evidence-meta';meta.textContent=LEVELS.find(l=>l.items.includes(item)).short;card.append(meta,h,p);grid.append(card);}
    for(const index of this.talked){const card=document.createElement('article');card.className='evidence-card witness-card';const h=document.createElement('h3');h.textContent='Показания: '+LEVELS[index].keeper.name;const p=document.createElement('p');p.textContent=['Лунник любит свет и воду. Его запах — липа после дождя.','На фотографии стул стоит у нижней полки. Он двигается, когда на него не смотрят.','Последний фонарь гаснет в полночь. На открытке ждут именно этого мига.'][index];card.append(h,p);grid.append(card);}
    if(!this.collected.size&&!this.talked.size){const p=document.createElement('p');p.textContent='Начни с открытки в парке. Следы проявляются, если довериться носу.';grid.append(p);}this.ui['screen-extra'].append(grid);
  }
  memoryCards(parent,selection=false){
    const grid=document.createElement('div');grid.className='memory-grid';
    if(!this.collected.size){const p=document.createElement('p');p.textContent='Пока здесь только любопытство.';grid.append(p);}
    for(const item of ALL_ITEMS.filter(i=>this.collected.has(i.id))){
      const card=document.createElement('article');card.className='memory-card';
      if(selection){const label=document.createElement('label'),check=document.createElement('input');check.type='checkbox';check.value=item.id;check.checked=item.essential;label.append(check,document.createTextNode(item.name));card.append(label);}
      else{const h=document.createElement('h3');h.textContent=item.symbol+' '+item.name;card.append(h);}
      const p=document.createElement('p');p.textContent=item.text;card.append(p);grid.append(card);
    }parent.append(grid);
  }
  toggleSniff(){this.sniffing=!this.sniffing;this.traceTimer=0;this.syncUI();this.updateMission();this.announce(this.sniffing?'Нюх включён. Появились следы запахов.':'Нюх выключен.');}
  toggleNight(){
    this.night=!this.night;this.sniffing=false;
    // Если дневная ограда возникла на месте мопса, он возвращается к входу.
    if(this.obstacles.some(o=>overlaps(this.player,o)))this.player.reset(this.level.spawn);
    this.save();this.syncUI();
    if(this.night)this.cinematic([['night','ПОСЛЕ ПОЛУНОЧИ',this.level.name,this.level.changeText]],()=>{this.resume();this.updateMission();});
    else{this.resume();this.updateMission();}
  }
  nearby(){
    const p=this.player.center;
    if(this.player.jumpTimer)return null;
    const herb=this.level.herbs?.find(h=>!this.resources.harvested.includes(h.id)&&distance(p,h)<52);if(herb)return {kind:'herb',herb};
    if(this.level.garden&&distance(p,this.level.garden)<63)return {kind:'garden'};
    if(this.level.well&&distance(p,this.level.well)<60)return {kind:'well'};
    if(this.level.puzzle&&distance(p,this.level.puzzle)<60)return {kind:'puzzle'};
    const item=this.level.items.find(i=>!this.collected.has(i.id)&&this.itemVisible(i)&&distance(p,i)<53);if(item)return {kind:'item',item};
    if(this.night&&distance(p,this.level.keeper)<65)return {kind:'keeper'};
    if(distance(p,this.level.landmark)<99)return {kind:'landmark'};
    if(this.night&&this.sniffing&&distance(p,this.level.decoy)<48)return {kind:'decoy'};
    const d=this.level.exit;if(distance(p,{x:d.x+d.w/2,y:d.y+d.h/2})<65)return {kind:'exit'};
    return null;
  }
  nearbyLabel(near){if(near.kind==='herb')return 'Собрать семена';if(near.kind==='well')return 'Набрать воды';if(near.kind==='garden')return this.garden.watered?'Осмотреть лунник':this.garden.planted?'Полить лунник':'Исследовать клумбу';if(near.kind==='puzzle')return 'Проверить механизм';return near.kind==='item'?'Осмотреть '+near.item.name:near.kind==='keeper'?'Поговорить':near.kind==='landmark'?(this.night?'Обнюхать '+this.level.landmark.name:'Дождаться полуночи'):near.kind==='decoy'?'Проверить запах':'Открыть путь';}
  interact(){
    this.barkTimer=.6;this.audio?.bark?.();const near=this.nearby();
    if(!near){this.setMission('Тихое «гав» растворилось в городе. Подойди к вещи, хранителю, фонарю или двери.');return;}
    if(['herb','well','garden','puzzle'].includes(near.kind)){this.environmentAction(near);return;}
    if(near.kind==='item'){
      const i=near.item;this.collected.add(i.id);this.syncUI();this.save();this.state='dialogue';
      this.screen('dialogue','УЛИКА ЗАПИСАНА В ДЕЛО',i.name,i.text+' '+EVIDENCE[i.id],[['Положить в карман →',()=>{this.resume();this.updateMission();}]]);return;
    }
    if(near.kind==='keeper'){
      this.keeperDialogue();return;
    }
    if(near.kind==='landmark'){
      if(!this.night){this.toggleNight();return;}
      if(this.levelIndex===2){
        if(!this.essentialsFound||!this.talked.has(2)){this.setMission('Часы пахнут липой. Найди стрелку и поговори с Эхо, чтобы вспомнить дорогу.');return;}
        this.state='dialogue';this.screen('dialogue','СОПОСТАВЬ УЛИКИ','Время встречи',this.clockEvidence()+' Стрелка найдена. На какое время её поставить?',[['00:00 · последний фонарь погас',()=>this.setClock('00:00')],['03:15 · город уже спит',()=>this.setClock('03:15')],['06:30 · первый рассвет',()=>this.setClock('06:30')],['Пока не уверен',()=>{this.resume();this.updateMission();}]]);
      }else{this.sniffing=true;this.traceTimer=0;this.syncUI();this.setMission('Фонарь хранит запах ночной улицы. Следуй за точками, но проверяй, куда они ведут.');}
      return;
    }
    if(near.kind==='decoy'){this.state='dialogue';this.screen('dialogue','ЧУЖОЙ СЛЕД','Запах рассыпался.','Это запах старой булочки. Ничего опасного — просто чужая история. Настоящие воспоминания оставляют ровные золотые точки.',[['Вернуться к поискам →',()=>{this.resume();this.updateMission();}]]);return;}
    if(!this.roomComplete){this.setMission(!this.night?'Этот путь появляется только ночью.':!this.essentialsFound?'Сначала найди '+this.level.items.find(i=>i.essential).name+'.':!this.talked.has(this.levelIndex)?'Хранитель ещё не рассказал тебе свою историю.':'Обнюхай часы — F рядом с ними.');return;}
    if(this.levelIndex<2){
      const current=this.levelIndex;
      this.cinematic([['day','СЛЕДУЮЩИЙ ДЕНЬ',current===0?'Магазин снова закрыт.':'На площади всё как прежде.',current===0?'Колокольчик привёл мопса к старому магазину. Днём двери молчат. Но он уже знает: нужно дождаться полуночи.':'Ключ пахнет липой с площади. Жители идут мимо часов и не замечают, что у них не хватает одной стрелки.']],()=>{this.levelIndex++;this.night=false;this.enterRoom();this.save();});
    }else this.cinematic([
      ['door','ВЗГЛЯД МОПСА','Дом №0.','С этой высоты дверь кажется огромной. Но запах знакомый. Как будто ты возвращаешься домой.'],
      ['house','ПО ТУ СТОРОНУ ДВЕРИ','Здесь берегут забытое.','Внутри — игрушки, письма, фотографии, вывески. Ты сам создавал этот город во сне, чтобы у потерянных вещей оставался дом. Хранители ждут твоего решения.']
    ],()=>this.chooseEnding());
  }
  chooseEnding(){
    this.state='choice';this.scene='house';
    this.screen('cinematic','ДОМ №0','Что ты хочешь сохранить?','Ты собрал '+this.collected.size+' воспоминаний. Вернуть найденные вещи жителям, оставить их хранителям или решить судьбу каждой отдельно?',[
      ['Вернуть всё найденное городу',()=>this.showEnding('return',[...this.collected])],
      ['Оставить всё в доме №0',()=>this.showEnding('keep',[])],
      ['Выбрать, что вернуть',()=>this.selectMemories()]
    ],'Другие вещи останутся в доме. У каждого решения есть своя история.');
  }
  keeperDialogue(){
    const k=this.level.keeper,chapter=this.levelIndex;this.state='dialogue';
    const reply=text=>{this.talked.add(chapter);this.witnessQuestions.add(this.level.mood);this.save();this.screen('dialogue','ПОКАЗАНИЕ СВИДЕТЕЛЯ',k.name,text,[['Гав! Спасибо →',()=>{this.resume();this.updateMission();}],['Ещё один вопрос',()=>this.keeperDialogue()]]);};
    const topic=[['Чем пахнет пропавшая вещь?','«Липой после дождя. Это лунник. Днём собери семена, выбери знакомый запах и полей клумбу. Ночью цветок покажет дорогу к колокольчику».'],['Что здесь поменялось?','«Сравни лавку со старой фотографией. Стул должен стоять у нижней полки. Он стесняется двигаться при свидетелях. Когда всё окажется на своих местах, проверь рычаг».'],['Когда ждали у часов?','«На открытке сказано: когда погаснет последний фонарь. В письме — ровно полночь. Даже если ты не нашёл их, я помню обе строки. Поставь стрелку на время встречи».']][chapter];
    this.screen('dialogue','РАЗГОВОР С ХРАНИТЕЛЕМ',k.name,this.talked.has(chapter)?'Хранитель узнаёт мопса и кивает. Теперь можно спросить о деле.':'Маленькое существо насторожилось. Мопс садится рядом и тихонько спрашивает: «гав?»',[
      ['Тихонько: «гав?»',()=>reply(topic[1])],
      [topic[0],()=>reply(topic[1])],
      ['Ты тоже слышал?',()=>reply(chapter===1?'«Да… за твоей спиной скрипит дерево. Посмотри на комнату, потом отвернись и прислушайся. Кто-то пытается вернуться на своё место».':'«Город разговаривает очень тихо. Запахи говорят больше, чем звуки. Загляни туда, где раньше было пусто».')],
      ['Что случилось с городом?',()=>reply(['«Люди забывают вещи. Мы бережём то, что осталось. Но недавно исчез даже адрес, куда их относили».','«На старой фотографии есть дверь с цифрой ноль. Ты узнаёшь это место? Иногда нос помнит то, что забывает голова».','«Ты строил этот город во сне, чтобы потерянные вещи не исчезали. Дом №0 существует, пока его помнят. Дальше решаешь ты».'][chapter])],
      ['До встречи',()=>{this.resume();this.updateMission();}]
    ]);
  }
  clockEvidence(){return this.collected.has('letter')?'Письмо: «Когда погаснет последний фонарь, будет ровно полночь».':this.collected.has('card')?'Открытка: «Встречаемся у часов, когда погаснет последний фонарь». Эхо помнит: это происходит в полночь.':'Эхо помнит открытку и письмо: встреча назначена на миг, когда погаснет последний фонарь, — ровно полночь.';}
  plantSeed(scent){
    if(scent!=='linden'){this.resume();this.setMission('Мёд пахнет пекарней, хвоя — лесом. Искомый след пахнет липой после дождя. Семена остались у тебя.');return;}
    if(this.night||!this.resources.seeds||this.garden.planted){this.resume();this.updateMission();return;}
    this.resources.seeds--;this.garden.planted=true;this.deductions.add('garden');this.save();this.syncUI();this.resume();this.setMission('Знакомый запах! Лунник посажен. Набери воды в колодце и полей клумбу.');
  }
  interpretPhoto(position){
    if(!this.collected.has('photo')||!this.talked.has(1)){this.resume();this.setMission('Чтобы проверить версию, нужна фотография и показания Тихона.');return;}
    if(position!=='lower'){this.resume();this.setMission('На фотографии ножки стула почти касаются нижней полки. Посмотри внимательнее: J — улики.');return;}
    this.deductions.add('shop');this.save();this.resume();this.setMission('Стул стоял у нижней полки. Отвернись от него и прислушайся, затем проверь рычаг.');
  }
  selectMemories(){
    this.state='selection';this.screen('panel-screen','ТВОЁ РЕШЕНИЕ','У каждой вещи свой дом.','Отметь воспоминания, которые хочешь вернуть городу. Остальные останутся у хранителей.',[
      ['Вернуть выбранные →',()=>{const ids=[...this.ui['screen-extra'].querySelectorAll('input:checked')].map(c=>c.value);this.showEnding(ids.length===0?'keep':ids.length===this.collected.size?'return':'some',ids);}],
      ['Вернуться к выбору',()=>this.chooseEnding()]
    ]);this.memoryCards(this.ui['screen-extra'],true);
  }
  showEnding(choice,returned=[]){
    this.ending=choice;this.returned=returned;this.state='ended';this.scene=choice==='return'?'return':choice==='some'?'some':'keep';this.save();
    const names=ALL_ITEMS.filter(i=>returned.includes(i.id)).map(i=>i.name.toLowerCase()).join(', ');
    const title=choice==='return'?'Город вспомнил.':choice==='keep'?'У забытых вещей есть дом.':'Город изменился — по-твоему.';
    const text=choice==='return'?'Утром зазвенел колокольчик магазина. У часов встретились старые друзья. Только мопс знает, почему знакомые улицы стали чуть теплее.':choice==='keep'?'Ночная улица осталась. Теперь дом №0 больше не потерян: мопс помнит дорогу, а хранителям есть с кем разделить свои истории.':'В город вернулись: '+names+'. Остальные истории остались под защитой хранителей. Днём город живёт дальше, а ночью мопсу есть куда вернуться.';
    this.screen('cinematic','ФИНАЛ · '+(choice==='return'?'РАССВЕТ':choice==='keep'?'НОЧНОЙ ХРАНИТЕЛЬ':'ДВА МИРА'),title,text,[['Посмотреть находки',()=>{this.overlayReturn='ended';this.state='inventory';this.screen('panel-screen','ИСТОРИИ ПРОГУЛКИ','Карман воспоминаний',this.collected.size+' из 9 найдено.',[['К финалу',()=>this.showEnding(choice,returned)]]);this.memoryCards(this.ui['screen-extra']);}],['В главное меню',()=>this.title()]],'Найдено '+this.collected.size+' / 9. Возвращено '+returned.length+'. Спасибо за прогулку.');
  }
  syncUI(){
    this.ui.resources.textContent='Семена: '+this.resources.seeds+' · вода: '+(this.resources.water?'есть':'нет');this.ui.score.textContent=this.collected.size+' / 9';this.ui['chapter-number'].textContent='НОЧЬ 0'+(this.levelIndex+1)+' / 03';this.ui['chapter-title'].textContent=this.level.name;this.ui['phase-label'].textContent=this.night?'НОЧЬ · 00:00':'ДЕНЬ · 17:42';
    this.ui.sniff.setAttribute('aria-pressed',String(this.sniffing));this.ui.night.replaceChildren(document.createTextNode(this.night?'День ':'Полночь '));const k=document.createElement('kbd');k.textContent='N';this.ui.night.append(k);
  }
  updateMission(){
    if(this.levelIndex===0&&!this.garden.watered){this.setMission(this.night?'Шелест знает тайну лунника. Днём собери семена, посади и полей клумбу. N — вернуться в день.':!this.garden.planted?(this.resources.seeds?'Посади лунник в клумбу внизу парка — F.':'Собери семена лунника у дорожек — F. Через ветки можно прыгнуть: Space.'):this.resources.water?'Полей посаженный лунник — F у клумбы.':'Набери воды в колодце слева — F, затем вернись к клумбе.');return;}
    if(this.levelIndex===1&&this.night&&!this.shopUnlocked){this.setMission(!this.talked.has(1)?'В лавке что-то тихо скрипит. Найди Тихона и спроси, что изменилось.':!this.collected.has('photo')?'Найди старую фотографию между полками. Сравни её с комнатой.':!this.deductions.has('shop')?'Фотография подсказывает прежнее место стула. Проверь свою версию у рычага.':'Пусть стул вернётся к нижней полке. Отвернись от него, затем проверь рычаг.');return;}
    if(!this.night){this.setMission(this.level.opening);return;}
    if(this.roomComplete){this.setMission('Путь открыт. Следуй за фиолетовым запахом к двери. Дополнительные вещи можно поискать до ухода.');return;}
    const item=this.level.items.find(i=>i.essential);
    if(!this.talked.has(this.levelIndex)){this.setMission('Найди хранителя: голубые ромбы при E. Подойди и тихонько поздоровайся — F.');return;}
    if(!this.essentialsFound){this.setMission('Хранитель подсказал дорогу. Ищи '+item.name.toLowerCase()+': золотые точки при E. Осмотри вещь — F.');return;}
    this.setMission('Вернись к часам и обнюхай их — F. Они проявят путь к дому №0.');
  }
  buildTraces(){
    this.traces=[];if(!this.sniffing)return;
    const center=this.player.center,obs=this.obstacles;
    const items=this.level.items.filter(i=>!this.collected.has(i.id)&&this.itemVisible(i)).sort((a,b)=>distance(center,a)-distance(center,b));
    if(this.levelIndex===0&&!this.garden.watered){const target=!this.garden.planted?(this.resources.seeds?this.level.garden:this.level.herbs.find(h=>!this.resources.harvested.includes(h.id))):this.resources.water?this.level.garden:this.level.well;if(target)this.traces.push({kind:'item',points:findPath(center,target,obs)});}
    if(this.levelIndex===1&&this.night&&!this.shopUnlocked)this.traces.push({kind:'secret',points:findPath(center,this.level.puzzle,obs)});
    const essential=items.find(i=>i.essential);
    const targets=[...new Set([essential,...items.filter(i=>!i.essential).slice(0,1)].filter(Boolean))];
    for(const i of targets)this.traces.push({kind:'item',points:findPath(center,i,obs)});
    if(this.night&&!this.talked.has(this.levelIndex))this.traces.push({kind:'keeper',points:findPath(center,this.level.keeper,obs)});
    if(this.roomComplete){const d=this.level.exit;this.traces.push({kind:'secret',points:findPath(center,{x:d.x-15,y:d.y+15},obs)});}
    if(this.night)this.traces.push({kind:'false',points:findPath(center,this.level.decoy,obs).slice(-8)});
  }
  environmentAction(near){
    if(near.kind==='herb'){
      if(this.night){this.setMission('Ночью семена не собрать. Вернись в день — N.');return;}
      if(this.resources.harvested.includes(near.herb.id)){this.setMission('Этот стручок уже собран.');return;}
      this.resources.harvested.push(near.herb.id);this.resources.seeds++;this.setMission('Найден стручок лунника. В нём семена для ночного цветка.');
    }else if(near.kind==='well'){this.resources.water=true;this.setMission('Набрана вода. Теперь можно полить посаженный лунник.');}
    else if(near.kind==='garden'){
      if(this.night){this.setMission(this.garden.watered?'Лунник расцвёл. Его запах открыл путь к колокольчику.':'Сажать и поливать лучше днём — N.');return;}
      if(!this.garden.planted){if(!this.resources.seeds){this.setMission('Сначала собери хотя бы один стручок лунника у дорожки — F.');return;}this.state='dialogue';this.screen('dialogue','ЖИВОЙ СЛЕД','Что вырастет из семени?','У ночного переулка запах липы после дождя. Среди семян мопс различает три запаха. Какой продолжит этот след?',[['Липа и дождь',()=>this.plantSeed('linden')],['Мёд и тёплый хлеб',()=>this.plantSeed('honey')],['Хвоя и мороз',()=>this.plantSeed('pine')],['Подумать ещё',()=>this.resume()]]);return;}
      else if(!this.garden.watered){if(!this.resources.water){this.setMission('Воды пока нет. Колодец находится слева от клумбы.');return;}this.resources.water=false;this.garden.watered=true;this.setMission('Клумба полита. Дождись полуночи — N, чтобы увидеть, что вырастет.');}
      else this.setMission('Лунник растёт. Его запах проявится ночью.');
    }else if(near.kind==='puzzle'){
      if(!this.night){this.setMission('Днём рычаг не действует. Дождись полуночи — N.');return;}
      if(this.shopUnlocked){this.setMission('Ящик уже открыт. Ключ ждёт рядом с прилавком.');return;}
      if(!this.collected.has('photo')||!this.talked.has(1)){this.setMission(!this.talked.has(1)?'Прежде чем трогать механизм, спроси Тихона, что изменилось в лавке.':'Сначала найди фотографию между полками. На ней комната выглядит иначе.');return;}
      if(!this.deductions.has('shop')){this.state='dialogue';this.screen('dialogue','СРАВНИ ФОТОГРАФИЮ И КОМНАТУ','Место для стула','Тихон говорит: мебель пытается вспомнить своё место. На старой фотографии ножки стула почти касаются нижней полки. Куда он должен вернуться?',[['К верхнему столу',()=>this.interpretPhoto('upper')],['К нижней полке',()=>this.interpretPhoto('lower')],['К входной двери',()=>this.interpretPhoto('door')],['Продолжить осмотр',()=>this.resume()]]);return;}
      if(this.chairPosition!==1){this.setMission('Рычаг не поддаётся. Стул должен встать у нижней полки. Повернись спиной к нему.');return;}
      this.shopUnlocked=true;this.setMission('Мебель вспомнила своё место. Потайной ящик открылся — появился ключ №0.');
    }
    this.traceTimer=0;this.syncUI();this.save();
  }
  setClock(time){
    if(this.levelIndex!==2||!this.essentialsFound||!this.talked.has(2)){this.resume();this.setMission('Для проверки нужны стрелка часов и рассказ Эхо.');return;}
    if(time!=='00:00'){this.resume();this.setMission('Часы тихо щёлкнули, но дверь не появилась. Ночная улица возникает ровно в полночь.');return;}
    this.clockAwake=true;this.deductions.add('clock');this.sniffing=true;this.save();this.syncUI();this.traceTimer=0;
    this.cinematic([['night','ЧАСЫ ПОКАЗЫВАЮТ НЕ ВРЕМЯ','00:00','Запахи сошлись в одной точке. За оградой появляется дверь дома №0. Теперь ты помнишь, где он стоит.']],()=>{this.resume();this.updateMission();});
  }
  updateChair(dt){
    if(!this.chair||!this.night)return;
    this.chairTimer=Math.max(0,this.chairTimer-dt);
    const p=this.player.center,dx=this.chair.x+22-p.x,dy=this.chair.y+22-p.y;
    const away=dx*this.player.facing.x+dy*this.player.facing.y<-30;
    if(away&&!this.chairAway&&!this.chairTimer){
      const index=1-this.chairPosition,next={...this.chair,...this.chair.positions[index]};
      if(distance(p,{x:next.x+22,y:next.y+22})>90&&!overlaps(this.player,next)){this.chair=next;this.chairPosition=index;this.chairTimer=1.5;this.traceTimer=0;this.chairNotice=true;this.audio?.creak();this.save();}
    }this.chairAway=away;
    if(this.chairNotice&&!away&&dx*this.player.facing.x+dy*this.player.facing.y>30){this.chairNotice=false;this.thought='Я, кажется, что-то слышал… Что-то поменялось.';this.thoughtTimer=4.5;const bubble=document.getElementById('thought');if(bubble){bubble.textContent=this.thought;bubble.hidden=false;}this.announce(this.thought);}
  }
  update(dt){
    this.input.advance(dt);if(this.input.take('map')){this.map();return;}if(this.input.take('journal')){this.journal();return;}if(this.input.take('sniff'))this.toggleSniff();if(this.input.take('night')){this.toggleNight();return;}
    if(this.thoughtTimer>0){this.thoughtTimer-=dt;if(this.thoughtTimer<=0){this.thought='';const bubble=document.getElementById('thought');if(bubble)bubble.hidden=true;}}
    this.player.update(dt,this.input,this.obstacles);this.updateChair(dt);this.barkTimer=Math.max(0,this.barkTimer-dt);
    this.traceTimer-=dt;if(this.traceTimer<=0){this.buildTraces();this.traceTimer=.25;}
    if(this.input.take('interact')&&!this.player.jumpTimer)this.interact();
  }
  tick(now){
    const delta=this.last?Math.min((now-this.last)/1000,.05):0;this.last=now;
    if(this.input.take('pause'))this.pause();
    if(this.state==='playing'){this.time+=delta;this.accumulator+=delta;while(this.accumulator>=1/120&&this.state==='playing'){this.update(1/120);this.accumulator-=1/120;}}
    else{this.accumulator=0;this.time+=Math.min(delta,.02);}
    this.audio?.update?.(this);this.renderer.render(this);this.frame=requestAnimationFrame(this.tick);
  }
  destroy(){cancelAnimationFrame(this.frame);this.input.destroy();this.abort.abort();}
}
