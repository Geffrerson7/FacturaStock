"use client";

import Image from "next/image";
import { IoHomeOutline, IoPricetagsOutline, IoCartOutline } from "react-icons/io5";
import { CiUser, CiMoneyBill } from "react-icons/ci";
import { FiLogOut } from "react-icons/fi";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

import { authClient } from "@/src/lib/auth-client";
import type { SessionUser } from "@/src/lib/auth-policy";

interface Item {
   name: string,
   href: string,
   icon: React.ReactNode
}

type SidebarUser = Pick<SessionUser, "name" | "email" | "role">;

export default function Sidebar({ user }: { user: SidebarUser }) {
   const pathname = usePathname();
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

   const menuItems: Item[] = [
      {
         name: "Dashboard",
         href: "/admin/dashboard",
         icon: <IoHomeOutline />
      },
      {
         name: "Clientes",
         href: "/admin/clientes",
         icon: <CiUser />
      },
      {
         name: "Productos",
         href: "/admin/productos",
         icon: <IoCartOutline />
      },
      {
         name: "Categorías",
         href: "/admin/categorias",
         icon: <IoPricetagsOutline />
      },
      {
         name: "ventas",
         href: "/admin/ventas",
         icon: <CiMoneyBill />
      },
   ]

   return (
      <aside className="border h-screen w-64 px-4 py-6 border-slate-300 rounded-tr-2xl rounded-br-2xl flex flex-col">
         <div className="flex items-center gap-2 mb-9">
            <Image
               src="/logo.png"
               alt="Logo de la empresa"
               width={50}
               height={50}
            />
            <h1 className="text-xl">FacturaStock</h1>
         </div>
         <nav>
            <ul className="flex flex-col gap-3">
               {menuItems.map((item) => {
                  const isActive =
                     pathname === item.href ||
                     pathname.startsWith(`${item.href}/`);

                  return (
                     <li key={item.href}>
                        <Link
                           href={item.href}
                           aria-current={isActive ? "page" : undefined}
                           className={`flex items-center gap-3 rounded-xl border p-2 transition-colors ${
                              isActive
                                 ? "border-slate-800 bg-slate-800 font-medium text-white"
                                 : "border-slate-300 text-slate-700 hover:bg-slate-100"
                           }`}
                        >
                           <span className="text-2xl">{item.icon}</span>
                           {item.name}
                        </Link>
                     </li>
                  );
               })}
            </ul>
         </nav>

         <div className="mt-auto flex flex-col gap-3">
            {user.role === "DEMO" ? (
               <p className="rounded-xl border border-amber-200 bg-amber-50 p-2 text-xs text-amber-800">
                  Modo demostración: puedes ver todo, pero no crear, editar ni
                  eliminar.
               </p>
            ) : null}

            <div className="min-w-0 px-2 text-sm">
               <p className="truncate font-medium text-slate-800">{user.name}</p>
               <p className="truncate text-slate-500">{user.email}</p>
            </div>

            <button
               type="button"
               onClick={handleSignOut}
               disabled={isSigningOut}
               className="flex w-full items-center gap-3 rounded-xl border border-red-200 p-2 text-red-600 transition-colors hover:bg-red-50 disabled:opacity-60"
            >
               <span className="text-2xl"><FiLogOut /></span>
               {isSigningOut ? "Cerrando sesión..." : "Cerrar sesión"}
            </button>
         </div>
      </aside>
   )
}