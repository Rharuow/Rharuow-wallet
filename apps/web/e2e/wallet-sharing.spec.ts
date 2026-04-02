import { expect, test, type Browser, type Page } from "@playwright/test";
import { InviteStatus, PlanType } from "@prisma/client";
import {
  cleanupTestData,
  createCostFixtures,
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

test("accepts invite by link, switches wallet context and blocks access after revocation", async ({
  browser,
}) => {
  const owner = await createTestUser({
    name: "Owner Wallet",
    plan: PlanType.PREMIUM,
  });
  const guest = await createTestUser({
    name: "Guest Wallet",
    plan: PlanType.FREE,
  });

  const ownerFixtures = await createCostFixtures(owner.id);
  const guestFixtures = await createCostFixtures(guest.id);
  const ownerCostDescription = "Custo owner E2E wallet sharing";
  const guestCostDescription = "Custo guest E2E wallet sharing";

  await prisma.cost.update({
    where: { id: ownerFixtures.cost.id },
    data: { description: ownerCostDescription },
  });
  await prisma.cost.update({
    where: { id: guestFixtures.cost.id },
    data: { description: guestCostDescription },
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

  const invite = await prisma.walletInvite.findFirst({
    where: {
      ownerId: owner.id,
      guestEmail: guest.email.toLowerCase(),
      status: InviteStatus.PENDING,
    },
    orderBy: { createdAt: "desc" },
  });

  expect(invite).not.toBeNull();

  const guestContext = await browser.newContext({ baseURL: "http://127.0.0.1:3000" });
  const guestPage = await guestContext.newPage();

  await guestPage.goto(`/convites/${invite!.token}`);
  await expect(
    guestPage.getByRole("link", { name: "Entrar para continuar" })
  ).toBeVisible();
  await guestPage.getByRole("link", { name: "Entrar para continuar" }).click();
  await expect(guestPage).toHaveURL(new RegExp(`/login\\?next=.*${invite!.token}`));

  await fillLoginForm(guestPage, guest.email);
  await expect(guestPage).toHaveURL(`/convites/${invite!.token}`);
  await guestPage.getByRole("button", { name: "Aceitar convite" }).click();

  await expect(guestPage).toHaveURL("/dashboard/custos");
  await expect(
    guestPage.getByText("Esta carteira está em modo somente leitura para o seu usuário.")
  ).toBeVisible();
  await expect(guestPage.getByText(ownerCostDescription).first()).toBeVisible();

  await guestPage.goto("/dashboard/compartilhamento");
  const ownWalletActivation = guestPage.waitForResponse(
    (response) =>
      response.url().endsWith("/api/wallet/active") &&
      response.request().method() === "POST"
  );
  await guestPage
    .locator("main")
    .getByRole("button", {
      name: /Minha carteira\s+Voltar ao contexto principal do seu usuário\./,
    })
    .click();
  expect((await ownWalletActivation).status()).toBe(200);

  await guestPage.goto("/dashboard/custos");
  await expect(guestPage.getByText(guestCostDescription).first()).toBeVisible();
  await expect(guestPage.getByText(ownerCostDescription)).toHaveCount(0);
  await expect(
    guestPage.getByText("Esta carteira está em modo somente leitura para o seu usuário.")
  ).not.toBeVisible();

  await guestPage.goto("/dashboard/compartilhamento");
  const sharedWalletActivation = guestPage.waitForResponse(
    (response) =>
      response.url().endsWith("/api/wallet/active") &&
      response.request().method() === "POST"
  );
  await guestPage.locator("main").getByRole("button", { name: /Owner Wallet/ }).click();
  expect((await sharedWalletActivation).status()).toBe(200);

  await guestPage.goto("/dashboard/custos");
  await expect(guestPage.getByText(ownerCostDescription).first()).toBeVisible();
  await expect(
    guestPage.getByText("Esta carteira está em modo somente leitura para o seu usuário.")
  ).toBeVisible();

  await ownerPage.reload();
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
  await expect(ownerPage.getByText("Revogado")).toBeVisible();

  await guestPage.reload();
  await expect(guestPage.getByText(guestCostDescription).first()).toBeVisible();
  await expect(guestPage.getByText(ownerCostDescription)).toHaveCount(0);
  await guestPage.goto("/dashboard/compartilhamento");
  await expect(guestPage.locator("main")).not.toContainText("Owner Wallet");
  await expect(
    guestPage.getByText("Esta carteira está em modo somente leitura para o seu usuário.")
  ).not.toBeVisible();

  await guestContext.close();
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