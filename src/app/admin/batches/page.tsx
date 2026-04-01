import { createClient } from '@/utils/supabase/server'
import { BatchesManagerClient } from './BatchesManagerClient'
import { redirect } from 'next/navigation'

export default async function BatchesPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: roleData } = await supabase
    .from('admin_roles')
    .select('role')
    .eq('user_id', user.id)
    .single()

  if (!roleData || roleData.role !== 'super_admin') {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-center">
        <h2 className="text-2xl font-bold text-destructive mb-2">Access Denied</h2>
        <p className="text-muted-foreground">You do not have permission to view or manage batches. Please contact a Super Admin.</p>
      </div>
    )
  }

  const { data: batches } = await supabase
    .from('batches')
    .select('id, year, name')
    .order('year', { ascending: false })

  return (
    <div className="flex flex-col gap-6 w-full">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">System Batches</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Create, edit, and manage standard graduation batches to logically group alumni.
        </p>
      </div>

      <BatchesManagerClient initialBatches={batches || []} />
    </div>
  )
}
