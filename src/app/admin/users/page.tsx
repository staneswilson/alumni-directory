import { createClient } from '@/utils/supabase/server'
import { getAdminRoles } from '../actions'
import { redirect } from 'next/navigation'
import { UserManagementClient } from './UserManagementClient'

export default async function UsersPage() {
  const supabase = await createClient()

  // Verify super admin
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
        <p className="text-muted-foreground">You do not have permission to view this page.</p>
      </div>
    )
  }

  const { admins, error } = await getAdminRoles()
  
  const { data: batches } = await supabase
    .from('batches')
    .select('*')
    .order('year', { ascending: false })

  if (error) {
    return (
      <div className="p-8">
        <p className="text-destructive font-semibold">Error Loading Users: {error}</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6 w-full">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">User Management</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Assign and manage roles for other administrators here.
        </p>
      </div>

      <UserManagementClient 
        initialAdmins={admins || []} 
        batches={batches || []} 
        currentUserId={user.id}
      />
    </div>
  )
}
