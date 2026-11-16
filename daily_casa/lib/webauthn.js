'use strict';
// Passkeys (WebAuthn) sem dependências: Face ID / Touch ID no iPhone, impressão digital ou rosto no Android.
// Só o necessário para atestado «none»: ler CBOR, interpretar authenticatorData, converter a chave COSE e verificar assinaturas.
const crypto = require('crypto');

const b64u = buf => Buffer.from(buf).toString('base64url');
const fromB64u = s => Buffer.from(String(s || ''), 'base64url');
const sha256 = buf => crypto.createHash('sha256').update(buf).digest();

// --- CBOR mínimo (RFC 8949): inteiros, bytes, texto, listas, mapas, true/false/null ---
function cborDecode(buf) {
  let i = 0;
  const need = n => { if (i + n > buf.length) throw new Error('CBOR truncado'); };
  const readLen = info => {
    if (info < 24) return info;
    if (info === 24) { need(1); return buf[i++]; }
    if (info === 25) { need(2); const v = buf.readUInt16BE(i); i += 2; return v; }
    if (info === 26) { need(4); const v = buf.readUInt32BE(i); i += 4; return v; }
    if (info === 27) { need(8); const v = Number(buf.readBigUInt64BE(i)); i += 8; return v; }
    throw new Error('CBOR: comprimento indefinido não suportado');
  };
  function item(depth) {
    if (depth > 16) throw new Error('CBOR demasiado profundo');
    need(1); const b = buf[i++]; const major = b >> 5, info = b & 31;
    if (major === 7) { if (info === 20) return false; if (info === 21) return true; if (info === 22 || info === 23) return null; throw new Error('CBOR: tipo simples não suportado'); }
    const len = readLen(info);
    switch (major) {
      case 0: return len;
      case 1: return -1 - len;
      case 2: { need(len); const v = buf.subarray(i, i + len); i += len; return Buffer.from(v); }
      case 3: { need(len); const v = buf.toString('utf8', i, i + len); i += len; return v; }
      case 4: { const a = []; for (let k = 0; k < len; k++) a.push(item(depth + 1)); return a; }
      case 5: { const m = new Map(); for (let k = 0; k < len; k++) { const key = item(depth + 1); m.set(key, item(depth + 1)); } return m; }
      default: throw new Error('CBOR: tipo não suportado');
    }
  }
  const value = item(0);
  return { value, length: i };
}

// --- authenticatorData (WebAuthn §6.1) ---
function parseAuthData(ad) {
  if (ad.length < 37) throw new Error('authenticatorData curto');
  const out = { rpIdHash: ad.subarray(0, 32), flags: ad[32], counter: ad.readUInt32BE(33) };
  out.up = !!(out.flags & 0x01); out.uv = !!(out.flags & 0x04); out.at = !!(out.flags & 0x40);
  if (out.at) {
    let p = 37; if (ad.length < p + 18) throw new Error('attestedCredentialData curto');
    p += 16; // AAGUID
    const n = ad.readUInt16BE(p); p += 2; if (n < 1 || n > 1023 || ad.length < p + n) throw new Error('credentialId inválido');
    out.credentialId = Buffer.from(ad.subarray(p, p + n)); p += n;
    const { value, length } = cborDecode(ad.subarray(p)); out.cose = value; out.coseLength = length;
  }
  return out;
}

// --- Chave COSE → chave pública do Node (ES256, RS256, EdDSA) ---
function coseToKey(cose) {
  if (!(cose instanceof Map)) throw new Error('Chave COSE inválida');
  const kty = cose.get(1), alg = cose.get(3);
  if (kty === 2 && alg === -7 && cose.get(-1) === 1) return { alg: -7, key: crypto.createPublicKey({ key: { kty: 'EC', crv: 'P-256', x: b64u(cose.get(-2)), y: b64u(cose.get(-3)) }, format: 'jwk' }) };
  if (kty === 3 && alg === -257) return { alg: -257, key: crypto.createPublicKey({ key: { kty: 'RSA', n: b64u(cose.get(-1)), e: b64u(cose.get(-2)) }, format: 'jwk' }) };
  if (kty === 1 && alg === -8 && cose.get(-1) === 6) return { alg: -8, key: crypto.createPublicKey({ key: { kty: 'OKP', crv: 'Ed25519', x: b64u(cose.get(-2)) }, format: 'jwk' }) };
  throw new Error('Algoritmo de chave não suportado');
}

