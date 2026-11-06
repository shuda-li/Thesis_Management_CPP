'use strict';
// This file renders the UI only. C++ authenticates every action and owns all data.
const app = document.getElementById('app');
const modal = document.getElementById('modal');
const view = { data: null, page: 'overview', filters: {}, demo: 'student', mobile: false };
const paths = {
 book:'<path d="M4 4h6a3 3 0 0 1 3 3v14a4 4 0 0 0-4-2H4z"/><path d="M13 7a3 3 0 0 1 3-3h4v15h-3a4 4 0 0 0-4 2"/>',
 grid:'<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>',
 file:'<path d="M5 3h9l5 5v13H5z"/><path d="M14 3v6h5M8 13h8M8 17h6"/>',
 check:'<path d="m5 12 4 4L19 6"/>', users:'<circle cx="9" cy="8" r="3"/><path d="M3 21v-3a6 6 0 0 1 12 0v3M16 5a3 3 0 0 1 0 6M21 21v-3a6 6 0 0 0-3-5"/>',
 user:'<circle cx="12" cy="8" r="4"/><path d="M4 21v-2a8 8 0 0 1 16 0v2"/>',
 clock:'<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
 chart:'<path d="M4 3v18h17M8 16v-4M13 16V7M18 16v-7"/>',
 bell:'<path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4"/>',
 setting:'<path d="M4 7h16M4 17h16"/><circle cx="9" cy="7" r="3"/><circle cx="15" cy="17" r="3"/>',
 logout:'<path d="M9 4H4v16h5M10 12h11m-4-4 4 4-4 4"/>',
 search:'<circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 5 5"/>',
 arrow:'<path d="M4 12h16m-5-5 5 5-5 5"/>',
 download:'<path d="M12 3v12m-4-4 4 4 4-4M4 16v5h16v-5"/>',
 upload:'<path d="M12 16V3m-4 4 4-4 4 4M4 16v5h16v-5"/>',
 plus:'<path d="M12 5v14M5 12h14"/>', close:'<path d="m6 6 12 12M6 18 18 6"/>',
 cap:'<path d="m2 9 10-5 10 5-10 5zM6 12v5c4 3 8 3 12 0v-5M22 9v8"/>',
 list:'<path d="M8 6h13M8 12h13M8 18h13M3 6h.1M3 12h.1M3 18h.1"/>',
 shield:'<path d="m12 3 8 3v6c0 5-8 9-8 9s-8-4-8-9V6z"/><path d="m8 12 3 3 5-6"/>',
 menu:'<path d="M4 6h16M4 12h16M4 18h16"/>', code:'<path d="m8 5-6 7 6 7M16 5l6 7-6 7M14 3l-4 18"/>',
};
function icon(name) { return `<svg class="icon" viewBox="0 0 24 24" aria-hidden="true">${paths[name] || paths.file}</svg>`; }
function esc(value) { return String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
const roleLabel = { student: '学生', teacher: '指导教师', admin: '管理员' };
const statusLabel = { pending: '待审核', approved: '已通过', rejected: '未通过', cancelled: '已撤回', changes: '需修改' };
function badge(status, label) { const color = { pending:'orange', approved:'green', rejected:'red', cancelled:'gray', changes:'red' }[status] || 'blue'; return `<span class="badge ${color}"><i class="dot"></i>${esc(label || statusLabel[status] || status)}</span>`; }
function button(label, action, id = '', primary = false, disabled = false) { return `<button type="button" class="btn ${primary?'primary':''}" data-act="${action}" data-id="${esc(id)}" ${disabled?'disabled':''}>${esc(label)}</button>`; }
function actionLink(label, page) { return `<button class="link-btn" data-act="nav" data-page="${page}">${esc(label)}${icon('arrow')}</button>`; }
function person(name, detail = '', color = '') { return `<div class="person"><span class="avatar ${color}">${esc(name?.slice(-2))}</span><span>${esc(name)}${detail?`<small>${esc(detail)}</small>`:''}</span></div>`; }
function empty(title, description = '', action = '') { return `<div class="empty"><span class="empty-icon">${icon('file')}</span><h3>${esc(title)}</h3><p>${esc(description)}</p>${action}</div>`; }
function panel(title, body, extra = '', bodyClass = '') { return `<section class="panel"><div class="panel-head"><h2>${title}</h2>${extra}</div><div class="${bodyClass}">${body}</div></section>`; }
function table(headers, rows) { return `<div class="table-wrap"><table><thead><tr>${headers.map(h=>`<th>${h}</th>`).join('')}</tr></thead><tbody>${rows.map(c=>`<tr>${c.map(v=>`<td>${v}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`; }
function stat(label, number, unit, note, name) { return `<div class="stat"><div class="stat-top">${label}<span class="stat-icon">${icon(name)}</span></div><strong class="mono">${number}<span>${unit}</span></strong><small>${note}</small></div>`; }
function heading(title, text, actions = '') { return `<div class="page-heading"><div><h1>${title}</h1><p>${text}</p></div><div class="actions">${actions}</div></div>`; }
function field(label, name, type='text', value='', extra='') { return `<label class="field"><span>${label}<b class="required">*</b></span><input name="${name}" type="${type}" value="${esc(value)}" required ${extra}></label>`; }
function area(label,name,value='',extra='') { return `<label class="field"><span>${label}</span><textarea name="${name}" ${extra}>${esc(value)}</textarea></label>`; }
function selector(label,name,options,selected='') { return `<label class="field"><span>${label}<b class="required">*</b></span><select name="${name}" required>${options.map(([v,t])=>`<option value="${esc(v)}" ${String(v)===String(selected)?'selected':''}>${esc(t)}</option>`).join('')}</select></label>`; }
function openModal(title, content, form = '', submit = '保存') {
 modal.innerHTML = `<div class="dialog-head"><h2 id="modal-title">${esc(title)}</h2><button class="icon-btn" data-act="close" aria-label="关闭对话框">${icon('close')}</button></div>${form?`<form data-form="${form}">`:''}<div class="dialog-body">${content}${form?'<div class="form-error" role="alert"></div>':''}</div><div class="dialog-footer"><button type="button" class="btn" data-act="close">${form?'取消':'关闭'}</button>${form?`<button class="btn primary" type="submit">${esc(submit)}</button>`:''}</div>${form?'</form>':''}`;
 modal.showModal();
}
let toastTimer;
function toast(message, error=false) { const element=document.getElementById('toast');element.textContent=message;element.className=`show ${error?'error':''}`;clearTimeout(toastTimer);toastTimer=setTimeout(()=>element.className='',4500); }
async function api(path, data) {
 const response = await fetch(path, { method:data===undefined?'GET':'POST',headers:{'Content-Type':'application/json','X-Requested-With':'ThesisApp'},body:data===undefined?undefined:JSON.stringify(data),credentials:'same-origin' });
 const result=await response.json();
 if (!response.ok) { if(response.status===401&&path!='/api/login'){view.data=null;modal.close();render();}throw new Error(result.error||'请求失败，请重试'); } return result;
}
async function refresh() { const y=window.scrollY;view.data=await api('/api/state');render();window.scrollTo(0,y); }
function navigate(page) { view.page=page;view.filters={};view.mobile=false;render();window.scrollTo(0,0); }
function activeSelection(id) { return view.data.selections.find(s=>s.student_id===id&&['pending','approved'].includes(s.status)); }
function latest(id,stage) { return view.data.submissions.find(f=>f.student_id===id&&f.stage===stage); }
function grade(id) { return view.data.grades.find(g=>g.student_id===id); }
function students() { return view.data.users.filter(u=>u.role==='student'); }
function progress(id) {
 if(grade(id))return {step:5,label:'已完成',color:'green',percent:100};
 const s=activeSelection(id);if(!s)return {step:0,label:'未选题',color:'gray',percent:0};
 if(s.status==='pending')return {step:1,label:'选题待确认',color:'orange',percent:15};
 const f=latest(id,'thesis'),p=latest(id,'proposal');
 if(f)return {step:f.status==='approved'?4:3,label:({approved:'待录成绩',pending:'论文审核中',changes:'论文待修改'})[f.status],color:f.status==='changes'?'red':f.status==='pending'?'orange':'blue',percent:f.status==='approved'?90:75};
 if(p)return {step:p.status==='approved'?3:2,label:({approved:'论文撰写中',pending:'开题审核中',changes:'开题待修改'})[p.status],color:p.status==='changes'?'red':p.status==='pending'?'orange':'blue',percent:p.status==='approved'?60:35};
 return {step:2,label:'待交开题',color:'blue',percent:25};
}
function stageBadge(id) {const p=progress(id);return `<span class="badge ${p.color}">${p.label}</span>`;}
function flow(id) { const p=progress(id);return `<div class="flow">${['选择课题','选题确认','开题报告','论文审核','成绩归档'].map((label,i)=>`<div class="flow-step ${i<p.step?'done':i===p.step?'current':''}"><span class="flow-num">${i<p.step?icon('check'):String(i+1).padStart(2,'0')}</span><p>${label}</p></div>`).join('')}</div>`; }
function schedule() {
 const d=view.data;const days=date=>Math.round((Date.parse(date+'T00:00:00Z')-Date.parse(d.current_date+'T00:00:00Z'))/86400000);
 return panel('阶段安排', ['selection','proposal','thesis'].map((k,i)=>`<div class="schedule-item"><div class="schedule-dot"><i></i></div><div class="schedule-content"><strong>${['选题截止','开题报告截止','论文提交截止'][i]}</strong><p class="mono">${esc(d.settings[k+'_deadline'])}<small>${days(d.settings[k+'_deadline'])>=0?'剩余 '+days(d.settings[k+'_deadline'])+' 天':'已截止'}</small></p></div></div>`).join('')+'<p class="deadline-note">请在各阶段截止日期前完成提交，截止当日仍可提交。</p>','', 'panel-body');
}
function noticePreview() { return panel('最新公告',view.data.notices.slice(0,2).map(n=>`<article class="notice"><h3>${esc(n.title)}</h3><p>${esc(n.body.length>64?n.body.slice(0,64)+'…':n.body)}</p><small>${esc(n.created_at.slice(0,10))} · ${esc(n.author_name)}</small></article>`).join(''),actionLink('全部','notices'),'panel-body'); }
function studentRows(list,limit=Infinity) { return list.slice(0,limit).map(u=>{const s=activeSelection(u.id),p=progress(u.id);return [person(u.name,u.username),`<div class="table-title">${esc(s?.topic_title||'尚未选择课题')}<small>${esc(s?.teacher_name||'待分配指导教师')}</small></div>`,stageBadge(u.id),`<small class="muted mono">${p.percent}%</small><div class="mini-progress"><i style="width:${p.percent}%"></i></div>`,view.data.user.role==='admin'&&!s?.status?.includes('approved')?`<button class="link-btn" data-act="assign" data-id="${u.id}">分配课题</button>`:`<button class="link-btn" data-act="student-detail" data-id="${u.id}">查看</button>`];}); }
function overview() {
 const d=view.data,role=d.user.role,own=d.user.id,isStudent=role==='student';
 const pending=d.selections.filter(s=>s.status==='pending').length+d.submissions.filter(f=>f.status==='pending').length;
 let stats;
 if(isStudent){const s=activeSelection(own),p=latest(own,'proposal'),t=latest(own,'thesis');stats=stat('当前阶段',progress(own).step,'/ 5',esc(progress(own).label),'grid')+stat('选题进度',s?.status==='approved'?'已确认':s?'待确认':'未选题','',s?'指导教师：'+esc(s.teacher_name):'先选择适合自己的研究课题','book')+stat('提交材料',d.submissions.length,'份',`开题 ${p?'已提交':'待提交'} · 论文 ${t?'已提交':'待提交'}`,'file')+stat('论文总评',grade(own)?.total??'—','分','过程 20% · 论文 50% · 答辩 30%','chart');}
 else stats=stat(role==='admin'?'学生总数':'指导学生',students().length,'人','当前账号可见的学生记录','users')+stat(role==='admin'?'已发布课题':'我的课题',d.topics.filter(t=>role==='admin'||t.teacher_id===own).length,'个','课题名额与申请状态实时更新','book')+stat('待处理事项',pending,'项',`选题 ${d.selections.filter(s=>s.status==='pending').length} · 材料 ${d.submissions.filter(f=>f.status==='pending').length}`,'clock')+stat('已完成论文',d.grades.length,'份',`完成率 ${students().length?Math.round(d.grades.length/students().length*100):0}%`,'check');
 const welcome=`<section class="welcome"><div><div class="eyebrow">${esc(d.settings.cohort)} / THESIS WORKSPACE</div><h2>${isStudent?esc(d.user.name)+'，开始你的论文计划':role==='teacher'?'把每一次指导，落实到下一步':'毕业论文工作正在进行'}</h2><p>${isStudent?'当前进度：'+progress(own).label+'。请关注教师反馈与阶段截止时间。':'选题、提交、审核与归档，所有进度集中查看。'}</p></div><div class="welcome-action">${button(isStudent?'查看我的材料':'查看学生进度','nav-short',isStudent?'materials':'progress')}</div></section>`;
 let main;
 if(isStudent){const s=activeSelection(own);main=panel('我的论文进度',`<p class="eyebrow">${s?esc(s.topic_title):'尚未选择毕业论文课题'}</p>${flow(own)}<p class="section-note">${s?'指导教师：'+esc(s.teacher_name)+' · '+esc(s.direction):'请先进入选题大厅查看研究方向和课题要求，提交申请后由指导教师确认。'}</p><div class="actions">${button(s?'提交与查看材料':'前往选题大厅','nav-short',s?'materials':'topics',true)}${s?button('查看选题记录','selection-detail',s.id):''}</div>`,'','panel-body');}
 else main=panel('学生进度一览',students().length?table(['学生','课题与指导教师','当前阶段','完成进度','操作'],studentRows(students(),5))+`<div class="table-footer">共 ${students().length} 位学生${actionLink('查看全部','progress')}</div>`:empty('暂无学生记录'),`<span class="subtle">${students().length} 位学生</span>`);
 const tasks=[];
 if(isStudent){const p=progress(own);if(p.step<5)tasks.push({title:p.label,sub:'按当前阶段完成操作后，系统将保留提交与审核记录。',action:'nav-short',id:p.step<2?'topics':'materials',urgent:p.color==='red'});}
 else {d.selections.filter(s=>s.status==='pending').slice(0,3).forEach(s=>tasks.push({title:s.student_name+' 的选题申请',sub:s.topic_title,action:role==='teacher'?'selection-review':'selection-detail',id:s.id}));d.submissions.filter(f=>f.status==='pending').slice(0,3).forEach(f=>tasks.push({title:f.student_name+' 的'+(f.stage==='proposal'?'开题报告':'论文'),sub:f.filename+' · 第 '+f.version+' 版',action:role==='teacher'?'material-review':'material-detail',id:f.id}));}
 const tasksPanel=panel(isStudent?'接下来要做':'待办事项',tasks.length?tasks.map(t=>`<div class="task ${t.urgent?'urgent':''}"><span class="task-icon">${icon('clock')}</span><div class="task-info"><strong>${esc(t.title)}</strong><small>${esc(t.sub)}</small></div><button class="link-btn" data-act="${t.action}" data-id="${t.id}">${isStudent?'前往':role==='teacher'?'处理':'查看'}${icon('arrow')}</button></div>`).join(''):empty('当前没有待办事项','有新的选题申请或材料提交时会显示在这里。'),`<span class="subtle">${isStudent?'下一步':pending+' 项待处理'}</span>`);
 return heading(isStudent?'我的论文工作台':role==='teacher'?'指导工作概览':'毕业论文工作概览','以清晰的流程，推进每一个毕业论文阶段。',role==='admin'?`<a class="btn" href="/api/export">${icon('download')}导出统计</a>`:'')+`<div class="stats">${stats}</div><div class="overview-grid"><div class="stack">${welcome}${main}${tasksPanel}</div><div class="stack">${schedule()}${noticePreview()}</div></div>`;
}
function filters(options={}) {
 const f=view.filters;return `<form class="filter-bar" data-form="filter"><label class="search-field">${icon('search')}<input name="q" aria-label="搜索" placeholder="${options.placeholder||'搜索姓名、账号或课题'}" value="${esc(f.q||'')}"></label>${options.direction?`<select name="direction" aria-label="研究方向"><option value="">全部研究方向</option>${[...new Set(view.data.topics.map(t=>t.direction))].map(t=>`<option ${t===f.direction?'selected':''}>${esc(t)}</option>`).join('')}</select>`:''}${options.status?`<select name="status" aria-label="审核状态"><option value="">全部状态</option>${options.status.map(s=>`<option value="${s}" ${f.status===s?'selected':''}>${statusLabel[s]}</option>`).join('')}</select>`:''}${options.role?`<select name="role" aria-label="用户角色"><option value="">全部角色</option>${Object.entries(roleLabel).map(([v,t])=>`<option value="${v}" ${f.role===v?'selected':''}>${t}</option>`).join('')}</select>`:''}<button class="btn" type="submit">筛选</button>${f.q||f.direction||f.status||f.role?'<button type="button" class="btn ghost" data-act="clear-filter">重置</button>':''}</form>`;
}
function matches(row) { const f=view.filters;return (!f.q||JSON.stringify(row).toLowerCase().includes(f.q.toLowerCase()))&&(!f.direction||row.direction===f.direction)&&(!f.status||row.status===f.status)&&(!f.role||row.role===f.role); }
function topicsPage() {
 const d=view.data,role=d.user.role,selection=activeSelection(d.user.id);const items=d.topics.filter(t=>(role!=='teacher'||t.teacher_id===d.user.id)&&matches(t));
 return heading(role==='student'?'选题大厅':role==='teacher'?'我的课题':'课题总览','了解研究方向与课题要求，开启毕业论文的第一步。',role!=='student'?`<button class="btn primary" data-act="topic-create">${icon('plus')}发布课题</button>`:'')+filters({direction:true,placeholder:'搜索课题、教师或研究方向'})+`<p class="section-note">共 ${items.length} 个课题${role==='student'?' · 每位学生可保留一项待审核或已确认的选题':''}</p>`+(items.length?`<div class="topic-grid">${items.map(t=>`<article class="topic-card"><div class="topic-card-top"><span class="topic-symbol">${icon('book')}</span><span class="badge ${t.approved_count>=t.capacity?'gray':'green'}">${t.approved_count>=t.capacity?'名额已满':'可申请'}</span></div><h2>${esc(t.title)}</h2><p>${esc(t.description.slice(0,100))}</p><div class="topic-meta"><span>${icon('user')}${esc(t.teacher_name)}</span><span>${icon('code')}${esc(t.direction)}</span></div><div class="topic-card-footer"><small>剩余名额 <strong>${Math.max(0,t.capacity-t.approved_count)}</strong> / ${t.capacity}</small><button class="btn small" data-act="topic-detail" data-id="${t.id}">查看详情${icon('arrow')}</button></div></article>`).join('')}</div>`:empty('没有匹配的课题','调整搜索词或筛选条件后重试。'))+(role==='student'&&selection?`<p class="section-note">当前选题：${esc(selection.topic_title)} · ${statusLabel[selection.status]}</p>`:'');
}
function selectionsPage() {
 const d=view.data,items=d.selections.filter(matches);return heading('选题审核','查看学生的选题申请，确认指导关系并记录审核意见。')+filters({status:['pending','approved','rejected','cancelled']})+panel('申请记录',items.length?table(['学生','申请课题','提交时间','状态','操作'],items.map(s=>[person(s.student_name,s.student_username),`<div class="table-title">${esc(s.topic_title)}<small>${esc(s.teacher_name)}</small></div>`,`<span class="muted tiny mono">${esc(s.created_at)}</span>`,badge(s.status),`<button class="btn small" data-act="${s.status==='pending'?'selection-review':'selection-detail'}" data-id="${s.id}">${s.status==='pending'?'审核申请':'查看记录'}</button>`])):empty('暂无申请记录'),`<span class="subtle">${items.length} 条记录</span>`);
}
function progressPage() {
 const list=students().filter(matches);return heading('学生进度','按学生查看选题、开题、论文和成绩的完成情况。',view.data.user.role==='admin'?'<a class="btn" href="/api/export">'+icon('download')+'导出统计</a>':'')+filters()+panel('论文进度',list.length?table(['学生','课题与指导教师','当前阶段','完成进度','操作'],studentRows(list)):empty('没有匹配的学生'),`<span class="subtle">${list.length} 位学生</span>`);
}
function canUpload(stage) {const id=view.data.user.id,s=activeSelection(id),last=latest(id,stage);return s?.status==='approved'&&!grade(id)&&(!last||last.status==='changes')&&(stage==='proposal'||latest(id,'proposal')?.status==='approved');}
function materialsPage() {
 const d=view.data,isStudent=d.user.role==='student',isTeacher=d.user.role==='teacher';let items=d.submissions.filter(matches);if(view.filters.stage)items=items.filter(f=>f.stage===view.filters.stage);
 const upload=isStudent?`<div class="two-cols" style="margin-bottom:23px">${['proposal','thesis'].map((s,i)=>`<section class="panel"><div class="material-actions"><div><h3>${i?'论文文件':'开题报告'}</h3><p>${i?'开题通过后可提交论文，保留每次修改版本。':'选题确认后提交，审核意见会随版本保留。'}</p></div>${button('提交材料','upload',s,true,!canUpload(s))}</div></section>`).join('')}</div>`:'';
 return heading(isStudent?'我的材料':isTeacher?'材料审核':'材料记录','支持 PDF、DOC、DOCX、TXT，单个文件不超过 5 MB。')+upload+`<div class="segment">${[['','全部材料'],['proposal','开题报告'],['thesis','论文文件']].map(([v,t])=>`<button data-act="stage-filter" data-id="${v}" class="${(view.filters.stage||'')===v?'active':''}">${t}</button>`).join('')}</div>`+filters({status:['pending','approved','changes'],placeholder:'搜索材料、姓名或课题'})+panel('提交与审核记录',items.length?table(['材料','学生与课题','版本','状态','提交时间','操作'],items.map(f=>[`<div class="table-title">${esc(f.filename)}<small>${f.stage==='proposal'?'开题报告':'论文文件'} · ${Math.ceil(f.file_size/1024)} KB</small></div>`,`<div class="table-title">${esc(f.student_name)}<small>${esc(f.topic_title)}</small></div>`,`<span class="badge gray">V${f.version}</span>`,badge(f.status),`<small class="muted mono">${esc(f.created_at.slice(0,16))}</small>`,`<button class="btn small" data-act="${isTeacher&&f.status==='pending'?'material-review':'material-detail'}" data-id="${f.id}">${isTeacher&&f.status==='pending'?'审核':'查看'}</button>`])):empty('暂无材料记录',isStudent?'选题确认后即可提交开题报告。':'学生提交的材料会显示在这里。'),`<span class="subtle">${items.length} 份材料</span>`);
}
function gradesPage() {
 const d=view.data,role=d.user.role;
 if(role==='student'){const g=grade(d.user.id);return heading('我的成绩','总评按过程成绩 20%、论文成绩 50%、答辩成绩 30% 计算。')+(g?`<section class="panel grade-card"><span class="eyebrow">GRADUATION THESIS / FINAL GRADE</span><div class="grade-number mono">${g.total.toFixed(1)}</div>${badge('approved','成绩已归档')}<div class="grade-breakdown">${[['过程成绩',g.process_score,'20%'],['论文成绩',g.thesis_score,'50%'],['答辩成绩',g.defense_score,'30%']].map(([l,n,w])=>`<div><strong>${n}</strong><small>${l} · ${w}</small></div>`).join('')}</div><p class="section-note">指导教师：${esc(g.teacher_name)} · 录入时间 ${esc(g.updated_at)}</p><p class="detail-value">${esc(g.comment)}</p></section>`:panel('成绩记录',empty('成绩暂未公布','论文审核通过后，由指导教师录入各项成绩。')));}
 const list=students().filter(u=>matches({...u,topic:activeSelection(u.id)?.topic_title||''}));const avg=d.grades.length?d.grades.reduce((a,g)=>a+g.total,0)/d.grades.length:0;
 return heading(role==='teacher'?'成绩管理':'成绩统计','过程 20% ＋ 论文 50% ＋ 答辩 30%，总评自动计算。',role==='admin'?'<a class="btn" href="/api/export">'+icon('download')+'导出统计</a>':'')+`<div class="stats">${stat('已录入成绩',d.grades.length,'人','仅统计已完成成绩录入的学生','check')}${stat('平均总评',d.grades.length?avg.toFixed(1):'—','分','按已录入成绩计算','chart')}${stat('及格人数',d.grades.filter(g=>g.total>=60).length,'人','总评不低于 60 分','cap')}${stat('待录入成绩',students().filter(u=>!grade(u.id)&&latest(u.id,'thesis')?.status==='approved').length,'人','论文已审核通过','clock')}</div>`+filters()+panel('学生成绩',list.length?table(['学生','过程 20%','论文 50%','答辩 30%','总评','操作'],list.map(u=>{const g=grade(u.id),eligible=latest(u.id,'thesis')?.status==='approved';return [person(u.name,u.username),g?.process_score??'—',g?.thesis_score??'—',g?.defense_score??'—',g?`<strong class="mono">${g.total.toFixed(1)}</strong>`:'<span class="muted">未录入</span>',role==='teacher'?button(g?'修改成绩':'录入成绩','grade',u.id,false,!eligible):stageBadge(u.id)];})):empty('暂无成绩记录'));
}
function usersPage() {
 const list=view.data.users.filter(matches);return heading('用户管理','创建学生、教师和管理员账号，管理账号启用状态。',`<button class="btn primary" data-act="user-create">${icon('plus')}新增用户</button>`)+filters({role:true,placeholder:'搜索姓名、账号或学院'})+panel('账号列表',table(['用户','账号','角色','学院','状态','操作'],list.map(u=>[person(u.name),`<span class="mono muted">${esc(u.username)}</span>`,`<span class="badge blue">${roleLabel[u.role]}</span>`,esc(u.department),badge(u.active?'approved':'cancelled',u.active?'已启用':'已停用'),button(u.active?'停用':'启用','user-toggle',u.id,false,u.id===view.data.user.id)+' '+button('重置密码','user-reset',u.id,false,u.id===view.data.user.id)])),`<span class="subtle">${list.length} 个账号</span>`)+`<p class="section-note">存在未完成论文任务的用户，以及名下仍有课题的教师不能停用；当前登录账号也不能停用。</p>`;
}
function settingsPage() {
 const s=view.data.settings;return heading('阶段设置','配置学年与各阶段截止日期，保存后对所有角色生效。')+panel('论文工作安排',`<form class="settings-form" data-form="settings">${field('学年或届别','cohort','text',s.cohort,'maxlength="20"')}<div class="stage-box"><span>01</span>${field('选题截止日期','selection_deadline','date',s.selection_deadline)}</div><div class="stage-box"><span>02</span>${field('开题报告截止日期','proposal_deadline','date',s.proposal_deadline)}</div><div class="stage-box"><span>03</span>${field('论文提交截止日期','thesis_deadline','date',s.thesis_deadline)}</div><p class="section-note">日期按选题、开题、论文的顺序排列，可设置为同一天，截止当日仍可提交。教师审核与成绩录入不受提交截止日期限制。</p><div class="form-error" role="alert"></div><button class="btn primary" type="submit">保存阶段设置</button></form>`,'','panel-body');
}
function noticesPage() {return heading('公告通知','查看毕业论文工作的安排、提醒与说明。',view.data.user.role==='admin'?`<button class="btn primary" data-act="notice-create">${icon('plus')}发布公告</button>`:'')+`<section class="panel">${view.data.notices.map(n=>`<article class="notice-full"><h2>${esc(n.title)}</h2><p>${esc(n.body)}</p><small>${esc(n.author_name)} · ${esc(n.created_at)}</small></article>`).join('')}</section>`;}
const actionNames={'/api/assign':'分配课题','/api/topics':'发布课题','/api/select':'申请选题','/api/selections/cancel':'撤回申请','/api/selections/review':'审核选题','/api/submissions':'提交材料','/api/reviews':'审核材料','/api/grades':'录入成绩','/api/users':'创建用户','/api/users/toggle':'更新用户状态','/api/settings':'设置截止日期','/api/notices':'发布公告','/api/password':'修改密码'};
function logsPage() {return heading('操作记录','记录关键业务操作，便于查询与过程追溯。')+panel('最近操作',table(['操作人','操作类型','结果','时间'],view.data.logs.map(l=>{let detail=l.detail;try{detail=JSON.parse(l.detail).message||l.detail;}catch{}return [person(l.user_name),esc(actionNames[l.action]||l.action),esc(detail),`<small class="muted mono">${esc(l.created_at)}</small>`];})),`<span class="subtle">最近 ${view.data.logs.length} 条</span>`);}
const menus={student:[['overview','grid','工作概览'],['topics','book','选题大厅'],['materials','file','我的材料'],['grades','chart','我的成绩'],['notices','bell','公告通知']],teacher:[['overview','grid','工作概览'],['topics','book','我的课题'],['selections','check','选题审核'],['progress','users','学生进度'],['materials','file','材料审核'],['grades','chart','成绩管理'],['notices','bell','公告通知']],admin:[['overview','grid','工作概览'],['topics','book','课题总览'],['progress','users','学生进度'],['materials','file','材料记录'],['grades','chart','成绩统计'],['users','shield','用户管理'],['settings','setting','阶段设置'],['notices','bell','公告通知'],['logs','list','操作记录']]};
const renderPages={overview,topics:topicsPage,selections:selectionsPage,progress:progressPage,materials:materialsPage,grades:gradesPage,users:usersPage,settings:settingsPage,notices:noticesPage,logs:logsPage};
function brand(){return `<div class="brand"><span class="brand-mark">${icon('file')}</span><div><strong>论文有序</strong><small>THESISFLOW</small></div></div>`;}
function renderLogin() {
 const username={student:'student01',teacher:'teacher01',admin:'admin'}[view.demo];
 app.innerHTML=`<main class="login-page"><section class="login-aside">${brand()}<div class="login-intro"><span class="eyebrow">GRADUATION THESIS MANAGEMENT</span><h1>毕业论文，<br>从选题到<em>定稿。</em></h1><p>选题申请、过程指导、材料审核与成绩归档。<br>让每个论文阶段都有清晰的下一步。</p><div class="paper-scene" aria-hidden="true"><div class="paper back"></div><div class="paper"><span class="paper-tag">GRADUATION THESIS</span><h3>毕业论文工作计划</h3><div class="paper-line"></div><div class="paper-line"></div><div class="paper-line short"></div><div class="paper-line"></div><div class="paper-stamp">${icon('check')}</div></div><div class="floating-note"><i class="dot"></i>选题 · 开题 · 论文 · 归档</div></div></div><div class="login-aside-bottom">论文有序 · 毕业论文管理系统</div></section><section class="login-main"><div class="login-box"><span class="badge">毕业论文管理系统</span><h2>登录论文工作台</h2><p>使用你的账号，继续当前论文工作。</p><form data-form="login">${field('账号','username','text',username,'autocomplete="username" maxlength="32"')}${field('密码','password','password','Demo@2026','autocomplete="current-password" maxlength="128"')}<div class="form-error" role="alert"></div><button class="btn primary wide" type="submit">登录工作台${icon('arrow')}</button></form><div class="login-separator">选择身份，快速填入账号</div><div class="demo-roles">${[['student','cap','学生'],['teacher','user','指导教师'],['admin','shield','管理员']].map(([r,i,l])=>`<button class="demo-role ${view.demo===r?'active':''}" data-act="demo" data-id="${r}">${icon(i)}${l}</button>`).join('')}</div></div></section></main>`;
}
function render() {
 if(!view.data){renderLogin();return;}
 const d=view.data,u=d.user,nav=menus[u.role];if(!nav.some(n=>n[0]===view.page))view.page='overview';
 const current=nav.find(n=>n[0]===view.page)[2];
 app.innerHTML=`<aside class="sidebar ${view.mobile?'open':''}">${brand()}<div class="nav-label">${roleLabel[u.role]}工作空间</div><nav aria-label="主导航">${nav.map(([p,i,l])=>`<button class="nav-item ${view.page===p?'active':''}" data-act="nav" data-page="${p}" ${view.page===p?'aria-current="page"':''}>${icon(i)}${l}${p==='selections'&&d.selections.some(s=>s.status==='pending')?`<span class="count">${d.selections.filter(s=>s.status==='pending').length}</span>`:''}</button>`).join('')}</nav><div class="sidebar-bottom"><div class="sidebar-help"><strong>每一步，都有记录</strong>论文材料、审核意见与成绩<br>集中保存，随时查看。<button data-act="help">使用帮助 ${icon('arrow')}</button></div><small>THESISFLOW · 毕业论文管理系统</small></div></aside><div class="shell"><header class="topbar"><div class="breadcrumb"><button class="icon-btn mobile-nav" data-act="menu" aria-label="打开导航">${icon('menu')}</button><span>毕业论文管理</span><span>/</span><b>${current}</b></div><div class="topbar-right"><span class="online"><i class="dot"></i>在线</span><div class="profile"><span class="avatar tan">${esc(u.name.slice(-2))}</span><button data-act="password" title="修改密码"><strong>${esc(u.name)}</strong><span class="role">${roleLabel[u.role]}</span></button></div><button class="icon-btn" data-act="logout" aria-label="退出登录" title="退出登录">${icon('logout')}</button></div></header><main class="content" id="main-content">${renderPages[view.page]()}<footer class="footer-note">论文有序 · 毕业论文管理系统</footer></main></div>`;
}

function showTopic(id) {
 const t=view.data.topics.find(t=>t.id===id),s=activeSelection(view.data.user.id);if(!t)return;
 openModal('课题详情',`<span class="badge blue">${esc(t.direction)}</span><h2 style="margin-top:15px;line-height:1.8">${esc(t.title)}</h2><span class="detail-label">指导教师</span><p class="detail-value">${esc(t.teacher_name)} · 剩余 ${t.capacity-t.approved_count} / ${t.capacity} 个名额</p><span class="detail-label">课题介绍</span><p class="detail-value">${esc(t.description)}</p><span class="detail-label">研究要求</span><p class="detail-value">${esc(t.requirements)}</p>${view.data.user.role==='student'?`<p class="section-note">${s?'你已有选题申请或已确认的选题。':'提交申请后，由指导教师确认。'}</p><div class="actions">${button('申请该课题','select',id,true,!!s||t.approved_count>=t.capacity)}</div>${s?.status==='pending'?`<p class="section-note">待审核申请可以在工作概览中查看并撤回。</p>`:''}`:`${view.data.user.role==='admin'||t.teacher_id===view.data.user.id?`<div class="actions">${button('编辑课题','topic-edit',t.id,false,t.approved_count>0)}</div>${t.approved_count>0?'<p class="section-note">已有学生确认该课题，课题信息不可修改。</p>':''}`:''}`}`);
}
function showSelection(id,review=false) {
 const s=view.data.selections.find(s=>s.id===id);if(!s)return;
 const content=`${badge(s.status)}<span class="detail-label">学生与课题</span><p class="detail-value">${esc(s.student_name)} · ${esc(s.student_username)}<br>${esc(s.topic_title)}</p><span class="detail-label">指导教师与申请时间</span><p class="detail-value">${esc(s.teacher_name)} · ${esc(s.created_at)}</p>${s.comment?`<span class="detail-label">审核说明</span><p class="detail-value">${esc(s.comment)}</p>`:''}`;
 if(review)openModal('审核选题申请',content+`<input type="hidden" name="id" value="${id}">${selector('审核结果','decision',[['approved','同意选题'],['rejected','拒绝申请']])}${area('审核说明 拒绝时必填','comment','','maxlength="330"')}`,'selection-review','保存审核结果');
 else openModal('选题申请记录',content+(view.data.user.role==='student'&&s.status==='pending'?`<div style="margin-top:22px">${button('撤回该申请','cancel-selection',id)}</div>`:''));
}
function showMaterial(id,review=false) {
 const f=view.data.submissions.find(f=>f.id===id);if(!f)return;const r=view.data.reviews.find(r=>r.submission_id===id);
 const detail=`${badge(f.status)}<span class="detail-label">${esc(f.student_name)} · ${f.stage==='proposal'?'开题报告':'论文文件'} · V${f.version}</span><p class="detail-value">${esc(f.filename)}<br>${esc(f.topic_title)}</p><p class="section-note">${Math.ceil(f.file_size/1024)} KB · 提交时间 ${esc(f.created_at)}</p><a class="btn small" href="/api/files/${f.id}">${icon('download')}下载材料</a><span class="detail-label">提交说明</span><p class="detail-value">${esc(f.summary||'未填写')}</p>${r?`<div class="review-item"><strong class="tiny">教师审核意见</strong><p>${esc(r.comment)}</p><small>${esc(r.teacher_name)} · ${esc(r.created_at)}</small></div>`:''}`;
 if(review)openModal('审核学生材料',detail+`<input name="submission_id" type="hidden" value="${id}">${selector('审核结果','decision',[['approved','审核通过'],['changes','退回修改']])}${area('审核意见','comment','','required maxlength="1000" minlength="1"')}`,'material-review','保存审核意见');
 else openModal('材料与审核记录',detail);
}
function showStudent(id) {
 const u=students().find(u=>u.id===id),s=activeSelection(id);if(!u)return;
 openModal('学生论文进度',person(u.name,u.username)+flow(id)+`<span class="detail-label">选题与指导教师</span><p class="detail-value">${esc(s?.topic_title||'尚未选题')}<br>${esc(s?.teacher_name||'待分配')}</p>`+['proposal','thesis'].map(stage=>{const f=latest(id,stage);return `<span class="detail-label">${stage==='proposal'?'开题报告':'论文文件'}</span>${f?`<p class="detail-value">V${f.version} · ${esc(f.filename)} ${badge(f.status)}</p><a class="link-btn" href="/api/files/${f.id}">下载材料 ${icon('download')}</a>`:'<p class="detail-value">尚未提交</p>'}`;}).join('')+(grade(id)?`<span class="detail-label">论文总评</span><p class="detail-value">${grade(id).total.toFixed(1)} 分</p>`:''));
}
document.addEventListener('click',async event=>{
 const target=event.target.closest('[data-act]');if(!target||target.disabled)return;const action=target.dataset.act,raw=target.dataset.id,id=Number(raw);
 try {
  if(action==='close'){modal.close();return;}
  if(action==='nav'){navigate(target.dataset.page);return;}
  if(action==='nav-short'){navigate(raw);return;}
  if(action==='menu'){view.mobile=!view.mobile;render();return;}
  if(action==='demo'){view.demo=raw;renderLogin();return;}
  if(action==='clear-filter'){view.filters={};render();return;}
  if(action==='stage-filter'){view.filters.stage=raw;render();return;}
  if(action==='logout'){await api('/api/logout',{});view.data=null;view.page='overview';render();toast('已退出登录');return;}
  if(action==='topic-detail'){showTopic(id);return;}
  if(action==='selection-detail'){showSelection(id);return;}
  if(action==='selection-review'){showSelection(id,true);return;}
  if(action==='material-detail'){showMaterial(id);return;}
  if(action==='material-review'){showMaterial(id,true);return;}
  if(action==='student-detail'){showStudent(id);return;}
  if(action==='select'||action==='cancel-selection') {target.disabled=true;const result=await api(action==='select'?'/api/select':'/api/selections/cancel',action==='select'?{topic_id:id}:{id});modal.close();await refresh();toast(result.message);return;}
  if(action==='topic-create') {openModal('发布毕业论文课题',field('课题名称','title','text','','maxlength="80" minlength="2"')+field('研究方向','direction','text','','maxlength="20"')+(view.data.user.role==='admin'?selector('指导教师','teacher_id',view.data.users.filter(u=>u.role==='teacher'&&u.active).map(u=>[u.id,u.name])):'')+field('可指导人数','capacity','number',1,'min="1" max="10" step="1"')+area('课题介绍','description','','required maxlength="1000"')+area('研究要求','requirements','','required maxlength="500"'),'topic','发布课题');return;}
  if(action==='topic-edit') {const t=view.data.topics.find(t=>t.id===id);openModal('编辑课题',`<input type="hidden" name="id" value="${id}">`+field('课题名称','title','text',t.title,'maxlength="80" minlength="2"')+field('研究方向','direction','text',t.direction,'maxlength="20"')+field('可指导人数','capacity','number',t.capacity,'min="1" max="10" step="1"')+area('课题介绍','description',t.description,'required maxlength="1000"')+area('研究要求','requirements',t.requirements,'required maxlength="500"'),'topic-edit','保存修改');return;}
  if(action==='upload') {openModal(raw==='proposal'?'提交开题报告':'提交论文文件',`<input type="hidden" name="stage" value="${esc(raw)}"><label class="field"><span>选择文件<b class="required">*</b></span><input name="file" type="file" accept=".pdf,.doc,.docx,.txt" required><small>单文件不超过 5 MB，提交后等待教师审核。需修改时可提交新版本。</small></label>`+area('本次提交说明','summary','','maxlength="1000"'),'upload','提交审核');return;}
  if(action==='grade') {const u=students().find(u=>u.id===id),g=grade(id);openModal('录入论文成绩',person(u.name,u.username)+`<input type="hidden" name="student_id" value="${id}"><p class="section-note">论文已通过审核，总评按过程 20%、论文 50%、答辩 30% 自动计算。</p><div class="form-row">`+field('过程成绩 20%','process_score','number',g?.process_score??'','min="0" max="100" step="0.1"')+field('论文成绩 50%','thesis_score','number',g?.thesis_score??'','min="0" max="100" step="0.1"')+'</div>'+field('答辩成绩 30%','defense_score','number',g?.defense_score??'','min="0" max="100" step="0.1"')+'<p class="score-preview">预计总评 <strong id="score-preview">'+(g?.total.toFixed(1)||'—')+'</strong></p>'+area('综合评语','comment',g?.comment||'','required maxlength="1000"'),'grade','保存成绩');return;}
  if(action==='user-create') {openModal('新增系统用户',field('登录账号','username','text','','pattern="[A-Za-z0-9_]{3,32}" maxlength="32" autocomplete="off"')+field('姓名','name','text','','maxlength="20"')+`<div class="form-row">${selector('角色','role',[['student','学生'],['teacher','指导教师'],['admin','管理员']])}${field('所属学院','department','text','计算机学院','maxlength="40"')}</div>`+field('初始密码','password','password','','minlength="8" maxlength="128" autocomplete="new-password"'),'user','创建用户');return;}
  if(action==='user-toggle') {const u=view.data.users.find(u=>u.id===id);openModal(u.active?'停用账号':'启用账号',`<input type="hidden" name="id" value="${id}"><p class="detail-value">确认${u.active?'停用':'启用'} ${esc(u.name)}（${esc(u.username)}）？${u.active?'停用后该账号的登录会立即失效。':''}</p>`,'toggle','确认'+(u.active?'停用':'启用'));return;}
  if(action==='user-reset') {const u=view.data.users.find(u=>u.id===id);openModal('重置密码',`<input type="hidden" name="id" value="${id}"><p class="detail-value">为 ${esc(u.name)}（${esc(u.username)}）设置新密码。重置后该账号的全部登录将失效，请将新密码告知本人并建议其登录后修改。</p>`+field('新密码 至少 8 位','password','password','','minlength="8" maxlength="128" autocomplete="new-password"'),'user-reset','确认重置');return;}
  if(action==='assign') {const u=students().find(u=>u.id===id),topics=view.data.topics.filter(t=>t.approved_count<t.capacity);openModal('分配课题与指导教师',person(u.name,u.username)+`<input type="hidden" name="student_id" value="${id}"><p class="section-note">分配后直接确认指导关系，原待审核申请会关闭并保留记录。</p>`+selector('选择课题','topic_id',topics.map(t=>[t.id,t.title+' · '+t.teacher_name]))+area('分配说明','reason','','required maxlength="330"'),'assign','确认分配');return;}
  if(action==='notice-create') {openModal('发布工作公告',field('公告标题','title','text','','maxlength="60"')+area('公告内容','body','','required maxlength="1600"'),'notice','发布公告');return;}
  if(action==='password') {openModal('修改登录密码',field('原密码','old_password','password','','autocomplete="current-password"')+field('新密码 至少 8 位','new_password','password','','minlength="8" maxlength="128" autocomplete="new-password"')+field('再次输入新密码','confirm_password','password','','minlength="8" maxlength="128" autocomplete="new-password"')+'<p class="section-note">修改成功后，当前账号的全部登录会失效，请使用新密码重新登录。</p>','password','修改密码');return;}
  if(action==='help') {openModal('使用帮助',`<p class="detail-value">学生：在选题大厅申请课题，经指导教师确认后按阶段提交开题报告与论文；被退回修改时可提交新版本，历史版本与审核意见会自动保留。<br><br>指导教师：发布课题、审核选题申请与学生材料，论文审核通过后录入成绩。<br><br>管理员：管理用户账号、分配课题与指导关系、设置阶段截止日期、发布公告并导出统计。</p><p class="section-note">材料支持 PDF、DOC、DOCX、TXT 格式，单个文件不超过 5 MB。总评按过程成绩 20%、论文成绩 50%、答辩成绩 30% 计算。如无法登录或需要重置密码，请联系管理员。</p>`);return;}
 }catch(error){target.disabled=false;toast(error.message,true);}
});
document.addEventListener('change',event=>{if(event.target.closest('[data-form="filter"]')&&event.target.tagName==='SELECT')event.target.form.requestSubmit();});
document.addEventListener('input',event=>{const f=event.target.closest('[data-form="grade"]');if(!f)return;const values=['process_score','thesis_score','defense_score'].map(n=>f.elements[n].value);const number=values.every(v=>v!==''&&Number(v)>=0&&Number(v)<=100)?(values[0]*.2+values[1]*.5+values[2]*.3).toFixed(1):'—';document.getElementById('score-preview').textContent=number;});
document.addEventListener('submit',async event=>{
 const form=event.target.closest('[data-form]');if(!form)return;event.preventDefault();const type=form.dataset.form,values=Object.fromEntries(new FormData(form));
 if(type==='filter'){view.filters={...view.filters,...values};render();return;}
 const errorBox=form.querySelector('.form-error'),submit=form.querySelector('[type="submit"]');errorBox.textContent='';submit.disabled=true;
 const submitLabel=submit.textContent;if(type==='upload')submit.textContent='正在上传…';
 try {
  const routes={login:'/api/login',topic:'/api/topics','topic-edit':'/api/topics/update','selection-review':'/api/selections/review','material-review':'/api/reviews',grade:'/api/grades',user:'/api/users','user-reset':'/api/users/reset_password',toggle:'/api/users/toggle',settings:'/api/settings',notice:'/api/notices',password:'/api/password',assign:'/api/assign',upload:'/api/submissions'};
  for(const key of ['id','teacher_id','topic_id','student_id','submission_id','capacity','process_score','thesis_score','defense_score'])if(key in values)values[key]=Number(values[key]);
  if((type==='material-review'&&values.decision==='changes'||type==='selection-review'&&values.decision==='rejected')&&!window.confirm(type==='material-review'?'确认退回修改？学生需查看审核意见后重新提交新版本。':'确认拒绝该选题申请？')){submit.disabled=false;submit.textContent=submitLabel;return;}
  if(type==='password'){if(values.new_password!==values.confirm_password)throw new Error('两次输入的新密码不一致');delete values.confirm_password;}
  if(type==='upload') {const file=values.file;if(!file||!file.size)throw new Error('请选择非空文件');if(file.size>5*1024*1024)throw new Error('文件超过 5 MB，请压缩后重新上传');values.filename=file.name;values.file_base64=await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(String(reader.result).split(',')[1]);reader.onerror=()=>reject(new Error('读取文件失败'));reader.readAsDataURL(file);});delete values.file;}
  const result=await api(routes[type],values);modal.close();
  if(type==='password'){view.data=null;render();}else{if(type==='login')view.page='overview';await refresh();}
  toast(result.message||'操作成功');
 }catch(error){errorBox.textContent=error.message;submit.textContent=submitLabel;submit.disabled=false;}
});
modal.addEventListener('click',event=>{if(event.target===modal){const r=modal.getBoundingClientRect();if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)modal.close();}});
refresh().catch(error=>{if(!view.data)renderLogin();if(error.message!=='请先登录')toast(error.message,true);});
