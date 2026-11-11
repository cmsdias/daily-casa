// Finanças da casa (1.7): despesas grandes, despesas fixas, património, orçamento anual e objetivos.
// Lógica partilhada pelo servidor (require) e pela demonstração (window.CasaFinance), para se comportarem igual.
// Valores sempre em cêntimos (inteiros). Acesso: só administradores e gestores (verificado por quem chama).
(function(root){
'use strict';
const ASSET_TYPES={ordem:'Conta à ordem',deposito:'Depósito a prazo',poupanca:'Conta poupança',ppr:'PPR',acoes:'Ações',investimentos:'Fundos e investimentos',cripto:'Criptomoedas',cofre:'Dinheiro em cofre',imovel:'Imóvel',outro:'Outro',credito_habitacao:'Crédito habitação',credito:'Outro crédito'};
// Créditos (3.7): contam a abater ao património. O valor é o capital em dívida.
const LIABILITY_TYPES=['credito_habitacao','credito'];const isLiability=a=>LIABILITY_TYPES.includes(a?.type);
// Imposto sobre juros por omissão: 28% (taxa liberatória) nas contas e depósitos; 0% nos restantes (PPR, investimentos).
const DEFAULT_TAX={ordem:28,deposito:28,poupanca:28};
const ASSET_GROUPS=[{key:'ordem',label:'À ordem',types:['ordem'],color:'#E9E4D6'},{key:'poupanca',label:'Depósitos e poupança',types:['deposito','poupanca','ppr'],color:'#C9A568'},{key:'invest',label:'Investimentos',types:['acoes','investimentos','cripto'],color:'#6E8F7B'},{key:'imoveis',label:'Imóveis',types:['imovel'],color:'#8FA79A'},{key:'cofre',label:'Cofre e outros',types:['cofre','outro'],color:'#B9B2A2'},{key:'creditos',label:'Créditos',types:LIABILITY_TYPES,color:'#B5534A',liability:true}];
const EXPENSE_CATEGORIES=['Obras','Mobiliário','Equipamentos','Jardim','Reparações','Decoração','Outros'];
const FIXED_CATEGORIES=['Energia','Água','Gás','Comunicações','Seguros','Habitação','Impostos','Serviços','Outros'];
// 3.17: subscrições — despesas fixas com ficha própria (plano, quem paga e usa, período experimental, histórico de preço).
const SUB_GROUPS=['Música e vídeo','Casa inteligente','Armazenamento','Software','Jogos','Notícias e leitura','Desporto e saúde','Outras'];
const isoDate=v=>/^\d{4}-\d{2}-\d{2}$/.test(String(v||''))&&!Number.isNaN(Date.parse(v))?String(v):null;
function cleanSub(b,prev={}){const s={...prev};
  if('plan'in b)s.plan=str(b.plan,60);
  if('group'in b||!prev.group)s.group=SUB_GROUPS.includes(b.group)?b.group:(prev.group||'Outras');
  if('payerId'in b)s.payerId=str(b.payerId,40)||null;
  if('userIds'in b){if(!Array.isArray(b.userIds))throw err(400,'Pessoas inválidas.');s.userIds=[...new Set(b.userIds.map(x=>str(x,40)).filter(Boolean))].slice(0,12);}
  if('payMethod'in b)s.payMethod=str(b.payMethod,40);
  if('url'in b){const u=str(b.url,300);const httpOk=typeof process!=='undefined'&&process.env?.SITEICON_ALLOW_HTTP==='1';if(u&&!(httpOk?/^https?:\/\/[^\s/$.?#][^\s]*$/i:/^https:\/\/[^\s/$.?#][^\s]*$/i).test(u))throw err(400,'A ligação tem de começar por https://');s.url=u||'';}
  if('trialEnd'in b)s.trialEnd=b.trialEnd?isoDate(b.trialEnd):null;
  if('remindDays'in b||!('remindDays'in prev)){const d=b.remindDays==null?7:Number(b.remindDays);if(!Number.isInteger(d)||d<0||d>60)throw err(400,'Dias de aviso inválidos (0 a 60).');s.remindDays=d;}
  if('startDate'in b)s.startDate=b.startDate?isoDate(b.startDate):null;
  if('note'in b)s.note=str(b.note,500);
  if(!Array.isArray(s.priceHistory))s.priceHistory=[];
  return s;}
const LEGACY_TYPE={bank:'ordem',cash:'cofre',other:'outro'};

function err(status,msg){const e=new Error(msg);e.status=status;return e;}
function str(v,max){return String(v??'').trim().slice(0,max);}
function cents(v,{allowZero=false}={}){if(!Number.isSafeInteger(v)||v<(allowZero?0:1)||v>100_000_000_00)throw err(400,'Valor inválido.');return v;}
function dateISO(v){if(typeof v!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(v)||new Date(v+'T12:00:00Z').toISOString().slice(0,10)!==v)throw err(400,'Data inválida.');return v;}
const monthDays=(y,m)=>new Date(Date.UTC(y,m,0)).getUTCDate();

// Acrescenta as estruturas novas e converte as contas antigas em itens do património (uma única vez).
function migrate(fin){
  for(const k of ['accounts','transactions','budgets','goals','assets','recurring'])if(!Array.isArray(fin[k]))fin[k]=[];
  if(!fin.annualBudget||typeof fin.annualBudget!=='object'||Array.isArray(fin.annualBudget))fin.annualBudget={};
  if(!fin.v17){
    for(const a of fin.accounts){
      const id='a-'+a.id;if(fin.assets.some(x=>x.id===id))continue;
      const balance=fin.transactions.filter(t=>t.accountId===a.id).reduce((n,t)=>n+(t.kind==='income'?t.amountCents:-t.amountCents),0);
      fin.assets.push({id,name:a.name,type:LEGACY_TYPE[a.kind]||'outro',institution:'',valueCents:Math.max(0,balance),scope:a.scope==='shared'?'shared':'private',ownerId:a.ownerId,notes:'Criado a partir da conta da versão anterior.',history:[],updatedAt:a.createdAt||new Date().toISOString(),archived:!!a.archived});
    }
    for(const t of fin.transactions)if(t.accountId&&!t.assetId)t.assetId='a-'+t.accountId;
    for(const g of fin.goals)if(!Array.isArray(g.assetIds))g.assetIds=[];
    fin.v17=true;
  }
  return fin;
}
// Valor estimado hoje (3.7), a partir do último valor registado:
// · poupanças: juros diários à taxa anual (TANB) já líquidos de imposto, e as entregas programadas no dia indicado;
// · créditos: no dia da prestação soma-se o juro do mês (TAN/12) e abate-se a prestação.
// Devolve null quando não há taxa nem entregas (o valor é só o que se regista à mão).
const addDays=(iso,n)=>new Date(Date.parse(iso+'T12:00:00Z')+n*86400000).toISOString().slice(0,10);
// 3.11.2: as despesas «pagas de» uma conta descontam-se no valor estimado, desde o último valor registado
// (as de datas anteriores já estão nesse valor; no próprio dia, contam as registadas depois dele).
function projectAsset(a,todayISO,txs=[]){
  const rate=Number(a.ratePct)||0,contrib=Number(a.contribCents)||0;
  const h=(a.history||[]).filter(x=>x.date<=todayISO);const base=h.length?h[h.length-1]:{date:todayISO,valueCents:a.valueCents||0};
  const debt0=isLiability(a);
  const spentList=debt0?[]:(txs||[]).filter(t=>t.assetId===a.id&&t.kind==='expense'&&t.transactionDate<=todayISO&&(t.transactionDate>base.date||(t.transactionDate===base.date&&base.at&&t.createdAt>base.at)));
  if(!rate&&!contrib&&!spentList.length)return null;
  const spentOn={};let spentBase=0;for(const t of spentList){if(t.transactionDate===base.date)spentBase+=t.amountCents;else spentOn[t.transactionDate]=(spentOn[t.transactionDate]||0)+t.amountCents;}
  const tax=a.taxPct!=null?Number(a.taxPct):(DEFAULT_TAX[a.type]||0);const debt=isLiability(a);const day=Math.min(Math.max(Number(a.contribDay)||1,1),31);
  // Sem renovação automática, deixa de render no vencimento; com renovação, continua (juros capitalizados).
  const stop=a.maturityDate&&!debt&&!a.renewMonths&&a.maturityDate<todayISO?a.maturityDate:todayISO;
  let v=base.valueCents-spentBase,interest=0,contribs=0,d=base.date,guard=0;const lastSpent=Object.keys(spentOn).sort().pop()||'';
  while((d<stop||d<lastSpent)&&guard++<3700){d=addDays(d,1);if(spentOn[d])v-=spentOn[d];if(d>stop)continue;const [y,m,dd]=d.split('-').map(Number);const payDay=Math.min(day,monthDays(y,m))===dd;
    if(debt){if(payDay&&v>0){const i=v*rate/100/12;interest+=i;v=Math.max(0,v+i-contrib);contribs+=contrib;}}
    else{const i=v*rate/100/365*(1-tax/100);v+=i;interest+=i;if(payDay&&contrib){v+=contrib;contribs+=contrib;}}}
  return {valueCents:Math.round(v),interestCents:Math.round(interest),contribCents:contribs,spentCents:spentList.reduce((n,t)=>n+t.amountCents,0),spentCount:spentList.length,since:base.date,taxPct:tax};
}
// Próximo vencimento de um depósito que renova sozinho pelo mesmo prazo.
function nextMaturity(a,todayISO){if(!a.maturityDate)return '';if(!a.renewMonths)return a.maturityDate;let [y,m,d]=a.maturityDate.split('-').map(Number);const day=d;let iso=a.maturityDate,g=0;
  while(iso<todayISO&&g++<1200){m+=a.renewMonths;while(m>12){m-=12;y++;}iso=`${y}-${String(m).padStart(2,'0')}-${String(Math.min(day,monthDays(y,m))).padStart(2,'0')}`;}return iso;}
const currentValue=(a,todayISO,txs)=>{if(a.estimate)return a.estimate.valueCents;const p=projectAsset(a,todayISO,txs);return p?p.valueCents:a.valueCents;};
const signedValue=(a,todayISO)=>(isLiability(a)?-1:1)*currentValue(a,todayISO);
const canSeeAsset=(u,a)=>a.scope==='shared'||a.ownerId===u.id;
function canSeeExpense(fin,u,t){if(!t.assetId)return true;const a=fin.assets.find(x=>x.id===t.assetId);return !a||canSeeAsset(u,a);}

// Lança as despesas fixas em falta até hoje (no máximo 12 meses para trás).
const recurringMonths=r=>Array.isArray(r.months)&&r.months.length?r.months:null;
function generateRecurring(fin,todayISO,newId){
  const [ty,tm,td]=todayISO.split('-').map(Number);let created=0;
  for(const r of fin.recurring){
    if(r.active===false)continue;
    let [y,m]=(r.lastMonth||r.startMonth||todayISO.slice(0,7)).split('-').map(Number);
    if(r.lastMonth){m++;if(m>12){m=1;y++;}}
    let guard=0;
    while((y<ty||(y===ty&&m<=tm))&&guard++<12){
      const day=Math.min(r.dayOfMonth,monthDays(y,m));
      if(y===ty&&m===tm&&td<day)break;
      // Despesas anuais, semestrais, etc.: só nos meses escolhidos.
      if(recurringMonths(r)&&!recurringMonths(r).includes(m)){r.lastMonth=`${y}-${String(m).padStart(2,'0')}`;m++;if(m>12){m=1;y++;}continue;}
      const ym=`${y}-${String(m).padStart(2,'0')}`;
      if(!fin.transactions.some(t=>t.recurringId===r.id&&t.transactionDate.startsWith(ym))){
        fin.transactions.push({id:newId(),kind:'expense',amountCents:r.amountCents,transactionDate:`${ym}-${String(day).padStart(2,'0')}`,category:r.category,description:r.name,recurringId:r.id,assetId:r.assetId||null,createdBy:r.createdBy,createdAt:new Date().toISOString()});created++;
      }
      r.lastMonth=ym;m++;if(m>12){m=1;y++;}
    }
  }
  return created;
}

function view(fin,u,todayISO=new Date().toISOString().slice(0,10)){
  const assets=fin.assets.filter(a=>!a.archived&&canSeeAsset(u,a)).map(a=>{const est=projectAsset(a,todayISO,fin.transactions);const out=est?{...a,estimate:est}:{...a};if(a.renewMonths&&a.maturityDate)out.nextMaturity=nextMaturity(a,todayISO);return out;});
  const ids=new Set(assets.map(a=>a.id));
  const expenses=fin.transactions.filter(t=>t.kind==='expense'&&canSeeExpense(fin,u,t)).sort((a,b)=>b.transactionDate.localeCompare(a.transactionDate));
  const goals=fin.goals.map(g=>{const linked=(g.assetIds||[]).filter(id=>ids.has(id));const current=linked.length?assets.filter(a=>linked.includes(a.id)).reduce((n,a)=>n+signedValue(a,todayISO),0):(g.savedCents||0);return {...g,assetIds:linked,currentCents:current};});
  const recurring=fin.recurring.map(r=>({...r,assetId:r.assetId&&ids.has(r.assetId)?r.assetId:null}));
  return {assets,expenses,recurring,goals,annualBudget:fin.annualBudget,categories:{expense:EXPENSE_CATEGORIES,fixed:FIXED_CATEGORIES},assetTypes:ASSET_TYPES,assetGroups:ASSET_GROUPS};
}

function cleanAsset(b,a={}){const out={...a};
  if(!a.id||'name'in b){const n=str(b.name,100);if(!n)throw err(400,'Indica o nome.');out.name=n;}
  if(!a.id||'type'in b){if(!ASSET_TYPES[b.type])throw err(400,'Tipo inválido.');out.type=b.type;}
  if('institution'in b||!a.id)out.institution=str(b.institution,80);
  if('notes'in b||!a.id)out.notes=str(b.notes,500);
  if('scope'in b||!a.id){const s=b.scope||'private';if(!['private','shared'].includes(s))throw err(400,'Visibilidade inválida.');out.scope=s;}
  if('maturityDate'in b){out.maturityDate=b.maturityDate?dateISO(b.maturityDate):'';}
  if('ratePct'in b){if(b.ratePct===''||b.ratePct==null)out.ratePct=null;else{const r=Number(b.ratePct);if(!Number.isFinite(r)||r<-100||r>100)throw err(400,'Taxa inválida.');out.ratePct=Math.round(r*100)/100;}}
  if('contribCents'in b){if(b.contribCents==null||b.contribCents===0)out.contribCents=null;else out.contribCents=cents(b.contribCents);}
  if('contribDay'in b){if(b.contribDay==null||b.contribDay==='')out.contribDay=null;else{const d=Number(b.contribDay);if(!Number.isInteger(d)||d<1||d>31)throw err(400,'Dia inválido.');out.contribDay=d;}}
  // 3.8: cotação automática (ações, ETF, cripto): símbolo, quantidade e preço médio de compra por unidade (cêntimos).
  if('symbol'in b){const sy=str(b.symbol,20).toUpperCase();if(sy&&!/^[A-Z0-9][A-Z0-9.\-=^]{0,19}$/.test(sy))throw err(400,'Símbolo inválido. Usa o código da bolsa, por exemplo AAPL.');if(sy!==(a.symbol||'')){out.symbol=sy||null;out.quote=null;}}
  if('shares'in b){if(b.shares==null||b.shares==='')out.shares=null;else{const q=Number(b.shares);if(!Number.isFinite(q)||q<=0||q>1e9)throw err(400,'Quantidade inválida.');out.shares=Math.round(q*1e8)/1e8;}}
  if('costCents'in b){out.costCents=b.costCents==null||b.costCents===0?null:cents(b.costCents);}
  if('renewMonths'in b){if(b.renewMonths==null||b.renewMonths===''||b.renewMonths===0)out.renewMonths=null;else{const r=Number(b.renewMonths);if(!Number.isInteger(r)||r<1||r>120)throw err(400,'Prazo de renovação inválido.');out.renewMonths=r;}}
  if('taxPct'in b){if(b.taxPct===''||b.taxPct==null)out.taxPct=null;else{const t=Number(b.taxPct);if(!Number.isFinite(t)||t<0||t>100)throw err(400,'Imposto inválido.');out.taxPct=Math.round(t*100)/100;}}
  return out;}
function setValue(a,valueCents,today){cents(valueCents,{allowZero:true});a.history=(a.history||[]).filter(h=>h.date!==today);a.history.push({date:today,valueCents,at:new Date().toISOString()});a.history.sort((x,y)=>x.date.localeCompare(y.date));if(a.history.length>120)a.history=a.history.slice(-120);a.valueCents=valueCents;a.updatedAt=new Date().toISOString();}
function cleanRecurring(b,r={}){const out={...r};
  if(!r.id||'name'in b){const n=str(b.name,100);if(!n)throw err(400,'Indica a despesa.');out.name=n;}
  if(!r.id||'amountCents'in b)out.amountCents=cents(b.amountCents);
  if(!r.id||'dayOfMonth'in b){const d=Number(b.dayOfMonth);if(!Number.isInteger(d)||d<1||d>31)throw err(400,'Dia do mês inválido.');out.dayOfMonth=d;}
  if(!r.id||'category'in b)out.category=str(b.category,60)||'Outros';
  if('assetId'in b)out.assetId=b.assetId||null;
  if('months'in b){if(b.months==null)out.months=null;else{if(!Array.isArray(b.months)||b.months.some(m=>!Number.isInteger(m)||m<1||m>12))throw err(400,'Meses inválidos.');const ms=[...new Set(b.months)].sort((x,y)=>x-y);out.months=ms.length&&ms.length<12?ms:null;}}
  if('active'in b){if(typeof b.active!=='boolean')throw err(400,'Estado inválido.');out.active=b.active;}else if(!r.id)out.active=true;
  if(b.sub&&typeof b.sub==='object'){out.sub=cleanSub(b.sub,r.sub||{});out.category='Subscrições';}
  return out;}

// Rotas /api/finance/*: devolve os dados da resposta, ou undefined se a rota não existir.
function handle(fin,u,method,path,b,ctx){
  const {newId,today,isAdmin}=ctx;const now=()=>new Date().toISOString();
  const assetFor=(id,{own=false}={})=>{const a=fin.assets.find(x=>x.id===id&&!x.archived);if(!a||!canSeeAsset(u,a))throw err(404,'Item não encontrado.');if(own&&a.ownerId!==u.id&&!(a.scope==='shared'&&isAdmin))throw err(403,'Só quem criou este item o pode alterar.');return a;};
  const optAsset=id=>{if(!id)return null;assetFor(id);return id;};
  if(path==='/api/finance'&&method==='GET'){generateRecurring(fin,today(),newId);return {finance:view(fin,u,today())};}
  if(path==='/api/finance/expenses'&&method==='POST'){
    const t={id:newId(),kind:'expense',amountCents:cents(b.amountCents),transactionDate:dateISO(b.transactionDate||today()),category:str(b.category,60)||'Outros',description:str(b.description,250),assetId:optAsset(b.assetId),createdBy:u.id,createdAt:now()};
    fin.transactions.push(t);return {expense:t};}
  let m=path.match(/^\/api\/finance\/expenses\/([^/]+)$/);
  if(m){const t=fin.transactions.find(x=>x.id===m[1]&&x.kind==='expense');if(!t||!canSeeExpense(fin,u,t))throw err(404,'Despesa não encontrada.');
    if(method==='PATCH'){if('amountCents'in b)t.amountCents=cents(b.amountCents);if('transactionDate'in b)t.transactionDate=dateISO(b.transactionDate);if('category'in b)t.category=str(b.category,60)||'Outros';if('description'in b)t.description=str(b.description,250);if('assetId'in b)t.assetId=optAsset(b.assetId);t.updatedAt=now();return {expense:t};}
    if(method==='DELETE'){fin.transactions=fin.transactions.filter(x=>x!==t);return {ok:true};}}
  if(path==='/api/finance/assets'&&method==='POST'){const a={id:newId(),...cleanAsset(b),ownerId:u.id,history:[],archived:false,createdAt:now()};if(a.symbol&&!a.shares)throw err(400,'Indica a quantidade.');setValue(a,b.valueCents??0,today());fin.assets.push(a);return {asset:a};}
  m=path.match(/^\/api\/finance\/assets\/([^/]+)$/);
  if(m){const a=assetFor(m[1],{own:method!=='GET'});
    if(method==='PATCH'){if(a.ownerId!==u.id&&'scope'in b)throw err(403,'Só quem criou este item pode mudar a visibilidade.');Object.assign(a,cleanAsset(b,a));if('valueCents'in b)setValue(a,b.valueCents,today());return {asset:a};}
    if(method==='DELETE'){a.archived=true;a.updatedAt=now();return {ok:true};}}
  if(path==='/api/finance/recurring'&&method==='POST'){const r={id:newId(),...cleanRecurring(b),startMonth:today().slice(0,7),createdBy:u.id,createdAt:now()};if(r.assetId)optAsset(r.assetId);
    // Período experimental: o primeiro lançamento é no fim do período.
    if(r.sub?.trialEnd&&r.sub.trialEnd>today()){r.startMonth=r.sub.trialEnd.slice(0,7);r.dayOfMonth=Number(r.sub.trialEnd.slice(8));}
    if(r.sub&&!r.sub.startDate)r.sub.startDate=today();
    // Começa no mês atual; se o dia já passou, o lançamento deste mês fica feito.
    fin.recurring.push(r);generateRecurring(fin,today(),newId);return {recurring:r};}
  m=path.match(/^\/api\/finance\/recurring\/([^/]+)$/);
  if(m){const r=fin.recurring.find(x=>x.id===m[1]);if(!r)throw err(404,'Despesa fixa não encontrada.');
    if(method==='PATCH'){const wasActive=r.active!==false;const oldAmount=r.amountCents;Object.assign(r,cleanRecurring(b,r));
      // Subscrição: histórico de preço e cancelamento.
      if(r.sub){if('amountCents'in b&&r.amountCents!==oldAmount)r.sub.priceHistory=[...(r.sub.priceHistory||[]),{at:today(),from:oldAmount,to:r.amountCents}].slice(-20);
        if('active'in b){if(b.active===false&&wasActive)r.sub.cancelledAt=today();if(b.active!==false)delete r.sub.cancelledAt;}}if(r.assetId)optAsset(r.assetId);
      // Ao retomar uma despesa em pausa, não lança os meses em que esteve parada.
      if(!wasActive&&r.active!==false)r.lastMonth=(()=>{const [y,mm]=today().split('-').map(Number);const d=Number(today().slice(8));return d>=Math.min(r.dayOfMonth,monthDays(y,mm))?today().slice(0,7):(mm===1?`${y-1}-12`:`${y}-${String(mm-1).padStart(2,'0')}`);})();
      return {recurring:r};}
    if(method==='DELETE'){fin.recurring=fin.recurring.filter(x=>x!==r);return {ok:true};}}
  if(path==='/api/finance/budget'&&method==='PATCH'){const y=String(b.year||'');if(!/^\d{4}$/.test(y))throw err(400,'Ano inválido.');if(b.amountCents===null||b.amountCents===0)delete fin.annualBudget[y];else fin.annualBudget[y]=cents(b.amountCents);return {annualBudget:fin.annualBudget};}
  if(path==='/api/finance/goals'&&method==='POST'){const title=str(b.title,140);if(!title)throw err(400,'Indica o objetivo.');const ids=Array.isArray(b.assetIds)?[...new Set(b.assetIds)]:[];ids.forEach(id=>assetFor(id));const g={id:newId(),title,targetCents:cents(b.targetCents),assetIds:ids,createdBy:u.id,createdAt:now()};fin.goals.push(g);return {goal:g};}
  m=path.match(/^\/api\/finance\/goals\/([^/]+)$/);
  if(m){const g=fin.goals.find(x=>x.id===m[1]);if(!g)throw err(404,'Objetivo não encontrado.');
    if(method==='PATCH'){if('title'in b){const t=str(b.title,140);if(!t)throw err(400,'Indica o objetivo.');g.title=t;}if('targetCents'in b)g.targetCents=cents(b.targetCents);if('assetIds'in b){if(!Array.isArray(b.assetIds))throw err(400,'Itens inválidos.');const visible=new Set(fin.assets.filter(a=>canSeeAsset(u,a)).map(a=>a.id));const hidden=(g.assetIds||[]).filter(id=>!visible.has(id));b.assetIds.forEach(id=>assetFor(id));g.assetIds=[...new Set([...hidden,...b.assetIds])];}return {goal:g};}
    if(method==='DELETE'){fin.goals=fin.goals.filter(x=>x!==g);return {ok:true};}}
  return undefined;
}
const monthlyEquivalent=r=>Math.round(r.amountCents*(recurringMonths(r)?recurringMonths(r).length:12)/12);
const api={SUB_GROUPS,cleanSub,setValue,nextMaturity,projectAsset,currentValue,signedValue,isLiability,LIABILITY_TYPES,DEFAULT_TAX,recurringMonths,monthlyEquivalent,ASSET_TYPES,ASSET_GROUPS,EXPENSE_CATEGORIES,FIXED_CATEGORIES,migrate,generateRecurring,view,handle,canSeeAsset};
if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.CasaFinance=api;
})(typeof window!=='undefined'?window:globalThis);
