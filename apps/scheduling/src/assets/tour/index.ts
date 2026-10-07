// Screenshots for the demo tour's Business Central steps (DemoTutorial.tsx).
// Embedded as data URLs (vite.config.ts assetsInlineLimit) rather than served
// from public/: the Power Apps host doesn't serve loose image files next to the
// app, so a plain image URL shows nothing there. Loaded only when such a step opens.
import clockInProject from "./bc-clock-in-project.png";
import clockInMultiple from "./bc-clock-in-multiple.png";

export const TOUR_IMAGES = { clockInProject, clockInMultiple } as const;
export type TourImageKey = keyof typeof TOUR_IMAGES;
