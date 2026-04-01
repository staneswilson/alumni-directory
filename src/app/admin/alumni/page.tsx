import { createClient } from '@/utils/supabase/server'
import { AlumniManagerClient } from './AlumniManagerClient'

export default async function AlumniPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data: roleData } = await supabase
    .from('admin_roles')
    .select('role, batch_id')
    .eq('user_id', user.id)
    .single()

  const role: string = roleData?.role || 'pending_role'
  const accessibleBatchId = roleData?.batch_id

  let batchesQuery = supabase
    .from('batches')
    .select('id, year, name')
    .order('year', { ascending: false })

  if (role === 'batch_admin' && accessibleBatchId) {
    batchesQuery = batchesQuery.eq('id', accessibleBatchId)
  }

  const { data: batches } = await batchesQuery

  let studentsQuery = supabase
    .from('students')
    .select('id, name, batch_id, phone_number, description, photo_url, is_representative')
    .order('created_at', { ascending: false })

  if (role === 'batch_admin' && accessibleBatchId) {
    studentsQuery = studentsQuery.eq('batch_id', accessibleBatchId)
  }

  const { data: students } = await studentsQuery

  return (
    <div className="flex flex-col gap-6 w-full">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Alumni Directory</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Manage alumni profiles, upload professional headshots, and control the public directory data.
        </p>
      </div>

      <AlumniManagerClient batches={batches || []} initialStudents={students || []} />
    </div>
  )
}
