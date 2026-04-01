'use client'

import { useState } from 'react'
import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { Loader2, Plus, AlertCircle, CheckCircle2, Trash2, Edit2 } from 'lucide-react'
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
  const [isOpen, setIsOpen] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [actionId, setActionId] = useState<string | null>(null)
  const [feedback, setFeedback] = useState<{ type: 'error' | 'success', message: string } | null>(null)
  const [confirmDialog, setConfirmDialog] = useState<{ isOpen: boolean; title: string; message: string; onConfirm: () => void; isAlert?: boolean } | null>(null)

  function showAlert(title: string, message: string) {
    setConfirmDialog({ isOpen: true, title, message, onConfirm: () => {}, isAlert: true })
  }

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

  return (
    <div className="bg-card rounded-xl border shadow-sm w-full mx-auto">
      <div className="p-5 border-b flex justify-between items-center bg-muted/20">
        <h3 className="font-semibold text-lg">Manage Batches</h3>
        <Button size="sm" className="gap-2" onClick={openCreate}>
          <Plus className="size-4" /> Create Batch
        </Button>

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
      </div>

      <Table>
        <TableHeader className="bg-muted/30">
          <TableRow>
            <TableHead>Year</TableHead>
            <TableHead>Batch Name</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {initialBatches.length === 0 ? (
            <TableRow>
              <TableCell colSpan={3} className="text-center h-32 text-muted-foreground">
                No batches found. Create one.
              </TableCell>
            </TableRow>
          ) : (
            initialBatches.map((batch) => (
              <TableRow key={batch.id}>
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
