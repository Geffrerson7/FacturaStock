import Sidebar from "@/components/admin/Sidebar";

export default function Layout({children}: {children: React.ReactNode}) {
   return (
      <section className="flex">
         {/* Aqui ira nuestro sidebar */}
         <Sidebar />
         {children}
      </section>
   );
}