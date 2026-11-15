import Image from "next/image";

type BrandProps = {
  /** Muestra solo el logotipo, sin el nombre. */
  compact?: boolean;
  className?: string;
};

/**
 * Logotipo y nombre del producto. No es un encabezado: el `h1` de cada
 * pantalla es el título de su contenido.
 */
export default function Brand({ compact = false, className = "" }: BrandProps) {
  return (
    <span className={`flex items-center gap-2.5 ${className}`}>
      <Image
        src="/logo.png"
        alt={compact ? "FacturaStock" : ""}
        width={36}
        height={36}
        loading="eager"
        className="size-9 shrink-0 object-contain"
      />
      {compact ? null : (
        <span className="truncate text-lg font-semibold tracking-tight">
          FacturaStock
        </span>
      )}
    </span>
  );
}
