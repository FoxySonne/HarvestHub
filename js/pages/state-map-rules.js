export const category=name=>name.startsWith('Бастион ')?'bastion':name.startsWith('Торговый пост ')?'trade':'territory';
export const territoryTypes=['Деревня','Завод','Городок','Мегаполис','Центр исследований','Военная база'];
export const today=()=>new Date().toISOString().slice(0,10);
export const rank=cell=>category(cell.location)==='bastion'?Number(cell.location.split(' ').at(-1)):territoryTypes.indexOf(cell.location)+1;
export function validDate(value){return /^\d{4}-\d{2}-\d{2}$/.test(value)&&!Number.isNaN(Date.parse(value))&&new Date(value).toISOString().slice(0,10)===value;}
export function captureError(owners,action,asset,counts={},start='') {
 const cell=asset.cells.find(c=>c.id===action.cell);if(!cell)return 'Участок не найден.';
 const kind=category(cell.location);if(kind==='trade')return 'Владение торговыми постами пока не планируется.';
 if(!validDate(action.date))return 'Укажите дату захвата.';
 if(start&&action.date<start)return 'Захват не может быть раньше начала сезона.';
 if(owners[cell.id]===action.owner)return 'Участок уже принадлежит этому союзу.';
 if(owners[cell.id])return 'Сначала добавьте сброс участка текущим владельцем.';
 const held=asset.cells.filter(c=>owners[c.id]===action.owner),same=held.filter(c=>category(c.location)===kind);
 if(same.length>=6)return 'У союза уже 6 '+(kind==='bastion'?'бастионов':'территорий')+'. Сначала добавьте сброс.';
 if((counts[action.date+'|'+action.owner+'|'+kind]||0)>=2)return 'На эту дату уже запланировано 2 захвата '+(kind==='bastion'?'бастионов':'территорий')+'.';
 if(rank(cell)>1&&!same.some(c=>rank(c)>=rank(cell)-1))return 'Нужен '+(kind==='bastion'?'бастион':'тип территории')+' предыдущей ступени либо уже захваченный участок такой же или более высокой ступени.';
 const neighbors=asset.cells.filter(c=>cell.neighbors.includes(c.id)&&owners[c.id]===action.owner&&category(c.location)==='bastion');
 if(kind==='bastion'&&same.length&&!neighbors.length)return 'Новый бастион должен иметь общую сторону с бастионом этого союза.';
 if(kind==='territory'&&!neighbors.length)return 'Для захвата территории нужен хотя бы один граничащий бастион этого союза.';
 return '';
}
export function replay(state,asset,until='9999-12-31') {
 const owners={...(state.planning?state.baseOwners:state.owners)},counts={},issues=[];
 if(!state.planning)return{owners,counts,issues};
 for(const alliance of state.alliances){const held=asset.cells.filter(c=>owners[c.id]===alliance.id);if(held.filter(c=>category(c.location)==='bastion').length>6||held.filter(c=>category(c.location)==='territory').length>6)issues.push({id:'base:'+alliance.id,error:'В исходном распределении союза «'+alliance.name+'» превышен лимит 6 бастионов или 6 территорий. Исправьте раскраску перед планированием.'});}
 const actions=state.actions.map((action,index)=>({...action,index})).sort((a,b)=>a.date.localeCompare(b.date)||a.index-b.index);
 for(const action of actions){if(action.date>until)continue;let error='';
  if(!state.alliances.some(a=>a.id===action.owner))error='Союз удалён.';
  else if(!validDate(action.date)||action.date<state.start)error='Дата действия раньше старта сезона или указана неверно.';
  else if(action.type==='drop'){if(owners[action.cell]!==action.owner)error='На этот момент участок не принадлежит указанному союзу.';}
  else error=captureError(owners,action,asset,counts,state.start);
  if(error){issues.push({id:action.id,error});continue;}
  if(action.type==='drop')delete owners[action.cell];else{owners[action.cell]=action.owner;const cell=asset.cells.find(c=>c.id===action.cell),key=action.date+'|'+action.owner+'|'+category(cell.location);counts[key]=(counts[key]||0)+1;}
 }
 return{owners,counts,issues};
}
export function summarize(owners,alliances,asset){return alliances.map(alliance=>{
 const held=asset.cells.filter(c=>owners[c.id]===alliance.id),types=new Set(held.map(c=>c.location));
 const result={...alliance,bastions:held.filter(c=>category(c.location)==='bastion').length,territories:held.filter(c=>category(c.location)==='territory').length,quartz:0,copper:0,productionBonus:0,attackBonus:0,constructionBonus:0,trainingBonus:0};
 for(const cell of held){const location=asset.locations.find(l=>l.name===cell.location);if(location?.resourceType==='Кварц')result.quartz+=location.resources;if(location?.resourceType==='Медь')result.copper+=location.resources;}
 if(types.has('Деревня'))result.productionBonus+=5;if(types.has('Мегаполис'))result.productionBonus+=20;if(types.has('Городок'))result.attackBonus+=2;if(types.has('Военная база'))result.attackBonus+=5;if(types.has('Завод'))result.constructionBonus=5;if(types.has('Центр исследований'))result.trainingBonus=10;
 return result;
});}
export function forecast(state,asset,from,to){
 if(!validDate(from)||!validDate(to)||from>to)throw new Error('Проверьте даты периода.');
 const days=Math.round((Date.parse(to)-Date.parse(from))/86400000)+1;if(days>730)throw new Error('Выберите период не длиннее 730 дней.');
 const totals=state.alliances.map(a=>({id:a.id,name:a.name,quartz:0,copper:0}));
 for(let i=0;i<days;i++){const date=new Date(Date.parse(from)+i*86400000).toISOString().slice(0,10);if(state.planning&&date<state.start)continue;const snapshot=replay(state,asset,date);for(const row of summarize(snapshot.owners,state.alliances,asset)){const total=totals.find(t=>t.id===row.id);total.quartz+=row.quartz*24;total.copper+=row.copper*24;}}
 return totals;
}
