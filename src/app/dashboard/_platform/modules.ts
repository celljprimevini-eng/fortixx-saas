/**
 * Módulos Mural e Autoatendimento do dashboard.
 *
 * O protótipo da plataforma (body.ts/script.ts/style.ts) é um HTML vanilla
 * de arquivo único em strings de uma linha só — editar ali é frágil. Os
 * módulos novos ficam aqui, em template strings normais (sem `${}` dentro),
 * e o route.ts encaixa no HTML:
 *   - MODULE_DOCK_ITEMS entra no dock, antes de Analytics;
 *   - MODULE_VIEWS entra antes da <section id="view-analytics">;
 *   - MODULE_STYLE entra no fim do <style>.
 * Toda a lógica de tela mora em /public/fortixx-modules.js (arquivo estático,
 * carregado com <script src>, sem inline), que busca dados em /api/mural e
 * /api/autoatendimento. Navegação e subabas usam os handlers genéricos que já
 * existem no script.ts (.dock-item[data-view] e .subtab[data-sub]).
 */

export const MODULE_VIEW_IDS = ['view-mural', 'view-autoatendimento'] as const;

export const MODULE_DOCK_ITEMS = `
      <button class="dock-item" data-view="view-mural" data-label="Mural">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M4 10v4a1 1 0 0 0 1 1h2l5 4V5L7 9H5a1 1 0 0 0-1 1Z" stroke-linejoin="round"/><path d="M16 9a3.5 3.5 0 0 1 0 6M18.5 6.5a7 7 0 0 1 0 11" stroke-linecap="round"/></svg>
        <span class="dock-active-dot"></span><span class="dock-label">Mural</span>
      </button>
      <button class="dock-item" data-view="view-autoatendimento" data-label="Autoatendimento">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="4" y="5" width="16" height="15" rx="2"/><path d="M4 10h16M9 3v4M15 3v4M8.5 14.5l2 2 4-4" stroke-linecap="round" stroke-linejoin="round"/></svg>
        <span class="dock-active-dot"></span><span class="dock-label">Autoatendimento</span>
      </button>
`;

