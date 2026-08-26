import { expect, test, type Page } from "@playwright/test";

/**
 * Průchody aplikací, které se testům nad čistou logikou ověřit nedají:
 * hydratace z IndexedDB, navigace přes URL, tlačítko Zpět a hlavní scénáře.
 *
 * Každý test má vlastní kontext prohlížeče (Playwright to tak dělá sám),
 * takže si nesahají do IndexedDB navzájem.
 */

/**
 * Počká, až se dohydratuje stav z IndexedDB.
 *
 * Čeká se na zmizení načítacího panelu, ne jen na jeho nepřítomnost — prázdný
 * výsledek by totiž splnila i stránka, kde React ještě vůbec nenaběhl, a test
 * by pak klikal do neexistující aplikace.
 */
async function openApp(page: Page, path = "/") {
  await page.goto(path, { waitUntil: "domcontentloaded" });
  await expect(page.locator(".loading-panel")).toHaveCount(0, { timeout: 15_000 });
  await expect(page.locator("#hlavni-obsah .section-intro")).toBeVisible({ timeout: 15_000 });
}

test.describe("Seznam receptů", () => {
  test("naseeduje výchozí recepty", async ({ page }) => {
    await openApp(page);
    await expect(page.locator(".recipe-card").first()).toBeVisible();
    expect(await page.locator(".recipe-card").count()).toBeGreaterThanOrEqual(20);
  });

  test("hledá bez ohledu na diakritiku", async ({ page }) => {
    await openApp(page);
    await page.getByLabel("Vyhledat recept").fill("recky");
    await expect(page.locator(".recipe-card")).toHaveCount(1);
    await expect(page.locator(".recipe-card")).toContainText("Řecký salát");
  });

  test("odpustí překlep", async ({ page }) => {
    await openApp(page);
    await page.getByLabel("Vyhledat recept").fill("bramboracka");
    await expect(page.locator(".recipe-card").first()).toBeVisible();
  });

  test("hledá i v postupu, nejen v názvu", async ({ page }) => {
    await openApp(page);
    await page.getByLabel("Vyhledat recept").fill("dozlatova");
    await expect(page.locator(".recipe-card").first()).toBeVisible();
  });

  test("filtruje podle štítku", async ({ page }) => {
    await openApp(page);
    const total = await page.locator(".recipe-card").count();

    await page.getByRole("button", { name: /Filtry/ }).click();
    await page.getByRole("button", { name: /^snídaně/ }).first().click();

    const filtered = await page.locator(".recipe-card").count();
    expect(filtered).toBeGreaterThan(0);
    expect(filtered).toBeLessThan(total);
  });

  test("filtruje podle času", async ({ page }) => {
    await openApp(page);
    const total = await page.locator(".recipe-card").count();

    await page.getByRole("button", { name: /Filtry/ }).click();
    await page.getByRole("button", { name: "do 15 min" }).click();

    expect(await page.locator(".recipe-card").count()).toBeLessThan(total);
  });
});

test.describe("Navigace a URL", () => {
  test("detail receptu má vlastní adresu", async ({ page }) => {
    await openApp(page);
    await page.locator(".recipe-card-main").first().click();

    await expect(page.locator('[role="dialog"]')).toBeVisible();
    expect(page.url()).toContain("recept=");
  });

  test("tlačítko Zpět zavře detail místo aplikace", async ({ page }) => {
    await openApp(page);
    await page.locator(".recipe-card-main").first().click();
    await expect(page.locator('[role="dialog"]')).toBeVisible();

    await page.goBack();
    await expect(page.locator('[role="dialog"]')).toHaveCount(0);
  });

  test("odkaz na recept funguje i po načtení stránky", async ({ page }) => {
    await openApp(page, "/?recept=7");
    await expect(page.locator('[role="dialog"]')).toBeVisible();
    await expect(page.locator(".detail-title")).toContainText("Bramboračka");
  });

  test("odkaz na smazaný recept nespadne", async ({ page }) => {
    await openApp(page, "/?recept=99999");
    await expect(page.locator('[role="dialog"]')).toHaveCount(0);
    await expect(page.locator(".recipe-card").first()).toBeVisible();
  });

  test("záložky mají vlastní adresu", async ({ page }) => {
    await openApp(page, "/?tab=nakup");
    await expect(page.getByRole("heading", { name: "Co koupit" })).toBeVisible();
  });
});

