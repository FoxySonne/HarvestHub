// Интерактивное оформление экранов. Игровые данные, расчёты и сервер не подключены.
(() => {
 const locations = [
  ['treatment_1','Водоочистительный центр 1',37,70,'water-treatment-center.webp'],
  ['treatment_2','Водоочистительный центр 2',72,20,'water-treatment-center.webp'],
  ['processing_1','Водообрабатывающий завод 1',25,70,'water-processing-plant.webp'],
  ['processing_2','Водообрабатывающий завод 2',84,18,'water-processing-plant.webp'],
  ['processing_3','Водообрабатывающий завод 3',35,15,'water-processing-plant.webp'],
  ['processing_4','Водообрабатывающий завод 4',72,76,'water-processing-plant.webp'],
  ['solar','Солнечная электростанция',18,25,'solar-power-plant.webp'],
  ['helipad','Заброшенная вертолётная площадка',88,63,'abandoned-helipad.webp'],
  ['central','Центральный резервуар',51,48,'central-reservoir.webp'],
  ['development','Комплекс разработки',43,30,'development-complex.webp'],
  ['military','Военный завод',66,57,'military-factory.webp']
 ];
 const markers = document.querySelector('#reservoir-markers');
 const locationGrid = document.querySelector('#reservoir-locations');
 locations.forEach(([key,name,x,y,image]) => {
  const marker = document.createElement('button');
  marker.type='button'; marker.className='reservoir-marker'; marker.dataset.location=key;
  marker.style.left=x+'%';marker.style.top=y+'%';marker.setAttribute('aria-label',name);
  const img=document.createElement('img');img.src='assets/'+image;img.alt='';img.draggable=false;
  const label=document.createElement('span');label.textContent=({'treatment_1':'ВЦ 1','treatment_2':'ВЦ 2','processing_1':'ВЗ 1','processing_2':'ВЗ 2','processing_3':'ВЗ 3','processing_4':'ВЗ 4','solar':'СЭС','helipad':'ВП','central':'Резервуар','development':'Комплекс','military':'Завод'})[key];marker.title=name;
  marker.append(img,label);markers.append(marker);
  const card=document.createElement('button');card.type='button';card.className='location-card';card.dataset.location=key;
  const text=document.createElement('span');const strong=document.createElement('strong');strong.textContent=name;
  const empty=document.createElement('small');empty.textContent='Игроки не назначены';text.append(strong,empty);
  card.append(img.cloneNode(),text);locationGrid.append(card);
 });

 [['north',51,35],['east',64,48],['south',51,61],['west',38,48]].forEach(([key,x,y])=>{const button=document.createElement('button');button.type='button';button.className='collector-zone';button.dataset.collector=key;button.style.left=x+'%';button.style.top=y+'%';button.setAttribute('aria-label','Водосборники');button.textContent='•••';markers.append(button);});
 const sheet=document.querySelector('#detail-sheet');const sheetBody=document.querySelector('#sheet-body');
 const sheetTitle=document.querySelector('#sheet-title');let sheetTrigger=null;let sheetKey=null;
 const drafts=new Map();
 function rememberDraft(){ if(!sheetKey)return;drafts.set(sheetKey,{markup:sheetBody.innerHTML,values:[...sheetBody.querySelectorAll('input,textarea,select')].map(field=>field.value)}); }
 function openSheet(title,markup,key,trigger){
  rememberDraft();sheetKey=key;sheetTitle.textContent=title;sheetBody.innerHTML=markup;
  const draft=drafts.get(key);if(draft){sheetBody.innerHTML=draft.markup;sheetBody.querySelectorAll('input,textarea,select').forEach((field,index)=>{if(draft.values[index]!==undefined)field.value=draft.values[index];});}
  sheet.hidden=false;sheetBody.scrollTop=0;sheetTrigger=trigger||document.activeElement;
  document.querySelector('#close-sheet').focus({preventScroll:true});fitSheet();
 }
 function closeSheet(restore=true){rememberDraft();sheet.hidden=true;sheetKey=null;if(restore&&sheetTrigger?.getClientRects().length)sheetTrigger.focus({preventScroll:true});}
 const scopeFields = `<div class="form-grid"><label class="field-label">День<input type="date"></label><label class="field-label">Союз<select disabled><option>Не добавлен</option></select></label><label class="field-label">Точка (необязательно)<select disabled><option>Без привязки к точке</option></select></label></div>`;
 function openForm(kind,trigger){
  if(kind==='expenses')openSheet('Добавить траты союза',scopeFields+`<label class="field-label">Якоря<textarea rows="4" spellcheck="false" aria-describedby="expense-help"></textarea></label><p id="expense-help" class="section-caption">Одна трата на строку: количество или никнейм и количество в конце. Enter создаёт новую строку.</p><div class="mini-metrics"><div><span>Добавится всего</span><strong>—</strong></div><div><span>По игрокам</span><strong>—</strong></div><div><span>Без игроков</span><strong>—</strong></div></div>`,kind,trigger);
  else openSheet('Добавить игрока',scopeFields+`<p class="section-caption">Расшифровка общего числа трат. Сумма якорей союза не меняется.</p><div id="player-lines"><div class="player-line"><button class="button secondary-button" type="button" data-add-player aria-label="Добавить строку игрока">+</button><label>Игрок<input autocomplete="off"></label><label>Якоря<input inputmode="numeric" type="text"></label></div></div>`,kind,trigger);
 }
 function openPoint(trigger){
  const point=document.querySelector('#point-choice').value;
  const title=(['XS-14','M-02'].includes(point)?'Логово ':'Верстак ')+point;
  openSheet(title,`<div class="mini-metrics"><div><span>Владелец</span><strong>—</strong></div><div><span>Очки</span><strong>—</strong></div><div><span>Якоря</span><strong>—</strong></div></div><label class="field-label">Союз-владелец<select disabled><option>Данные не внесены</option></select></label><div class="button-group"><button class="button secondary-button" data-sheet="expenses">Добавить траты союза</button><button class="button secondary-button" data-sheet="players">Добавить игрока</button></div><p class="section-caption">Пока показано оформление точки. Её владельцы, очки и история не загружены.</p>`,point,trigger);
 }
 document.addEventListener('click',event=>{
  const collector=event.target.closest('[data-collector]');if(collector)openSheet('Водосборники','<p>Группа водосборников рядом с центральным резервуаром.</p><p class="section-caption">Пока показано расположение на карте.</p>','collector-'+collector.dataset.collector,collector);
  const location=event.target.closest('[data-location]');
  if(location){const info=locations.find(item=>item[0]===location.dataset.location);openSheet(info[1],`<h3>Назначенные игроки</h3><div class="quiet-empty"><p>На эту локацию пока никто не назначен.</p></div><button class="button secondary-button" disabled>Добавить игрока</button><label class="field-label">Комментарий к локации<textarea rows="3"></textarea></label>`,info[0],location);}
  const action=event.target.closest('[data-sheet]');if(action)openForm(action.dataset.sheet,action);
  const expand=event.target.closest('[data-expand]');if(expand){document.querySelector('.map-expanded')?.classList.remove('map-expanded');const canvas=document.getElementById(expand.dataset.expand);canvas.classList.add('map-expanded');canvas.querySelector('[data-collapse]').focus();}
  const collapse=event.target.closest('[data-collapse]');if(collapse){const canvas=collapse.closest('.map-expanded');canvas?.classList.remove('map-expanded');document.querySelector('[data-expand="'+canvas?.id+'"]')?.focus();}
  const plus=event.target.closest('[data-add-player]');if(plus){const row=plus.closest('.player-line');const next=row.cloneNode(true);row.querySelector('button').hidden=true;next.querySelectorAll('input').forEach(field=>field.value='');row.after(next);next.querySelector('input').focus();}
 });
 document.querySelectorAll('[data-roster]').forEach(button=>button.addEventListener('click',()=>{
  document.querySelectorAll('[data-roster]').forEach(tab=>tab.setAttribute('aria-pressed',String(tab===button)));
  document.querySelector('[data-roster-title]').textContent=button.dataset.roster==='main'?'Основной состав':'Резервный состав';
 }));
 const tabs=[...document.querySelectorAll('[data-map-tab]')];
 function selectTab(tab){tabs.forEach(button=>{const active=button===tab;button.setAttribute('aria-selected',String(active));button.tabIndex=active?0:-1;document.getElementById('map-panel-'+button.dataset.mapTab).hidden=!active;});closeSheet(false);}
 tabs.forEach((tab,index)=>{tab.tabIndex=index? -1:0;tab.addEventListener('click',()=>selectTab(tab));tab.addEventListener('keydown',event=>{let next;if(event.key==='ArrowRight')next=(index+1)%tabs.length;if(event.key==='ArrowLeft')next=(index+tabs.length-1)%tabs.length;if(event.key==='Home')next=0;if(event.key==='End')next=tabs.length-1;if(next!==undefined){event.preventDefault();selectTab(tabs[next]);tabs[next].focus();}});});
 document.querySelector('#close-sheet').addEventListener('click',()=>closeSheet());
 document.querySelector('#point-choice').addEventListener('change',event=>{document.querySelector('#open-point').disabled=!event.target.value;});
 document.querySelector('#open-point').addEventListener('click',event=>openPoint(event.currentTarget));
 document.querySelector('#map-resource').addEventListener('change',event=>{
  const isOil=event.target.value==='oil';document.querySelector('#oil-canvas').hidden=!isOil;document.querySelector('#missing-map').hidden=isOil;
  document.querySelector('#point-choice').disabled=!isOil;document.querySelector('#point-choice').value='';document.querySelector('#open-point').disabled=true;closeSheet(false);
 });
 function fitSheet(){const viewport=window.visualViewport;if(!viewport)return;sheet.style.setProperty('--keyboard-bottom',Math.max(0,innerHeight-viewport.height-viewport.offsetTop)+'px');sheet.style.setProperty('--sheet-available',Math.max(120,viewport.height-12)+'px');}
 window.visualViewport?.addEventListener('resize',fitSheet);window.visualViewport?.addEventListener('scroll',fitSheet);
 sheetBody.addEventListener('focusin',()=>{setTimeout(()=>document.activeElement?.scrollIntoView({block:'nearest'}),120);});
 let sheetGesture=null;
 sheet.addEventListener('touchstart',event=>{sheetGesture=null;if(event.touches.length!==1||event.target.closest('input,textarea,select,button'))return;const handle=event.target.closest('[data-sheet-handle],.sheet-heading');if(!handle&&sheetBody.scrollTop>0)return;sheetGesture={x:event.touches[0].clientX,y:event.touches[0].clientY};},{passive:true});
 sheet.addEventListener('touchend',event=>{if(!sheetGesture)return;const dx=event.changedTouches[0].clientX-sheetGesture.x,dy=event.changedTouches[0].clientY-sheetGesture.y;if(dy>64&&dy>Math.abs(dx)*1.4)closeSheet();sheetGesture=null;},{passive:true});
 sheet.addEventListener('touchmove',event=>{if(event.touches.length!==1)sheetGesture=null;},{passive:true});
 sheet.addEventListener('touchcancel',()=>sheetGesture=null,{passive:true});
 // Панель точки не модальная: карта остаётся доступна при открытой плашке.
 const canvas=document.querySelector('#oil-canvas'),transform=document.querySelector('#oil-transform');
 const pointers=new Map();let scale=1,offset={x:0,y:0},gesture=null;
 function renderMap(){const limitX=canvas.clientWidth*(scale-1)/2,limitY=canvas.clientHeight*(scale-1)/2;offset.x=Math.max(-limitX,Math.min(limitX,offset.x));offset.y=Math.max(-limitY,Math.min(limitY,offset.y));transform.style.transform=`translate(${offset.x}px,${offset.y}px) scale(${scale})`;}
 function zoom(next,center={x:canvas.clientWidth/2,y:canvas.clientHeight/2}){const previous=scale;scale=Math.max(1,Math.min(6,next));offset.x=(offset.x+canvas.clientWidth/2-center.x)*scale/previous+center.x-canvas.clientWidth/2;offset.y=(offset.y+canvas.clientHeight/2-center.y)*scale/previous+center.y-canvas.clientHeight/2;renderMap();}
 function startGesture(){const points=[...pointers.values()];gesture=points.length>=2?{distance:Math.hypot(points[1].x-points[0].x,points[1].y-points[0].y),scale,center:{x:(points[0].x+points[1].x)/2,y:(points[0].y+points[1].y)/2},offset:{...offset}}:points.length?{point:points[0],offset:{...offset}}:null;}
 canvas.addEventListener('pointerdown',event=>{if(event.target.closest('button'))return;pointers.set(event.pointerId,{x:event.clientX,y:event.clientY});canvas.setPointerCapture(event.pointerId);startGesture();});
 canvas.addEventListener('pointermove',event=>{if(!pointers.has(event.pointerId)||!gesture)return;pointers.set(event.pointerId,{x:event.clientX,y:event.clientY});const points=[...pointers.values()];if(points.length>=2&&gesture.distance){const rect=canvas.getBoundingClientRect();scale=gesture.scale;offset={...gesture.offset};zoom(gesture.scale*Math.hypot(points[1].x-points[0].x,points[1].y-points[0].y)/Math.max(1,gesture.distance),{x:gesture.center.x-rect.left,y:gesture.center.y-rect.top});offset.x+=(points[0].x+points[1].x)/2-gesture.center.x;offset.y+=(points[0].y+points[1].y)/2-gesture.center.y;renderMap();}else if(gesture.point){offset.x=gesture.offset.x+event.clientX-gesture.point.x;offset.y=gesture.offset.y+event.clientY-gesture.point.y;renderMap();}});
 for(const type of ['pointerup','pointercancel','lostpointercapture'])canvas.addEventListener(type,event=>{pointers.delete(event.pointerId);startGesture();});
 canvas.addEventListener('wheel',event=>{if(event.target.closest('button'))return;event.preventDefault();const rect=canvas.getBoundingClientRect();zoom(scale*Math.exp(-event.deltaY*.0015),{x:event.clientX-rect.left,y:event.clientY-rect.top});},{passive:false});
 document.querySelectorAll('[data-zoom]').forEach(button=>button.addEventListener('click',()=>{if(button.dataset.zoom==='fit'){scale=1;offset={x:0,y:0};renderMap();}else zoom(scale*(button.dataset.zoom==='in'?1.4:1/1.4));}));
 new ResizeObserver(renderMap).observe(canvas);
 const note=document.querySelector('#help-note');
 document.querySelectorAll('[data-help]').forEach(button=>{const show=()=>{note.textContent=button.dataset.help;note.hidden=false;};button.addEventListener('click',show);button.addEventListener('mouseenter',()=>{if(matchMedia('(hover:hover)').matches)show();});button.addEventListener('mouseleave',()=>note.hidden=true);button.addEventListener('focus',show);button.addEventListener('blur',()=>note.hidden=true);});
 document.addEventListener('click',event=>{if(!event.target.closest('[data-help],#help-note'))note.hidden=true;});
 document.addEventListener('keydown',event=>{if(event.key==='Escape'){if(!sheet.hidden){event.preventDefault();closeSheet();}else{document.querySelector('.map-expanded')?.classList.remove('map-expanded');}note.hidden=true;}});
 window.addEventListener('harvesthub:pagechange',()=>{closeSheet(false);document.querySelector('.map-expanded')?.classList.remove('map-expanded');note.hidden=true;});
})();
