import { createClient } from '@/utils/supabase/server'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Users, CalendarDays, TrendingUp } from 'lucide-react'

interface BatchWithCount {
  id: string
  year: number
  name: string
  students: { count: number }[]
}

interface AlumniWithBatch {
  id: string
  name: string
  description: string | null
  created_at: string
  batches: { year: number; name: string } | null
}

export default async function AdminDashboard() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  // Fetch stats in parallel
  const [
    { count: totalAlumni },
    { count: totalBatches },
    { data: recentAlumni },
    { data: batches },
  ] = await Promise.all([
    supabase.from('students').select('*', { count: 'exact', head: true }),
    supabase.from('batches').select('*', { count: 'exact', head: true }),
    supabase
      .from('students')
      .select('id, name, description, created_at, batches(year, name)')
      .order('created_at', { ascending: false })
      .limit(8),
    supabase
      .from('batches')
      .select('id, year, name, students(count)')
      .order('year', { ascending: false }),
  ])

  // Find the batch with the most alumni
  const typedBatches = batches as unknown as BatchWithCount[]
  const typedRecentAlumni = recentAlumni as unknown as AlumniWithBatch[]

  const topBatch = typedBatches?.reduce((max, b) => {
    const count = b.students?.[0]?.count ?? 0
    const maxCount = max?.students?.[0]?.count ?? 0
    return count > maxCount ? b : max
  }, typedBatches?.[0])
  const topBatchCount = topBatch?.students?.[0]?.count ?? 0

  const stats = [
    {
      title: 'Total Alumni',
      value: totalAlumni ?? 0,
      icon: Users,
      description: 'Profiles in the directory',
    },
    {
      title: 'Total Batches',
      value: totalBatches ?? 0,
      icon: CalendarDays,
      description: 'Graduation classes',
    },
    {
      title: 'Largest Batch',
      value: topBatchCount,
      icon: TrendingUp,
      description: topBatch ? `${topBatch.year} — ${topBatch.name}` : 'N/A',
    },
  ]

  return (
    <div className="flex flex-col gap-8">
      {/* Page header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Overview of your alumni directory.
        </p>
      </div>

      {/* Stat cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {stats.map((stat) => (
          <Card key={stat.title} className="relative overflow-hidden">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">{stat.title}</CardTitle>
              <stat.icon className="size-4 text-primary" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{stat.value}</div>
              <p className="text-xs text-muted-foreground mt-1">{stat.description}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Two-column layout: Recent alumni + Batches breakdown */}
      <div className="grid gap-6 lg:grid-cols-5">
        {/* Recent Alumni */}
        <Card className="lg:col-span-3">
          <CardHeader>
            <CardTitle className="text-base">Recent Alumni</CardTitle>
            <CardDescription>Latest profiles added to the directory</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead className="hidden sm:table-cell">Batch</TableHead>
                  <TableHead className="text-right">Added</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {typedRecentAlumni && typedRecentAlumni.length > 0 ? (
                  typedRecentAlumni.map((alumni) => (
                    <TableRow key={alumni.id}>
                      <TableCell className="font-medium">{alumni.name}</TableCell>
                      <TableCell className="hidden sm:table-cell text-muted-foreground">
                        {alumni.batches ? `${alumni.batches.year} — ${alumni.batches.name}` : '—'}
                      </TableCell>
                      <TableCell className="text-right text-muted-foreground text-xs">
                        {new Date(alumni.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={3} className="text-center text-muted-foreground py-8">
                      No alumni profiles yet. Add one to get started.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* Batches breakdown */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Batches</CardTitle>
            <CardDescription>Alumni count per graduation year</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {typedBatches && typedBatches.length > 0 ? (
                typedBatches.map((batch) => {
                  const count = batch.students?.[0]?.count ?? 0
                  const maxCount = Math.max(...(typedBatches.map((b) => b.students?.[0]?.count ?? 0)))
                  const percentage = maxCount > 0 ? (count / maxCount) * 100 : 0
                  return (
                    <div key={batch.id} className="space-y-1.5">
                      <div className="flex items-center justify-between text-sm">
                        <span className="font-medium">{batch.year} — {batch.name}</span>
                        <span className="text-muted-foreground tabular-nums">{count}</span>
                      </div>
                      <div className="h-2 rounded-full bg-muted overflow-hidden">
                        <div
                          className="h-full rounded-full bg-primary transition-all duration-500"
                          style={{ width: `${Math.max(percentage, 4)}%` }}
                        />
                      </div>
                    </div>
                  )
                })
              ) : (
                <p className="text-sm text-muted-foreground text-center py-6">No batches created yet.</p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
