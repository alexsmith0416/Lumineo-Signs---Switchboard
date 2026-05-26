import type { SVGProps } from "react";

type IconProps = SVGProps<SVGSVGElement> & { size?: number };

const base = (size: number): SVGProps<SVGSVGElement> => ({
  width: size,
  height: size,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 2.2,
  strokeLinecap: "round",
  strokeLinejoin: "round",
});

export const HomeIcon = ({ size = 22, ...rest }: IconProps) => (
  <svg {...base(size)} {...rest} fill="currentColor" stroke="none">
    <path d="M3 11.5L12 4l9 7.5V20a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1v-8.5z" />
  </svg>
);

export const SunIcon = ({ size = 24, ...rest }: IconProps) => (
  <svg {...base(size)} {...rest}>
    <circle cx="12" cy="12" r="4" />
    <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
  </svg>
);

export const ChevronLeft = ({ size = 20, ...rest }: IconProps) => (
  <svg {...base(size)} {...rest}>
    <path d="M15 18l-6-6 6-6" />
  </svg>
);

export const ChevronRight = ({ size = 18, ...rest }: IconProps) => (
  <svg {...base(size)} {...rest}>
    <path d="M9 18l6-6-6-6" />
  </svg>
);

export const ClockIcon = ({ size = 18, ...rest }: IconProps) => (
  <svg {...base(size)} {...rest}>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 7v5l3 2" />
  </svg>
);

export const PlusCircle = ({ size = 22, ...rest }: IconProps) => (
  <svg {...base(size)} {...rest}>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 8v8M8 12h8" />
  </svg>
);

export const CheckCircle = ({ size = 20, ...rest }: IconProps) => (
  <svg {...base(size)} {...rest}>
    <circle cx="12" cy="12" r="9" />
    <path d="M9 12l2 2 4-4" />
  </svg>
);

export const Check = ({ size = 14, ...rest }: IconProps) => (
  <svg {...base(size)} {...rest} strokeWidth={3}>
    <path d="M20 6L9 17l-5-5" />
  </svg>
);

export const CameraIcon = ({ size = 20, ...rest }: IconProps) => (
  <svg {...base(size)} {...rest}>
    <path d="M14 3h-4l-2 3H4a2 2 0 0 0-2 2v11a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-4l-2-3z" />
    <circle cx="12" cy="13" r="4" />
  </svg>
);

export const CalendarIcon = ({ size = 20, ...rest }: IconProps) => (
  <svg {...base(size)} {...rest}>
    <rect x="3" y="4" width="18" height="18" rx="2" />
    <path d="M16 2v4M8 2v4M3 10h18" />
  </svg>
);

export const EditIcon = ({ size = 20, ...rest }: IconProps) => (
  <svg {...base(size)} {...rest}>
    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
    <path d="M18.5 2.5a2.12 2.12 0 1 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
  </svg>
);

export const ImageIcon = ({ size = 22, ...rest }: IconProps) => (
  <svg {...base(size)} {...rest}>
    <rect x="3" y="3" width="18" height="18" rx="2" />
    <circle cx="8.5" cy="8.5" r="1.5" />
    <path d="M21 15l-5-5L5 21" />
  </svg>
);

export const FlipIcon = ({ size = 22, ...rest }: IconProps) => (
  <svg {...base(size)} {...rest}>
    <path d="M3 4v6h6M21 20v-6h-6" />
    <path d="M21 10A9 9 0 0 0 6 5L3 8M3 14a9 9 0 0 0 15 5l3-3" />
  </svg>
);

export const SendIcon = ({ size = 18, ...rest }: IconProps) => (
  <svg {...base(size)} {...rest}>
    <path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z" />
  </svg>
);

export const DownloadIcon = ({ size = 18, ...rest }: IconProps) => (
  <svg {...base(size)} {...rest}>
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3" />
  </svg>
);

export const LogoutIcon = ({ size = 16, ...rest }: IconProps) => (
  <svg {...base(size)} {...rest}>
    <path d="M16 17l5-5-5-5M21 12H9M9 21H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5" />
  </svg>
);

export const WifiOffIcon = ({ size = 18, ...rest }: IconProps) => (
  <svg {...base(size)} {...rest}>
    <path d="M1 1l22 22" />
    <path d="M16.72 11.06A10.94 10.94 0 0 1 19 12.55M5 12.55a10.94 10.94 0 0 1 5.17-2.39M10.71 5.05A16 16 0 0 1 22.58 9M1.42 9a15.91 15.91 0 0 1 4.7-2.88M8.53 16.11a6 6 0 0 1 6.95 0" />
  </svg>
);

export const RefreshIcon = ({ size = 16, ...rest }: IconProps) => (
  <svg {...base(size)} {...rest}>
    <path d="M23 4v6h-6M1 20v-6h6" />
    <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
  </svg>
);

export const AlertIcon = ({ size = 18, ...rest }: IconProps) => (
  <svg {...base(size)} {...rest}>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 8v4M12 16h.01" />
  </svg>
);

export const PowerIcon = ({ size = 18, ...rest }: IconProps) => (
  <svg {...base(size)} {...rest}>
    <path d="M18.36 6.64a9 9 0 1 1-12.73 0" />
    <line x1="12" y1="2" x2="12" y2="12" />
  </svg>
);
