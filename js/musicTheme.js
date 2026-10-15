export function musicTheme(game){
 if(['menu','confirm'].includes(game.state)||game.state==='help'&&game.overlayReturn==='menu')return 'menu';
 if(['door','house','keep','some'].includes(game.scene)||['choice','selection'].includes(game.state))return 'house';
 const night=game.scene==='return'||game.scene==='day'?false:game.scene==='night'?true:game.night;
 return game.level.mood+'-'+(night?'night':'day');
}
