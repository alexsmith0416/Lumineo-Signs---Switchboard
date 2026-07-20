import { useRef, useState } from "react";
import { createPortal } from "react-dom";
import { differenceInMinutes, format } from "date-fns";
import type { Conflict, Department, Employee, ScheduleLine } from "../engine/types";
import { effectiveHours } from "../engine/capacity";
import { lookupZip } from "../services/zip-geo";
import { useLoadsStore } from "../shipping/loads-store";
import { shipmentCardDesc, shipmentSummary } from "../shipping/types";
import CrewBadge from "./CrewBadge";
import WeatherChip from "./WeatherChip";
import { personByCode, pmForSalespersonCode } from "../services/sales-pm";
import { bcJobUrl, sharepointJobUrl } from "../services/job-links";

interface JobCardProps {
  line: ScheduleLine;
  department: Department | undefined;
  conflicts: Conflict[];
  employee?: Employee;
  showInvoice?: boolean;
  showCrewBadge?: boolean;
  showWeather?: boolean;
  layout?: "compact" | "stacked";
  /** The card spans more than one day (wider). On mobile its addons lay out on
   *  one line (wrapping only if too long) instead of stacking. */
  multiDay?: boolean;
  /** Right-click menu action: duplicate this card (omitted on read-only boards). */
  onDuplicate?: () => void;
  /** Right-click menu action: delete this card (omitted on read-only boards). */
  onDelete?: () => void;
}

function formatMoney(amount: number): string {
  return `$${amount.toLocaleString("en-US")}`;
}

/** The $ value shown under the $ toggle — BC remaining value, else a stored
 *  invoice amount. */
export function cardMoneyValue(line: ScheduleLine): number | null {
  if (typeof line.remainingValue === "number" && line.remainingValue > 0) return line.remainingValue;
  if (typeof line.invoiceAmount === "number" && line.invoiceAmount > 0) return line.invoiceAmount;
  return null;
}

function hasCrew(line: ScheduleLine): boolean {
  return !!(
    line.crewPersons ||
    line.crewTrucks ||
    line.crewTrips ||
    line.crewCranes ||
    line.crewLifts ||
    line.crewBuckets
  );
}

/** How many addon items (crew / weather / $) this card will render for the
 *  given toggle flags. Drives the lane height: on mobile the addons stack, so
 *  each one needs its own line. */
export function cardAddonCount(
  line: ScheduleLine,
  f: { showInvoice?: boolean; showCrewBadge?: boolean; showWeather?: boolean },
): number {
  let n = 0;
  if (!!f.showCrewBadge && hasCrew(line)) n += 1;
  if (!!f.showWeather && !!line.installZip) n += 1;
  if (!!f.showInvoice && cardMoneyValue(line) != null) n += 1;
  return n;
}

/** Whether the addons row will render anything — so the card (and its lane
 *  height) don't reserve an empty line. */
export function cardHasAddons(
  line: ScheduleLine,
  f: { showInvoice?: boolean; showCrewBadge?: boolean; showWeather?: boolean },
): boolean {
  return cardAddonCount(line, f) > 0;
}

function deptStyle(dept: Department | undefined): { bg: string; text: string } {
  if (!dept) return { bg: "#cccccc", text: "#222222" };
  const bg = dept.color;
  const textMap: Record<string, string> = {
    "#BED7FF": "#042c53",
    "#FAC775": "#633806",
    "#CECBF6": "#26215c",
    "#C8E6D4": "#04342c",
    "#FFE0A8": "#5e3c00",
    "#D6DCE5": "#1c2533",
    "#F8D5B7": "#5b2a00",
  };
  return { bg, text: textMap[bg] ?? "#1a1d23" };
}

function cardStyle(line: ScheduleLine, dept: Department | undefined): { bg: string; text: string } {
  if (line.isCustom && line.customColor) {
    return {
      bg: line.customColor,
      text: line.customTextColor || "#1a1d23",
    };
  }
  return deptStyle(dept);
}

const HOVER_DELAY_MS = 250;

