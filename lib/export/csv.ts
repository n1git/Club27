const FORMULA_START = /^[=+\-@\t\r]/;

function cell(value: unknown): string {
  if (value === null || value === undefined) return "";
  let text = typeof value === "object" ? JSON.stringify(value) : String(value);
  if (typeof value === "string" && FORMULA_START.test(text)) text = `'${text}`;
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function toCsv(rows: Record<string, unknown>[], columns?: string[]): Buffer {
  const header = columns ?? Array.from(new Set(rows.flatMap((row) => Object.keys(row))));
  const lines = [header.map(cell).join(",")];
  for (const row of rows) lines.push(header.map((key) => cell(row[key])).join(","));
  return Buffer.from(`﻿${lines.join("\r\n")}\r\n`, "utf8");
}
