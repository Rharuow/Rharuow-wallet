"use client";

import { useEffect, useState, useTransition } from "react";
import { AsideSheet, Button, Accordion, Select, Card, Chip } from "rharuow-ds";
import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import type { WalletContext } from "@/lib/wallet";

const navItems = [
  { label: "Home", href: "/dashboard" },
  { label: "Ações", href: "/dashboard/acoes" },
  { label: "FIIs", href: "/dashboard/fiis" },
  { label: "Saúde Financeira 💚", href: "/dashboard/saude-financeira" },
  { label: "Premium ✨", href: "/dashboard/premium" },
  { label: "Compartilhamento", href: "/dashboard/compartilhamento" },
];

const costSubItems = [
  { label: "Áreas", href: "/dashboard/custos/areas" },
  { label: "Tipos", href: "/dashboard/custos/tipos" },
  { label: "Custos", href: "/dashboard/custos" },
  { label: "Análise", href: "/dashboard/custos/analise" },
];

const incomeSubItems = [
  { label: "Entradas", href: "/dashboard/entradas" },
  { label: "Análise", href: "/dashboard/entradas/analise" },
];

function WalletSwitcher({
  walletContext,
  onComplete,
}: {
  walletContext: WalletContext;
  onComplete?: () => void;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const isSharedWallet = walletContext.activeWallet.mode === "shared";
  const accessLabel = isSharedWallet
    ? walletContext.activeWallet.permission === "FULL"
      ? "Edicao"
      : "Leitura"
    : "Pessoal";

  const options = [
    {
      label: `Minha carteira (${walletContext.user.name})`,
      value: walletContext.user.id,
    },
    ...walletContext.sharedWallets.map((access) => ({
      label: access.owner.name ?? access.owner.email,
      value: access.owner.id,
    })),
  ];

  async function handleChange(ownerId: string) {
    const response = await fetch("/api/wallet/active", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ownerId: ownerId === walletContext.user.id ? null : ownerId,
      }),
    });

    if (!response.ok) {
      return;
    }

    onComplete?.();

    startTransition(() => {
      router.refresh();
    });
  }

  return (
    <Card
      variant="outlined"
      rounded="lg"
      className="border-slate-200/80 bg-white/90 shadow-sm"
    >
      <Card.Body className="space-y-2 p-2">
        <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
          <span
            className={`h-2 w-2 shrink-0 rounded-full ${
              isSharedWallet ? "bg-[var(--primary)]" : "bg-emerald-500"
            }`}
          />
          <p className="min-w-0 flex-1 truncate text-sm font-semibold text-slate-700">
            {walletContext.activeWallet.ownerName}
          </p>
          <Chip
            label={accessLabel}
            active={isSharedWallet}
            disabled
            className="pointer-events-none"
          />
        </div>

        <Select
          name="activeWallet"
          value={walletContext.activeWallet.ownerId}
          onChange={(e) => handleChange(e.target.value)}
          options={options}
          disabled={isPending}
          containerClassName="mb-0"
        />
      </Card.Body>
    </Card>
  );
}

function NavContent({
  pathname,
  walletContext,
  onLinkClick,
}: {
  pathname: string;
  walletContext: WalletContext;
  onLinkClick?: () => void;
}) {
  const visibleNavItems = walletContext.isShared
    ? navItems.filter((item) =>
        ["/dashboard", "/dashboard/compartilhamento"].includes(item.href)
      )
    : navItems;

  return (
    <nav className="flex flex-col gap-1">
      {visibleNavItems.map((item, index) => (
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
          title="Custos Domesticos"
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

      <Accordion
        type="single"
        collapsible
        variant="default"
        className="w-full"
      >
        <Accordion.Item
          title="Entradas"
          defaultOpen={pathname.startsWith("/dashboard/entradas")}
          headerClassName={`rounded-lg px-4 py-3 text-sm font-medium transition-colors hover:bg-[var(--primary-light)] ${
            pathname.startsWith("/dashboard/entradas")
              ? "text-[var(--primary)]"
              : "text-[var(--foreground)]"
          }`}
          contentClassName="pl-4 flex flex-col gap-1"
        >
          {incomeSubItems.map((item) => (
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

export function DashboardShell({
  children,
  walletContext,
}: {
  children: React.ReactNode;
  walletContext: WalletContext;
}) {
  const [open, setOpen] = useState(false);
  const [hasMounted, setHasMounted] = useState(false);
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    setHasMounted(true);
  }, []);

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
  }

  function closeSheet() {
    (document.activeElement as HTMLElement)?.blur();
    setOpen(false);
  }

  async function backToOwnWallet() {
    await fetch("/api/wallet/active", { method: "DELETE" });
    router.refresh();
  }

  return (
    <div className="min-h-screen bg-[var(--background)]">
      <aside className="fixed inset-y-0 left-0 z-30 flex w-64 flex-col border-r border-slate-200 bg-[var(--background)] max-lg:![display:none]">
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
          <WalletSwitcher walletContext={walletContext} />
          <NavContent pathname={pathname} walletContext={walletContext} />
        </div>
        <div className="border-t border-slate-200 px-3 py-4">
          <Button variant="outline" className="w-full" onClick={handleLogout}>
            Sair
          </Button>
        </div>
      </aside>

      <div className="lg:ml-64">
        <header className="sticky top-0 flex items-center gap-4 border-b border-slate-200 bg-[var(--background)] px-4 py-3 shadow-sm lg:![display:none] z-50">
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

        {hasMounted ? (
          <AsideSheet open={open} onClose={closeSheet} side="left" size="sm" className="z-100">
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
              <WalletSwitcher walletContext={walletContext} onComplete={closeSheet} />
              <NavContent
                pathname={pathname}
                walletContext={walletContext}
                onLinkClick={closeSheet}
              />
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
        ) : null}

        <main className="mx-auto max-w-7xl px-4 py-6">
          {children}
        </main>
      </div>
    </div>
  );
}