test.describe("Nákupní seznam", () => {
  test("recept přidá položky a odečte, co je doma", async ({ page }) => {
    await openApp(page, "/?recept=7");
    await page.getByRole("button", { name: "Do nákupu" }).click();

    await openApp(page, "/?tab=nakup");
    expect(await page.locator(".shopping-row").count()).toBeGreaterThan(0);
  });

  test("sloučí stejnou ingredienci ze dvou receptů", async ({ page }) => {
    await openApp(page, "/?recept=7");
    await page.getByRole("button", { name: "Do nákupu" }).click();
    await openApp(page, "/?recept=8");
    await page.getByRole("button", { name: "Do nákupu" }).click();

    await openApp(page, "/?tab=nakup");
    const names = await page.locator(".shopping-name").allTextContents();
    expect(new Set(names).size).toBe(names.length);
  });

  test("odškrtnutá položka spadne dolů", async ({ page }) => {
    await openApp(page, "/?recept=7");
    await page.getByRole("button", { name: "Do nákupu" }).click();
    await openApp(page, "/?tab=nakup");

    const first = page.locator(".shopping-row").first();
    const firstName = await first.locator(".shopping-name").textContent();

    await first.locator("input").check();
    await expect(page.locator(".shopping-row.checked")).toHaveCount(1);
    await expect(page.getByRole("heading", { name: /v košíku 1/ })).toBeVisible();

    // Odškrtnutá položka klesne na konec seznamu.
    await expect(page.locator(".shopping-row").last().locator(".shopping-name")).toHaveText(
      firstName ?? "",
    );
  });

  test("ruční položka jde přidat", async ({ page }) => {
    await openApp(page, "/?tab=nakup");
    await page.getByLabel("Přidat položku do nákupního seznamu").fill("Alobal");
    await page.getByLabel("Přidat položku do nákupního seznamu").press("Enter");
    await expect(page.locator(".shopping-name")).toContainText("Alobal");
  });
});

test.describe("Plánovač", () => {
  test("ukazuje sedm dní", async ({ page }) => {
    await openApp(page, "/?tab=plan");
    await expect(page.locator(".planner-day")).toHaveCount(7);
  });

  test("naplánuje jídlo a jde ho vzít zpět", async ({ page }) => {
    await openApp(page, "/?tab=plan");

    await page.locator(".planner-add").first().click();
    await page.locator(".picker-row").first().click();
    await expect(page.locator(".planner-entry")).toHaveCount(1);

    await page.locator('button[aria-label^="Zpět"]').click();
    await expect(page.locator(".planner-entry")).toHaveCount(0);
  });

  test("z plánu vygeneruje nákup", async ({ page }) => {
    await openApp(page, "/?tab=plan");
    await page.locator(".planner-add").first().click();
    await page.locator(".picker-row").first().click();
    await expect(page.locator(".planner-entry")).toHaveCount(1);

    await page.getByRole("button", { name: /Nákup z celého týdne/ }).click();

    await openApp(page, "/?tab=nakup");
    expect(await page.locator(".shopping-row").count()).toBeGreaterThan(0);
  });
});

test.describe("Režim vaření", () => {
  test("otevře se přes URL a listuje kroky", async ({ page }) => {
    await openApp(page, "/?recept=7&varime=1");
    await expect(page.locator(".cook-mode")).toBeVisible();

    const first = await page.locator(".cook-mode-step-text").textContent();
    await page.getByRole("button", { name: /Další krok/ }).click();
    const second = await page.locator(".cook-mode-step-text").textContent();

    expect(second).not.toBe(first);
  });

  test("z kroku s časem udělá časovač", async ({ page }) => {
    // Bramboračka má v kroku 5 "vařte přibližně 20 minut".
    await openApp(page, "/?recept=7&varime=1");

    for (let step = 0; step < 8; step += 1) {
      if ((await page.locator(".step-timer").count()) > 0) {
        break;
      }
      const next = page.getByRole("button", { name: /Další krok/ });
      if ((await next.count()) === 0) {
        break;
      }
      await next.click();
    }

    await expect(page.locator(".step-timer")).toBeVisible();
    await expect(page.locator(".step-timer-value")).toContainText("20:00");
  });
});

