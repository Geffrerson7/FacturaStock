"use client";

import { useSyncExternalStore } from "react";
import { Button, Chip, Drawer, useOverlayState } from "@heroui/react";
import { FiMenu, FiSidebar } from "react-icons/fi";

import SidebarNav from "@/components/admin/SidebarNav";
import ThemeToggle from "@/components/admin/ThemeToggle";
import UserMenu, { type PanelUser } from "@/components/admin/UserMenu";
import Brand from "@/components/ui/Brand";

const COLLAPSED_KEY = "facturastock-sidebar-collapsed";
const COLLAPSED_EVENT = "facturastock:sidebar";

function subscribeToCollapsed(onChange: () => void) {
  window.addEventListener(COLLAPSED_EVENT, onChange);

  return () => window.removeEventListener(COLLAPSED_EVENT, onChange);
}

function readCollapsed(): boolean {
  try {
    return localStorage.getItem(COLLAPSED_KEY) === "true";
  } catch {
    return false;
  }
}

function writeCollapsed(collapsed: boolean) {
  try {
    localStorage.setItem(COLLAPSED_KEY, String(collapsed));
  } catch {
    // Sin almacenamiento la preferencia no se recuerda, pero el botón no
    // debe fallar.
  }

  window.dispatchEvent(new Event(COLLAPSED_EVENT));
}

function DemoNotice() {
  return (
    <p className="rounded-lg bg-warning-soft p-3 text-xs text-warning-soft-foreground">
      Modo demostración: puedes ver todo, pero no crear, editar ni eliminar.
    </p>
  );
}

type AdminShellProps = {
  user: PanelUser;
  children: React.ReactNode;
};

/**
 * Estructura del panel: barra lateral plegable en escritorio, cajón en móvil,
 * cabecera con la cuenta y un área de contenido con ancho máximo.
 */
export default function AdminShell({ user, children }: AdminShellProps) {
  const drawer = useOverlayState();
  const isCollapsed = useSyncExternalStore(
    subscribeToCollapsed,
    readCollapsed,
    () => false,
  );
  const isDemo = user.role === "DEMO";

  return (
    <div className="flex min-h-dvh">
      <aside
        className={`sticky top-0 hidden h-dvh shrink-0 flex-col gap-6 border-r border-border bg-surface py-4 transition-[width] duration-200 lg:flex ${
          isCollapsed ? "w-18 px-3" : "w-64 px-4"
        }`}
      >
        <Brand
          compact={isCollapsed}
          className={isCollapsed ? "h-10 justify-center" : "h-10 px-1"}
        />
        <SidebarNav collapsed={isCollapsed} />
        {isDemo && !isCollapsed ? (
          <div className="mt-auto">
            <DemoNotice />
          </div>
        ) : null}
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-10 flex h-16 shrink-0 items-center gap-2 border-b border-border bg-surface px-3 sm:px-6">
          <Button
            isIconOnly
            variant="ghost"
            className="lg:hidden"
            aria-label="Abrir menú"
            onPress={drawer.open}
          >
            <FiMenu aria-hidden />
          </Button>
          <Button
            isIconOnly
            variant="ghost"
            className="hidden lg:inline-flex"
            aria-label={
              isCollapsed ? "Expandir barra lateral" : "Contraer barra lateral"
            }
            onPress={() => writeCollapsed(!isCollapsed)}
          >
            <FiSidebar aria-hidden />
          </Button>

          <Brand className="min-w-0 lg:hidden" />

          <div className="ml-auto flex shrink-0 items-center gap-1">
            {isDemo ? (
              <Chip
                color="warning"
                size="sm"
                variant="soft"
                className="mr-1 hidden sm:inline-flex"
              >
                <Chip.Label>Demostración</Chip.Label>
              </Chip>
            ) : null}
            <ThemeToggle />
            <UserMenu user={user} />
          </div>
        </header>

        <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
          {children}
        </main>
      </div>

      <Drawer state={drawer}>
        <Drawer.Backdrop>
          <Drawer.Content placement="left">
            <Drawer.Dialog
              aria-label="Menú del panel"
              className="w-72 max-w-[85vw]"
            >
              <Drawer.CloseTrigger />
              <Drawer.Header>
                <Brand />
              </Drawer.Header>
              <Drawer.Body className="flex flex-col gap-6">
                <SidebarNav onNavigate={drawer.close} />
                {isDemo ? <DemoNotice /> : null}
              </Drawer.Body>
            </Drawer.Dialog>
          </Drawer.Content>
        </Drawer.Backdrop>
      </Drawer>
    </div>
  );
}
