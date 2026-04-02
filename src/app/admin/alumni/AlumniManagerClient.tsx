'use client'

import { useState } from 'react'
import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { Loader2, Plus, AlertCircle, CheckCircle2, Trash2, Edit2, ChevronsUpDown, Check, UploadCloud, Star, ChevronLeft, ChevronRight, X, ArrowRightLeft } from 'lucide-react'
import { createClient } from '@/utils/supabase/client'
import { addStudent, updateStudent, deleteStudent } from '../actions'

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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command'
import { Checkbox } from '@/components/ui/checkbox'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { cn } from '@/lib/utils'

const MAX_FILE_SIZE = 5000000
const ACCEPTED_IMAGE_TYPES = ["image/jpeg", "image/jpg", "image/png", "image/webp"]

const formSchema = z.object({
  name: z.string().min(2, { message: 'Name must be at least 2 characters.' }),
  description: z.string().optional(),
  phone_number: z.string().optional(),
  batch_id: z.string().min(1, { message: 'Please select a batch.' }),
  photo: z.any()
    .refine((files) => {
      if (!files || files.length === 0) return true;
      return files[0]?.size <= MAX_FILE_SIZE;
    }, `Max image size is 5MB.`)
    .refine((files) => {
      if (!files || files.length === 0) return true;
      return ACCEPTED_IMAGE_TYPES.includes(files[0]?.type);
    }, "Only .jpg, .jpeg, .png and .webp formats are supported.")
    .optional(),
  is_representative: z.boolean()
})

type Batch = {
  id: string
  year: number
  name: string
}

type Student = {
  id: string
  name: string
  batch_id: string
  phone_number: string | null
  description: string | null
  photo_url: string | null
  is_representative: boolean
}

