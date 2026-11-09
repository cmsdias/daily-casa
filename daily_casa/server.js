'use strict';
const http=require('node:http');
const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
const {URL}=require('node:url');
const {createBackups}=require('./lib/backups');
const {createHa}=require('./lib/ha');
const {createNotifications}=require('./lib/notifications');
const {createEquipment}=require('./lib/equipment');
const {createIncidents}=require('./lib/incidents');
const CORE=require('./public/house-core.js');
const SEASONAL=require('./public/seasonal-defaults.js');
const FIN=require('./public/finance-core.js');
const {createQuotes}=require('./lib/quotes');const QUOTES=createQuotes();
const UNITS=require('./public/shopping-units.js');
function cleanUnit(v){const u=cleanStr(v,20);if(!u)return '';if(!UNITS.KEYS.includes(u))throw Error('Unidade inválida.');return u;}
// Quantidade: número (vírgula decimal, ex.: «0,5») ou, por compatibilidade, texto livre das versões anteriores.
function cleanQty(v){const raw=cleanStr(v,50);if(!raw)return '1';const n=raw.replace(',','.');return /^\d{1,5}(\.\d{1,3})?$/.test(n)?n.replace('.',','):raw;}
const APP_VERSION=require('./package.json').version;
const BOOT=crypto.randomBytes(3).toString('hex');let revCounter=0;const rev=()=>`${BOOT}-${revCounter}`;let ha=null;
const ROOT=__dirname, WEB=path.join(ROOT,'public');
const DATA_DIR=process.env.DATA_DIR||path.join(ROOT,'data');
const DB_FILE=path.join(DATA_DIR,'casa.json');
const PORT=+(process.env.PORT||3000);
const HOST=process.env.HOST||'0.0.0.0';
fs.mkdirSync(DATA_DIR,{recursive:true});
const PHOTO_DIR=path.join(DATA_DIR,'photos');fs.mkdirSync(PHOTO_DIR,{recursive:true});
let db;let rawDb=null;
if (fs.existsSync(DB_FILE)) {
  try{rawDb=fs.readFileSync(DB_FILE,'utf8');db=JSON.parse(rawDb);}
  catch(e){console.error(`ERRO: não foi possível ler ${DB_FILE} (${e.message}). Os dados não foram alterados; restaura uma cópia de segurança.`);process.exit(1);}
}
else {
  const s=JSON.parse(fs.readFileSync(path.join(ROOT,'seed.json'),'utf8'));
  db={version:1,secret:crypto.randomBytes(32).toString('hex'),people:[],tasks:s.tasks.map(t=>({...t,id:crypto.randomUUID()})),history:[],settings:{rooms:['Cozinha','Lavandaria','Sala','Escritório','WC completo','WC serviço','WC suite','Exterior','Organização geral'],categories:['Manutenção','Arrumação','Limpeza','Compras','Obras','Geral']}};
}

// Migração conservadora e compatível com cópias de segurança anteriores (também usada ao restaurar uma cópia).
// Categorias sempre por ordem alfabética (português, sem distinguir maiúsculas nem acentos).
const sortPt=a=>[...a].sort((x,y)=>x.localeCompare(y,'pt',{sensitivity:'base'}));
function migrate(){
 if(db.settings&&Array.isArray(db.settings.categories))db.settings.categories=sortPt(db.settings.categories);
 if(typeof db.secret!=='string'||db.secret.length<32)db.secret=crypto.randomBytes(32).toString('hex');
 for(const k of ['people','tasks','history','shopping','workLogs','audit'])db[k]=Array.isArray(db[k])?db[k]:[];
 for(const p of db.people){if(p.role==='member')p.role='resident';}
 const originalAdmin=db.people.find(p=>p.role==='admin')?.id||null;
 for(const t of db.tasks){if(!t.createdBy)t.createdBy=originalAdmin;if(!t.visibility)t.visibility='shared';}
 db.finance=db.finance&&typeof db.finance==='object'?db.finance:{accounts:[],transactions:[],budgets:[],goals:[]};
 for(const key of ['accounts','transactions','budgets','goals'])if(!Array.isArray(db.finance[key]))db.finance[key]=[];
 FIN.migrate(db.finance);
 // 1.7: calendário sazonal, frequência das compras e integração com o Home Assistant.
 if(!Array.isArray(db.seasonal))db.seasonal=SEASONAL.DEFAULTS.map(x=>({id:'s-'+x.key,...x,active:true}));
 if(!db.shoppingFreq||typeof db.shoppingFreq!=='object'||Array.isArray(db.shoppingFreq))db.shoppingFreq={};
 db.ha=db.ha&&typeof db.ha==='object'?db.ha:{};
 db.ha.notify=db.ha.notify&&typeof db.ha.notify==='object'?db.ha.notify:{};
 db.ha.events={assigned:true,daily:true,...(db.ha.events||{})};
 if(!/^\d{2}:\d{2}$/.test(db.ha.dailyTime||''))db.ha.dailyTime='08:30';
 db.ha.sensors=!!db.ha.sensors;
 if(typeof db.ha.token!=='string'||db.ha.token.length<32)db.ha.token=crypto.randomBytes(24).toString('base64url');
 // 2.0: equipamentos e documentos; assistente de início (as casas que já têm pessoas não o voltam a ver).
 if(!Array.isArray(db.equipment))db.equipment=[];
 if(!Array.isArray(db.incidents))db.incidents=[];
 if(db.settings&&typeof db.settings==='object'&&db.settings.onboarded===undefined)db.settings.onboarded=db.people.length>0;
 db.appVersion=APP_VERSION;
}
// Antes de migrar dados de outra versão, guarda uma cópia do ficheiro tal como estava.
const dateInTz=d=>new Intl.DateTimeFormat('en-CA',{timeZone:process.env.TZ||'Europe/Lisbon',year:'numeric',month:'2-digit',day:'2-digit'}).format(d);
const backups=createBackups({dataDir:DATA_DIR,getDb:()=>db,dateInTz});
if(rawDb&&db.appVersion!==APP_VERSION){try{backups.create('upgrade',rawDb);}catch(e){console.error('Não foi possível guardar a cópia anterior à atualização:',e.message);}}
rawDb=null;
migrate();save();
// 3.1 · Acesso pela Internet: proxy de confiança, limites de tentativas e email (Gmail) para recuperar a palavra-passe.
const {createNet}=require('./lib/net');const {createLimiter,waitText}=require('./lib/ratelimit');const MAIL=require('./lib/mailer');
function addonOptions(){try{return JSON.parse(fs.readFileSync(path.join(DATA_DIR,'options.json'),'utf8'))||{};}catch{return {};}}
const NET=createNet({trusted:(process.env.TRUSTED_PROXIES||'172.30.33.0/24').split(',')});
const MAILER=MAIL.createMailer({getOptions:()=>({...addonOptions(),...(process.env.SMTP_USER?{email_remetente:process.env.SMTP_USER,email_palavra_passe:process.env.SMTP_PASS}:{})}),host:process.env.SMTP_HOST||'smtp.gmail.com',port:+(process.env.SMTP_PORT||465),secure:process.env.SMTP_SECURE!=='0'});
// Por IP: 10 falhas em 15 min bloqueiam 15 min (a duplicar a cada reincidência, até 24 h). Por conta: 20 falhas numa hora, de qualquer IP, bloqueiam 30 min.
// Recuperação: 5 pedidos em 15 min por IP e por email.
const LIM={ip:createLimiter({max:10,windowMs:15*60_000,blockMs:15*60_000,progressive:true}),account:createLimiter({max:20,windowMs:60*60_000,blockMs:30*60_000}),reset:createLimiter({max:5,windowMs:15*60_000,blockMs:30*60_000})};
function tooMany(res,st){return send(res,429,{error:`Demasiadas tentativas. Tenta novamente dentro de ${waitText(st.retryAfter)}.`},{'Retry-After':String(st.retryAfter)});}
const alertSent=new Map();
function securityAlert(key,title,body){const t=Date.now();if(t-(alertSent.get(key)||0)<30*60_000)return;alertSent.set(key,t);
 for(const a of db.people.filter(x=>roleOf(x)==='admin'&&isActive(x)))notif.add(a.id,'security',title,body,{page:'settings',section:'security'});save();}
