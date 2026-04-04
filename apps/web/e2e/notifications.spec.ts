import { expect, test, type Browser, type Page } from "@playwright/test";
import { PlanType } from "@prisma/client";
import {
  cleanupTestData,
  createTestUser,
  ensureBaseData,
} from "../../../services/api/src/test/testUtils";
import { prisma } from "../../../services/api/src/lib/prisma";

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

test("accepts a shared-wallet invite from the notification bell and shows revoke notification", async ({
  browser,
}) => {
  const owner = await createTestUser({
    name: "Owner Notifications",
    plan: PlanType.PREMIUM,
  });
  const guest = await createTestUser({
    name: "Guest Notifications",
    plan: PlanType.FREE,
  });

  const ownerPage = await loginAs(browser, owner.email);
  await ownerPage.goto("/dashboard/compartilhamento");
  await ownerPage.getByLabel("E-mail do convidado").fill(guest.email);

  const inviteRequest = ownerPage.waitForResponse(
    (response) =>
      response.url().endsWith("/api/wallet/invites") &&
      response.request().method() === "POST"
  );

  await ownerPage.getByRole("button", { name: "Enviar convite" }).click();
  expect((await inviteRequest).status()).toBe(201);

  const guestPage = await loginAs(browser, guest.email);
  await guestPage.goto("/dashboard");

  const bellOpenRequest = guestPage.waitForResponse(
    (response) =>
      response.url().includes("/api/notifications?limit=5") &&
      response.request().method() === "GET"
  );

  await guestPage.getByRole("button", { name: "Abrir notificações" }).click();
  expect((await bellOpenRequest).status()).toBe(200);

  await expect(guestPage.getByText("Convite recebido")).toBeVisible();
  await expect(
    guestPage.getByText(`${owner.name} enviou um convite para acessar uma carteira.`)
  ).toBeVisible();

  const acceptRequest = guestPage.waitForResponse(
    (response) => /\/api\/wallet\/invites\/.+\/accept$/.test(response.url())
      && response.request().method() === "POST"
  );

  await guestPage.locator('[role="dialog"]').getByRole("button", { name: "Aceitar" }).click();
  expect((await acceptRequest).status()).toBe(200);

  await expect(guestPage).toHaveURL("/dashboard/custos");
  await expect(
    guestPage.getByText("Esta carteira está em modo somente leitura para o seu usuário.")
  ).toBeVisible();

  await ownerPage.goto("/dashboard/compartilhamento");
  const revokeRequest = ownerPage.waitForResponse(
    (response) =>
      /\/api\/wallet\/invites\//.test(response.url()) &&
      response.request().method() === "DELETE"
  );

  await ownerPage
    .locator("div")
    .filter({ hasText: guest.name ?? guest.email })
    .getByRole("button", { name: "Revogar acesso", exact: true })
    .click();
  expect((await revokeRequest).status()).toBe(204);

  await guestPage.goto("/dashboard/notificacoes");
  await expect(
    guestPage.locator("main").getByText("Acesso revogado", { exact: true }).last()
  ).toBeVisible();
  await expect(
    guestPage.getByText(`${owner.name} revogou seu acesso ou convite de carteira compartilhada.`)
  ).toBeVisible();
});

async function loginAs(browser: Browser, email: string) {
  const context = await browser.newContext({ baseURL: "http://127.0.0.1:3000" });
  const page = await context.newPage();
  await page.goto("/login");
  await fillLoginForm(page, email);
  await expect(page).toHaveURL(/\/dashboard/);
  return page;
}

async function fillLoginForm(page: Page, email: string) {
  await page.getByLabel("E-mail").fill(email);
  await page.locator('input[name="password"]').fill(TEST_PASSWORD);
  await page.getByRole("button", { name: "Entrar" }).click();
}