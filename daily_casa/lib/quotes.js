'use strict';
// Cotações automáticas (3.8): ações, ETF e cripto com símbolo e quantidade no Património.
// Preço de fecho via Yahoo Finance (sem chave; não oficial) e, para ações americanas, Stooq como alternativa.
// Conversão para euros com a taxa de referência diária do Banco Central Europeu.
// Se uma fonte falhar, o item mantém o último valor e fica com a indicação do erro.
const DEFAULTS = {
  yahoo: 'https://query1.finance.yahoo.com/v8/finance/chart/',
  stooq: 'https://stooq.com/q/l/',
  ecb: 'https://www.ecb.europa.eu/stats/eurofxref/eurofxref-daily.xml',
};
const SYMBOL_RE = /^[A-Z0-9][A-Z0-9.\-=^]{0,19}$/;
const UA = 'Mozilla/5.0 (compatible; DailyCasa/3.8; +https://github.com/cmsdias/daily-casa)';

function createQuotes({ fetchImpl = globalThis.fetch, yahoo = process.env.QUOTES_YAHOO || DEFAULTS.yahoo, stooq = process.env.QUOTES_STOOQ || DEFAULTS.stooq, ecb = process.env.QUOTES_ECB || DEFAULTS.ecb, timeoutMs = 8000 } = {}) {
  const get = async (url, type) => {
    const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), timeoutMs);
    try {
      const r = await fetchImpl(url, { headers: { 'User-Agent': UA, Accept: type === 'json' ? 'application/json' : '*/*' }, signal: ctl.signal });
      if (!r.ok) throw Error(`resposta ${r.status}`);
      return type === 'json' ? await r.json() : await r.text();
    } finally { clearTimeout(t); }
  };
  async function fromYahoo(sym) {
    const j = await get(`${yahoo}${encodeURIComponent(sym)}?range=5d&interval=1d`, 'json');
    const res = j?.chart?.result?.[0]; const m = res?.meta;
    if (!m || !Number.isFinite(m.regularMarketPrice)) throw Error(j?.chart?.error?.description || 'símbolo desconhecido');
    const closes = (res.indicators?.quote?.[0]?.close || []).filter(Number.isFinite);
    const prev = closes.length > 1 ? closes[closes.length - 2] : (Number.isFinite(m.chartPreviousClose) ? m.chartPreviousClose : null);
    return { price: m.regularMarketPrice, currency: String(m.currency || 'USD'), at: m.regularMarketTime ? new Date(m.regularMarketTime * 1000).toISOString() : new Date().toISOString(), prev, source: 'Yahoo Finance' };
  }
  async function fromStooq(sym) {
    if (sym.includes('.') || sym.includes('-') || sym.includes('=')) throw Error('sem alternativa para este símbolo');
    const csv = await get(`${stooq}?s=${encodeURIComponent(sym.toLowerCase())}.us&f=sd2t2c&h&e=csv`, 'text');
    const row = String(csv).trim().split(/\r?\n/)[1]?.split(',') || [];
    const price = Number(row[3]);
    if (!Number.isFinite(price) || price <= 0) throw Error('símbolo desconhecido');
    return { price, currency: 'USD', at: row[1] ? new Date(`${row[1]}T${row[2] || '22:00:00'}Z`).toISOString() : new Date().toISOString(), prev: null, source: 'Stooq' };
  }
  async function quote(sym) {
    sym = String(sym || '').trim().toUpperCase();
    if (!SYMBOL_RE.test(sym)) throw Error('Símbolo inválido.');
    try { return await fromYahoo(sym); } catch (e1) {
      try { return await fromStooq(sym); } catch { throw Error(`Não foi possível obter a cotação de ${sym} (${e1.message}).`); }
    }
  }
  let fx = null;
  async function rates() {
    if (fx && Date.now() - fx.fetched < 6 * 3600_000) return fx;
    const xml = await get(ecb, 'text');
    const date = (/time=['"](\d{4}-\d{2}-\d{2})['"]/.exec(xml) || [])[1] || '';
    const r = { EUR: 1 }; for (const m of xml.matchAll(/currency=['"]([A-Z]{3})['"]\s+rate=['"]([\d.]+)['"]/g)) r[m[1]] = Number(m[2]);
    if (!r.USD) throw Error('Taxas do BCE indisponíveis.');
    fx = { date, rates: r, fetched: Date.now() }; return fx;
  }
  // Preço em euros por unidade. GBp/GBX (pence) passa a libras.
  async function toEur(price, currency) {
    let cur = String(currency || 'EUR'); let p = price;
    if (cur === 'GBp' || cur === 'GBX') { cur = 'GBP'; p = price / 100; }
    if (cur === 'EUR') return { eur: p, rate: 1, rateDate: '' };
    const f = await rates(); const rate = f.rates[cur];
    if (!rate) throw Error(`Sem câmbio do BCE para ${cur}.`);
    return { eur: p / rate, rate, rateDate: f.date };
  }
  // Atualiza um item do património com símbolo e quantidade. Devolve true se o valor mudou.
  async function refreshAsset(a, { setValue, today }) {
    if (!a.symbol || !(a.shares > 0)) return false;
    try {
      const q = await quote(a.symbol); const c = await toEur(q.price, q.currency);
      const valueCents = Math.round(a.shares * c.eur * 100);
      a.quote = { price: q.price, currency: q.currency, at: q.at, prevPrice: q.prev, rate: c.rate, rateDate: c.rateDate, eurPrice: Math.round(c.eur * 10000) / 10000, source: q.source, checkedAt: new Date().toISOString() };
      if (valueCents !== a.valueCents) { setValue(a, valueCents, today); return true; }
      return true;
    } catch (e) {
      a.quote = { ...(a.quote || {}), error: e.message, checkedAt: new Date().toISOString() };
      // Se a quantidade mudou, recalcula com o último preço conhecido.
      if (a.quote.eurPrice) { const v = Math.round(a.shares * a.quote.eurPrice * 100); if (v !== a.valueCents) setValue(a, v, today); }
      return true;
    }
  }
  return { quote, rates, toEur, refreshAsset };
}
module.exports = { createQuotes, SYMBOL_RE };
