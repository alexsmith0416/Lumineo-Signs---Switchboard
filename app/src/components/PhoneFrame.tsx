import type { ReactNode } from "react";

interface Props {
  children: ReactNode;
}

export function PhoneFrame({ children }: Props) {
  return (
    <div className="bg-gray-50 rounded-[28px] w-full max-w-[400px] mx-auto overflow-hidden shadow-[0_0_0_8px_#1f1f24,0_0_0_10px_#2a2a31,0_24px_48px_rgba(20,20,100,0.18)] flex flex-col h-[840px] max-h-[92vh]">
      {children}
      <div className="h-[22px] flex items-end justify-center pb-1.5 bg-gray-50">
        <span className="w-[100px] h-[4px] bg-[#1f1f24] rounded-full opacity-80" />
      </div>
    </div>
  );
}

export function Body({ children }: Props) {
  return (
    <div className="flex-1 overflow-y-auto scroll-area bg-gray-50">{children}</div>
  );
}
