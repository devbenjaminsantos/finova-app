export default function ChartContainer({ children, className = "", footer, meta, title }) {
  return (
    <section className={["finova-chart-container", className].filter(Boolean).join(" ")}>
      <div className="finova-chart-container-heading">
        <h2 className="finova-title h5 mb-0">{title}</h2>
        {meta ? <span className="finova-subtitle small">{meta}</span> : null}
      </div>
      {children}
      {footer ? <div className="finova-chart-container-footer">{footer}</div> : null}
    </section>
  );
}
