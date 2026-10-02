// A fixed game scene scales as a whole: objects never rearrange at breakpoints.
document.addEventListener('harvesthub:feature-ready',event=>{
 if(event.detail.route!=='reservoir')return;
 const viewport=document.getElementById('reservoirMapViewport'),map=document.getElementById('reservoirMap');
 if(!viewport||!map||map.dataset.viewportBound)return;
 map.dataset.viewportBound='true';viewport.classList.add('interactive-reservoir');viewport.dataset.noSwipe='';
 const transform=document.createElement('div');transform.className='reservoir-scene-transform';
 map.before(transform);transform.append(map);
 const controls=document.createElement('div');controls.className='map-controls';
 controls.innerHTML='<button type="button" data-zoom="in" aria-label="Приблизить карту">+</button><button type="button" data-zoom="out" aria-label="Отдалить карту">−</button><button type="button" data-zoom="fit">Вся карта</button>';
 viewport.append(controls);
 const fit=()=>map.style.setProperty('--scene-fit',Math.min(viewport.clientWidth/1200,viewport.clientHeight/675));
 const observer=new ResizeObserver(()=>{if(viewport.isConnected)fit();else observer.disconnect();});observer.observe(viewport);fit();
 window.HarvestMaps.attach(viewport,transform,target=>{
   const point=target.closest('[data-location-key],[data-collector]');if(point)point.click();
 });
 const page=map.closest('.reservoir-layout-page');
 const mapCard=page.querySelector('.reservoir-map-card'), editor=page.querySelector('#reservoirLayoutEditor');
 const pool=page.querySelector('.reservoir-player-pool-card'),placement=page.querySelector('.reservoir-placement-card'),published=page.querySelector('#reservoirPublishedView');
 const tabs=document.createElement('nav');tabs.className='reservoir-workspace-tabs';tabs.setAttribute('aria-label','Разделы расстановки');
 const sections={map:[mapCard],players:[pool],placements:[placement,published]};
 if(editor?.hidden)delete sections.players;
 for(const [key,label] of [['map','Карта'],['players','Участники'],['placements','Расстановка']]){
   if(!sections[key])continue;
   const button=document.createElement('button');button.type='button';button.textContent=label;button.dataset.reservoirTab=key;
   button.setAttribute('aria-pressed',String(key==='map'));
   button.addEventListener('click',()=>{
     page.dataset.workspaceTab=key;
     tabs.querySelectorAll('button').forEach(item=>item.setAttribute('aria-pressed',String(item===button)));
   });tabs.append(button);
 }
 page.dataset.workspaceTab='map';mapCard.before(tabs);
});
