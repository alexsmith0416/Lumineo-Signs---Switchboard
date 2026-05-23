import type { Photo } from "../types";

interface Props {
  photos: Photo[];
  containerWidth?: number | null;
}

export default function PhotoReel({ photos, containerWidth }: Props) {
  const wrapStyle: React.CSSProperties = containerWidth
    ? { width: `${containerWidth}px`, maxWidth: `${containerWidth}px` }
    : {};
  return (
    <section className="photoreel" aria-label="Recent completions" style={wrapStyle}>
      <div className="photoreel__head">
        <span className="photoreel__title">Recent completions</span>
        <button type="button" className="photoreel__see-all">
          See all →
        </button>
      </div>
      <div className="photoreel__strip">
        {photos.map((p) => (
          <button
            key={p.id}
            type="button"
            className="photo"
            style={{ background: p.gradient }}
            title={p.caption}
          >
            <span className="photo__caption">{p.caption}</span>
            <span className="photo__by">
              <span>{p.by}</span>
              <span className="photo__by-job">{p.jobNumber}</span>
            </span>
          </button>
        ))}
      </div>
    </section>
  );
}
