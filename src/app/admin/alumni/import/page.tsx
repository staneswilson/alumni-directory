import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import AlumniImportClient from './AlumniImportClient'

export const dynamic = 'force-dynamic'

export default async function AlumniImportPage() {
  const supabase = await createClient()
  
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    redirect('/login')
  }

  const { data: batches } = await supabase
    .from('batches')
    .select('*')
    .order('year', { ascending: false })

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold tracking-tight">Import Directory Profiles</h1>
        <p className="text-muted-foreground">Upload a CSV file to add multiple alumni profiles at once.</p>
      </div>
      
      <AlumniImportClient batches={batches || []} />
    </div>
  )
}
