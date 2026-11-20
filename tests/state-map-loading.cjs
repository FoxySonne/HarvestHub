const {chromium}=require('playwright-core');
const fs=require('node:fs'),http=require('node:http'),path=require('node:path'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..');
const server=http.createServer((req,res)=>{const p=path.resolve(root,'.'+new URL(req.url,'http://localhost').pathname.replace(/^\/$/,'/index.html'));if(!p.startsWith(root+path.sep))return res.writeHead(403).end();fs.readFile(p,(err,data)=>{if(err)return res.writeHead(404).end();res.setHeader('Content-Type',p.endsWith('.js')?'text/javascript':p.endsWith('.json')?'application/json':p.endsWith('.css')?'text/css':'text/html');res.end(data);});});
(async()=>{
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const browser=await chromium.launch({executablePath:process.env.CHROME_PATH||'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
 const base=process.env.HH_LIVE_URL||'http://127.0.0.1:'+server.address().port;
 try{
  const page=await browser.newPage({viewport:{width:1920,height:950}});
  if(!process.env.HH_LIVE_URL)await page.route(/https?:\/\/(?!127\.0\.0\.1)/,r=>r.abort());
  await page.route('**/pages/state-map.html*',async route=>{
   await page.evaluate(()=>{
    window.getActiveProfile=()=>({type:'account',id:'account:loading-test',supabaseUserId:'loading-test'});
    window.harvestHubSupabase={...window.harvestHubSupabase,from:()=>({select:()=>({eq:()=>({maybeSingle:()=>new Promise(()=>{})})})}),rpc:()=>new Promise(()=>{})};
   });
   await route.continue();
  });
  await page.goto(base+'/?loading-check=20261119#state-map');
  await page.waitForSelector('#state-map-workspace',{state:'attached'});
  assert.equal(await page.locator('#state-map-workspace').isVisible(),true);
  await page.waitForFunction(()=>document.querySelectorAll('#sm-cells polygon').length===313);
  await page.waitForFunction(()=>window.harvestHubFeatures?.getCurrent()==='state-map');
  await page.waitForSelector('#sm-retry-cloud',{state:'visible',timeout:14000});
  assert.equal(await page.locator('#sm-save').isDisabled(),true);
  assert.equal(await page.locator('#sm-title').isDisabled(),true);
  await page.evaluate(()=>{
   window.harvestHubSupabase.from=()=>({select:()=>({eq:()=>({maybeSingle:async()=>({data:{revision:3,payload:{version:2,map:'large',title:'Карта аккаунта после повтора',alliances:[],owners:{},baseOwners:{},planning:false,start:'2026-11-19',actions:[]}},error:null})})})});
   window.harvestHubSupabase.rpc=async()=>({data:[],error:null});
  });
  await page.locator('#sm-retry-cloud').click();
  await page.waitForFunction(()=>!document.querySelector('#sm-save').disabled);
  assert.equal(await page.locator('#sm-title').inputValue(),'Карта аккаунта после повтора');
  await page.locator('#sm-controls [data-panel=settings]').click();await page.locator('#sm-title').fill('Несохранённая карта');await page.locator('#sm-title').dispatchEvent('change');await page.locator('#sm-panel-close').click();
  await page.evaluate(()=>{window.loadPage('calculator.html');});await page.locator('#sm-confirm[open]').waitFor();await page.locator('#sm-confirm-cancel').click();assert.equal(await page.locator('#state-map-workspace').isVisible(),true);assert.equal(await page.locator('#sm-title').inputValue(),'Несохранённая карта');
  await page.evaluate(()=>{window.loadPage('calculator.html');});await page.locator('#sm-confirm[open]').waitFor();await page.locator('#sm-confirm-accept').click();
  await page.waitForFunction(()=>window.harvestHubFeatures?.getCurrent()==='calculators');
  assert.equal(await page.locator('#page-content .calculator-directory').isVisible(),true);
  await page.close();
  console.log('PASS: hanging account request, visible map, timeout, safe disabled writes, successful retry, usable navigation');
  const guest=await browser.newPage({viewport:{width:390,height:850}});
  if(!process.env.HH_LIVE_URL)await guest.route(/https?:\/\/(?!127\.0\.0\.1)/,r=>r.abort());
  let fail=true;
  await guest.route('**/assets/state-map/large-map.json*',r=>{if(fail){fail=false;return r.fulfill({status:503,body:'Unavailable'});}return r.continue();});
  await guest.goto(base+'/?loading-check=20261119#state-map');
  const retry=guest.getByRole('button',{name:'Повторить загрузку карты',exact:true});
  await retry.waitFor();assert.equal(await guest.locator('#state-map-workspace').isVisible(),true);
  await retry.click();await guest.waitForFunction(()=>document.querySelectorAll('#sm-cells polygon').length===313);
  assert.equal(await guest.locator('#sm-viewport').isVisible(),true);
  await guest.close();console.log('PASS: failed map asset has visible error and working retry on mobile');
 }finally{await browser.close();server.close();}
})().catch(e=>{console.error(e);process.exitCode=1;server.close();});
