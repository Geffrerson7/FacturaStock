"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { NAV_ITEMS } from "@/components/admin/navigation";

type SidebarNavProps = {
  /** Solo iconos; el nombre queda como texto accesible y `title`. */
  collapsed?: boolean;
  /** Se llama al elegir un destino (para cerrar el cajón en móvil). */
  onNavigate?: () => void;
};

export default function SidebarNav({
  collapsed = false,
  onNavigate,
}: SidebarNavProps) {
  const pathname = usePathname();

  return (
    <nav aria-label="Secciones del panel">
      <ul className="flex flex-col gap-1">
        {NAV_ITEMS.map((item) => {
          const isActive =
            pathname === item.href || pathname.startsWith(`${item.href}/`);
          const Icon = item.icon;

          return (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={isActive ? "page" : undefined}
                title={collapsed ? item.name : undefined}
                onClick={onNavigate}
                className={`flex h-10 items-center gap-3 rounded-lg text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus ${
                  collapsed ? "justify-center px-0" : "px-3"
                } ${
                  isActive
                    ? "bg-accent-soft text-accent-soft-foreground"
                    : "text-muted hover:bg-default hover:text-foreground"
                }`}
              >
                <Icon aria-hidden className="size-5 shrink-0" />
                <span className={collapsed ? "sr-only" : "truncate"}>
                  {item.name}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
