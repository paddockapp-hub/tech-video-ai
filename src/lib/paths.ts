import fs from "fs";
import path from "path";

export const DATA_DIR = path.join(process.cwd(), "data");
export const JOBS_DIR = path.join(DATA_DIR, "jobs");
export const ORDERS_DIR = path.join(DATA_DIR, "orders");
export const OUTPUT_DIR = path.join(process.cwd(), "public", "outputs");

export function ensureDirs() {
  for (const dir of [DATA_DIR, JOBS_DIR, ORDERS_DIR, OUTPUT_DIR]) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

export function jobOutputDir(jobId: string) {
  const dir = path.join(OUTPUT_DIR, jobId);
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

export function publicUrl(jobId: string, filename: string) {
  return `/outputs/${jobId}/${filename}`;
}
