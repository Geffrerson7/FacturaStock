"use client";

import { useState } from "react";
import { Avatar, Button, Dropdown, Label } from "@heroui/react";
import { FiChevronDown, FiLogOut } from "react-icons/fi";

import { authClient } from "@/src/lib/auth-client";
import type { SessionUser } from "@/src/lib/auth-policy";

export type PanelUser = Pick<SessionUser, "name" | "email" | "role">;

function getInitials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  const initials = words
    .slice(0, 2)
    .map((word) => word[0])
    .join("");

  return initials.toUpperCase() || "?";
}

export default function UserMenu({ user }: { user: PanelUser }) {
  const [isSigningOut, setIsSigningOut] = useState(false);

  async function handleSignOut() {
    setIsSigningOut(true);
    await authClient.signOut();
    // Carga completa a propósito: descarta el estado y los datos del panel
    // que Next guarda en el navegador, para que nada sobreviva al cierre de
    // sesión (router.push los conservaría).
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination
    window.location.assign("/");
  }

  return (
    <Dropdown>
      <Button
        variant="ghost"
        className="h-10 gap-2 px-1.5 sm:px-2"
        aria-label={`Menú de la cuenta de ${user.name}`}
        isDisabled={isSigningOut}
      >
        <Avatar size="sm" color="accent" variant="soft">
          <Avatar.Fallback>{getInitials(user.name)}</Avatar.Fallback>
        </Avatar>
        <span className="hidden max-w-40 truncate text-sm font-medium sm:block">
          {isSigningOut ? "Cerrando sesión..." : user.name}
        </span>
        <FiChevronDown aria-hidden className="hidden text-muted sm:block" />
      </Button>

      <Dropdown.Popover placement="bottom end" className="min-w-60">
        <div className="border-b border-separator px-4 py-3">
          <p className="truncate text-sm font-medium">{user.name}</p>
          <p className="truncate text-xs text-muted">{user.email}</p>
        </div>
        <Dropdown.Menu
          aria-label="Cuenta"
          onAction={(key) => {
            if (key === "sign-out") void handleSignOut();
          }}
        >
          <Dropdown.Item id="sign-out" textValue="Cerrar sesión" variant="danger">
            <FiLogOut aria-hidden />
            <Label>Cerrar sesión</Label>
          </Dropdown.Item>
        </Dropdown.Menu>
      </Dropdown.Popover>
    </Dropdown>
  );
}
