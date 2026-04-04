import { expect, test, type Browser, type Page } from "@playwright/test";
import { PlanType } from "@prisma/client";
import {
  cleanupTestData,
  createTestUser,
  ensureBaseData,
} from "../../../services/api/src/test/testUtils";
import { prisma } from "../../../services/api/src/lib/prisma";
import {
  createCreditTopupOrder,
  markCreditTopupOrderPaid,
} from "../../../services/api/src/modules/credits/credits.service";

const TEST_PASSWORD = "password-123";

test.describe.configure({ mode: "serial" });

test.beforeEach(async () => {
  await cleanupTestData();
  await ensureBaseData();
});

test.afterEach(async () => {
  await cleanupTestData();
});

test.afterAll(async () => {
  await prisma.$disconnect();
});

test("uses manual upload fallback, debits once and preserves active access", async ({ browser }) => {
  const user = await createTestUser({
    name: "Reports E2E",
    plan: PlanType.FREE,
  });
  await seedCredits(user.id, 5, "reports-e2e");

  const page = await loginAs(browser, user.email);
  await page.goto("/dashboard/relatorios");

  await page.getByLabel("Ticker").fill("ABCD4");
  const autoRequest = page.waitForResponse(
    (response) =>
      response.url().endsWith("/api/reports/analysis") &&
      response.request().method() === "POST"
  );
  await page.getByRole("button", { name: "Desbloquear análise" }).click();
  expect((await autoRequest).status()).toBe(404);

  await page.getByLabel("Arquivo do relatório").setInputFiles({
    name: "abcd4-manual.txt",
    mimeType: "text/plain",
    buffer: Buffer.from(
      "Relatorio manual ABCD4. Receita crescendo acima de 12% ao ano, margem operacional estavel, divida liquida controlada e cronograma de investimento moderado. Principais riscos: volatilidade de commodity, cambio e execucao do novo ciclo de expansao.",
      "utf8"
    ),
  });

  const manualRequest = page.waitForResponse(
    (response) =>
      response.url().endsWith("/api/reports/analysis") &&
      response.request().method() === "POST"
  );
  await page.getByRole("button", { name: "Enviar relatório manual" }).click();
  expect((await manualRequest).status()).toBe(200);

  const chargeCard = page.locator("div.rounded-2xl").filter({ hasText: "Cobrança" }).last();

  await expect(page.getByText("Análise gerada", { exact: true })).toBeVisible();
  await expect(page.getByText("Origem manual: abcd4-manual.txt")).toBeVisible();
  await expect(chargeCard.getByText("R$ 2,50", { exact: true })).toBeVisible();

  const secondManualRequest = page.waitForResponse(
    (response) =>
      response.url().endsWith("/api/reports/analysis") &&
      response.request().method() === "POST"
  );
  await page.getByRole("button", { name: "Enviar relatório manual" }).click();
  expect((await secondManualRequest).status()).toBe(200);

  await expect(page.getByText("Acesso ativo")).toBeVisible();
  await expect(chargeCard.getByText("R$ 0,00", { exact: true })).toBeVisible();

  const debits = await prisma.creditLedgerEntry.findMany({
    where: { userId: user.id, kind: "DEBIT" },
  });
  expect(debits).toHaveLength(1);

  await page.context().close();
});

async function seedCredits(userId: string, amount: number, suffix: string) {
  const order = await createCreditTopupOrder({
    userId,
    amount,
    stripeCheckoutSessionId: `cs_test_reports_e2e_${suffix}`,
  });

  await markCreditTopupOrderPaid({
    orderId: order.id,
    stripePaymentIntentId: `pi_test_reports_e2e_${suffix}`,
  });
}

async function loginAs(browser: Browser, email: string) {
  const context = await browser.newContext({ baseURL: "http://127.0.0.1:3000" });
  const page = await context.newPage();
  await page.goto("/login");
  await fillLoginForm(page, email);
  await expect(page).toHaveURL(/\/dashboard(?:\/|$)/);
  return page;
}

async function fillLoginForm(page: Page, email: string) {
  await page.getByLabel("E-mail").fill(email);
  await page.locator('input[name="password"]').fill(TEST_PASSWORD);
  await page.getByRole("button", { name: "Entrar" }).click();
}