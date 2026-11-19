import { readFile } from "node:fs/promises";

import { describe, expect, it } from "vitest";

import { renderTemplate } from "@/src/lib/email";

describe("renderTemplate", () => {
  it("sustituye los marcadores y escapa el HTML", () => {
    const html = renderTemplate("<p>{{name}} - {{ email }}</p>", {
      name: '<script>"x"</script>',
      email: "a&b@test.com",
    });

    expect(html).toBe(
      "<p>&lt;script&gt;&quot;x&quot;&lt;/script&gt; - a&amp;b@test.com</p>",
    );
  });

  it("deja vacías las claves desconocidas", () => {
    expect(renderTemplate("[{{missing}}]", {})).toBe("[]");
  });

  it("la plantilla de bienvenida no deja marcadores sin sustituir", async () => {
    const template = await readFile("email/welcome-email.html", "utf8");
    const html = renderTemplate(template, {
      name: "Ana",
      email: "ana@test.com",
      appUrl: "https://app.test",
      year: "2026",
    });

    expect(html).not.toMatch(/\{\{/);
    expect(html).toContain("¡Bienvenido, Ana!");
    expect(html).toContain('href="https://app.test"');
  });
});
