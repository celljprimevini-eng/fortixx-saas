/**
 * Logo Fortixx — badge 34×34 com gradient gold→amber + letra "F" tipográfica
 * + wordmark "Fortixx" em Space Grotesk.
 *
 * Redesenho vetorial mantido fiel à identidade do protótipo original
 * (fortixx-landing.html, badge com `linear-gradient(135deg, var(--gold), #F59E0B)`
 * e wordmark em `var(--font-display)` 700).
 *
 * Props:
 *  - className: classes extras no `<span>` raiz (ainer das orienções via flex, etc.)
 *  - wordmarkClassName: classes só pro wordmark (cor, tamanho). Útil no footer
 *    que usa text-3 em vez de text-1.
 */
export function Logo({
  className = '',
  wordmarkClassName = '',
}: {
  className?: string;
  wordmarkClassName?: string;
}) {
  return (
    <span
      className={`logo ${className}`}
      style={{ display: 'inline-flex', alignItems: 'center', gap: 10 }}
    >
      <svg
        width="34"
        height="34"
        viewBox="0 0 34 34"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
        style={{ borderRadius: 11, flexShrink: 0 }}
      >
        <defs>
          <linearGradient id="logoGold" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#FDE68A" />
            <stop offset="45%" stopColor="#FBBF24" />
            <stop offset="100%" stopColor="#F59E0B" />
          </linearGradient>
        </defs>
        <rect x="0" y="0" width="34" height="34" rx="11" fill="url(#logoGold)" />
        {/* Três nós crescendo em diagonal — recrutamento → onboarding → portal.
            Mesma linguagem visual do ParticleCanvas (pontos conectados) já
            usado no fundo da landing. */}
        <line x1="10.2" y1="23" x2="17" y2="15.3" stroke="#1a1300" strokeWidth="1.8" strokeLinecap="round" />
        <line x1="17" y1="15.3" x2="24.6" y2="9.4" stroke="#1a1300" strokeWidth="1.8" strokeLinecap="round" />
        <circle cx="10.2" cy="23" r="2.55" fill="#1a1300" />
        <circle cx="17" cy="15.3" r="3.06" fill="#1a1300" />
        <circle cx="24.6" cy="9.4" r="3.57" fill="#1a1300" />
      </svg>
      <span
        className={wordmarkClassName}
        style={{
          fontFamily: 'var(--font-display)',
          fontWeight: 700,
          fontSize: '1.18rem',
          letterSpacing: '-0.005em',
        }}
      >
        Fortixx
      </span>
    </span>
  );
}