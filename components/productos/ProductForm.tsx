"use client";

import {
  useRef,
  useState,
  type ChangeEvent,
  type ComponentProps,
  type DragEvent,
} from "react";
import { FiImage, FiTrash2, FiUploadCloud } from "react-icons/fi";
import {
  Avatar,
  Button,
  FieldError,
  Form,
  Input,
  Label,
  ListBox,
  NumberField,
  Select,
  Switch,
  TextField,
  toast,
} from "@heroui/react";

import type { Category } from "@/src/lib/types/category";
import type { Product } from "@/src/lib/types/product";
import { createProductSchema } from "@/src/lib/validations/product";

type FieldErrors = Record<string, string>;

type ProductImage = {
  url: string;
  publicId: string;
};

const UPLOAD_FOLDER = "facturastock/products";
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];

type CloudinaryUploadResponse = {
  secure_url: string;
  public_id: string;
};

type ProductFormProps = {
  product?: Product;
  categories: Category[];
  onSuccess?: (product: Product) => void;
};

type FormSubmitEvent = Parameters<
  NonNullable<ComponentProps<typeof Form>["onSubmit"]>
>[0];

type ApiErrorBody = {
  error?: {
    code?: string;
    message?: string;
    field?: string;
    details?: { path: string; message: string }[];
  };
};

type ApiResponseBody = ApiErrorBody & { data?: Product };

