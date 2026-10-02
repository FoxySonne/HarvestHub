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

 [['north',51,35],['east',64,48],['south',51,61],['west',38,48]].forEach(([key,x,y])=>{const button=document.createElement('button');button.type='button';button.className='collector-zone';button.dataset.collector=key;button.style.left=x+'%';button.style.top=y+'%';button.setAttribute('aria-label','Водосборники');for(let i=0;i<3;i++){const image=document.createElement('img');image.src='assets/water-collector.webp';image.alt='';image.draggable=false;button.append(image);}markers.append(button);});
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
 function openForm(kind,trigger){window.HarvestMaps.openAnchor(kind,trigger);}
 function openPoint(trigger){window.HarvestMaps.openPoint(document.querySelector("#point-choice").value,trigger);}
 function openLocation(target){
  const collector=target.closest('[data-collector]');if(collector)openSheet('Водосборники','<p>Группа водосборников рядом с центральным резервуаром.</p><label class="field-label">Комментарий<textarea rows="3"></textarea></label>','collector-'+collector.dataset.collector,collector);
  const location=target.closest('[data-location]');
  if(location){const info=locations.find(item=>item[0]===location.dataset.location);openSheet(info[1],`<h3>Назначенные игроки</h3><div class="quiet-empty"><p>На эту локацию пока никто не назначен.</p></div><button class="button secondary-button" disabled>Добавить игрока</button><label class="field-label">Комментарий к локации<textarea rows="3"></textarea></label>`,info[0],location);}
 }
 document.addEventListener('harvesthub:location',event=>openLocation(event.detail.button));
 document.addEventListener('click',event=>{
  openLocation(event.target);
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
 document.querySelector('#map-resource').addEventListener('change',()=>{closeSheet(false);});
 function fitSheet(){const viewport=window.visualViewport;if(!viewport)return;sheet.style.setProperty('--keyboard-bottom',Math.max(0,innerHeight-viewport.height-viewport.offsetTop)+'px');sheet.style.setProperty('--sheet-available',Math.max(120,viewport.height-12)+'px');}
 window.visualViewport?.addEventListener('resize',fitSheet);window.visualViewport?.addEventListener('scroll',fitSheet);
 sheetBody.addEventListener('focusin',()=>{setTimeout(()=>document.activeElement?.scrollIntoView({block:'nearest'}),120);});
 let sheetGesture=null;
 sheet.addEventListener('touchstart',event=>{sheetGesture=null;if(event.touches.length!==1||event.target.closest('input,textarea,select,button'))return;const handle=event.target.closest('[data-sheet-handle],.sheet-heading');if(!handle&&sheetBody.scrollTop>0)return;sheetGesture={x:event.touches[0].clientX,y:event.touches[0].clientY};},{passive:true});
 sheet.addEventListener('touchend',event=>{if(!sheetGesture)return;const dx=event.changedTouches[0].clientX-sheetGesture.x,dy=event.changedTouches[0].clientY-sheetGesture.y;if(dy>64&&dy>Math.abs(dx)*1.4)closeSheet();sheetGesture=null;},{passive:true});
 sheet.addEventListener('touchmove',event=>{if(event.touches.length!==1)sheetGesture=null;},{passive:true});
 sheet.addEventListener('touchcancel',()=>sheetGesture=null,{passive:true});
 // Панель точки не модальная: карта остаётся доступна при открытой плашке.
 window.HarvestMaps.connect({openSheet,closeSheet,forgetDraft:key=>drafts.delete(key)});
 const note=document.querySelector('#help-note');
 document.querySelectorAll('[data-help]').forEach(button=>{const show=()=>{note.textContent=button.dataset.help;note.hidden=false;};button.addEventListener('click',show);button.addEventListener('mouseenter',()=>{if(matchMedia('(hover:hover)').matches)show();});button.addEventListener('mouseleave',()=>note.hidden=true);button.addEventListener('focus',show);button.addEventListener('blur',()=>note.hidden=true);});
 document.addEventListener('click',event=>{if(!event.target.closest('[data-help],#help-note'))note.hidden=true;});
 document.addEventListener('keydown',event=>{if(event.key==='Escape'){if(!sheet.hidden){event.preventDefault();closeSheet();}else{document.querySelector('.map-expanded')?.classList.remove('map-expanded');}note.hidden=true;}});
 window.addEventListener('harvesthub:pagechange',()=>{closeSheet(false);document.querySelector('.map-expanded')?.classList.remove('map-expanded');note.hidden=true;});
})();
