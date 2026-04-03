'use server'

import { createClient } from '@/utils/supabase/server'
import { createAdminClient } from '@/utils/supabase/admin'
import { revalidatePath } from 'next/cache'

export async function addStudent(data: {
  batch_id: string
  name: string
  description?: string
  phone_number?: string
  photo_url?: string | null
  is_representative?: boolean
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return { error: 'Unauthorized. Please log in.' }
  }

  const { data: roleData } = await supabase
    .from('admin_roles')
    .select('role, batch_id')
    .eq('user_id', user.id)
    .single()

  if (!roleData) {
    return { error: 'No administrative roles assigned.' }
  }

  if (roleData.role === 'batch_admin' && roleData.batch_id !== data.batch_id) {
    return { error: 'RBAC Violation: You can only add students to your assigned batch.' }
  }

  const adminClient = createAdminClient()

  const { error: insertError, data: insertedData } = await adminClient
    .from('students')
    .insert([
      {
        batch_id: data.batch_id,
        name: data.name,
        description: data.description,
        phone_number: data.phone_number,
        photo_url: data.photo_url,
        is_representative: data.is_representative ?? false
      }
    ])
    .select()

  if (insertError || !insertedData || insertedData.length === 0) {
    console.error('Insert error', insertError)
    return { error: 'Failed to insert student record. Please try again.' }
  }

  revalidatePath('/admin')
  revalidatePath('/admin/add-alumni')
  revalidatePath('/admin/alumni')
  revalidatePath('/')

  return { success: true }
}

export async function addBatch(data: { year: number; name: string }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return { error: 'Unauthorized. Please log in.' }
  }

  const { data: roleData } = await supabase
    .from('admin_roles')
    .select('role')
    .eq('user_id', user.id)
    .single()

  if (!roleData || roleData.role !== 'super_admin') {
    return { error: 'Only super admins can create batches.' }
  }

  const adminClient = createAdminClient()

  const { error: insertError } = await adminClient
    .from('batches')
    .insert([{ year: data.year, name: data.name }])

  if (insertError) {
    console.error('Batch insert error', insertError)
    if (insertError.code === '23505') {
      return { error: 'A batch with this year and name already exists.' }
    }
    return { error: 'Failed to create batch. Please try again.' }
  }

  revalidatePath('/admin')
  revalidatePath('/admin/add-alumni')
  revalidatePath('/admin/add-batch')

  return { success: true }
}

export async function getAdminRoles() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return { error: 'Unauthorized. Please log in.' }
  }

  const { data: roleData } = await supabase
    .from('admin_roles')
    .select('role')
    .eq('user_id', user.id)
    .single()

  if (!roleData || roleData.role !== 'super_admin') {
    return { error: 'Only super admins can view admin roles.' }
  }

  const { data: admins, error } = await supabase
    .from('admin_roles')
    .select('id, user_id, role, batch_id')

  if (error) {
    console.error('Fetch admins error', error)
    return { error: 'Failed to fetch admins.' }
  }

  let authData = null
  try {
    const adminClient = createAdminClient()
    const response = await adminClient.auth.admin.listUsers()
    authData = response.data
  } catch (e) {
    // Fallback if env vars are missing
    return { admins: admins.map(a => ({ ...a, email: a.user_id })) }
  }

  const usersList = authData?.users || []

  const formattedAdmins = admins.map(admin => {
    const matchedUser = usersList.find(u => u.id === admin.user_id)
    return {
      ...admin,
      email: matchedUser?.email || admin.user_id
    }
  })

  return { admins: formattedAdmins }
}