export function AlumniManagerClient({
  initialStudents,
  batches
}: {
  initialStudents: Student[]
  batches: Batch[]
}) {
  const [isOpen, setIsOpen] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [actionId, setActionId] = useState<string | null>(null)
  const [feedback, setFeedback] = useState<{ type: 'error' | 'success', message: string } | null>(null)
  const [photoRemoved, setPhotoRemoved] = useState(false)
  const [confirmDialog, setConfirmDialog] = useState<{ isOpen: boolean; title: string; message: string; onConfirm: () => void; isAlert?: boolean } | null>(null)
  const [currentPage, setCurrentPage] = useState(1)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [isBulkDeleting, setIsBulkDeleting] = useState(false)
  const [bulkBatchId, setBulkBatchId] = useState('')
  const [isBulkMoving, setIsBulkMoving] = useState(false)
  const PAGE_SIZE = 10

  function showAlert(title: string, message: string) {
    setConfirmDialog({ isOpen: true, title, message, onConfirm: () => { }, isAlert: true })
  }

  const supabase = createClient()

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: '',
      description: '',
      phone_number: '',
      batch_id: '',
      photo: undefined,
      is_representative: false,
    },
  })

  const watchPhoto = form.watch('photo')

  function openCreate() {
    setEditingId(null)
    setPhotoRemoved(false)
    form.reset({ name: '', description: '', phone_number: '', batch_id: '', photo: undefined, is_representative: false })
    setFeedback(null)
    setIsOpen(true)
  }

  function openEdit(student: Student) {
    setEditingId(student.id)
    setPhotoRemoved(false)
    form.reset({
      name: student.name,
      description: student.description || '',
      phone_number: student.phone_number || '',
      batch_id: student.batch_id,
      photo: undefined,
      is_representative: student.is_representative || false,
    })
    setFeedback(null)
    setIsOpen(true)
  }

  async function onSubmit(values: z.infer<typeof formSchema>) {
    setIsSubmitting(true)
    setFeedback(null)
    let photoUrl = editingId ? initialStudents.find(s => s.id === editingId)?.photo_url : undefined

    try {
      if (values.photo && values.photo.length > 0) {
        const file = values.photo[0]
        const fileExt = file.name.split('.').pop()
        const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`

        const { error: uploadError } = await supabase.storage
          .from('alumni-photos')
          .upload(fileName, file, { upsert: false })

        if (uploadError) throw new Error(`Upload Failed: ${uploadError.message}`)

        const { data: publicUrlData } = supabase.storage
          .from('alumni-photos')
          .getPublicUrl(fileName)

        photoUrl = publicUrlData.publicUrl
      }

      const payload = {
        batch_id: values.batch_id,
        name: values.name,
        description: values.description,
        phone_number: values.phone_number,
        photo_url: photoRemoved ? null : (photoUrl ?? undefined),
        is_representative: values.is_representative
      }

      if (editingId) {
        const res = await updateStudent(editingId, payload)
        if (res?.error) throw new Error(res.error)
        setFeedback({ type: 'success', message: 'Alumni profile updated successfully.' })
      } else {
        const res = await addStudent(payload)
        if (res?.error) throw new Error(res.error)
        setFeedback({ type: 'success', message: 'Student created successfully!' })
      }
      setIsOpen(false)
      form.reset()
    } catch (err: unknown) {
      const error = err as Error
      setFeedback({ type: 'error', message: error.message || 'Error creating student.' })
    } finally {
      setIsSubmitting(false)
    }
  }

  function handleDelete(id: string) {
    setConfirmDialog({
      isOpen: true,
      title: 'Confirm Deletion',
      message: 'Are you sure you want to delete this alumni profile forever?',
      onConfirm: async () => {
        setActionId(id)
        try {
          const res = await deleteStudent(id)
          if (res?.error) showAlert('Action Failed', res.error)
        } catch (err: unknown) {
          const error = err as Error
          showAlert('Network Error', error.message || 'Error communicating with server.')
        } finally {
          setActionId(null)
        }
      }
    })
  }

  const getBatchLabel = (id: string) => {
    const b = batches.find(b => b.id === id)
    return b ? `${b.year} — ${b.name}` : 'Unknown'
  }

  // Pagination
  const totalPages = Math.max(1, Math.ceil(initialStudents.length / PAGE_SIZE))
  const paginatedStudents = initialStudents.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE)
  const pageIds = paginatedStudents.map(s => s.id)
  const allPageSelected = pageIds.length > 0 && pageIds.every(id => selectedIds.has(id))

  function toggleSelect(id: string) {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function toggleSelectAll() {
    if (allPageSelected) {
      setSelectedIds(prev => {
        const next = new Set(prev)
        pageIds.forEach(id => next.delete(id))
        return next
      })
    } else {
      setSelectedIds(prev => {
        const next = new Set(prev)
        pageIds.forEach(id => next.add(id))
        return next
      })
    }
  }

  function handleBulkDelete() {
    setConfirmDialog({
      isOpen: true,
      title: 'Bulk Delete',
      message: `Are you sure you want to delete ${selectedIds.size} selected alumni profile(s)? This action is irreversible.`,
      onConfirm: async () => {
        setIsBulkDeleting(true)
        const ids = Array.from(selectedIds)
        for (const id of ids) {
          try {
            const res = await deleteStudent(id)
            if (!res?.error) {
              setSelectedIds(prev => { const n = new Set(prev); n.delete(id); return n })
            }
          } catch { /* skip */ }
        }
        setIsBulkDeleting(false)
        if (currentPage > 1 && paginatedStudents.length <= selectedIds.size) {
          setCurrentPage(p => Math.max(1, p - 1))
        }
      }
    })
  }

  async function handleBulkMoveBatch() {
    if (!bulkBatchId) return
    setIsBulkMoving(true)
    const ids = Array.from(selectedIds)
    for (const id of ids) {
      const student = initialStudents.find(s => s.id === id)
      if (!student) continue
      try {
        await updateStudent(id, {
          name: student.name,
          batch_id: bulkBatchId,
          description: student.description || undefined,
          phone_number: student.phone_number || undefined,
          is_representative: student.is_representative,
          photo_url: student.photo_url || undefined,
        })
      } catch { /* skip */ }
    }
    setSelectedIds(new Set())
    setBulkBatchId('')
    setIsBulkMoving(false)
  }

  const existingPhotoUrl = editingId && !photoRemoved
    ? initialStudents.find(s => s.id === editingId)?.photo_url
    : null;
  const watchPhotoFile = watchPhoto && watchPhoto.length > 0 ? watchPhoto[0] : null;

  // Create object URL only if there's a file, otherwise fallback to existing image URL
  const photoPreviewUrl = watchPhotoFile
    ? URL.createObjectURL(watchPhotoFile)
    : existingPhotoUrl;

  return (
    <div className="bg-card rounded-xl border shadow-sm w-full mx-auto">
      {/* Header: toggles between title and selection bar */}
      {selectedIds.size > 0 ? (
        <div className="p-4 px-5 border-b flex items-center gap-3 bg-muted/30">
          <Checkbox checked={allPageSelected} onCheckedChange={toggleSelectAll} />
          <span className="text-sm font-semibold tabular-nums">
            {selectedIds.size} selected
          </span>
          <div className="w-px h-5 bg-border" />
          <div className="flex items-center gap-1.5">
            <Select value={bulkBatchId} onValueChange={(val) => setBulkBatchId(val || '')}>
              <SelectTrigger className="h-8 w-[180px] text-xs">
                {bulkBatchId
                  ? (() => { const b = batches.find(b => b.id === bulkBatchId); return b ? `${b.year} — ${b.name}` : 'Select' })()
                  : <span className="text-muted-foreground">Move to batch…</span>
                }
              </SelectTrigger>
              <SelectContent>
                {batches.map(b => (
                  <SelectItem key={b.id} value={b.id}>{b.year} — {b.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs" onClick={handleBulkMoveBatch} disabled={!bulkBatchId || isBulkMoving}>
              {isBulkMoving ? <Loader2 className="size-3.5 animate-spin" /> : <ArrowRightLeft className="size-3.5" />}
              Move
            </Button>
          </div>
          <div className="w-px h-5 bg-border" />
          <Button variant="ghost" size="sm" className="h-8 gap-1.5 text-xs text-destructive hover:text-destructive hover:bg-destructive/10" onClick={handleBulkDelete} disabled={isBulkDeleting}>
            {isBulkDeleting ? <Loader2 className="size-3.5 animate-spin" /> : <Trash2 className="size-3.5" />}
            Delete
          </Button>
          <Button variant="ghost" size="icon" className="ml-auto h-8 w-8 text-muted-foreground hover:text-foreground" onClick={() => { setSelectedIds(new Set()); setBulkBatchId('') }}>
            <X className="size-4" />
          </Button>
        </div>
      ) : (
        <div className="p-5 border-b flex justify-between items-center bg-muted/20">
          <h3 className="font-semibold text-lg">Alumni Profiles</h3>
          <div className="flex items-center gap-2">
            <a href="/admin/alumni/import">
              <Button variant="outline" size="sm" className="gap-2">
                <UploadCloud className="size-4" /> Import File
              </Button>
            </a>
            <Button size="sm" className="gap-2" onClick={openCreate}>
              <Plus className="size-4" /> Add Alumni
            </Button>
          </div>
        </div>
      )}

      {/* Dialog rendered outside header so it's always accessible */}
      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="sm:max-w-[600px] h-[90vh] sm:h-auto overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editingId ? 'Edit Alumni Profile' : 'Add Alumni Profile'}</DialogTitle>
              <DialogDescription>
                {editingId ? 'Update the details for this alumni.' : 'Create a new alumni profile in the directory.'}
              </DialogDescription>
            </DialogHeader>

            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5 pt-2">
                {feedback && (
                  <div className={`p-4 rounded-lg flex items-start gap-3 text-sm ${feedback.type === 'error'
                      ? 'bg-destructive/10 border border-destructive/20 text-destructive'
                      : 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-400'
                    }`}>
                    {feedback.type === 'error' ? <AlertCircle className="size-4 shrink-0 mt-0.5" /> : <CheckCircle2 className="size-4 shrink-0 mt-0.5" />}
                    <span>{feedback.message}</span>
                  </div>
                )}

                <div className="grid md:grid-cols-2 gap-x-6 gap-y-4">
                  <FormField
                    control={form.control}
                    name="batch_id"
                    render={({ field }) => (
                      <FormItem className="md:col-span-2 flex flex-col pt-1">
                        <FormLabel className="uppercase tracking-wider text-[11px] font-bold text-muted-foreground">Target Batch / Class</FormLabel>
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
                              ? getBatchLabel(field.value)
                              : "Search & select batch..."}
                            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                          </PopoverTrigger>
                          <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                            <Command>
                              <CommandInput placeholder="Search batches..." />
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

                  <FormField
                    control={form.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="uppercase tracking-wider text-[11px] font-bold text-muted-foreground">Full Name</FormLabel>
                        <FormControl>
                          <Input placeholder="E.g. Jonathan Doe" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="phone_number"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="uppercase tracking-wider text-[11px] font-bold text-muted-foreground">Contact Number</FormLabel>
                        <FormControl>
                          <Input placeholder="+91 12345 67890" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="description"
                    render={({ field }) => (
                      <FormItem className="md:col-span-2">
                        <FormLabel className="uppercase tracking-wider text-[11px] font-bold text-muted-foreground">Professional Bio (Optional)</FormLabel>
                        <FormControl>
                          <textarea
                            {...field}
                            placeholder="Describe career achievements, current status..."
                            className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm max-h-[100px] min-h-[80px] focus:outline-none focus:ring-2 focus:ring-ring"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="is_representative"
                    render={({ field }) => (
                      <FormItem className="md:col-span-2 flex flex-row items-center justify-between rounded-lg border border-input bg-card p-4 shadow-sm">
                        <div className="space-y-0.5">
                          <FormLabel className="text-sm font-bold text-foreground flex items-center gap-2">
                            <Star className="w-4 h-4 text-[#d4af37]" /> Batch Representative
                          </FormLabel>
                          <DialogDescription className="text-xs">
                            Assign this alumni as a representative for their graduating batch.
                          </DialogDescription>
                        </div>
                        <FormControl>
                          <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                        </FormControl>
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="photo"
                    render={({ field }) => (
                      <FormItem className="md:col-span-2">
                        <FormLabel className="uppercase tracking-wider text-[11px] font-bold text-muted-foreground">
                          {editingId ? 'Update Profile Photo (Optional)' : 'Profile Photo'}
                        </FormLabel>
                        <FormControl>
                          <div className="relative group overflow-hidden rounded-md border-2 border-dashed border-input bg-background hover:border-primary/50 transition-colors h-32 flex items-center justify-center">
                            <Input
                              type="file"
                              accept="image/*"
                              className="absolute inset-0 w-full h-full opacity-0 z-10 cursor-pointer"
                              onChange={(e) => {
                                field.onChange(e.target.files)
                                setPhotoRemoved(false)
                              }}
                            />
                            {photoPreviewUrl ? (
                              <>
                                <img src={photoPreviewUrl} alt="Preview" className="w-full h-full object-cover opacity-80 group-hover:opacity-50 transition-opacity" />
                                <div className="absolute inset-0 flex flex-col items-center justify-center text-white opacity-0 group-hover:opacity-100 transition-opacity z-20 pointer-events-none *:drop-shadow-md pb-2">
                                  <UploadCloud className="size-6 mb-1" />
                                  <span className="text-xs font-bold leading-tight">Click to change</span>
                                </div>
                              </>
                            ) : (
                              <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
                                {isSubmitting ? (
                                  <>
                                    <Loader2 className="size-5 text-muted-foreground mb-1 animate-spin" />
                                    <p className="text-xs font-medium text-muted-foreground">Uploading image...</p>
                                  </>
                                ) : (
                                  <>
                                    <UploadCloud className="size-5 text-muted-foreground mb-1 group-hover:text-primary transition-colors" />
                                    <p className="text-xs font-bold group-hover:text-primary transition-colors line-clamp-1 px-4">
                                      {watchPhotoFile
                                        ? watchPhotoFile.name
                                        : 'Click to upload photo'}
                                    </p>
                                    <p className="text-[10px] text-muted-foreground mt-0.5">JPEG/WEBP (Max 5MB)</p>
                                  </>
                                )}
                              </div>
                            )}
                            {photoPreviewUrl && (
                              <Button
                                type="button"
                                variant="destructive"
                                size="sm"
                                className="absolute top-2 right-2 z-30 h-7 text-[10px] px-2 shadow-sm"
                                onClick={(e) => {
                                  e.preventDefault()
                                  e.stopPropagation()
                                  form.setValue('photo', undefined)
                                  setPhotoRemoved(true)
                                }}
                              >
                                <Trash2 className="size-3 mr-1" /> Remove
                              </Button>
                            )}
                          </div>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="pt-2">
                  <Button type="submit" className="w-full" disabled={isSubmitting}>
                    {isSubmitting ? <Loader2 className="size-4 animate-spin mr-2" /> : null}
                    {editingId ? 'Save Changes' : 'Create Profile'}
                  </Button>
                </div>
              </form>
            </Form>
        </DialogContent>
      </Dialog>

      <div className="overflow-x-auto">
        <Table>
          <TableHeader className="bg-muted/30">
            <TableRow>
              <TableHead className="w-[40px]">
                <Checkbox checked={allPageSelected} onCheckedChange={toggleSelectAll} />
              </TableHead>
              <TableHead>Alumni Name</TableHead>
              <TableHead>Batch</TableHead>
              <TableHead>Contact</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {initialStudents.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center h-32 text-muted-foreground">
                  No alumni found in the system.
                </TableCell>
              </TableRow>
            ) : (
              paginatedStudents.map((student) => (
                <TableRow key={student.id} className={cn(selectedIds.has(student.id) && 'bg-primary/5')}>
                  <TableCell>
                    <Checkbox checked={selectedIds.has(student.id)} onCheckedChange={() => toggleSelect(student.id)} />
                  </TableCell>
                  <TableCell className="font-medium whitespace-nowrap">
                    <div className="flex items-center gap-2">
                      {student.name}
                      {student.is_representative && (
                        <span className="bg-[#d4af37]/10 text-[#d4af37] border border-[#d4af37]/20 text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-widest shrink-0">
                          Rep
                        </span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    {getBatchLabel(student.batch_id)}
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm">
                    {student.phone_number || '-'}
                  </TableCell>
                  <TableCell className="text-right whitespace-nowrap">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-muted-foreground hover:text-foreground"
                      onClick={() => openEdit(student)}
                      disabled={actionId === student.id}
                    >
                      <Edit2 className="size-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-destructive hover:bg-destructive/10 ml-1"
                      onClick={() => handleDelete(student.id)}
                      disabled={actionId === student.id}
                    >
                      {actionId === student.id ? (
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
          <span>Page {currentPage} of {totalPages} ({initialStudents.length} total)</span>
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
