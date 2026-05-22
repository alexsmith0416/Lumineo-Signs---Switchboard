import type { Photo } from "../types";

interface Props {
  photos: Photo[];
}

export default function PhotoReel({ photos }: Props) {
  return (
    <section className="photoreel" aria-label="Recent completions">
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
