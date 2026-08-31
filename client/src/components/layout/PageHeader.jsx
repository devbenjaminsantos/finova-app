export default function PageHeader({
  title,
  subtitle,
  meta = null,
  aside = null,
  actions = null,
}) {
  return (
    <div className="hestia-page-header">
      <div className="hestia-page-header-copy">
        <h1 className="hestia-title">{title}</h1>
        {subtitle ? <p className="hestia-subtitle mb-0">{subtitle}</p> : null}
        {meta ? <p className="hestia-subtitle small mt-2 mb-0">{meta}</p> : null}
      </div>

      {aside ? <div className="hestia-page-header-side">{aside}</div> : null}
      {actions ? <div className="hestia-page-header-actions">{actions}</div> : null}
    </div>
  );
}
