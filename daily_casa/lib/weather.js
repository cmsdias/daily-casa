'use strict';
// Meteorologia da casa (3.11). Fonte por omissão: IPMA (dados abertos, sem conta). Alternativa: a previsão do Home Assistant.
// O servidor vai buscar os dados de hora a hora e guarda-os; os telemóveis só falam com a app.
// db.weather = {settings:{source,globalIdLocal,locationName,lat,lon,idAreaAviso,stationId,stationName,haEntity,tips,alerts},
//               data:{fetchedAt,source,locationName,now:{temp,at,station}|null,days:[{date,tMin,tMax,prob,type,desc,windDir,windClass}],warnings:[]}, alerted:{}}
const BASE = process.env.IPMA_BASE || 'https://api.ipma.pt/open-data';
const UA = 'DailyCasa (add-on Home Assistant)';
const TYPES = { 0: 'Sem informação', 1: 'Céu limpo', 2: 'Céu pouco nublado', 3: 'Céu parcialmente nublado', 4: 'Céu muito nublado', 5: 'Nuvens altas', 6: 'Aguaceiros', 7: 'Aguaceiros fracos', 8: 'Aguaceiros fortes', 9: 'Chuva', 10: 'Chuva fraca', 11: 'Chuva forte', 12: 'Períodos de chuva', 13: 'Períodos de chuva fraca', 14: 'Períodos de chuva forte', 15: 'Chuvisco', 16: 'Neblina', 17: 'Nevoeiro ou nuvens baixas', 18: 'Neve', 19: 'Trovoada', 20: 'Aguaceiros e trovoada', 21: 'Granizo', 22: 'Geada', 23: 'Chuva e trovoada', 24: 'Nebulosidade convectiva', 25: 'Períodos de muito nublado', 26: 'Nevoeiro', 27: 'Céu nublado', 28: 'Aguaceiros de neve', 29: 'Chuva e neve', 30: 'Chuva e neve' };
const WIND = { 1: 'fraco', 2: 'moderado', 3: 'forte', 4: 'muito forte' };
const DIR = { N: 'N', NE: 'NE', E: 'E', SE: 'SE', S: 'S', SW: 'SO', W: 'O', NW: 'NO', O: 'O', SO: 'SO', NO: 'NO' };
// Condições do Home Assistant → tipo IPMA equivalente (para o mesmo ícone e texto).
const HA_TYPES = { 'clear-night': 1, sunny: 1, partlycloudy: 3, cloudy: 4, fog: 17, hail: 21, lightning: 19, 'lightning-rainy': 23, pouring: 11, rainy: 9, snowy: 18, 'snowy-rainy': 29, windy: 3, 'windy-variant': 3, exceptional: 0 };
const LEVELS = { green: 0, yellow: 1, orange: 2, red: 3 };
const dist = (a, b, c, d) => { const r = Math.PI / 180; const x = (d - b) * r * Math.cos((a + c) / 2 * r), y = (c - a) * r; return Math.sqrt(x * x + y * y) * 6371; };

