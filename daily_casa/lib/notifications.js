'use strict';
// Notificações dentro da app (sino junto ao avatar).
// Guardadas em db.notifications: {id, userId, type, title, body, link, at, read}.
// Cada pessoa vê apenas as suas; ficam 30 dias (no máximo 200 por pessoa).
// «Limpar» só as tira do sino (cleared); continuam visíveis em «Ver todas» até expirarem.
const MAX_PER_USER = 200, MAX_AGE_DAYS = 30;

function createNotifications({ getDb, save, newId, todayISO, canSeeTask, isActive, roleOf, onAdd = () => {} }) {
  const db = () => getDb();
  const list = () => { const d = db(); if (!Array.isArray(d.notifications)) d.notifications = []; return d.notifications; };
  const state = () => { const d = db(); if (!d.notifState || typeof d.notifState !== 'object') d.notifState = {}; return d.notifState; };
  const firstName = p => String(p?.name || '').split(' ')[0] || 'Alguém';

  function prune() {
    const d = db(); const limit = Date.now() - MAX_AGE_DAYS * 86400_000; const count = {};
    d.notifications = list().filter(n => Date.parse(n.at) > limit).reverse().filter(n => (count[n.userId] = (count[n.userId] || 0) + 1) <= MAX_PER_USER).reverse();
  }
  // Acrescenta sem gravar (quem chama já grava); key evita duplicados (ex.: aniversário do mesmo dia).
  function add(userId, type, title, body = '', link = null, key = null) {
    const p = db().people.find(x => x.id === userId); if (!p || !isActive(p)) return false;
    if (key && list().some(n => n.userId === userId && n.key === key)) return false;
    const n = { id: newId(), userId, type, title, body, link, at: new Date().toISOString(), read: false, ...(key ? { key } : {}) };
    list().push(n);
    try { onAdd(n); } catch {}
    return true;
  }
  const taskLink = t => ({ page: t.kind === 'routine' ? 'routines' : 'tasks', taskId: t.id });

  // Eventos de tarefas (chamados pelo servidor depois de cada alteração).
  // ids: a quem avisar (por omissão, o responsável principal). Nas tarefas partilhadas, cada pessoa nova é avisada.
  function taskAssigned(task, actor, ids) {
    const list = ids || (task.assignedTo ? [task.assignedTo] : []);
    const others = [task.assignedTo, ...(task.coAssignees || [])].filter(Boolean).length > 1;
    for (const id of list) {
      if (!id || id === actor.id) continue;
      const p = db().people.find(x => x.id === id); if (!p || !canSeeTask(p, task)) continue;
      add(p.id, 'assigned', `${firstName(actor)} atribuiu-te uma tarefa${others ? ' partilhada' : ''}`, task.title, taskLink(task));
    }
  }
  function taskRotated(task, actor) {
    const p = db().people.find(x => x.id === task.assignedTo); if (!p || p.id === actor.id || !canSeeTask(p, task)) return;
    add(p.id, 'rotation', 'É a tua vez', `${task.title}${task.dueDate ? ' · ' + task.dueDate.split('-').reverse().slice(0, 2).join('/') : ''}`, taskLink(task));
  }
  function taskCompleted(task, actor) {
    if (task.kind === 'routine') return; // as rotinas repetem-se: não avisar a cada conclusão
    const who = new Set([task.createdBy]); who.delete(actor.id);
    for (const uid of who) { const p = db().people.find(x => x.id === uid); if (p && canSeeTask(p, task)) add(uid, 'done', `${firstName(actor)} concluiu uma tarefa`, task.title, taskLink(task)); }
  }

  // Pedidos de atribuição a colaboradores (feitos por moradores) e a resposta.
  function assignRequested(task, actor) {
    const rq = task.assignRequest; if (!rq) return; const to = db().people.find(x => x.id === rq.to);
    for (const p of db().people.filter(x => isActive(x) && ['admin', 'manager'].includes(roleOf(x)) && x.id !== actor.id))
      if (canSeeTask(p, task)) add(p.id, 'approval', `${firstName(actor)} pede para atribuir uma tarefa a ${firstName(to)}`, task.title, taskLink(task));
  }
  function assignDecided(task, actor, rq, approved) {
    const to = db().people.find(x => x.id === rq.to);
    add(rq.by, 'approval', approved ? `${firstName(actor)} aprovou: ${firstName(to)} fica com a tarefa` : `${firstName(actor)} não aprovou a atribuição a ${firstName(to)}`, task.title, taskLink(task));
  }

  // Trabalho de colaborador à espera de aprovação, e a resposta.
  function reviewRequested(task, actor) {
    for (const p of db().people.filter(x => isActive(x) && ['admin', 'manager'].includes(roleOf(x)) && x.id !== actor.id))
      if (canSeeTask(p, task)) add(p.id, 'approval', `${firstName(actor)} concluiu: falta aprovar`, task.title, taskLink(task));
  }
  function reviewDecided(task, actor, rv, approved, note) {
    if (rv.by === actor.id) return;
    add(rv.by, 'approval', approved ? `${firstName(actor)} aprovou o teu trabalho` : `${firstName(actor)} pediu para rever o trabalho`, task.title + (note ? ` · ${note}` : ''), taskLink(task));
  }

  // Uma vez por dia: aniversários (hoje e amanhã), tarefas atrasadas/para hoje e, no início do mês, o calendário da casa.
  function daily() {
    const today = todayISO(); const st = state(); if (st.lastDaily === today) return false;
    st.lastDaily = today;
    const people = db().people.filter(isActive);
    const mmdd = today.slice(5), tomorrow = new Date(Date.parse(today + 'T12:00:00Z') + 86400_000).toISOString().slice(5, 10);
    for (const b of people.filter(p => p.birthDate)) {
      const bd = b.birthDate.slice(5);
      for (const p of people.filter(x => roleOf(x) !== 'collaborator')) {
        if (bd === mmdd) add(p.id, 'birthday', p.id === b.id ? `Parabéns, ${firstName(b)}!` : `Hoje é o aniversário de ${firstName(b)}`, p.id === b.id ? 'A casa deseja-te um excelente dia.' : 'Não te esqueças de lhe dar os parabéns.', null, `bday:${b.id}:${today}`);
        else if (bd === tomorrow && p.id !== b.id) add(p.id, 'birthday', `Amanhã é o aniversário de ${firstName(b)}`, '', null, `bday-1:${b.id}:${today}`);
      }
    }
    for (const p of people) {
      const mine = db().tasks.filter(t => t.status !== 'done' && (t.assignedTo === p.id || (t.coAssignees || []).includes(p.id)) && t.dueDate && t.dueDate <= today && canSeeTask(p, t));
      if (!mine.length) continue;
      const late = mine.filter(t => t.dueDate < today).length, now = mine.length - late;
      const parts = []; if (now) parts.push(`${now} para hoje`); if (late) parts.push(`${late} ${late === 1 ? 'atrasada' : 'atrasadas'}`);
      add(p.id, 'due', `Tens ${parts.join(' e ')}`, mine.slice(0, 3).map(t => t.title).join(' · '), { page: 'tasks', filter: 'mine' }, `due:${today}`);
    }
    const month = today.slice(0, 7);
    if (st.lastSeasonal !== month) {
      st.lastSeasonal = month; const m = Number(today.slice(5, 7));
      const items = (db().seasonal || []).filter(x => x.active !== false && x.months.includes(m));
      const MONTHS = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
      if (items.length) for (const p of people.filter(x => ['admin', 'manager'].includes(roleOf(x))))
        add(p.id, 'season', `Calendário da casa: ${MONTHS[m - 1]}`, `${items.length} ${items.length === 1 ? 'trabalho sugerido' : 'trabalhos sugeridos'}: ${items.slice(0, 2).map(x => x.title).join(' · ')}${items.length > 2 ? '…' : ''}`, { page: 'calendar' }, `season:${month}`);
    }
    prune(); save(); return true;
  }

  function forUser(u) { const limit = Date.now() - MAX_AGE_DAYS * 86400_000; return list().filter(n => n.userId === u.id && Date.parse(n.at) > limit).slice(-MAX_PER_USER).reverse().map(({ key, userId, ...n }) => n); }
  function markRead(u, ids) { let n = 0; for (const x of list()) if (x.userId === u.id && !x.read && (ids === 'all' || ids.includes(x.id))) { x.read = true; n++; } return n; }
  function clear(u) { let n = 0; for (const x of list()) if (x.userId === u.id && !x.cleared) { x.cleared = true; x.read = true; n++; } return n; }
  return { add, taskAssigned, taskRotated, taskCompleted, assignRequested, assignDecided, reviewRequested, reviewDecided, daily, forUser, markRead, clear, prune };
}
module.exports = { createNotifications };
