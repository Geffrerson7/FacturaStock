/**
 * Genera las ilustraciones de los productos de la demo en
 * `public/demo/products/<sku>.svg`, a partir de la forma y el color de cada
 * producto del catálogo.
 *
 * Uso: pnpm demo:images
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import {
  DEMO_PRODUCTS,
  demoProductImagePath,
  type ProductShape,
} from "../src/lib/demo-data/catalog";

const SHADE = `fill="#000" fill-opacity=".14"`;
const LIGHT = `fill="#fff" fill-opacity=".9"`;
const SHINE = `fill="#fff" fill-opacity=".28"`;

// Cada forma ocupa el centro de un lienzo de 128 × 128. `c` es el color del
// producto; la sombra, el brillo y la etiqueta se superponen con opacidad.
const SHAPES: Record<ProductShape, (c: string) => string> = {
  bottle: (c) => `
    <rect x="56" y="14" width="16" height="10" rx="2" fill="${c}"/>
    <rect x="56" y="14" width="16" height="10" rx="2" ${SHADE}/>
    <path d="M58 24h12v10c0 4 12 8 12 18v52a8 8 0 0 1-8 8H54a8 8 0 0 1-8-8V52c0-10 12-14 12-18z" fill="${c}"/>
    <path d="M70 24v10c0 4 12 8 12 18v52a8 8 0 0 1-8 8h-6V24z" ${SHADE}/>
    <rect x="46" y="62" width="36" height="26" ${LIGHT}/>
    <rect x="53" y="71" width="22" height="3" rx="1.5" fill="${c}"/>
    <rect x="53" y="77" width="14" height="3" rx="1.5" fill="${c}" fill-opacity=".5"/>
    <rect x="51" y="44" width="4" height="14" rx="2" ${SHINE}/>`,
  can: (c) => `
    <path d="M42 26a22 6 0 0 1 44 0v76a22 6 0 0 1-44 0z" fill="${c}"/>
    <path d="M64 20a22 6 0 0 1 22 6v76a22 6 0 0 1-22 6z" ${SHADE}/>
    <ellipse cx="64" cy="26" rx="22" ry="6" fill="#fff" fill-opacity=".55"/>
    <ellipse cx="64" cy="26" rx="14" ry="3.5" ${SHADE}/>
    <rect x="42" y="52" width="44" height="26" ${LIGHT}/>
    <rect x="50" y="61" width="28" height="3" rx="1.5" fill="${c}"/>
    <rect x="50" y="67" width="18" height="3" rx="1.5" fill="${c}" fill-opacity=".5"/>
    <rect x="47" y="34" width="4" height="62" rx="2" ${SHINE}/>`,
  bag: (c) => `
    <path d="M36 22l7 5 7-5 7 5 7-5 7 5 7-5 7 5 7-5v8c4 18 4 52 0 74H36c-4-22-4-56 0-74z" fill="${c}"/>
    <path d="M64 27l7-5 7 5 7-5 7 5v8c4 18 4 52 0 74H64z" ${SHADE}/>
    <ellipse cx="64" cy="68" rx="20" ry="16" ${LIGHT}/>
    <rect x="52" y="64" width="24" height="3" rx="1.5" fill="${c}"/>
    <rect x="56" y="70" width="16" height="3" rx="1.5" fill="${c}" fill-opacity=".5"/>
    <rect x="41" y="40" width="4" height="52" rx="2" ${SHINE}/>`,
  box: (c) => `
    <path d="M30 40l34-14 34 14v58l-34 14-34-14z" fill="${c}"/>
    <path d="M64 54l34-14v58l-34 14z" ${SHADE}/>
    <path d="M30 40l34-14 34 14-34 14z" fill="#fff" fill-opacity=".35"/>
    <path d="M36 60l22 9v24l-22-9z" ${LIGHT}/>
    <path d="M41 70l12 5v3l-12-5z" fill="${c}"/>`,
  jar: (c) => `
    <rect x="40" y="18" width="48" height="16" rx="4" fill="${c}"/>
    <rect x="40" y="18" width="48" height="16" rx="4" ${SHADE}/>
    <rect x="36" y="34" width="56" height="78" rx="12" fill="${c}"/>
    <path d="M64 34h16a12 12 0 0 1 12 12v54a12 12 0 0 1-12 12H64z" ${SHADE}/>
    <rect x="36" y="56" width="56" height="32" ${LIGHT}/>
    <rect x="46" y="66" width="36" height="3" rx="1.5" fill="${c}"/>
    <rect x="46" y="73" width="22" height="3" rx="1.5" fill="${c}" fill-opacity=".5"/>
    <rect x="42" y="40" width="4" height="12" rx="2" ${SHINE}/>`,
  carton: (c) => `
    <path d="M40 40l12-22h24l12 22z" fill="${c}"/>
    <path d="M64 18h12l12 22H64z" ${SHADE}/>
    <rect x="52" y="12" width="24" height="7" rx="1.5" fill="${c}"/>
    <rect x="40" y="40" width="48" height="74" rx="3" fill="${c}"/>
    <path d="M64 40h24v71a3 3 0 0 1-3 3H64z" ${SHADE}/>
    <rect x="40" y="58" width="48" height="34" ${LIGHT}/>
    <circle cx="64" cy="72" r="7" fill="${c}"/>
    <rect x="52" y="83" width="24" height="3" rx="1.5" fill="${c}" fill-opacity=".5"/>`,
  pack: (c) => `
    <path d="M18 46l6 4-6 4 6 4-6 4 6 4-6 4 6 4-6 4h92l-6-4 6-4-6-4 6-4-6-4 6-4-6-4 6-4-6-4z" fill="${c}"/>
    <path d="M18 66h92l-6 4 6 4-6 4 6 4H18l6-4-6-4 6-4z" ${SHADE}/>
    <rect x="38" y="50" width="52" height="24" rx="12" ${LIGHT}/>
    <rect x="48" y="58" width="32" height="3" rx="1.5" fill="${c}"/>
    <rect x="54" y="64" width="20" height="3" rx="1.5" fill="${c}" fill-opacity=".5"/>`,
  roll: (c) => `
    <rect x="22" y="34" width="84" height="76" rx="10" fill="${c}"/>
    <path d="M64 34h32a10 10 0 0 1 10 10v56a10 10 0 0 1-10 10H64z" ${SHADE}/>
    <circle cx="44" cy="56" r="14" ${LIGHT}/>
    <circle cx="84" cy="56" r="14" ${LIGHT}/>
    <circle cx="44" cy="90" r="14" ${LIGHT}/>
    <circle cx="84" cy="90" r="14" ${LIGHT}/>
    <circle cx="44" cy="56" r="4" fill="${c}"/>
    <circle cx="84" cy="56" r="4" fill="${c}"/>
    <circle cx="44" cy="90" r="4" fill="${c}"/>
    <circle cx="84" cy="90" r="4" fill="${c}"/>`,
  tube: (c) => `
    <path d="M34 22h60l-8 72H42z" fill="${c}"/>
    <path d="M64 22h30l-8 72H64z" ${SHADE}/>
    <rect x="30" y="16" width="68" height="8" rx="2" fill="${c}"/>
    <rect x="30" y="16" width="68" height="8" rx="2" fill="#fff" fill-opacity=".3"/>
    <rect x="52" y="94" width="24" height="18" rx="3" fill="#fff"/>
    <rect x="52" y="94" width="24" height="18" rx="3" ${SHADE}/>
    <path d="M44 42h40l-3 30H47z" ${LIGHT}/>
    <rect x="52" y="52" width="24" height="3" rx="1.5" fill="${c}"/>
    <rect x="55" y="59" width="18" height="3" rx="1.5" fill="${c}" fill-opacity=".5"/>`,
  sack: (c) => `
    <path d="M50 16h28l-4 14h-20z" fill="${c}"/>
    <path d="M64 16h14l-4 14H64z" ${SHADE}/>
    <rect x="50" y="28" width="28" height="5" rx="2.5" fill="#fff" fill-opacity=".6"/>
    <path d="M54 33h20c18 8 24 30 22 54-1 16-10 26-32 26S33 103 32 87c-2-24 4-46 22-54z" fill="${c}"/>
    <path d="M64 33h10c18 8 24 30 22 54-1 16-10 26-32 26z" ${SHADE}/>
    <rect x="42" y="62" width="44" height="28" rx="6" ${LIGHT}/>
    <rect x="50" y="71" width="28" height="3" rx="1.5" fill="${c}"/>
    <rect x="54" y="78" width="20" height="3" rx="1.5" fill="${c}" fill-opacity=".5"/>`,
};

function renderSvg(shape: ProductShape, color: string, name: string): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128" role="img" aria-label="${name}">
  <rect width="128" height="128" rx="24" fill="${color}" fill-opacity=".14"/>${SHAPES[shape](color)}
</svg>
`;
}

const outputDir = join(process.cwd(), "public");

for (const product of DEMO_PRODUCTS) {
  const file = join(outputDir, demoProductImagePath(product.sku));
  mkdirSync(join(file, ".."), { recursive: true });
  writeFileSync(file, renderSvg(product.shape, product.color, product.name));
}

console.log(`${DEMO_PRODUCTS.length} ilustraciones en public/demo/products.`);