export default function JobCard({
  line,
  department,
  conflicts,
  employee,
  showInvoice = false,
  showCrewBadge = false,
  showWeather = false,
  layout = "compact",
  multiDay = false,
  onDuplicate,
  onDelete,
}: JobCardProps) {
  const style = cardStyle(line, department);
  // Shipment cards are a LIVE reference to the load — title + summary derive
  // from the current load so edits in the Shipping schedule update the install
  // card automatically. Falls back to the stored snapshot if the load is gone.
  const shipmentLoad = useLoadsStore((s) =>
    line.shipmentLoadId ? s.loads.find((l) => l.id === line.shipmentLoadId) : undefined,
  );
  const cardTitle = shipmentLoad ? shipmentLoad.name : line.customerName || line.jobNo;
  const cardDesc = shipmentLoad ? shipmentCardDesc(shipmentLoad) : line.planningLineDescription;
  // Display-overridden line for the hover tooltip so it shows the live load
  // (name + full stop/item summary), not the creation-time snapshot.
  const displayLine: ScheduleLine = shipmentLoad
    ? {
        ...line,
        jobNo: shipmentLoad.name,
        customerName: shipmentLoad.name,
        planningLineDescription: shipmentSummary(shipmentLoad),
      }
    : line;
  const lineConflicts = conflicts.filter(
    (c) => c.lineId === line.id || c.relatedLineId === line.id,
  );
  const pastDue = lineConflicts.some((c) => c.type === "past-due");
  const overlap = lineConflicts.some(
    (c) => c.type === "employee-overlap" || c.type === "department-order",
  );

  const cardRef = useRef<HTMLDivElement>(null);
  const timerRef = useRef<number | undefined>(undefined);
  const [tooltipRect, setTooltipRect] = useState<DOMRect | null>(null);
  const [menu, setMenu] = useState<{ x: number; y: number } | null>(null);
  // Right-click links are only meaningful for a real BC job card.
  const canOpenLinks = !!line.jobNo && !line.isCustom && !line.shipmentLoadId;
  // The context menu opens if there's anything to show: BC links and/or the
  // duplicate/delete actions (present only on editable boards).
  const hasMenu = canOpenLinks || !!onDuplicate || !!onDelete;

  const open = () => {
    if (timerRef.current) window.clearTimeout(timerRef.current);
    timerRef.current = window.setTimeout(() => {
      if (cardRef.current) setTooltipRect(cardRef.current.getBoundingClientRect());
    }, HOVER_DELAY_MS);
  };
  const close = () => {
    if (timerRef.current) window.clearTimeout(timerRef.current);
    setTooltipRect(null);
  };

  return (
    <>
      <div
        ref={cardRef}
        className={`job-card job-card--${layout}${line.isCustom ? " job-card--custom" : ""}${multiDay ? " job-card--multiday" : ""}`}
        style={{ background: style.bg, color: style.text }}
        onMouseEnter={open}
        onMouseLeave={close}
        onContextMenu={
          hasMenu
            ? (e) => {
                e.preventDefault();
                e.stopPropagation();
                close();
                setMenu({ x: e.clientX, y: e.clientY });
              }
            : undefined
        }
      >
        {line.isCustom ? (
          <div className="job-card__custom-title">
            {line.shipmentLoadId ? "🚚 " : ""}
            {cardTitle}
          </div>
        ) : (
          <div className="job-card__header">
            <span className="job-card__job-no">{line.jobNo}</span>
            <span className="job-card__customer">{line.customerName}</span>
          </div>
        )}
        {line.jobDescription && (
          <div className="job-card__job-desc">{line.jobDescription}</div>
        )}
        {cardDesc && <div className="job-card__desc">{cardDesc}</div>}
        {cardHasAddons(line, { showInvoice, showCrewBadge, showWeather }) && (
          <div className="job-card__addons">
            {showCrewBadge && <CrewBadge line={line} />}
            {showWeather && (
              <WeatherChip
                zip={line.installZip}
                forDate={line.startDateTime}
                className="job-card__weather"
              />
            )}
            {showInvoice && cardMoneyValue(line) != null && (
              <span className="job-card__invoice" title="Remaining value (BC)">
                {formatMoney(cardMoneyValue(line)!)}
              </span>
            )}
          </div>
        )}
        <div className="job-card__icons">
          {line.isLocked && <span title="Locked">🔒</span>}
          {pastDue && <span title="Past customer due date">⚠</span>}
          {overlap && <span title="Conflict">⚡</span>}
        </div>
      </div>
      {tooltipRect &&
        createPortal(
          <JobTooltip
            line={displayLine}
            department={department}
            employee={employee}
            conflicts={lineConflicts}
            anchorRect={tooltipRect}
            deptStyle={style}
            showWeather={showWeather}
          />,
          document.body,
        )}
      {menu &&
        createPortal(
          // stopPropagation on the backdrop and menu is essential: this menu is
          // portaled to <body>, but React bubbles portal events through the
          // COMPONENT tree — so without it, clicking an option (or the backdrop
          // to dismiss) bubbles up to the card's onClick and wrongly opens the
          // edit panel. The edit panel must only open on a left-click of the card.
          <>
            <div
              style={{ position: "fixed", inset: 0, zIndex: 300 }}
              onClick={(e) => {
                e.stopPropagation();
                setMenu(null);
              }}
              onContextMenu={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setMenu(null);
              }}
            />
            <div
              className="job-context-menu"
              style={{
                position: "fixed",
                top: Math.min(menu.y, window.innerHeight - 160),
                left: Math.min(menu.x, window.innerWidth - 220),
                zIndex: 301,
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="job-context-menu__head">{line.jobNo || cardTitle}</div>
              {canOpenLinks && (
                <>
                  <button
                    type="button"
                    onClick={() => {
                      window.open(bcJobUrl(line.jobNo), "_blank", "noopener");
                      setMenu(null);
                    }}
                  >
                    Open Project
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      window.open(
                        line.sharepointUrl || sharepointJobUrl(line.jobNo),
                        "_blank",
                        "noopener",
                      );
                      setMenu(null);
                    }}
                  >
                    Open SharePoint Folder
                  </button>
                </>
              )}
              {onDuplicate && (
                <button
                  type="button"
                  onClick={() => {
                    onDuplicate();
                    setMenu(null);
                  }}
                >
                  Duplicate
                </button>
              )}
              {onDelete && (
                <button
                  type="button"
                  className="job-context-menu__danger"
                  onClick={() => {
                    onDelete();
                    setMenu(null);
                  }}
                >
                  Delete
                </button>
              )}
            </div>
          </>,
          document.body,
        )}
    </>
  );
}

