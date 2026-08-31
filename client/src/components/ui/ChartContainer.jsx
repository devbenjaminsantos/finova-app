export default function ChartContainer({ children, className = "", footer, meta, title }) {
  return (
    <section className={["hestia-chart-container", className].filter(Boolean).join(" ")}>
      <div className="hestia-chart-container-heading">
        <h2 className="hestia-title h5 mb-0">{title}</h2>
        {meta ? <span className="hestia-subtitle small">{meta}</span> : null}
      </div>
      {children}
      {footer ? <div className="hestia-chart-container-footer">{footer}</div> : null}
    </section>
  );
}
