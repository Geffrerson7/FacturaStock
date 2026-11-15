"use client";

import { useEffect } from "react";
import { Button } from "@heroui/react";
import { FiRefreshCw } from "react-icons/fi";

import StatusScreen from "@/components/ui/StatusScreen";

export default function RootError({
  error,
  retry,
}: {
  error: unknown;
  retry: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <StatusScreen
      fullScreen
      eyebrow="Error"
      title="Algo salió mal"
      description="Ocurrió un problema inesperado al cargar la página. Vuelve a intentarlo en unos segundos."
    >
      <Button variant="primary" onPress={() => retry()}>
        <FiRefreshCw aria-hidden />
        Reintentar
      </Button>
    </StatusScreen>
  );
}
