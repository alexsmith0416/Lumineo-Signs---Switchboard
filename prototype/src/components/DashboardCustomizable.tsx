import { useEffect, useMemo, useRef, useState } from "react";
import GridLayout, { WidthProvider } from "react-grid-layout/legacy";
import "react-grid-layout/css/styles.css";
import "react-resizable/css/styles.css";
import type { Role } from "../types";
import {
  DonutBody,
  KanbanBody,
  KpiCardBody,
  TargetsBody,
  getKpiList,
} from "../dashboard/cards";
import { usersByRole } from "../data/mockData";
import DashboardMobile from "./DashboardMobile";

const Grid = WidthProvider(GridLayout);

interface Props {
  role: Role;
  onBack?: () => void;
}

type Theme = "light" | "dark";

/* ---------- Icon set — paths extracted from the Figma sidebar SVGs ----------
 *
 * Each icon uses the original Figma viewBox so the absolute coordinates stay
 * unchanged. `fill="currentColor"` lets the surrounding nav item drive the
 * color per theme + active state.
 */
type IconName =
  | "dash" | "sched" | "inbox"
  | "ps" | "ws" | "sb" | "jp" | "es" | "sh"
  | "set" | "help" | "moon" | "sun" | "pencil";

function Icon({ name, size = 20 }: { name: IconName; size?: number }) {
  switch (name) {
    case "dash":
      return (
        <svg viewBox="24 122 20 20" width={size} height={size} fill="currentColor" aria-hidden focusable={false}>
          <path fillRule="evenodd" clipRule="evenodd" d="M26.1429 122C24.9594 122 24 122.959 24 124.143V126.107H34H44V124.143C44 122.959 43.0406 122 41.8571 122H26.1429ZM24 133.964V127.893H33.1071V133.964H24ZM24 135.75V139.857C24 141.041 24.9594 142 26.1429 142H33.1071V135.75H24ZM34.8929 135.75V142H41.8571C43.0406 142 44 141.041 44 139.857V135.75H34.8929ZM44 133.964V127.893H34.8929V133.964H44Z" />
        </svg>
      );
    case "sched":
      return (
        <svg viewBox="24 165 20 24" width={size} height={size} fill="currentColor" aria-hidden focusable={false}>
          <path d="M44 168.2H40.6667V166H38.4444V168.2H29.5556V166H27.3333V168.2H24V188H44V168.2ZM34 171.5C35.8444 171.5 37.3333 172.974 37.3333 174.8C37.3333 176.626 35.8444 178.1 34 178.1C32.1556 178.1 30.6667 176.626 30.6667 174.8C30.6667 172.974 32.1556 171.5 34 171.5ZM40.6667 184.7H27.3333V183.6C27.3333 181.4 31.7778 180.19 34 180.19C36.2222 180.19 40.6667 181.4 40.6667 183.6V184.7Z" />
        </svg>
      );
    case "inbox":
      return (
        <svg viewBox="24 211 20 21" width={size} height={size} fill="currentColor" aria-hidden focusable={false}>
          <path d="M43.5 218.125V229.375C43.5 230.203 42.8284 230.875 42 230.875H26C25.1716 230.875 24.5 230.203 24.5 229.375V218.125H43.5ZM26 213.125H42C42.8284 213.125 43.5 213.797 43.5 214.625V215.875H24.5V214.625C24.5 213.797 25.1716 213.125 26 213.125Z" stroke="currentColor" />
          <path d="M28.375 212V212.625" stroke="currentColor" strokeLinecap="round" />
          <path d="M39.625 212V212.625" stroke="currentColor" strokeLinecap="round" />
        </svg>
      );
    case "ps":
      return (
        <svg viewBox="24 283 20 21" width={size} height={size} fill="currentColor" aria-hidden focusable={false}>
          <path d="M36.5 284C36.5 283.655 36.2202 283.375 35.875 283.375H32.125C31.7798 283.375 31.5 283.655 31.5 284C31.5 284.345 31.2202 284.625 30.875 284.625C30.5298 284.625 30.25 284.905 30.25 285.25V285.875C30.25 286.22 30.5298 286.5 30.875 286.5H37.125C37.4702 286.5 37.75 286.22 37.75 285.875V285.25C37.75 284.905 37.4702 284.625 37.125 284.625C36.7798 284.625 36.5 284.345 36.5 284Z" />
          <path d="M29.1067 284.625H28.375C27.3395 284.625 26.5 285.464 26.5 286.5V301.5C26.5 302.536 27.3395 303.375 28.375 303.375H39.625C40.6605 303.375 41.5 302.536 41.5 301.5V286.5C41.5 285.464 40.6605 284.625 39.625 284.625H38.8933C38.9624 284.82 39 285.031 39 285.25V285.875C39 286.911 38.1605 287.75 37.125 287.75H30.875C29.8395 287.75 29 286.911 29 285.875V285.25C29 285.031 29.0376 284.82 29.1067 284.625ZM36.5 292.125C36.5 291.435 37.0596 290.875 37.75 290.875C38.4404 290.875 39 291.435 39 292.125V298.375C39 299.065 38.4404 299.625 37.75 299.625C37.0596 299.625 36.5 299.065 36.5 298.375V292.125ZM29 297.125C29 296.435 29.5596 295.875 30.25 295.875C30.9404 295.875 31.5 296.435 31.5 297.125V298.375C31.5 299.065 30.9404 299.625 30.25 299.625C29.5596 299.625 29 299.065 29 298.375V297.125ZM34 293.375C34.6904 293.375 35.25 293.935 35.25 294.625V298.375C35.25 299.065 34.6904 299.625 34 299.625C33.3096 299.625 32.75 299.065 32.75 298.375V294.625C32.75 293.935 33.3096 293.375 34 293.375Z" />
        </svg>
      );
    case "ws":
      return (
        <svg viewBox="24 327 20 21" width={size} height={size} fill="currentColor" aria-hidden focusable={false}>
          <path d="M28.375 327.375C28.7202 327.375 29 327.655 29 328V328.625H39V328C39 327.655 39.2798 327.375 39.625 327.375C39.9702 327.375 40.25 327.655 40.25 328V328.625H41.5C42.8807 328.625 44 329.744 44 331.125V344.875C44 346.256 42.8807 347.375 41.5 347.375H26.5C25.1193 347.375 24 346.256 24 344.875V331.125C24 329.744 25.1193 328.625 26.5 328.625H27.75V328C27.75 327.655 28.0298 327.375 28.375 327.375ZM40.8182 331.125H27.1818C26.8053 331.125 26.5 331.405 26.5 331.75V333C26.5 333.345 26.8053 333.625 27.1818 333.625H40.8182C41.1947 333.625 41.5 333.345 41.5 333V331.75C41.5 331.405 41.1947 331.125 40.8182 331.125ZM34.625 336.125C34.2798 336.125 34 336.405 34 336.75V338C34 338.345 34.2798 338.625 34.625 338.625H35.875C36.2202 338.625 36.5 338.345 36.5 338V336.75C36.5 336.405 36.2202 336.125 35.875 336.125H34.625ZM38.375 336.125C38.0298 336.125 37.75 336.405 37.75 336.75V338C37.75 338.345 38.0298 338.625 38.375 338.625H39.625C39.9702 338.625 40.25 338.345 40.25 338V336.75C40.25 336.405 39.9702 336.125 39.625 336.125H38.375ZM27.75 340.5V341.75C27.75 342.095 28.0298 342.375 28.375 342.375H29.625C29.9702 342.375 30.25 342.095 30.25 341.75V340.5C30.25 340.155 29.9702 339.875 29.625 339.875H28.375C28.0298 339.875 27.75 340.155 27.75 340.5ZM32.125 339.875C31.7798 339.875 31.5 340.155 31.5 340.5V341.75C31.5 342.095 31.7798 342.375 32.125 342.375H33.375C33.7202 342.375 34 342.095 34 341.75V340.5C34 340.155 33.7202 339.875 33.375 339.875H32.125Z" />
        </svg>
      );
    case "sb":
      return (
        <svg viewBox="24 371 20 17" width={size} height={size} fill="currentColor" aria-hidden focusable={false}>
          <path fillRule="evenodd" clipRule="evenodd" d="M25.875 382.375C24.8395 382.375 24 383.214 24 384.25V385.5C24 386.536 24.8395 387.375 25.875 387.375H27.125C28.1605 387.375 29 386.536 29 385.5V384.25C29 383.214 28.1605 382.375 27.125 382.375H25.875ZM33.375 382.375C32.3395 382.375 31.5 383.214 31.5 384.25V385.5C31.5 386.536 32.3395 387.375 33.375 387.375H34.625C35.6605 387.375 36.5 386.536 36.5 385.5V384.25C36.5 383.214 35.6605 382.375 34.625 382.375H33.375ZM40.875 382.375C39.8395 382.375 39 383.214 39 384.25V385.5C39 386.536 39.8395 387.375 40.875 387.375H42.125C43.1605 387.375 44 386.536 44 385.5V384.25C44 383.214 43.1605 382.375 42.125 382.375H40.875Z" />
          <path fillRule="evenodd" clipRule="evenodd" d="M31.5 374.25C31.5 373.214 32.3395 372.375 33.375 372.375H34.625C35.6605 372.375 36.5 373.214 36.5 374.25V375.5C36.5 376.536 35.6605 377.375 34.625 377.375V378.625H41.5C41.8452 378.625 42.125 378.905 42.125 379.25V381.281C42.125 381.626 41.8452 381.906 41.5 381.906C41.1548 381.906 40.875 381.626 40.875 381.281V379.875H34.625V381.281C34.625 381.626 34.3452 381.906 34 381.906C33.6548 381.906 33.375 381.626 33.375 381.281V379.875H27.125V381.281C27.125 381.626 26.8452 381.906 26.5 381.906C26.1548 381.906 25.875 381.626 25.875 381.281V379.25C25.875 378.905 26.1548 378.625 26.5 378.625H33.375V377.375C32.3395 377.375 31.5 376.536 31.5 375.5V374.25Z" />
        </svg>
      );
    case "jp":
      return (
        <svg viewBox="24 412 20 21" width={size} height={size} fill="currentColor" aria-hidden focusable={false}>
          <path d="M31.0714 412.375C30.7164 412.375 30.4286 412.655 30.4286 413C30.4286 413.345 30.7164 413.625 31.0714 413.625H31.7143V414.964C27.3525 415.57 24 419.217 24 423.625C24 428.457 28.0294 432.375 33 432.375C37.9706 432.375 42 428.457 42 423.625C42 421.433 41.1714 419.43 39.8021 417.895C39.8076 417.89 39.8131 417.885 39.8186 417.88L40.2731 417.438L40.7277 417.88C40.9787 418.124 41.3858 418.124 41.6368 417.88C41.8879 417.636 41.8879 417.24 41.6368 416.996L39.8186 415.228C39.5675 414.984 39.1605 414.984 38.9094 415.228C38.6584 415.472 38.6584 415.868 38.9094 416.112L39.364 416.554L38.9094 416.996C38.904 417.001 38.8987 417.006 38.8935 417.012C37.6203 415.939 36.0341 415.207 34.2857 414.964V413.625H34.9286C35.2836 413.625 35.5714 413.345 35.5714 413C35.5714 412.655 35.2836 412.375 34.9286 412.375H31.0714ZM33.6428 419.375L33.6429 423.625C33.6429 423.791 33.5751 423.95 33.4546 424.067C33.334 424.184 33.1705 424.25 33 424.25H28.5C28.145 424.25 27.8571 423.97 27.8571 423.625C27.8571 423.28 28.145 423 28.5 423H32.3571L32.3571 419.375C32.3571 419.03 32.6449 418.75 33 418.75C33.355 418.75 33.6428 419.03 33.6428 419.375Z" />
        </svg>
      );
    case "es":
      return (
        <svg viewBox="24 456 20 21" width={size} height={size} fill="currentColor" aria-hidden focusable={false}>
          <path d="M32.3454 472.202C32.3454 474.507 30.4773 476.375 28.1727 476.375C25.8682 476.375 24 474.507 24 472.202C24 469.898 25.8682 468.03 28.1727 468.03C30.4773 468.03 32.3454 469.898 32.3454 472.202ZM26.4657 473.205C26.5178 473.838 27.0318 474.332 27.9557 474.39V474.858H28.3655V474.387C29.3206 474.322 29.8797 473.825 29.8797 473.105C29.8797 472.449 29.4526 472.111 28.6885 471.936L28.3655 471.861V470.589C28.7753 470.634 29.0358 470.852 29.0983 471.154H29.8172C29.7651 470.543 29.2268 470.066 28.3655 470.014V469.547H27.9557V470.024C27.1395 470.102 26.5838 470.579 26.5838 471.254C26.5838 471.852 26.9971 472.231 27.6848 472.387L27.9557 472.452V473.803C27.5354 473.741 27.2576 473.517 27.195 473.205H26.4657ZM27.9522 471.767C27.5493 471.676 27.3305 471.491 27.3305 471.212C27.3305 470.901 27.5667 470.667 27.9557 470.599V471.767H27.9522ZM28.4245 472.559C28.9142 472.67 29.14 472.848 29.14 473.163C29.14 473.523 28.8587 473.77 28.3655 473.816V472.546L28.4245 472.559Z" />
          <path fillRule="evenodd" clipRule="evenodd" d="M29.6071 456.375C28.3828 456.375 27.3903 457.367 27.3903 458.592V467.045C27.6455 467.006 27.9068 466.986 28.1727 466.986C28.53 466.986 28.8788 467.022 29.2159 467.091C29.3482 467.118 29.4786 467.149 29.6071 467.186V466.905C29.6071 466.599 29.8552 466.35 30.1613 466.35H31.2696C31.5757 466.35 31.8238 466.599 31.8238 466.905V468.013C31.8238 468.145 31.7779 468.266 31.7011 468.361C31.8835 468.528 32.0539 468.709 32.2109 468.901C32.5075 469.263 32.7562 469.666 32.9475 470.1C33.006 469.856 33.2251 469.676 33.4864 469.676H34.5948C34.9009 469.676 35.149 469.924 35.149 470.23V471.338C35.149 471.644 34.9009 471.892 34.5948 471.892H33.4864C33.4496 471.892 33.4137 471.889 33.3789 471.882C33.3854 471.988 33.3886 472.095 33.3886 472.202C33.3886 472.331 33.3839 472.459 33.3748 472.585C33.3585 472.809 33.328 473.03 33.2843 473.245C33.2238 473.543 33.1379 473.832 33.0291 474.109H38.4741C39.6984 474.109 40.6909 473.117 40.6909 471.892V458.592C40.6909 457.367 39.6984 456.375 38.4741 456.375H29.6071ZM29.6071 461.363V459.146C29.6071 458.84 29.8552 458.592 30.1613 458.592H37.9199C38.226 458.592 38.4741 458.84 38.4741 459.146V461.363C38.4741 461.669 38.226 461.917 37.9199 461.917H30.1613C29.8552 461.917 29.6071 461.669 29.6071 461.363ZM29.6071 464.688V463.579C29.6071 463.273 29.8552 463.025 30.1613 463.025H31.2696C31.5757 463.025 31.8238 463.273 31.8238 463.579V464.688C31.8238 464.994 31.5757 465.242 31.2696 465.242H30.1613C29.8552 465.242 29.6071 464.994 29.6071 464.688ZM32.9322 463.579C32.9322 463.273 33.1803 463.025 33.4864 463.025H34.5948C34.9009 463.025 35.149 463.273 35.149 463.579V464.688C35.149 464.994 34.9009 465.242 34.5948 465.242H33.4864C33.1803 465.242 32.9322 464.994 32.9322 464.688V463.579ZM32.9322 468.013V466.905C32.9322 466.599 33.1803 466.35 33.4864 466.35H34.5948C34.9009 466.35 35.149 466.599 35.149 466.905V468.013C35.149 468.319 34.9009 468.567 34.5948 468.567H33.4864C33.1803 468.567 32.9322 468.319 32.9322 468.013ZM36.2574 464.688V463.579C36.2574 463.273 36.5055 463.025 36.8115 463.025H37.9199C38.226 463.025 38.4741 463.273 38.4741 463.579V464.688C38.4741 464.994 38.226 465.242 37.9199 465.242H36.8115C36.5055 465.242 36.2574 464.994 36.2574 464.688ZM36.2574 466.905C36.2574 466.599 36.5055 466.35 36.8115 466.35H37.9199C38.226 466.35 38.4741 466.599 38.4741 466.905V471.338C38.4741 471.644 38.226 471.892 37.9199 471.892H36.8115C36.5055 471.892 36.2574 471.644 36.2574 471.338V466.905Z" />
        </svg>
      );
    case "sh":
      return (
        <svg viewBox="24 500 20 21" width={size} height={size} fill="currentColor" aria-hidden focusable={false}>
          <path fillRule="evenodd" clipRule="evenodd" d="M42 514.22C42 518.467 38.25 520.375 33 520.375C27.75 520.375 24 518.467 24 514.251C24 509.635 26.25 507.296 30.75 504.957L29.1564 501.914C29.0614 501.761 29.0085 501.585 29.0033 501.404C28.9982 501.223 29.041 501.044 29.1272 500.886C29.2134 500.729 29.3398 500.598 29.4929 500.508C29.646 500.417 29.82 500.372 29.9964 500.375H36.3564C36.5218 500.379 36.6834 500.427 36.826 500.513C36.9686 500.599 37.0875 500.721 37.1716 500.867C37.2555 501.013 37.3019 501.179 37.3064 501.349C37.3107 501.518 37.2728 501.686 37.1965 501.837L35.25 504.957C39.75 507.265 42 509.604 42 514.22ZM33.8704 507.357C33.8704 506.864 33.4807 506.464 33 506.464C32.5193 506.464 32.1296 506.864 32.1296 507.357V508.252C30.8386 508.308 29.8085 509.399 29.8085 510.737C29.8085 511.905 30.6018 512.916 31.7148 513.166L33.7663 513.626C34.1656 513.716 34.4507 514.079 34.4507 514.499C34.4507 514.993 34.0606 515.393 33.5803 515.393H32.4198C32.0421 515.393 31.7186 515.146 31.5987 514.798C31.4385 514.333 30.9412 514.089 30.4879 514.253C30.0347 514.418 29.7972 514.928 29.9574 515.393C30.2845 516.342 31.1195 517.048 32.1296 517.162V518.071C32.1296 518.564 32.5193 518.964 33 518.964C33.4807 518.964 33.8704 518.564 33.8704 518.071V517.162C35.1763 517.014 36.1915 515.878 36.1915 514.499C36.1915 513.241 35.3374 512.151 34.1383 511.882L32.0868 511.422C31.773 511.351 31.5494 511.066 31.5494 510.737C31.5494 510.349 31.8554 510.036 32.2328 510.036H33.5803C33.838 510.036 34.0686 510.149 34.2292 510.333C34.3047 510.42 34.3635 510.521 34.4014 510.631C34.5616 511.096 35.0589 511.339 35.5121 511.175C35.9653 511.011 36.2029 510.501 36.0427 510.036C35.9277 509.702 35.7506 509.399 35.5264 509.142C35.11 508.665 34.5266 508.341 33.8704 508.266V507.357Z" />
        </svg>
      );
    case "set":
      return (
        <svg viewBox="23 950 20 19" width={size} height={size} fill="currentColor" aria-hidden focusable={false}>
          <path d="M34.5802 951.182C34.1158 949.606 31.8842 949.606 31.4198 951.182L31.3071 951.564C31.0104 952.571 29.8605 953.047 28.9388 952.545L28.589 952.354C27.1465 951.568 25.5685 953.147 26.3542 954.589L26.5448 954.939C27.0468 955.861 26.5705 957.01 25.5638 957.307L25.1817 957.42C23.6061 957.884 23.6061 960.116 25.1817 960.58L25.5638 960.693C26.5705 960.99 27.0468 962.139 26.5448 963.061L26.3542 963.411C25.5685 964.853 27.1465 966.432 28.589 965.646L28.9388 965.455C29.8605 964.953 31.0104 965.429 31.3071 966.436L31.4198 966.818C31.8842 968.394 34.1158 968.394 34.5802 966.818L34.6929 966.436C34.9896 965.429 36.1395 964.953 37.0612 965.455L37.411 965.646C38.8535 966.432 40.4315 964.853 39.6458 963.411L39.4552 963.061C38.9532 962.139 39.4295 960.99 40.4362 960.693L40.8183 960.58C42.3939 960.116 42.3939 957.884 40.8183 957.42L40.4362 957.307C39.4295 957.01 38.9532 955.861 39.4552 954.939L39.6458 954.589C40.4315 953.147 38.8535 951.568 37.411 952.354L37.0612 952.545C36.1395 953.047 34.9896 952.571 34.6929 951.564L34.5802 951.182ZM33 962.295C31.1803 962.295 29.7051 960.82 29.7051 959C29.7051 957.18 31.1803 955.705 33 955.705C34.8197 955.705 36.2949 957.18 36.2949 959C36.2949 960.82 34.8197 962.295 33 962.295Z" />
        </svg>
      );
    case "help":
      return (
        <svg viewBox="24 989 18 18" width={size} height={size} fill="currentColor" aria-hidden focusable={false}>
          <path d="M33 989C28.032 989 24 993.032 24 998C24 1002.97 28.032 1007 33 1007C37.968 1007 42 1002.97 42 998C42 993.032 37.968 989 33 989ZM33.9 1004.3H32.1V1002.5H33.9V1004.3ZM35.763 997.325L34.953 998.153C34.305 998.81 33.9 999.35 33.9 1000.7H32.1V1000.25C32.1 999.26 32.505 998.36 33.153 997.703L34.269 996.569C34.602 996.245 34.8 995.795 34.8 995.3C34.8 994.31 33.99 993.5 33 993.5C32.01 993.5 31.2 994.31 31.2 995.3H29.4C29.4 993.311 31.011 991.7 33 991.7C34.989 991.7 36.6 993.311 36.6 995.3C36.6 996.092 36.276 996.812 35.763 997.325Z" />
        </svg>
      );
    case "moon":
      return (
        <svg viewBox="31 911 15 16" width={size} height={size} fill="currentColor" aria-hidden focusable={false}>
          <path d="M39.3119 911.005C34.6897 910.845 31 914.527 31 918.995C31 923.414 34.6013 927 39.0386 927C42.0209 927 44.6093 925.383 46 922.981C39.963 922.781 36.2814 916.233 39.3119 911.005Z" />
        </svg>
      );
    case "sun":
      return (
        <svg viewBox="30 911 16 16" width={size} height={size} fill="currentColor" aria-hidden focusable={false}>
          <path d="M38 923C40.2091 923 42 921.209 42 919C42 916.791 40.2091 915 38 915C35.7909 915 34 916.791 34 919C34 921.209 35.7909 923 38 923Z" />
          <path d="M38 911C38.2761 911 38.5 911.224 38.5 911.5V913.5C38.5 913.776 38.2761 914 38 914C37.7239 914 37.5 913.776 37.5 913.5V911.5C37.5 911.224 37.7239 911 38 911Z" />
          <path d="M38 924C38.2761 924 38.5 924.224 38.5 924.5V926.5C38.5 926.776 38.2761 927 38 927C37.7239 927 37.5 926.776 37.5 926.5V924.5C37.5 924.224 37.7239 924 38 924Z" />
          <path d="M46 919C46 919.276 45.7761 919.5 45.5 919.5H43.5C43.2239 919.5 43 919.276 43 919C43 918.724 43.2239 918.5 43.5 918.5H45.5C45.7761 918.5 46 918.724 46 919Z" />
          <path d="M33 919C33 919.276 32.7761 919.5 32.5 919.5H30.5C30.2239 919.5 30 919.276 30 919C30 918.724 30.2239 918.5 30.5 918.5H32.5C32.7761 918.5 33 918.724 33 919Z" />
          <path d="M43.6569 913.343C43.8521 913.538 43.8521 913.855 43.6569 914.05L42.2426 915.464C42.0474 915.66 41.7308 915.66 41.5355 915.464C41.3403 915.269 41.3403 914.953 41.5355 914.757L42.9497 913.343C43.145 913.148 43.4616 913.148 43.6569 913.343Z" />
          <path d="M34.4645 922.536C34.6597 922.731 34.6597 923.047 34.4645 923.243L33.0503 924.657C32.855 924.852 32.5384 924.852 32.3431 924.657C32.1479 924.462 32.1479 924.145 32.3431 923.95L33.7574 922.536C33.9526 922.34 34.2692 922.34 34.4645 922.536Z" />
          <path d="M43.6569 924.657C43.4616 924.852 43.145 924.852 42.9497 924.657L41.5355 923.243C41.3403 923.047 41.3403 922.731 41.5355 922.536C41.7308 922.34 42.0474 922.34 42.2426 922.536L43.6569 923.95C43.8521 924.145 43.8521 924.462 43.6569 924.657Z" />
          <path d="M34.4645 915.465C34.2692 915.66 33.9526 915.66 33.7574 915.465L32.3431 914.05C32.1479 913.855 32.1479 913.538 32.3431 913.343C32.5384 913.148 32.855 913.148 33.0503 913.343L34.4645 914.757C34.6597 914.953 34.6597 915.269 34.4645 915.465Z" />
        </svg>
      );
    case "pencil":
      return (
        <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden focusable={false}>
          <path d="M14.4 4.6l5 5L9.2 19.8l-5.4 1.2 1.2-5.4Z" />
          <path d="M12.6 6.4l5 5" />
        </svg>
      );
  }
}

