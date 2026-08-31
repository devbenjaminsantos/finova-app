export default function CategoryRow({ label, share, shareLabel, value }) {
  const progress = Math.min(Math.max(Number(share) || 0, 0), 100);

  return (
    <li className="hestia-home-spending-row">
      <div className="hestia-home-spending-row-copy">
        <strong>{label}</strong>
        <span>{value}</span>
      </div>
      <div className="hestia-home-spending-track" aria-hidden="true">
        <span style={{ width: `${progress}%` }} />
      </div>
      <small>{shareLabel || share}</small>
    </li>
  );
}
