// Illustrations peintes à la main (dessinées par le téléphone) pour la famille d'exemple :
// paysages du village, jamais de faux visages.

type Scene = { sky: [string, string, string]; sun: [number, number, number]; hills: string[]; tree: "fromager" | "baobab" | "palmier"; huts: boolean };

const SCENES: Scene[] = [
  { sky: ["#F2C27B", "#D9875A", "#5B3A2E"], sun: [0.72, 0.42, 70], hills: ["#7A5634", "#4E3523", "#2A1D14"], tree: "fromager", huts: true },
  { sky: ["#F7E3B5", "#E2B26F", "#8C5A36"], sun: [0.25, 0.3, 55], hills: ["#8A7046", "#5E4A2C", "#33281A"], tree: "baobab", huts: false },
  { sky: ["#F0A868", "#B5563A", "#3B2420"], sun: [0.5, 0.55, 90], hills: ["#5C3A26", "#3A2518", "#1E140D"], tree: "palmier", huts: true },
];

function rand(seed: number) {
  let x = seed;
  return () => ((x = (x * 16807) % 2147483647) / 2147483647);
}

export async function paintScene(i: number, w = 1200, h = 800): Promise<Blob> {
  const sc = SCENES[i % SCENES.length];
  const r = rand(97 + i * 31);
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const g = c.getContext("2d")!;
  const sky = g.createLinearGradient(0, 0, 0, h);
  sky.addColorStop(0, sc.sky[0]);
  sky.addColorStop(0.55, sc.sky[1]);
  sky.addColorStop(1, sc.sky[2]);
  g.fillStyle = sky;
  g.fillRect(0, 0, w, h);
  // Soleil voilé
  const [sx, sy, sr] = sc.sun;
  const halo = g.createRadialGradient(sx * w, sy * h, 0, sx * w, sy * h, sr * 4);
  halo.addColorStop(0, "rgba(255,240,200,0.95)");
  halo.addColorStop(0.25, "rgba(255,220,160,0.45)");
  halo.addColorStop(1, "rgba(255,200,140,0)");
  g.fillStyle = halo;
  g.fillRect(0, 0, w, h);
  // Collines en couches
  sc.hills.forEach((col, k) => {
    const base = h * (0.62 + k * 0.1);
    g.fillStyle = col;
    g.beginPath();
    g.moveTo(0, h);
    for (let x = 0; x <= w; x += 20) g.lineTo(x, base + Math.sin(x / (180 - k * 30) + k * 2) * (26 - k * 6) + Math.sin(x / 57 + k) * 6);
    g.lineTo(w, h);
    g.fill();
  });
  // Arbre en silhouette
  const tx = w * (sc.tree === "baobab" ? 0.66 : 0.3);
  const ground = h * 0.78;
  g.fillStyle = "#1A120C";
  g.strokeStyle = "#1A120C";
  if (sc.tree === "baobab") {
    g.beginPath();
    g.moveTo(tx - 46, ground);
    g.quadraticCurveTo(tx - 60, ground - 160, tx - 26, ground - 250);
    g.lineTo(tx + 26, ground - 250);
    g.quadraticCurveTo(tx + 60, ground - 160, tx + 46, ground);
    g.fill();
    g.lineCap = "round";
    for (let k = 0; k < 9; k++) {
      const a = -Math.PI / 2 + (k - 4) * 0.32;
      g.lineWidth = 12 - Math.abs(k - 4);
      g.beginPath();
      g.moveTo(tx, ground - 245);
      g.lineTo(tx + Math.cos(a) * (110 + r() * 50), ground - 245 + Math.sin(a) * (80 + r() * 40));
      g.stroke();
    }
  } else if (sc.tree === "fromager") {
    g.beginPath();
    g.moveTo(tx - 30, ground);
    g.lineTo(tx - 12, ground - 330);
    g.lineTo(tx + 12, ground - 330);
    g.lineTo(tx + 30, ground);
    g.fill();
    for (let k = 0; k < 4; k++) {
      const y = ground - 330 + k * 46;
      const span = 230 - k * 30;
      g.beginPath();
      g.ellipse(tx, y, span, 26, 0, Math.PI, 0);
      g.fill();
    }
  } else {
    for (let p = 0; p < 3; p++) {
      const px = tx + p * 90 - 60;
      const top = ground - 280 + p * 40;
      g.lineWidth = 9;
      g.beginPath();
      g.moveTo(px, ground);
      g.quadraticCurveTo(px + 30, (ground + top) / 2, px + 14, top);
      g.stroke();
      g.lineWidth = 6;
      for (let k = 0; k < 7; k++) {
        const a = Math.PI + (k / 6) * Math.PI;
        g.beginPath();
        g.moveTo(px + 14, top);
        g.quadraticCurveTo(px + 14 + Math.cos(a) * 60, top + Math.sin(a) * 40 - 10, px + 14 + Math.cos(a) * 110, top + Math.sin(a) * 30 + 40);
        g.stroke();
      }
    }
  }
  // Cases du village
  if (sc.huts) {
    for (let k = 0; k < 4; k++) {
      const hx = w * 0.55 + k * 85;
      const hy = ground + 18 + (k % 2) * 10;
      g.fillRect(hx - 28, hy - 40, 56, 40);
      g.beginPath();
      g.moveTo(hx - 42, hy - 38);
      g.lineTo(hx, hy - 82);
      g.lineTo(hx + 42, hy - 38);
      g.fill();
    }
  }
  // Grain de vieille photo
  const img = g.getImageData(0, 0, w, h);
  for (let k = 0; k < img.data.length; k += 4) {
    const n = (r() - 0.5) * 22;
    img.data[k] += n;
    img.data[k + 1] += n;
    img.data[k + 2] += n;
  }
  g.putImageData(img, 0, 0);
  const vig = g.createRadialGradient(w / 2, h / 2, h * 0.3, w / 2, h / 2, w * 0.75);
  vig.addColorStop(0, "rgba(0,0,0,0)");
  vig.addColorStop(1, "rgba(20,10,5,0.55)");
  g.fillStyle = vig;
  g.fillRect(0, 0, w, h);
  return new Promise((res) => c.toBlob((b) => res(b!), "image/jpeg", 0.85));
}
