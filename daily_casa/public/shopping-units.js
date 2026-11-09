// Unidades da lista de compras: usadas pelo servidor (validação) e pela interface (escolha, leitura do texto e apresentação).
(function(root){
'use strict';
// [chave guardada, singular, plural, sinónimos aceites ao escrever «2 kg batatas»]
const UNITS=[['un','un','un',['un','un.','unid','unidade','unidades','x']],['kg','kg','kg',['kg','kgs','quilo','quilos']],['g','g','g',['g','gr','gramas']],['L','L','L',['l','lt','litro','litros']],['ml','ml','ml',['ml']],['pacote','pacote','pacotes',['pacote','pacotes','pct']],['embalagem','embalagem','embalagens',['embalagem','embalagens','emb']],['garrafa','garrafa','garrafas',['garrafa','garrafas']],['lata','lata','latas',['lata','latas']],['caixa','caixa','caixas',['caixa','caixas','cx']],['saco','saco','sacos',['saco','sacos']],['frasco','frasco','frascos',['frasco','frascos']],['rolo','rolo','rolos',['rolo','rolos']],['dúzia','dúzia','dúzias',['dúzia','dúzias','duzia','duzias']],['cacho','cacho','cachos',['cacho','cachos']],['molho','molho','molhos',['molho','molhos']],['molho','molho','molhos',['molho','molhos']]];
const KEYS=UNITS.map(u=>u[0]);
const SYN=new Map();for(const [k,,,syn] of UNITS)for(const s of syn)SYN.set(s,k);
const unitFromWord=w=>SYN.get(String(w||'').toLocaleLowerCase('pt-PT').replace(/\.$/,''))||(SYN.has(String(w||'').toLocaleLowerCase('pt-PT'))?SYN.get(String(w).toLocaleLowerCase('pt-PT')):'');
function label(key,qty){const u=UNITS.find(x=>x[0]===key);if(!u)return '';const n=Number(String(qty??'').replace(',','.'));return Number.isFinite(n)&&n>1?u[2]:u[1];}
// «2» + «kg» → «2 kg»; sem unidade mostra só a quantidade (compatível com produtos antigos, ex.: «2 embalagens»).
function format(qty,key){const q=String(qty??'').trim()||'1';const l=label(key,q);return l?`${q} ${l}`:q;}
const api={UNITS,KEYS,unitFromWord,label,format};
if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.CasaUnits=api;
})(typeof window!=='undefined'?window:globalThis);