export const MODULE_VIEWS = `
    <!-- ======================= MURAL ======================= -->
    <section class="view" id="view-mural" data-module="mural">
      <div class="view-head">
        <div><h1 class="view-title">Mural</h1><p class="view-sub">Comunicados, conversas e pesquisas da empresa, num lugar só.</p></div>
        <button class="btn btn-ghost btn-sm" id="muralPushBtn" type="button" hidden>Ativar notificações</button>
      </div>

      <div class="subtabs">
        <button class="subtab active" data-sub="mur-feed">Feed</button>
        <button class="subtab" data-sub="mur-pesquisas">Pesquisas</button>
        <button class="subtab" data-sub="mur-aniversarios">Aniversariantes</button>
      </div>

      <div class="subviews">
        <div class="subview active" id="mur-feed">
          <div class="dash-row">
            <div>
              <form class="panel glass mod-composer" id="muralComposer" autocomplete="off">
                <label class="form-label" for="muralBody">Escreva para a empresa</label>
                <textarea class="form-input mod-textarea" id="muralBody" maxlength="4000" rows="3" placeholder="Compartilhe uma novidade, um agradecimento ou um aviso…" required></textarea>
                <div class="mod-composer-foot">
                  <label class="mod-check" id="muralOfficialWrap" hidden><input type="checkbox" id="muralOfficial"> Comunicado oficial (fixa no topo e avisa todo mundo)</label>
                  <button class="btn btn-primary btn-sm" type="submit">Publicar</button>
                </div>
              </form>
              <div id="muralFeed" class="mod-list" aria-live="polite"><p class="muted mod-empty">Carregando o mural…</p></div>
            </div>
            <div>
              <div class="panel glass">
                <div class="panel-head"><h3>Aniversariantes do mês</h3></div>
                <div id="muralBdaySide" class="mod-mini-list"><p class="muted mod-empty">—</p></div>
              </div>
              <div class="panel glass" style="margin-top:16px">
                <div class="panel-head"><h3>Pesquisa em aberto</h3></div>
                <div id="muralPollSide"><p class="muted mod-empty">—</p></div>
              </div>
            </div>
          </div>
        </div>

        <div class="subview" id="mur-pesquisas">
          <form class="panel glass mod-composer" id="pollComposer" autocomplete="off" hidden>
            <div class="panel-head"><h3>Nova pesquisa</h3></div>
            <div class="form-field"><label class="form-label" for="pollQuestion">Pergunta</label><input class="form-input" id="pollQuestion" maxlength="300" required placeholder="Ex.: Qual o melhor horário para a confraternização?"></div>
            <div class="form-field" style="margin-top:12px"><label class="form-label" for="pollOptions">Opções (uma por linha, de 2 a 8)</label><textarea class="form-input mod-textarea" id="pollOptions" rows="4" required placeholder="Sexta à tarde&#10;Sábado de manhã"></textarea></div>
            <div class="mod-composer-foot">
              <label class="mod-check"><input type="checkbox" id="pollAnonymous"> Anônima (ninguém vê quem votou em quê)</label>
              <label class="mod-check">Encerra em <input class="form-input mod-inline-input" type="date" id="pollCloses"></label>
              <button class="btn btn-primary btn-sm" type="submit">Publicar pesquisa</button>
            </div>
          </form>
          <div id="muralPolls" class="mod-list"><p class="muted mod-empty">Carregando…</p></div>
        </div>

        <div class="subview" id="mur-aniversarios">
          <div class="dash-row">
            <div class="panel glass">
              <div class="panel-head"><h3>Aniversariantes do mês</h3></div>
              <div id="muralBirthdays" class="mod-mini-list"><p class="muted mod-empty">Carregando…</p></div>
            </div>
            <form class="panel glass" id="birthForm" autocomplete="off">
              <div class="panel-head"><h3>Seu aniversário</h3></div>
              <p class="muted" style="font-size:.82rem;margin-bottom:12px">Pros colegas aparece só o dia e o mês. Deixe em branco se preferir não aparecer.</p>
              <div class="form-field"><label class="form-label" for="birthDate">Data de nascimento</label><input class="form-input" type="date" id="birthDate"></div>
              <button class="btn btn-primary btn-sm" type="submit" style="margin-top:14px">Salvar</button>
            </form>
          </div>
        </div>
      </div>
    </section>

    <!-- =================== AUTOATENDIMENTO =================== -->
    <section class="view" id="view-autoatendimento" data-module="autoatendimento">
      <div class="view-head">
        <div><h1 class="view-title">Autoatendimento</h1><p class="view-sub">Peça férias, fale com o RH, inscreva-se em eventos e assine documentos sem papel.</p></div>
      </div>

      <div class="subtabs">
        <button class="subtab active" data-sub="aut-ferias">Férias e folgas</button>
        <button class="subtab" data-sub="aut-solicitacoes">Solicitações ao RH</button>
        <button class="subtab" data-sub="aut-eventos">Eventos</button>
        <button class="subtab" data-sub="aut-assinaturas">Assinaturas</button>
      </div>

      <div class="subviews">
        <div class="subview active" id="aut-ferias">
          <div class="dash-row">
            <form class="panel glass" id="leaveForm" autocomplete="off">
              <div class="panel-head"><h3>Novo pedido</h3></div>
              <div class="mod-grid2">
                <div class="form-field"><label class="form-label" for="leaveKind">Tipo</label>
                  <select class="form-input" id="leaveKind"><option value="ferias">Férias</option><option value="folga">Folga</option><option value="licenca">Licença</option></select></div>
                <div class="form-field"><label class="form-label">Dias</label><div class="form-input mod-readonly" id="leaveDays">—</div></div>
                <div class="form-field"><label class="form-label" for="leaveStart">Início</label><input class="form-input" type="date" id="leaveStart" required></div>
                <div class="form-field"><label class="form-label" for="leaveEnd">Fim</label><input class="form-input" type="date" id="leaveEnd" required></div>
              </div>
              <div class="form-field" style="margin-top:12px"><label class="form-label" for="leaveNote">Observação (opcional)</label><input class="form-input" id="leaveNote" maxlength="1000"></div>
              <p class="muted mod-hint">CLT: as férias podem ser divididas em até 3 períodos — um de no mínimo 14 dias e os outros de no mínimo 5.</p>
              <button class="btn btn-primary btn-sm" type="submit" style="margin-top:12px">Enviar pedido</button>
            </form>
            <div class="panel glass">
              <div class="panel-head"><h3>Seu resumo</h3></div>
              <div id="leaveSummary"><p class="muted mod-empty">Carregando…</p></div>
            </div>
          </div>
          <div class="panel glass">
            <div class="panel-head"><h3 id="leaveListTitle">Seus pedidos</h3></div>
            <div id="leaveList" class="mod-list"><p class="muted mod-empty">Carregando…</p></div>
          </div>
        </div>

        <div class="subview" id="aut-solicitacoes">
          <form class="panel glass" id="srForm" autocomplete="off">
            <div class="panel-head"><h3>Nova solicitação</h3></div>
            <div class="mod-grid2">
              <div class="form-field"><label class="form-label" for="srCategory">Assunto</label>
                <select class="form-input" id="srCategory">
                  <option value="documento">Declaração / documento</option>
                  <option value="holerite">Holerite / pagamento</option>
                  <option value="beneficio">Benefícios</option>
                  <option value="ponto">Ponto / horas</option>
                  <option value="dados_cadastrais">Atualizar meus dados</option>
                  <option value="outro">Outro</option>
                </select></div>
              <div class="form-field"><label class="form-label" for="srSubject">Título</label><input class="form-input" id="srSubject" maxlength="160" required placeholder="Ex.: Declaração de vínculo pro banco"></div>
            </div>
            <div class="form-field" style="margin-top:12px"><label class="form-label" for="srBody">Detalhes</label><textarea class="form-input mod-textarea" id="srBody" rows="3" maxlength="4000" required></textarea></div>
            <button class="btn btn-primary btn-sm" type="submit" style="margin-top:12px">Enviar ao RH</button>
          </form>
          <div class="panel glass" style="margin-top:16px">
            <div class="panel-head"><h3 id="srListTitle">Suas solicitações</h3></div>
            <div id="srList" class="mod-list"><p class="muted mod-empty">Carregando…</p></div>
          </div>
        </div>

        <div class="subview" id="aut-eventos">
          <form class="panel glass" id="eventForm" autocomplete="off" hidden>
            <div class="panel-head"><h3>Novo evento ou treinamento</h3></div>
            <div class="mod-grid2">
              <div class="form-field"><label class="form-label" for="evTitle">Título</label><input class="form-input" id="evTitle" maxlength="160" required></div>
              <div class="form-field"><label class="form-label" for="evLocation">Local</label><input class="form-input" id="evLocation" maxlength="200" placeholder="Sala 2, auditório, link…"></div>
              <div class="form-field"><label class="form-label" for="evStart">Começa</label><input class="form-input" type="datetime-local" id="evStart" required></div>
              <div class="form-field"><label class="form-label" for="evEnd">Termina (opcional)</label><input class="form-input" type="datetime-local" id="evEnd"></div>
              <div class="form-field"><label class="form-label" for="evCapacity">Vagas (opcional)</label><input class="form-input" type="number" min="1" id="evCapacity"></div>
            </div>
            <div class="form-field" style="margin-top:12px"><label class="form-label" for="evDescription">Descrição</label><textarea class="form-input mod-textarea" id="evDescription" rows="2" maxlength="4000"></textarea></div>
            <button class="btn btn-primary btn-sm" type="submit" style="margin-top:12px">Criar e avisar a equipe</button>
          </form>
          <div id="eventList" class="mod-cards"><p class="muted mod-empty">Carregando…</p></div>
        </div>

        <div class="subview" id="aut-assinaturas">
          <form class="panel glass" id="sigForm" autocomplete="off" hidden>
            <div class="panel-head"><h3>Enviar documento para assinatura</h3></div>
            <div class="form-field"><label class="form-label" for="sigTitle">Título</label><input class="form-input" id="sigTitle" maxlength="160" required placeholder="Ex.: Termo de recebimento de EPI"></div>
            <div class="form-field" style="margin-top:12px"><label class="form-label" for="sigContent">Texto que será assinado</label><textarea class="form-input mod-textarea" id="sigContent" rows="6" maxlength="20000" required></textarea></div>
            <p class="muted mod-hint">Vai para todos os colaboradores ativos. Cada um assina digitando o nome completo, logado com 2FA. Fica registrado data, hora, IP e o código (hash) do texto — assinatura eletrônica simples, Lei 14.063/2020.</p>
            <button class="btn btn-primary btn-sm" type="submit" style="margin-top:12px">Enviar para assinatura</button>
          </form>
          <div class="panel glass" style="margin-top:16px">
            <div class="panel-head"><h3 id="sigListTitle">Para você assinar</h3></div>
            <div id="sigList" class="mod-list"><p class="muted mod-empty">Carregando…</p></div>
          </div>
        </div>
      </div>
    </section>
`;