const SIDEBAR_MAIN: { key: IconName; label: string; active?: boolean }[] = [
  { key: "dash",  label: "Dashboard", active: true },
  { key: "sched", label: "My Schedule" },
  { key: "inbox", label: "Inbox" },
];
const SIDEBAR_APPS: { key: IconName; label: string }[] = [
  { key: "ps", label: "Project Scheduler" },
  { key: "ws", label: "Weekly Scheduler" },
  { key: "sb", label: "Sign Builder Pro" },
  { key: "jp", label: "Job Punches" },
  { key: "es", label: "Estimating" },
  { key: "sh", label: "Sales Hub" },
];
const SIDEBAR_OTHER: { key: IconName; label: string }[] = [
  { key: "set",  label: "Settings" },
  { key: "help", label: "Help" },
];

/* ---------- Card catalog ---------- */

type CardId =
  | `kpi:${string}`
  | "donut"
  | "targets"
  | "kanban";

interface CardDef {
  id: CardId;
  title: string;
  category: "KPI" | "Chart" | "List" | "Board";
  default: { w: number; h: number };
  min: { w: number; h: number };
}

function buildCatalog(_role: Role): CardDef[] {
  // KPIs live in the fixed horizontal strip at the top — only larger
  // cards are arrangeable inside the customizable grid.
  return [
    { id: "donut",   title: "Production Department Workloads", category: "Chart", default: { w: 6, h: 6 }, min: { w: 4, h: 4 } },
    { id: "targets", title: "Upcoming Target Dates",            category: "List",  default: { w: 6, h: 6 }, min: { w: 4, h: 4 } },
    { id: "kanban",  title: "Task Board (Kanban)",              category: "Board", default: { w: 12, h: 8 }, min: { w: 6, h: 6 } },
  ];
}

