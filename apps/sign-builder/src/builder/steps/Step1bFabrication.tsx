import { useSpec } from "../../app/SpecContext";
import { Banner } from "../../ui/Banner";

export function Step1bFabrication() {
  const { spec, setOutsourced } = useSpec();
  return (
    <>
      <div className="sbp-step">
        <div className="sbp-step__head"><span>1B · Fabrication</span></div>
        <div className="sbp-step__body">
          <div className="sbp-toggle-row">
            <button
              type="button"
              className={"lum-btn is-toggle" + (!spec.outsourced ? " is-active" : "")}
              onClick={() => setOutsourced(false)}
            >
              In-House
            </button>
            <button
              type="button"
              className={"lum-btn is-toggle" + (spec.outsourced ? " is-active" : "")}
              onClick={() => setOutsourced(true)}
            >
              Outsourced
            </button>
          </div>
        </div>
      </div>

      {spec.outsourced ? (
        <Banner tone="amber">
          Outsourced letters skip Paint &amp; Vinyl departments in routing — finish is vendor-supplied.
        </Banner>
      ) : null}
    </>
  );
}
