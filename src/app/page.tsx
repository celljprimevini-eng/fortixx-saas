import Link from 'next/link';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Fortixx — Sua plataforma de RH, do recrutamento ao dia a dia',
  description:
    'Fortixx centraliza recrutamento, onboarding, comunicação interna e atendimento aos colaboradores em uma única plataforma de RH.',
};

export default function HomePage() {
  return (
    <>
      {/* ── AMBIENT ─────────────────────────────────────────────── */}
      <div className="ambient" aria-hidden="true">
        <div className="orb orb-1" />
        <div className="orb orb-2" />
        <div className="orb orb-3" />
      </div>

      {/* ── BARRA DE AVISO ──────────────────────────────────────── */}
      <div className="announce">
        ⚡ Centralize recrutamento, onboarding e atendimento ao colaborador em um só lugar.{' '}
        <Link href="/pricing">Ver planos →</Link>
      </div>

      {/* ── NAVEGAÇÃO ───────────────────────────────────────────── */}
      <header className="nav" style={{ position: 'sticky', top: 0, zIndex: 40 }}>
        <div className="logo">
          <span className="logo-badge">F</span>
          Fortixx
        </div>
        <nav className="nav-links">
          <Link href="#recursos">Recursos</Link>
          <Link href="#plataforma">Plataforma</Link>
          <Link href="/pricing">Planos</Link>
          <Link href="#depoimentos">Depoimentos</Link>
          <Link href="#faq">FAQ</Link>
        </nav>
        <div className="nav-right">
          <Link href="/auth/login" className="nav-enter">Entrar →</Link>
          <Link href="/register" className="btn btn-primary btn-sm">Começar grátis</Link>
        </div>
      </header>

      {/* ── HERO ────────────────────────────────────────────────── */}
      <section className="hero">
        <div className="hero-grid" aria-hidden="true" />
        <div className="wrap hero-content">
          <span className="eyebrow">⚡ RH operacional, finalmente sob controle</span>
          <h1 className="hero-title">
            Transforme seu RH em uma{' '}
            <span className="accent">máquina de produtividade.</span>
          </h1>
          <p className="hero-sub">
            Automatize recrutamento, onboarding, comunicação interna e atendimento aos
            colaboradores em uma única plataforma.
          </p>
          <div className="hero-ctas">
            <Link href="/register" className="btn btn-primary">
              Começar 14 dias grátis
            </Link>
            <Link href="#plataforma" className="btn btn-ghost">
              Ver Plataforma
            </Link>
          </div>
          <p style={{ marginTop: 14, fontSize: '0.8rem', color: 'var(--text-3)' }}>
            Sem cartão de crédito · Configuração em minutos
          </p>
        </div>

        {/* Mockup do dashboard */}
        <div className="wrap">
          <div className="hero-dash-wrap">
            <div className="hero-dash glass">
              <div className="dash-topbar">
                <div className="dash-dots">
                  <span />
                  <span />
                  <span />
                </div>
                <span className="dash-url">dashboard.fortixx.com</span>
              </div>
              <div className="dash-body">
                <div className="dash-stats">
                  <div className="dash-stat">
                    <div className="dash-stat-label">Colaboradores ativos</div>
                    <div className="dash-stat-value">1.248</div>
                    <div className="dash-stat-delta">↑ 4,2% este mês</div>
                  </div>
                  <div className="dash-stat">
                    <div className="dash-stat-label">Vagas abertas</div>
                    <div className="dash-stat-value">18</div>
                    <div className="dash-stat-delta">↑ 2 esta semana</div>
                  </div>
                  <div className="dash-stat">
                    <div className="dash-stat-label">Onboardings ativos</div>
                    <div className="dash-stat-value">32</div>
                    <div className="dash-stat-delta">→ estável</div>
                  </div>
                </div>
                <div className="dash-main">
                  <div className="dash-chart-card">
                    <div className="dash-chart-title">Contratações por mês</div>
                    <div className="bars">
                      <span style={{ height: '38%' }} />
                      <span style={{ height: '52%' }} />
                      <span style={{ height: '46%' }} />
                      <span style={{ height: '68%' }} />
                      <span style={{ height: '60%' }} />
                      <span style={{ height: '82%' }} />
                      <span style={{ height: '74%' }} />
                      <span style={{ height: '95%' }} />
                    </div>
                  </div>
                  <div className="dash-feed-card">
                    <div className="dash-feed-title">Atividade recente</div>
                    <div className="feed-item">
                      <span className="feed-dot" />
                      Marina S. iniciou o onboarding
                    </div>
                    <div className="feed-item">
                      <span className="feed-dot" />
                      Vaga &quot;Dev Senior&quot; publicada
                    </div>
                    <div className="feed-item">
                      <span className="feed-dot" />
                      3 documentos pendentes de aprovação
                    </div>
                    <div className="feed-item">
                      <span className="feed-dot" />
                      João F. concluiu o onboarding
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── PROBLEMAS QUE RESOLVEMOS ─────────────────────────────── */}
      <section className="section" id="plataforma">
        <div className="wrap">
          <div className="section-head center">
            <span className="eyebrow">O problema</span>
            <h2 className="section-title">
              RH fragmentado custa caro — e todo mundo sabe disso.
            </h2>
            <p className="section-sub">
              Planilhas, e-mails dispersos, ferramentas desconectadas. O time de RH perde horas
              em tarefas manuais que poderiam ser automatizadas.
            </p>
          </div>

          <div className="problems-grid">
            {[
              {
                icon: '📋',
                title: 'Processos manuais',
                desc: 'Planilhas de recrutamento, e-mails para onboarding, documentos no WhatsApp.',
              },
              {
                icon: '🗂️',
                title: 'Dados dispersos',
                desc: 'Informações de colaboradores em 5 sistemas diferentes, sem integração.',
              },
              {
                icon: '⏳',
                title: 'Onboarding lento',
                desc: 'Novos colaboradores sem estrutura ficam perdidos nas primeiras semanas.',
              },
              {
                icon: '📊',
                title: 'Sem visibilidade',
                desc: 'Gestores sem acesso a indicadores de RH em tempo real.',
              },
              {
                icon: '💬',
                title: 'Atendimento caótico',
                desc: 'Colaboradores sem canal oficial para tirar dúvidas e fazer solicitações.',
              },
            ].map((p) => (
              <div key={p.title} className="problem-card glass">
                <div className="problem-icon">
                  <span style={{ fontSize: '1.2rem' }}>{p.icon}</span>
                </div>
                <div className="problem-title">{p.title}</div>
                <p className="problem-desc">{p.desc}</p>
              </div>
            ))}
          </div>

          <p className="problems-note" style={{ marginTop: 44 }}>
            A Fortixx resolve <span>todos esses problemas</span> em uma única plataforma.
          </p>
        </div>
      </section>

      {/* ── RECURSOS ─────────────────────────────────────────────── */}
      <section className="section" id="recursos">
        <div className="wrap">
          <div className="section-head center">
            <span className="eyebrow">Recursos</span>
            <h2 className="section-title">Tudo que seu RH precisa, em um só lugar.</h2>
            <p className="section-sub">
              Da abertura da vaga à aposentadoria do colaborador — a Fortixx cobre cada etapa
              do ciclo de vida do funcionário.
            </p>
          </div>

          <div className="features-grid">
            {[
              {
                title: 'Recrutamento Inteligente',
                desc: 'Pipeline Kanban completo, triagem automática de currículos, agendamento de entrevistas integrado ao calendário.',
                icon: '🎯',
                gold: false,
              },
              {
                title: 'Onboarding Estruturado',
                desc: 'Checklist personalizado por cargo, envio automático de documentos, acompanhamento de progresso em tempo real.',
                icon: '🚀',
                gold: false,
              },
              {
                title: 'Portal do Colaborador',
                desc: 'Contracheques, solicitações de férias, atualização de dados cadastrais — tudo no mesmo lugar.',
                icon: '👤',
                gold: true,
              },
              {
                title: 'Comunicação Interna',
                desc: 'Mural de avisos, pesquisas de clima, comunicados segmentados por departamento.',
                icon: '📢',
                gold: false,
              },
              {
                title: 'Relatórios e Analytics',
                desc: 'Dashboards de turnover, tempo médio de contratação, NPS interno e muito mais.',
                icon: '📈',
                gold: false,
              },
              {
                title: 'Assistente com IA',
                desc: 'Responde dúvidas de colaboradores 24h, triagem inicial de candidatos, geração automática de documentos.',
                icon: '🤖',
                gold: true,
              },
            ].map((f) => (
              <div key={f.title} className={`feature-card glass${f.gold ? ' gold' : ''}`}>
                <div className="feature-icon">
                  <span style={{ fontSize: '1.2rem' }}>{f.icon}</span>
                </div>
                <div className="feature-title">{f.title}</div>
                <p className="feature-desc">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── DEPOIMENTOS ──────────────────────────────────────────── */}
      <section className="section" id="depoimentos">
        <div className="wrap">
          <div className="section-head center">
            <span className="eyebrow">Depoimentos</span>
            <h2 className="section-title">Empresas que transformaram seu RH.</h2>
          </div>

          <div className="testi-grid">
            {[
              {
                result: '-62% tempo de onboarding',
                quote:
                  'Em 3 meses, reduzimos o tempo de onboarding de 3 semanas para 5 dias. Os novos colaboradores chegam preparados e produtivos desde o primeiro dia.',
                name: 'Fernanda Costa',
                role: 'Head de RH · TechBrasil',
                color: '#2563EB',
                initials: 'FC',
              },
              {
                result: '3x mais candidatos qualificados',
                quote:
                  'O pipeline de recrutamento da Fortixx nos deu visibilidade que nunca tivemos. Triplicamos o volume de candidatos qualificados sem aumentar a equipe.',
                name: 'Rodrigo Almeida',
                role: 'CEO · Startify',
                color: '#059669',
                initials: 'RA',
              },
              {
                result: '94% satisfação dos colaboradores',
                quote:
                  'O portal do colaborador eliminou 80% das perguntas repetitivas que chegavam para o RH. A equipe agora foca no que realmente importa.',
                name: 'Mariana Silva',
                role: 'Diretora de Pessoas · Grupo Nexo',
                color: '#7C3AED',
                initials: 'MS',
              },
            ].map((t) => (
              <div key={t.name} className="testi-card glass">
                <div className="testi-result">{t.result}</div>
                <p className="testi-quote">&ldquo;{t.quote}&rdquo;</p>
                <div className="testi-person">
                  <div
                    className="testi-avatar"
                    style={{ background: `linear-gradient(135deg, ${t.color}, ${t.color}99)` }}
                  >
                    {t.initials}
                  </div>
                  <div>
                    <div className="testi-name">{t.name}</div>
                    <div className="testi-role">{t.role}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── PREÇOS ───────────────────────────────────────────────── */}
      <section className="section" id="planos">
        <div className="wrap">
          <div className="section-head center">
            <span className="eyebrow">Planos</span>
            <h2 className="section-title">Preço justo para cada fase da sua empresa.</h2>
            <p className="section-sub">
              Comece grátis por 14 dias. Sem cartão de crédito. Cancele quando quiser.
            </p>
          </div>

          <div className="pricing-grid">
            {/* Básico */}
            <div className="price-card glass">
              <div className="price-card-body">
                <div className="plan-name">Básico</div>
                <p className="plan-desc">Para times de RH em crescimento que precisam organizar os processos.</p>
                <div className="price-now">
                  <span className="currency">R$</span>
                  <span className="amount">297</span>
                  <span className="period">/mês</span>
                </div>
                <p className="price-yearly">Cobrado anualmente · R$ 3.564/ano</p>
                <ul className="check-list" style={{ marginTop: 8 }}>
                  {['Até 50 colaboradores', 'Recrutamento básico', 'Onboarding com checklist', 'Portal do colaborador', 'Suporte por e-mail'].map((item) => (
                    <li key={item}>
                      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                        <path d="M3 8l3.5 3.5L13 4.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                      {item}
                    </li>
                  ))}
                </ul>
                <Link href="/register" className="btn btn-ghost btn-block" style={{ marginTop: 16 }}>
                  Começar grátis
                </Link>
              </div>
            </div>

            {/* Pro */}
            <div className="price-card pro glass">
              <div className="price-banner">
                ⭐ Mais popular
              </div>
              <div className="price-card-body">
                <div className="plan-name">Pro</div>
                <span className="discount-pill">✦ Economia de 20%</span>
                <p className="plan-desc">Para empresas que querem RH como vantagem competitiva.</p>
                <div className="price-now">
                  <span className="currency">R$</span>
                  <span className="amount">697</span>
                  <span className="period">/mês</span>
                </div>
                <p className="price-yearly">Cobrado anualmente · R$ 8.364/ano</p>
                <ul className="check-list" style={{ marginTop: 8 }}>
                  {['Colaboradores ilimitados', 'Recrutamento avançado com IA', 'Analytics e relatórios', 'Assistente com IA 24h', 'Comunicação interna', 'Suporte prioritário', 'Integrações (Slack, Teams)'].map((item) => (
                    <li key={item}>
                      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                        <path d="M3 8l3.5 3.5L13 4.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                      {item}
                    </li>
                  ))}
                </ul>
                <Link href="/register" className="btn btn-gold btn-block" style={{ marginTop: 16 }}>
                  Começar grátis →
                </Link>
              </div>
            </div>

            {/* Enterprise */}
            <div className="price-card glass">
              <div className="price-card-body">
                <div className="plan-name">Enterprise</div>
                <p className="plan-desc">Solução sob medida para grandes operações de RH.</p>
                <div className="enterprise-price">Sob consulta</div>
                <ul className="check-list" style={{ marginTop: 16 }}>
                  {['Tudo do Pro', 'SLA dedicado', 'SSO e LDAP', 'Implantação assistida', 'Gerente de sucesso', 'Contrato personalizado'].map((item) => (
                    <li key={item}>
                      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                        <path d="M3 8l3.5 3.5L13 4.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                      {item}
                    </li>
                  ))}
                </ul>
                <Link href="mailto:comercial@fortixx.com" className="btn btn-ghost btn-block" style={{ marginTop: 16 }}>
                  Falar com vendas
                </Link>
              </div>
            </div>
          </div>

          <p className="pricing-note">
            Todos os planos incluem 14 dias de teste gratuito · Cancele a qualquer momento · Dados protegidos com criptografia AES-256
          </p>
        </div>
      </section>

      {/* ── FAQ ──────────────────────────────────────────────────── */}
      <section className="section" id="faq">
        <div className="wrap">
          <div className="section-head center">
            <span className="eyebrow">FAQ</span>
            <h2 className="section-title">Perguntas frequentes.</h2>
          </div>

          <div className="faq-list">
            {[
              {
                q: 'Preciso de cartão de crédito para começar?',
                a: 'Não. O período de teste de 14 dias é completamente gratuito e sem necessidade de cartão. Só pedimos as informações de pagamento se você decidir continuar após o trial.',
              },
              {
                q: 'Como funciona o onboarding na plataforma?',
                a: 'Você cria templates de onboarding por cargo, define tarefas, responsáveis e prazos. Quando um novo colaborador entra, o processo inicia automaticamente com notificações para todos os envolvidos.',
              },
              {
                q: 'A Fortixx integra com meu sistema de folha de pagamento?',
                a: 'Sim. Temos integrações nativas com os principais sistemas do mercado (ADP, Totvs, SAP) e uma API aberta para conectar qualquer sistema via webhook.',
              },
              {
                q: 'Meus dados ficam seguros?',
                a: 'Absolutamente. Usamos criptografia AES-256 em repouso e TLS 1.3 em trânsito. Infraestrutura certificada ISO 27001, com backups diários e conformidade com a LGPD.',
              },
              {
                q: 'Posso cancelar a qualquer momento?',
                a: 'Sim, sem multa e sem burocracia. Se cancelar, seus dados ficam disponíveis para exportação por 30 dias após o cancelamento.',
              },
            ].map((item, i) => (
              <details key={i} className="faq-item glass" style={{ padding: '4px 0' }}>
                <summary className="faq-q" style={{ cursor: 'pointer', listStyle: 'none', display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '20px 24px', fontFamily: 'var(--font-display)', fontWeight: 600 }}>
                  {item.q}
                  <svg className="faq-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} width={18} height={18}>
                    <path d="M6 9l6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </summary>
                <div className="faq-a-inner">
                  {item.a}
                </div>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA FINAL ────────────────────────────────────────────── */}
      <section className="section">
        <div className="wrap">
          <div className="final-cta-card glass">
            <span className="eyebrow">Comece agora</span>
            <h2 className="final-cta-title" style={{ marginTop: 16 }}>
              Seu RH merece uma ferramenta à altura.
            </h2>
            <p className="final-cta-sub">
              Junte-se a centenas de empresas que já transformaram seu RH com a Fortixx.
              14 dias grátis, sem compromisso.
            </p>
            <div className="hero-ctas" style={{ justifyContent: 'center' }}>
              <Link href="/register" className="btn btn-gold">
                Começar 14 dias grátis →
              </Link>
              <Link href="mailto:comercial@fortixx.com" className="btn btn-ghost">
                Falar com um especialista
              </Link>
            </div>
            <p className="final-cta-note">
              Sem cartão de crédito · Configuração em minutos · Suporte em português
            </p>
          </div>
        </div>
      </section>

      {/* ── FOOTER ───────────────────────────────────────────────── */}
      <footer>
        <div className="wrap">
          <div className="footer-top">
            <div>
              <div className="logo">
                <span className="logo-badge">F</span>
                Fortixx
              </div>
              <p className="footer-brand-desc">
                A plataforma de RH que centraliza recrutamento, onboarding e atendimento ao
                colaborador em um só lugar.
              </p>
            </div>
            <div className="footer-col">
              <h5>Produto</h5>
              <Link href="#recursos">Recursos</Link>
              <Link href="/pricing">Planos e Preços</Link>
              <Link href="#depoimentos">Depoimentos</Link>
              <Link href="#faq">FAQ</Link>
            </div>
            <div className="footer-col">
              <h5>Empresa</h5>
              <Link href="/sobre">Sobre nós</Link>
              <Link href="/blog">Blog</Link>
              <Link href="/carreiras">Carreiras</Link>
              <Link href="mailto:contato@fortixx.com">Contato</Link>
            </div>
            <div className="footer-col">
              <h5>Legal</h5>
              <Link href="/termos">Termos de Uso</Link>
              <Link href="/privacidade">Privacidade</Link>
              <Link href="/lgpd">LGPD</Link>
              <Link href="/seguranca">Segurança</Link>
            </div>
          </div>
          <div className="footer-bottom">
            <span>© 2026 Fortixx. Todos os direitos reservados.</span>
            <div className="footer-socials">
              <a href="https://linkedin.com" aria-label="LinkedIn" target="_blank" rel="noopener noreferrer">
                <svg viewBox="0 0 24 24" fill="currentColor">
                  <path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z" />
                  <rect x="2" y="9" width="4" height="12" />
                  <circle cx="4" cy="4" r="2" />
                </svg>
              </a>
              <a href="https://instagram.com" aria-label="Instagram" target="_blank" rel="noopener noreferrer">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}>
                  <rect x="2" y="2" width="20" height="20" rx="5" ry="5" />
                  <circle cx="12" cy="12" r="4" />
                  <circle cx="17.5" cy="6.5" r="0.5" fill="currentColor" />
                </svg>
              </a>
            </div>
          </div>
        </div>
      </footer>
    </>
  );
}
