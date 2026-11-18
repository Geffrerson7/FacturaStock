/**
 * Exportación del kárdex a Excel con la estructura de los libros de SUNAT:
 *
 * - Valorizado: Formato 13.1, registro de inventario permanente valorizado.
 * - Físico: Formato 12.1, registro de inventario permanente en unidades.
 *
 * Solo se ejecuta en el servidor (ExcelJS depende de módulos de Node).
 */

import ExcelJS from "exceljs";

import type { CompanyInfo } from "@/src/lib/company";
import { limaDateKey } from "@/src/lib/lima-time";
import type { KardexReport, StockMovement } from "@/src/lib/types/kardex";

import {
  KARDEX_EXISTENCE_TYPE,
  KARDEX_UNIT_OF_MEASURE,
  KARDEX_VALUATION_METHOD,
  MOVEMENT_TYPE_INFO,
  SUNAT_OPERATION_LABELS,
  type KardexViewMode,
} from "./catalog";

const FORMAT = {
  quantity: "#,##0",
  money: "#,##0.00",
  // Muestra al menos 2 decimales y hasta los 6 que guarda el promedio.
  cost: "#,##0.00####",
  date: "dd/mm/yyyy",
} as const;

const THIN = { style: "thin" } as const;
const ALL_BORDERS = { top: THIN, left: THIN, bottom: THIN, right: THIN };
const HEADER_FILL: ExcelJS.Fill = {
  type: "pattern",
  pattern: "solid",
  fgColor: { argb: "FFE5E7EB" },
};

/** Fecha de Lima como fecha de Excel (sin hora ni zona). */
function excelDate(iso: string): Date {
  const [year, month, day] = limaDateKey(new Date(iso)).split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day));
}

function formatDateKey(key: string): string {
  const [year, month, day] = key.split("-");
  return `${day}/${month}/${year}`;
}

function documentNumber(movement: StockMovement): string {
  return movement.documentNumber === null
    ? "-"
    : String(movement.documentNumber).padStart(8, "0");
}

function operationLabel(movement: StockMovement): string {
  const sunat = SUNAT_OPERATION_LABELS[movement.sunatOperationCode] ?? "";
  const detail = MOVEMENT_TYPE_INFO[movement.type].label;

  // "99 - Otros (Merma)" es poco claro; el tipo interno da el detalle.
  return sunat === detail
    ? `${movement.sunatOperationCode} - ${sunat}`
    : `${movement.sunatOperationCode} - ${sunat} (${detail})`;
}

type Layout = {
  title: string;
  /** Número de la última columna. */
  lastColumn: number;
  valued: boolean;
};

function layoutFor(mode: KardexViewMode): Layout {
  return mode === "valorizado"
    ? {
        title:
          "FORMATO 13.1: REGISTRO DE INVENTARIO PERMANENTE VALORIZADO - DETALLE DEL INVENTARIO VALORIZADO",
        lastColumn: 14,
        valued: true,
      }
    : {
        title:
          "FORMATO 12.1: REGISTRO DEL INVENTARIO PERMANENTE EN UNIDADES FÍSICAS - DETALLE DEL INVENTARIO PERMANENTE EN UNIDADES FÍSICAS",
        lastColumn: 8,
        valued: false,
      };
}

function styleHeaderCell(cell: ExcelJS.Cell) {
  cell.font = { bold: true, size: 9 };
  cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
  cell.border = ALL_BORDERS;
  cell.fill = HEADER_FILL;
}

function writeCompanyHeader(
  sheet: ExcelJS.Worksheet,
  report: KardexReport,
  company: CompanyInfo,
  layout: Layout,
): number {
  sheet.mergeCells(1, 1, 1, layout.lastColumn);
  const title = sheet.getCell(1, 1);
  title.value = layout.title;
  title.font = { bold: true, size: 12 };
  title.alignment = { wrapText: true, vertical: "middle" };
  sheet.getRow(1).height = 32;

  const lines: [string, string][] = [
    [
      "PERIODO:",
      `${formatDateKey(report.range.from)} al ${formatDateKey(report.range.to)}`,
    ],
    ["RUC:", company.ruc],
    [
      "APELLIDOS Y NOMBRES, DENOMINACIÓN O RAZÓN SOCIAL:",
      company.businessName,
    ],
    ["ESTABLECIMIENTO (1):", company.establishment],
    ["CÓDIGO DE LA EXISTENCIA:", report.product.sku],
    [
      "TIPO (TABLA 5):",
      `${KARDEX_EXISTENCE_TYPE.code} - ${KARDEX_EXISTENCE_TYPE.label}`,
    ],
    ["DESCRIPCIÓN:", report.product.name],
    [
      "CÓDIGO DE LA UNIDAD DE MEDIDA (TABLA 6):",
      `${KARDEX_UNIT_OF_MEASURE.code} - ${KARDEX_UNIT_OF_MEASURE.label}`,
    ],
  ];

  if (layout.valued) {
    lines.push(["MÉTODO DE VALUACIÓN:", KARDEX_VALUATION_METHOD]);
  }

  // Etiquetas en las primeras columnas y el valor a continuación.
  const labelEnd = layout.valued ? 5 : 4;
  let row = 3;

  for (const [label, value] of lines) {
    sheet.mergeCells(row, 1, row, labelEnd);
    sheet.mergeCells(row, labelEnd + 1, row, layout.lastColumn);
    const labelCell = sheet.getCell(row, 1);
    labelCell.value = label;
    labelCell.font = { bold: true, size: 9 };
    const valueCell = sheet.getCell(row, labelEnd + 1);
    valueCell.value = value;
    valueCell.font = { size: 9 };
    row += 1;
  }

  return row + 1;
}

