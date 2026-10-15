import {Game} from './Game.js';
import {Soundscape} from './Soundscape.js';
const game=new Game(document.getElementById('game'));
game.audio=new Soundscape();
const audio=game.audio;
const musicNames={menu:'Дело на столе','park-day':'Солнечные тропы','park-night':'Лунная пыльца','shop-day':'Лавка часовщика','shop-night':'Закрытая дверь','square-day':'Площадь и фонари','square-night':'Улица между улицами',house:'Дом №0'};
audio.onTheme=name=>{document.getElementById('music-now').textContent='Тема: '+musicNames[name];};
audio.onError=()=>{document.getElementById('music-now').textContent='Музыка не загрузилась. Обнови страницу и повтори.';};
const settings=document.getElementById('audio-settings'),panel=document.getElementById('audio-panel'),music=document.getElementById('music-volume'),volume=document.getElementById('volume'),mute=document.getElementById('mute'),status=document.getElementById('sound-status');
music.value=Math.round(audio.musicVolume*100);volume.value=Math.round(audio.volume*100);
const syncMute=()=>{mute.setAttribute('aria-pressed',String(audio.muted));mute.textContent=audio.muted?'Включить весь звук':'Выключить весь звук';};syncMute();
const startAudio=async()=>{audio.update(game);await audio.unlock();};
window.addEventListener('pointerdown',startAudio,{capture:true});
window.addEventListener('keydown',startAudio,{capture:true});
settings.addEventListener('click',()=>{panel.hidden=!panel.hidden;if(!panel.hidden)startAudio();});
music.addEventListener('input',()=>audio.setMusicVolume(Number(music.value)/100));
volume.addEventListener('input',()=>audio.setVolume(Number(volume.value)/100));
mute.addEventListener('click',()=>{audio.setMuted(!audio.muted);syncMute();});
document.getElementById('test-sound').addEventListener('click',async()=>{
 await startAudio();
 if(audio.muted){status.textContent='Нажми «Включить весь звук», затем повтори проверку.';return;}
 if(!audio.volume){status.textContent='Подними громкость звуков, затем повтори проверку.';return;}
 if(audio.context?.state!=='running'){status.textContent='Браузер не запустил звук. Проверь разрешение звука для этой вкладки.';return;}
 const played=await audio.bark();status.textContent=audio.lastError?'Не удалось загрузить аудио. Обнови страницу и повтори.':played?'Сейчас прозвучал «гав». Музыка играет фоном после первого нажатия.':'Подожди секунду и нажми ещё раз.';
});
document.addEventListener('visibilitychange',()=>audio.setHidden(document.hidden));
window.addEventListener('pagehide',()=>{game.destroy();audio.close();},{once:true});
window.addEventListener('pageshow',event=>{if(event.persisted)location.reload();});
