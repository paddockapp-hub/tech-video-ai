import fs from "fs";
import path from "path";
import type { Order, ProductionJob } from "@/types";
import { JOBS_DIR, ORDERS_DIR, ensureDirs } from "./paths";

function readJson<T>(file: string): T | null {
  try {
    return JSON.parse(fs.readFileSync(file, "utf8")) as T;
  } catch {
    return null;
  }
}

export function saveJob(job: ProductionJob) {
  ensureDirs();
  job.updatedAt = new Date().toISOString();
  fs.writeFileSync(path.join(JOBS_DIR, `${job.id}.json`), JSON.stringify(job, null, 2));
  return job;
}

export function getJob(id: string): ProductionJob | null {
  ensureDirs();
  return readJson<ProductionJob>(path.join(JOBS_DIR, `${id}.json`));
}

export function listJobs(): ProductionJob[] {
  ensureDirs();
  return fs
    .readdirSync(JOBS_DIR)
    .filter((f) => f.endsWith(".json"))
    .map((f) => readJson<ProductionJob>(path.join(JOBS_DIR, f)))
    .filter((j): j is ProductionJob => Boolean(j))
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export function saveOrder(order: Order) {
  ensureDirs();
  fs.writeFileSync(path.join(ORDERS_DIR, `${order.id}.json`), JSON.stringify(order, null, 2));
  return order;
}

export function getOrder(id: string): Order | null {
  ensureDirs();
  return readJson<Order>(path.join(ORDERS_DIR, `${id}.json`));
}

export function logJob(job: ProductionJob, message: string) {
  job.message = message;
  job.logs = [...job.logs.slice(-80), `${new Date().toISOString()} ${message}`];
  return saveJob(job);
}