/* ---------- Layout persistence ---------- */

type Item = { i: string; x: number; y: number; w: number; h: number; minW: number; minH: number };

function defaultLayout(_role: Role): Item[] {
  return [
    { i: "donut",   x: 0, y: 0, w: 6,  h: 6, minW: 4, minH: 4 },
    { i: "targets", x: 6, y: 0, w: 6,  h: 6, minW: 4, minH: 4 },
    { i: "kanban",  x: 0, y: 6, w: 12, h: 8, minW: 6, minH: 6 },
  ];
}

const LS_KEY = (role: Role) => `dm-layout-v2-${role}`;

function loadLayout(role: Role): Item[] {
  try {
    const raw = localStorage.getItem(LS_KEY(role));
    if (!raw) return defaultLayout(role);
    const parsed = JSON.parse(raw) as Item[];
    if (!Array.isArray(parsed) || parsed.length === 0) return defaultLayout(role);
    return parsed;
  } catch {
    return defaultLayout(role);
  }
}

function saveLayout(role: Role, items: Item[]) {
  try {
    localStorage.setItem(LS_KEY(role), JSON.stringify(items));
  } catch {
    /* ignore quota */
  }
}

/* ---------- Card renderer dispatch ---------- */

function CardContent({ id }: { id: string }) {
  if (id === "donut")   return <DonutBody />;
  if (id === "targets") return <TargetsBody />;
  if (id === "kanban")  return <KanbanBody />;
  return null;
}

