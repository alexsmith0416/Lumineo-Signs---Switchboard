import { useParams } from "react-router-dom";
import { AppHeader } from "../components/AppHeader";
import { Body } from "../components/PhoneFrame";
import { SubBar } from "../components/SubBar";
import { useStore } from "../store";
import { useMemo, useState } from "react";
import { formatPhotoStamp, formatLongDate, isoDayKey } from "../lib/format";
import type { PhotoCategory } from "../types";
import { jobByNo, MOCK_JOBS } from "../lib/mockData";

type Filter = "All" | PhotoCategory;

export function Gallery() {
  const { jobNo: paramJob } = useParams();
  const allPhotos = useStore((s) => s.photos);

  const [jobNo, setJobNo] = useState<string>(paramJob ?? MOCK_JOBS[0].jobNo);
  const [filter, setFilter] = useState<Filter>("All");
  const [lightbox, setLightbox] = useState<string | null>(null);

  const jobPhotos = useMemo(
    () => allPhotos.filter((p) => p.jobNo === jobNo),
    [allPhotos, jobNo],
  );

  const filtered = useMemo(
    () => (filter === "All" ? jobPhotos : jobPhotos.filter((p) => p.category === filter)),
    [jobPhotos, filter],
  );

  const counts = useMemo(
    () => ({
      All: jobPhotos.length,
      Survey: jobPhotos.filter((p) => p.category === "Survey").length,
      Completion: jobPhotos.filter((p) => p.category === "Completion").length,
    }),
    [jobPhotos],
  );

  const grouped = useMemo(() => {
    const m = new Map<string, typeof filtered>();
    for (const p of filtered) {
      const k = isoDayKey(p.capturedAt);
      if (!m.has(k)) m.set(k, []);
      m.get(k)!.push(p);
    }
    return Array.from(m.entries()).sort((a, b) => (a[0] < b[0] ? 1 : -1));
  }, [filtered]);

  return (
    <>
      <AppHeader />
      <SubBar title={`Job ${jobNo} — Photos`} />
      <Body>
        <section className="px-3.5 pt-3">
          <select
            value={jobNo}
            onChange={(e) => setJobNo(e.target.value)}
            className="w-full bg-input-bg border border-gray-200 rounded-lg px-3 py-2.5 text-[13px] font-semibold text-navy mb-3"
          >
            {MOCK_JOBS.map((j) => (
              <option key={j.jobNo} value={j.jobNo}>
                {j.jobNo} — {j.description}
              </option>
            ))}
          </select>

          <div className="flex gap-1.5 flex-wrap pb-1">
            {(["All", "Survey", "Completion"] as Filter[]).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-2.5 py-1 text-[10px] font-bold rounded-full flex items-center gap-1 border ${
                  filter === f
                    ? "bg-navy text-white border-navy"
                    : "bg-white text-gray-700 border-gray-200"
                }`}
              >
                {f}
                <span
                  className={`text-[9px] px-1.5 rounded-full ${
                    filter === f ? "bg-white text-navy" : "bg-navy text-white"
                  }`}
                >
                  {counts[f]}
                </span>
              </button>
            ))}
          </div>
        </section>

        {grouped.length === 0 ? (
          <div className="px-3.5 mt-4">
            <div className="bg-white rounded-xl p-5 text-center text-xs text-gray-500 border border-dashed border-gray-200">
              <div className="font-bold text-navy text-sm mb-1">No photos yet</div>
              Go to <span className="font-bold">Upload Photos</span> and capture or pick from your camera roll.
            </div>
          </div>
        ) : (
          grouped.map(([dayKey, items]) => (
            <section key={dayKey} className="px-3.5 mt-3">
              <SectionLabel>{formatLongDate(new Date(items[0].capturedAt))}</SectionLabel>
              <div className="grid grid-cols-2 gap-1.5">
                {items.map((p) => (
                  <button
                    key={p.photoId}
                    onClick={() => setLightbox(p.photoId)}
                    className="relative h-[130px] rounded-[10px] bg-gray-300 overflow-hidden"
                  >
                    <img src={p.dataUrl} alt="" className="w-full h-full object-cover" />
                    <div className="absolute bottom-0 left-0 right-0 bg-black/65 text-white text-[9px] py-[3px] font-semibold tabular-nums text-center">
                      {formatPhotoStamp(p.capturedAt)}
                    </div>
                  </button>
                ))}
              </div>
            </section>
          ))
        )}
        <div className="h-4" />
      </Body>

      {lightbox && (
        <div
          className="absolute inset-0 bg-black/85 z-40 flex items-center justify-center"
          onClick={() => setLightbox(null)}
        >
          <div className="w-full max-w-full p-3.5">
            <img
              src={allPhotos.find((p) => p.photoId === lightbox)?.dataUrl}
              alt=""
              className="w-full max-h-[70vh] object-contain rounded-xl"
            />
            <div className="text-white text-xs mt-3 px-1">
              {(() => {
                const p = allPhotos.find((p) => p.photoId === lightbox);
                if (!p) return null;
                return (
                  <>
                    <div className="font-bold">
                      {jobByNo(p.jobNo)?.description} · {p.category}
                    </div>
                    <div className="opacity-80 mt-1">
                      {formatPhotoStamp(p.capturedAt)} · {p.uploaderEmail}
                    </div>
                    {p.gps && (
                      <div className="opacity-80 mt-0.5">
                        📍 {p.gps.lat.toFixed(4)}, {p.gps.lng.toFixed(4)}
                      </div>
                    )}
                  </>
                );
              })()}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-2 pl-0.5">
      {children}
    </div>
  );
}
