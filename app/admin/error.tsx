"use client";

import { useEffect } from "react";
import { Button } from "@heroui/react";
import { FiRefreshCw } from "react-icons/fi";

import StatusScreen from "@/components/ui/StatusScreen";

export default function AdminError({
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
      eyebrow="Error"
      title="No se pudo cargar esta sección"
      description="Ocurrió un problema inesperado y tus datos no se modificaron. Vuelve a intentarlo en unos segundos."
    >
      <Button variant="primary" onPress={() => retry()}>
        <FiRefreshCw aria-hidden />
        Reintentar
      </Button>
    </StatusScreen>
  );
}
