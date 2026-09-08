import fs from "node:fs";
import zlib from "node:zlib";

/**
 * Pemeriksa isi PDF hasil ekspor tanpa dependensi tambahan: membuka setiap
 * content stream, lalu mengumpulkan literal teks di dalamnya. Cukup untuk
 * memastikan angka-angka kunci benar-benar tercetak.
 */
const file = process.argv[2];
if (!file) {
  console.error("Pakai: node scripts/pdf-text.mjs <file.pdf> [kata kunci...]");
  process.exit(1);
}

const buf = fs.readFileSync(file);
const raw = buf.toString("latin1");

let text = "";
let cursor = 0;
while ((cursor = raw.indexOf("stream", cursor)) !== -1) {
  // "endstream" juga mengandung kata "stream" - lewati agar penanda
  // pembuka tidak salah tangkap.
  if (raw.slice(cursor - 3, cursor) === "end") {
    cursor += 6;
    continue;
  }
  let start = cursor + 6;
  while (raw[start] === "\r" || raw[start] === "\n") start += 1;

  const end = raw.indexOf("endstream", start);
  if (end < 0) break;

  try {
    text += zlib.inflateSync(buf.subarray(start, end)).toString("latin1");
  } catch {
    // Stream tanpa kompresi (font, gambar) - lewati saja.
  }
  cursor = end;
}

// react-pdf menulis teks sebagai hex string di dalam array TJ
// (mis. `[<5065726e> 0 <696b>] TJ`), bukan literal `( ... ) Tj`.
// Potongan dalam satu array TJ disambung tanpa spasi karena itu satu kata.
const chunks = [];
for (const [, body] of text.matchAll(/\[((?:\s*<[0-9a-fA-F]*>\s*-?[\d.]*)+)\]\s*TJ/g)) {
  let word = "";
  for (const [, hex] of body.matchAll(/<([0-9a-fA-F]*)>/g)) {
    word += Buffer.from(hex, "hex").toString("latin1");
  }
  chunks.push(word);
}
for (const [, literal] of text.matchAll(/\(((?:[^()\\]|\\.)*)\)\s*Tj/g)) {
  chunks.push(literal);
}

const joined = chunks.join(" ");

console.log(`Teks terekstrak: ${joined.length} karakter`);

const needles = process.argv.slice(3);
if (needles.length === 0) {
  console.log(joined.slice(0, 2000));
} else {
  let missing = 0;
  for (const n of needles) {
    const found = joined.includes(n);
    if (!found) missing += 1;
    console.log(`${found ? "OK   " : "HILANG"}  ${n}`);
  }
  process.exit(missing > 0 ? 1 : 0);
}
