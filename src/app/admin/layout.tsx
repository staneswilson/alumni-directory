import { ReactNode } from 'react'
import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import { SidebarProvider, SidebarInset, SidebarTrigger } from '@/components/ui/sidebar'
import { Separator } from '@/components/ui/separator'
import { AdminSidebar } from '@/components/AdminSidebar'
import { ThemeToggle } from '@/components/ThemeToggle'

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  async function signOutAction() {
    'use server'
    const s = await createClient()
    await s.auth.signOut()
    redirect('/login')
  }

  return (
    <div className="bg-background text-foreground min-h-screen selection:bg-primary/30 selection:text-white">
      <SidebarProvider>
        <AdminSidebar signOutAction={signOutAction} />
        <SidebarInset>
          <header className="flex h-14 shrink-0 items-center gap-2 border-b px-4 bg-background/80 backdrop-blur-sm">
            <SidebarTrigger className="-ml-1" />
            <Separator orientation="vertical" className="mr-2 h-4" />
            <span className="font-medium text-sm text-muted-foreground">Alumni Management</span>
            <div className="ml-auto">
              <ThemeToggle className="w-8 h-8 rounded-full" />
            </div>
          </header>
          <main className="flex-1 overflow-auto p-4 sm:p-6 lg:p-8">
            <div className="mx-auto w-full max-w-6xl">
              {children}
            </div>
          </main>
        </SidebarInset>
      </SidebarProvider>
    </div>
  )
}
