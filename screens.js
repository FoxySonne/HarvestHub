// Интерактивное оформление экранов. Игровые данные, расчёты и сервер не подключены.
(() => {
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
 document.addEventListener('click',event=>{

  const action=event.target.closest('[data-sheet]');if(action)openForm(action.dataset.sheet,action);
  const expand=event.target.closest('[data-expand]');if(expand){document.querySelector('.map-expanded')?.classList.remove('map-expanded');const canvas=document.getElementById(expand.dataset.expand);canvas.classList.add('map-expanded');canvas.querySelector('[data-collapse]').focus();}
  const collapse=event.target.closest('[data-collapse]');if(collapse){const canvas=collapse.closest('.map-expanded');canvas?.classList.remove('map-expanded');document.querySelector('[data-expand="'+canvas?.id+'"]')?.focus();}
  const plus=event.target.closest('[data-add-player]');if(plus?.closest('.player-line')){const row=plus.closest('.player-line');const next=row.cloneNode(true);row.querySelector('button').hidden=true;next.querySelectorAll('input').forEach(field=>field.value='');row.after(next);next.querySelector('input').focus();}
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