function cardTitleFor(id: string): string {
  if (id === "donut")   return "Production Department Workloads";
  if (id === "targets") return "Upcoming Target Dates";
  if (id === "kanban")  return "Task Board";
  return id;
}

/* ---------- Horizontal-scrolling KPI strip ---------- */

function KpiStrip({ role }: { role: Role }) {
  const kpis = getKpiList(role);
  const trackRef = useRef<HTMLDivElement | null>(null);

  return (
    <section className="dm-kpi-strip" aria-label="KPIs">
      <div className="dm-kpi-strip__track" ref={trackRef}>
        {kpis.map((k) => (
          <article key={k.key} className="dm-kpi-strip__card dm-kpi">
            <KpiCardBody k={k} />
          </article>
        ))}
      </div>
    </section>
  );
}

/* ---------- Main component ---------- */

/** Hand off to the dedicated mobile layout below 820px. */
function useIsMobile(): boolean {
  const [mobile, setMobile] = useState<boolean>(() =>
    typeof window === "undefined" ? false : window.innerWidth < 820,
  );
  useEffect(() => {
    const onResize = () => setMobile(window.innerWidth < 820);
    window.addEventListener("resize", onResize);
    window.addEventListener("orientationchange", onResize);
    return () => {
      window.removeEventListener("resize", onResize);
      window.removeEventListener("orientationchange", onResize);
    };
  }, []);
  return mobile;
}

