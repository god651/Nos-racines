import QRCode from "qrcode";

// QR codes générés sur l'ordinateur de la famille (aucun service en ligne).
export async function qrSvg(text: string, dark = "#12261A", light = "#FAF7F1") {
  return QRCode.toString(text, { type: "svg", margin: 1, errorCorrectionLevel: "M", color: { dark, light } });
}
