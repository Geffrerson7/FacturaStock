"use client";

import { useState, type ComponentProps } from "react";
import {
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