function writeTableHeader(
  sheet: ExcelJS.Worksheet,
  top: number,
  layout: Layout,
): number {
  const bottom = top + 1;

  const merge = (
    startColumn: number,
    endColumn: number,
    rows: [number, number],
    text: string,
  ) => {
    sheet.mergeCells(rows[0], startColumn, rows[1], endColumn);
    sheet.getCell(rows[0], startColumn).value = text;
  };

  merge(1, 1, [top, bottom], "FECHA");
  merge(
    2,
    4,
    [top, top],
    "DOCUMENTO DE TRASLADO, COMPROBANTE DE PAGO, DOCUMENTO INTERNO O SIMILAR",
  );
  sheet.getCell(bottom, 2).value = "TIPO (TABLA 10)";
  sheet.getCell(bottom, 3).value = "SERIE";
  sheet.getCell(bottom, 4).value = "NÚMERO";
  merge(5, 5, [top, bottom], "TIPO DE OPERACIÓN (TABLA 12)");

  if (layout.valued) {
    const groups = ["ENTRADAS", "SALIDAS", "SALDO FINAL"];
    groups.forEach((group, index) => {
      const start = 6 + index * 3;
      merge(start, start + 2, [top, top], group);
      sheet.getCell(bottom, start).value = "CANTIDAD";
      sheet.getCell(bottom, start + 1).value =
        group === "SALDO FINAL" ? "COSTO PROMEDIO" : "COSTO UNITARIO";
      sheet.getCell(bottom, start + 2).value = "COSTO TOTAL";
    });
  } else {
    merge(6, 6, [top, bottom], "ENTRADAS");
    merge(7, 7, [top, bottom], "SALIDAS");
    merge(8, 8, [top, bottom], "SALDO FINAL");
  }

  for (let row = top; row <= bottom; row += 1) {
    for (let column = 1; column <= layout.lastColumn; column += 1) {
      styleHeaderCell(sheet.getCell(row, column));
    }
  }
  sheet.getRow(top).height = 30;
  sheet.getRow(bottom).height = 26;

  return bottom + 1;
}

type CellValue = string | number | Date | null;

function writeDataRow(
  sheet: ExcelJS.Worksheet,
  row: number,
  values: CellValue[],
  formats: (string | null)[],
  options: { bold?: boolean } = {},
) {
  values.forEach((value, index) => {
    const cell = sheet.getCell(row, index + 1);
    cell.value = value;
    cell.border = ALL_BORDERS;
    cell.font = { size: 9, bold: options.bold };
    const format = formats[index];
    if (format) cell.numFmt = format;
    if (typeof value === "number") {
      cell.alignment = { horizontal: "right" };
    } else if (index > 0 && index < 4) {
      cell.alignment = { horizontal: "center" };
    }
  });
}

function money(value: string): number {
  return Number(value);
}

function valuedRow(movement: StockMovement): CellValue[] {
  const base: CellValue[] = [
    excelDate(movement.occurredAt),
    movement.documentType,
    movement.documentSeries ?? "-",
    documentNumber(movement),
    operationLabel(movement),
  ];
  const balance: CellValue[] = [
    movement.balanceQuantity,
    money(movement.balanceAverageCost),
    money(movement.balanceValue),
  ];
  const empty: CellValue[] = [null, null, null];
  const total = money(movement.totalCost);

  if (movement.direction === "ENTRADA") {
    return [
      ...base,
      movement.quantity,
      money(movement.unitCost),
      total,
      ...empty,
      ...balance,
    ];
  }

  if (movement.direction === "SALIDA") {
    return [
      ...base,
      ...empty,
      movement.quantity,
      money(movement.unitCost),
      total,
      ...balance,
    ];
  }

  // Ajuste de valorización: cantidad 0 e importe en entradas o salidas.
  return total >= 0
    ? [...base, 0, null, total, ...empty, ...balance]
    : [...base, ...empty, 0, null, Math.abs(total), ...balance];
}

