/* Daily Casa — regras de palavra-passe, partilhadas pela app e pelo servidor (sem dependências).
 * Seguem as recomendações atuais (NIST SP 800-63B): comprimento em vez de regras de composição,
 * e recusa de palavras-passe comuns, previsíveis ou ligadas à própria pessoa.
 * O servidor aplica sempre as mesmas regras; no cliente servem para avisar antes de enviar.
 */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.PasswordRules=api;})(typeof self!=='undefined'?self:this,function(){
'use strict';
const MIN=10,MAX=128;
// Palavras muito usadas (comparadas sem acentos, sem símbolos e sem os números do fim: «Benfica2024!» conta como «benfica»).
const COMMON=new Set(('password passw0rd palavrapasse senha minhasenha contrasena segredo secreto privado qwerty qwertz azerty asdfgh zxcvbn '+
 'admin administrador administrator root user utilizador login welcome bemvindo bemvinda letmein iloveyou amoteamo teamo amor meuamor '+
 'casa minhacasa dailycasa casaemdia homeassistant home house familia family porto fcporto benfica slbenfica sporting scp braga '+
 'portugal lisboa coimbra faro cristiano ronaldo futebol football soccer dragao dragon monkey master shadow sunshine princess '+
 'jesus deus maria saudade natal pascoa verao inverno primavera outono janeiro fevereiro marco abril maio junho julho agosto '+
 'setembro outubro novembro dezembro segunda terca quarta quinta sexta sabado domingo mudar mudarja alterar temporaria provisoria '+
 'teste testes test demo exemplo abcdef abcdefgh abcdefghij gatinho gato cao cachorro bolacha chocolate').split(' '));
const SEQS=['0123456789012345678901234567890','abcdefghijklmnopqrstuvwxyz','qwertyuiopasdfghjklzxcvbnm','azertyuiopqsdfghjklmwxcvbn','1qaz2wsx3edc4rfv5tgb'];
const fold=s=>String(s||'').normalize('NFD').replace(/[̀-ͯ]/g,'').toLowerCase();
const alnum=s=>fold(s).replace(/[^a-z0-9]/g,'');
function personalParts(ctx){const out=new Set();const add=v=>{for(const w of fold(v).split(/[^a-z0-9]+/))if(w.length>=3)out.add(w);};
 if(ctx){add(ctx.name);add(ctx.username);add(String(ctx.email||'').split('@')[0]);}['daily','dailycasa','casaemdia'].forEach(w=>out.add(w));return [...out];}
function isSequence(a){if(a.length<6)return false;if(/^(.)\1+$/.test(a))return true;
 for(const s of SEQS){const r=[...s].reverse().join('');if(s.includes(a)||r.includes(a))return true;}
 // a mesma pequena sequência repetida («abcabcabca», «12121212»)
 for(let n=1;n<=4;n++){const unit=a.slice(0,n);if(unit.repeat(Math.ceil(a.length/n)).slice(0,a.length)===a)return true;}return false;}
/** Devolve as regras com o estado de cada uma e, em `error`, a primeira que falha (ou null). */
function check(pw,ctx){pw=String(pw||'');const a=alnum(pw),letters=a.replace(/[0-9]+$/,'').replace(/^[0-9]+/,'');
 const tokens=fold(pw).split(/[^a-z0-9]+/);const personal=personalParts(ctx).some(w=>w.length>=4?a.includes(w):tokens.includes(w));
 const common=COMMON.has(a)||COMMON.has(letters)||/^[0-9]+$/.test(a)&&a.length<16;
 const rules=[
  {id:'length',ok:pw.length>=MIN&&pw.length<=MAX,label:`Pelo menos ${MIN} caracteres`,error:pw.length>MAX?`Usa no máximo ${MAX} caracteres.`:`Usa pelo menos ${MIN} caracteres. Uma frase curta é mais fácil de lembrar, por exemplo «regar-as-plantas-ao-domingo».`},
  {id:'personal',ok:!!pw&&!personal,label:'Sem o teu nome, utilizador ou email',error:'Não uses o teu nome, o nome de utilizador, o email nem o nome da app.'},
  {id:'common',ok:!!pw&&!common&&!isSequence(a)&&new Set(pw).size>=5,label:'Não ser comum nem previsível',error:'Essa palavra-passe é demasiado comum ou previsível (sequências, repetições, clubes, meses). Escolhe outra.'},
 ];
 const bad=rules.find(r=>!r.ok);return {ok:!bad,rules,error:bad?bad.error:null};}
return {MIN,MAX,check};
});

/* Na app: lista de regras por baixo de cada campo de nova palavra-passe e verificação antes de enviar. */
(function(){
 if(typeof document==='undefined'||typeof window==='undefined')return;
 const R=window.PasswordRules;const SEL='input[type="password"][autocomplete="new-password"]:not([name="confirm"]):not([name="password2"])';
 const ctxFor=input=>{const f=input.form;const v=n=>f&&f.elements[n]&&f.elements[n].value||'';
  const pid=v('person');if(pid&&typeof people==='function'){const x=people().find(q=>q.id===pid);if(x)return {name:x.name,username:x.username,email:x.email};}
  const me=(typeof store!=='undefined'&&store.user)||{};const own=!input.dataset.pwName;
  return {name:input.dataset.pwName||v('name')||(own?me.name:''),username:input.dataset.pwUsername||v('username')||(own?me.username:''),email:input.dataset.pwEmail||v('email')||(own?me.email:'')};};
 const ICO='<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>';
 function paint(input){const list=input._pwList;if(!list)return;const res=R.check(input.value,ctxFor(input));
  list.innerHTML=res.rules.map(r=>`<li class="${r.ok?'ok':''}">${ICO}<span></span></li>`).join('');
  [...list.children].forEach((li,i)=>{li.lastChild.textContent=res.rules[i].label;});
  list.classList.toggle('touched',!!input.value);}
 function enhance(){for(const input of document.querySelectorAll(SEL)){if(input._pwList&&input._pwList.isConnected)continue;
  const list=document.createElement('ul');list.className='pw-rules';list.id='pwr-'+Math.random().toString(36).slice(2,8);list.setAttribute('aria-live','polite');
  const anchor=input.closest('.field')||input.closest('label')||input;if(anchor===input)input.after(list);else anchor.appendChild(list);
  input._pwList=list;input.setAttribute('aria-describedby',((input.getAttribute('aria-describedby')||'')+' '+list.id).trim());
  input.addEventListener('input',()=>paint(input));paint(input);}}
 // Antes de enviar: a primeira regra que falha aparece junto ao campo; a confirmação tem de coincidir.
 document.addEventListener('submit',e=>{const f=e.target;if(!(f instanceof HTMLFormElement))return;
  for(const input of f.querySelectorAll(SEL)){if(!input.value&&!input.required)continue;const res=R.check(input.value,ctxFor(input));
   if(!res.ok){e.preventDefault();e.stopImmediatePropagation();if(window.fieldError)window.fieldError(input,res.error);return;}}
  const pw=f.querySelector(SEL),cf=f.elements.confirm||f.elements.password2;
  if(pw&&cf&&cf.value!==pw.value&&(pw.value||cf.value)){e.preventDefault();e.stopImmediatePropagation();if(window.fieldError)window.fieldError(cf,'As palavras-passe não coincidem.');}
 },true);
 let q=false;const mo=new MutationObserver(()=>{if(q)return;q=true;requestAnimationFrame(()=>{q=false;enhance();});});
 const start=()=>{mo.observe(document.body,{childList:true,subtree:true});enhance();};
 if(document.body)start();else document.addEventListener('DOMContentLoaded',start);
})();
