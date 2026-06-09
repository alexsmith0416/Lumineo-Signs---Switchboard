import { useSpec } from "../../app/SpecContext";
import { Banner } from "../../ui/Banner";
import type { LEDColor } from "../../domain/SignSpec";

const COLORS: { code: LEDColor; label: string; dot: string }[] = [
  { code: "WH",  label: "White 7100K", dot: "#F5F5F5" },
  { code: "RD",  label: "Red",         dot: "#E8151B" },
  { code: "BL",  label: "Blue",        dot: "#0074C8" },
  { code: "GR",  label: "Green",       dot: "#1A7A4A" },
  { code: "RGB", label: "RGB",         dot: "linear-gradient(90deg,#E8151B,#F4B400,#1A7A4A,#0074C8,#5C3478)" },
];

export function Step5LED() {
  const { spec, update } = useSpec();
  return (
    <>
      <div className="sbp-step">
        <div className="sbp-step__head"><span>5 · LED Color</span></div>
        <div className="sbp-step__body">
          <div className="sbp-toggle-row">
            {COLORS.map((c) => (
              <button
                key={c.code}
                type="button"
                className={"lum-btn is-toggle" + (spec.ledColor === c.code ? " is-active" : "")}
                onClick={() => update({ ledColor: c.code })}
              >
                <span
                  aria-hidden
                  style={{
                    display: "inline-block",
                    width: 10,
                    height: 10,
                    borderRadius: 999,
                    background: c.dot,
                    border: "1px solid rgba(0,0,0,0.15)",
                  }}
                />
                {c.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {spec.ledColor === "RGB" ? (
        <Banner tone="amber">
          RGB requires programmable driver + controller — confirm price uplift with Sales before quoting.
        </Banner>
      ) : null}
    </>
  );
}
