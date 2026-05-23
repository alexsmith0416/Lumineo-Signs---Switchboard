// The SignSpec form-state model. Mirrors the 31-field Sign Specifications
// Dataverse table that `Patch()` writes to on Save.
//
// All globals from the canvas plan map onto fields here.
export function emptySignSpec() {
    return {
        productCode: "",
        status: "Draft",
        customerName: "",
        projectName: "",
        quantity: 1,
        signTypeCode: "",
        outsourced: false,
        faces: "",
        heightIn: "",
        widthIn: "",
        depthIn: "",
        illumination: "",
        ledColor: "WH",
        faceType: "",
        backerType: "",
        backerColor: "",
        finish: "",
        paintColor: "",
        vinyl: "",
        vinylColor: "",
        vinylHex: "",
        digitalRef: "",
        mounting: "",
        poleType: "",
        poleDiameter: "",
        poleMaterial: "",
        footingType: "",
        footingMethod: "",
        electrical: "",
        conduitSize: "",
        notes: "",
        departments: "",
    };
}
