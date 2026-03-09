"use client";

import { useState, useEffect } from "react";
import { AsideSheet, Button, Accordion } from "rharuow-ds";
import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";

const navItems = [
  { label: "Home", href: "/dashboard" },
  { label: "Ações", href: "/dashboard/acoes" },
  { label: "FIIs", href: "/dashboard/fiis" },
];

const costSubItems = [
  { label: "Áreas", href: "/dashboard/custos/areas" },
  { label: "Tipos", href: "/dashboard/custos/tipos" },
  { label: "Custos", href: "/dashboard/custos" },
  { label: "Análise", href: "/dashboard/custos/analise" },
];

export function DashboardShell({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    setMounted(true);
  }, []);

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
  }

  return (
    <div className="min-h-screen bg-[var(--background)]">
      {/* Top bar */}
      <header className="flex items-center gap-4 border-b border-slate-200 bg-[var(--background)] px-4 py-3 shadow-sm">
        <Button onClick={() => setOpen(true)}>
          ☰
        </Button>
        <div className="grow flex justify-center">
          <Image
            src="/logo.png"
            alt="RharouWallet"
            width={140}
            height={50}
            className="object-contain"
            style={{
              width: 140,
              height: 50
            }}
          />
        </div>
        <Button variant="outline" onClick={handleLogout}>
          Sair
        </Button>
      </header>

      {/* Aside Sheet — rendered only after mount to avoid portal hydration mismatch */}
      {mounted && (
        <AsideSheet
          open={open}
          onClose={() => {
            (document.activeElement as HTMLElement)?.blur();
            setOpen(false);
          }}
          side="left"
          size="sm"
        >
          <div className="flex flex-col gap-6 p-4">
          <Image
            src="/logo.png"
            alt="RharouWallet"
            width={140}
            height={50}
            className="object-contain"
            style={{
                width: 140,
                height: 50
            }}
          />

          <nav className="flex flex-col gap-1">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => {
                  (document.activeElement as HTMLElement)?.blur();
                  setOpen(false);
                }}
                className={`rounded-lg px-4 py-3 text-sm font-medium transition-colors hover:bg-[var(--primary-light)] ${
                  pathname === item.href
                    ? "bg-[var(--primary-light)] text-[var(--primary)]"
                    : "text-[var(--foreground)]"
                }`}
              >
                {item.label}
              </Link>
            ))}

            {/* Custos Domésticos — accordion */}
            <Accordion
              type="single"
              collapsible
              variant="default"
              className="w-full"
            >
              <Accordion.Item
                title="Custos Domésticos"
                defaultOpen={pathname.startsWith("/dashboard/custos")}
                headerClassName={`rounded-lg px-4 py-3 text-sm font-medium transition-colors hover:bg-[var(--primary-light)] ${
                  pathname.startsWith("/dashboard/custos")
                    ? "text-[var(--primary)]"
                    : "text-[var(--foreground)]"
                }`}
                contentClassName="pl-4 flex flex-col gap-1"
              >
                {costSubItems.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => {
                      (document.activeElement as HTMLElement)?.blur();
                      setOpen(false);
                    }}
                    className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors hover:bg-[var(--primary-light)] ${
                      pathname === item.href
                        ? "bg-[var(--primary-light)] text-[var(--primary)]"
                        : "text-[var(--foreground)]"
                    }`}
                  >
                    {item.label}
                  </Link>
                ))}
              </Accordion.Item>
            </Accordion>
          </nav>

          <div className="mt-auto pt-4">
            <Button
              variant="outline"
              className="w-full"
              onClick={() => {
                setOpen(false);
                handleLogout();
              }}
            >
              Sair
            </Button>
          </div>
          </div>
        </AsideSheet>
      )}

      {/* Page content */}
      <main className="mx-auto max-w-7xl px-4 py-6">{children}</main>
    </div>
  );
}
