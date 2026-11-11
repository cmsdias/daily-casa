'use strict';
// 3.17: ícone de um serviço, a partir do próprio site (como os navegadores fazem nos marcadores).
// Só https, só endereços públicos (nada da rede de casa), poucos redirecionamentos, tamanho limitado.
// O ícone fica guardado na base de dados desta casa; nada vai para o repositório público.
const dns = require('node:dns').promises; const net = require('node:net');
const MAX = 300_000; const TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/gif', 'image/x-icon', 'image/vnd.microsoft.icon', 'image/svg+xml'];
function privateIp(ip) {
  if (net.isIPv4(ip)) { const [a, b] = ip.split('.').map(Number); return a === 10 || a === 127 || a === 0 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127) || a >= 224; }
  const x = ip.toLowerCase(); return x === '::1' || x === '::' || x.startsWith('fc') || x.startsWith('fd') || x.startsWith('fe80') || x.startsWith('::ffff:') && privateIp(x.slice(7));
}
function createSiteIcon({ fetchImpl = globalThis.fetch, allowPrivate = process.env.SITEICON_ALLOW_PRIVATE === '1', allowHttp = process.env.SITEICON_ALLOW_HTTP === '1', timeoutMs = 8000 } = {}) {
  async function check(u) {
    const url = new URL(u); if (url.protocol !== 'https:' && !(allowHttp && url.protocol === 'http:')) throw Error('Só ligações https.');
    if (url.username || url.password) throw Error('Ligação inválida.');
    if (!allowPrivate) { const host = url.hostname.replace(/^\[|\]$/g, ''); const ips = net.isIP(host) ? [host] : (await dns.lookup(host, { all: true })).map(x => x.address); if (!ips.length || ips.some(privateIp)) throw Error('Endereço não permitido.'); }
    return url;
  }
  async function get(u, accept) {
    let url = await check(u);
    for (let hop = 0; hop < 4; hop++) {
      const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), timeoutMs);
      try {
        const r = await fetchImpl(url.href, { redirect: 'manual', signal: ctl.signal, headers: { Accept: accept, 'User-Agent': 'Mozilla/5.0 (compatible; DailyCasa)' } });
        if (r.status >= 300 && r.status < 400 && r.headers.get('location')) { url = await check(new URL(r.headers.get('location'), url).href); continue; }
        if (!r.ok) throw Error(`resposta ${r.status}`);
        const buf = Buffer.from(await r.arrayBuffer()); if (buf.length > MAX) throw Error('Ficheiro grande demais.');
        return { url, buf, type: String(r.headers.get('content-type') || '').split(';')[0].trim().toLowerCase() };
      } finally { clearTimeout(t); }
    }
    throw Error('Demasiados redirecionamentos.');
  }
  const sniff = (buf, type) => {
    if (buf[0] === 0x89 && buf[1] === 0x50) return 'image/png'; if (buf[0] === 0xff && buf[1] === 0xd8) return 'image/jpeg';
    if (buf.slice(0, 4).toString() === 'RIFF' && buf.slice(8, 12).toString() === 'WEBP') return 'image/webp'; if (buf.slice(0, 3).toString() === 'GIF') return 'image/gif';
    if (buf[0] === 0 && buf[1] === 0 && buf[2] === 1 && buf[3] === 0) return 'image/x-icon';
    if (/^\s*(<\?xml[^>]*>\s*)?<svg[\s>]/i.test(buf.slice(0, 300).toString())) return 'image/svg+xml';
    return TYPES.includes(type) ? null : null;
  };
  // Procura <link rel="apple-touch-icon"> e <link rel="icon">, prefere o maior; senão, /favicon.ico.
  async function find(site) {
    const page = await get(site, 'text/html,*/*;q=0.5');
    const html = page.buf.toString('utf8').slice(0, 200_000); const cands = [];
    for (const m of html.matchAll(/<link\b[^>]*>/gi)) {
      const tag = m[0]; const rel = (/\brel\s*=\s*["']?([^"'>]+)/i.exec(tag) || [])[1] || ''; if (!/\b(icon|apple-touch-icon(-precomposed)?)\b/i.test(rel) || /mask-icon/i.test(rel)) continue;
      const href = (/\bhref\s*=\s*["']([^"']+)["']/i.exec(tag) || /\bhref\s*=\s*([^\s>]+)/i.exec(tag) || [])[1]; if (!href || href.startsWith('data:')) continue;
      const size = Number(((/\bsizes\s*=\s*["']?(\d+)x\d+/i.exec(tag) || [])[1]) || (/apple-touch/i.test(rel) ? 180 : 32));
      try { cands.push({ href: new URL(href, page.url).href, size }); } catch {}
    }
    cands.sort((a, b) => Math.abs(a.size - 128) - Math.abs(b.size - 128) || b.size - a.size);
    cands.push({ href: new URL('/favicon.ico', page.url).href, size: 16 });
    for (const c of cands.slice(0, 6)) {
      try { const r = await get(c.href, 'image/*'); const type = sniff(r.buf, r.type); if (!type) continue; return `data:${type};base64,${r.buf.toString('base64')}`; } catch {}
    }
    throw Error('Não encontrei um ícone neste site.');
  }
  return { find, privateIp };
}
// Imagem escolhida pela pessoa (já reduzida no navegador): só PNG/JPEG/WebP em data URL, até 150 KB.
function cleanDataUrl(v) { const m = /^data:(image\/(png|jpeg|webp));base64,([A-Za-z0-9+/=]+)$/.exec(String(v || '')); if (!m) throw Error('Imagem inválida.'); if (m[3].length > 200_000) throw Error('Imagem grande demais.'); return v; }
module.exports = { createSiteIcon, cleanDataUrl };
