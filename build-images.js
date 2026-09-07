// Escanea la carpeta images/ y regenera images.js con la lista de archivos.
// Corré esto (node build-images.js) cada vez que agregues o saques fotos.
const fs = require("fs");
const path = require("path");

const DIR = path.join(__dirname, "images");
const EXTS = new Set([".jpg", ".jpeg", ".png", ".gif", ".webp"]);

const files = fs.existsSync(DIR)
  ? fs.readdirSync(DIR).filter((f) => EXTS.has(path.extname(f).toLowerCase())).sort()
  : [];

const entries = files
  .map((f) => `  { url: "images/${encodeURIComponent(f)}", alt: "Imagen misteriosa" },`)
  .join("\n");

const out = `// Generado por build-images.js — no editar a mano.
// Para sumar/sacar fotos: metelas en images/ y corré \`node build-images.js\`.
const EXOTIC_IMAGES = [
${entries}
];
`;

fs.writeFileSync(path.join(__dirname, "images.js"), out);
console.log(`images.js actualizado con ${files.length} imagen(es).`);
