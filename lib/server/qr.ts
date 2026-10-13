import QRCode from "qrcode";

// QR codes générés sur l'ordinateur de la famille (aucun service en ligne).
export async function qrSvg(text: string, dark = "#12261A", light = "#FAF7F1") {
  // Les longs liens (fiche complète, arbre) gardent des carrés assez gros pour être lus.
  const errorCorrectionLevel = text.length > 900 ? "L" : "M";
  return QRCode.toString(text, { type: "svg", margin: 1, errorCorrectionLevel, color: { dark, light } });
}
