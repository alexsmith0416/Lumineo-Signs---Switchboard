import { useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AppHeader } from "../components/AppHeader";
import { Body } from "../components/PhoneFrame";
import { SubBar } from "../components/SubBar";
import { CameraIcon, CheckCircle, FlipIcon, ImageIcon } from "../components/icons";
import { activePunch, useStore } from "../store";
import { MOCK_JOBS } from "../lib/mockData";
import { useGeolocation } from "../hooks/useGeolocation";
import { formatPhotoStamp, formatTime } from "../lib/format";
import type { PhotoCategory } from "../types";

export function Capture() {
  const navigate = useNavigate();
  const active = useStore(activePunch);
  const addPhoto = useStore((s) => s.addPhoto);
  const photos = useStore((s) => s.photos);
  const gps = useGeolocation();

  const [jobNo, setJobNo] = useState<string>(active?.jobNo ?? "24-1187");
  const [category, setCategory] = useState<PhotoCategory>("Survey");
  const fileInput = useRef<HTMLInputElement | null>(null);

  const jobPhotos = photos.filter((p) => p.jobNo === jobNo);
  const surveyCount = jobPhotos.filter((p) => p.category === "Survey").length;
  const completionCount = jobPhotos.filter((p) => p.category === "Completion").length;

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const dataUrl = await readAsDataUrl(file);
    const fileSizeKB = Math.max(1, Math.round(file.size / 1024));
    addPhoto({
      jobNo,
      category,
      dataUrl,
      gps,
      fileSizeKB,
    });
    // Reset for next shot
    if (fileInput.current) fileInput.current.value = "";
  }

  function triggerCapture() {
    fileInput.current?.click();
  }

  return (
    <>
      <AppHeader />
      <SubBar title="Add Photos" />
      <Body>
        <section className="px-3.5 pt-3">
          <SectionLabel>Job</SectionLabel>
          <select
            value={jobNo}
            onChange={(e) => setJobNo(e.target.value)}
            className="w-full bg-input-bg border border-gray-200 rounded-lg px-3 py-2.5 text-[13px] font-semibold text-navy"
          >
            {MOCK_JOBS.map((j) => (
              <option key={j.jobNo} value={j.jobNo}>
                {j.jobNo} — {j.description}
              </option>
            ))}
          </select>
        </section>

        <section className="px-3.5 mt-3.5">
          <SectionLabel>Category</SectionLabel>
          <div className="grid grid-cols-2 gap-2.5">
            <CategoryCard
              active={category === "Survey"}
              onClick={() => setCategory("Survey")}
              color="navy"
              name="Survey"
              desc="Existing site, mounting surface, conditions"
              count={surveyCount}
            />
            <CategoryCard
              active={category === "Completion"}
              onClick={() => setCategory("Completion")}
              color="red"
              name="Completion"
              desc="Final install / before-after"
              count={completionCount}
            />
          </div>
        </section>

        <section className="px-3.5 mt-3.5">
          <SectionLabel>Capture</SectionLabel>
        </section>

        <div className="mx-3.5 bg-[#0c0c14] aspect-[3/4] rounded-xl relative overflow-hidden">
          <div className="absolute inset-3.5 border-2 border-white/40 rounded-lg pointer-events-none" />
          <div className="absolute top-3 left-3 text-white text-[10px] font-bold bg-black/50 px-2 py-1 rounded-full uppercase tracking-wider">
            ● REC · {category}
          </div>
          <div className="absolute bottom-3 left-3 right-3 text-white text-[11px] font-semibold flex justify-between bg-black/40 px-2.5 py-1.5 rounded-md">
            <span>📍 {gps ? `${gps.lat.toFixed(2)}, ${gps.lng.toFixed(2)}` : "GPS pending"}</span>
            <span>{formatTime(new Date().toISOString())}</span>
          </div>
        </div>

        <input
          ref={fileInput}
          type="file"
          accept="image/*"
          capture="environment"
          onChange={handleFile}
          className="hidden"
        />

        <div className="flex justify-around items-center px-3.5 py-4">
          <button className="w-11 h-11 rounded-[10px] bg-navy-bg text-navy flex items-center justify-center">
            <ImageIcon />
          </button>
          <button
            onClick={triggerCapture}
            className="w-16 h-16 rounded-full bg-white border-4 border-gray-200 hover:border-red shadow-inner cursor-pointer"
            style={{ boxShadow: "inset 0 0 0 4px #f7f8fa" }}
            aria-label="Take photo"
          />
          <button className="w-11 h-11 rounded-[10px] bg-navy-bg text-navy flex items-center justify-center">
            <FlipIcon />
          </button>
        </div>

        <section className="px-3.5 pb-4">
          <SectionLabel>Recently Captured</SectionLabel>
          <div className="flex gap-2 overflow-x-auto scroll-x-hide pb-1">
            {jobPhotos.length === 0 ? (
              <div className="bg-white rounded-[10px] border border-dashed border-gray-200 px-4 py-3 text-[11px] text-gray-500 text-center w-full">
                Tap the shutter to capture or pick from your camera roll.
              </div>
            ) : (
              jobPhotos.slice(0, 8).map((p) => (
                <div
                  key={p.photoId}
                  className="w-[92px] h-[92px] flex-shrink-0 rounded-[10px] bg-gray-300 relative overflow-hidden"
                >
                  <img src={p.dataUrl} alt="" className="w-full h-full object-cover" />
                  <div className="absolute bottom-0 left-0 right-0 bg-black/65 text-white text-[9px] py-[3px] font-semibold tabular-nums text-center">
                    {formatPhotoStamp(p.capturedAt)}
                  </div>
                </div>
              ))
            )}
          </div>
          <button
            onClick={() => navigate(`/gallery/${jobNo}`)}
            className="w-full mt-3 h-11 rounded-[10px] bg-gray-100 hover:bg-gray-200 text-navy font-bold text-sm flex items-center justify-center gap-2 border border-gray-200"
          >
            <CameraIcon className="text-navy" />
            View All Job Photos
          </button>
        </section>
      </Body>
    </>
  );
}

function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error);
    reader.onload = () => resolve(reader.result as string);
    reader.readAsDataURL(file);
  });
}

function CategoryCard({
  active,
  onClick,
  color,
  name,
  desc,
  count,
}: {
  active: boolean;
  onClick: () => void;
  color: "navy" | "red";
  name: string;
  desc: string;
  count: number;
}) {
  const iconBg =
    color === "red" ? "bg-red/10 text-red" : "bg-navy-bg text-navy";
  const activeBg = active ? "bg-navy-bg border-navy" : "bg-white border-gray-200 hover:border-navy";
  const activeIcon = active ? "bg-navy text-white" : iconBg;
  return (
    <button
      onClick={onClick}
      className={`text-left rounded-xl p-3.5 border-2 ${activeBg}`}
    >
      <div className={`w-10 h-10 rounded-[10px] flex items-center justify-center mb-2 ${activeIcon}`}>
        {color === "red" ? <CameraIcon className="text-current" /> : <CheckCircle className="text-current" />}
      </div>
      <div className="text-[13px] font-bold text-navy">{name}</div>
      <div className="text-[11px] text-gray-500 mt-0.5 leading-snug">{desc}</div>
      <span className="text-[10px] font-bold text-navy bg-white px-1.5 py-0.5 rounded-full mt-2 inline-block border border-gray-200">
        {count} photo{count === 1 ? "" : "s"}
      </span>
    </button>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-2 pl-0.5">
      {children}
    </div>
  );
}
