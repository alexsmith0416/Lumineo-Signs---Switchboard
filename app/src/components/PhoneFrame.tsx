import type { ReactNode } from "react";

interface Props {
  children: ReactNode;
}

// The phone-shaped chrome (rounded corners, bezel shadow, bottom indicator)
// is decorative — it makes desktop previews look like a phone. On real
// mobile viewports we drop it so the app fills the screen edge-to-edge.
export function PhoneFrame({ children }: Props) {
  return (
    <div className="bg-gray-50 w-full max-w-[400px] mx-auto overflow-hidden flex flex-col h-screen sm:h-[840px] sm:max-h-[92vh] sm:rounded-[28px] sm:shadow-[0_0_0_8px_#1f1f24,0_0_0_10px_#2a2a31,0_24px_48px_rgba(20,20,100,0.18)]">
      {children}
      <div className="hidden sm:flex h-[22px] items-end justify-center pb-1.5 bg-gray-50">
        <span className="w-[100px] h-[4px] bg-[#1f1f24] rounded-full opacity-80" />
      </div>
    </div>
  );
}

export function Body({ children }: Props) {
  // Mobile: scrollable phone-frame body.
  // Desktop: the DesktopShell <main> owns the scroll, so this just centers
  // the content with comfortable max-width and padding.
  return (
    <div className="flex-1 overflow-y-auto scroll-area bg-gray-50 lg:overflow-visible lg:bg-transparent">
      <div className="lg:max-w-5xl lg:mx-auto lg:px-6 lg:py-6">{children}</div>
    </div>
  );
}
