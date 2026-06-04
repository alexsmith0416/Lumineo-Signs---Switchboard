import { useNavigate } from "react-router-dom";
import { ChevronLeft } from "./icons";

interface Props {
  title: string;
  onBack?: () => void;
  right?: React.ReactNode;
}

export function SubBar({ title, onBack, right }: Props) {
  const navigate = useNavigate();
  const handleBack = onBack ?? (() => navigate(-1));
  return (
    <div className="bg-navy text-white px-3.5 py-2.5 flex items-center gap-2.5 text-sm font-bold shrink-0 lg:hidden">
      <button
        onClick={handleBack}
        className="w-6 h-6 flex items-center justify-center"
        aria-label="Back"
      >
        <ChevronLeft />
      </button>
      <span className="flex-1">{title}</span>
      {right}
    </div>
  );
}
