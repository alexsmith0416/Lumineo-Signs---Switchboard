import { useEffect } from "react";
import { useStore } from "../store";

export function Toast() {
  const toast = useStore((s) => s.toast);
  const setToast = useStore((s) => s.setToast);

  useEffect(() => {
    if (!toast) return;
    const id = window.setTimeout(() => setToast(null), 2400);
    return () => window.clearTimeout(id);
  }, [toast, setToast]);

  if (!toast) return null;

  const bg =
    toast.kind === "success"
      ? "bg-[#166534]"
      : toast.kind === "error"
        ? "bg-[#991b1b]"
        : "bg-navy";

  return (
    <div className="absolute left-3 right-3 bottom-6 z-50 pointer-events-none flex justify-center">
      <div
        className={`${bg} text-white text-xs font-semibold px-4 py-2 rounded-lg shadow-lg max-w-[80%] text-center pointer-events-auto`}
      >
        {toast.text}
      </div>
    </div>
  );
}
