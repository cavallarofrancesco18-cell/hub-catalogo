declare module 'xlsx-js-style' {
  import * as XLSX from 'xlsx';

  export function read(data: unknown, opts?: XLSX.ParsingOptions): XLSX.WorkBook;
  export const utils: typeof XLSX.utils;
  export function write(workbook: XLSX.WorkBook, opts: XLSX.WritingOptions): string | ArrayBuffer;
  export function writeFile(workbook: XLSX.WorkBook, filename: string, opts?: XLSX.WritingOptions): void;
}
