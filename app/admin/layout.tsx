import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getAuthUser } from '@/lib/supabase/server'

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await getAuthUser()
  if (!user) redirect('/login?redirect=/admin')
  if (user.app_metadata?.['role'] !== 'admin') redirect('/dashboard')

  return (
    <div className="min-h-screen bg-[#080808] text-[#f1f1f1]">
      <header className="border-b border-[#292929] bg-[#0b0b0b]">
        <nav className="mx-auto flex min-h-12 max-w-[1400px] items-center justify-between gap-6 px-4 sm:px-6">
          <Link href="/admin" className="whitespace-nowrap text-[13px] font-semibold tracking-tight text-white">
            Extremity <span className="text-[#b22222]">Admin</span>
          </Link>
          <div className="flex items-center gap-4 overflow-x-auto text-[11px] text-[#898989]">
            <Link href="/admin" className="whitespace-nowrap hover:text-white">Resumen</Link>
            <Link href="/admin/records" className="whitespace-nowrap hover:text-white">Récords</Link>
            <Link href="/admin/levels" className="whitespace-nowrap hover:text-white">Niveles</Link>
            <Link href="/admin/proposals" className="whitespace-nowrap hover:text-white">Propuestas</Link>
            <Link href="/admin/identities" className="whitespace-nowrap hover:text-white">Identidades</Link>
            <Link href="/admin/profiles" className="whitespace-nowrap hover:text-white">Perfiles</Link>
            <Link href="/admin/content" className="whitespace-nowrap hover:text-white">Contenido</Link>
            <Link href="/admin/audit" className="whitespace-nowrap hover:text-white">Registro de auditoría</Link>
            <a href="/" className="whitespace-nowrap text-[#555] hover:text-white">Ver sitio</a>
            <a href="/logout" className="text-[#b22222] hover:underline">Cerrar sesión</a>
          </div>
        </nav>
      </header>
      <main className="mx-auto max-w-[1400px] px-4 py-8 sm:px-6">{children}</main>
    </div>
  )
}