function physicalRow(movement: StockMovement): CellValue[] {
  return [
    excelDate(movement.occurredAt),
    movement.documentType,
    movement.documentSeries ?? "-",
    documentNumber(movement),
    operationLabel(movement),
    movement.direction === "ENTRADA" ? movement.quantity : null,
    movement.direction === "SALIDA" ? movement.quantity : null,
    movement.balanceQuantity,
  ];
}

const VALUED_FORMATS = [
  FORMAT.date,
  null,
  null,
  null,
  null,
  FORMAT.quantity,
  FORMAT.cost,
  FORMAT.money,
  FORMAT.quantity,
  FORMAT.cost,
  FORMAT.money,
  FORMAT.quantity,
  FORMAT.cost,
  FORMAT.money,
];

const PHYSICAL_FORMATS = [
  FORMAT.date,
  null,
  null,
  null,
  null,
  FORMAT.quantity,
  FORMAT.quantity,
  FORMAT.quantity,
];

/** Libro de Excel con el kárdex de un producto en el modo pedido. */
export function buildKardexWorkbook(
  report: KardexReport,
  company: CompanyInfo,
  mode: KardexViewMode,
  now: Date = new Date(),
): ExcelJS.Workbook {
  const layout = layoutFor(mode);
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "FacturaStock";
  workbook.created = now;

  const sheet = workbook.addWorksheet(
    mode === "valorizado" ? "Kárdex valorizado" : "Kárdex físico",
    {
      pageSetup: {
        orientation: "landscape",
        fitToPage: true,
        fitToWidth: 1,
        fitToHeight: 0,
        paperSize: 9,
      },
    },
  );

  sheet.columns = layout.valued
    ? [12, 10, 8, 11, 30, 10, 12, 13, 10, 12, 13, 10, 13, 14].map((width) => ({
        width,
      }))
    : [12, 10, 8, 11, 34, 12, 12, 12].map((width) => ({ width }));

  let row = writeCompanyHeader(sheet, report, company, layout);
  row = writeTableHeader(sheet, row, layout);
  const firstDataRow = row;
  const formats = layout.valued ? VALUED_FORMATS : PHYSICAL_FORMATS;
  const blank = (count: number): CellValue[] =>
    Array.from({ length: count }, () => null);

  // Saldo anterior al periodo.
  const opening = report.opening;
  writeDataRow(
    sheet,
    row,
    layout.valued
      ? [
          null,
          null,
          null,
          null,
          "SALDO ANTERIOR",
          ...blank(6),
          opening.quantity,
          money(opening.averageCost),
          money(opening.value),
        ]
      : [null, null, null, null, "SALDO ANTERIOR", null, null, opening.quantity],
    formats,
    { bold: true },
  );
  row += 1;

  for (const movement of report.movements) {
    writeDataRow(
      sheet,
      row,
      layout.valued ? valuedRow(movement) : physicalRow(movement),
      formats,
    );
    row += 1;
  }

  const { entries, exits } = report.totals;
  const closing = report.closing;
  writeDataRow(
    sheet,
    row,
    layout.valued
      ? [
          null,
          null,
          null,
          null,
          "TOTALES",
          entries.quantity,
          null,
          money(entries.value),
          exits.quantity,
          null,
          money(exits.value),
          closing.quantity,
          money(closing.averageCost),
          money(closing.value),
        ]
      : [
          null,
          null,
          null,
          null,
          "TOTALES",
          entries.quantity,
          exits.quantity,
          closing.quantity,
        ],
    formats,
    { bold: true },
  );

  // Los encabezados de la tabla quedan visibles al desplazarse.
  sheet.views = [{ state: "frozen", ySplit: firstDataRow - 1 }];

  return workbook;
}

/** Nombre del archivo: kardex-valorizado-BEB-001-2026-11-01-2026-11-17.xlsx */
export function kardexFileName(
  report: KardexReport,
  mode: KardexViewMode,
): string {
  const sku = report.product.sku.replace(/[^A-Za-z0-9_-]+/g, "-");
  return `kardex-${mode}-${sku}-${report.range.from}-${report.range.to}.xlsx`;
}
