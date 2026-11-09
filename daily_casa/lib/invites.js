'use strict';
// Convites por email: o administrador indica o email (e opcionalmente o nome e o perfil); a pessoa recebe uma ligação
// válida durante 7 dias para escolher a sua palavra-passe e criar a conta. Guarda-se só o hash do código da ligação.
// db.invites: {id,email,name,role,tokenHash,createdBy,createdAt,expiresAt,acceptedAt,personId,cancelledAt}
const crypto = require('node:crypto');
const VALID_DAYS = 7;
const ROLES = { manager: 'Gestor da casa', resident: 'Morador', collaborator: 'Colaborador' };
const hash = t => crypto.createHash('sha256').update(String(t)).digest('hex');
const TOKEN_RE = /^[A-Za-z0-9_-]{40,64}$/;

function createInvites({ getDb, save, newId }) {
  const list = () => { const d = getDb(); if (!Array.isArray(d.invites)) d.invites = []; return d.invites; };
  const isPending = x => !x.acceptedAt && !x.cancelledAt && Date.parse(x.expiresAt) > Date.now();
  const view = x => ({ id: x.id, email: x.email, name: x.name || '', role: x.role, roleLabel: ROLES[x.role] || 'Morador', createdBy: x.createdBy, createdAt: x.createdAt, expiresAt: x.expiresAt, sentAt: x.sentAt || x.createdAt });
  function pending() { return list().filter(isPending).map(view); }
  function issue(x) { const token = crypto.randomBytes(32).toString('base64url'); x.tokenHash = hash(token); x.sentAt = new Date().toISOString(); x.expiresAt = new Date(Date.now() + VALID_DAYS * 86400_000).toISOString(); return token; }
  function create({ email, name, role, by }) {
    // Um novo convite para o mesmo email substitui o anterior.
    for (const x of list()) if (isPending(x) && x.email === email) x.cancelledAt = new Date().toISOString();
    const x = { id: newId(), email, name: String(name || '').trim().slice(0, 80), role: ROLES[role] ? role : 'resident', createdBy: by, createdAt: new Date().toISOString() };
    const token = issue(x); list().push(x);
    if (list().length > 500) getDb().invites = list().filter(i => isPending(i)).concat(list().filter(i => !isPending(i)).slice(-300));
    save(); return { invite: view(x), token };
  }
  function resend(id) { const x = list().find(i => i.id === id && isPending(i)); if (!x) return null; const token = issue(x); save(); return { invite: view(x), token }; }
  function cancel(id) { const x = list().find(i => i.id === id && isPending(i)); if (!x) return false; x.cancelledAt = new Date().toISOString(); save(); return true; }
  function find(token) { if (!TOKEN_RE.test(String(token || ''))) return null; const h = hash(token); return list().find(i => isPending(i) && i.tokenHash && crypto.timingSafeEqual(Buffer.from(i.tokenHash), Buffer.from(h))) || null; }
  function markAccepted(x, personId) { x.acceptedAt = new Date().toISOString(); x.personId = personId; delete x.tokenHash; }
  function cancelForEmail(email) { for (const x of list()) if (isPending(x) && x.email === email) x.cancelledAt = new Date().toISOString(); }
  return { pending, create, resend, cancel, find, markAccepted, cancelForEmail, view, ROLES, TOKEN_RE };
}

// Email do convite (texto e HTML no modelo da marca). O perfil não é mencionado: vê-se dentro da app.
function inviteEmail({ inviter, name, link }) {
  const { brandHtml, escH } = require('./mailer');
  const who = String(inviter || 'O administrador').split(' ')[0];
  const hello = name ? `Olá ${String(name).split(' ')[0]},` : 'Olá,';
  const subject = `${who} convidou-te para a Daily Casa`;
  const text = `${hello}\n\n${who} convidou-te para a Daily Casa, a app onde a casa organiza tarefas, rotinas e compras.\n\nPara criares a tua conta, abre esta ligação e escolhe uma palavra-passe:\n${link}\n\nA ligação é válida durante 7 dias.\n\nPara teres a app sempre à mão, depois de entrares:\n- iOS (Safari): toca em Partilhar › Adicionar ao ecrã principal.\n- Android (Chrome): toca no menu ⋮ › Adicionar ao ecrã principal (ou Instalar app).\n\nDaily Casa`;
  const html = brandHtml({ title: 'Tens lugar na casa.', preheader: `${who} convidou-te para a Daily Casa`,
    lead: `${escH(hello)} <b>${escH(who)}</b> convidou-te para a Daily Casa, onde a casa organiza tarefas, rotinas e compras.`,
    cta: { label: 'Criar a minha conta', url: link },
    foot: `A ligação é válida durante 7 dias. Depois de entrares, junta a app ao ecrã principal:<br><b>iOS</b> (Safari): Partilhar › Adicionar ao ecrã principal.<br><b>Android</b> (Chrome): menu ⋮ › Adicionar ao ecrã principal.<br><span style="color:#8A948D;word-break:break-all">Se o botão não funcionar: ${escH(link)}</span>` });
  return { subject, text, html };
}
module.exports = { createInvites, inviteEmail, ROLES };
