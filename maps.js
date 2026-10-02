// Карты работают локально. Общее сохранение и права аккаунтов подключаются отдельно.
(() => {
  const data=window.HarvestMapData, ns='http://www.w3.org/2000/svg';
  const svg=document.querySelector('#resource-svg');
  const byId=new Map(data.nodes.map(node=>[node.id,node]));
  const storageKey='harvesthub_event_map_v1';
  let state={alliances:[],points:{},history:[],expenses:[],settings:{}}, bridge=null, selected='', painting=false, formKind='';
  const undo=[];
  let paintSnapshot=null, strokeSnapshot=null, brushPrevious=null;
  const strokePoints=new Set();
  try { const saved=JSON.parse(localStorage.getItem(storageKey));
    if(saved&&Array.isArray(saved.alliances)&&saved.points&&Array.isArray(saved.history))state={...state,...saved};
  } catch { /* Карта доступна и при запрете локального хранения. */ }
  state.alliances=state.alliances.filter(a=>a&&typeof a.id==='string'&&typeof a.name==='string'&&/^#[0-9a-f]{6}$/i.test(a.color));
  state.expenses=Array.isArray(state.expenses)?state.expenses:[];
  state.settings=state.settings&&typeof state.settings==='object'?state.settings:{};
  const shapes=new Map(), territories=new Map();
  function element(tag,attributes={}){const node=document.createElementNS(ns,tag);for(const [key,value] of Object.entries(attributes))node.setAttribute(key,value);return node;}
  function status(message){document.querySelector('#map-status').textContent=message;}
  function persist(){try{
    const saved=painting&&paintSnapshot?{...state,points:JSON.parse(paintSnapshot).points}:state;
    localStorage.setItem(storageKey,JSON.stringify(saved));status('Сохранено на этом устройстве');
  }catch{status('Изменения доступны до закрытия страницы: браузер запретил сохранение');}}
  function record(message){undo.push(JSON.stringify(state));if(undo.length>50)undo.shift();state.history.push({time:new Date().toISOString(),message});if(state.history.length>200)state.history.shift();document.querySelector('#map-undo').disabled=false;}
  function alliance(id){return state.alliances.find(item=>item.id===id);}
  function pointName(node){return (node.kind==='den'?'Логово ':node.kind==='bench'?'Верстак ':'База ')+node.label;}
  // Ячейка ближайшей точки: самостоятельная векторная область, не изображение.
  function territory(node){
    let polygon=[[0,0],[data.width,0],[data.width,data.height],[0,data.height]];
    for(const other of data.nodes){if(other===node)continue;const nx=other.x-node.x,ny=other.y-node.y;
      const limit=(other.x**2+other.y**2-node.x**2-node.y**2)/2, next=[];
      for(let i=0;i<polygon.length;i++){const a=polygon[i],b=polygon[(i+1)%polygon.length];const fa=a[0]*nx+a[1]*ny-limit,fb=b[0]*nx+b[1]*ny-limit;
        if(fa<=.001)next.push(a);if((fa<0)!==(fb<0)){const t=fa/(fa-fb);next.push([a[0]+t*(b[0]-a[0]),a[1]+t*(b[1]-a[1])]);}}
      polygon=next;if(!polygon.length)break;
    }return polygon.map(pair=>pair.join(',')).join(' ');
  }
  const regions=element('g',{'class':'map-regions'}), lines=element('g',{'class':'map-lines'}), points=element('g',{'class':'map-points'});
  svg.append(regions,lines,points);
  for(const node of data.nodes){const polygon=element('polygon',{points:territory(node),'data-point':node.id,'class':'map-region'});regions.append(polygon);territories.set(node.id,polygon);}
  // Ровно один прямой отрезок на связь. Контуры объектов закрывают концы линии.
  for(const [from,to] of data.edges){const a=byId.get(from),b=byId.get(to);lines.append(element('line',{x1:a.x,y1:a.y,x2:b.x,y2:b.y,'data-from':from,'data-to':to}));}
  const choice=document.querySelector('#point-choice');
  for(const node of data.nodes){
    const g=element('g',{transform:`translate(${node.x} ${node.y})`,'data-point':node.id,'class':'map-point',role:'button',tabindex:'0','aria-label':pointName(node)});
    const size=node.kind==='base'?30:26;
    const shape=node.kind==='bench'?element('rect',{x:-size,y:-size,width:size*2,height:size*2,rx:7}):element('circle',{r:size});
    shape.setAttribute('class','point-shape '+node.kind);g.append(shape);
    const title=element('title');title.textContent=pointName(node);g.append(title);
    if(node.kind==='base'){
      g.append(element('path',{d:'M-7 8V-12L10-8L-7-3','class':'base-symbol',fill:'none'}));
      const label=element('text',{y:21,'text-anchor':'middle','class':'base-label'});label.textContent=node.label;g.append(label);
    }else{
      const label=element('text',{y:4,'text-anchor':'middle','class':'point-label'});label.textContent=node.label;g.append(label);
      const score=element('text',{y:11,'text-anchor':'middle','class':'point-score'});g.append(score);
    }
    points.append(g);shapes.set(node.id,g);
    const option=document.createElement('option');option.value=node.id;option.textContent=pointName(node);choice.append(option);
  }
  function refresh(){
    for(const node of data.nodes){const saved=state.points[node.id]||{},owner=alliance(saved.owner),color=owner?.color;
      const g=shapes.get(node.id);g.style.setProperty('--owner-color',color||'var(--card)');g.classList.toggle('owned',Boolean(owner));g.classList.toggle('selected',node.id===selected);
      g.setAttribute('aria-label',pointName(node)+(owner?' — '+owner.name:''));
      const score=g.querySelector('.point-score');if(score){score.textContent=saved.score??'';g.classList.toggle('has-score',saved.score!==undefined&&saved.score!=='');}
      const region=territories.get(node.id);region.style.fill=color||'transparent';region.classList.toggle('owned',Boolean(owner));
    }
    const paint=document.querySelector('#paint-owner'),previous=paint.value;paint.replaceChildren(new Option('Без владельца',''));
    const list=document.querySelector('#map-alliance-list');list.replaceChildren();
    for(const item of state.alliances){paint.append(new Option(item.name,item.id));const row=document.createElement('div');row.className='alliance-row';
      const dot=document.createElement('span');dot.className='alliance-color';dot.style.background=item.color;
      const name=document.createElement('span');name.textContent=item.name;row.append(dot,name);list.append(row);}
    paint.value=previous;if(!paint.value)paint.value='';
    const totals=document.querySelector('#map-panel-totals .quiet-empty');totals.replaceChildren();
    for(const item of state.alliances){const entries=Object.entries(state.points).filter(([,point])=>point.owner===item.id);const row=document.createElement('p');
      const sum=entries.reduce((total,[,point])=>total+(Number(point.score)||0),0);row.textContent=item.name+' · '+entries.length+' территорий · '+sum+' очков';totals.append(row);}
    if(!state.alliances.length)totals.textContent='Союзы ещё не добавлены';
    const metrics=document.querySelectorAll('#map-panel-totals .mini-metrics strong');
    metrics[0].textContent=Object.values(state.points).reduce((sum,p)=>sum+(Number(p.score)||0),0);
    metrics[2].textContent=data.nodes.filter(n=>n.kind==='den'&&state.points[n.id]?.owner).length;
    metrics[3].textContent=data.nodes.filter(n=>n.kind==='bench'&&state.points[n.id]?.owner).length;
    const spent=state.expenses.reduce((sum,e)=>sum+e.total,0),named=state.expenses.reduce((sum,e)=>sum+e.players.reduce((s,p)=>s+p.amount,0),0);
    metrics[1].textContent=spent;
    const anchors=document.querySelectorAll('#map-panel-anchors .mini-metrics strong');anchors[0].textContent=spent;anchors[1].textContent=named;anchors[2].textContent=spent-named;
    const entries=document.querySelector('#map-panel-anchors .quiet-empty');entries.replaceChildren();
    for(const entry of state.expenses){const p=document.createElement('p');p.textContent=entry.date+' · '+(alliance(entry.owner)?.name||'Без союза')+' · '+entry.total+' якорей';entries.append(p);}
    if(!state.expenses.length)entries.textContent='Расходы пока не внесены';
    const history=document.querySelector('#map-panel-history .quiet-empty');history.replaceChildren();
    for(const entry of state.history.slice(-30).reverse()){const p=document.createElement('p');p.textContent=new Date(entry.time).toLocaleString('ru-RU')+' · '+entry.message;history.append(p);}
    if(!state.history.length)history.textContent='Изменений пока нет';
  }
  function openPoint(id,trigger){
    const node=byId.get(id);if(!node||!bridge)return;formKind='point';selected=id;choice.value=id;document.querySelector('#open-point').disabled=false;refresh();
    bridge.openSheet(pointName(node),'<div class="form-grid"><label class="field-label">Владелец<select id="point-owner"></select></label><label class="field-label">Очки<input id="point-score" type="number" min="0" inputmode="numeric"></label></div><label class="field-label">Комментарий<textarea id="point-note" rows="3" maxlength="2000"></textarea></label>', 'interactive-'+id,trigger);
    const saved=state.points[id]||{};const owner=document.querySelector('#point-owner');owner.replaceChildren(new Option('Без владельца',''));
    for(const item of state.alliances)owner.append(new Option(item.name,item.id));owner.value=saved.owner||'';
    document.querySelector('#point-score').value=saved.score??'';document.querySelector('#point-note').value=saved.note||'';
    const save=document.querySelector('.sheet-footer button');save.disabled=false;
    document.querySelector('.sheet-footer>span').textContent='Сохранение на этом устройстве';
  }
  function parseExpenses(value){
    const rows=value.split(/\r?\n/).map(s=>s.trim()).filter(Boolean),players=[];let total=0;
    for(const row of rows){const match=row.match(/^(?:(.*?)\s+)?(\d+)$/u);if(!match)throw Error('В каждой строке должно быть количество в конце');const amount=Number(match[2]);if(!Number.isSafeInteger(amount)||amount<1)throw Error('Количество должно быть целым положительным числом');total+=amount;if(match[1])players.push({name:match[1],amount});}
    if(!rows.length)throw Error('Введите траты');if(!Number.isSafeInteger(total))throw Error('Слишком большое количество');return{total,players};
  }
  function openAnchor(kind,trigger){
    formKind=kind;
    const scope='<div class="form-grid"><label class="field-label">День<input id="anchor-day" type="date"></label><label class="field-label">Союз<select id="anchor-owner"></select></label><label class="field-label">Точка<select id="anchor-point"></select></label></div>';
    const body=kind==='expenses'?'<label class="field-label">Якоря<textarea id="anchor-lines" rows="4"></textarea></label><div class="mini-metrics"><div><span>Добавится</span><strong id="anchor-total">0</strong></div></div>':'<label class="field-label">Запись трат<select id="anchor-entry"></select></label><div id="player-lines"><div class="player-line"><button class="button secondary-button" type="button" data-add-player aria-label="Добавить строку игрока">+</button><label>Игрок<input autocomplete="off"></label><label>Якоря<input inputmode="numeric" type="number" min="1"></label></div></div>';
    bridge.openSheet(kind==='expenses'?'Добавить траты союза':'Добавить игрока',scope+body+'<p id="anchor-error" class="section-caption" role="status"></p>','local-'+kind,trigger);
    const owner=document.querySelector('#anchor-owner');owner.replaceChildren(new Option('Выберите союз',''));for(const a of state.alliances)owner.append(new Option(a.name,a.id));
    const point=document.querySelector('#anchor-point');point.replaceChildren(new Option('Без привязки к точке',''));for(const node of data.nodes)point.append(new Option(pointName(node),node.id));
    document.querySelector('#anchor-day').value=new Date().toISOString().slice(0,10);
    if(kind==='players'){owner.disabled=true;point.disabled=true;document.querySelector('#anchor-day').disabled=true;
      const list=document.querySelector('#anchor-entry');list.replaceChildren(new Option('Выберите запись',''));state.expenses.forEach((e,index)=>list.append(new Option(e.date+' · '+(alliance(e.owner)?.name||'')+' · '+e.total,index)));
      list.addEventListener('change',()=>{const e=state.expenses[Number(list.value)];if(list.value!==''&&e){owner.value=e.owner;point.value=e.point||'';document.querySelector('#anchor-day').value=e.date;}});
    }else document.querySelector('#anchor-lines').addEventListener('input',event=>{try{const parsed=parseExpenses(event.target.value);document.querySelector('#anchor-total').textContent=parsed.total;document.querySelector('#anchor-error').textContent='';}catch(e){document.querySelector('#anchor-error').textContent=e.message;}});
    document.querySelector('.sheet-footer button').disabled=false;document.querySelector('.sheet-footer>span').textContent='Сохранение на этом устройстве';
  }
  function activate(id,trigger){if(painting){const old=state.points[id]||{},owner=document.querySelector('#paint-owner').value;if(old.owner===owner)return;
      if(!strokeSnapshot)strokeSnapshot=JSON.stringify(state);
      state.points[id]={...old,owner};strokePoints.add(id);refresh();
    }else openPoint(id,trigger);}
  document.querySelector('#add-map-alliance').addEventListener('click',()=>{
    const input=document.querySelector('#alliance-name'),name=input.value.trim();if(!name){input.focus();return;}
    if(state.alliances.some(item=>item.name===name)){status('Этот союз уже добавлен');return;}
    record('Добавлен союз '+name);state.alliances.push({id:'a'+Date.now().toString(36),name,color:document.querySelector('#alliance-color').value});input.value='';refresh();persist();
  });
  function finishStroke(){
    if(strokeSnapshot&&strokePoints.size){undo.push(strokeSnapshot);if(undo.length>50)undo.shift();document.querySelector('#map-undo').disabled=false;}
    strokeSnapshot=null;strokePoints.clear();brushPrevious=null;
  }
  function endPaint(commit){
    finishStroke();
    if(!commit&&paintSnapshot)state=JSON.parse(paintSnapshot);
    painting=false;
    if(commit){state.history.push({time:new Date().toISOString(),message:'Массовое назначение владельцев'});persist();}
    painting=false;paintSnapshot=null;undo.length=0;
    document.querySelector('#map-paint').setAttribute('aria-pressed','false');
    document.querySelector('#map-paint-done').hidden=true;document.querySelector('#map-paint-cancel').hidden=true;
    document.querySelector('#map-undo').disabled=true;svg.classList.remove('painting');refresh();
  }
  document.querySelector('#map-paint').addEventListener('click',event=>{
    if(painting){endPaint(false);return;}
    painting=true;paintSnapshot=JSON.stringify(state);undo.length=0;
    event.currentTarget.setAttribute('aria-pressed','true');svg.classList.add('painting');
    document.querySelector('#map-paint-done').hidden=false;document.querySelector('#map-paint-cancel').hidden=false;status('');
  });
  document.querySelector('#map-paint-done').addEventListener('click',()=>endPaint(true));
  document.querySelector('#map-paint-cancel').addEventListener('click',()=>endPaint(false));
  document.querySelector('#map-undo').addEventListener('click',()=>{finishStroke();const prior=undo.pop();if(!prior)return;state=JSON.parse(prior);document.querySelector('#map-undo').disabled=!undo.length;refresh();if(!painting)persist();});
  const settingFields=[...document.querySelectorAll('#map-panel-settings input')];
  ['name','start','end'].forEach((key,index)=>{
    const field=settingFields[index];field.disabled=false;field.value=state.settings[key]||'';
    field.addEventListener('change',()=>{state.settings[key]=field.value;persist();});
  });
  document.querySelector('.sheet-footer button').addEventListener('click',()=>{
    if(document.querySelector('#anchor-owner')){
      try{const owner=document.querySelector('#anchor-owner').value,date=document.querySelector('#anchor-day').value,point=document.querySelector('#anchor-point').value;
        if(!owner)throw Error('Выберите союз');if(!date)throw Error('Выберите день');
        if(formKind==='expenses'){const parsed=parseExpenses(document.querySelector('#anchor-lines').value);record('Добавлены траты союза '+alliance(owner).name);state.expenses.push({date,owner,point,...parsed});}
        else {const index=document.querySelector('#anchor-entry').value;if(index==='')throw Error('Выберите запись трат');const entry=state.expenses[Number(index)];if(!entry)throw Error('Запись не найдена');
          const players=[...document.querySelectorAll('.player-line')].map(row=>{const inputs=row.querySelectorAll('input');return{name:inputs[0].value.trim(),amount:Number(inputs[1].value)};});
          if(players.some(p=>!p.name||!Number.isSafeInteger(p.amount)||p.amount<1))throw Error('Заполните никнейм и количество в каждой строке');
          if(players.reduce((sum,p)=>sum+p.amount,0)+entry.players.reduce((sum,p)=>sum+p.amount,0)>entry.total)throw Error('Количество превышает нераспределённые траты этой записи');
          record('Расшифрованы траты игроками');entry.players.push(...players);
        }refresh();persist();bridge.closeSheet();bridge.forgetDraft('local-'+formKind);
      }catch(e){document.querySelector('#anchor-error').textContent=e.message;}return;
    }
    const owner=document.querySelector('#point-owner');if(!owner||!selected)return;const score=document.querySelector('#point-score');if(!score.reportValidity())return;
    record('Изменена точка '+pointName(byId.get(selected)));state.points[selected]={owner:owner.value,score:score.value===''?null:Number(score.value),note:document.querySelector('#point-note').value};refresh();persist();bridge.closeSheet();
  });
  svg.addEventListener('keydown',event=>{if(!['Enter',' '].includes(event.key))return;const point=event.target.closest('[data-point]');if(point){event.preventDefault();activate(point.dataset.point,point);if(painting)finishStroke();}});
  function brush(event){
    const matrix=svg.getScreenCTM();if(!matrix)return;
    const p=new DOMPoint(event.clientX,event.clientY).matrixTransform(matrix.inverse());
    const a=brushPrevious||p,dx=p.x-a.x,dy=p.y-a.y,length=dx*dx+dy*dy;
    for(const node of data.nodes){
      const t=length?Math.max(0,Math.min(1,((node.x-a.x)*dx+(node.y-a.y)*dy)/length)):0;
      if(Math.hypot(node.x-a.x-t*dx,node.y-a.y-t*dy)<=30)activate(node.id,shapes.get(node.id));
    }
    brushPrevious=p;
  }
  function makeMap(canvas,transform,onTap){
    const pointers=new Map();let scale=1,offset={x:0,y:0},gesture=null,origin=null,moved=false;
    function render(){const lx=canvas.clientWidth*(scale-1)/2,ly=canvas.clientHeight*(scale-1)/2;offset.x=Math.max(-lx,Math.min(lx,offset.x));offset.y=Math.max(-ly,Math.min(ly,offset.y));
      transform.style.transform=`translate(${offset.x}px,${offset.y}px) scale(${scale})`;canvas.dataset.scale=scale;canvas.classList.toggle('map-labels-visible',scale>=2);}
    function zoom(next,center={x:canvas.clientWidth/2,y:canvas.clientHeight/2}){const prior=scale;scale=Math.max(1,Math.min(8,next));offset.x=(offset.x+canvas.clientWidth/2-center.x)*scale/prior+center.x-canvas.clientWidth/2;offset.y=(offset.y+canvas.clientHeight/2-center.y)*scale/prior+center.y-canvas.clientHeight/2;render();}
    function start(){const p=[...pointers.values()];gesture=p.length>1?{distance:Math.hypot(p[1].x-p[0].x,p[1].y-p[0].y),scale,center:{x:(p[0].x+p[1].x)/2,y:(p[0].y+p[1].y)/2},offset:{...offset}}:p.length?{point:p[0],offset:{...offset}}:null;}
    canvas.addEventListener('pointerdown',event=>{if(event.target.closest('.map-controls,.expand-close'))return;
      if(!pointers.size){origin={x:event.clientX,y:event.clientY,target:event.target};moved=false;}else moved=true;
      pointers.set(event.pointerId,{x:event.clientX,y:event.clientY});canvas.setPointerCapture(event.pointerId);start();
      if(canvas.id==='oil-canvas'&&painting&&pointers.size===1)brush(event);
      else if(pointers.size>1){if(strokeSnapshot){state=JSON.parse(strokeSnapshot);strokeSnapshot=null;strokePoints.clear();brushPrevious=null;refresh();}}});
    canvas.addEventListener('pointermove',event=>{if(!pointers.has(event.pointerId)||!gesture)return;if(origin&&Math.hypot(event.clientX-origin.x,event.clientY-origin.y)>6)moved=true;
      pointers.set(event.pointerId,{x:event.clientX,y:event.clientY});const p=[...pointers.values()];
      if(canvas.id==='oil-canvas'&&painting&&p.length===1){brush(event);return;}
      if(p.length>1&&gesture.distance){const rect=canvas.getBoundingClientRect();scale=gesture.scale;offset={...gesture.offset};zoom(gesture.scale*Math.hypot(p[1].x-p[0].x,p[1].y-p[0].y)/gesture.distance,{x:gesture.center.x-rect.left,y:gesture.center.y-rect.top});offset.x+=(p[0].x+p[1].x)/2-gesture.center.x;offset.y+=(p[0].y+p[1].y)/2-gesture.center.y;render();}
      else if(gesture.point){offset.x=gesture.offset.x+event.clientX-gesture.point.x;offset.y=gesture.offset.y+event.clientY-gesture.point.y;render();}});
    canvas.addEventListener('pointerup',event=>{pointers.delete(event.pointerId);if(canvas.id==='oil-canvas'&&painting)finishStroke();else if(!pointers.size&&origin&&!moved)onTap(origin.target);start();});
    for(const type of ['pointercancel','lostpointercapture'])canvas.addEventListener(type,event=>{pointers.delete(event.pointerId);start();});
    // Синтетический click после перетаскивания не открывает локацию.
    canvas.addEventListener('click',event=>{if(event.target.closest('.map-controls,.expand-close,.alliance-fullscreen-close'))return;if(event.detail===0){if(canvas.id!=='reservoirMapViewport')onTap(event.target);return;}event.stopImmediatePropagation();},true);
    canvas.addEventListener('wheel',event=>{if(event.target.closest('button'))return;event.preventDefault();const r=canvas.getBoundingClientRect();zoom(scale*Math.exp(-event.deltaY*.0015),{x:event.clientX-r.left,y:event.clientY-r.top});},{passive:false});
    canvas.querySelectorAll('[data-zoom]').forEach(button=>button.addEventListener('click',()=>{if(button.dataset.zoom==='fit'){scale=1;offset={x:0,y:0};render();}else zoom(scale*(button.dataset.zoom==='in'?1.4:1/1.4));}));
    new ResizeObserver(render).observe(canvas);render();
  }
  makeMap(document.querySelector('#oil-canvas'),document.querySelector('#oil-transform'),target=>{const point=target.closest('[data-point]');if(point)activate(point.dataset.point,point);});

  // Клавиатурные нажатия SVG обрабатываются выше, без дублирования.
  window.HarvestMaps={openPoint,openAnchor,attach:makeMap,connect(api){bridge=api;}};
  new MutationObserver(()=>{
    if(!document.querySelector('#point-owner,#anchor-owner')){document.querySelector('.sheet-footer button').disabled=true;document.querySelector('.sheet-footer>span').textContent='Данные и сохранение пока не подключены';}
  }).observe(document.querySelector('#sheet-body'),{childList:true});
  refresh();
})();