export default function ProductForm({
  product,
  categories,
  onSuccess,
}: ProductFormProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [formKey, setFormKey] = useState(0);
  const [categoryId, setCategoryId] = useState(
    product?.categoryId ?? categories[0]?.id ?? "",
  );
  const [isActive, setIsActive] = useState(product?.isActive ?? true);
  const [image, setImage] = useState<ProductImage | null>(
    product?.imageUrl
      ? { url: product.imageUrl, publicId: product.imagePublicId ?? "" }
      : null,
  );
  const [isUploading, setIsUploading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [imageUrlInput, setImageUrlInput] = useState("");
  const imageInputRef = useRef<HTMLInputElement>(null);
  const dragDepth = useRef(0);

  function openImagePicker() {
    imageInputRef.current?.click();
  }

  /**
   * Sube una imagen a Cloudinary con una subida firmada.
   *
   * `source` puede ser un archivo del equipo o una URL remota; en ambos casos
   * Cloudinary almacena la imagen. La firma se pide a
   * `/api/cloudinary/signature`, así que el API secret nunca sale del servidor.
   */
  async function uploadImage(source: File | string) {
    const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
    const apiKey = process.env.NEXT_PUBLIC_CLOUDINARY_API_KEY;

    if (!cloudName || !apiKey) {
      toast.danger("Cloudinary no está configurado", {
        description: "Falta el cloud name o el API key en el entorno.",
      });
      return;
    }

    setIsUploading(true);

    try {
      const timestamp = Math.floor(Date.now() / 1000);

      const signatureResponse = await fetch("/api/cloudinary/signature", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          paramsToSign: { folder: UPLOAD_FOLDER, timestamp },
        }),
      });

      if (!signatureResponse.ok) {
        throw new Error("No se pudo firmar la subida.");
      }

      const { signature } = (await signatureResponse.json()) as {
        signature: string;
      };

      const body = new FormData();
      body.append("file", source);
      body.append("api_key", apiKey);
      body.append("timestamp", String(timestamp));
      body.append("folder", UPLOAD_FOLDER);
      body.append("signature", signature);

      const uploadResponse = await fetch(
        `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`,
        { method: "POST", body },
      );

      if (!uploadResponse.ok) {
        throw new Error("Cloudinary rechazó la imagen.");
      }

      const uploaded = (await uploadResponse.json()) as CloudinaryUploadResponse;

      setImage({ url: uploaded.secure_url, publicId: uploaded.public_id });
      setImageUrlInput("");
      toast.success("Imagen lista", {
        description: "La imagen se guardará al registrar el producto.",
      });
    } catch {
      toast.danger("No se pudo subir la imagen", {
        description:
          typeof source === "string"
            ? "Revisa que la URL apunte a una imagen pública."
            : "Inténtalo de nuevo en unos segundos.",
      });
    } finally {
      setIsUploading(false);
    }
  }

  /** Valida el archivo elegido y lo envía a Cloudinary. */
  function handleImageFile(file: File) {
    if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
      toast.danger("Formato no admitido", {
        description: "Usa una imagen JPG, PNG o WebP.",
      });
      return;
    }

    if (file.size > MAX_IMAGE_BYTES) {
      toast.danger("La imagen es demasiado grande", {
        description: "El tamaño máximo es de 5 MB.",
      });
      return;
    }

    void uploadImage(file);
  }

  function handleImageChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];

    // Permite volver a elegir el mismo archivo después de un error.
    event.target.value = "";

    if (file) handleImageFile(file);
  }

  function handleImageUrlSubmit() {
    const url = imageUrlInput.trim();

    if (!/^https?:\/\/\S+$/i.test(url)) {
      toast.danger("URL no válida", {
        description: "Debe empezar por http:// o https://.",
      });
      return;
    }

    void uploadImage(url);
  }

  function handleDragEnter(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();

    if (!event.dataTransfer.types.includes("Files")) return;

    dragDepth.current += 1;
    setIsDragging(true);
  }

  function handleDragOver(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    event.dataTransfer.dropEffect = "copy";
  }

  function handleDragLeave(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();

    // dragenter/dragleave se disparan por cada hijo: solo se apaga al salir.
    dragDepth.current = Math.max(0, dragDepth.current - 1);

    if (dragDepth.current === 0) setIsDragging(false);
  }

  function handleDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    dragDepth.current = 0;
    setIsDragging(false);

    const file = event.dataTransfer.files?.[0];

    if (file) handleImageFile(file);
  }

  async function handleSubmit(event: FormSubmitEvent) {
    event.preventDefault();

    const formData = new FormData(event.currentTarget);
    const values = {
      name: String(formData.get("name") ?? ""),
      sku: String(formData.get("sku") ?? ""),
      description: String(formData.get("description") ?? ""),
      price: formData.get("price"),
      stock: formData.get("stock"),
      categoryId,
      isActive,
      imageUrl: image?.url ?? null,
      imagePublicId: image?.publicId ?? null,
    };

    const parsed = createProductSchema.safeParse(values);

    if (!parsed.success) {
      const fieldErrors: FieldErrors = {};
      for (const issue of parsed.error.issues) {
        const key = String(issue.path[0]);
        fieldErrors[key] ??= issue.message;
      }
      setErrors(fieldErrors);
      return;
    }

    setErrors({});
    setIsSubmitting(true);

    const endpoint = product ? `/api/productos/${product.id}` : "/api/productos";
    const method = product ? "PUT" : "POST";

    try {
      const response = await fetch(endpoint, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(parsed.data),
      });

      const body = (await response.json().catch(() => ({}))) as ApiResponseBody;

      if (response.ok) {
        toast.success(product ? "Producto actualizado" : "Producto registrado", {
          description: product
            ? "Los datos del producto se actualizaron correctamente."
            : "El producto se guardó correctamente.",
        });

        if (!product) {
          setFormKey((key) => key + 1);
          setCategoryId(categories[0]?.id ?? "");
          setIsActive(true);
          setImage(null);
        }

        if (body.data) onSuccess?.(body.data);
        return;
      }

      const apiError = body.error;
      const fieldErrors: FieldErrors = {};

      if (apiError?.field) {
        fieldErrors[apiError.field] = apiError.message ?? "Valor inválido.";
      }
      for (const detail of apiError?.details ?? []) {
        if (detail.path) fieldErrors[detail.path] ??= detail.message;
      }
      setErrors(fieldErrors);

      toast.danger(
        product ? "No se pudo actualizar el producto" : "No se pudo registrar el producto",
        {
          description: apiError?.message ?? "Ocurrió un error inesperado.",
        },
      );
    } catch {
      toast.danger(
        product ? "No se pudo actualizar el producto" : "No se pudo registrar el producto",
        {
          description: "No hay conexión con el servidor. Inténtalo de nuevo.",
        },
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Form
      key={formKey}
      className="flex w-full max-w-xl flex-col gap-4"
      validationErrors={errors}
      validationBehavior="aria"
      onSubmit={handleSubmit}
    >
      <TextField name="name" defaultValue={product?.name} isRequired>
        <Label>Nombre del producto</Label>
        <Input placeholder="Agua mineral 500 ml" maxLength={120} />
        <FieldError />
      </TextField>

      <TextField name="sku" defaultValue={product?.sku} isRequired>
        <Label>SKU</Label>
        <Input placeholder="BEB-001" maxLength={50} />
        <FieldError />
      </TextField>

      <TextField name="description" defaultValue={product?.description ?? ""}>
        <Label>Descripción (opcional)</Label>
        <Input placeholder="Botella de agua sin gas" maxLength={255} />
        <FieldError />
      </TextField>

      <div className="flex flex-col gap-4 sm:flex-row">
        <NumberField
          name="price"
          defaultValue={product ? Number(product.price) : undefined}
          minValue={0}
          step={0.01}
          isRequired
          className="flex-1"
        >
          <Label>Precio (IGV incluido)</Label>
          <NumberField.Group>
            <NumberField.DecrementButton />
            <NumberField.Input />
            <NumberField.IncrementButton />
          </NumberField.Group>
          {errors.price ? (
            <p className="text-sm text-red-600">{errors.price}</p>
          ) : null}
        </NumberField>

        <NumberField
          name="stock"
          defaultValue={product?.stock ?? 0}
          minValue={0}
          step={1}
          isRequired
          className="flex-1"
        >
          <Label>Stock</Label>
          <NumberField.Group>
            <NumberField.DecrementButton />
            <NumberField.Input />
            <NumberField.IncrementButton />
          </NumberField.Group>
          {errors.stock ? (
            <p className="text-sm text-red-600">{errors.stock}</p>
          ) : null}
        </NumberField>
      </div>

      <div className="flex flex-col gap-2">
        <Select
          value={categoryId}
          onChange={(key) => setCategoryId(String(key))}
          isRequired
          placeholder="Selecciona una categoría"
        >
          <Label>Categoría</Label>
          <Select.Trigger>
            <Select.Value />
            <Select.Indicator />
          </Select.Trigger>
          <Select.Popover>
            <ListBox>
              {categories.map((category) => (
                <ListBox.Item
                  key={category.id}
                  id={category.id}
                  textValue={category.name}
                >
                  {category.name}
                  <ListBox.ItemIndicator />
                </ListBox.Item>
              ))}
            </ListBox>
          </Select.Popover>
        </Select>
        {errors.categoryId ? (
          <p className="text-sm text-red-600">{errors.categoryId}</p>
        ) : null}
      </div>

      <div className="flex flex-col gap-2">
        <span className="text-sm font-medium">Imagen del producto</span>

        <div
          onDragEnter={handleDragEnter}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className={`flex flex-col gap-3 rounded-xl border border-dashed p-3 transition-colors ${
            isDragging
              ? "border-slate-900 bg-slate-100"
              : "border-slate-300 bg-transparent"
          }`}
        >
          <div className="flex items-center gap-4">
            <Avatar size="lg" color="accent">
              {image ? (
                <Avatar.Image
                  src={image.url}
                  alt={product?.name ?? "Producto"}
                />
              ) : null}
              <Avatar.Fallback>
                <FiImage aria-hidden />
              </Avatar.Fallback>
            </Avatar>

            <div className="flex flex-wrap items-center gap-2">
              <input
                ref={imageInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="sr-only"
                onChange={handleImageChange}
              />

              <Button
                type="button"
                variant="secondary"
                isDisabled={isUploading}
                onClick={openImagePicker}
              >
                <FiUploadCloud aria-hidden />
                {isUploading
                  ? "Subiendo…"
                  : image
                    ? "Cambiar imagen"
                    : "Subir imagen"}
              </Button>

              {image ? (
                <Button
                  type="button"
                  variant="ghost"
                  isDisabled={isUploading}
                  onClick={() => setImage(null)}
                >
                  <FiTrash2 aria-hidden />
                  Quitar imagen
                </Button>
              ) : null}
            </div>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
            <TextField
              className="flex-1"
              value={imageUrlInput}
              onChange={setImageUrlInput}
            >
              <Label>O pega una URL de imagen</Label>
              <Input
                type="url"
                placeholder="https://ejemplo.com/producto.jpg"
                maxLength={500}
              />
            </TextField>

            <Button
              type="button"
              variant="secondary"
              isDisabled={isUploading || imageUrlInput.trim() === ""}
              onClick={handleImageUrlSubmit}
            >
              Usar URL
            </Button>
          </div>

          <p className="text-xs text-slate-500">
            Arrastra una imagen aquí, elige un archivo o pega una URL. JPG, PNG
            o WebP de hasta 5 MB. La imagen se sube a Cloudinary y se guarda al
            registrar el producto.
          </p>
        </div>
      </div>

      <Switch isSelected={isActive} onChange={setIsActive}>
        <Switch.Content>
          <Switch.Control>
            <Switch.Thumb />
          </Switch.Control>
          Producto activo
        </Switch.Content>
      </Switch>

      <Button type="submit" className="w-full bg-black" isPending={isSubmitting}>
        {isSubmitting
          ? product
            ? "Guardando..."
            : "Registrando..."
          : product
            ? "Guardar cambios"
            : "Registrar producto"}
      </Button>
    </Form>
  );
}
