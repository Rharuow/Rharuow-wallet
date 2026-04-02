import { defineConfig, devices } from "@playwright/test";

const workspaceRoot = "/home/rharuow/project/rharuowallet";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  timeout: 60000,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? [["html"], ["list"]] : "list",
  use: {
    baseURL: "http://127.0.0.1:3000",
    trace: "on-first-retry",
  },
  webServer: [
    {
      command: "npm run dev --workspace=services/api",
      cwd: workspaceRoot,
      url: "http://127.0.0.1:3001/health",
      reuseExistingServer: !process.env.CI,
      timeout: 120000,
      env: {
        ...process.env,
        NODE_ENV: "test",
        MAILER_DISABLE_SEND: "true",
      },
    },
    {
      command:
        "npm run dev --workspace=apps/web -- --hostname 127.0.0.1 --port 3000",
      cwd: workspaceRoot,
      url: "http://127.0.0.1:3000/login",
      reuseExistingServer: !process.env.CI,
      timeout: 120000,
      env: {
        ...process.env,
        NODE_ENV: "test",
        NEXT_PUBLIC_API_URL: "http://127.0.0.1:3001",
      },
    },
  ],
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
});