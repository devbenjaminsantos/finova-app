export default function PageHeader({
  title,
  subtitle,
  meta = null,
  aside = null,
  actions = null,
}) {
  return (
    <div className="finova-page-header">
      <div className="finova-page-header-copy">
        <h1 className="finova-title">{title}</h1>
        {subtitle ? <p className="finova-subtitle mb-0">{subtitle}</p> : null}
        {meta ? <p className="finova-subtitle small mt-2 mb-0">{meta}</p> : null}
      </div>

      {aside ? <div className="finova-page-header-side">{aside}</div> : null}
      {actions ? <div className="finova-page-header-actions">{actions}</div> : null}
    </div>
  );
}
