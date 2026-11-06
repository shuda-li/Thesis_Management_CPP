// Optional DOM interaction tests. Requires Node.js and jsdom 26.1.0.
// This is not a browser visual or layout test. It uses the real C++ API.
const {JSDOM, VirtualConsole} = require('jsdom');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const {spawn} = require('node:child_process');
const net = require('node:net');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname,'..');
const results = [];
const delay = ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function waitFor(fn, label) {
 for(let i=0;i<200;i++){if(fn())return;await delay(50);}throw Error('Timeout: '+label);
}
function pass(name, fn) {if(fn)fn();results.push({name,result:'PASS'});console.log('PASS UI '+results.length+' '+name);}
async function main() {
 const port=await new Promise(resolve=>{const s=net.createServer();s.listen(0,'127.0.0.1',()=>{const p=s.address().port;s.close(()=>resolve(p));});});
 const base='http://127.0.0.1:'+port, temp=fs.mkdtempSync(path.join(root,'build','thesis-ui-'));
 const process=spawn(path.join(root,'build',os.platform()==='win32'?'thesis_manager.exe':'thesis_manager'),['--root',root,'--data',temp,'--port',String(port)],{stdio:'ignore'});
 let dom;
 try {
  for(let i=0;i<200;i++){try{if((await fetch(base+'/api/health')).ok)break;}catch{}await delay(100);}
  const errors=[],vc=new VirtualConsole();vc.on('jsdomError',e=>errors.push(String(e)));
  dom=new JSDOM(fs.readFileSync(path.join(root,'web/index.html'),'utf8'),{url:base,runScripts:'outside-only',virtualConsole:vc,pretendToBeVisual:true});
  const w=dom.window,d=w.document;let cookie='';
  w.fetch=async (input,init={})=>{const res=await fetch(new URL(input,base),{...init,headers:{...init.headers,...(cookie?{Cookie:cookie}:{})}});const c=res.headers.get('set-cookie');if(c)cookie=c.split(';')[0];return res;};
  w.scrollTo=()=>{};w.HTMLDialogElement.prototype.showModal=function(){this.setAttribute('open','');};w.HTMLDialogElement.prototype.close=function(){this.removeAttribute('open');};
  w.addEventListener('error',e=>errors.push(e.message));
  w.eval(fs.readFileSync(path.join(root,'web/app.js'),'utf8'));
  const click=(selector)=>{const el=d.querySelector(selector);assert(el,'Missing '+selector);assert(!el.disabled,'Disabled '+selector);el.dispatchEvent(new w.MouseEvent('click',{bubbles:true,cancelable:true}));};
  const submit=(selector,values={})=>{const form=d.querySelector(selector);assert(form,'Missing form '+selector);for(const [k,v]of Object.entries(values)){form.elements[k].value=v;form.elements[k].dispatchEvent(new w.Event('input',{bubbles:true}));}form.dispatchEvent(new w.Event('submit',{bubbles:true,cancelable:true}));};
  const nav=page=>click('.nav-item[data-page="'+page+'"]');
  const closed=()=>!d.querySelector('#modal').hasAttribute('open');
  async function login(role){if(d.querySelector('[data-act="logout"]')){click('[data-act="logout"]');await waitFor(()=>d.querySelector('[data-form="login"]'),'logout');}click('[data-act="demo"][data-id="'+role+'"]');submit('[data-form="login"]');await waitFor(()=>d.querySelector('.sidebar'),'login '+role);}
  async function directLogin(name){let token='';return async (route,data)=>{const body=route==='/api/login'?{username:name,password:'Demo@2026'}:data;const r=await fetch(base+route,{method:body?'POST':'GET',headers:{'Content-Type':'application/json','X-Requested-With':'ThesisApp',Cookie:token},body:body?JSON.stringify(body):undefined});if(r.headers.get('set-cookie'))token=r.headers.get('set-cookie').split(';')[0];const json=await r.json();assert(r.ok,JSON.stringify(json));return json;};}
  await waitFor(()=>d.querySelector('[data-form="login"]'),'initial login');pass('未登录显示中文登录界面');
  await login('student');pass('学生通过界面登录并显示工作台',()=>assert(d.body.textContent.includes('林晓')));
  nav('topics');pass('课题大厅显示真实课题',()=>assert.equal(d.querySelectorAll('.topic-card').length,6));
  submit('[data-form="filter"]',{q:'不存在的课题关键词'});pass('搜索后显示空结果',()=>assert(d.body.textContent.includes('没有匹配的课题')));
  click('[data-act="clear-filter"]');click('[data-act="topic-detail"][data-id="1"]');pass('课题详情显示研究要求',()=>assert(d.querySelector('#modal').textContent.includes('研究要求')));
  click('[data-act="select"]');await waitFor(closed,'select');pass('学生通过界面提交选题申请');
  nav('overview');click('[data-act="selection-detail"]');click('[data-act="cancel-selection"]');await waitFor(closed,'cancel');pass('学生通过界面撤回待审申请');
  nav('topics');click('[data-act="topic-detail"][data-id="1"]');click('[data-act="select"]');await waitFor(closed,'reselect');
  await login('teacher');nav('selections');
  let row=[...d.querySelectorAll('tbody tr')].find(r=>r.textContent.includes('林晓'));assert(row);row.querySelector('button').click();
  submit('[data-form="selection-review"]',{decision:'approved',comment:'方向匹配，同意选题'});await waitFor(closed,'selection review');pass('教师通过界面确认指导关系');
  nav('topics');click('[data-act="topic-create"]');submit('[data-form="topic"]',{title:'界面测试用 C++ 课题',direction:'软件测试',capacity:'1',description:'用于验证真实 C++ 服务保存发布内容。',requirements:'完成分析、实现与测试。'});await waitFor(closed,'topic create');pass('教师通过界面发布课题',()=>assert(d.body.textContent.includes('界面测试用 C++ 课题')));
  const studentApi=await directLogin('student01');await studentApi('/api/login');
  const material=stage=>({stage,filename:stage+'.txt',file_base64:Buffer.from('DOM test material').toString('base64'),summary:'界面交互验证材料'});
  const proposal=await studentApi('/api/submissions',material('proposal'));
  await login('teacher');nav('materials');click('[data-act="material-review"][data-id="'+proposal.id+'"]');pass('教师材料对话框含授权下载入口',()=>assert(d.querySelector('#modal a[href="/api/files/'+proposal.id+'"]')));
  submit('[data-form="material-review"]',{decision:'approved',comment:'开题内容符合要求'});await waitFor(closed,'proposal review');pass('教师通过界面审核开题报告');
  const thesis=await studentApi('/api/submissions',material('thesis'));
  await login('teacher');nav('materials');click('[data-act="material-review"][data-id="'+thesis.id+'"]');submit('[data-form="material-review"]',{decision:'approved',comment:'论文符合要求'});await waitFor(closed,'thesis review');pass('教师通过界面审核论文');
  nav('grades');click('[data-act="grade"][data-id="4"]');
  const form=d.querySelector('[data-form="grade"]');for(const [k,v]of Object.entries({process_score:'90',thesis_score:'88',defense_score:'92'})){form.elements[k].value=v;form.elements[k].dispatchEvent(new w.Event('input',{bubbles:true}));}
  pass('成绩预览实时计算为 89.6',()=>assert.equal(d.querySelector('#score-preview').textContent,'89.6'));
  submit('[data-form="grade"]',{process_score:'90',thesis_score:'88',defense_score:'92',comment:'功能完整，报告清楚'});await waitFor(closed,'grade save');pass('教师通过界面保存成绩');
  await login('student');nav('grades');pass('学生界面显示已保存的最终成绩',()=>assert.equal(d.querySelector('.grade-number').textContent,'89.6'));
  nav('materials');pass('归档后的材料上传按钮禁用',()=>assert([...d.querySelectorAll('[data-act="upload"]')].every(x=>x.disabled)));
  click('[data-act="password"]');pass('修改密码对话框可打开',()=>assert(d.querySelector('[name="confirm_password"]')));click('[data-act="close"]');
  await login('admin');
  for(const page of ['overview','topics','progress','materials','grades','users','settings','notices','logs']){nav(page);pass('管理员页面可渲染 '+page,()=>assert(d.querySelector('main h1')));}
  nav('settings');pass('阶段设置读取有效日期',()=>assert(/^\d{4}-\d{2}-\d{2}$/.test(d.querySelector('[name="selection_deadline"]').value)));
  nav('notices');click('[data-act="notice-create"]');submit('[data-form="notice"]',{title:'界面测试公告',body:'<img src=x onerror=alert(1)> 文本应按原文显示。'});await waitFor(closed,'notice');pass('公告保存后以文本呈现 HTML 内容',()=>{assert(d.body.textContent.includes('<img src=x'));assert(!d.querySelector('.notice-full img'));});
  nav('users');click('[data-act="user-create"]');submit('[data-form="user"]',{username:'uitestuser',name:'界面测试用户',role:'student',department:'计算机学院',password:'Test@2026'});await waitFor(closed,'create user');pass('管理员通过界面创建用户',()=>assert(d.body.textContent.includes('uitestuser')));
  row=[...d.querySelectorAll('tbody tr')].find(r=>r.textContent.includes('uitestuser'));row.querySelector('button').click();submit('[data-form="toggle"]');await waitFor(closed,'toggle');pass('管理员通过界面停用用户');
  pass('所有界面脚本无未捕获错误',()=>assert.deepEqual(errors,[]));
  fs.writeFileSync(path.join(root,'docs/ui-test-results.json'),JSON.stringify({environment:'JSDOM 26.1.0 / Node '+global.process.version,visual_browser_test:'NOT_RUN: managed preview daemon unavailable',passed:results.length,failed:0,cases:results},null,2));
  console.log(results.length+' DOM interaction checks passed. Browser layout is unverified.');
 }finally{dom?.window.close();process.kill();fs.rmSync(temp,{recursive:true,force:true});}
}
main().catch(error=>{console.error(error);global.process.exitCode=1;});
