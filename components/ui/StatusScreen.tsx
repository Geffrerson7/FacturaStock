type StatusScreenProps = {
  /** Código o etiqueta corta sobre el título ("404", "Error"). */
  eyebrow: string;
  title: string;
  description: string;
  children?: React.ReactNode;
  /** Ocupa toda la ventana (fuera del panel) o solo el área de contenido. */
  fullScreen?: boolean;
};

/** Pantalla centrada para estados de error y de página no encontrada. */
export default function StatusScreen({
  eyebrow,
  title,
  description,
  children,
  fullScreen = false,
}: StatusScreenProps) {
  return (
    <div
      className={`flex flex-col items-center justify-center px-4 text-center ${
        fullScreen ? "min-h-dvh" : "py-20"
      }`}
    >
      <p className="text-sm font-semibold text-accent">{eyebrow}</p>
      <h1 className="mt-2 text-2xl font-semibold tracking-tight">{title}</h1>
      <p className="mt-2 max-w-md text-sm text-muted">{description}</p>
      {children ? (
        <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
          {children}
        </div>
      ) : null}
    </div>
  );
}
