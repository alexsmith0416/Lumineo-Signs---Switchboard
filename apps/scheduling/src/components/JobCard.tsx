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

interface JobCardProps {
  line: ScheduleLine;
  department: Department | undefined;
  conflicts: Conflict[];
  employee?: Employee;
  showInvoice?: boolean;
  showCrewBadge?: boolean;
  showWeather?: boolean;
  layout?: "compact" | "stacked";
}

function formatMoney(amount: number): string {
  return `$${amount.toLocaleString("en-US")}`;
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
        className={`job-card job-card--${layout}${line.isCustom ? " job-card--custom" : ""}`}
        style={{ background: style.bg, color: style.text }}
        onMouseEnter={open}
        onMouseLeave={close}
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
        {(showCrewBadge || showWeather || showInvoice) && (
          <div className="job-card__addons">
            {showCrewBadge && <CrewBadge line={line} />}
            {showWeather && <WeatherChip zip={line.installZip} forDate={line.startDateTime} />}
            {showInvoice && typeof line.invoiceAmount === "number" && line.invoiceAmount > 0 && (
              <span className="job-card__invoice">{formatMoney(line.invoiceAmount)}</span>
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
          />,
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
}

function JobTooltip({ line, department, employee, conflicts, anchorRect, deptStyle }: JobTooltipProps) {
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

        {line.installZip && (() => {
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

        {line.installZip && (
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
