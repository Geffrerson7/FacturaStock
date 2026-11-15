import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const syncDemoData = vi.hoisted(() => vi.fn());

vi.mock("@/src/lib/prisma", () => ({ prisma: {} }));
vi.mock("@/src/lib/demo-data/sync", () => ({ syncDemoData }));

import { GET } from "@/app/api/cron/demo-data/route";

function call(authorization?: string) {
  return GET(
    new Request("http://localhost:3000/api/cron/demo-data", {
      headers: authorization ? { authorization } : {},
    }),
  );
}

describe("tarea programada de la demo", () => {
  beforeEach(() => {
    vi.stubEnv("CRON_SECRET", "secreto-de-prueba");
    vi.stubEnv("DEMO_DATA_ENABLED", "true");
    syncDemoData.mockResolvedValue({ action: "append", salesCreated: 2 });
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.clearAllMocks();
  });

  it("rechaza las peticiones sin el secreto o con uno distinto", async () => {
    expect((await call()).status).toBe(401);
    expect((await call("Bearer otro-secreto")).status).toBe(401);
    expect(syncDemoData).not.toHaveBeenCalled();
  });

  it("no funciona si CRON_SECRET no está definido", async () => {
    vi.stubEnv("CRON_SECRET", "");

    expect((await call("Bearer ")).status).toBe(401);
  });

  it("no toca la base si la demo no está activada", async () => {
    vi.stubEnv("DEMO_DATA_ENABLED", "");

    const response = await call("Bearer secreto-de-prueba");

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      data: { action: "disabled", salesCreated: 0 },
    });
    expect(syncDemoData).not.toHaveBeenCalled();
  });

  it("sincroniza los datos con el secreto correcto", async () => {
    const response = await call("Bearer secreto-de-prueba");

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      data: { action: "append", salesCreated: 2 },
    });
  });
});