interface JobTooltipProps {
  line: ScheduleLine;
  department: Department | undefined;
  employee: Employee | undefined;
  conflicts: Conflict[];
  anchorRect: DOMRect;
  deptStyle: { bg: string; text: string };
  /** Install-context signal — production cards pass false, hiding the
   *  install-only Location (ZIP) + Weather sections. */
  showWeather: boolean;
}

function JobTooltip({ line, department, employee, conflicts, anchorRect, deptStyle, showWeather }: JobTooltipProps) {
  const salesperson = line.isCustom ? undefined : personByCode(line.salespersonCode);
  const pm = line.isCustom ? undefined : pmForSalespersonCode(line.salespersonCode);
  const TOOLTIP_W = 300;
  const TOOLTIP_H_ESTIMATE = 360;
  const margin = 8;
  // Prefer above the card; fall back below if no room.
  const placeAbove = anchorRect.top > TOOLTIP_H_ESTIMATE + margin;
  const top = placeAbove
    ? Math.max(margin, anchorRect.top - margin - TOOLTIP_H_ESTIMATE)
    : Math.min(window.innerHeight - TOOLTIP_H_ESTIMATE - margin, anchorRect.bottom + margin);
  const left = Math.min(
    window.innerWidth - TOOLTIP_W - margin,
    Math.max(margin, anchorRect.left + anchorRect.width / 2 - TOOLTIP_W / 2),
  );

  const spanHours = differenceInMinutes(line.endDateTime, line.startDateTime) / 60;
  const eff = employee ? effectiveHours(line, employee) : null;
  const rawHours = line.overrideHours ?? line.estimatedHours;
  const spansMultipleDays =
    line.startDateTime.toDateString() !== line.endDateTime.toDateString();

  const dueDelta = line.customerDueDate
    ? Math.round(
        (line.customerDueDate.getTime() - line.endDateTime.getTime()) / (1000 * 60 * 60 * 24),
      )
    : null;

  return (
    <div
      style={{
        position: "fixed",
        top,
        left,
        width: TOOLTIP_W,
        background: "var(--surface-raised)",
        border: "1px solid var(--border)",
        borderRadius: 6,
        boxShadow: "0 8px 24px rgba(0,0,0,0.15)",
        zIndex: 100,
        pointerEvents: "none",
        fontSize: 12,
        overflow: "hidden",
      }}
    >
      <div
        style={{
          padding: "8px 10px",
          background: deptStyle.bg,
          color: deptStyle.text,
          fontWeight: 600,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "baseline",
        }}
      >
        <span>{line.jobNo}</span>
        <span style={{ fontSize: 10, opacity: 0.75 }}>{department?.name ?? "—"}</span>
      </div>
      <div style={{ padding: "8px 10px" }}>
        <div style={{ fontWeight: 600, fontSize: 13 }}>{line.customerName}</div>
        {line.jobDescription && (
          <div style={{ fontWeight: 500, marginTop: 2 }}>{line.jobDescription}</div>
        )}
        <div style={{ color: "var(--text-secondary)", marginTop: 2, whiteSpace: "pre-line" }}>
          {line.planningLineDescription}
        </div>

        <Row label="Start" value={format(line.startDateTime, "EEE MMM d HH:mm")} />
        <Row label="End" value={format(line.endDateTime, "EEE MMM d HH:mm")} />
        <Row
          label="Work"
          value={
            <>
              <strong>{rawHours}h</strong>
              {line.overrideHours !== null && (
                <span style={{ color: "var(--text-tertiary)" }}> (override)</span>
              )}
              {eff !== null && Math.abs(eff - rawHours) > 0.01 && (
                <span style={{ color: "var(--text-secondary)" }}>
                  {" → "}
                  {eff.toFixed(2)}h scheduled
                </span>
              )}
              {spansMultipleDays && (
                <span style={{ color: "var(--text-tertiary)" }}>
                  {" · spans "}
                  {spanHours.toFixed(1)}h
                </span>
              )}
            </>
          }
        />

        {employee && (
          <Row
            label="Resource"
            value={`${employee.name} · ${Math.round(employee.productivityRate * 100)}% · ${employee.standardHoursPerDay}h/day`}
          />
        )}

        {salesperson && <Row label="Salesperson" value={salesperson.name} />}
        {pm && <Row label="PM" value={pm.name} />}

        {showWeather && line.installZip && (() => {
          const geo = lookupZip(line.installZip);
          return (
            <Row
              label="Location"
              value={
                geo ? (
                  <>
                    {geo.city}, {geo.state}{" "}
                    <span style={{ color: "var(--text-tertiary)" }}>{line.installZip}</span>
                  </>
                ) : (
                  <span style={{ color: "var(--text-tertiary)" }}>ZIP {line.installZip}</span>
                )
              }
            />
          );
        })()}

        {showWeather && line.installZip && (
          <div style={{ marginTop: 8 }}>
            <div
              style={{
                fontSize: 10,
                letterSpacing: 0.4,
                textTransform: "uppercase",
                color: "var(--text-tertiary)",
                marginBottom: 4,
              }}
            >
              Weather
            </div>
            <WeatherChip
              zip={line.installZip}
              forDate={line.startDateTime}
              size="expanded"
            />
          </div>
        )}

        {line.customerDueDate && (
          <Row
            label="Due"
            value={
              <>
                {format(line.customerDueDate, "EEE MMM d")}
                {dueDelta !== null && (
                  <span
                    style={{
                      marginLeft: 6,
                      color: dueDelta < 0 ? "var(--lumineo-red)" : "var(--text-tertiary)",
                    }}
                  >
                    ({dueDelta < 0 ? `${Math.abs(dueDelta)}d past` : `${dueDelta}d slack`})
                  </span>
                )}
              </>
            }
          />
        )}

        {(line.isLocked || conflicts.length > 0) && (
          <div
            style={{
              marginTop: 8,
              padding: "6px 8px",
              background: "var(--bg-secondary)",
              borderRadius: 4,
              fontSize: 11,
            }}
          >
            {line.isLocked && (
              <div>
                🔒 <strong>Locked</strong> — cascade flows around this task
              </div>
            )}
            {conflicts.map((c, i) => (
              <div
                key={i}
                style={{ color: "var(--lumineo-red)", marginTop: line.isLocked ? 4 : 0 }}
              >
                ⚠ {c.message}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "70px 1fr",
        gap: 8,
        marginTop: 6,
      }}
    >
      <span
        style={{
          fontSize: 10,
          letterSpacing: 0.4,
          textTransform: "uppercase",
          color: "var(--text-tertiary)",
          alignSelf: "center",
        }}
      >
        {label}
      </span>
      <span>{value}</span>
    </div>
  );
}
