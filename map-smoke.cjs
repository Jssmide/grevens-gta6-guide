const { chromium, devices } = require('playwright');
const fs = require('fs');
(async()=>{
  let browser, report={time:new Date().toISOString(),tests:[],ok:false};
  const test=(name,ok,detail='')=>{report.tests.push({name,ok,detail});if(!ok)console.error('FAILED '+name+' '+detail);else console.log('PASS '+name);};
  try {
    browser=await chromium.launch({headless:true,args:['--no-sandbox']});
    const context=await browser.newContext({...devices['iPhone 13'],locale:'sv-SE',viewport:{width:390,height:844}});
    const page=await context.newPage();
    const errors=[];page.on('pageerror',e=>errors.push(String(e)));
    const resp=await page.goto('http://127.0.0.1:8000/map-pro.html',{waitUntil:'domcontentloaded',timeout:30000});
    test('HTML server',resp?.status()===200,String(resp?.status()));
    await page.waitForTimeout(2500);
    test('JavaScript without exceptions',errors.length===0,errors.join('; '));
    test('all 7 map layers present',await page.locator('.tileLayer').count()===7);
    const baseLoaded=await page.locator('#underlay0 img').count();
    test('local low resolution fallback',baseLoaded>=6,String(baseLoaded));
    const tileResp=await page.request.get('http://127.0.0.1:8000/map-tiles/6/day/6/6,128,128.jpg');
    test('local highest resolution tile available',tileResp.status()===200,String(tileResp.status()));
    await page.evaluate(()=>zoomBy(22/scale,document.getElementById('viewport').clientWidth/2,document.getElementById('viewport').clientHeight/2));
    await page.waitForTimeout(3000);
    const high=await page.evaluate(()=>({zoom:zoomLevel(),tileCount:document.querySelectorAll('#level6 img').length,loaded:[...document.querySelectorAll('#level6 img')].filter(i=>i.naturalWidth>0).length,centerScale:scale,errors:document.querySelector('#quality').textContent}));
    test('high zoom reaches level 6',high.zoom===6,JSON.stringify(high));
    test('level 6 tiles load in Chromium',high.loaded>0,JSON.stringify(high));
    await page.screenshot({path:'map-smoke-mobile.png',fullPage:true});
    await page.locator('#toggle').click();
    test('filter panel opens',await page.locator('#options').evaluate(el=>el.classList.contains('open')));
    await page.locator('#hideAll').click();
    test('hide all map markers',await page.evaluate(()=>on.size===0));
    await page.locator('#showAll').click();
    test('show all map markers',await page.evaluate(()=>on.size===groups.length));
    report.details=high;report.ok=report.tests.every(t=>t.ok);
    await context.close();
  } catch(err) {
    report.error=String(err.stack||err);
    console.error(report.error);
  } finally {
    if(browser)await browser.close();
    fs.writeFileSync('map-smoke-result.json',JSON.stringify(report,null,2));
    if(!report.ok)process.exitCode=1;
  }
})();