function createWeather({ getDb, save, haCall = null, haAvailable = () => false, notifyAll = () => {}, today, fetchImpl = globalThis.fetch, log = console.error }) {
  const state = () => { const d = getDb(); d.weather ||= {}; d.weather.settings ||= { source: 'ipma', tips: true, alerts: false }; d.weather.alerted ||= {}; return d.weather; };
  const get = async url => { const r = await fetchImpl(url, { headers: { 'User-Agent': UA, Accept: 'application/json' }, signal: AbortSignal.timeout(10000) }); if (!r.ok) throw Error(`IPMA respondeu ${r.status}`); return r.json(); };
  let locCache = null, stCache = null;
  async function locations() {
    if (locCache && Date.now() - locCache.at < 86400_000) return locCache.list;
    const j = await get(`${BASE}/distrits-islands.json`);
    const list = (j.data || []).map(x => ({ id: Number(x.globalIdLocal), name: String(x.local || ''), lat: Number(x.latitude), lon: Number(x.longitude), area: String(x.idAreaAviso || '') })).filter(x => x.id && x.name).sort((a, b) => a.name.localeCompare(b.name, 'pt'));
    locCache = { at: Date.now(), list }; return list;
  }
  async function stations() {
    if (stCache && Date.now() - stCache.at < 7 * 86400_000) return stCache.list;
    const j = await get(`${BASE}/observation/meteorology/stations/stations.json`);
    const list = (Array.isArray(j) ? j : j.features || []).map(f => ({ id: String(f.properties?.idEstacao ?? ''), name: String(f.properties?.localEstacao || ''), lon: Number(f.geometry?.coordinates?.[0]), lat: Number(f.geometry?.coordinates?.[1]) })).filter(s => s.id && Number.isFinite(s.lat));
    stCache = { at: Date.now(), list }; return list;
  }
  // Localização da casa no Home Assistant (para escolher a cidade e a estação mais próximas).
  async function haHome() { if (!haAvailable() || !haCall) return null; try { const c = await haCall('GET', '/core/api/config'); return Number.isFinite(c?.latitude) ? { lat: c.latitude, lon: c.longitude, name: c.location_name || '' } : null; } catch { return null; } }
  async function resolveLocation(s) {
    if (s.globalIdLocal && s.stationId) return;
    const list = await locations(); let ref = null;
    if (s.globalIdLocal) ref = list.find(l => l.id === s.globalIdLocal) || null;
    if (!ref) { const home = await haHome(); ref = home ? list.reduce((b, l) => !b || dist(home.lat, home.lon, l.lat, l.lon) < dist(home.lat, home.lon, b.lat, b.lon) ? l : b, null) : list.find(l => /porto/i.test(l.name)) || list[0]; if (home) { s.lat = home.lat; s.lon = home.lon; } }
    if (!ref) throw Error('Sem localizações do IPMA.');
    s.globalIdLocal = ref.id; s.locationName = ref.name; s.idAreaAviso = ref.area; if (!Number.isFinite(s.lat)) { s.lat = ref.lat; s.lon = ref.lon; }
    try { const st = await stations(); const near = st.reduce((b, x) => !b || dist(s.lat, s.lon, x.lat, x.lon) < dist(s.lat, s.lon, b.lat, b.lon) ? x : b, null); if (near) { s.stationId = near.id; s.stationName = near.name; } } catch (e) { log('Meteorologia (estações):', e.message); }
  }
  async function fromIpma(s) {
    await resolveLocation(s);
    const f = await get(`${BASE}/forecast/meteorology/cities/daily/${s.globalIdLocal}.json`);
    const days = (f.data || []).map(d => ({ date: d.forecastDate, tMin: Math.round(Number(d.tMin)), tMax: Math.round(Number(d.tMax)), prob: Math.round(Number(d.precipitaProb)) || 0, type: Number(d.idWeatherType) || 0, desc: TYPES[Number(d.idWeatherType)] || '', windDir: DIR[d.predWindDir] || d.predWindDir || '', windClass: WIND[Number(d.classWindSpeed)] || '' })).filter(d => d.date && Number.isFinite(d.tMax));
    let now = null;
    if (s.stationId) try {
      const o = await get(`${BASE}/observation/meteorology/stations/observations.json`);
      for (const k of Object.keys(o).sort().reverse()) { const v = o[k]?.[s.stationId]; if (v && Number.isFinite(v.temperatura) && v.temperatura > -50) { now = { temp: Math.round(v.temperatura), at: new Date(k + (k.length <= 16 ? ':00Z' : '')).toISOString(), station: s.stationName || '' }; break; } }
    } catch (e) { log('Meteorologia (observações):', e.message); }
    let warnings = [];
    try {
      const w = await get(`${BASE}/forecast/warnings/warnings_www.json`);
      warnings = (Array.isArray(w) ? w : []).filter(x => x.idAreaAviso === s.idAreaAviso && (LEVELS[x.awarenessLevelID] || 0) >= 1 && Date.parse(x.endTime) > Date.now())
        .map(x => ({ level: x.awarenessLevelID, type: String(x.awarenessTypeName || ''), text: String(x.text || '').slice(0, 300), start: x.startTime, end: x.endTime })).slice(0, 10);
    } catch (e) { log('Meteorologia (avisos):', e.message); }
    return { source: 'ipma', locationName: s.locationName, now, days: days.slice(0, 5), warnings };
  }
  async function fromHa(s) {
    if (!haAvailable() || !haCall) throw Error('A previsão do Home Assistant só está disponível na app instalada no Home Assistant.');
    const entity = s.haEntity || 'weather.forecast_home';
    const st = await haCall('GET', `/core/api/states/${entity}`);
    const r = await haCall('POST', '/core/api/services/weather/get_forecasts?return_response', { entity_id: entity, type: 'daily' });
    const list = r?.service_response?.[entity]?.forecast || r?.[entity]?.forecast || [];
    const days = list.slice(0, 5).map(d => ({ date: String(d.datetime || '').slice(0, 10), tMin: Math.round(d.templow ?? d.temperature), tMax: Math.round(d.temperature), prob: Math.round(d.precipitation_probability ?? (d.precipitation > 0 ? 60 : 0)), type: HA_TYPES[d.condition] ?? 0, desc: TYPES[HA_TYPES[d.condition] ?? 0], windDir: '', windClass: '' }));
    const home = await haHome();
    return { source: 'ha', locationName: home?.name || st?.attributes?.friendly_name || 'Casa', now: Number.isFinite(st?.attributes?.temperature) ? { temp: Math.round(st.attributes.temperature), at: st.last_updated || new Date().toISOString(), station: '', type: HA_TYPES[st.state] ?? 0, desc: TYPES[HA_TYPES[st.state] ?? 0] } : null, days, warnings: [] };
  }
  // 3.16: um aviso só é notificado uma vez por episódio. O IPMA publica o mesmo aviso em vários blocos
  // seguidos (e volta a publicá-lo a cada atualização, com outras horas). O assunto é o tipo, o nível e o texto;
  // enquanto houver blocos seguidos ou sobrepostos do mesmo assunto, não se notifica de novo.
  // Nível mais alto ou texto diferente contam como assunto novo. Um episódio fecha 12 h depois do último bloco.
  const GAP = 12 * 3600_000;
  const subject = x => [x.type, x.level, String(x.text || '').replace(/\s+/g, ' ').trim().toLowerCase()].join('|');
  function alertWarnings(w, warnings, enabled) {
    const now = Date.now(); const seen = w.alerted;
    // Formato antigo (por bloco, com hora de início): migra sem voltar a notificar o que já está em curso.
    const migrate = w.alertVersion !== 2 && Object.values(seen).some(v => typeof v !== 'object');
    if (w.alertVersion !== 2) { for (const k of Object.keys(seen)) if (typeof seen[k] !== 'object') delete seen[k]; w.alertVersion = 2; }
    const groups = new Map();
    for (const x of warnings) { const k = subject(x); const g = groups.get(k); const end = Date.parse(x.end) || now; const start = Date.parse(x.start) || now;
      if (g) { g.end = Math.max(g.end, end); g.start = Math.min(g.start, start); } else groups.set(k, { x, start, end }); }
    for (const [k, g] of groups) {
      const prev = seen[k];
      const same = prev && g.start <= (prev.end || 0) + GAP;
      if (same) { prev.end = Math.max(prev.end || 0, g.end); continue; }
      seen[k] = { at: now, end: g.end };
      if (!enabled || migrate) continue;
      const until = new Date(g.end).toLocaleString('pt-PT', { weekday: 'long', hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Lisbon' });
      notifyAll(`Aviso ${({ yellow: 'amarelo', orange: 'laranja', red: 'vermelho' })[g.x.level] || ''}: ${g.x.type}`.trim(), `${g.x.text ? g.x.text.replace(/\.?\s*$/, '. ') : ''}Até ${until}.`);
    }
    for (const [k, v] of Object.entries(seen)) if (typeof v !== 'object' || now - (v.end || v.at || 0) > 2 * 86400_000) delete seen[k];
  }
  async function refresh() {
    const w = state(); const s = w.settings;
    try {
      const d = s.source === 'ha' ? await fromHa(s) : await fromIpma(s);
      w.data = { ...d, fetchedAt: new Date().toISOString() }; delete w.error;
      alertWarnings(w, d.warnings, s.alerts);
    } catch (e) { w.error = e.message; w.errorAt = new Date().toISOString(); log('Meteorologia:', e.message); }
    save();
  }
  let busy = false;
  async function tick(force = false) {
    if (busy || process.env.WEATHER_OFF === '1') return; const w = state();
    const age = w.data ? Date.now() - Date.parse(w.data.fetchedAt) : Infinity; const errAge = w.errorAt ? Date.now() - Date.parse(w.errorAt) : Infinity;
    if (!force && age < 55 * 60_000) return; if (!force && w.error && errAge < 20 * 60_000) return;
    busy = true; try { await refresh(); } finally { busy = false; }
  }
  function view(canEdit) {
    const w = state(); const s = w.settings;
    return { settings: { source: s.source || 'ipma', globalIdLocal: s.globalIdLocal || null, locationName: s.locationName || '', stationName: s.stationName || '', haEntity: s.haEntity || '', tips: s.tips !== false, alerts: !!s.alerts }, data: w.data || null, error: w.error || null, canEdit, haAvailable: haAvailable() };
  }
  async function update(b) {
    const s = state().settings;
    if ('source' in b) { if (!['ipma', 'ha'].includes(b.source)) throw Error('Fonte inválida.'); if (b.source === 'ha' && !haAvailable()) throw Error('A previsão do Home Assistant só está disponível na app instalada no Home Assistant.'); s.source = b.source; }
    if ('globalIdLocal' in b) { const id = Number(b.globalIdLocal); const l = (await locations()).find(x => x.id === id); if (!l) throw Error('Localização desconhecida.'); if (l.id !== s.globalIdLocal) { s.globalIdLocal = l.id; s.locationName = l.name; s.idAreaAviso = l.area; s.lat = l.lat; s.lon = l.lon; delete s.stationId; delete s.stationName; } }
    if ('haEntity' in b) { const e = String(b.haEntity || '').trim(); if (e && !/^weather\.[a-z0-9_]{1,80}$/.test(e)) throw Error('Entidade inválida (ex.: weather.forecast_home).'); s.haEntity = e; }
    if ('tips' in b) s.tips = !!b.tips; if ('alerts' in b) s.alerts = !!b.alerts;
    save(); await tick(true); return view(true);
  }
  return { tick, view, update, locations, refresh, TYPES };
}
module.exports = { createWeather, TYPES };
