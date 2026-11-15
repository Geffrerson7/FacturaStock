import type { IconType } from "react-icons";
import {
  FiHome,
  FiPackage,
  FiShoppingCart,
  FiTag,
  FiUsers,
} from "react-icons/fi";

export type NavItem = {
  name: string;
  href: string;
  icon: IconType;
};

export const NAV_ITEMS: NavItem[] = [
  { name: "Dashboard", href: "/admin/dashboard", icon: FiHome },
  { name: "Ventas", href: "/admin/ventas", icon: FiShoppingCart },
  { name: "Productos", href: "/admin/productos", icon: FiPackage },
  { name: "Categorías", href: "/admin/categorias", icon: FiTag },
  { name: "Clientes", href: "/admin/clientes", icon: FiUsers },
];