export async function addAdminRole(data: { user_id: string; role: string; batch_id?: string }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return { error: 'Unauthorized. Please log in.' }
  }

  const { data: roleData } = await supabase
    .from('admin_roles')
    .select('role')
    .eq('user_id', user.id)
    .single()

  if (!roleData || roleData.role !== 'super_admin') {
    return { error: 'Only super admins can manage roles.' }
  }

  const adminClient = createAdminClient()

  const { error: insertError } = await adminClient
    .from('admin_roles')
    .insert([{ user_id: data.user_id, role: data.role, batch_id: data.batch_id || null }])

  if (insertError) {
    console.error('Add role error', insertError)
    if (insertError.code === '23505') {
      return { error: 'This user already has a role.' }
    }
    return { error: 'Failed to assign role.' }
  }

  revalidatePath('/admin/users')
  return { success: true }
}

export async function deleteAdminRole(id: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return { error: 'Unauthorized. Please log in.' }
  }

  const { data: roleData } = await supabase
    .from('admin_roles')
    .select('role')
    .eq('user_id', user.id)
    .single()

  if (!roleData || roleData.role !== 'super_admin') {
    return { error: 'Only super admins can manage roles.' }
  }

  const { data: targetRole } = await supabase.from('admin_roles').select('user_id').eq('id', id).single()
  if (targetRole && targetRole.user_id === user.id) {
    return { error: 'You cannot remove your own administrative role.' }
  }

  const adminClient = createAdminClient()

  const { error: deleteError } = await adminClient
    .from('admin_roles')
    .delete()
    .eq('id', id)

  if (deleteError) {
    console.error('Delete role error', deleteError)
    return { error: 'Failed to delete role.' }
  }

  revalidatePath('/admin/users')
  return { success: true }
}

export async function deleteBatch(id: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorized.' }

  const { data: roleData } = await supabase.from('admin_roles').select('role').eq('user_id', user.id).single()
  if (!roleData || roleData.role !== 'super_admin') return { error: 'Only super admins can delete batches.' }

  const adminClient = createAdminClient()

  const { error } = await adminClient.from('batches').delete().eq('id', id)
  if (error) return { error: 'Failed to delete batch. It might be linked to alumni.' }
  
  revalidatePath('/admin/batches')
  revalidatePath('/admin/alumni')
  return { success: true }
}

export async function updateBatch(id: string, data: { year: number; name: string }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorized.' }

  const { data: roleData } = await supabase.from('admin_roles').select('role').eq('user_id', user.id).single()
  if (!roleData || roleData.role !== 'super_admin') return { error: 'Only super admins can update batches.' }

  const adminClient = createAdminClient()

  const { error } = await adminClient.from('batches').update({ year: data.year, name: data.name }).eq('id', id)
  if (error) return { error: 'Failed to update batch.' }
  
  revalidatePath('/admin/batches')
  revalidatePath('/admin/alumni')
  return { success: true }
}

export async function deleteStudent(id: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorized.' }

  const { data: student } = await supabase.from('students').select('batch_id, photo_url').eq('id', id).single()
  if (!student) return { error: 'Student not found.' }

  const { data: roleData } = await supabase.from('admin_roles').select('role, batch_id').eq('user_id', user.id).single()
  if (!roleData || (roleData.role === 'batch_admin' && roleData.batch_id !== student.batch_id)) {
    return { error: 'Unauthorized to delete this student.' }
  }

  // Delete associated photo if it exists
  if (student.photo_url) {
    const urlParts = student.photo_url.split('/alumni-photos/')
    if (urlParts.length > 1) {
      const filePath = urlParts[1]
      await supabase.storage.from('alumni-photos').remove([filePath])
    }
  }

  const adminClient = createAdminClient()

  const { error, data: deletedData } = await adminClient.from('students').delete().eq('id', id).select()
  
  if (error || !deletedData || deletedData.length === 0) {
    console.error('Delete student failed: ', error, deletedData)
    return { error: 'Failed to delete student.' }
  }
  
  revalidatePath('/admin/alumni')
  return { success: true }
}

