"use client";

import Image from "next/image";
import { IoHomeOutline, IoPricetagsOutline, IoCartOutline } from "react-icons/io5";
import { CiUser, CiMoneyBill } from "react-icons/ci";
import { FiLogOut } from "react-icons/fi";
import Link from "next/link";
import { usePathname } from "next/navigation";

interface Item {
   name: string,
   href: string,
   icon: React.ReactNode
}

export default function Sidebar() {
   const pathname = usePathname();

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

         <Link
            href="/"
            className="mt-auto flex items-center gap-3 rounded-xl border border-red-200 p-2 text-red-600 transition-colors hover:bg-red-50"
         >
            <span className="text-2xl"><FiLogOut /></span>
            Cerrar sesión
         </Link>
      </aside>
   )
}