let notesCache=null;
function releaseNotes(){if(notesCache)return notesCache;let title='',items=[];
 try{const md=fs.readFileSync(path.join(ROOT,'CHANGELOG.md'),'utf8');const sec=md.split(/^# /m).find(x=>x.trim());const lines=sec.split('\n');
  title=(lines[0].split('—')[1]||'').trim();
  items=lines.filter(l=>/^- /.test(l)).map(l=>{const b=l.match(/^- \*\*(.+?)\*\*/);let t=b?b[1]:l.slice(2);t=t.replace(/\*\*|`/g,'').replace(/[:.]\s*$/,'');if(!b)t=t.split(/[.;:](\s|$)/)[0];return t.length>110?t.slice(0,107)+'…':t;}).slice(0,5);}catch{}
 return notesCache={version:APP_VERSION,title,items};}
function publicUrl(){return db.settings?.publicUrl||db.settings?.publicUrlAuto||'';}
// 3.3 · Notificações push próprias da app: tudo o que chega ao sino chega também aos telemóveis subscritos.
const {createWebPush}=require('./lib/webpush');
const WEBPUSH=createWebPush({getDb:()=>db,save,newId:()=>id(),subject:()=>{const m=MAILER.status();return m.configured?'mailto:'+m.from:(publicUrl()||'mailto:daily-casa@localhost');},allowHttp:process.env.PUSH_ALLOW_HTTP==='1',onError:(...a)=>console.error(...a)});
const URGENT_TYPES=new Set(['security','incident']);
const NOTIF_TYPES=['assigned','rotation','done','due','approval','incident','equipment','birthday','season'];
const wantsPush=(userId,type)=>type==='security'||db.people.find(x=>x.id===userId)?.notifPrefs?.[type]!==false;
// 3.6 · Convites por email.
const INV=require('./lib/invites');const INVITES=INV.createInvites({getDb:()=>db,save,newId:()=>id()});
function inviteLink(req,token){const base=publicUrl()||NET.info(req).origin||('http://'+String(req.headers.host||'').split(',')[0].trim());return `${base.replace(/\/+$/,'')}/?convite=${token}`;}
function uniqueUsername(email,name){const base=usernameFrom(email,name);let u=base,n=2;while(db.people.some(p=>p.username===u))u=(base.slice(0,36)+n++);return u;}
const notif=createNotifications({getDb:()=>db,save,newId:()=>id(),todayISO:()=>dateInTz(new Date()),canSeeTask:(u,t)=>canSeeTask(u,t),isActive:u=>isActive(u),roleOf:u=>roleOf(u),
 onAdd:n=>{if(!WEBPUSH.hasDevices(n.userId)||!wantsPush(n.userId,n.type))return;setImmediate(()=>WEBPUSH.sendToUser(n.userId,{title:n.title,body:n.body||'',tag:n.id,url:'./?n='+encodeURIComponent(n.id)},{urgency:URGENT_TYPES.has(n.type)?'high':'normal'}).catch(e=>console.error('Push:',e.message)));}});
const equip=createEquipment({getDb:()=>db,save,newId:()=>id(),todayISO:()=>dateInTz(new Date()),dataDir:DATA_DIR,roleOf:u=>roleOf(u),notify:(...a)=>notif.add(...a)});
const incid=createIncidents({getDb:()=>db,save,newId:()=>id(),photoDir:PHOTO_DIR,roleOf:u=>roleOf(u),notify:(...a)=>notif.add(...a),pushHa:(pid,title,msg)=>{Promise.resolve(ha?.notify(pid,title,msg,{tag:'casa-ocorrencia',type:'incident'})).catch(()=>{});},
  makeTask:(f,user)=>{const t={id:id(),title:'',room:'Geral',notes:'',kind:'project',priority:'P2',estimatedMinutes:null,category:'Manutenção',thisWeek:false,subtasks:[],status:'todo',repeat:'none',dueDate:'',assignedTo:null,suggested:false,createdAt:new Date().toISOString(),createdBy:user.id,visibility:'shared'};patchTask(t,f);db.tasks.push(t);logAction(user,'task.create',t.id);notif.taskAssigned(t,user);Promise.resolve(ha?.taskAssigned(t,user)).catch(()=>{});return t;}});
function roleOf(u){return u.role==='member'?'resident':u.role;}
const isActive=u=>u.active!==false;
// Dias de acesso de colaboradores (0 = domingo … 6 = sábado), no fuso horário da casa.
const HOUSE_TZ=process.env.TZ||'Europe/Lisbon';
const WEEKDAYS=['Domingo','Segunda','Terça','Quarta','Quinta','Sexta','Sábado'];
function todayWeekday(){const d=new Intl.DateTimeFormat('en-US',{timeZone:HOUSE_TZ,weekday:'short'}).format(new Date());return ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].indexOf(d);}
function scheduleAllows(u){if(roleOf(u)!=='collaborator'||!Array.isArray(u.accessDays)||!u.accessDays.length)return true;return u.accessDays.includes(todayWeekday());}
function scheduleText(u){return u.accessDays.slice().sort((a,b)=>((a+6)%7)-((b+6)%7)).map(d=>WEEKDAYS[d].toLowerCase()).join(', ');}
function elevated(u){return ['admin','manager'].includes(roleOf(u));}
function canSeeTask(u,t){if(t.visibility==='private')return t.createdBy===u.id;if(roleOf(u)==='admin')return true;if(roleOf(u)==='collaborator')return t.createdBy===u.id||t.assignedTo===u.id;return true;}
function canEditTask(u,t){if(t.visibility==='private')return t.createdBy===u.id;return roleOf(u)==='admin'||roleOf(u)==='manager'||t.createdBy===u.id;}
function canCompleteTask(u,t){return canEditTask(u,t)||t.assignedTo===u.id;}
// Regras da casa (Definições › A casa): pedidos de atribuição a colaboradores e aprovação do trabalho dos colaboradores.
const houseRules=()=>({residentAssign:db.settings?.rules?.residentAssign!==false,reviewCollaborators:db.settings?.rules?.reviewCollaborators===true});
const needsReview=u=>roleOf(u)==='collaborator'&&houseRules().reviewCollaborators;
// Conclusão de uma tarefa (byId = quem a fez; pode ser diferente de quem aprova).
function completeTask(t,actor,byId){
  const time=new Date().toISOString();db.history.push({id:id(),taskId:t.id,title:t.title,kind:t.kind,assignedTo:t.assignedTo,by:byId,at:time});
  if(db.history.length>2000)db.history=db.history.slice(-2000);
  delete t.review;let rotated=false;if(t.kind==='routine'&&t.repeat!=='none'){t.status='todo';t.dueDate=nextDate(t.dueDate,t.repeat);t.suggested=false;rotated=rotate(t);}else t.status='done';
  if(t.status==='done'&&t.equipmentId)equip.onTaskCompleted(t,actor);
  if(t.status==='done')incid.onTaskCompleted(t,actor);
  const doer=db.people.find(p=>p.id===byId)||actor;
  t.updatedAt=time;logAction(actor,'task.complete',t.id);if(rotated)notif.taskRotated(t,doer);else if(t.status==='done')notif.taskCompleted(t,doer);
  return {rotated};
}
// Moradores podem pedir a atribuição de uma tarefa sua a um colaborador; fica pendente até um administrador ou gestor aprovar.
function assignRequest(u,t,target){
  if(roleOf(u)!=='resident'||!houseRules().residentAssign)throw Object.assign(Error('Sem permissão para atribuir tarefas.'),{status:403});
  const p=db.people.find(x=>x.id===target&&isActive(x));
  if(!p||roleOf(p)!=='collaborator')throw Object.assign(Error('Só podes atribuir tarefas a colaboradores (com aprovação) ou a ti.'),{status:403});
  if(t.visibility==='private')throw Object.assign(Error('Uma tarefa privada não pode ser atribuída a outra pessoa.'),{status:403});
  return {to:target,by:u.id,at:new Date().toISOString()};
}
function allowedTaskPatch(u,t,b){if(canEditTask(u,t))return true;
 return canCompleteTask(u,t)&&Object.keys(b).every(k=>['status','subtasks'].includes(k));}
function logAction(u,action,entityId){db.audit.push({id:id(),actor:u.id,action,entityId,at:new Date().toISOString()});if(db.audit.length>3000)db.audit=db.audit.slice(-3000);}
function visibleState(u){const allowed=db.tasks.filter(t=>canSeeTask(u,t));const ids=new Set(allowed.map(t=>t.id));const users=roleOf(u)==='collaborator'?db.people.filter(p=>p.id===u.id||allowed.some(t=>t.assignedTo===p.id||t.createdBy===p.id)):db.people;const people=users.map(p=>personView(u,p));return {...state(),people,tasks:allowed,history:db.history.filter(h=>h.taskId?ids.has(h.taskId):h.by===u.id).slice(-200),shopping:db.shopping,workLogs:db.workLogs.filter(l=>elevated(u)?(!l.taskId||ids.has(l.taskId)):l.userId===u.id||l.actor===u.id),audit:elevated(u)?db.audit.filter(a=>!a.action.startsWith('task.')||ids.has(a.entityId)).slice(-300):[],permissions:{manageUsers:roleOf(u)==='admin',manageSettings:elevated(u),manageAllShared:elevated(u)},notifications:notif.forUser(u),rev:rev(),seasonal:roleOf(u)==='collaborator'?[]:db.seasonal,shoppingFrequent:frequentShopping(),haAvailable:!!ha?.available(),equipment:equip.canView(u)?equip.view():[],incidents:incid.viewFor(u)};}
function frequentShopping(){return Object.values(db.shoppingFreq).sort((a,b)=>b.count-a.count||String(b.last).localeCompare(String(a.last))).slice(0,16).map(({title,category,quantity,unit})=>({title,category,quantity,unit:unit||''}));}


function financeAllowed(u){return elevated(u);}
function dateISO(v){if(typeof v!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(v)||new Date(v+'T12:00:00Z').toISOString().slice(0,10)!==v)throw Error('Data inválida.');return v;}

// Revisão: muda a cada gravação; os clientes comparam-na para saber se há alterações de outras pessoas.
function save(){const tmp=DB_FILE+'.tmp'; fs.writeFileSync(tmp,JSON.stringify(db,null,2),{mode:0o600});fs.renameSync(tmp,DB_FILE);revCounter++;ha?.changed();}
function send(res,status,data,extra={}){const body=JSON.stringify(data);res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff',...extra});res.end(body);}
function fail(res,status,msg){send(res,status,{error:msg});}
function id(){return crypto.randomUUID();}
function cleanStr(val,max=150){return String(val??'').trim().slice(0,max);}
function passwordHash(pw,salt=crypto.randomBytes(16).toString('hex')){return `${salt}:${crypto.scryptSync(pw,salt,64).toString('hex')}`;}
function verifyPw(pw,stored){const [salt,expected]=stored.split(':');const hash=passwordHash(pw,salt).split(':')[1]; return crypto.timingSafeEqual(Buffer.from(hash,'hex'),Buffer.from(expected,'hex'));}
const DUMMY_HASH=passwordHash('palavra-passe-inexistente','00000000000000000000000000000000');
const resetCodes=new Map();
// «Manter sessão iniciada»: 60 dias com o visto; sem ele, a sessão dura até fechar o browser (no máximo 12 horas).
const REMEMBER_MS=60*86400_000,SHORT_MS=12*3600_000;
function tokenRemember(req){try{const t=((req.headers.cookie||'').match(/(?:^|;\s*)casa_session=([^;]+)/)||[])[1];return JSON.parse(Buffer.from(t.split('.')[0],'base64url').toString()).r!==0;}catch{return true;}}
function session(user,remember=true){const payload=Buffer.from(JSON.stringify({id:user.id,v:user.authVersion||1,r:remember?1:0,exp:Date.now()+(remember?REMEMBER_MS:SHORT_MS)})).toString('base64url');const mac=crypto.createHmac('sha256',db.secret).update(payload).digest('base64url');return `${payload}.${mac}`;}
function readUser(req){const token=((req.headers.cookie||'').match(/(?:^|;\s*)casa_session=([^;]+)/)||[])[1];if(!token)return null;
try{const [payload,mac]=token.split('.');const sig=crypto.createHmac('sha256',db.secret).update(payload).digest('base64url');if(!mac||sig.length!==mac.length||!crypto.timingSafeEqual(Buffer.from(mac),Buffer.from(sig)))return null;const claim=JSON.parse(Buffer.from(payload,'base64url').toString());if(claim.exp<Date.now())return null;const u=db.people.find(x=>x.id===claim.id&&(x.authVersion||1)===claim.v);return u&&isActive(u)&&scheduleAllows(u)?u:null;}catch{return null;}}
function cookie(req,token,remember=true){const secure=NET.info(req).https?'; Secure':'';const age=!token?'; Max-Age=0':remember?`; Max-Age=${REMEMBER_MS/1000}`:'';return `casa_session=${token}; Path=/; HttpOnly; SameSite=Strict${age}${secure}`;}
async function parseBody(req,limit=256_000){let size=0;let chunks=[];for await(const c of req){size+=c.length;if(size>limit)throw new Error('Pedido demasiado grande.');chunks.push(c);}try{return JSON.parse(Buffer.concat(chunks).toString('utf8')||'{}');}catch{throw new Error('JSON inválido.');}}
// O que cada pessoa vê das outras: contactos (email, telefone) só para o próprio, administrador e gestores;
// a data de nascimento completa só para o próprio e o administrador (os restantes veem o dia e o mês, para os aniversários).
function personView(viewer,p){const self=viewer.id===p.id,admin=roleOf(viewer)==='admin',collab=roleOf(viewer)==='collaborator';
 return {id:p.id,name:p.name,username:collab&&!self?'':p.username,role:roleOf(p),avatar:p.avatar||'●',photo:p.photo||'',active:p.active!==false,
  ...(admin?{accessDays:Array.isArray(p.accessDays)?p.accessDays:[],mustChangePassword:!!p.mustChangePassword}:{}),
  ...(self||admin||elevated(viewer)?{email:p.email||'',phone:p.phone||''}:{}),
  ...(self?{notifPrefs:p.notifPrefs||{},pushOff:!!p.pushOff,pushReady:!!(db.ha?.notify?.[p.id]),webPush:!!db.push?.subs?.some(s=>s.userId===p.id)}:{}),
 ...(self||admin?{birthDate:p.birthDate||''}:(!collab&&p.birthDate?{birthday:p.birthDate.slice(5)}:{}))};}
function peopleFor(viewer){if(roleOf(viewer)!=='collaborator')return db.people.map(p=>personView(viewer,p));const allowed=db.tasks.filter(t=>canSeeTask(viewer,t));return db.people.filter(p=>p.id===viewer.id||allowed.some(t=>t.assignedTo===p.id||t.createdBy===p.id)).map(p=>personView(viewer,p));}
function cleanEmail(v){const e=cleanStr(v,120).toLowerCase();if(e&&!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(e))throw Error('Email inválido.');return e;}
function cleanPhone(v){const t=cleanStr(v,30);if(t&&!/^\+?[\d\s().-]{6,20}$/.test(t))throw Error('Telefone inválido: usa só números, espaços e o indicativo (ex.: +351 912 345 678).');return t;}
function cleanBirth(v){const d=cleanStr(v,10);if(!d)return '';dateISO(d);if(d<'1900-01-01'||d>new Date().toISOString().slice(0,10))throw Error('Data de nascimento inválida.');return d;}
function cleanUsername(v,exceptId){const u=cleanStr(v,40).toLowerCase();if(!/^[a-z0-9._-]{3,40}$/.test(u))throw Error('Nome de utilizador inválido: 3 a 40 caracteres, só letras minúsculas, números, ponto, hífen ou sublinhado.');if(db.people.some(p=>p.username===u&&p.id!==exceptId))throw Error('Esse nome de utilizador já existe.');return u;}
// Campos de perfil que podem ser alterados pelo próprio (PATCH /api/me) ou pelo administrador (PATCH /api/people/:id).
// Entrar com o email (2.2). O nome de utilizador passa a ser interno: gera-se a partir do email e continua a servir para @menções.
const findByLogin=v=>{const k=String(v||'').trim().toLowerCase();if(!k)return null;return db.people.find(x=>(x.email||'').toLowerCase()===k)||db.people.find(x=>x.username===k)||null;};
function uniqueEmail(email,exceptId){if(email&&db.people.some(p=>p.id!==exceptId&&(p.email||'').toLowerCase()===email))throw Object.assign(Error('Esse email já está associado a outra conta.'),{status:409});return email;}
function usernameFrom(email,name){let base=(String(email||'').split('@')[0]||String(name||'')).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9._-]/g,'').slice(0,30);if(base.length<3)base=(base+'casa').slice(0,6);let u=base,i=2;while(db.people.some(p=>p.username===u))u=base+(i++);return u;}
function applyProfile(target,b){
 if('name'in b){const name=cleanStr(b.name,80);if(name.length<2)throw Error('O nome deve ter pelo menos 2 caracteres.');target.name=name;}
 if('username'in b)target.username=cleanUsername(b.username,target.id);
 if('email'in b){const e=cleanEmail(b.email);if(!e&&target.email)throw Error('O email é usado para entrar: não pode ficar em branco.');target.email=uniqueEmail(e,target.id);}
 if('pushOff'in b)target.pushOff=b.pushOff===true;
 // 3.5 · Tipos de notificação que a pessoa quer receber no telemóvel (o sino mostra sempre tudo).
 if(b.notifPrefs&&typeof b.notifPrefs==='object'&&!Array.isArray(b.notifPrefs)){const prefs={...(target.notifPrefs||{})};for(const [k,v] of Object.entries(b.notifPrefs))if(NOTIF_TYPES.includes(k))prefs[k]=v!==false;target.notifPrefs=prefs;}
 if('phone'in b)target.phone=cleanPhone(b.phone);
 if('birthDate'in b)target.birthDate=cleanBirth(b.birthDate);
 if('photo'in b)target.photo=cleanPhoto(b.photo);}
function publicPeople(){return db.people.map(({id,name,username,role,avatar,photo,active,accessDays,mustChangePassword})=>({id,name,username,role:role==='member'?'resident':role,avatar:avatar||'●',photo:photo||'',active:active!==false,accessDays:Array.isArray(accessDays)?accessDays:[],mustChangePassword:!!mustChangePassword}));}
// Fotografia de perfil: imagem pequena (redimensionada no browser) guardada como data URL.
const PHOTO_MAX=200_000;
function cleanPhoto(v){if(v===null||v==='')return '';if(typeof v!=='string'||v.length>PHOTO_MAX||!/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/]+=*$/.test(v))throw Error('Fotografia inválida ou demasiado grande.');return v;}
function publicTasks(){return db.tasks;}
function state(){return {people:publicPeople(),tasks:publicTasks(),history:db.history.slice(-200),shopping:db.shopping,workLogs:db.workLogs,audit:db.audit.slice(-300),settings:db.settings||{rooms:[],categories:[]},publicUrl:publicUrl(),serverTime:new Date().toISOString()};}
function patchTask(t,b){
  if('title'in b){if(!cleanStr(b.title,180))throw Error('Introduz o nome da tarefa.');t.title=cleanStr(b.title,180);}
  if('room'in b)t.room=cleanStr(b.room,70);
  if('notes'in b)t.notes=cleanStr(b.notes,1500);
  if('category'in b)t.category=cleanStr(b.category,70);
  if('visibility'in b){if(!['shared','private'].includes(b.visibility))throw Error('Visibilidade inválida.');t.visibility=b.visibility;}
  if('thisWeek'in b){if(typeof b.thisWeek!=='boolean')throw Error('Plano semanal inválido.');t.thisWeek=b.thisWeek;}
  if('subtasks'in b){if(!Array.isArray(b.subtasks)||b.subtasks.length>40)throw Error('Subtarefas inválidas.');t.subtasks=b.subtasks.map((x,i)=>({id:cleanStr(x.id,80)||String(i),title:cleanStr(x.title,180),done:!!x.done})).filter(x=>x.title);}
  if('estimatedMinutes'in b){const n=b.estimatedMinutes;if(n===''||n===null||n===undefined)t.estimatedMinutes=null;else if(!Number.isInteger(Number(n))||Number(n)<0||Number(n)>10080)throw Error('Duração inválida.');else t.estimatedMinutes=Number(n);}
  if('priority'in b){if(!['P1','P2','P3','P4'].includes(b.priority))throw Error('Prioridade inválida.');t.priority=b.priority;}
  if('kind'in b){if(!['project','routine'].includes(b.kind))throw Error('Tipo inválido.');t.kind=b.kind;}
  if('status'in b){if(b.status==='review'&&t.status==='review'){}else if(!['todo','doing','waiting','done'].includes(b.status))throw Error('Estado inválido.');else{t.status=b.status;delete t.review;}}
  if('assignedTo'in b){delete t.unassignedFrom;if(b.assignedTo && !db.people.some(p=>p.id===b.assignedTo&&isActive(p)))throw Error('Responsável não existe ou está desativado.');t.assignedTo=b.assignedTo||null;}
  if('dueDate'in b){const d=cleanStr(b.dueDate,10);t.dueDate=d?dateISO(d):'';}
  if('repeat'in b){if(!['none','daily','weekly','biweekly','monthly','quarterly','yearly'].includes(b.repeat))throw Error('Periodicidade inválida.');t.repeat=b.repeat;}
  if('rotation'in b){if(!Array.isArray(b.rotation)||b.rotation.length>10||b.rotation.some(x=>typeof x!=='string'||!db.people.some(p=>p.id===x&&isActive(p))))throw Error('Rotação inválida: escolhe pessoas com conta ativa.');t.rotation=[...new Set(b.rotation)];}
  if('suggested'in b)t.suggested=!!b.suggested;
  t.updatedAt=new Date().toISOString();
}
function nextDate(iso,rep){const base=iso?new Date(iso+'T12:00:00Z'):new Date();if(!iso)base.setUTCHours(12,0,0,0);const now=new Date();const step=()=>{if(rep==='daily')base.setUTCDate(base.getUTCDate()+1);if(rep==='weekly')base.setUTCDate(base.getUTCDate()+7);if(rep==='biweekly')base.setUTCDate(base.getUTCDate()+14);if(rep==='monthly')base.setUTCMonth(base.getUTCMonth()+1);if(rep==='quarterly')base.setUTCMonth(base.getUTCMonth()+3);if(rep==='yearly')base.setUTCFullYear(base.getUTCFullYear()+1);};step();let safety=0;while(base<now && safety++<366)step();return base.toISOString().slice(0,10);}
// Rotação: ao concluir uma rotina, passa para a pessoa seguinte da lista (ignorando contas desativadas).
function rotate(t){if(!Array.isArray(t.rotation)||t.rotation.length<2)return false;const act=t.rotation.filter(id=>db.people.some(p=>p.id===id&&isActive(p)));if(!act.length)return false;const i=act.indexOf(t.assignedTo);const next=act[(i+1)%act.length];if(next===t.assignedTo)return false;t.assignedTo=next;return true;}
function cleanSeasonal(b,item={}){const out={...item};
 if(!item.id||'title'in b){const title=cleanStr(b.title,140);if(!title)throw Error('Indica o trabalho.');out.title=title;}
 if(!item.id||'months'in b){if(!Array.isArray(b.months)||!b.months.length||b.months.some(m=>!Number.isInteger(m)||m<1||m>12))throw Error('Escolhe pelo menos um mês.');out.months=[...new Set(b.months)].sort((x,y)=>x-y);}
 if('room'in b||!item.id)out.room=cleanStr(b.room,70)||'Geral';
 if('category'in b||!item.id)out.category=cleanStr(b.category,70)||'Manutenção';
 if('notes'in b||!item.id)out.notes=cleanStr(b.notes,500);
 if('minutes'in b||!item.id){const n=b.minutes;out.minutes=n===''||n==null?null:Number(n);if(out.minutes!==null&&(!Number.isInteger(out.minutes)||out.minutes<0||out.minutes>10080))throw Error('Duração inválida.');}
 if('active'in b){if(typeof b.active!=='boolean')throw Error('Estado inválido.');out.active=b.active;}else if(!item.id)out.active=true;
 return out;}
const lastDayOf=(y,m)=>new Date(Date.UTC(y,m,0)).toISOString().slice(0,10);
const PHOTO_ID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
function removePhotoFiles(t){for(const ph of t.photos||[]){if(PHOTO_ID.test(ph.id))try{fs.unlinkSync(path.join(PHOTO_DIR,ph.id+'.jpg'));}catch{}}}
function authIntegration(req){const h=String(req.headers.authorization||'');const m=/^Bearer\s+(.+)$/.exec(h);if(!m||!db.ha?.token)return false;const a=Buffer.from(m[1].trim()),b=Buffer.from(db.ha.token);return a.length===b.length&&crypto.timingSafeEqual(a,b);}
function trackShopping(item){const key=item.title.toLocaleLowerCase('pt-PT').trim();const prev=db.shoppingFreq[key]||{count:0};db.shoppingFreq[key]={title:item.title,category:item.category,quantity:item.quantity,unit:item.unit||'',count:prev.count+1,last:new Date().toISOString()};const keys=Object.keys(db.shoppingFreq);if(keys.length>300){keys.sort((a,b)=>String(db.shoppingFreq[a].last).localeCompare(String(db.shoppingFreq[b].last))).slice(0,keys.length-300).forEach(k=>delete db.shoppingFreq[k]);}}
// Desfaz uma contagem: produto apagado antes de ser comprado (engano) ou renomeado (erro de escrita).
function untrackShopping(title){const key=String(title||'').toLocaleLowerCase('pt-PT').trim();const f=db.shoppingFreq[key];if(!f)return;f.count=(f.count||1)-1;if(f.count<=0)delete db.shoppingFreq[key];}
function knownCategory(title){return db.shoppingFreq[String(title).toLocaleLowerCase('pt-PT').trim()]?.category||'';}
const TYPES={'.html':'text/html; charset=utf-8','.js':'application/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json; charset=utf-8','.webmanifest':'application/manifest+json; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.woff2':'font/woff2','.txt':'text/plain; charset=utf-8'};
function staticFile(req,res,pathname){let decoded;try{decoded=decodeURIComponent(pathname);}catch{return fail(res,400,'URL inválido.');}if(decoded.includes('\0'))return fail(res,400,'URL inválido.');const relative=pathname==='/'?'index.html':decoded.replace(/^\/+/, '');const file=path.resolve(WEB,relative);if(!file.startsWith(WEB+path.sep))return fail(res,403,'Acesso negado.');if(!fs.existsSync(file)||!fs.statSync(file).isFile())return fail(res,404,'Não encontrado.');const ext=path.extname(file);const contents=fs.readFileSync(file);res.writeHead(200,{'Content-Type':TYPES[ext]||'application/octet-stream','Content-Length':contents.length,'Cache-Control':['.html','.js','.css','.webmanifest'].includes(ext)?'no-cache, must-revalidate':'public, max-age=3600','X-Content-Type-Options':'nosniff','Content-Security-Policy':"default-src 'self'; connect-src 'self'; img-src 'self' data: blob:; font-src 'self'; style-src 'self' 'unsafe-inline'; script-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'self'"});res.end(contents);}
const server=http.createServer(async (req,res)=>{
  let url;try{url=new URL(req.url,'http://localhost');}catch{return fail(res,400,'URL inválido.');}
  const p=url.pathname;
  if(p==='/health'){return send(res,200,{ok:true});}
  {const o=NET.info(req).origin;if(o&&db.settings&&db.settings.publicUrlAuto!==o&&db.people.length){db.settings.publicUrlAuto=o;save();}}
  if(!p.startsWith('/api/')){if(req.method!=='GET')return fail(res,405,'Método não permitido.');return staticFile(req,res,p);}
  if(!['GET','POST','PATCH','DELETE'].includes(req.method))return fail(res,405,'Método não permitido.');
  if(req.method!=='GET'){
    // A custom header makes cross-origin browser writes require preflight; CORS is never enabled.
    // Avoid comparing Origin/Host: HA Ingress may legitimately rewrite the Host header.
    if(req.headers['x-casa-request']!=='1'&&!p.startsWith('/api/integracao/'))return fail(res,403,'Pedido não autorizado.');
  }
  const bodyLimit=p==='/api/backups/upload'?30_000_000:/^\/api\/incidents\/[^/]+\/photos$/.test(p)?3_000_000:/^\/api\/equipment\/[^/]+\/docs$/.test(p)?12_000_000:/^\/api\/tasks\/[^/]+\/photos$/.test(p)?3_000_000:256_000;
  let b={};if(req.method!=='GET')try{b=await parseBody(req,bodyLimit);}catch(e){return fail(res,400,e.message);}
  try{
    if(p==='/api/bootstrap'&&req.method==='GET')return send(res,200,{setup:db.people.length===0,publicUrl:publicUrl(),mail:MAILER.status().configured,user:(()=>{const u=readUser(req);return u?{id:u.id,name:u.name,role:u.role,mustChangePassword:!!u.mustChangePassword}:null;})()});
    if(p==='/api/setup'&&req.method==='POST'){
      if(db.people.length)return fail(res,409,'Aplicação já configurada.');
      const name=cleanStr(b.name,80),password=String(b.password||'');let email;try{email=cleanEmail(b.email);}catch(e){return fail(res,400,e.message);}
      const username=b.username?cleanStr(b.username,40).toLowerCase():usernameFrom(email,name);
      if(name.length<2||(!email&&!/^[a-z0-9._-]{3,40}$/.test(username))||!/^[a-z0-9._-]{3,40}$/.test(username)||password.length<10)return fail(res,400,'Nome, email e palavra-passe (mín. 10 caracteres) são obrigatórios.');
      const u={id:id(),name,username,email,role:'admin',avatar:'●',passwordHash:passwordHash(password),authVersion:1};db.people.push(u);save();return send(res,200,{user:{id:u.id,name:u.name,role:u.role}},{'Set-Cookie':cookie(req,session(u))});
    }
    if(p==='/api/login'&&req.method==='POST'){
      const username=cleanStr(b.email||b.username,120).toLowerCase();const ip=NET.info(req).client;
      let st=LIM.ip.status('login:'+ip);if(st.blocked)return tooMany(res,st);
      st=LIM.account.status(username);if(st.blocked)return tooMany(res,st);
      const u=findByLogin(username);
      // Verifica sempre uma palavra-passe (mesmo para utilizadores inexistentes) para não revelar contas pelo tempo de resposta.
      const ok=verifyPw(String(b.password||'').slice(0,200),u?u.passwordHash:DUMMY_HASH)&&!!u;
      if(!ok){
        const a=LIM.ip.fail('login:'+ip),c=LIM.account.fail(username);
        if(a.justBlocked)securityAlert('ip:'+ip,'Entrada bloqueada para um endereço',`${ip} errou a palavra-passe 10 vezes seguidas e ficou bloqueado durante ${waitText(a.retryAfter)}.`);
        if(c.justBlocked&&u)securityAlert('acct:'+u.id,`Conta de ${u.name.split(' ')[0]} bloqueada`,`Houve 20 tentativas falhadas numa hora. A conta fica bloqueada durante ${waitText(c.retryAfter)}; podes desbloquear em Definições › Acesso e segurança.`);
        if(a.blocked)return tooMany(res,a);if(c.blocked)return tooMany(res,c);
        return fail(res,401,'Email ou palavra-passe errados.');}
      if(!isActive(u))return fail(res,403,'Esta conta foi desativada. Fala com o administrador da casa.');
      if(!scheduleAllows(u))return fail(res,403,'O teu acesso está disponível apenas em: '+scheduleText(u)+'.');
      LIM.ip.success('login:'+ip);LIM.account.success(username);const remember=b.remember!==false&&b.remember!=='0'&&b.remember!=='off';return send(res,200,{user:{id:u.id,name:u.name,role:u.role,mustChangePassword:!!u.mustChangePassword}},{'Set-Cookie':cookie(req,session(u,remember),remember)});
    }
    if(p==='/api/logout'&&req.method==='POST')return send(res,200,{ok:true},{'Set-Cookie':cookie(req,'')});
    // Recuperar a palavra-passe: código de 6 dígitos enviado por email (se o envio estiver configurado nas opções do add-on)
    // e para a app Home Assistant do telemóvel (se estiver ligada); o administrador é avisado. A resposta é sempre a mesma e
    // os envios correm em segundo plano, para não revelar pelo tempo de resposta que emails existem.
    if(p==='/api/password/forgot'&&req.method==='POST'){
      const email=cleanStr(b.email,120).toLowerCase(),ip=NET.info(req).client;
      for(const k of ['ip:'+ip,'acct:'+email]){const st=LIM.reset.status(k);if(st.blocked)return tooMany(res,st);}
      LIM.reset.fail('ip:'+ip);LIM.reset.fail('acct:'+email);
      const u=findByLogin(email);
      if(u&&isActive(u)&&u.email){const code=String(crypto.randomInt(0,1e6)).padStart(6,'0');resetCodes.set(u.id,{hash:crypto.createHash('sha256').update(u.id+':'+code).digest('hex'),exp:Date.now()+15*60_000,tries:0});
        const mail=MAILER.status().configured,phone=!!db.ha?.notify?.[u.id];
        if(mail)MAILER.send({to:u.email,...MAIL.resetEmail({name:u.name,code,appUrl:publicUrl()})}).catch(e=>console.error('Email de recuperação:',e.message));
        Promise.resolve(ha?.notify(u.id,'Daily Casa · código de recuperação',`O teu código é ${code}. É válido durante 15 minutos. Se não pediste, ignora esta mensagem.`,{tag:'casa-reset'})).catch(()=>{});
        const via=[mail&&'por email',phone&&'no telemóvel'].filter(Boolean).join(' e ');
        for(const a of db.people.filter(x=>roleOf(x)==='admin'&&isActive(x)&&x.id!==u.id))notif.add(a.id,'security',`${u.name.split(' ')[0]} pediu para recuperar a palavra-passe`,via?`Recebeu um código ${via}.`:'Se for preciso, repõe-lhe a palavra-passe em Pessoas.',{page:'people'});
        logAction(u,'password.forgot',u.id);save();}
      return send(res,200,{ok:true});
    }
    if(p==='/api/password/reset'&&req.method==='POST'){
      const email=cleanStr(b.email,120).toLowerCase(),ip=NET.info(req).client;
      for(const k of ['ip:'+ip,'acct:'+email]){const st=LIM.reset.status(k);if(st.blocked)return tooMany(res,st);}
      const u=findByLogin(email);const rc=u&&resetCodes.get(u.id);
      const pw=String(b.password||'');if(pw.length<10)return fail(res,400,'A nova palavra-passe deve ter pelo menos 10 caracteres.');
      const ok=rc&&rc.exp>Date.now()&&rc.tries<5&&crypto.timingSafeEqual(Buffer.from(rc.hash),Buffer.from(crypto.createHash('sha256').update(u.id+':'+cleanStr(b.code,6)).digest('hex')));
      if(!ok){if(rc)rc.tries++;const a=LIM.reset.fail('ip:'+ip),c=LIM.reset.fail('acct:'+email);if(a.blocked)return tooMany(res,a);if(c.blocked)return tooMany(res,c);return fail(res,400,'Código inválido ou expirado. Pede um novo código.');}
      resetCodes.delete(u.id);u.passwordHash=passwordHash(pw);u.authVersion=(u.authVersion||1)+1;u.mustChangePassword=false;logAction(u,'password.reset',u.id);save();
      LIM.reset.success('acct:'+email);LIM.account.clear(email);
      if(!isActive(u))return fail(res,403,'Esta conta foi desativada. Fala com o administrador da casa.');
      return send(res,200,{user:{id:u.id,name:u.name,role:roleOf(u)}},{'Set-Cookie':cookie(req,session(u))});
    }
    // Aceitar um convite (sem sessão): ver os dados do convite e criar a conta.
    {const im=p.match(/^\/api\/invites\/([A-Za-z0-9_-]{40,64})(\/accept)?$/);if(im){
      const ip=NET.info(req).client;const st=LIM.reset.status('inv:'+ip);if(st.blocked)return tooMany(res,st);
      const x=INVITES.find(im[1]);if(!x){LIM.reset.fail('inv:'+ip);return fail(res,404,'Este convite já não é válido. Pede ao administrador para te enviar outro.');}
      const by=db.people.find(q=>q.id===x.createdBy);
      if(!im[2]&&req.method==='GET')return send(res,200,{email:x.email,name:x.name||'',roleLabel:INV.ROLES[x.role]||'Morador',invitedBy:by?by.name.split(' ')[0]:''});
      if(im[2]&&req.method==='POST'){
        const name=cleanStr(b.name,80),pw=String(b.password||'');
        if(name.length<2)return fail(res,400,'Indica o teu nome (pelo menos 2 letras).');if(pw.length<10)return fail(res,400,'A palavra-passe deve ter pelo menos 10 caracteres.');
        if(db.people.some(q=>(q.email||'').toLowerCase()===x.email)){INVITES.markAccepted(x,null);save();return fail(res,409,'Já existe uma conta com este email. Entra com ela ou usa «Esqueci-me da palavra-passe».');}
        const person={id:id(),name,username:uniqueUsername(x.email,name),email:x.email,passwordHash:passwordHash(pw),role:x.role,authVersion:1,avatar:'●',active:true};
        db.people.push(person);INVITES.markAccepted(x,person.id);logAction(person,'invite.accept',person.id);
        if(by&&isActive(by))notif.add(by.id,'security',`${name.split(' ')[0]} aceitou o convite`,`Já tem conta na Daily Casa (${INV.ROLES[x.role]||'Morador'}).`,{page:'people'});
        save();return send(res,201,{user:{id:person.id,name:person.name,role:person.role}},{'Set-Cookie':cookie(req,session(person,true),true)});
      }
      return fail(res,405,'Método não permitido.');}}
    // Entrada a partir de automações do Home Assistant (autenticação por token, sem cookies).
    if(p.startsWith('/api/integracao/')){
      {const ip=NET.info(req).client,st=LIM.ip.status('int:'+ip);if(st.blocked)return tooMany(res,st);
       if(!authIntegration(req)){const f=LIM.ip.fail('int:'+ip);if(f.blocked)return tooMany(res,f);return fail(res,401,'Token de integração inválido.');}}
      const robot=db.people.find(x=>roleOf(x)==='admin'&&isActive(x));if(!robot)return fail(res,409,'Sem administrador ativo.');
      const actor={id:robot.id,name:'Home Assistant'};
      if(p==='/api/integracao/tarefas'&&req.method==='POST'){
        const title=cleanStr(b.title,180);if(!title)return fail(res,400,'Indica o título da tarefa.');
        const open=db.tasks.find(t=>t.status!=='done'&&t.visibility!=='private'&&t.title.toLocaleLowerCase('pt-PT')===title.toLocaleLowerCase('pt-PT'));
        if(open)return send(res,200,{task:open,duplicate:true});
        const assignee=b.assignedTo?db.people.find(x=>x.username===String(b.assignedTo).toLowerCase()&&isActive(x)):null;
        const task={id:id(),title:'',room:'Geral',notes:'',kind:'project',priority:'P3',estimatedMinutes:null,category:'Geral',thisWeek:false,subtasks:[],status:'todo',repeat:'none',dueDate:'',assignedTo:null,suggested:false,createdAt:new Date().toISOString(),createdBy:robot.id,visibility:'shared',source:'home-assistant'};
        patchTask(task,{title,room:b.room||'Geral',notes:b.notes||'',priority:['P1','P2','P3','P4'].includes(b.priority)?b.priority:'P3',dueDate:b.dueDate||'',assignedTo:assignee?.id||null,category:b.category||'Geral'});
        db.tasks.push(task);logAction(robot,'task.create.ha',task.id);notif.taskAssigned(task,actor);save();ha?.taskAssigned(task,actor);return send(res,201,{task});
      }
      if(p==='/api/integracao/compras'&&req.method==='POST'){
        const title=cleanStr(b.title,180);if(!title)return fail(res,400,'Indica o produto.');
        const open=db.shopping.find(x=>!x.purchased&&x.title.toLocaleLowerCase('pt-PT')===title.toLocaleLowerCase('pt-PT'));if(open)return send(res,200,{item:open,duplicate:true});
        const item={id:id(),title,quantity:cleanQty(b.quantity),unit:cleanUnit(b.unit),category:cleanStr(b.category,70)||knownCategory(title)||'Geral',notes:'',purchased:false,createdBy:robot.id,createdAt:new Date().toISOString(),source:'home-assistant'};
        db.shopping.push(item);trackShopping(item);logAction(robot,'shopping.create.ha',item.id);save();return send(res,201,{item});
      }
      return fail(res,404,'Rota de integração não encontrada.');
    }
    const user=readUser(req);if(!user)return fail(res,401,'Inicia sessão para continuar.');
    // Notificações push neste dispositivo (3.3).
    if(p==='/api/push'&&req.method==='GET')return send(res,200,{publicKey:WEBPUSH.publicKey(),devices:WEBPUSH.devices(user.id).length});
    if(p==='/api/push/subscribe'&&req.method==='POST'){try{const n=WEBPUSH.subscribe(user.id,b.subscription,cleanStr(b.label,60));logAction(user,'push.subscribe',user.id);return send(res,200,{devices:n});}catch(e){return fail(res,e.status||400,e.message);}}
    if(p==='/api/push/unsubscribe'&&req.method==='POST')return send(res,200,{devices:WEBPUSH.unsubscribe(user.id,String(b.endpoint||''))});
    if(p==='/api/push/test'&&req.method==='POST'){const n=await WEBPUSH.sendToUser(user.id,{title:'Daily Casa',body:'As notificações estão a funcionar neste telemóvel.',tag:'push-test',url:'./'});return n?send(res,200,{sent:n}):fail(res,409,'Nenhum telemóvel recebeu a notificação. Volta a ligar o interruptor neste telemóvel.');}
    // Acesso e segurança (administrador): endereço externo, diagnóstico do proxy, email e bloqueios.
    if(p==='/api/security'||p.startsWith('/api/security/')){
      if(roleOf(user)!=='admin')return fail(res,403,'Apenas administradores.');
      const view=async()=>{const ni=NET.info(req);let hostname='';try{hostname=(await ha?.info())?.hostname||'';}catch{}
        return {net:{remote:ni.remote,client:ni.client,viaProxy:ni.viaProxy,https:ni.https,cloudflareHeaders:!!req.headers['cf-connecting-ip'],origin:ni.origin},hostname,
          publicUrl:publicUrl(),publicUrlAuto:db.settings?.publicUrlAuto||'',publicUrlManual:db.settings?.publicUrl||'',mail:MAILER.status(),
          blocked:[...LIM.ip.blocked().map(x=>({...x,kind:'ip'})),...LIM.account.blocked().map(x=>({...x,kind:'account'})),...LIM.reset.blocked().map(x=>({...x,kind:'reset'}))]};};
      if(p==='/api/security'&&req.method==='GET')return send(res,200,await view());
      if(p==='/api/security'&&req.method==='PATCH'){
        const v=cleanStr(b.publicUrl,200).replace(/\/+$/,'');
        if(v&&!/^https:\/\/[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+(?::\d{2,5})?$/i.test(v))return fail(res,400,'Indica um endereço completo começado por https://, por exemplo https://casa.exemplo.pt.');
        db.settings=db.settings||{rooms:[],categories:[]};if(v)db.settings.publicUrl=v.toLowerCase();else delete db.settings.publicUrl;logAction(user,'security.publicUrl',v||'auto');save();return send(res,200,await view());
      }
      if(p==='/api/security/mail-test'&&req.method==='POST'){
        if(!user.email)return fail(res,400,'Acrescenta primeiro o teu email no perfil.');
        try{await MAILER.send({to:user.email,...MAIL.testEmail({name:user.name,appUrl:publicUrl()})});}catch(e){return fail(res,e.code==='NOT_CONFIGURED'?409:502,e.message);}
        logAction(user,'security.mailTest',user.id);return send(res,200,{ok:true,to:user.email});
      }
      if(p==='/api/security/unblock'&&req.method==='POST'){LIM.ip.clear();LIM.account.clear();LIM.reset.clear();logAction(user,'security.unblock','all');save();return send(res,200,await view());}
      return fail(res,404,'Não encontrado.');
    }
    if(user.mustChangePassword&&!(p===`/api/people/${user.id}/password`&&req.method==='POST'))return fail(res,428,'Define uma nova palavra-passe para continuar.');
    if(p==='/api/rev'&&req.method==='GET')return send(res,200,{rev:rev(),version:APP_VERSION});
    // Novidades da versão instalada (primeira secção do CHANGELOG), para o aviso «Há uma nova versão».
    if(p==='/api/version'&&req.method==='GET')return send(res,200,releaseNotes());
    if(p==='/api/notifications/read'&&req.method==='POST'){const ids=b.ids==='all'?'all':Array.isArray(b.ids)?b.ids.filter(x=>typeof x==='string').slice(0,200):null;if(!ids)return fail(res,400,'Pedido inválido.');const n=notif.markRead(user,ids);if(n)save();return send(res,200,{notifications:notif.forUser(user)});}
    if(p==='/api/notifications/clear'&&req.method==='POST'){if(notif.clear(user))save();return send(res,200,{notifications:notif.forUser(user)});}
    // Fotografias das tarefas: ficheiros em DATA_DIR/photos, servidos só a quem pode ver a tarefa.
    const photoGet=p.match(/^\/api\/photos\/([^/]+)$/);
    if(photoGet&&req.method==='GET'){const pid=photoGet[1];if(!PHOTO_ID.test(pid))return fail(res,404,'Fotografia não encontrada.');const t=db.tasks.find(x=>(x.photos||[]).some(ph=>ph.id===pid));if(!t||!canSeeTask(user,t))return fail(res,404,'Fotografia não encontrada.');let buf;try{buf=fs.readFileSync(path.join(PHOTO_DIR,pid+'.jpg'));}catch{return fail(res,404,'Fotografia não encontrada.');}res.writeHead(200,{'Content-Type':'image/jpeg','Content-Length':buf.length,'Cache-Control':'private, max-age=604800, immutable','X-Content-Type-Options':'nosniff'});return res.end(buf);}
    const photoPost=p.match(/^\/api\/tasks\/([^/]+)\/photos(?:\/([^/]+))?$/);
    if(photoPost){const t=db.tasks.find(x=>x.id===photoPost[1]);if(!t||!canSeeTask(user,t))return fail(res,404,'Tarefa não encontrada.');
      if(!photoPost[2]&&req.method==='POST'){if(!canCompleteTask(user,t))return fail(res,403,'Sem permissão para acrescentar fotografias a esta tarefa.');if((t.photos||[]).length>=8)return fail(res,409,'Cada tarefa pode ter no máximo 8 fotografias.');
        const m=/^data:image\/jpeg;base64,([A-Za-z0-9+/]+=*)$/.exec(typeof b.data==='string'?b.data:'');if(!m)return fail(res,400,'Fotografia inválida.');const buf=Buffer.from(m[1],'base64');if(buf.length>2_200_000||buf[0]!==0xFF||buf[1]!==0xD8)return fail(res,400,'Fotografia inválida ou demasiado grande.');
        const pid=crypto.randomUUID();fs.writeFileSync(path.join(PHOTO_DIR,pid+'.jpg'),buf,{mode:0o600});t.photos=[...(t.photos||[]),{id:pid,by:user.id,at:new Date().toISOString(),caption:cleanStr(b.caption,140)}];t.updatedAt=new Date().toISOString();logAction(user,'task.photo.add',t.id);save();return send(res,201,{task:t});}
      if(photoPost[2]&&req.method==='DELETE'){const ph=(t.photos||[]).find(x=>x.id===photoPost[2]);if(!ph)return fail(res,404,'Fotografia não encontrada.');if(ph.by!==user.id&&!canEditTask(user,t))return fail(res,403,'Só quem a acrescentou pode remover esta fotografia.');removePhotoFiles({photos:[ph]});t.photos=t.photos.filter(x=>x.id!==ph.id);logAction(user,'task.photo.delete',t.id);save();return send(res,200,{task:t});}
      return fail(res,405,'Método não permitido.');}
    // Cópias de segurança (apenas administradores).
    if(p==='/api/backups'||p.startsWith('/api/backups/')){
      if(roleOf(user)!=='admin')return fail(res,403,'Apenas administradores.');
      if(p==='/api/backups'&&req.method==='GET')return send(res,200,{backups:backups.list(),current:backups.summaryOf(db)});
      if(p==='/api/backups'&&req.method==='POST'){const bk=backups.create('manual');logAction(user,'backup.create',bk.name);return send(res,201,{backup:bk,backups:backups.list()});}
      if(p==='/api/backups/upload'&&req.method==='POST'){const bk=backups.upload(b.data);logAction(user,'backup.upload',bk.name);return send(res,201,{backup:bk,summary:backups.summaryOf(b.data),backups:backups.list()});}
      const bm=p.match(/^\/api\/backups\/([^/]+?)(\/restore)?$/);
      if(bm&&!bm[2]&&req.method==='GET'){const buf=backups.read(bm[1]);res.writeHead(200,{'Content-Type':'application/json; charset=utf-8','Content-Length':buf.length,'Content-Disposition':`attachment; filename="${bm[1]}"`,'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});return res.end(buf);}
      if(bm&&bm[2]&&req.method==='POST'){const data=backups.load(bm[1]);backups.create('pre-restore');const secret=db.secret;db=data;db.secret=secret;migrate();logAction(user,'backup.restore',bm[1]);save();return send(res,200,{ok:true,summary:backups.summaryOf(db)});}
      return fail(res,404,'Rota não encontrada.');
    }
    // Calendário sazonal.
    if(p==='/api/seasonal'&&req.method==='POST'){if(!elevated(user))return fail(res,403,'Sem permissão para alterar o calendário.');const item={id:'s-'+id(),...cleanSeasonal(b)};db.seasonal.push(item);logAction(user,'seasonal.create',item.id);save();return send(res,201,{item,seasonal:db.seasonal});}
    const sm=p.match(/^\/api\/seasonal\/([^/]+?)(\/task)?$/);
    if(sm){const item=db.seasonal.find(x=>x.id===sm[1]);if(!item)return fail(res,404,'Trabalho sazonal não encontrado.');
      if(sm[2]&&req.method==='POST'){if(roleOf(user)==='collaborator')return fail(res,403,'Sem permissão.');const y=Number(b.year),m=Number(b.month);if(!Number.isInteger(y)||y<2020||y>2100||!Number.isInteger(m)||m<1||m>12)return fail(res,400,'Mês inválido.');const key=`${item.id}:${y}-${String(m).padStart(2,'0')}`;
        const existing=db.tasks.find(t=>t.seasonalKey===key);if(existing&&canSeeTask(user,existing))return fail(res,409,'Este trabalho já foi criado como tarefa para este mês.');
        const task={id:id(),title:'',room:'Geral',notes:'',kind:'project',priority:'P3',estimatedMinutes:null,category:'Geral',thisWeek:false,subtasks:[],status:'todo',repeat:'none',dueDate:'',assignedTo:null,suggested:false,createdAt:new Date().toISOString(),createdBy:user.id,visibility:'shared',seasonalKey:key};
        patchTask(task,{title:item.title,room:item.room,category:item.category,notes:item.notes||'',estimatedMinutes:item.minutes??'',dueDate:lastDayOf(y,m)});db.tasks.push(task);logAction(user,'task.create',task.id);save();return send(res,201,{task});}
      if(!elevated(user))return fail(res,403,'Sem permissão para alterar o calendário.');
      if(!sm[2]&&req.method==='PATCH'){Object.assign(item,cleanSeasonal(b,item));logAction(user,'seasonal.update',item.id);save();return send(res,200,{item,seasonal:db.seasonal});}
      if(!sm[2]&&req.method==='DELETE'){db.seasonal=db.seasonal.filter(x=>x.id!==item.id);logAction(user,'seasonal.delete',item.id);save();return send(res,200,{seasonal:db.seasonal});}
      return fail(res,405,'Método não permitido.');}
    // Home Assistant: notificações e sensores (apenas administradores).
    if(p==='/api/ha'||p.startsWith('/api/ha/')){
      if(roleOf(user)!=='admin')return fail(res,403,'Apenas administradores.');
      if(p==='/api/ha'&&req.method==='GET'){const info=await ha.info();let services=[],servicesError='';if(info.available){try{services=await ha.notifyServices();}catch(e){servicesError=e.message;}}return send(res,200,{...info,services,servicesError,notify:db.ha.notify,events:db.ha.events,dailyTime:db.ha.dailyTime,sensors:db.ha.sensors,token:db.ha.token,sensorEntities:Object.keys(ha.sensorStates())});}
      if(p==='/api/ha'&&req.method==='PATCH'){
        if('notify'in b){if(!b.notify||typeof b.notify!=='object'||Array.isArray(b.notify))return fail(res,400,'Configuração inválida.');const out={};for(const [pid,svc] of Object.entries(b.notify)){if(!db.people.some(x=>x.id===pid))continue;if(svc&&!/^[a-z0-9_]{1,80}$/.test(svc))return fail(res,400,'Serviço de notificação inválido.');if(svc)out[pid]=svc;}db.ha.notify=out;}
        if('events'in b){if(!b.events||typeof b.events!=='object')return fail(res,400,'Configuração inválida.');for(const k of ['assigned','daily'])if(k in b.events)db.ha.events[k]=!!b.events[k];}
        if('dailyTime'in b){if(!/^([01]\d|2[0-3]):[0-5]\d$/.test(b.dailyTime))return fail(res,400,'Hora inválida.');db.ha.dailyTime=b.dailyTime;}
        if('sensors'in b){db.ha.sensors=!!b.sensors;}
        logAction(user,'ha.update','global');save();if(db.ha.sensors)ha.pushSensors(true).catch(()=>{});return send(res,200,{ok:true});}
      if(p==='/api/ha/test'&&req.method==='POST'){if(!db.ha.notify[b.personId])return fail(res,400,'Escolhe primeiro o telemóvel desta pessoa e guarda.');try{await ha.notify(b.personId,'Daily Casa','As notificações estão a funcionar.',{tag:'ha-test'});}catch(e){return fail(res,502,e.message);}return send(res,200,{ok:true});}
      if(p==='/api/ha/token'&&req.method==='POST'){db.ha.token=crypto.randomBytes(24).toString('base64url');logAction(user,'ha.token','global');save();return send(res,200,{token:db.ha.token});}
      return fail(res,404,'Rota não encontrada.');
    }
    // Finanças: só administradores e gestores. A lógica está em public/finance-core.js (partilhada com a demonstração).
    if(p==='/api/finance'||p.startsWith('/api/finance/')){
      if(!financeAllowed(user))return fail(res,403,'Sem acesso às finanças.');
      // Lançar as despesas fixas em falta antes de responder; só grava se algo mudou (uma leitura não deve mudar a revisão,
      // senão todos os dispositivos recarregariam sempre que alguém abre as Finanças).
      let changed=req.method!=='GET';try{if(FIN.generateRecurring(db.finance,dateInTz(new Date()),id))changed=true;}catch(e){console.error('Despesas fixas:',e.message);}
      // 3.8: atualizar a cotação de um item agora.
      const qm=p.match(/^\/api\/finance\/assets\/([^/]+)\/quote$/);
      if(qm&&req.method==='POST'){FIN.migrate(db.finance);const a=db.finance.assets.find(x=>x.id===qm[1]&&!x.archived&&FIN.canSeeAsset(user,x));if(!a)return fail(res,404,'Item não encontrado.');if(!a.symbol)return fail(res,400,'Este item não tem símbolo.');await refreshQuote(a);save();if(a.quote?.error)return fail(res,502,a.quote.error);return send(res,200,{finance:FIN.view(db.finance,user,dateInTz(new Date()))});}
      let out;try{out=FIN.handle(db.finance,user,req.method,p,b,{newId:id,today:()=>dateInTz(new Date()),isAdmin:roleOf(user)==='admin'});}catch(e){return fail(res,e.status||400,e.message);}
      // Item com símbolo criado ou alterado: vai logo buscar a cotação (o valor passa a vir dela).
      if(out?.asset?.symbol&&out.asset.shares>0&&['POST','PATCH'].includes(req.method)&&(req.method==='POST'||'symbol'in b||'shares'in b||!out.asset.quote)){await refreshQuote(out.asset);changed=true;}
      if(out===undefined)return fail(res,404,'Rota não encontrada.');
      if(req.method!=='GET')logAction(user,'finance.'+(p.split('/')[3]||'view')+'.'+req.method.toLowerCase(),'');
      if(changed)save();return send(res,req.method==='POST'?201:200,out);
    }
    // Ocorrências (lib/incidents.js).
    if(p==='/api/incidents'||p.startsWith('/api/incidents/')){
      let out;try{out=incid.handle(user,req.method,p,b);}catch(e){return fail(res,e.status||400,e.message);}
      if(out===undefined)return fail(res,404,'Rota não encontrada.');
      if(out.file){let buf;try{buf=fs.readFileSync(out.file.path);}catch{return fail(res,404,'Fotografia não encontrada.');}res.writeHead(200,{'Content-Type':out.file.mime,'Content-Length':buf.length,'Cache-Control':'private, max-age=604800, immutable','X-Content-Type-Options':'nosniff'});return res.end(buf);}
      if(req.method!=='GET')logAction(user,'incident.'+(p.split('/')[4]||'item')+'.'+req.method.toLowerCase(),p.split('/')[3]||'');
      return send(res,req.method==='POST'?201:200,out);
    }
    // Equipamentos e documentos da casa (lib/equipment.js).
    if(p==='/api/equipment'||p.startsWith('/api/equipment/')){
      let out;try{out=equip.handle(user,req.method,p,b);}catch(e){return fail(res,e.status||400,e.message);}
      if(out===undefined)return fail(res,404,'Rota não encontrada.');
      if(out.file){let buf;try{buf=fs.readFileSync(out.file.path);}catch{return fail(res,404,'Documento não encontrado.');}res.writeHead(200,{'Content-Type':out.file.mime,'Content-Length':buf.length,'Content-Disposition':`inline; filename*=UTF-8''${encodeURIComponent(out.file.name.replace(/[\\/]/g,'-'))}`,'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'});return res.end(buf);}
      if(req.method!=='GET')logAction(user,'equipment.'+(p.split('/')[4]||'item')+'.'+req.method.toLowerCase(),p.split('/')[3]||'');
      return send(res,req.method==='POST'?201:200,out);
    }
    // Assistente de início: pisos, divisões e rotinas sugeridas (só administrador).
    if(p==='/api/onboarding'&&req.method==='POST'){
      if(roleOf(user)!=='admin')return fail(res,403,'Só o administrador pode configurar a casa.');
      db.settings=db.settings||{rooms:[],categories:[]};const st=db.settings;
      if(b.skip===true){st.onboarded=true;save();return send(res,200,{settings:st});}
      const names=(a,max)=>{if(a===undefined)return [];if(!Array.isArray(a)||a.length>60)throw Error('Lista inválida.');return a;};
      let floors,rooms,routines;try{floors=names(b.floors).map(x=>cleanStr(x,40)).filter(Boolean);rooms=names(b.rooms).map(r=>({name:cleanStr(r?.name,70),floor:cleanStr(r?.floor,40)})).filter(r=>r.name);routines=names(b.routines);}catch(e){return fail(res,400,e.message);}
      st.floors=[...new Set([...(st.floors||[]),...floors])].slice(0,20);st.rooms=[...new Set([...(st.rooms||[]),...rooms.map(r=>r.name)])].slice(0,100);st.roomFloors=st.roomFloors||{};
      for(const r of rooms)if(r.floor&&st.floors.includes(r.floor)&&!st.roomFloors[r.name])st.roomFloors[r.name]=r.floor;
      let removed=0;if(b.removeExamples===true){const gone=db.tasks.filter(t=>t.suggested===true&&t.status!=='done');removed=gone.length;const ids=new Set(gone.map(t=>t.id));db.tasks=db.tasks.filter(t=>!ids.has(t.id));}
      const key=t=>(t.title+'|'+t.room).toLocaleLowerCase('pt-PT');const have=new Set(db.tasks.map(key));let created=0;
      for(const raw of routines){const t={id:id(),title:'',room:'Geral',notes:'',kind:'routine',priority:'P3',estimatedMinutes:null,category:'Limpeza',thisWeek:false,subtasks:[],status:'todo',repeat:'weekly',dueDate:'',assignedTo:null,suggested:false,createdAt:new Date().toISOString(),createdBy:user.id,visibility:'shared'};
        try{patchTask(t,{title:raw?.title,room:raw?.room,repeat:raw?.repeat||'weekly',estimatedMinutes:raw?.estimatedMinutes??null,category:raw?.category||'Limpeza',dueDate:raw?.dueDate||''});}catch{continue;}
        if(have.has(key(t)))continue;have.add(key(t));db.tasks.push(t);created++;if(created>=80)break;}
      st.onboarded=true;logAction(user,'onboarding',`${rooms.length}/${created}`);save();return send(res,200,{settings:st,created,removed});
    }
    if(p==='/api/state'&&req.method==='GET')return send(res,200,{...visibleState(user),user:{id:user.id,name:user.name,role:roleOf(user)}});
    if(p==='/api/export'&&req.method==='GET'){if(user.role!=='admin')return fail(res,403,'Apenas administradores.');const visible=new Set(db.tasks.filter(t=>canSeeTask(user,t)).map(t=>t.id));return send(res,200,{exportedAt:new Date().toISOString(),...state(),tasks:db.tasks.filter(t=>visible.has(t.id)),history:db.history.filter(h=>!h.taskId||visible.has(h.taskId)).slice(-200),audit:db.audit.filter(x=>!x.action.startsWith('task.')||visible.has(x.entityId)).slice(-300)},{'Content-Disposition':'attachment; filename="daily-casa-backup.json"'});}
    if(p==='/api/import'&&req.method==='POST'){
      if(user.role!=='admin')return fail(res,403,'Apenas administradores.');
      if(!Array.isArray(b.tasks)||b.tasks.length>500)return fail(res,400,'Ficheiro inválido ou demasiado grande (máximo 500 tarefas).');
      // Substituir: guarda uma cópia de segurança e apaga primeiro as tarefas atuais (e, se pedido, compras, registos de horas e histórico).
      let removed=0,backup=null;
      if(b.replace===true||b.replace?.tasks===true){
        backup=backups.create('pre-import').name;removed=db.tasks.length;db.tasks.forEach(removePhotoFiles);db.tasks=[];db.notifications=(db.notifications||[]).filter(n=>!n.link?.taskId);
        if(b.replace?.other===true){db.shopping=[];db.workLogs=[];db.history=[];}
        logAction(user,'tasks.replace',String(removed));
      }
      // Divisões e pisos do ficheiro (opcional): acrescentam-se às existentes.
      if(b.settings&&typeof b.settings==='object'){const st=db.settings=db.settings||{rooms:[],categories:[]};const list=(a,max)=>Array.isArray(a)?a.filter(x=>typeof x==='string').map(x=>cleanStr(x,max)).filter(Boolean).slice(0,100):[];
        st.floors=[...new Set([...(st.floors||[]),...list(b.settings.floors,40)])].slice(0,20);st.rooms=[...new Set([...(st.rooms||[]),...list(b.settings.rooms,70)])];st.categories=sortPt([...new Set([...(st.categories||[]),...list(b.settings.categories,70)])]);
        if(b.settings.roomFloors&&typeof b.settings.roomFloors==='object'){st.roomFloors=st.roomFloors||{};for(const [r,f] of Object.entries(b.settings.roomFloors))if(st.rooms.includes(r)&&st.floors.includes(f))st.roomFloors[r]=f;}}
      let imported=0,skipped=0;
      const key=t=>[t.title,t.room,t.kind].map(x=>String(x||'').trim().toLocaleLowerCase('pt-PT')).join('|');
      const existing=new Set(db.tasks.map(key));
      const staged=[];
      for(const raw of b.tasks){
        if(!raw||typeof raw!=='object'||!cleanStr(raw.title,180)){skipped++;continue;}
        const t={id:id(),title:'',room:'Geral',notes:'',kind:'project',priority:'P3',estimatedMinutes:null,category:'Geral',thisWeek:false,subtasks:[],status:'todo',repeat:'none',dueDate:'',assignedTo:null,suggested:false,createdAt:new Date().toISOString(),createdBy:user.id,visibility:'shared'};
        const allowed={};
        for(const field of ['title','room','notes','kind','priority','status','repeat','dueDate','suggested','estimatedMinutes','category','thisWeek','subtasks','visibility']){
          if(Object.prototype.hasOwnProperty.call(raw,field))allowed[field]=raw[field];
        }
        try{patchTask(t,allowed);}catch{skipped++;continue;}
        const k=key(t);
        if(existing.has(k)){skipped++;continue;}
        existing.add(k);staged.push(t);imported++;
      }
      db.tasks.push(...staged);logAction(user,'tasks.import',String(imported));save();return send(res,200,{imported,skipped,removed,backup});
    }
    if(p==='/api/settings'&&req.method==='PATCH'){
      if(!elevated(user))return fail(res,403,'Sem permissão para alterar definições.');
      const normalize=a=>{if(!Array.isArray(a)||a.length>100||a.some(x=>typeof x!=='string'))throw Error('Lista inválida.');return [...new Set(a.map(x=>cleanStr(x,70)).filter(Boolean))];};
      db.settings=db.settings||{rooms:[],categories:[]};
      const incoming={...db.settings};if('rooms'in b)incoming.rooms=normalize(b.rooms);if('categories'in b)incoming.categories=sortPt(normalize(b.categories));if('floors'in b){const f=normalize(b.floors);if(f.length>20)throw Error('No máximo 20 pisos.');incoming.floors=f.map(x=>cleanStr(x,40));}
      if('roomFloors'in b){if(!b.roomFloors||typeof b.roomFloors!=='object'||Array.isArray(b.roomFloors))throw Error('Pisos das divisões inválidos.');const rooms=new Set(incoming.rooms||[]),floors=new Set(incoming.floors||[]);incoming.roomFloors=Object.fromEntries(Object.entries(b.roomFloors).filter(([r,f])=>rooms.has(r)&&typeof f==='string'&&floors.has(f)));}
      else if(incoming.roomFloors){const rooms=new Set(incoming.rooms||[]),floors=new Set(incoming.floors||[]);incoming.roomFloors=Object.fromEntries(Object.entries(incoming.roomFloors).filter(([r,f])=>rooms.has(r)&&floors.has(f)));}if('rules'in b){if(!b.rules||typeof b.rules!=='object')return fail(res,400,'Regras inválidas.');incoming.rules={residentAssign:b.rules.residentAssign!==false,reviewCollaborators:b.rules.reviewCollaborators===true};if(!incoming.rules.reviewCollaborators)for(const t of db.tasks)if(t.status==='review'){t.status=t.review?.prev||'todo';delete t.review;}}db.settings=incoming;logAction(user,'settings.update','global');save();return send(res,200,{settings:db.settings});
    }
    if(p==='/api/tasks'&&req.method==='POST'){
      const task={id:id(),title:'',room:'Geral',notes:'',kind:'project',priority:'P3',estimatedMinutes:null,category:'Geral',thisWeek:false,subtasks:[],status:'todo',repeat:'none',dueDate:'',assignedTo:null,suggested:false,createdAt:new Date().toISOString(),createdBy:user.id,visibility:'shared'};patchTask(task,b);if(!elevated(user)&&task.assignedTo&&task.assignedTo!==user.id){try{task.assignRequest=assignRequest(user,task,task.assignedTo);}catch(e){return fail(res,e.status||403,e.message);}task.assignedTo=null;}if(!elevated(user)&&(task.rotation||[]).some(x=>x!==user.id))return fail(res,403,'Só gestores podem criar rotações entre pessoas.');if(roleOf(user)==='collaborator'&&task.visibility==='private')return fail(res,403,'Colaboradores não podem criar tarefas privadas.');if(task.visibility==='private'&&task.assignedTo&&task.assignedTo!==user.id)return fail(res,403,'Uma tarefa privada não pode ser atribuída a outra pessoa.');if(!task.title)return fail(res,400,'Introduz o nome da tarefa.');db.tasks.push(task);logAction(user,'task.create',task.id);notif.taskAssigned(task,user);if(task.assignRequest)notif.assignRequested(task,user);save();ha?.taskAssigned(task,user);return send(res,201,{task});
    }
    // Limpar as tarefas pontuais concluídas (só administrador; as rotinas nunca são apagadas; o histórico de conclusões mantém-se).
    if(p==='/api/tasks/clear-done'&&req.method==='POST'){if(roleOf(user)!=='admin')return fail(res,403,'Só um administrador pode eliminar tarefas.');const gone=db.tasks.filter(t=>t.kind==='project'&&t.status==='done'&&canSeeTask(user,t));gone.forEach(removePhotoFiles);const ids=new Set(gone.map(t=>t.id));db.tasks=db.tasks.filter(t=>!ids.has(t.id));logAction(user,'tasks.clear-done',String(gone.length));save();return send(res,200,{removed:gone.length});}
    // Aprovar ou devolver o trabalho de um colaborador (administrador/gestor).
    const rvw=p.match(/^\/api\/tasks\/([^/]+)\/review$/);
    if(rvw&&req.method==='POST'){const t=db.tasks.find(x=>x.id===rvw[1]);if(!t||!canSeeTask(user,t)||t.status!=='review'||!t.review)return fail(res,404,'Não há trabalho por aprovar nesta tarefa.');if(!elevated(user))return fail(res,403,'Só o administrador ou o gestor podem aprovar.');
      const rv=t.review;const approve=b.approve===true;const note=cleanStr(b.note,300);let out={rotated:false};
      if(approve)out=completeTask(t,user,rv.by);else{t.status=rv.prev||'todo';delete t.review;t.updatedAt=new Date().toISOString();logAction(user,'task.review.reject',t.id);}
      notif.reviewDecided(t,user,rv,approve,note);save();if(out.rotated)ha?.taskAssigned(t,user);return send(res,200,{task:t});}
    // Aprovar ou recusar um pedido de atribuição (administrador/gestor); quem pediu também o pode retirar.
    const arq=p.match(/^\/api\/tasks\/([^/]+)\/assign-request$/);
    if(arq&&req.method==='POST'){const t=db.tasks.find(x=>x.id===arq[1]);if(!t||!canSeeTask(user,t)||!t.assignRequest)return fail(res,404,'Não há pedido de atribuição para esta tarefa.');const rq=t.assignRequest;const approve=b.approve===true;
      if(!elevated(user)&&!(rq.by===user.id&&!approve))return fail(res,403,'Só o administrador ou o gestor podem aprovar.');
      delete t.assignRequest;t.updatedAt=new Date().toISOString();
      if(approve){const p=db.people.find(x=>x.id===rq.to&&isActive(x));if(!p)return fail(res,400,'Esta pessoa já não tem conta ativa.');t.assignedTo=rq.to;notif.taskAssigned(t,user);}
      if(rq.by!==user.id)notif.assignDecided(t,user,rq,approve);
      logAction(user,approve?'task.assign.approve':'task.assign.reject',t.id);save();if(approve)ha?.taskAssigned(t,user);return send(res,200,{task:t});}
    const match=p.match(/^\/api\/tasks\/([^/]+)(\/complete)?$/);
    if(match){const t=db.tasks.find(x=>x.id===match[1]);if(!t||!canSeeTask(user,t))return fail(res,404,'Tarefa não encontrada.');
      if(match[2]&&req.method==='POST'){
        if(!canCompleteTask(user,t))return fail(res,403,'Sem permissão para concluir esta tarefa.');
        if(t.status==='review')return fail(res,409,'Esta tarefa já está à espera de aprovação.');
        // Trabalho de colaborador com aprovação ativa: fica «A aguardar aprovação» até um administrador ou gestor confirmar.
        if(needsReview(user)){t.review={by:user.id,at:new Date().toISOString(),prev:t.status==='doing'?'doing':'todo'};t.status='review';t.updatedAt=t.review.at;logAction(user,'task.review.request',t.id);notif.reviewRequested(t,user);save();return send(res,200,{task:t,review:true});}
        const out=completeTask(t,user,user.id);save();if(out.rotated)ha?.taskAssigned(t,user);return send(res,200,{task:t,rotatedTo:out.rotated?t.assignedTo:null});
      }
      if(!match[2]&&req.method==='PATCH'){if(!allowedTaskPatch(user,t,b))return fail(res,403,'Sem permissão para alterar esta tarefa.');const updated={...t};patchTask(updated,b);if(!canEditTask(user,t)){if('status'in b && !['doing','done'].includes(b.status))return fail(res,403,'Só podes iniciar ou concluir esta tarefa.');if('subtasks'in b){if(!Array.isArray(b.subtasks)||b.subtasks.length!==(t.subtasks||[]).length||b.subtasks.some((v,i)=>v.title!==t.subtasks[i].title||v.id!==t.subtasks[i].id))return fail(res,403,'Só podes marcar subtarefas como concluídas.');}}if(needsReview(user)&&updated.status==='done'&&t.status!=='done'){if(t.status==='review')return fail(res,409,'Esta tarefa já está à espera de aprovação.');updated.status='review';updated.review={by:user.id,at:new Date().toISOString(),prev:t.status==='doing'?'doing':'todo'};}const reviewRequested=updated.status==='review'&&t.status!=='review';let requested=false;if(!elevated(user)&&('assignedTo'in b)&&updated.assignedTo!==t.assignedTo){if(!updated.assignedTo||updated.assignedTo===user.id||!canEditTask(user,t))return fail(res,403,'Sem permissão para atribuir tarefas.');try{updated.assignRequest=assignRequest(user,updated,updated.assignedTo);}catch(e){return fail(res,e.status||403,e.message);}updated.assignedTo=t.assignedTo;requested=true;}if(elevated(user)&&('assignedTo'in b))delete updated.assignRequest;if(!elevated(user)&&('rotation'in b)&&JSON.stringify(updated.rotation||[])!==JSON.stringify(t.rotation||[]))return fail(res,403,'Só gestores podem alterar a rotação.');const reassigned=updated.assignedTo&&updated.assignedTo!==t.assignedTo;if(updated.visibility==='private'&&updated.assignedTo&&updated.assignedTo!==updated.createdBy)return fail(res,403,'Uma tarefa privada não pode ser atribuída a outra pessoa.');if(roleOf(user)==='collaborator'&&updated.visibility==='private')return fail(res,403,'Colaboradores não podem criar tarefas privadas.');if(!('assignRequest'in updated))delete t.assignRequest;Object.assign(t,updated);logAction(user,'task.update',t.id);if(reassigned)notif.taskAssigned(t,user);if(requested)notif.assignRequested(t,user);if(reviewRequested)notif.reviewRequested(t,user);save();if(reassigned)ha?.taskAssigned(t,user);return send(res,200,{task:t});}
      if(!match[2]&&req.method==='DELETE'){if(roleOf(user)!=='admin')return fail(res,403,'Só um administrador pode eliminar tarefas.');removePhotoFiles(t);db.tasks=db.tasks.filter(x=>x.id!==t.id);logAction(user,'task.delete',t.id);save();return send(res,200,{ok:true});}
    }
    if(p==='/api/shopping'&&req.method==='POST'){
      const title=cleanStr(b.title,180);if(!title)return fail(res,400,'Indica o produto.');
      const item={id:id(),title,quantity:cleanQty(b.quantity),unit:cleanUnit(b.unit),category:cleanStr(b.category,70)||knownCategory(title)||'Geral',notes:cleanStr(b.notes,500),purchased:false,createdBy:user.id,createdAt:new Date().toISOString()};
      db.shopping.push(item);trackShopping(item);logAction(user,'shopping.create',item.id);save();return send(res,201,{item});
    }
    if(p==='/api/shopping/clear-purchased'&&req.method==='POST'){const n=db.shopping.filter(x=>x.purchased).length;db.shopping=db.shopping.filter(x=>!x.purchased);logAction(user,'shopping.clear',String(n));save();return send(res,200,{removed:n});}
    // Esquecer uma sugestão das compras habituais.
    if(p==='/api/shopping/frequent'&&req.method==='DELETE'){const key=String(b.title||'').toLocaleLowerCase('pt-PT').trim();if(!db.shoppingFreq[key])return fail(res,404,'Sugestão não encontrada.');delete db.shoppingFreq[key];logAction(user,'shopping.forget',key.slice(0,60));save();return send(res,200,{shoppingFrequent:frequentShopping()});}
    const shoppingMatch=p.match(/^\/api\/shopping\/([^/]+)$/);
    if(shoppingMatch){const item=db.shopping.find(x=>x.id===shoppingMatch[1]);if(!item)return fail(res,404,'Produto não encontrado.');
      if(req.method==='PATCH'){// Lista partilhada: todos podem marcar como comprado e acertar quantidade e unidade; o resto só quem criou ou gestores.
        if(!elevated(user)&&item.createdBy!==user.id&&Object.keys(b).some(k=>!['purchased','quantity','unit'].includes(k)))return fail(res,403,'Só podes marcar como comprado ou acertar a quantidade deste produto.');
        const updated={...item};if('title'in b){if(!cleanStr(b.title,180))return fail(res,400,'Nome inválido.');updated.title=cleanStr(b.title,180);}
        if('quantity'in b)updated.quantity=cleanQty(b.quantity);
        if('unit'in b)updated.unit=cleanUnit(b.unit);
        if('category'in b)updated.category=cleanStr(b.category,70);
        if('notes'in b)updated.notes=cleanStr(b.notes,500);
        if('purchased'in b){if(typeof b.purchased!=='boolean')return fail(res,400,'Estado inválido.');updated.purchased=b.purchased;}
        if(updated.title.toLocaleLowerCase('pt-PT')!==item.title.toLocaleLowerCase('pt-PT')){untrackShopping(item.title);trackShopping(updated);}
        updated.updatedAt=new Date().toISOString();Object.assign(item,updated);logAction(user,'shopping.update',item.id);save();return send(res,200,{item});
      }
      if(req.method==='DELETE'){if(!elevated(user)&&item.createdBy!==user.id)return fail(res,403,'Sem permissão para eliminar.');if(!item.purchased)untrackShopping(item.title);db.shopping=db.shopping.filter(x=>x.id!==item.id);logAction(user,'shopping.delete',item.id);save();return send(res,200,{ok:true});}
    }
    if(p==='/api/worklogs'&&req.method==='POST'){
      let date;try{date=dateISO(cleanStr(b.date,10));}catch{return fail(res,400,'Data inválida.');}
      const minutes=Number(b.minutes);if(!Number.isInteger(minutes)||minutes<1||minutes>1440)return fail(res,400,'Duração inválida.');
      const note=cleanStr(b.note,1000);if(!note)return fail(res,400,'Descreve o trabalho realizado.');
      const task=b.taskId?db.tasks.find(t=>t.id===b.taskId):null;if(b.taskId&&(!task||!canSeeTask(user,task)))return fail(res,404,'Tarefa não encontrada.');
      const userId=elevated(user)&&b.userId&&db.people.some(p=>p.id===b.userId)?b.userId:user.id;
      const entry={id:id(),taskId:task?.id||null,userId,actor:user.id,date,minutes,note,createdAt:new Date().toISOString()};
      db.workLogs.push(entry);logAction(user,'worklog.create',entry.id);save();return send(res,201,{entry});
    }
    const roleMatch=p.match(/^\/api\/people\/([^/]+)\/role$/);
    if(roleMatch&&req.method==='PATCH'){
      if(roleOf(user)!=='admin')return fail(res,403,'Apenas administradores podem alterar perfis.');
      const target=db.people.find(x=>x.id===roleMatch[1]);if(!target)return fail(res,404,'Pessoa não encontrada.');
      if(!['admin','manager','resident','collaborator'].includes(b.role))return fail(res,400,'Perfil inválido.');
      if(target.id===user.id&&b.role!=='admin')return fail(res,403,'Não podes retirar o teu próprio acesso de administrador.');if(target.role==='admin'&&b.role!=='admin'&&db.people.filter(x=>roleOf(x)==='admin').length===1)return fail(res,403,'É obrigatório manter um administrador.');
      target.role=b.role;target.authVersion=(target.authVersion||1)+1;logAction(user,'person.role',target.id);save();return send(res,200,{people:peopleFor(user)});
    }
    if(p==='/api/invites'||/^\/api\/invites\/[0-9a-f-]{36}(\/resend)?$/.test(p)){
      if(roleOf(user)!=='admin')return fail(res,403,'Apenas administradores.');
      const deliver=async(r)=>{const link=inviteLink(req,r.token);let mailed=false,mailError='';
        if(MAILER.status().configured){try{await MAILER.send({to:r.invite.email,...INV.inviteEmail({inviter:user.name,name:r.invite.name,roleLabel:r.invite.roleLabel,link})});mailed=true;}catch(e){mailError=e.message;}}
        return {invite:r.invite,link,mailed,mailError,invites:INVITES.pending()};};
      if(p==='/api/invites'&&req.method==='GET')return send(res,200,{invites:INVITES.pending(),mail:MAILER.status().configured});
      if(p==='/api/invites'&&req.method==='POST'){
        let email;try{email=cleanEmail(b.email);}catch(e){return fail(res,400,e.message);}if(!email)return fail(res,400,'Indica o email da pessoa.');
        if(db.people.some(q=>(q.email||'').toLowerCase()===email))return fail(res,409,'Já existe uma conta com esse email.');
        const r=INVITES.create({email,name:cleanStr(b.name,80),role:b.role,by:user.id});logAction(user,'invite.create',r.invite.id);save();
        return send(res,201,await deliver(r));
      }
      const iid=p.split('/')[3];
      if(p.endsWith('/resend')&&req.method==='POST'){const r=INVITES.resend(iid);if(!r)return fail(res,404,'Convite não encontrado.');logAction(user,'invite.resend',iid);return send(res,200,await deliver(r));}
      if(req.method==='DELETE'){if(!INVITES.cancel(iid))return fail(res,404,'Convite não encontrado.');logAction(user,'invite.cancel',iid);save();return send(res,200,{invites:INVITES.pending()});}
      return fail(res,405,'Método não permitido.');
    }
    if(p==='/api/people'&&req.method==='POST'){
      if(user.role!=='admin')return fail(res,403,'Apenas administradores.');
      const name=cleanStr(b.name,80),pw=String(b.password||'');let email;try{email=uniqueEmail(cleanEmail(b.email),null);}catch(e){return fail(res,e.status||400,e.message);}
      let username=b.username?cleanStr(b.username,40).toLowerCase():usernameFrom(email,name);
      if(name.length<2||!/^[a-z0-9._-]{3,40}$/.test(username)||pw.length<10||(!email&&!b.username))return fail(res,400,'Nome, email e palavra-passe temporária (mín. 10 caracteres) são obrigatórios.');
      if(db.people.some(p=>p.username===username))return fail(res,409,'Esse nome de utilizador já existe.');
      const person={id:id(),name,username,email,passwordHash:passwordHash(pw),role:['manager','resident','collaborator'].includes(b.role)?b.role:'resident',authVersion:1,avatar:'●',active:true,mustChangePassword:true};db.people.push(person);INVITES.cancelForEmail(email);logAction(user,'person.create',person.id);save();return send(res,201,{people:peopleFor(user)});
    }
    if(p==='/api/me'&&req.method==='PATCH'){
      const target=db.people.find(x=>x.id===user.id);const draft={...target};applyProfile(draft,b);Object.assign(target,draft);
      logAction(user,'person.profile',user.id);save();return send(res,200,{user:{id:target.id,name:target.name,role:roleOf(target)},people:peopleFor(user)});
    }
    // Administrador: editar nome, utilizador e contactos de outra pessoa.
    const personEdit=p.match(/^\/api\/people\/([^/]+)$/);
    if(personEdit&&req.method==='PATCH'){
      if(roleOf(user)!=='admin')return fail(res,403,'Apenas administradores.');
      const target=db.people.find(x=>x.id===personEdit[1]);if(!target)return fail(res,404,'Pessoa não encontrada.');
      const allowed={};for(const k of ['name','username','email','phone','birthDate','photo'])if(k in b)allowed[k]=b[k];
      const draft={...target};applyProfile(draft,allowed);Object.assign(target,draft);
      logAction(user,'person.edit',target.id);save();return send(res,200,{people:peopleFor(user)});
    }
    const statusMatch=p.match(/^\/api\/people\/([^/]+)\/status$/);
    if(statusMatch&&req.method==='PATCH'){
      if(roleOf(user)!=='admin')return fail(res,403,'Apenas administradores.');
      const target=db.people.find(x=>x.id===statusMatch[1]);if(!target)return fail(res,404,'Pessoa não encontrada.');
      if(typeof b.active!=='boolean')return fail(res,400,'Estado inválido.');
      if(target.id===user.id&&!b.active)return fail(res,403,'Não podes desativar a tua própria conta.');
      if(!b.active&&roleOf(target)==='admin'&&db.people.filter(x=>roleOf(x)==='admin'&&isActive(x)).length===1)return fail(res,403,'É obrigatório manter um administrador ativo.');
      target.active=b.active;target.authVersion=(target.authVersion||1)+1;
      // Ao desativar, as tarefas pendentes ficam por atribuir mas guardam a quem pertenciam; ao reativar, voltam a essa pessoa
      // (exceto as que entretanto foram atribuídas a outra pessoa).
      let affected=0;
      for(const t of db.tasks){
        if(!b.active&&t.assignedTo===target.id&&t.status!=='done'){t.assignedTo=null;t.unassignedFrom=target.id;affected++;}
        else if(b.active&&t.unassignedFrom===target.id){if(!t.assignedTo&&t.status!=='done'){t.assignedTo=target.id;affected++;}delete t.unassignedFrom;}
      }
      logAction(user,b.active?'person.activate':'person.deactivate',target.id);save();return send(res,200,{people:peopleFor(user),tasks:affected});
    }
    const scheduleMatch=p.match(/^\/api\/people\/([^/]+)\/schedule$/);
    if(scheduleMatch&&req.method==='PATCH'){
      if(roleOf(user)!=='admin')return fail(res,403,'Apenas administradores.');
      const target=db.people.find(x=>x.id===scheduleMatch[1]);if(!target)return fail(res,404,'Pessoa não encontrada.');
      if(!Array.isArray(b.accessDays)||b.accessDays.some(d=>!Number.isInteger(d)||d<0||d>6))return fail(res,400,'Dias inválidos.');
      target.accessDays=[...new Set(b.accessDays)].sort();target.authVersion=(target.authVersion||1)+1;
      logAction(user,'person.schedule',target.id);save();return send(res,200,{people:peopleFor(user)});
    }
    const personMatch=p.match(/^\/api\/people\/([^/]+)\/password$/);
    if(personMatch&&req.method==='POST'){
      if(user.role!=='admin'&&user.id!==personMatch[1])return fail(res,403,'Sem permissão.');const target=db.people.find(u=>u.id===personMatch[1]);if(!target)return fail(res,404,'Pessoa não encontrada.');
      if(String(b.password||'').length<10)return fail(res,400,'A nova palavra-passe deve ter pelo menos 10 caracteres.');
      if(target.id===user.id&&!verifyPw(String(b.currentPassword||'').slice(0,200),target.passwordHash))return fail(res,403,'A palavra-passe atual não está correta.');
      if(target.id===user.id&&String(b.password)===String(b.currentPassword||''))return fail(res,400,'A nova palavra-passe tem de ser diferente da atual.');
      target.passwordHash=passwordHash(b.password);target.authVersion=(target.authVersion||1)+1;target.mustChangePassword=target.id!==user.id;logAction(user,'person.password',target.id);save();
      return send(res,200,{ok:true},target.id===user.id?{'Set-Cookie':cookie(req,session(target,tokenRemember(req)),tokenRemember(req))}:{});
    }
    return fail(res,404,'Rota não encontrada.');
  }catch(e){console.error('Request error:',e);return fail(res,400,e.message||'Ocorreu um erro.');}
});
server.on('clientError',(err,socket)=>{if(socket.writable)socket.end('HTTP/1.1 400 Bad Request\r\n\r\n');});
// Um erro inesperado num pedido nunca deve derrubar o serviço (os dados são gravados de forma atómica a cada alteração).
process.on('unhandledRejection',e=>console.error('Rejeição não tratada:',e));
process.on('uncaughtException',e=>console.error('Exceção não tratada:',e));
// O Supervisor do Home Assistant para o add-on com SIGTERM; como PID 1 o Node ignoraria o sinal e a paragem demoraria ~10 s.
for(const sig of ['SIGTERM','SIGINT'])process.on(sig,()=>{console.log(`${sig} recebido, a terminar.`);server.close(()=>process.exit(0));setTimeout(()=>process.exit(0),3000).unref();});
// Cópia de segurança automática diária e integração com o Home Assistant (se disponível).
try{const bk=backups.autoTick();if(bk)console.log('Cópia de segurança automática:',bk.name);}catch(e){console.error('Cópia automática falhou:',e.message);}
// Os avisos diários (tarefas do dia, aniversários, calendário do mês) só saem a partir da hora do resumo diário (por omissão 08:30),
// para as notificações no telemóvel não chegarem de madrugada.
// Cotações: uma vez por dia, depois das 22:15 (fecho de Nova Iorque); se falhar, tenta de novo de hora a hora.
function quoteSlot(){const d=dateInTz(new Date());return hhmmNow()>='22:15'?d:FIN_addDays(d,-1);}
const FIN_addDays=(iso,n)=>new Date(Date.parse(iso+'T12:00:00Z')+n*86400000).toISOString().slice(0,10);
const hhmmNow=()=>new Intl.DateTimeFormat('en-GB',{timeZone:HOUSE_TZ,hour:'2-digit',minute:'2-digit',hour12:false}).format(new Date());
async function refreshQuote(a){await QUOTES.refreshAsset(a,{setValue:FIN.setValue,today:dateInTz(new Date())});if(a.quote&&!a.quote.error)a.quote.slot=quoteSlot();}
let quotesBusy=false;
async function quotesTick(){if(quotesBusy||process.env.QUOTES_OFF==='1')return;quotesBusy=true;try{const slot=quoteSlot();let n=0;
  for(const a of (db.finance?.assets||[])){if(a.archived||!a.symbol||!(a.shares>0))continue;const q=a.quote;
   const due=!q||q.slot!==slot;const retryOk=!q?.error||Date.now()-Date.parse(q.checkedAt||0)>3600_000;
   if(due&&retryOk){await refreshQuote(a);n++;}}
  if(n)save();}catch(e){console.error('Cotações:',e.message);}finally{quotesBusy=false;}}
function dailyHour(){if(process.env.DAILY_ANY_HOUR==='1')return true;const now=new Intl.DateTimeFormat('en-GB',{timeZone:process.env.TZ||'Europe/Lisbon',hour:'2-digit',minute:'2-digit',hour12:false}).format(new Date());return now>=(db.ha?.dailyTime||'08:30');}
setInterval(()=>{try{backups.autoTick();}catch(e){console.error('Cópia automática falhou:',e.message);}try{if(FIN.generateRecurring(db.finance,dateInTz(new Date()),id))save();}catch(e){console.error('Despesas fixas:',e.message);}try{if(dailyHour())notif.daily();}catch(e){console.error('Notificações diárias:',e.message);}try{equip.tick();}catch(e){console.error('Equipamentos:',e.message);}quotesTick();},30*60_000).unref();
setTimeout(quotesTick,20_000).unref();
try{equip.tick();}catch(e){console.error('Equipamentos:',e.message);}
try{if(dailyHour())notif.daily();}catch(e){console.error('Notificações diárias:',e.message);}
try{if(FIN.generateRecurring(db.finance,dateInTz(new Date()),id))save();}catch(e){console.error('Despesas fixas:',e.message);}
const hhmm=()=>new Intl.DateTimeFormat('en-GB',{timeZone:HOUSE_TZ,hour:'2-digit',minute:'2-digit',hour12:false}).format(new Date());
ha=createHa({getDb:()=>db,todayISO:()=>dateInTz(new Date()),nowHM:hhmm,save});ha.start();
server.listen(PORT,HOST,()=>console.log(`Daily Casa ${APP_VERSION} online: http://${HOST}:${PORT} • dados: ${DB_FILE}${ha.available()?' • Home Assistant ligado':''}`));