export async function updateStudent(id: string, data: { name: string; description?: string; phone_number?: string; photo_url?: string | null; batch_id: string; is_representative?: boolean }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorized.' }

  const { data: student } = await supabase.from('students').select('batch_id, photo_url').eq('id', id).single()
  if (!student) return { error: 'Student not found.' }

  const { data: roleData } = await supabase.from('admin_roles').select('role, batch_id').eq('user_id', user.id).single()
  if (!roleData || (roleData.role === 'batch_admin' && (roleData.batch_id !== student.batch_id || roleData.batch_id !== data.batch_id))) {
    return { error: 'Unauthorized to route this student.' }
  }

  if (data.photo_url !== undefined && student.photo_url && student.photo_url !== data.photo_url) {
    const urlParts = student.photo_url.split('/alumni-photos/')
    if (urlParts.length > 1) {
      await supabase.storage.from('alumni-photos').remove([urlParts[1]])
    }
  }

  const adminClient = createAdminClient()

  const { error, data: updatedData } = await adminClient.from('students').update(data).eq('id', id).select()
  
  if (error || !updatedData || updatedData.length === 0) {
    console.error('Update student failed: ', error, updatedData)
    return { error: 'Failed to update student.' }
  }
  
  revalidatePath('/admin/alumni')
  return { success: true }
}

export async function createAdminUser(data: { email: string; password: string; role: string; batch_id?: string }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorized.' }

  const { data: roleData } = await supabase.from('admin_roles').select('role').eq('user_id', user.id).single()
  if (!roleData || roleData.role !== 'super_admin') return { error: 'Only super admins can create admin users.' }

  let adminClient
  try {
    adminClient = createAdminClient()
  } catch (e) {
    return { error: 'Admin client initialization failed. Missing environment variables.' }
  }

  const { data: newUser, error: authError } = await adminClient.auth.admin.createUser({
    email: data.email,
    password: data.password,
    email_confirm: true,
  })

  if (authError) return { error: authError.message }

  const { error: insertError } = await adminClient.from('admin_roles').insert([
    { user_id: newUser.user.id, role: data.role, batch_id: data.batch_id || null }
  ])

  if (insertError) {
    await adminClient.auth.admin.deleteUser(newUser.user.id)
    return { error: 'Failed to assign role to the new user. Identity rolled back.' }
  }

  revalidatePath('/admin/users')
  return { success: true }
}

export async function updateAdminPassword(password: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorized.' }

  const { error } = await supabase.auth.updateUser({ password })
  if (error) return { error: error.message }

  return { success: true }
}

export async function addStudentsBulk(students: Array<{
  batch_id: string
  name: string
  description?: string
  phone_number?: string
  photo_url?: string | null
  is_representative?: boolean
}>) {
  try {
    const supabaseSession = await createClient()
    const { data: { user }, error: authError } = await supabaseSession.auth.getUser()

    if (authError || !user) {
      return { error: 'Unauthorized.' }
    }

    const adminClient = createAdminClient()

    // Validate RBAC
    const { data: userRole, error: roleError } = await adminClient
      .from('user_roles')
      .select('role, batch_id')
      .eq('user_id', user.id)
      .single()

    if (roleError || !userRole) {
      return { error: 'Access denied. Administrator privileges required.' }
    }

    if (userRole.role === 'batch_admin') {
      const allowedBatchId = userRole.batch_id
      const invalidStudents = students.filter(s => s.batch_id !== allowedBatchId)
      if (invalidStudents.length > 0) {
         return { error: 'Access denied. You can only import students for your assigned batch.' }
      }
    }

    // Attempt bulk insert
    const { error: insertError } = await adminClient
      .from('students')
      .insert(students)

    if (insertError) {
      console.error('Error in addStudentsBulk DB layer:', insertError)
      return { error: `Failed to insert students: ${insertError.message}` }
    }

    return { success: true }
  } catch (error) {
    if (error instanceof Error) {
      return { error: error.message }
    }
    return { error: 'An unknown error occurred while importing students.' }
  }
}
