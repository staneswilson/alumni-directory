'use client'

import { useState, useMemo, useRef, useEffect, useCallback } from 'react'
import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { Loader2, Plus, AlertCircle, CheckCircle2, Trash2, ChevronsUpDown, Check, ChevronLeft, ChevronRight, X, Search, ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react'
import { createAdminUser, deleteAdminRole } from '../actions'

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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command'
import { cn } from '@/lib/utils'

const formSchema = z.object({
  email: z.string().email({ message: 'Valid email is required.' }),
  password: z.string().min(6, { message: 'Password must be at least 6 characters.' }),
  role: z.enum(['super_admin', 'batch_admin']),
  batch_id: z.string().optional(),
}).refine((data) => {
  if (data.role === 'batch_admin' && (!data.batch_id || data.batch_id === '')) {
    return false
  }
  return true
}, {
  message: 'Batch is required for Batch Admins',
  path: ['batch_id']
})

type AdminRole = {
  id: string
  user_id: string
  role: string
  batch_id: string | null
  email?: string
}

type Batch = {
  id: string
  year: number
  name: string
}

export function UserManagementClient({ 
  initialAdmins, 
  batches,
  currentUserId
}: { 
  initialAdmins: AdminRole[]
  batches: Batch[]
  currentUserId: string
}) {
  const [isOpen, setIsOpen] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [feedback, setFeedback] = useState<{ type: 'error' | 'success', message: string } | null>(null)
  const [confirmDialog, setConfirmDialog] = useState<{ isOpen: boolean; title: string; message: string; onConfirm: () => void; isAlert?: boolean } | null>(null)
  const [currentPage, setCurrentPage] = useState(1)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [isBulkDeleting, setIsBulkDeleting] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [sortConfig, setSortConfig] = useState<{ key: keyof AdminRole | 'batch_name', direction: 'asc' | 'desc' } | null>(null)
  const PAGE_SIZE = 10

  function showAlert(title: string, message: string) {
    setConfirmDialog({ isOpen: true, title, message, onConfirm: () => {}, isAlert: true })
  }
  
  const handleSort = (key: keyof AdminRole | 'batch_name') => {
    setSortConfig(current => {
      if (current && current.key === key) {
        if (current.direction === 'asc') return { key, direction: 'desc' };
        return null;
      }
      return { key, direction: 'asc' };
    })
  }

  const getBatchName = (id: string | null) => {
    if (!id) return 'Super Access'
    const b = batches.find(b => b.id === id)
    return b ? `${b.year} — ${b.name}` : 'Unknown Batch'
  }

  const filteredAndSortedAdmins = useMemo(() => {
    let result = initialAdmins;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(a => 
        (a.email && a.email.toLowerCase().includes(q)) || 
        a.role.toLowerCase().includes(q) ||
        getBatchName(a.batch_id).toLowerCase().includes(q)
      );
    }
    if (sortConfig) {
      result = [...result].sort((a, b) => {
        if (sortConfig.key === 'batch_name') {
           const aVal = getBatchName(a.batch_id).toLowerCase()
           const bVal = getBatchName(b.batch_id).toLowerCase()
           return sortConfig.direction === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal)
        }
        const aVal = String(a[sortConfig.key] || '').toLowerCase();
        const bVal = String(b[sortConfig.key] || '').toLowerCase();
        return sortConfig.direction === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
      });
    }
    return result;
  }, [initialAdmins, searchQuery, sortConfig, batches])

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      email: '',
      password: '',
      role: 'batch_admin',
      batch_id: '',
    },
  })

  const watchRole = form.watch('role')

  async function onSubmit(values: z.infer<typeof formSchema>) {
    setIsSubmitting(true)
    setFeedback(null)

    try {
      const res = await createAdminUser({
        email: values.email,
        password: values.password,
        role: values.role,
        batch_id: values.role === 'batch_admin' ? values.batch_id : undefined,
      })
      if (res?.error) throw new Error(res.error)

      setFeedback({ type: 'success', message: 'User created & role assigned successfully.' })
      form.reset()
      setTimeout(() => {
        setIsOpen(false)
        setFeedback(null)
      }, 1500)
    } catch (err: unknown) {
      const error = err as Error
      setFeedback({ type: 'error', message: error.message || 'Error assigning role.' })
    } finally {
      setIsSubmitting(false)
    }
  }

  function handleDelete(id: string) {
    setConfirmDialog({
      isOpen: true,
      title: 'Revoke Admin Role',
      message: 'Are you sure you want to revoke this admin role? They will lose access to the system immediately.',
      onConfirm: async () => {
        setDeletingId(id)
        try {
          const res = await deleteAdminRole(id)
          if (res?.error) showAlert('Action Failed', res.error)
        } catch (err: unknown) {
          const error = err as Error
          showAlert('Network Error', error.message || 'Error communicating with server.')
        } finally {
          setDeletingId(null)
        }
      }
    })
  }

  // Removed getBatchName definition here because it was hoisted up

  // Pagination
  const totalPages = Math.max(1, Math.ceil(filteredAndSortedAdmins.length / PAGE_SIZE))
  const paginatedAdmins = filteredAndSortedAdmins.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE)
  const pageIds = paginatedAdmins.filter(a => a.user_id !== currentUserId).map(a => a.id)
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
  function handleBulkRevoke() {
    setConfirmDialog({
      isOpen: true,
      title: 'Bulk Revoke Roles',
      message: `Revoke admin access for ${selectedIds.size} selected user(s)?`,
      onConfirm: async () => {
        setIsBulkDeleting(true)
        for (const id of Array.from(selectedIds)) {
          try {
            const res = await deleteAdminRole(id)
            if (!res?.error) setSelectedIds(prev => { const n = new Set(prev); n.delete(id); return n })
          } catch { /* skip */ }
        }
        setIsBulkDeleting(false)
      }
    })
  }

  return (
    <div className="bg-card rounded-xl border shadow-sm w-full mx-auto">
      <div className="p-5 border-b flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-muted/20">
        <h3 className="font-semibold text-lg whitespace-nowrap">System Administrators</h3>
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full sm:w-auto">
            <div className="relative w-full sm:w-[250px]">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search admins..."
                className="pl-9 h-9 w-full bg-background"
                value={searchQuery}
                onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1); }}
              />
            </div>
          <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogTrigger render={<Button size="sm" className="gap-2 h-9" />}>
                <Plus className="size-4" /> Add Admin
            </DialogTrigger>
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle>Add New Administrator</DialogTitle>
              <DialogDescription>
                Create a new user to manage the Alumni Directory.
              </DialogDescription>
            </DialogHeader>

            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 pt-2">
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
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email Address</FormLabel>
                      <FormControl>
                        <Input type="email" placeholder="admin@example.com" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="password"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Password</FormLabel>
                      <FormControl>
                        <Input type="password" placeholder="Secure password" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="role"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Access Level</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select a role..." />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="batch_admin">Batch Admin (Limited)</SelectItem>
                          <SelectItem value="super_admin">Super Admin (Full Access)</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {watchRole === 'batch_admin' && (
                  <FormField
                    control={form.control}
                    name="batch_id"
                    render={({ field }) => (
                      <FormItem className="flex flex-col pt-1">
                        <FormLabel>Assigned Batch</FormLabel>
                        <Popover>
                          <PopoverTrigger 
                            render={
                              <Button
                                variant="outline"
                                role="combobox"
                                className={cn(
                                  "w-full justify-between font-normal",
                                  !field.value && "text-muted-foreground"
                                )}
                              />
                            }
                          >
                            {field.value
                              ? getBatchName(field.value)
                              : "Search generic batches..."}
                            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                          </PopoverTrigger>
                          <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                            <Command>
                              <CommandInput placeholder="Search batch years/names..." />
                              <CommandList>
                                <CommandEmpty>No batch found.</CommandEmpty>
                                <CommandGroup>
                                  {batches.map((b) => (
                                    <CommandItem
                                      value={`${b.year} ${b.name} ${b.id}`}
                                      key={b.id}
                                      onSelect={() => {
                                        form.setValue("batch_id", b.id)
                                      }}
                                    >
                                      <Check
                                        className={cn(
                                          "mr-2 h-4 w-4",
                                          b.id === field.value ? "opacity-100" : "opacity-0"
                                        )}
                                      />
                                      {b.year} — {b.name}
                                    </CommandItem>
                                  ))}
                                </CommandGroup>
                              </CommandList>
                            </Command>
                          </PopoverContent>
                        </Popover>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}

                <div className="pt-2">
                  <Button type="submit" className="w-full" disabled={isSubmitting}>
                    {isSubmitting ? <Loader2 className="size-4 animate-spin mr-2" /> : null}
                    Confirm & Add
                  </Button>
                </div>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>
      </div>
      
      {/* Bulk Action Bar */}
      {selectedIds.size > 0 && (
        <div className="bg-zinc-900 dark:bg-zinc-800 text-white rounded-xl px-5 py-3 flex items-center gap-4 shadow-lg">
          <div className="flex items-center gap-2.5 shrink-0">
            <div className="size-7 rounded-md bg-white/15 flex items-center justify-center text-xs font-bold tabular-nums">
              {selectedIds.size}
            </div>
            <span className="text-sm font-medium text-zinc-300">
              {selectedIds.size === 1 ? 'admin' : 'admins'} selected
            </span>
          </div>

          <div className="w-px h-6 bg-zinc-700 shrink-0" />

          <Button
            size="sm"
            className="h-8 bg-red-500/90 hover:bg-red-500 text-white border-0 gap-1.5 text-xs transition-colors"
            onClick={handleBulkRevoke}
            disabled={isBulkDeleting}
          >
            {isBulkDeleting ? <Loader2 className="size-3.5 animate-spin" /> : <Trash2 className="size-3.5" />}
            Revoke Access
          </Button>

          <button
            className="ml-auto size-7 rounded-md flex items-center justify-center text-zinc-400 hover:text-white hover:bg-white/10 transition-colors"
            onClick={() => setSelectedIds(new Set())}
          >
            <X className="size-4" />
          </button>
        </div>
      )}

      <div className="overflow-x-auto">
        <Table>
          <TableHeader className="bg-muted/30">
            <TableRow>
              <TableHead className="w-[40px]">
                <Checkbox checked={allPageSelected} onCheckedChange={toggleSelectAll} />
              </TableHead>
              <TableHead 
                className={cn(
                  "w-[300px] cursor-pointer hover:bg-muted/50 transition-colors select-none",
                  sortConfig?.key === 'email' && "text-foreground bg-muted/30"
                )} 
                onClick={() => handleSort('email')}
              >
                <div className="flex items-center gap-1.5">
                  User Account 
                  {sortConfig?.key === 'email' ? (
                    sortConfig.direction === 'asc' ? <ArrowUp className="size-3.5" /> : <ArrowDown className="size-3.5" />
                  ) : (
                    <ArrowUpDown className="size-3.5 text-muted-foreground/50" />
                  )}
                </div>
              </TableHead>
              <TableHead 
                className={cn(
                  "cursor-pointer hover:bg-muted/50 transition-colors select-none",
                  sortConfig?.key === 'role' && "text-foreground bg-muted/30"
                )} 
                onClick={() => handleSort('role')}
              >
                <div className="flex items-center gap-1.5">
                  System Role 
                  {sortConfig?.key === 'role' ? (
                    sortConfig.direction === 'asc' ? <ArrowUp className="size-3.5" /> : <ArrowDown className="size-3.5" />
                  ) : (
                    <ArrowUpDown className="size-3.5 text-muted-foreground/50" />
                  )}
                </div>
              </TableHead>
              <TableHead 
                className={cn(
                  "cursor-pointer hover:bg-muted/50 transition-colors select-none",
                  sortConfig?.key === 'batch_name' && "text-foreground bg-muted/30"
                )} 
                onClick={() => handleSort('batch_name')}
              >
                <div className="flex items-center gap-1.5">
                  Assignment 
                  {sortConfig?.key === 'batch_name' ? (
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
            {initialAdmins.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center h-32 text-muted-foreground">
                  No administrators found in the system.
                </TableCell>
              </TableRow>
            ) : (
              paginatedAdmins.map((admin) => (
                <TableRow key={admin.id} className={cn(selectedIds.has(admin.id) && 'bg-primary/5')}>
                  <TableCell onMouseDown={(e) => { if (e.shiftKey) e.preventDefault() }}>
                    <Checkbox 
                      checked={selectedIds.has(admin.id)} 
                      onCheckedChange={() => toggleSelect(admin.id)} 
                      disabled={admin.user_id === currentUserId}
                    />
                  </TableCell>
                  <TableCell className="font-mono text-xs text-muted-foreground truncate max-w-[280px]">
                    {admin.email || admin.user_id}
                  </TableCell>
                  <TableCell>
                    <Badge variant={admin.role === 'super_admin' ? 'default' : 'secondary'} className="capitalize">
                      {admin.role.replace('_', ' ')}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm font-medium">
                    {getBatchName(admin.batch_id)}
                  </TableCell>
                  <TableCell className="text-right pr-4">
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      className="text-destructive hover:bg-destructive/10"
                      onClick={() => handleDelete(admin.id)}
                      disabled={deletingId === admin.id || admin.user_id === currentUserId}
                      title={admin.user_id === currentUserId ? "You cannot remove your own administrative role." : "Revoke role"}
                    >
                      {deletingId === admin.id ? (
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
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between px-5 py-3 border-t text-sm text-muted-foreground">
          <span>Page {currentPage} of {totalPages} ({filteredAndSortedAdmins.length} total)</span>
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
