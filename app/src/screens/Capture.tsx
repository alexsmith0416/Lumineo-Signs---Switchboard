import { useEffect, useRef, useState } from "react";
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

type FacingMode = "environment" | "user";

export function Capture() {
  const navigate = useNavigate();
  const active = useStore(activePunch);
  const addPhoto = useStore((s) => s.addPhoto);
  const photos = useStore((s) => s.photos);
  const gps = useGeolocation();

  const [jobNo, setJobNo] = useState<string>(active?.jobNo ?? "J33723");
  const [category, setCategory] = useState<PhotoCategory>("Survey");

  // Separate inputs: gallery has NO capture attr (picks from photo library);
  // camera has capture="environment" so it forces the OS camera app as a
  // fallback when the in-app live preview can't run.
  const galleryInput = useRef<HTMLInputElement | null>(null);
  const cameraInput = useRef<HTMLInputElement | null>(null);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [streaming, setStreaming] = useState(false);
  const [facingMode, setFacingMode] = useState<FacingMode>("environment");
  const [cameraNotice, setCameraNotice] = useState<string | null>(null);
  const [flashing, setFlashing] = useState(false);
  const [nowTick, setNowTick] = useState(() => new Date().toISOString());

  const [showGalleryConfirm, setShowGalleryConfirm] = useState(false);

  const canGetUserMedia =
    typeof navigator !== "undefined" && !!navigator.mediaDevices?.getUserMedia;

  const jobPhotos = photos.filter((p) => p.jobNo === jobNo);
  const surveyCount = jobPhotos.filter((p) => p.category === "Survey").length;
  const completionCount = jobPhotos.filter((p) => p.category === "Completion").length;

  useEffect(() => {
    const t = setInterval(() => setNowTick(new Date().toISOString()), 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    return () => stopCamera();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function stopCamera() {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    setStreaming(false);
  }

  async function startCamera(mode: FacingMode = facingMode) {
    if (!canGetUserMedia) {
      setCameraNotice("Opening your phone's camera…");
      cameraInput.current?.click();
      return;
    }
    setCameraNotice(null);
    try {
      streamRef.current?.getTracks().forEach((t) => t.stop());
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: mode } },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play().catch(() => {});
      }
      setStreaming(true);
    } catch (err) {
      console.warn("Camera unavailable, falling back to OS camera", err);
      setCameraNotice("Using your phone's camera app instead.");
      setStreaming(false);
      cameraInput.current?.click();
    }
  }

  function flipCamera() {
    const next: FacingMode = facingMode === "environment" ? "user" : "environment";
    setFacingMode(next);
    if (streaming) void startCamera(next);
  }

  async function snap() {
    if (!streaming || !videoRef.current) {
      // First tap of the shutter when not streaming = enable the camera.
      void startCamera();
      return;
    }
    const video = videoRef.current;
    const w = video.videoWidth || 1080;
    const h = video.videoHeight || 1440;
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, w, h);
    const dataUrl = canvas.toDataURL("image/jpeg", 0.85);
    const fileSizeKB = Math.max(1, Math.round((dataUrl.length * 0.75) / 1024));
    addPhoto({ jobNo, category, dataUrl, gps, fileSizeKB });
    setFlashing(true);
    setTimeout(() => setFlashing(false), 180);
  }

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const dataUrl = await readAsDataUrl(file);
    const fileSizeKB = Math.max(1, Math.round(file.size / 1024));
    addPhoto({ jobNo, category, dataUrl, gps, fileSizeKB });
    e.target.value = "";
  }

  function openGalleryConfirm() {
    setShowGalleryConfirm(true);
  }

  function confirmGalleryPick() {
    setShowGalleryConfirm(false);
    galleryInput.current?.click();
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
                {j.jobNo} — {j.customer}
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
          <video
            ref={videoRef}
            playsInline
            muted
            autoPlay
            className={`w-full h-full object-cover transition-opacity duration-200 ${
              streaming ? "opacity-100" : "opacity-0"
            } ${facingMode === "user" ? "scale-x-[-1]" : ""}`}
          />

          {!streaming && (
            <button
              type="button"
              onClick={() => startCamera()}
              className="absolute inset-0 flex flex-col items-center justify-center text-white gap-3 hover:bg-white/5 transition-colors"
            >
              <div className="w-16 h-16 rounded-full bg-white/15 border border-white/30 flex items-center justify-center">
                <CameraIcon size={28} className="text-white" />
              </div>
              <div className="text-[12px] font-bold tracking-wider uppercase">
                Tap to Enable Camera
              </div>
              <div className="text-[10px] text-white/70 max-w-[80%] text-center leading-tight">
                Opens the live viewfinder, or your phone's camera app
              </div>
              {cameraNotice && (
                <div className="text-[10px] text-amber-200 max-w-[80%] text-center leading-tight">
                  {cameraNotice}
                </div>
              )}
            </button>
          )}

          <div className="absolute inset-3.5 border-2 border-white/40 rounded-lg pointer-events-none" />

          <div className="absolute top-3 left-3 text-white text-[10px] font-bold bg-black/50 px-2 py-1 rounded-full uppercase tracking-wider">
            {streaming ? (
              <>
                <span className="text-red-400">●</span> REC · {category}
              </>
            ) : (
              <>◌ STANDBY · {category}</>
            )}
          </div>

          <div className="absolute bottom-3 left-3 right-3 text-white text-[11px] font-semibold flex justify-between bg-black/40 px-2.5 py-1.5 rounded-md pointer-events-none">
            <span>
              📍 {gps ? `${gps.lat.toFixed(2)}, ${gps.lng.toFixed(2)}` : "GPS pending"}
            </span>
            <span className="tabular-nums">{formatTime(nowTick)}</span>
          </div>

          {flashing && (
            <div
              className="absolute inset-0 bg-white pointer-events-none"
              style={{ animation: "fadeOut 180ms ease-out forwards" }}
            />
          )}
        </div>

        {/* Hidden gallery picker — no capture attribute, so the OS opens the
            photo library. */}
        <input
          ref={galleryInput}
          type="file"
          accept="image/*"
          onChange={handleFile}
          className="hidden"
        />
        {/* Hidden camera fallback — capture="environment" forces the OS
            camera app on phones when getUserMedia isn't available. */}
        <input
          ref={cameraInput}
          type="file"
          accept="image/*"
          capture="environment"
          onChange={handleFile}
          className="hidden"
        />

        <div className="flex justify-around items-center px-3.5 py-4">
          <button
            onClick={openGalleryConfirm}
            className="w-11 h-11 rounded-[10px] bg-navy-bg text-navy flex items-center justify-center hover:bg-gray-200"
            aria-label="Choose from photo library"
            title="Pick from gallery"
          >
            <ImageIcon />
          </button>
          <button
            onClick={snap}
            className="w-16 h-16 rounded-full bg-white border-4 border-gray-200 hover:border-red active:scale-95 transition-transform cursor-pointer"
            style={{ boxShadow: "inset 0 0 0 4px #f7f8fa" }}
            aria-label={streaming ? "Take photo" : "Enable camera"}
          />
          <button
            onClick={flipCamera}
            disabled={!canGetUserMedia || !streaming}
            className="w-11 h-11 rounded-[10px] bg-navy-bg text-navy flex items-center justify-center hover:bg-gray-200 disabled:opacity-40"
            aria-label="Flip camera"
            title="Flip front / back"
          >
            <FlipIcon />
          </button>
        </div>

        <section className="px-3.5 pb-4">
          <SectionLabel>Recently Captured</SectionLabel>
          <div className="flex gap-2 overflow-x-auto scroll-x-hide pb-1">
            {jobPhotos.length === 0 ? (
              <div className="bg-white rounded-[10px] border border-dashed border-gray-200 px-4 py-3 text-[11px] text-gray-500 text-center w-full">
                Tap the shutter to capture, or the gallery icon to pick from your photos.
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

      {showGalleryConfirm && (
        <GalleryConfirmModal
          onCancel={() => setShowGalleryConfirm(false)}
          onConfirm={confirmGalleryPick}
        />
      )}
    </>
  );
}

function GalleryConfirmModal({
  onCancel,
  onConfirm,
}: {
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <div className="absolute inset-0 bg-navy/50 z-40 flex items-end">
      <div className="bg-white rounded-t-2xl w-full p-4 shadow-2xl">
        <div className="w-12 h-12 rounded-full bg-navy-bg flex items-center justify-center mb-3">
          <ImageIcon className="text-navy" />
        </div>
        <div className="text-[17px] font-extrabold text-navy">Choose from Photo Library</div>
        <div className="text-[12px] text-gray-600 mt-1.5 leading-snug">
          This will open your phone's photo gallery so you can upload a picture
          taken outside the app — for example a survey photo from earlier or a
          reference image. The file is attached to this job and category.
        </div>

        <div className="bg-gray-100 rounded-[10px] p-3 my-3.5 text-[11px] text-gray-700 leading-snug">
          <div className="font-bold text-navy mb-1">Tip</div>
          To capture a brand-new photo right now, close this and tap the white
          shutter button instead — that opens your camera.
        </div>

        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={onCancel}
            className="h-11 rounded-[10px] bg-gray-100 hover:bg-gray-200 text-navy font-bold text-sm border border-gray-200"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="h-11 rounded-[10px] bg-navy hover:bg-navy-light text-white font-bold text-sm flex items-center justify-center gap-2"
          >
            <ImageIcon size={16} className="text-white" />
            Browse Photos
          </button>
        </div>
      </div>
    </div>
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