export default function DashboardCustomizable({ role, onBack }: Props) {
  const isMobile = useIsMobile();
  const [theme, setTheme] = useState<Theme>("light");
  const [editMode, setEditMode] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [layout, setLayout] = useState<Item[]>(() => loadLayout(role));
  const user = usersByRole[role];
  const catalog = useMemo(() => buildCatalog(role), [role]);

  if (isMobile) {
    return (
      <DashboardMobile
        role={role}
        theme={theme}
        onChangeTheme={setTheme}
        onBack={onBack}
      />
    );
  }

  // Reload layout if role changes
  useEffect(() => {
    setLayout(loadLayout(role));
  }, [role]);

  // Persist on layout change
  useEffect(() => {
    saveLayout(role, layout);
  }, [role, layout]);

  const activeIds = new Set(layout.map((i) => i.i));
  const available = catalog.filter((c) => !activeIds.has(c.id));

  function handleLayoutChange(next: ReadonlyArray<{ i: string; x: number; y: number; w: number; h: number }>) {
    // Preserve minW/minH on each item
    const byKey = new Map(layout.map((i) => [i.i, i]));
    const merged: Item[] = next.map((n) => {
      const prev = byKey.get(n.i);
      return {
        i: n.i,
        x: n.x, y: n.y, w: n.w, h: n.h,
        minW: prev?.minW ?? 2,
        minH: prev?.minH ?? 2,
      };
    });
    setLayout(merged);
  }

  function addCard(def: CardDef) {
    // Stack at the bottom of current layout
    const maxY = layout.reduce((m, it) => Math.max(m, it.y + it.h), 0);
    setLayout([
      ...layout,
      {
        i: def.id,
        x: 0, y: maxY,
        w: def.default.w, h: def.default.h,
        minW: def.min.w, minH: def.min.h,
      },
    ]);
  }

  function removeCard(id: string) {
    setLayout(layout.filter((it) => it.i !== id));
  }

  function resetLayout() {
    if (confirm("Reset dashboard to the default layout?")) {
      const def = defaultLayout(role);
      setLayout(def);
    }
  }

  return (
    <div className="dm-root dm-root--custom" data-theme={theme}>
      <aside className="dm-sidebar">
        <div className="dm-sidebar__brand">
          <div className="dm-sidebar__logo">
            <svg viewBox="22 22 36 36" width="36" height="36" aria-hidden focusable={false}>
              <path
                fill="#EE0800"
                d="M58 36.2161L29.8507 50.1493L58 40.6483V36.2397V36.2161ZM58 25.3949L29.8507 50.1493L58 31.4067V25.3949ZM29.8507 50.1493L35.4853 22H22V58H58V44.5147L29.8507 50.1493ZM39.3517 22L29.8507 50.1493L43.7839 22H39.3752H39.3517ZM54.5815 22L29.8271 50.1493L48.5697 22H54.5815Z"
              />
            </svg>
          </div>
          <div className="dm-sidebar__brandtext">
            <div className="dm-sidebar__brandname">LUMINEO SIGNS</div>
            <div className="dm-sidebar__brandsub">SWITCHBOARD</div>
          </div>
        </div>

        <div className="dm-sidebar__section">MAIN</div>
        <ul className="dm-sidebar__list">
          {SIDEBAR_MAIN.map((it) => (
            <li key={it.key}>
              <button className={`dm-sidebar__item ${it.active ? "is-active" : ""}`}>
                <span className="dm-sidebar__icon"><Icon name={it.key} /></span>
                <span className="dm-sidebar__label">{it.label}</span>
              </button>
            </li>
          ))}
        </ul>

        <div className="dm-sidebar__section">APPS</div>
        <ul className="dm-sidebar__list">
          {SIDEBAR_APPS.map((it) => (
            <li key={it.key}>
              <button className="dm-sidebar__item">
                <span className="dm-sidebar__icon"><Icon name={it.key} /></span>
                <span className="dm-sidebar__label">{it.label}</span>
              </button>
            </li>
          ))}
        </ul>

        <div className="dm-sidebar__section">OTHER</div>
        <button
          type="button"
          className="dm-sidebar__theme"
          onClick={() => setTheme(theme === "light" ? "dark" : "light")}
          aria-label={theme === "light" ? "Switch to dark mode" : "Switch to light mode"}
        >
          <span className="dm-sidebar__theme-icon">
            <Icon name={theme === "light" ? "moon" : "sun"} size={14} />
          </span>
          <span className="dm-sidebar__theme-label">{theme === "light" ? "Dark" : "Light"}</span>
        </button>
        <ul className="dm-sidebar__list">
          {SIDEBAR_OTHER.map((it) => (
            <li key={it.key}>
              <button className="dm-sidebar__item">
                <span className="dm-sidebar__icon"><Icon name={it.key} /></span>
                <span className="dm-sidebar__label">{it.label}</span>
              </button>
            </li>
          ))}
        </ul>
      </aside>

      <main className="dm-main">
        <header className="dm-topbar">
          <div>
            <div className="dm-topbar__crumb">Switchboard · Dashboard</div>
            <h1 className="dm-topbar__title">Hi {user.name.split(" ")[0]}, here's your day</h1>
          </div>
          <div className="dm-topbar__actions">
            <div className="dm-search">
              <span className="dm-search__icon">⌕</span>
              <span className="dm-search__placeholder">Search jobs, customers, people…</span>
            </div>
            {editMode ? (
              <>
                <button
                  type="button"
                  className="dm-edit-btn dm-edit-btn--add"
                  onClick={() => setDrawerOpen(true)}
                >
                  + Add card
                </button>
                <button
                  type="button"
                  className="dm-edit-btn dm-edit-btn--reset"
                  onClick={resetLayout}
                  title="Reset to default"
                >
                  ↺ Reset
                </button>
                <button
                  type="button"
                  className="dm-edit-btn dm-edit-btn--done"
                  onClick={() => { setEditMode(false); setDrawerOpen(false); }}
                >
                  ✓ Done
                </button>
              </>
            ) : (
              <button
                type="button"
                className="dm-edit-btn dm-edit-btn--icon"
                onClick={() => setEditMode(true)}
              >
                <Icon name="pencil" size={14} />
                <span>Edit dashboard</span>
              </button>
            )}
            {onBack && (
              <button type="button" className="dm-back" onClick={onBack}>← Splash</button>
            )}
            <div className="dm-user">
              <div className="dm-user__avatar">{user.initials}</div>
              <div>
                <div className="dm-user__name">{user.name}</div>
                <div className="dm-user__role">{role}</div>
              </div>
            </div>
          </div>
        </header>

        <KpiStrip role={role} />

        <div className={`dm-grid-wrap ${editMode ? "is-editing" : ""}`}>
          <Grid
            className="dm-grid"
            layout={layout}
            cols={12}
            rowHeight={48}
            margin={[14, 14]}
            containerPadding={[0, 0]}
            isDraggable={editMode}
            isResizable={editMode}
            draggableHandle=".dm-card-handle"
            onLayoutChange={handleLayoutChange}
            compactType="vertical"
            preventCollision={false}
          >
            {layout.map((it) => {
              const isKpi = it.i.startsWith("kpi:");
              return (
                <div
                  key={it.i}
                  className={`dm-card dm-card--grid ${isKpi ? "dm-card--kpi" : ""}`}
                >
                  <div className={`dm-card-handle ${editMode ? "is-visible" : ""}`}>
                    <span className="dm-card-handle__title">{cardTitleFor(it.i)}</span>
                    {editMode && (
                      <button
                        type="button"
                        className="dm-card-handle__remove"
                        onClick={() => removeCard(it.i)}
                        title="Remove card"
                        aria-label="Remove card"
                      >
                        ×
                      </button>
                    )}
                  </div>
                  <CardContent id={it.i} />
                </div>
              );
            })}
          </Grid>
        </div>
      </main>

      {/* Add-card drawer */}
      {drawerOpen && (
        <>
          <div className="dm-drawer__backdrop" onClick={() => setDrawerOpen(false)} />
          <aside className="dm-drawer">
            <header className="dm-drawer__head">
              <h3 className="dm-drawer__title">Card library</h3>
              <button
                type="button"
                className="dm-drawer__close"
                onClick={() => setDrawerOpen(false)}
              >×</button>
            </header>
            {available.length === 0 ? (
              <div className="dm-drawer__empty">All available cards are on your dashboard.</div>
            ) : (
              <ul className="dm-drawer__list">
                {(["KPI", "Chart", "List", "Board"] as const).map((cat) => {
                  const inCat = available.filter((c) => c.category === cat);
                  if (inCat.length === 0) return null;
                  return (
                    <li key={cat}>
                      <div className="dm-drawer__cat">{cat}</div>
                      <ul className="dm-drawer__sublist">
                        {inCat.map((c) => (
                          <li key={c.id}>
                            <button
                              type="button"
                              className="dm-drawer__item"
                              onClick={() => addCard(c)}
                            >
                              <span className="dm-drawer__item-title">{c.title}</span>
                              <span className="dm-drawer__item-meta">
                                {c.default.w}×{c.default.h}
                              </span>
                            </button>
                          </li>
                        ))}
                      </ul>
                    </li>
                  );
                })}
              </ul>
            )}
          </aside>
        </>
      )}
    </div>
  );
}
