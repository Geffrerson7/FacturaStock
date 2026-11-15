"use client";

import { useSyncExternalStore } from "react";
import { Button } from "@heroui/react";
import { FiMoon, FiSun } from "react-icons/fi";

import {
  getServerTheme,
  getTheme,
  setTheme,
  subscribeToTheme,
} from "@/src/lib/theme";

export default function ThemeToggle() {
  const theme = useSyncExternalStore(subscribeToTheme, getTheme, getServerTheme);
  const isDark = theme === "dark";

  return (
    <Button
      isIconOnly
      variant="ghost"
      aria-label={isDark ? "Cambiar a tema claro" : "Cambiar a tema oscuro"}
      onPress={() => setTheme(isDark ? "light" : "dark")}
    >
      {isDark ? <FiSun aria-hidden /> : <FiMoon aria-hidden />}
    </Button>
  );
}