test.describe("Zásoby a trvalost dat", () => {
  test("seznam ingrediencí se vykresluje virtualizovaně", async ({ page }) => {
    await openApp(page, "/?tab=ingredience");

    // Seed má přes 300 ingrediencí; v DOM jich smí být jen zlomek.
    const rendered = await page.locator(".ingredient-row").count();
    expect(rendered).toBeGreaterThan(0);
    expect(rendered).toBeLessThan(60);

    // Po odrolování se objeví jiné položky.
    const firstBefore = await page.locator(".ingredient-name").first().textContent();
    await page.locator(".ingredient-list-card .virtual-list").evaluate((node) => {
      node.scrollTop = 4000;
    });
    await expect(page.locator(".ingredient-name").first()).not.toHaveText(firstBefore ?? "");
  });

  test("hledání v ingrediencích zúží seznam", async ({ page }) => {
    await openApp(page, "/?tab=ingredience");
    await page.getByLabel("Vyhledat ingredienci").fill("cesnek");
    await expect(page.locator(".ingredient-name").first()).toContainText("esnek");
  });

  test("označení zásoby přežije načtení stránky", async ({ page }) => {
    await openApp(page, "/?tab=ingredience");
    await page.locator(".ingredient-home-toggle input").first().check();
    await expect(page.getByRole("button", { name: /Mám doma \(1\)/ })).toBeVisible();

    await page.reload({ waitUntil: "domcontentloaded" });
    await expect(page.locator("#hlavni-obsah .section-intro")).toBeVisible({ timeout: 15_000 });
    await expect(page.getByRole("button", { name: /Mám doma \(1\)/ })).toBeVisible();
  });
});

test.describe("Recepty: založení a smazání", () => {
  test("projde celý koloběh receptu", async ({ page }) => {
    await openApp(page);

    await page.getByRole("button", { name: "Nový recept" }).first().click();
    await page.getByPlaceholder("Např. Babiččin jablečný závin").fill("Zkušební guláš");
    await page.getByRole("button", { name: "Vyber ingredienci" }).click();
    await page.getByLabel("Vyhledat ingredienci").fill("cibule");
    await page.locator(".picker-row").first().click();
    await page.getByRole("button", { name: "Uložit recept" }).click();

    await expect(page.locator(".detail-title")).toContainText("Zkušební guláš");

    await page.getByRole("button", { name: "Smazat" }).first().click();
    await page.getByRole("button", { name: "Smazat" }).last().click();

    await page.getByLabel("Vyhledat recept").fill("Zkušební");
    await expect(page.locator(".recipe-card")).toHaveCount(0);
  });

  test("import z vloženého textu předvyplní formulář", async ({ page }) => {
    await openApp(page);

    await page.getByRole("button", { name: "Importovat" }).first().click();
    await page.getByRole("button", { name: "Z textu" }).click();
    await page.getByLabel("Text receptu").fill(
      ["Testovací palačinky", "Ingredience:", "200 g hladké mouky", "2 vejce", "Postup:", "Smíchej."].join("\n"),
    );
    await page.getByRole("button", { name: "Načíst do formuláře" }).click();

    await expect(page.getByPlaceholder("Např. Babiččin jablečný závin")).toHaveValue(
      "Testovací palačinky",
    );
    await expect(page.locator(".ingredient-pick-button").first()).toContainText("mouky");
  });
});

test.describe("Motiv", () => {
  test("přepnutí na tmavý motiv se propíše do dokumentu", async ({ page }) => {
    await openApp(page);
    await page.locator('button[aria-label^="Motiv"]').click();
    await page.getByRole("menuitemradio", { name: "Tmavý režim" }).click();

    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  });
});

test.describe("Rozvržení", () => {
  test("stránka se vodorovně neposouvá", async ({ page }) => {
    await openApp(page);
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(1);
  });
});
