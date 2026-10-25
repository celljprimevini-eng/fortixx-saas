/*
 * Fortixx — módulos Mural e Autoatendimento do dashboard.
 *
 * Carregado por /dashboard/platform (ver src/app/dashboard/_platform/modules.ts).
 * Arquivo estático de propósito: sem script inline (CSP) e sem o escape
 * frágil dos arquivos de uma linha do protótipo. Fala só com /api/mural e
 * /api/autoatendimento; toda checagem de permissão acontece lá no servidor —
 * esconder botão aqui é só conforto de tela.
 */
(function () {
  'use strict';

  var muralView = document.getElementById('view-mural');
  var autoView = document.getElementById('view-autoatendimento');
  if (!muralView && !autoView) return;

  // ── utilidades ────────────────────────────────────────────────────────────
  var $ = function (id) { return document.getElementById(id); };
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function initials(name) {
    return String(name || '?').trim().split(/\s+/).map(function (p) { return p[0]; }).slice(0, 2).join('').toUpperCase();
  }
  function dmy(iso) {
    if (!iso) return '—';
    var d = String(iso).slice(0, 10).split('-');
    return d.length === 3 ? d[2] + '/' + d[1] + '/' + d[0] : '—';
  }
  function dateTime(iso) {
    try {
      return new Date(iso).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
    } catch (e) { return '—'; }
  }
  function ago(iso) {
    var s = Math.max(1, Math.round((Date.now() - new Date(iso).getTime()) / 1000));
    if (s < 60) return 'agora';
    var m = Math.round(s / 60); if (m < 60) return m + ' min';
    var h = Math.round(m / 60); if (h < 24) return h + ' h';
    var d = Math.round(h / 24); if (d < 7) return d + ' d';
    return dmy(iso);
  }
  function todayIso() {
    var d = new Date();
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }
  function api(url, method, body) {
    return fetch(url, {
      method: method || 'GET',
      credentials: 'same-origin',
      headers: body ? { 'Content-Type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    }).then(function (res) {
      return res.json().catch(function () { return {}; }).then(function (data) {
        if (!res.ok) throw new Error(data.error || 'Não deu certo. Tente de novo.');
        return data;
      });
    });
  }
  function confirmAnim(title, sub) {
    return window.__fortixxConfirm ? window.__fortixxConfirm(title, sub) : Promise.resolve();
  }
  function fail(err) { alert(err && err.message ? err.message : 'Não deu certo. Tente de novo.'); }
  /** Desabilita o botão enquanto a promessa roda. */
  function busy(btn, run) {
    if (btn) btn.disabled = true;
    return Promise.resolve().then(run).catch(fail).then(function () { if (btn) btn.disabled = false; });
  }
  function pill(cls, label) { return '<span class="status-pill ' + cls + '">' + esc(label) + '</span>'; }
  function avatar(name, gold) {
    return '<span class="mod-avatar' + (gold ? ' gold' : '') + '" aria-hidden="true">' + esc(initials(name)) + '</span>';
  }
  var ICO = {
    heart: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9"><path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10Z" stroke-linejoin="round"/></svg>',
    heartOn: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10Z"/></svg>',
    chat: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9"><path d="M5 17.5 4 21l3.7-1.2A8 8 0 1 0 5 17.5Z" stroke-linejoin="round"/></svg>',
    pin: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9"><path d="M9 4h6l-1 6 3 3H7l3-3-1-6ZM12 13v7" stroke-linejoin="round" stroke-linecap="round"/></svg>',
    trash: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9"><path d="M5 7h14M10 7V5h4v2M7 7l1 12h8l1-12" stroke-linejoin="round" stroke-linecap="round"/></svg>',
  };

  /** Carrega um módulo quando a view dele fica ativa (e a cada 60 s se continuar aberta). */
  function lazy(view, load) {
    if (!view) return;
    var loadedAt = 0;
    function maybe() {
      if (view.classList.contains('active') && Date.now() - loadedAt > 60000) {
        loadedAt = Date.now();
        load();
      }
    }
    new MutationObserver(maybe).observe(view, { attributes: true, attributeFilter: ['class'] });
    maybe();
    return function force() { loadedAt = Date.now(); return load(); };
  }

  // ══════════════════════════════════════════════════════════════════════════
  // MURAL
  // ══════════════════════════════════════════════════════════════════════════
  var mural = null;
  var openComments = {};

  function renderPost(p) {
    var official = p.kind === 'comunicado';
    var tags = '';
    if (p.pinned) tags += pill('pending', 'Fixado');
    if (official) tags += pill('info', 'Comunicado');
    if (p.kind === 'aniversario') tags += pill('ok', 'Aniversário');

    var body = p.kind === 'aniversario' && p.subject
      ? '<strong>🎉 Parabéns, ' + esc(p.subject.name) + '!</strong>\n' + esc(p.body)
      : esc(p.body);

    var actions =
      '<button class="mod-act' + (p.liked ? ' on' : '') + '" data-act="like" aria-pressed="' + p.liked + '">' + (p.liked ? ICO.heartOn : ICO.heart) + '<span>' + (p.likes || '') + ' Curtir</span></button>' +
      '<button class="mod-act" data-act="comments">' + ICO.chat + '<span>' + (p.comments_count || '') + ' Comentar</span></button>';
    if (mural.me.can_post_official) {
      actions += '<button class="mod-act" data-act="pin">' + ICO.pin + '<span>' + (p.pinned ? 'Desafixar' : 'Fixar') + '</span></button>';
    }
    if (p.can_delete) actions += '<button class="mod-act" data-act="del" style="margin-left:auto">' + ICO.trash + '<span>Apagar</span></button>';

    var comments = '';
    if (openComments[p.id]) {
      comments = '<div class="mod-comments">' +
        p.comments.map(function (c) {
          return '<div class="mod-comment"><strong>' + esc(c.author.name) + '</strong>' + esc(c.body) + '<time>' + ago(c.created_at) + '</time></div>';
        }).join('') +
        '<form class="mod-comment-form" data-comment-form><input class="form-input" maxlength="1000" placeholder="Escreva um comentário…" required aria-label="Comentário"><button class="btn btn-ghost btn-sm" type="submit">Enviar</button></form>' +
        '</div>';
    }

    return '<article class="mod-post glass' + (official ? ' is-official' : '') + '" data-post="' + esc(p.id) + '">' +
      '<div class="mod-post-head">' + avatar(p.author.name, official) +
      '<div class="who"><strong>' + esc(p.author.name) + '</strong><span>' + esc(p.author.job_title || 'Equipe') + ' · ' + ago(p.created_at) + '</span></div>' +
      '<div class="tags">' + tags + '</div></div>' +
      '<div class="mod-post-body">' + body + '</div>' +
      '<div class="mod-post-actions">' + actions + '</div>' + comments + '</article>';
  }

  function renderPoll(poll, compact) {
    var voted = !!poll.my_vote;
    var showResults = voted || poll.closed;
    var opts = poll.options.map(function (o) {
      var pct = poll.total ? Math.round((o.votes / poll.total) * 100) : 0;
      var mine = poll.my_vote === o.id;
      return '<button class="mod-opt' + (mine ? ' mine' : '') + '" data-vote="' + esc(o.id) + '"' + (poll.closed ? ' disabled' : '') + '>' +
        (showResults ? '<i class="bar" style="width:' + pct + '%"></i>' : '') +
        '<span>' + esc(o.label) + (mine ? ' ✓' : '') + '</span>' +
        (showResults ? '<span>' + pct + '%</span>' : '') + '</button>';
    }).join('');
    var meta = poll.total + ' voto' + (poll.total === 1 ? '' : 's') +
      (poll.anonymous ? ' · anônima' : '') +
      (poll.closed ? ' · encerrada' : poll.closes_at ? ' · encerra ' + dmy(poll.closes_at) : '') +
      (voted && !poll.closed ? ' · dá pra trocar o voto' : '');
    var foot = (!compact && poll.can_close && !poll.closed)
      ? '<button class="btn btn-ghost btn-sm" data-close-poll>Encerrar pesquisa</button>' : '';
    return '<div class="mod-poll' + (compact ? '' : ' glass') + '" data-poll="' + esc(poll.id) + '">' +
      '<h4>' + esc(poll.question) + '</h4>' +
      '<div class="mod-poll-meta">por ' + esc(poll.author.name) + ' · ' + meta + '</div>' + opts + foot + '</div>';
  }

  function renderBirthdays(list, max) {
    if (!list.length) return '<p class="muted mod-empty">Ninguém faz aniversário este mês (ou ainda não informou a data).</p>';
    return list.slice(0, max || list.length).map(function (b) {
      var me = b.id === mural.me.id;
      var btn = '';
      if (b.today && !me) {
        btn = b.congratulated
          ? '<span class="muted" style="font-size:.75rem">Parabéns enviado ✓</span>'
          : '<button class="btn btn-gold btn-sm" data-congrats="' + esc(b.id) + '" data-name="' + esc(b.name) + '">Dar parabéns</button>';
      }
      return '<div class="mod-mini' + (b.today ? ' is-today' : '') + '">' + avatar(b.name, b.today) +
        '<div class="who"><strong>' + esc(b.name) + (me ? ' (você)' : '') + '</strong><span>' +
        (b.today ? 'Hoje! 🎂' : 'Dia ' + String(b.day).padStart(2, '0')) + (b.job_title ? ' · ' + esc(b.job_title) : '') + '</span></div>' + btn + '</div>';
    }).join('');
  }

  function renderMural() {
    if (!mural) return;
    $('muralOfficialWrap').hidden = !mural.me.can_post_official;
    $('pollComposer').hidden = !mural.me.can_create_poll;
    if (mural.me.birth_date && !$('birthDate').value) $('birthDate').value = mural.me.birth_date;

    $('muralFeed').innerHTML = mural.posts.length
      ? mural.posts.map(renderPost).join('')
      : '<p class="muted mod-empty">Nada no mural ainda. Que tal a primeira publicação?</p>';

    $('muralPolls').innerHTML = mural.polls.length
      ? mural.polls.map(function (p) { return renderPoll(p, false); }).join('')
      : '<p class="muted mod-empty">Nenhuma pesquisa publicada ainda.</p>';

    var open = mural.polls.filter(function (p) { return !p.closed; })[0];
    $('muralPollSide').innerHTML = open ? renderPoll(open, true) : '<p class="muted mod-empty">Nenhuma pesquisa aberta agora.</p>';

    $('muralBdaySide').innerHTML = renderBirthdays(mural.birthdays, 5);
    $('muralBirthdays').innerHTML = renderBirthdays(mural.birthdays);
  }

  function loadMural() {
    return api('/api/mural').then(function (data) {
      mural = data;
      renderMural();
      setupPush(data.push_public_key);
    }).catch(function (err) {
      $('muralFeed').innerHTML = '<p class="muted mod-empty">Não consegui carregar o mural: ' + esc(err.message) + '</p>';
    });
  }

  var reloadMural = lazy(muralView, loadMural);

  if (muralView) {
    $('muralComposer').addEventListener('submit', function (e) {
      e.preventDefault();
      var btn = e.submitter || this.querySelector('button[type=submit]');
      var text = $('muralBody').value.trim();
      if (!text) return;
      var official = $('muralOfficial').checked;
      busy(btn, function () {
        return api('/api/mural', 'POST', { type: 'post', body: text, comunicado: official }).then(function () {
          $('muralBody').value = '';
          $('muralOfficial').checked = false;
          return confirmAnim(official ? 'Comunicado publicado' : 'Publicado', official ? 'Toda a equipe foi avisada' : undefined);
        }).then(reloadMural);
      });
    });

    // feed: curtir, comentar, fixar, apagar (delegado)
    $('muralFeed').addEventListener('click', function (e) {
      var btn = e.target.closest('[data-act]');
      if (!btn) return;
      var id = btn.closest('[data-post]').dataset.post;
      var post = mural.posts.filter(function (p) { return p.id === id; })[0];
      var act = btn.dataset.act;
      if (act === 'comments') {
        openComments[id] = !openComments[id];
        renderMural();
        if (openComments[id]) {
          var input = document.querySelector('[data-post="' + id + '"] [data-comment-form] input');
          if (input) input.focus();
        }
        return;
      }
      if (act === 'del' && !confirm('Apagar esta publicação?')) return;
      busy(btn, function () {
        if (act === 'like') return api('/api/mural/posts/' + id, 'POST', { action: 'react' });
        if (act === 'pin') return api('/api/mural/posts/' + id, 'POST', { action: 'pin', pinned: !post.pinned });
        if (act === 'del') return api('/api/mural/posts/' + id, 'DELETE');
      }).then(reloadMural);
    });
    $('muralFeed').addEventListener('submit', function (e) {
      var form = e.target.closest('[data-comment-form]');
      if (!form) return;
      e.preventDefault();
      var id = form.closest('[data-post]').dataset.post;
      var input = form.querySelector('input');
      var text = input.value.trim();
      if (!text) return;
      busy(form.querySelector('button'), function () {
        return api('/api/mural/posts/' + id, 'POST', { action: 'comment', body: text }).then(function () {
          openComments[id] = true;
          return reloadMural();
        });
      });
    });

    // enquetes (lista e lateral)
    function onPollClick(e) {
      var opt = e.target.closest('[data-vote]');
      var closeBtn = e.target.closest('[data-close-poll]');
      var box = e.target.closest('[data-poll]');
      if (!box) return;
      var pollId = box.dataset.poll;
      if (opt && !opt.disabled) {
        busy(opt, function () {
          return api('/api/mural/polls/' + pollId, 'POST', { option_id: opt.dataset.vote }).then(reloadMural);
        });
      } else if (closeBtn && confirm('Encerrar esta pesquisa? Ninguém mais vai poder votar.')) {
        busy(closeBtn, function () { return api('/api/mural/polls/' + pollId, 'PATCH').then(reloadMural); });
      }
    }
    $('muralPolls').addEventListener('click', onPollClick);
    $('muralPollSide').addEventListener('click', onPollClick);

    $('pollComposer').addEventListener('submit', function (e) {
      e.preventDefault();
      var options = $('pollOptions').value.split('\n').map(function (s) { return s.trim(); }).filter(Boolean);
      if (options.length < 2 || options.length > 8) return alert('Coloque de 2 a 8 opções, uma por linha.');
      var closes = $('pollCloses').value;
      var payload = {
        type: 'poll',
        question: $('pollQuestion').value.trim(),
        options: options,
        anonymous: $('pollAnonymous').checked,
        closes_at: closes ? new Date(closes + 'T23:59:59').toISOString() : null,
      };
      var form = this;
      busy(form.querySelector('button[type=submit]'), function () {
        return api('/api/mural', 'POST', payload).then(function () {
          form.reset();
          return confirmAnim('Pesquisa publicada', 'A equipe foi avisada');
        }).then(reloadMural);
      });
    });

    // aniversário
    function onCongrats(e) {
      var btn = e.target.closest('[data-congrats]');
      if (!btn) return;
      var first = btn.dataset.name.split(' ')[0];
      var msg = prompt('Mensagem de parabéns para ' + first + ':', 'Feliz aniversário, ' + first + '! 🎉');
      if (!msg || !msg.trim()) return;
      busy(btn, function () {
        return api('/api/mural', 'POST', { type: 'parabens', subject_profile_id: btn.dataset.congrats, body: msg.trim() })
          .then(function () { return confirmAnim('Parabéns enviado 🎉'); }).then(reloadMural);
      });
    }
    $('muralBdaySide').addEventListener('click', onCongrats);
    $('muralBirthdays').addEventListener('click', onCongrats);

    $('birthForm').addEventListener('submit', function (e) {
      e.preventDefault();
      var v = $('birthDate').value || null;
      busy(this.querySelector('button[type=submit]'), function () {
        return api('/api/mural/aniversario', 'PATCH', { birth_date: v }).then(function () {
          return confirmAnim(v ? 'Data salva' : 'Data removida');
        }).then(reloadMural);
      });
    });
  }

  // ── Web Push ──────────────────────────────────────────────────────────────
  var pushReady = false;
  function b64ToBytes(b64) {
    var pad = '='.repeat((4 - (b64.length % 4)) % 4);
    var raw = atob((b64 + pad).replace(/-/g, '+').replace(/_/g, '/'));
    var out = new Uint8Array(raw.length);
    for (var i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
    return out;
  }
  function setupPush(publicKey) {
    var btn = $('muralPushBtn');
    if (pushReady || !btn || !publicKey || !('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) return;
    pushReady = true;
    btn.hidden = false;

    function getSub() {
      return navigator.serviceWorker.register('/push-sw.js', { scope: '/' }).then(function (reg) {
        return navigator.serviceWorker.ready.then(function () { return reg; });
      }).then(function (reg) { return reg.pushManager.getSubscription().then(function (sub) { return { reg: reg, sub: sub }; }); });
    }
    function paint(on) {
      btn.textContent = on ? 'Notificações ativas ✓' : 'Ativar notificações';
      btn.dataset.on = on ? '1' : '';
    }
    getSub().then(function (r) { paint(!!r.sub && Notification.permission === 'granted'); }).catch(function () { btn.hidden = true; });

    btn.addEventListener('click', function () {
      busy(btn, function () {
        if (btn.dataset.on) {
          return getSub().then(function (r) {
            if (!r.sub) return;
            return api('/api/mural/push', 'DELETE', { endpoint: r.sub.endpoint }).then(function () { return r.sub.unsubscribe(); });
          }).then(function () { paint(false); });
        }
        return Notification.requestPermission().then(function (perm) {
          if (perm !== 'granted') throw new Error('As notificações estão bloqueadas neste navegador. Libere nas configurações do site.');
          return getSub();
        }).then(function (r) {
          return r.sub || r.reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64ToBytes(publicKey) });
        }).then(function (sub) {
          var json = sub.toJSON();
          return api('/api/mural/push', 'POST', { endpoint: json.endpoint, keys: json.keys });
        }).then(function () {
          paint(true);
          return confirmAnim('Notificações ativas', 'Você vai receber comunicados e respostas');
        });
      });
    });
  }

  // ══════════════════════════════════════════════════════════════════════════
  // AUTOATENDIMENTO
  // ══════════════════════════════════════════════════════════════════════════
  var auto = null;
  var KIND = { ferias: 'Férias', folga: 'Folga', licenca: 'Licença' };
  var LEAVE_STATUS = { pending: ['pending', 'Aguardando'], approved: ['ok', 'Aprovado'], rejected: ['danger', 'Recusado'], canceled: ['neutral', 'Cancelado'] };
  var SR_CATEGORY = { documento: 'Declaração / documento', holerite: 'Holerite / pagamento', beneficio: 'Benefícios', ponto: 'Ponto / horas', dados_cadastrais: 'Atualizar dados', outro: 'Outro' };
  var SR_STATUS = { open: ['pending', 'Aberta'], in_progress: ['info', 'Em andamento'], done: ['ok', 'Concluída'], rejected: ['danger', 'Recusada'] };
  var SIG_STATUS = { pending: ['pending', 'Pendente'], signed: ['ok', 'Assinado'], declined: ['danger', 'Recusado'] };

  function renderLeaves() {
    var me = auto.me;
    var mine = auto.ferias.filter(function (l) { return l.mine; });
    var toDecide = auto.ferias.filter(function (l) { return l.can_decide; });
    $('leaveSummary').innerHTML =
      '<div class="mod-stat">' + auto.ferias_resumo.aprovados_no_ano + '</div><div class="mod-stat-label">dias de férias aprovados este ano</div>' +
      '<div class="mod-stat">' + auto.ferias_resumo.pendentes + '</div><div class="mod-stat-label">pedido(s) seu(s) aguardando resposta</div>' +
      (toDecide.length || me.is_hr || me.team_size
        ? '<div class="mod-stat">' + toDecide.length + '</div><div class="mod-stat-label">pedido(s) ' + (me.is_hr ? 'da empresa' : 'da sua equipe') + ' esperando você</div>'
        : '');

    $('leaveListTitle').textContent = me.is_hr ? 'Pedidos da empresa' : me.team_size ? 'Seus pedidos e da sua equipe' : 'Seus pedidos';
    var list = auto.ferias.slice().sort(function (a, b) { return (b.can_decide ? 1 : 0) - (a.can_decide ? 1 : 0); });
    $('leaveList').innerHTML = list.length ? list.map(function (l) {
      var st = LEAVE_STATUS[l.status];
      var acts = '';
      if (l.can_decide) {
        acts = '<button class="btn btn-primary btn-sm" data-leave="' + esc(l.id) + '" data-to="approved">Aprovar</button>' +
          '<button class="btn btn-danger-ghost btn-sm" data-leave="' + esc(l.id) + '" data-to="rejected">Recusar</button>';
      } else if (l.mine && l.status === 'pending') {
        acts = '<button class="btn btn-ghost btn-sm" data-leave="' + esc(l.id) + '" data-to="canceled">Cancelar pedido</button>';
      }
      var who = l.mine ? '' : esc(l.person) + ' · ';
      var decided = l.decided_by_name && l.status !== 'pending' && l.status !== 'canceled'
        ? '<p>' + (l.status === 'approved' ? 'Aprovado' : 'Recusado') + ' por ' + esc(l.decided_by_name) + (l.decision_note ? ': “' + esc(l.decision_note) + '”' : '') + '</p>' : '';
      return '<div class="mod-row"><div class="main"><strong>' + who + KIND[l.kind] + ' · ' + l.days + ' dia(s)</strong>' +
        '<span>' + dmy(l.start_date) + ' a ' + dmy(l.end_date) + ' · pedido em ' + dmy(l.created_at) + '</span>' +
        (l.note ? '<p>' + esc(l.note) + '</p>' : '') + decided + '</div>' + pill(st[0], st[1]) + '<div class="acts">' + acts + '</div></div>';
    }).join('') : '<p class="muted mod-empty">Nenhum pedido ainda.</p>';
  }

  function renderRequests() {
    var hr = auto.me.is_hr;
    $('srListTitle').textContent = hr ? 'Solicitações da empresa' : 'Suas solicitações';
    $('srForm').querySelector('.panel-head h3').textContent = 'Nova solicitação';
    $('srList').innerHTML = auto.solicitacoes.length ? auto.solicitacoes.map(function (r) {
      var st = SR_STATUS[r.status];
      var acts = '';
      if (hr && r.status !== 'done' && r.status !== 'rejected') {
        if (r.status === 'open') acts += '<button class="btn btn-ghost btn-sm" data-sr="' + esc(r.id) + '" data-to="in_progress">Assumir</button>';
        acts += '<button class="btn btn-primary btn-sm" data-sr="' + esc(r.id) + '" data-to="done">Responder e concluir</button>' +
          '<button class="btn btn-danger-ghost btn-sm" data-sr="' + esc(r.id) + '" data-to="rejected">Recusar</button>';
      }
      return '<div class="mod-row"><div class="main"><strong>' + (hr && !r.mine ? esc(r.person) + ' · ' : '') + esc(r.subject) + '</strong>' +
        '<span>' + esc(SR_CATEGORY[r.category] || r.category) + ' · ' + dateTime(r.created_at) + '</span>' +
        '<p>' + esc(r.body) + '</p>' +
        (r.response ? '<p><strong style="display:inline">Resposta' + (r.handled_by_name ? ' de ' + esc(r.handled_by_name) : '') + ':</strong> ' + esc(r.response) + '</p>' : '') +
        '</div>' + pill(st[0], st[1]) + '<div class="acts">' + acts + '</div></div>';
    }).join('') : '<p class="muted mod-empty">Nenhuma solicitação ainda.</p>';
  }

  function renderEvents() {
    var hr = auto.me.is_hr;
    $('eventForm').hidden = !hr;
    $('eventList').innerHTML = auto.eventos.length ? auto.eventos.map(function (ev) {
      var seats = ev.capacity ? ev.registered + ' de ' + ev.capacity + ' vagas' : ev.registered + ' inscrito(s)';
      var btn;
      if (ev.past) btn = pill('neutral', 'Já aconteceu');
      else if (ev.me_registered) btn = '<button class="btn btn-ghost btn-sm" data-ev="' + esc(ev.id) + '">Cancelar inscrição</button>';
      else if (ev.full) btn = pill('danger', 'Esgotado');
      else btn = '<button class="btn btn-primary btn-sm" data-ev="' + esc(ev.id) + '">Quero participar</button>';
      var admin = hr
        ? '<details style="font-size:.78rem;color:var(--text-2)"><summary style="cursor:pointer">Inscritos</summary>' +
          (ev.attendees && ev.attendees.length ? esc(ev.attendees.join(', ')) : 'Ninguém ainda.') + '</details>' +
          '<button class="mod-act" data-ev-del="' + esc(ev.id) + '">' + ICO.trash + '<span>Apagar</span></button>'
        : '';
      return '<div class="mod-card glass"><div class="when">' + dateTime(ev.starts_at) + (ev.ends_at ? ' – ' + (dmy(ev.ends_at) === dmy(ev.starts_at) ? new Date(ev.ends_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : dateTime(ev.ends_at)) : '') + '</div>' +
        '<h4>' + esc(ev.title) + '</h4>' + (ev.location ? '<p>📍 ' + esc(ev.location) + '</p>' : '') +
        (ev.description ? '<p>' + esc(ev.description) + '</p>' : '') +
        '<div class="foot"><span class="muted" style="font-size:.78rem">' + seats + (ev.me_registered ? ' · você vai ✓' : '') + '</span>' + btn + '</div>' + admin + '</div>';
    }).join('') : '<p class="muted mod-empty">Nenhum evento marcado.</p>';
  }

  function renderSignatures() {
    var hr = auto.me.is_hr;
    $('sigForm').hidden = !hr;
    var mine = auto.assinaturas.filter(function (s) { return s.mine; });
    var html = mine.length ? mine.map(function (s) {
      var st = SIG_STATUS[s.status];
      var body = '<div class="mod-doc">' + esc(s.content) + '</div>';
      var acts = '';
      if (s.status === 'pending') {
        acts = '<form class="mod-comment-form" data-sign="' + esc(s.id) + '">' +
          '<input class="form-input" placeholder="Digite seu nome completo para assinar" required aria-label="Nome completo">' +
          '<button class="btn btn-primary btn-sm" type="submit">Assinar</button>' +
          '<button class="btn btn-danger-ghost btn-sm" type="button" data-decline="' + esc(s.id) + '">Recusar</button></form>';
      } else if (s.status === 'signed') {
        acts = '<p class="muted" style="font-size:.76rem">Assinado por ' + esc(s.signed_name) + ' em ' + dateTime(s.signed_at) +
          (s.signer_ip ? ' · IP ' + esc(s.signer_ip) : '') + '</p><div class="mod-hash">Código do documento (SHA-256): ' + esc(s.content_hash) + '</div>';
      }
      return '<div class="mod-row" style="display:block"><div style="display:flex;justify-content:space-between;gap:10px;align-items:center">' +
        '<div class="main"><strong>' + esc(s.title) + '</strong><span>Enviado por ' + esc(s.requested_by_name || 'RH') + ' em ' + dmy(s.created_at) + '</span></div>' +
        pill(st[0], st[1]) + '</div>' + body + acts + '</div>';
    }).join('') : '<p class="muted mod-empty">Nenhum documento para você assinar.</p>';

    if (hr) {
      var groups = {};
      auto.assinaturas.forEach(function (s) {
        var g = groups[s.content_hash] || (groups[s.content_hash] = { title: s.title, at: s.created_at, signed: [], pending: [], declined: [] });
        g[s.status].push(s.person);
      });
      var keys = Object.keys(groups);
      html += '<div class="panel-head" style="margin-top:22px"><h3>Acompanhamento (RH)</h3></div>' + (keys.length ? keys.map(function (k) {
        var g = groups[k];
        var total = g.signed.length + g.pending.length + g.declined.length;
        return '<div class="mod-row"><div class="main"><strong>' + esc(g.title) + '</strong><span>Enviado em ' + dmy(g.at) + ' · ' +
          g.signed.length + ' de ' + total + ' assinaram' + (g.declined.length ? ' · ' + g.declined.length + ' recusaram' : '') + '</span>' +
          (g.pending.length ? '<p>Faltam: ' + esc(g.pending.join(', ')) + '</p>' : '') + '</div>' +
          pill(g.pending.length ? 'pending' : 'ok', g.pending.length ? 'Em andamento' : 'Concluído') + '</div>';
      }).join('') : '<p class="muted mod-empty">Nenhum documento enviado ainda.</p>');
    }
    $('sigListTitle').textContent = 'Para você assinar';
    $('sigList').innerHTML = html;
  }

  function renderAuto() {
    if (!auto) return;
    renderLeaves();
    renderRequests();
    renderEvents();
    renderSignatures();
  }

  function loadAuto() {
    return api('/api/autoatendimento').then(function (data) { auto = data; renderAuto(); }).catch(function (err) {
      $('leaveList').innerHTML = '<p class="muted mod-empty">Não consegui carregar: ' + esc(err.message) + '</p>';
    });
  }
  var reloadAuto = lazy(autoView, loadAuto);

  if (autoView) {
    // férias: contador de dias ao vivo
    function updateDays() {
      var a = $('leaveStart').value, b = $('leaveEnd').value;
      if (!a || !b) { $('leaveDays').textContent = '—'; return; }
      var n = Math.round((Date.parse(b + 'T12:00:00Z') - Date.parse(a + 'T12:00:00Z')) / 86400000) + 1;
      $('leaveDays').textContent = n > 0 ? n + ' dia(s)' : 'data final antes da inicial';
    }
    $('leaveStart').min = todayIso();
    $('leaveEnd').min = todayIso();
    $('leaveStart').addEventListener('change', function () { $('leaveEnd').min = this.value || todayIso(); updateDays(); });
    $('leaveEnd').addEventListener('change', updateDays);

    $('leaveForm').addEventListener('submit', function (e) {
      e.preventDefault();
      var form = this;
      var payload = {
        type: 'ferias',
        kind: $('leaveKind').value,
        start_date: $('leaveStart').value,
        end_date: $('leaveEnd').value,
        note: $('leaveNote').value.trim() || undefined,
      };
      busy(form.querySelector('button[type=submit]'), function () {
        return api('/api/autoatendimento', 'POST', payload).then(function (r) {
          form.reset(); updateDays();
          return confirmAnim('Pedido enviado', r.days + ' dia(s) — seu gestor e o RH foram avisados');
        }).then(reloadAuto);
      });
    });
    $('leaveList').addEventListener('click', function (e) {
      var btn = e.target.closest('[data-leave]');
      if (!btn) return;
      var to = btn.dataset.to;
      var note;
      if (to === 'rejected') {
        note = prompt('Motivo da recusa (o colaborador vai ver):');
        if (note === null) return;
      } else if (to === 'canceled' && !confirm('Cancelar este pedido?')) return;
      busy(btn, function () {
        return api('/api/autoatendimento/ferias/' + btn.dataset.leave, 'PATCH', { status: to, decision_note: note || undefined })
          .then(function () { return to === 'approved' ? confirmAnim('Pedido aprovado', 'O colaborador foi avisado') : null; })
          .then(reloadAuto);
      });
    });

    $('srForm').addEventListener('submit', function (e) {
      e.preventDefault();
      var form = this;
      var payload = { type: 'solicitacao', category: $('srCategory').value, subject: $('srSubject').value.trim(), body: $('srBody').value.trim() };
      busy(form.querySelector('button[type=submit]'), function () {
        return api('/api/autoatendimento', 'POST', payload).then(function () {
          form.reset();
          return confirmAnim('Solicitação enviada', 'O RH foi avisado');
        }).then(reloadAuto);
      });
    });
    $('srList').addEventListener('click', function (e) {
      var btn = e.target.closest('[data-sr]');
      if (!btn) return;
      var to = btn.dataset.to;
      var response;
      if (to === 'done' || to === 'rejected') {
        response = prompt(to === 'done' ? 'Resposta para o colaborador:' : 'Motivo da recusa:');
        if (response === null) return;
      }
      busy(btn, function () {
        return api('/api/autoatendimento/solicitacoes/' + btn.dataset.sr, 'PATCH', { status: to, response: response || undefined })
          .then(function () { return to === 'done' ? confirmAnim('Solicitação concluída') : null; })
          .then(reloadAuto);
      });
    });

    $('eventForm').addEventListener('submit', function (e) {
      e.preventDefault();
      var form = this;
      var cap = $('evCapacity').value;
      var payload = {
        type: 'evento',
        title: $('evTitle').value.trim(),
        location: $('evLocation').value.trim() || undefined,
        description: $('evDescription').value.trim() || undefined,
        starts_at: new Date($('evStart').value).toISOString(),
        ends_at: $('evEnd').value ? new Date($('evEnd').value).toISOString() : null,
        capacity: cap ? Number(cap) : null,
      };
      busy(form.querySelector('button[type=submit]'), function () {
        return api('/api/autoatendimento', 'POST', payload).then(function () {
          form.reset();
          return confirmAnim('Evento criado', 'A equipe foi avisada');
        }).then(reloadAuto);
      });
    });
    $('eventList').addEventListener('click', function (e) {
      var join = e.target.closest('[data-ev]');
      var del = e.target.closest('[data-ev-del]');
      if (join) {
        busy(join, function () {
          return api('/api/autoatendimento/eventos/' + join.dataset.ev, 'POST').then(function (r) {
            return r.registered ? confirmAnim('Inscrição feita', 'Te esperamos lá') : null;
          }).then(reloadAuto);
        });
      } else if (del && confirm('Apagar este evento? As inscrições também somem.')) {
        busy(del, function () { return api('/api/autoatendimento/eventos/' + del.dataset.evDel, 'DELETE').then(reloadAuto); });
      }
    });

    $('sigForm').addEventListener('submit', function (e) {
      e.preventDefault();
      var form = this;
      if (!confirm('Enviar para todos os colaboradores ativos assinarem?')) return;
      var payload = { type: 'assinatura', title: $('sigTitle').value.trim(), content: $('sigContent').value.trim() };
      busy(form.querySelector('button[type=submit]'), function () {
        return api('/api/autoatendimento', 'POST', payload).then(function (r) {
          form.reset();
          return confirmAnim('Enviado para assinatura', r.count + ' pessoa(s)');
        }).then(reloadAuto);
      });
    });
    $('sigList').addEventListener('submit', function (e) {
      var form = e.target.closest('[data-sign]');
      if (!form) return;
      e.preventDefault();
      var name = form.querySelector('input').value.trim();
      busy(form.querySelector('button[type=submit]'), function () {
        return api('/api/autoatendimento/assinaturas/' + form.dataset.sign, 'POST', { action: 'sign', signed_name: name })
          .then(function () { return confirmAnim('Documento assinado', 'Comprovante registrado'); })
          .then(reloadAuto);
      });
    });
    $('sigList').addEventListener('click', function (e) {
      var btn = e.target.closest('[data-decline]');
      if (!btn || !confirm('Recusar a assinatura deste documento? O RH vai ser avisado.')) return;
      busy(btn, function () {
        return api('/api/autoatendimento/assinaturas/' + btn.dataset.decline, 'POST', { action: 'decline' }).then(reloadAuto);
      });
    });
  }
})();
