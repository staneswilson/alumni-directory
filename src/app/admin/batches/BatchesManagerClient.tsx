'use client'

import { useState, useMemo, useRef, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { Loader2, Plus, AlertCircle, CheckCircle2, Trash2, Edit2, ChevronLeft, ChevronRight, X, Search, ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react'
import { addBatch, updateBatch, deleteBatch } from '../actions'

import { Button } from '@/components/ui/button'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Checkbox } from '@/components/ui/checkbox'
import { cn } from '@/lib/utils'

const formSchema = z.object({
  year: z.string().min(4, 'Enter a valid year.').regex(/^\d{4}$/, 'Must be a 4-digit year.'),
  name: z.string().min(2, { message: 'Batch name must be at least 2 characters.' }),
})

type Batch = {
  id: string
  year: number
  name: string
}

export function BatchesManagerClient({ 
  initialBatches 
}: { 
  initialBatches: Batch[] 
}) {
  const router = useRouter()
  const [isOpen, setIsOpen] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [actionId, setActionId] = useState<string | null>(null)
  const [feedback, setFeedback] = useState<{ type: 'error' | 'success', message: string } | null>(null)
  const [confirmDialog, setConfirmDialog] = useState<{ isOpen: boolean; title: string; message: string; onConfirm: () => void; isAlert?: boolean } | null>(null)
  const [currentPage, setCurrentPage] = useState(1)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [isBulkDeleting, setIsBulkDeleting] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [sortConfig, setSortConfig] = useState<{ key: keyof Batch, direction: 'asc' | 'desc' } | null>(null)
  const PAGE_SIZE = 10

  function showAlert(title: string, message: string) {
    setConfirmDialog({ isOpen: true, title, message, onConfirm: () => {}, isAlert: true })
  }
  
  const handleSort = (key: keyof Batch) => {
    setSortConfig(current => {
      if (current && current.key === key) {
        if (current.direction === 'asc') return { key, direction: 'desc' };
        return null;
      }
      return { key, direction: 'asc' };
    })
  }

  const filteredAndSortedBatches = useMemo(() => {
    let result = initialBatches;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(b => 
        b.name.toLowerCase().includes(q) || 
        String(b.year).includes(q)
      );
    }
    if (sortConfig) {
      result = [...result].sort((a, b) => {
        const aVal = String(a[sortConfig.key] || '');
        const bVal = String(b[sortConfig.key] || '');
        return sortConfig.direction === 'asc' 
             ? aVal.localeCompare(bVal, undefined, { numeric: true }) 
             : bVal.localeCompare(aVal, undefined, { numeric: true });
      });
    }
    return result;
  }, [initialBatches, searchQuery, sortConfig])

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      year: String(new Date().getFullYear()),
      name: '',
    },
  })

  function openCreate() {
    setEditingId(null)
    form.reset({ year: String(new Date().getFullYear()), name: '' })
    setFeedback(null)
    setIsOpen(true)
  }

  function openEdit(batch: Batch) {
    setEditingId(batch.id)
    form.reset({ year: String(batch.year), name: batch.name })
    setFeedback(null)
    setIsOpen(true)
  }

  async function onSubmit(values: z.infer<typeof formSchema>) {
    setIsSubmitting(true)
    setFeedback(null)

    try {
      const payload = { year: parseInt(values.year, 10), name: values.name }
      if (editingId) {
        const res = await updateBatch(editingId, payload)
        if (res?.error) throw new Error(res.error)
        setFeedback({ type: 'success', message: 'Batch updated successfully.' })
      } else {
        const res = await addBatch(payload)
        if (res?.error) throw new Error(res.error)
        setFeedback({ type: 'success', message: 'Batch created successfully.' })
      }
      router.refresh()
      setTimeout(() => {
        setIsOpen(false)
        setFeedback(null)
      }, 1500)
    } catch (err: unknown) {
      const error = err as Error
      setFeedback({ type: 'error', message: error.message || 'Error saving batch.' })
    } finally {
      setIsSubmitting(false)
    }
  }

  function handleDelete(id: string) {
    setConfirmDialog({
      isOpen: true,
      title: 'Confirm Deletion',
      message: 'Are you sure you want to delete this batch? All assigned batch admins might be affected.',
      onConfirm: async () => {
        setActionId(id)
        try {
          const res = await deleteBatch(id)
          if (res?.error) {
            showAlert('Action Failed', res.error)
          } else {
            router.refresh()
          }
        } catch (err: unknown) {
          const error = err as Error
          showAlert('Network Error', error.message || 'Error communicating with server.')
        } finally {
          setActionId(null)
        }
      }
    })
  }

  // Pagination
  const totalPages = Math.max(1, Math.ceil(filteredAndSortedBatches.length / PAGE_SIZE))
  const paginatedBatches = filteredAndSortedBatches.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE)
  const pageIds = paginatedBatches.map(b => b.id)
  const allPageSelected = pageIds.length > 0 && pageIds.every(id => selectedIds.has(id))

  const pageIdsRef = useRef<string[]>([])
  pageIdsRef.current = pageIds
  const lastSelectedIdRef = useRef<string | null>(null)
  const isShiftPressedRef = useRef(false)

  useEffect(() => {
    const down = (e: KeyboardEvent) => { if (e.key === 'Shift') isShiftPressedRef.current = true }
    const up = (e: KeyboardEvent) => { if (e.key === 'Shift') isShiftPressedRef.current = false }
    window.addEventListener('keydown', down)
    window.addEventListener('keyup', up)
    return () => { window.removeEventListener('keydown', down); window.removeEventListener('keyup', up) }
  }, [])

  const toggleSelect = useCallback((id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (isShiftPressedRef.current && lastSelectedIdRef.current) {
        const items = pageIdsRef.current
        const startIdx = items.indexOf(lastSelectedIdRef.current)
        const endIdx = items.indexOf(id)
        if (startIdx !== -1 && endIdx !== -1) {
          const [lo, hi] = [Math.min(startIdx, endIdx), Math.max(startIdx, endIdx)]
          const willSelect = !prev.has(id)
          for (let i = lo; i <= hi; i++) { willSelect ? next.add(items[i]) : next.delete(items[i]) }
          lastSelectedIdRef.current = id
          return next
        }
      }
      if (next.has(id)) next.delete(id); else next.add(id)
      lastSelectedIdRef.current = id
      return next
    })
  }, [])
  function toggleSelectAll() {
    if (allPageSelected) {
      setSelectedIds(prev => { const n = new Set(prev); pageIds.forEach(id => n.delete(id)); return n })
    } else {
      setSelectedIds(prev => { const n = new Set(prev); pageIds.forEach(id => n.add(id)); return n })
    }
  }
  function handleBulkDelete() {
    setConfirmDialog({
      isOpen: true,
      title: 'Bulk Delete Batches',
      message: `Delete ${selectedIds.size} selected batch(es)? This may fail if batches have linked alumni.`,
      onConfirm: async () => {
        setIsBulkDeleting(true)
        for (const id of Array.from(selectedIds)) {
          try {
            const res = await deleteBatch(id)
            if (!res?.error) setSelectedIds(prev => { const n = new Set(prev); n.delete(id); return n })
          } catch { /* skip */ }
        }
        setIsBulkDeleting(false)
        router.refresh()
      }
    })
  }

  return (
    <div className="bg-card rounded-xl border shadow-sm w-full mx-auto">
      {selectedIds.size > 0 ? (
        <div className="p-4 px-5 border-b flex items-center gap-3 bg-muted/30">
          <Checkbox checked={allPageSelected} onCheckedChange={toggleSelectAll} />
          <span className="text-sm font-semibold tabular-nums">
            {selectedIds.size} selected
          </span>
          <div className="w-px h-5 bg-border" />
          <Button variant="ghost" size="sm" className="h-8 gap-1.5 text-xs text-destructive hover:text-destructive hover:bg-destructive/10" onClick={handleBulkDelete} disabled={isBulkDeleting}>
            {isBulkDeleting ? <Loader2 className="size-3.5 animate-spin" /> : <Trash2 className="size-3.5" />}
            Delete
          </Button>
          <Button variant="ghost" size="icon" className="ml-auto h-8 w-8 text-muted-foreground hover:text-foreground" onClick={() => setSelectedIds(new Set())}>
            <X className="size-4" />
          </Button>
        </div>
      ) : (
        <div className="p-5 border-b flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-muted/20">
          <h3 className="font-semibold text-lg whitespace-nowrap">Manage Batches</h3>
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full sm:w-auto">
            <div className="relative w-full sm:w-[250px]">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search batches..."
                className="pl-9 h-9 w-full bg-background"
                value={searchQuery}
                onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1); }}
              />
            </div>
            <Button size="sm" className="gap-2 h-9" onClick={openCreate}>
              <Plus className="size-4" /> Create Batch
            </Button>
          </div>
        </div>
      )}

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle>{editingId ? 'Edit Batch' : 'Create New Batch'}</DialogTitle>
              <DialogDescription>
                {editingId ? 'Update graduation year or batch name.' : 'Define a new graduation year and associated batch name.'}
              </DialogDescription>
            </DialogHeader>

            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 pt-4">
                {feedback && (
                  <div className={`p-3 rounded-md flex items-start gap-2 text-sm ${
                    feedback.type === 'error' ? 'bg-destructive/10 text-destructive' : 'bg-green-500/10 text-green-600'
                  }`}>
                    {feedback.type === 'error' ? <AlertCircle className="size-4 mt-0.5" /> : <CheckCircle2 className="size-4 mt-0.5" />}
                    <span>{feedback.message}</span>
                  </div>
                )}

                <FormField
                  control={form.control}
                  name="year"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Graduation Year</FormLabel>
                      <FormControl>
                        <Input type="number" placeholder="2024" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Batch Name</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g. Computer Science" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="pt-2">
                  <Button type="submit" className="w-full" disabled={isSubmitting}>
                    {isSubmitting ? <Loader2 className="size-4 animate-spin mr-2" /> : null}
                    {editingId ? 'Save Changes' : 'Create Batch'}
                  </Button>
                </div>
              </form>
            </Form>
        </DialogContent>
      </Dialog>

      <Table>
        <TableHeader className="bg-muted/30">
          <TableRow>
            <TableHead className="w-[40px]">
              <Checkbox checked={allPageSelected} onCheckedChange={toggleSelectAll} />
            </TableHead>
            <TableHead 
              className={cn(
                "cursor-pointer hover:bg-muted/50 transition-colors select-none",
                sortConfig?.key === 'year' && "text-foreground bg-muted/30"
              )} 
              onClick={() => handleSort('year')}
            >
              <div className="flex items-center gap-1.5">
                Year 
                {sortConfig?.key === 'year' ? (
                  sortConfig.direction === 'asc' ? <ArrowUp className="size-3.5" /> : <ArrowDown className="size-3.5" />
                ) : (
                  <ArrowUpDown className="size-3.5 text-muted-foreground/50" />
                )}
              </div>
            </TableHead>
            <TableHead 
              className={cn(
                "cursor-pointer hover:bg-muted/50 transition-colors select-none",
                sortConfig?.key === 'name' && "text-foreground bg-muted/30"
              )} 
              onClick={() => handleSort('name')}
            >
              <div className="flex items-center gap-1.5">
                Batch Name 
                {sortConfig?.key === 'name' ? (
                  sortConfig.direction === 'asc' ? <ArrowUp className="size-3.5" /> : <ArrowDown className="size-3.5" />
                ) : (
                  <ArrowUpDown className="size-3.5 text-muted-foreground/50" />
                )}
              </div>
            </TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {initialBatches.length === 0 ? (
            <TableRow>
              <TableCell colSpan={4} className="text-center h-32 text-muted-foreground">
                No batches found. Create one.
              </TableCell>
            </TableRow>
          ) : (
            paginatedBatches.map((batch) => (
              <TableRow key={batch.id} className={cn(selectedIds.has(batch.id) && 'bg-primary/5')}>
                <TableCell onMouseDown={(e) => { if (e.shiftKey) e.preventDefault() }}>
                  <Checkbox checked={selectedIds.has(batch.id)} onCheckedChange={() => toggleSelect(batch.id)} />
                </TableCell>
                <TableCell className="font-medium">{batch.year}</TableCell>
                <TableCell>{batch.name}</TableCell>
                <TableCell className="text-right">
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className="text-muted-foreground hover:text-foreground"
                    onClick={() => openEdit(batch)}
                    disabled={actionId === batch.id}
                  >
                    <Edit2 className="size-4" />
                  </Button>
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className="text-destructive hover:bg-destructive/10 ml-1"
                    onClick={() => handleDelete(batch.id)}
                    disabled={actionId === batch.id}
                  >
                    {actionId === batch.id ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      <Trash2 className="size-4" />
                    )}
                  </Button>
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between px-5 py-3 border-t text-sm text-muted-foreground">
          <span>Page {currentPage} of {totalPages} ({filteredAndSortedBatches.length} total)</span>
          <div className="flex items-center gap-1">
            <Button variant="outline" size="icon" className="h-8 w-8" disabled={currentPage <= 1} onClick={() => setCurrentPage(p => p - 1)}>
              <ChevronLeft className="size-4" />
            </Button>
            <Button variant="outline" size="icon" className="h-8 w-8" disabled={currentPage >= totalPages} onClick={() => setCurrentPage(p => p + 1)}>
              <ChevronRight className="size-4" />
            </Button>
          </div>
        </div>
      )}



      {/* Confirm/Alert Dialog */}
      {confirmDialog && (
        <Dialog open={confirmDialog.isOpen} onOpenChange={(open) => !open && setConfirmDialog(null)}>
          <DialogContent className="sm:max-w-[400px]">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                {confirmDialog.isAlert ? <AlertCircle className="size-5 text-destructive" /> : <AlertCircle className="size-5 text-amber-500" />}
                {confirmDialog.title}
              </DialogTitle>
              <DialogDescription className="pt-2">{confirmDialog.message}</DialogDescription>
            </DialogHeader>
            <div className="flex justify-end gap-3 pt-4">
              <Button variant="outline" onClick={() => setConfirmDialog(null)}>
                {confirmDialog.isAlert ? 'Close' : 'Cancel'}
              </Button>
              {!confirmDialog.isAlert && (
                <Button variant="destructive" onClick={() => {
                  confirmDialog.onConfirm()
                  setConfirmDialog(null)
                }}>
                  Confirm
                </Button>
              )}
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  )
}
