const SVG_NS = 'http://www.w3.org/2000/svg';
const STORAGE_PREFIX = 'harvesthub_state_map_v1:';
const PALETTE = ['#e45756','#268bd2','#35a66f','#ad63d5','#d49c16','#e76cba','#16a5a5','#eb7935','#5d65c5','#8c7652','#8abd38','#8a354d'];
const TERRITORIES = ['Деревня','Завод','Городок','Мегаполис','Центр исследований','Военная база'];
export const category = name => name.startsWith('Бастион ') ? 'bastion' : name.startsWith('Торговый пост ') ? 'trade' : 'territory';
const el = (tag, text, className) => { const node = document.createElement(tag); if (text !== undefined) node.textContent = text; if(className) node.className=className; return node; };
export function summarize(owners, alliances, cells, locations) {
  return alliances.map(alliance => {
    const owned = cells.filter(cell => owners[cell.id] === alliance.id);
    const types = new Set(owned.map(cell => cell.location));
    const result = { ...alliance, bastions:0, territories:0, quartz:0, copper:0, productionBonus:0, attackBonus:0, constructionBonus:0, trainingBonus:0 };
    for (const cell of owned) {
      if(category(cell.location)==='bastion') result.bastions++;
      if(category(cell.location)==='territory') result.territories++;
      const location=locations.find(item=>item.name===cell.location);
      if(location?.resourceType==='Кварц') result.quartz+=location.resources;
      if(location?.resourceType==='Медь') result.copper+=location.resources;
    }
    if(types.has('Деревня')) result.productionBonus+=5;
    if(types.has('Мегаполис')) result.productionBonus+=20;
    if(types.has('Городок')) result.attackBonus+=2;
    if(types.has('Военная база')) result.attackBonus+=5;
    if(types.has('Завод')) result.constructionBonus=5;
    if(types.has('Центр исследований')) result.trainingBonus=10;
    return result;
  });
}