export const MODULE_STYLE = `
/* ===== Módulos Mural / Autoatendimento ===== */
[data-module] [hidden] { display: none !important; }
.mod-composer { display: flex; flex-direction: column; gap: 10px; margin-bottom: 16px; }
.mod-textarea { resize: vertical; min-height: 72px; line-height: 1.5; font-family: inherit; }
.mod-composer-foot { display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap; }
.mod-check { display: inline-flex; align-items: center; gap: 8px; font-size: .8rem; color: var(--text-2); cursor: pointer; }
.mod-check input[type=checkbox] { width: 16px; height: 16px; accent-color: var(--blue); }
.mod-inline-input { width: auto; padding: 6px 10px; }
.mod-list { display: flex; flex-direction: column; gap: 12px; }
.mod-empty { font-size: .85rem; padding: 6px 0; }
.mod-hint { font-size: .76rem; margin-top: 10px; line-height: 1.45; }
.mod-grid2 { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
.mod-readonly { display: flex; align-items: center; color: var(--text-2); }
.mod-post { padding: 18px 20px; border-radius: var(--radius-md); }
.mod-post.is-official { border-color: rgba(251,191,36,.45); box-shadow: 0 0 0 1px rgba(251,191,36,.18) inset; }
.mod-post-head { display: flex; align-items: center; gap: 10px; margin-bottom: 10px; }
.mod-post-head .who { display: flex; flex-direction: column; line-height: 1.25; min-width: 0; }
.mod-post-head .who strong { font-size: .9rem; }
.mod-post-head .who span { font-size: .74rem; color: var(--text-3); }
.mod-post-head .tags { margin-left: auto; display: flex; gap: 6px; align-items: center; }
.mod-post-body { font-size: .9rem; line-height: 1.6; white-space: pre-wrap; word-break: break-word; color: var(--text-1); }
.mod-post-actions { display: flex; gap: 6px; margin-top: 12px; flex-wrap: wrap; }
.mod-act { background: none; border: 1px solid transparent; color: var(--text-2); font-size: .8rem; font-weight: 600; padding: 6px 10px; border-radius: 100px; cursor: pointer; display: inline-flex; align-items: center; gap: 6px; }
.mod-act:hover { background: var(--surface); border-color: var(--border); }
.mod-act.on { color: var(--gold); }
.mod-act svg { width: 16px; height: 16px; }
.mod-comments { margin-top: 12px; border-top: 1px solid var(--border); padding-top: 10px; display: flex; flex-direction: column; gap: 8px; }
.mod-comment { font-size: .82rem; line-height: 1.5; }
.mod-comment strong { margin-right: 6px; }
.mod-comment time { color: var(--text-3); font-size: .72rem; margin-left: 6px; }
.mod-comment-form { display: flex; gap: 8px; margin-top: 4px; }
.mod-comment-form input { flex: 1; padding: 8px 12px; }
.mod-avatar { width: 36px; height: 36px; border-radius: 50%; display: grid; place-items: center; font-size: .76rem; font-weight: 700; color: #fff; flex-shrink: 0; background: linear-gradient(135deg, var(--blue), var(--blue-deep)); }
.mod-avatar.gold { background: linear-gradient(135deg, var(--gold), #F59E0B); color: #1a1300; }
.mod-mini-list { display: flex; flex-direction: column; gap: 10px; }
.mod-mini { display: flex; align-items: center; gap: 10px; }
.mod-mini .who { flex: 1; min-width: 0; line-height: 1.3; }
.mod-mini .who strong { display: block; font-size: .85rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.mod-mini .who span { font-size: .74rem; color: var(--text-3); }
.mod-mini.is-today { padding: 8px 10px; margin: 0 -10px; border-radius: 12px; background: rgba(251,191,36,.10); }
.mod-poll { padding: 18px 20px; border-radius: var(--radius-md); }
.mod-poll h4 { font-family: var(--font-display); font-weight: 600; font-size: .98rem; margin-bottom: 4px; }
.mod-poll-meta { font-size: .74rem; color: var(--text-3); margin-bottom: 12px; }
.mod-opt { position: relative; display: flex; justify-content: space-between; align-items: center; width: 100%; text-align: left; padding: 10px 14px; margin-bottom: 8px; border-radius: 12px; border: 1px solid var(--border); background: var(--surface); color: var(--text-1); font-size: .85rem; cursor: pointer; overflow: hidden; }
.mod-opt[disabled] { cursor: default; }
.mod-opt .bar { position: absolute; inset: 0 auto 0 0; background: rgba(91,141,239,.16); z-index: 0; transition: width .5s var(--ease); }
.mod-opt.mine { border-color: var(--blue-light); }
.mod-opt.mine .bar { background: rgba(91,141,239,.28); }
.mod-opt > span { position: relative; z-index: 1; }
.mod-row { display: flex; align-items: center; gap: 12px; padding: 12px 0; border-bottom: 1px solid var(--border); flex-wrap: wrap; }
.mod-row:last-child { border-bottom: 0; }
.mod-row .main { flex: 1; min-width: 200px; }
.mod-row .main strong { display: block; font-size: .88rem; }
.mod-row .main span { font-size: .78rem; color: var(--text-3); }
.mod-row .main p { font-size: .82rem; color: var(--text-2); margin-top: 4px; white-space: pre-wrap; }
.mod-row .acts { display: flex; gap: 6px; flex-wrap: wrap; }
.mod-cards { display: grid; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); gap: 16px; margin-top: 16px; }
.mod-card { padding: 18px 20px; border-radius: var(--radius-md); display: flex; flex-direction: column; gap: 8px; }
.mod-card h4 { font-family: var(--font-display); font-weight: 600; font-size: .98rem; }
.mod-card .when { font-size: .8rem; color: var(--blue-light); font-weight: 600; }
.mod-card p { font-size: .82rem; color: var(--text-2); line-height: 1.5; }
.mod-card .foot { margin-top: auto; display: flex; align-items: center; justify-content: space-between; gap: 8px; padding-top: 6px; }
.mod-stat { font-family: var(--font-display); font-size: 1.6rem; font-weight: 700; }
.mod-stat-label { font-size: .78rem; color: var(--text-3); margin-bottom: 14px; }
.mod-doc { max-height: 220px; overflow: auto; padding: 12px 14px; border-radius: 12px; background: var(--surface); border: 1px solid var(--border); font-size: .82rem; line-height: 1.6; white-space: pre-wrap; margin: 8px 0; }
.mod-hash { font-family: var(--font-mono); font-size: .7rem; color: var(--text-3); word-break: break-all; }
@media (max-width: 760px) { .mod-grid2 { grid-template-columns: 1fr; } }
/* Dock com 9 itens: no celular os ícones encolhiam pra ~10px. Aperta o
   espaçamento e fixa o ícone em 20px, cada item dividindo a largura. */
@media (max-width: 560px) {
  .dock { gap: 2px; padding: 8px 6px; }
  .dock-item { padding: 10px 3px; flex: 1 1 0; min-width: 0; }
  .dock-item svg { width: 20px; height: 20px; flex-shrink: 0; }
  .mod-post-head { flex-wrap: wrap; }
  .mod-post-head .tags { width: 100%; margin-left: 46px; }
}
`;