function checkClientData(clientDataJSON, { type, challenge, origins }) {
  let cd; try { cd = JSON.parse(Buffer.from(clientDataJSON).toString('utf8')); } catch { throw new Error('clientDataJSON inválido'); }
  if (cd.type !== type) throw new Error('Tipo de pedido errado');
  if (!challenge || cd.challenge !== challenge) throw new Error('Desafio inválido ou expirado');
  if (!origins.includes(cd.origin)) throw new Error('Origem não autorizada');
  if (cd.crossOrigin === true) throw new Error('Pedido entre origens recusado');
  return cd;
}

/** Verifica o registo de uma passkey. Devolve { id, publicKey (PEM SPKI), alg, counter, transports }. */
function verifyRegistration({ credential, challenge, origins, rpId }) {
  const r = credential && credential.response; if (!r) throw new Error('Resposta em falta');
  const cdj = fromB64u(r.clientDataJSON);
  checkClientData(cdj, { type: 'webauthn.create', challenge, origins });
  const att = cborDecode(fromB64u(r.attestationObject)).value;
  if (!(att instanceof Map) || !Buffer.isBuffer(att.get('authData'))) throw new Error('attestationObject inválido');
  const ad = parseAuthData(att.get('authData'));
  if (!ad.rpIdHash.equals(sha256(Buffer.from(rpId)))) throw new Error('rpId não corresponde');
  if (!ad.up || !ad.uv) throw new Error('Falta a verificação do utilizador (Face ID, impressão digital ou código do dispositivo)');
  if (!ad.at || !ad.credentialId) throw new Error('Sem credencial');
  if (b64u(ad.credentialId) !== String(credential.id || credential.rawId)) throw new Error('Identificador da credencial não corresponde');
  const { alg, key } = coseToKey(ad.cose);
  const transports = Array.isArray(r.transports) ? r.transports.filter(t => typeof t === 'string').slice(0, 6) : [];
  return { id: b64u(ad.credentialId), publicKey: key.export({ type: 'spki', format: 'pem' }), alg, counter: ad.counter, transports };
}

/** Verifica uma entrada com passkey. `stored` é a credencial guardada. Devolve { counter }. */
function verifyAssertion({ credential, challenge, origins, rpId, stored }) {
  const r = credential && credential.response; if (!r) throw new Error('Resposta em falta');
  const cdj = fromB64u(r.clientDataJSON);
  checkClientData(cdj, { type: 'webauthn.get', challenge, origins });
  const adBuf = fromB64u(r.authenticatorData);
  const ad = parseAuthData(adBuf);
  if (!ad.rpIdHash.equals(sha256(Buffer.from(rpId)))) throw new Error('rpId não corresponde');
  if (!ad.up || !ad.uv) throw new Error('Falta a verificação do utilizador');
  const data = Buffer.concat([adBuf, sha256(cdj)]);
  const sig = fromB64u(r.signature);
  const key = crypto.createPublicKey(stored.publicKey);
  const ok = stored.alg === -8 ? crypto.verify(null, data, key, sig) : crypto.verify('sha256', data, key, sig);
  if (!ok) throw new Error('Assinatura inválida');
  // Contador: as passkeys sincronizadas (iCloud, Google) usam sempre 0; só se compara quando ambos são positivos.
  if (stored.counter > 0 && ad.counter > 0 && ad.counter <= stored.counter) throw new Error('Contador da credencial inválido (possível cópia)');
  return { counter: ad.counter };
}

const newChallenge = () => b64u(crypto.randomBytes(32));

module.exports = { verifyRegistration, verifyAssertion, newChallenge, cborDecode, parseAuthData, b64u, fromB64u };