export async function init() {
  const root=document.querySelector('#state-map-workspace');
  if(!root) return;
  const signal=window.harvestHubPageAbortController?.signal;
  if(!document.querySelector('#state-map-css')) {
    const link=el('link');link.id='state-map-css';link.rel='stylesheet';link.href='css/features/state-map.css?v=20261119-1';document.head.append(link);
  }
  const message=root.querySelector('#sm-message');
  const listen=(node,event,fn,options={})=>node.addEventListener(event,fn,{...options,signal});
  let asset;
  try { const response=await fetch('assets/state-map/large-map.json',{signal}); if(!response.ok)throw new Error('HTTP '+response.status);asset=await response.json(); }
  catch(error){if(!signal?.aborted)message.textContent='Не удалось загрузить карту. Обновите страницу.';return;}
  if(signal?.aborted)return;
  const profile=window.getActiveProfile?.();
  const key=STORAGE_PREFIX+(profile?.type==='account' ? profile.userId || profile.id : profile?.id || 'guest');
  const blank=()=>({version:1,map:'large',alliances:[],owners:{}});
  function validate(data) {
    if(data?.version!==1 || data.map!=='large' || !Array.isArray(data.alliances) || !data.owners || typeof data.owners!=='object' || Array.isArray(data.owners))throw new Error('Неверный формат распределения.');
    const ids=new Set(),colors=new Set();
    for(const alliance of data.alliances) {
      if(typeof alliance.id!=='string'||!alliance.id||ids.has(alliance.id)||typeof alliance.name!=='string'||!alliance.name.trim()||alliance.name.length>40||!/^#[0-9a-f]{6}$/i.test(alliance.color)||colors.has(alliance.color.toLowerCase()))throw new Error('Проверьте названия и уникальность цветов союзов.');
      ids.add(alliance.id);colors.add(alliance.color.toLowerCase());
    }
    const byId=new Map(asset.cells.map(cell=>[cell.id,cell]));
    for(const [id,owner] of Object.entries(data.owners))if(!byId.has(id)||!ids.has(owner)||category(byId.get(id).location)==='trade')throw new Error('Распределение содержит неизвестный участок или союз.');
    return {version:1,map:'large',alliances:data.alliances.map(({id,name,color})=>({id,name,color})),owners:{...data.owners}};
  }
  let state=blank();
  try {const raw=localStorage.getItem(key);if(raw)state=validate(JSON.parse(raw));}catch{message.textContent='Не удалось прочитать сохранённое распределение. Старые данные не перезаписаны.';}
  let selected='',scale=1,panX=0,panY=0;
  const svg=root.querySelector('#sm-svg'),viewport=root.querySelector('#sm-viewport');
  const group=document.createElementNS(SVG_NS,'g');svg.append(group);
  const paths=new Map();
  for(const cell of asset.cells){
    const path=document.createElementNS(SVG_NS,'path');path.id='sm-'+cell.id;path.setAttribute('d',cell.d);path.dataset.cell=cell.id;
    const title=document.createElementNS(SVG_NS,'title');path.append(title);group.append(path);paths.set(cell.id,path);
  }
  const save=()=>{try{localStorage.setItem(key,JSON.stringify(state));message.textContent='Распределение сохранено в этом браузере.';}catch{message.textContent='Не удалось сохранить распределение. Скачайте его файлом, чтобы не потерять изменения.';}};
  const ownerName=id=>state.alliances.find(item=>item.id===id)?.name || 'Не назначен';
  function description(cell) {
    const location=asset.locations.find(item=>item.name===cell.location);
    const production=location.resources ? ' · '+location.resources+' '+location.resourceType.toLowerCase()+'/ч' : '';
    return cell.location+production+' · '+(category(cell.location)==='trade' ? 'Владелец — конкретный игрок; механика будет добавлена позже.' : 'Союз: '+ownerName(state.owners[cell.id]));
  }
  function renderSelection() {
    const box=root.querySelector('#sm-selection');box.replaceChildren();
    const cell=asset.cells.find(item=>item.id===selected);
    if(!cell){box.append(el('h2','Выберите участок'),el('p','Наведите на карту или выберите участок из списка ниже.'));}
    else {
      box.append(el('h2',cell.location),el('p',description(cell)));
      if(category(cell.location)!=='trade') {
        const label=el('label','Владелец участка'),select=el('select');select.id='sm-owner';
        select.append(new Option('Не назначен',''),...state.alliances.map(item=>new Option(item.name,item.id)));select.value=state.owners[selected]||'';label.append(select);box.append(label);
        listen(select,'change',()=>{if(select.value)state.owners[selected]=select.value;else delete state.owners[selected];save();render();});
      }
    }
    const label=el('label','Найти участок'),select=el('select');select.id='sm-cell-list';select.append(new Option('Выберите участок',''));
    const counters={};
    for(const item of asset.cells){counters[item.location]=(counters[item.location]||0)+1;select.append(new Option(item.location+' · участок '+counters[item.location],item.id));}
    select.value=selected;label.append(select);box.append(label);listen(select,'change',()=>{selected=select.value;render();});
  }
  function render() {
    const filter=root.querySelector('#sm-filter').value;
    for(const cell of asset.cells) {
      const path=paths.get(cell.id),owner=state.alliances.find(item=>item.id===state.owners[cell.id]);
      path.style.fill=owner?.color||'';path.dataset.selected=String(cell.id===selected);path.classList.toggle('sm-muted',filter!=='all'&&category(cell.location)!==filter);path.querySelector('title').textContent=description(cell);
    }
    const list=root.querySelector('#sm-alliances');list.replaceChildren();
    for(const alliance of state.alliances) {
      const row=el('div',undefined,'sm-alliance'),color=el('input'),name=el('span',alliance.name),remove=el('button','×');
      color.type='color';color.value=alliance.color;color.setAttribute('aria-label','Цвет союза '+alliance.name);remove.type='button';remove.setAttribute('aria-label','Удалить союз '+alliance.name);
      listen(color,'change',()=>{if(state.alliances.some(item=>item.id!==alliance.id&&item.color.toLowerCase()===color.value.toLowerCase())){message.textContent='Этот цвет уже занят другим союзом.';color.value=alliance.color;return;}alliance.color=color.value;save();render();});
      listen(remove,'click',()=>{if(!confirm('Удалить союз «'+alliance.name+'» и его отметки на этой карте?'))return;state.alliances=state.alliances.filter(item=>item.id!==alliance.id);for(const id of Object.keys(state.owners))if(state.owners[id]===alliance.id)delete state.owners[id];save();render();});
      row.append(color,name,remove);list.append(row);
    }
    const summary=root.querySelector('#sm-summary');summary.replaceChildren();
    if(!state.alliances.length)summary.append(el('p','Добавьте союз и назначьте ему участки на карте.'));
    for(const item of summarize(state.owners,state.alliances,asset.cells,asset.locations)) {
      const card=el('div',undefined,'sm-summary-item');card.append(el('strong',item.name),el('p','Бастионы: '+item.bastions+'/6 · Территории: '+item.territories+'/6'),el('p','Кварц: '+item.quartz+'/ч · Медь: '+item.copper+'/ч'));
      if(item.bastions>6||item.territories>6)card.append(el('p','Превышен лимит владений. В режиме раскраски распределение сохранено.','sm-warning'));
      const bonuses=[['Производство ресурсов',item.productionBonus],['Атака воинов',item.attackBonus],['Скорость строительства',item.constructionBonus],['Скорость обучения',item.trainingBonus]].filter(([,value])=>value).map(([name,value])=>name+': +'+value+'%');
      if(bonuses.length)card.append(el('p',bonuses.join(' · ')));
      summary.append(card);
    }
    renderSelection();
  }
  function transform(){const size=1024/scale;panX=Math.max(0,Math.min(1024-size,panX));panY=Math.max(0,Math.min(1024-size,panY));svg.setAttribute('viewBox',`${panX} ${panY} ${size} ${size}`);}
  function zoom(next){const previous=1024/scale;scale=Math.max(1,Math.min(8,next));const offset=(previous-1024/scale)/2;panX+=offset;panY+=offset;transform();}
  root.querySelectorAll('[data-sm-zoom]').forEach(button=>listen(button,'click',()=>button.dataset.smZoom==='reset'?zoom(1):zoom(scale*(button.dataset.smZoom==='in'?1.5:1/1.5))));
  let drag=null;
  listen(viewport,'pointerdown',event=>{if(event.button!==0)return;drag={id:event.pointerId,x:event.clientX,y:event.clientY,panX,panY,moved:false};viewport.setPointerCapture(event.pointerId);});
  listen(viewport,'pointermove',event=>{if(!drag||drag.id!==event.pointerId)return;const dx=event.clientX-drag.x,dy=event.clientY-drag.y;if(Math.hypot(dx,dy)>5)drag.moved=true;const factor=1024/scale/viewport.clientWidth;panX=drag.panX-dx*factor;panY=drag.panY-dy*factor;transform();});
  listen(viewport,'pointerup',event=>{if(!drag||drag.id!==event.pointerId)return;if(!drag.moved){const target=document.elementFromPoint(event.clientX,event.clientY)?.closest('[data-cell]');if(target){selected=target.dataset.cell;render();}}drag=null;});
  listen(viewport,'pointercancel',()=>{drag=null;});
  listen(viewport,'keydown',event=>{const offsets={ArrowLeft:[-40,0],ArrowRight:[40,0],ArrowUp:[0,-40],ArrowDown:[0,40]};if(offsets[event.key]){event.preventDefault();panX+=offsets[event.key][0]/scale;panY+=offsets[event.key][1]/scale;transform();}if(event.key==='+')zoom(scale*1.5);if(event.key==='-')zoom(scale/1.5);});
  listen(root.querySelector('#sm-filter'),'change',render);
  listen(root.querySelector('#sm-add-alliance'),'submit',event=>{
    event.preventDefault();const input=root.querySelector('#sm-alliance-name'),name=input.value.trim();if(!name)return;
    if(state.alliances.some(item=>item.name.toLocaleLowerCase()===name.toLocaleLowerCase())){message.textContent='Союз с таким названием уже есть.';return;}
    const used=new Set(state.alliances.map(item=>item.color.toLowerCase()));
    let color=PALETTE.find(item=>!used.has(item));
    for(let index=0;!color&&index<360;index++){const hue=(index*137.508)%360,s=.65,l=.48;const f=n=>{const k=(n+hue/30)%12;return Math.round(255*(l-s*Math.min(l,1-l)*Math.max(-1,Math.min(k-3,9-k,1)))).toString(16).padStart(2,'0');};const candidate='#'+f(0)+f(8)+f(4);if(!used.has(candidate))color=candidate;}
    if(!color){message.textContent='Не удалось подобрать свободный цвет.';return;}
    state.alliances.push({id:crypto.randomUUID(),name,color});input.value='';save();render();
  });
  listen(root.querySelector('#sm-export'),'click',()=>{const url=URL.createObjectURL(new Blob([JSON.stringify(state,null,2)],{type:'application/json'}));const link=el('a');link.href=url;link.download='HarvestHub-карта-штата.json';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);});
  listen(root.querySelector('#sm-import'),'change',async event=>{const file=event.target.files[0];if(!file)return;try{if(file.size>2000000)throw new Error('Файл слишком большой.');const incoming=validate(JSON.parse(await file.text()));if(signal?.aborted)return;if(!confirm('Заменить текущее распределение данными из файла?'))return;state=incoming;save();render();}catch(error){message.textContent=error.message;}finally{event.target.value='';}});
  listen(window,'harvesthub:profile-change',()=>window.loadPage('state-map.html'));
  message.textContent='Карта готова. Начните с добавления союза.';render();
}
