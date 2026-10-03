// Page contracts from HarvestHub-test; the responsive frame owns navigation.
(() => {
  const routes = {
    home:'home.html', calculators:'calculator.html', settings:'settings.html',
    profile:'profile.html', 'advanced-access':'advanced-access.html',
    ipk:'calculator/ipk.html', 'turbo-vs':'calculator/turbo-vs.html',
    'season-resources':'calculator/season-resources.html', territory:'calculator/oil-dna-copper.html',
    troops:'calculator/troop-training.html', alliance:'alliance/members.html',
    management:'alliance/management.html', 'player-profile':'alliance/player-profile.html',
    roster:'alliance/roster.html', power:'alliance/power.html', 'alliance-vs':'alliance/vs.html',
    'vs-statistics':'alliance/vs-statistics.html', 'reservoir-activity':'alliance/reservoir-activity.html',
    reservoir:'alliance/reservoir-layout.html'
  };
  const reverse=Object.fromEntries(Object.entries(routes).map(([route,path])=>[path,route]));
  const sourceLoad=window.loadPage;
  let loadedRoute='', pending=0;
  async function show(route, options={}) {
    if(!routes[route]) return false;
    const ticket=++pending;
    const ok=await sourceLoad(routes[route],options);
    if(!ok || ticket!==pending) return false;
    loadedRoute=route;
    window.dispatchEvent(new Event('harvesthub:pagechange'));
    if(routes[route].startsWith('calculator/')&&route!=='ipk'&&window.getActiveProfile?.()?.type!=='account') {
      window.harvestHubStorage?.restorePageFormState(routes[route]);
    }
    document.body.classList.remove('resource-screen');
    document.body.classList.toggle('reservoir-screen',route==='reservoir');
    document.querySelectorAll('.pages > .page').forEach(page=>page.hidden=page.id!=='functional');
    const current=route==='alliance'||routes[route].startsWith('alliance/')?'alliance':routes[route].startsWith('calculator/')?'calculators':route;
    document.querySelectorAll('.main-nav a').forEach(link=>{
      if(link.hash==='#'+current)link.setAttribute('aria-current','page');else link.removeAttribute('aria-current');
    });
    const heading=document.querySelector('#page-content h1,#page-content h2');
    document.title=(heading?.textContent||'HarvestHub')+' — HarvestHub';
    if(location.hash!=='#'+route) history.pushState(null,'','#'+route);
    document.dispatchEvent(new CustomEvent('harvesthub:feature-ready',{detail:{route}}));
    requestAnimationFrame(()=>window.scrollTo({top:0,behavior:options.behavior||'auto'}));
    return true;
  }
  window.loadPage=(page,options={})=>reverse[page]?show(reverse[page],options):sourceLoad(page,options);
  window.harvestHubFeatures={has:route=>Boolean(routes[route]),show,routes,getCurrent:()=>loadedRoute};
  window.harvestHubTheme={syncControls(){
    document.querySelectorAll('[data-theme-toggle]').forEach(control=>control.checked=document.documentElement.dataset.theme==='light');
  }};
  document.addEventListener('DOMContentLoaded',()=>{
    const modal=document.querySelector('#accountModal');if(!modal)return;
    let trigger=null;
    new MutationObserver(()=>{
      const open=modal.classList.contains('is-open');modal.setAttribute('aria-hidden',String(!open));
      if(open){trigger=document.activeElement;modal.querySelector('[data-account-close] button,button[data-account-close]')?.focus({preventScroll:true});}
      else if(trigger?.isConnected){trigger.focus({preventScroll:true});trigger=null;}
    }).observe(modal,{attributes:true,attributeFilter:['class']});
    modal.addEventListener('keydown',event=>{
      if(!modal.classList.contains('is-open'))return;
      if(event.key==='Escape'){event.preventDefault();window.harvestHubAccountUI.close();return;}
      if(event.key!=='Tab')return;
      const fields=[...modal.querySelectorAll('button,input,select,textarea,a[href]')].filter(e=>!e.disabled&&e.getClientRects().length);
      const first=fields[0],last=fields.at(-1);
      if(event.shiftKey&&document.activeElement===first){event.preventDefault();last?.focus();}
      else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first?.focus();}
    });
  });
  document.addEventListener('harvesthub:page-loaded',()=>{
    document.querySelectorAll('#page-content [data-horizontal-scroll]').forEach(table=>table.dataset.noSwipe='');
    document.querySelectorAll('#page-content [data-page-path]').forEach(link=>{
      const route=reverse[link.dataset.pagePath];
      if(route && link.tagName==='A')link.href='#'+route;
    });
    // Keep the new common event map reachable from the functional alliance hub.
    const hub=document.querySelector('#page-content .alliance-dashboard-grid');
    if(hub&&!hub.querySelector('[href="#resource-map"]')){
      const card=document.createElement('section');card.className='card alliance-dashboard-card';
      card.innerHTML='<div class="card-header"><div><h3>Карта нефть/ДНК/медь</h3><p>Точки, владельцы и массовое назначение на карте.</p></div></div><a class="button" href="#resource-map">Открыть</a>';
      hub.append(card);
    }
  });
})();
