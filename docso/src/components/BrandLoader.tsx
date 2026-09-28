// Símbolo da marca (o + ponto fundido) com o ponto pulsando.
// dark: fundo preto (telas públicas); inline: ocupa o container em vez da tela toda.
export default function BrandLoader({ dark, inline }: { dark?: boolean; inline?: boolean }) {
  return (
    <div className={`brand-loader${dark ? ' dark' : ''}${inline ? ' inline' : ''}`} role="status" aria-label="Carregando">
      <svg viewBox="0 40 100 100" aria-hidden="true">
        <path className="ring" d="M62.9 138.3A50 50 0 1 1 98.3 102.9L73.2 97.2A24 28 0 1 0 56.2 117Z" />
        <circle className="dot" cx="76.9" cy="116.9" r="14.5" />
      </svg>
    </div>
  )
}
