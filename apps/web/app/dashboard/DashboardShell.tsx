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
  { label: "Premium ✨", href: "/dashboard/premium" },
];

const costSubItems = [
  { label: "Áreas", href: "/dashboard/custos/areas" },
  { label: "Tipos", href: "/dashboard/custos/tipos" },
  { label: "Custos", href: "/dashboard/custos" },
  { label: "Análise", href: "/dashboard/custos/analise" },
];

function NavContent({
  pathname,
  onLinkClick,
}: {
  pathname: string;
  onLinkClick?: () => void;
}) {
  return (
    <nav className="flex flex-col gap-1">
      {navItems.map((item, index) => (
        <Link
          key={index}
          href={item.href}
          onClick={onLinkClick}
          className={`rounded-lg px-4 py-3 text-sm font-medium transition-colors hover:bg-[var(--primary-light)] ${
            pathname === item.href
              ? "bg-[var(--primary-light)] text-[var(--primary)]"
              : "text-[var(--foreground)]"
          }`}
        >
          {item.label}
        </Link>
      ))}

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
              onClick={onLinkClick}
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
  );
}

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

  function closeSheet() {
    (document.activeElement as HTMLElement)?.blur();
    setOpen(false);
  }

  return (
    <div className="min-h-screen bg-[var(--background)]">

      {/* ── Sidebar — lg+ ───────────────────────────────────────────── */}
      <aside className="flex max-lg:![display:none] fixed inset-y-0 left-0 z-30 w-64 flex-col border-r border-slate-200 bg-[var(--background)]">
        <div className="flex items-center justify-center border-b border-slate-200 px-4 py-4">
          <Image
            src="/logo.png"
            alt="RharouWallet"
            loading="eager"
            width={140}
            height={50}
            className="object-contain"
            style={{ width: 140, height: 50 }}
          />
        </div>
        <div className="flex flex-1 flex-col gap-6 overflow-y-auto px-3 py-4">
          <NavContent pathname={pathname} />
        </div>
        <div className="border-t border-slate-200 px-3 py-4">
          <Button variant="outline" className="w-full" onClick={handleLogout}>
            Sair
          </Button>
        </div>
      </aside>

      {/* ── Layout wrapper — offset on lg+ ──────────────────────────── */}
      <div className="lg:ml-64">

        {/* Top bar — hidden on lg+ */}
        <header className="flex lg:![display:none] items-center gap-4 border-b border-slate-200 bg-[var(--background)] px-4 py-3 shadow-sm">
          <Button onClick={() => setOpen(true)}>☰</Button>
          <div className="grow flex justify-center">
            <Image
              src="/logo.png"
              alt="RharouWallet"
              loading="eager"
              width={140}
              height={50}
              className="object-contain"
              style={{ width: 140, height: 50 }}
            />
          </div>
          <Button variant="outline" onClick={handleLogout}>
            Sair
          </Button>
        </header>

        {/* AsideSheet — mobile/md only, rendered after mount */}
        {mounted && (
          <AsideSheet
            open={open}
            onClose={closeSheet}
            side="left"
            size="sm"
          >
            <div className="flex flex-col gap-6 p-4">
              <Image
                src="/logo.png"
                alt="RharouWallet"
                loading="eager"
                width={140}
                height={50}
                className="object-contain"
                style={{ width: 140, height: 50 }}
              />
              <NavContent pathname={pathname} onLinkClick={closeSheet} />
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
    </div>
  );
}
