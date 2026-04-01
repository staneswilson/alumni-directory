'use client'

import { useState } from 'react'
import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { Loader2, AlertCircle, CheckCircle2, UploadCloud } from 'lucide-react'
import { createClient } from '@/utils/supabase/client'

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
import { addStudent } from '@/app/admin/actions'

const MAX_FILE_SIZE = 5000000
const ACCEPTED_IMAGE_TYPES = ["image/jpeg", "image/jpg", "image/png", "image/webp"]

const formSchema = z.object({
  name: z.string().min(2, { message: 'Name must be at least 2 characters.' }),
  description: z.string().optional(),
  phone_number: z.string().optional(),
  batch_id: z.string().min(1, { message: 'Please select a batch.' }),
  photo: z.any()
    .refine((files) => files?.length == 1 ? files[0]?.size <= MAX_FILE_SIZE : true, `Max image size is 5MB.`)
    .refine(
      (files) => files?.length == 1 ? ACCEPTED_IMAGE_TYPES.includes(files[0]?.type) : true,
      "Only .jpg, .jpeg, .png and .webp formats are supported."
    ).optional()
})

type Batch = {
  id: string
  year: number
  name: string
}

export default function AddStudentForm({ batches }: { batches: Batch[] }) {
  const [isUploading, setIsUploading] = useState(false)
  const [feedback, setFeedback] = useState<{ type: 'error' | 'success', message: string } | null>(null)
  const supabase = createClient()

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: '',
      description: '',
      phone_number: '',
      batch_id: '',
      photo: undefined,
    },
  })

  async function onSubmit(values: z.infer<typeof formSchema>) {
    setIsUploading(true)
    setFeedback(null)
    let photoUrl = ''

    try {
      if (values.photo && values.photo.length > 0) {
        const file = values.photo[0]
        const fileExt = file.name.split('.').pop()
        const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`

        const { error: uploadError } = await supabase.storage
          .from('alumni-photos')
          .upload(fileName, file, { upsert: false })

        if (uploadError) {
          throw new Error(`Upload Failed: ${uploadError.message}`)
        }

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
        photo_url: photoUrl ? photoUrl : undefined
      }

      const res = await addStudent(payload)
      if (res?.error) {
        throw new Error(res.error)
      }

      setFeedback({ type: 'success', message: 'Alumni profile has been saved successfully.' })
      form.reset()

    } catch (err: unknown) {
      const error = err as Error
      setFeedback({ type: 'error', message: error.message || 'An unexpected error occurred.' })
    } finally {
      setIsUploading(false)
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 w-full">

        {/* Feedback banner */}
        {feedback && (
          <div
            className={`p-4 rounded-lg flex items-start gap-3 text-sm ${feedback.type === 'error'
                ? 'bg-destructive/10 border border-destructive/20 text-destructive'
                : 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-400'
              }`}
          >
            {feedback.type === 'error' ? (
              <AlertCircle className="size-4 shrink-0 mt-0.5" />
            ) : (
              <CheckCircle2 className="size-4 shrink-0 mt-0.5" />
            )}
            <div className="flex flex-col">
              <span className="font-semibold">
                {feedback.type === 'error' ? 'Error' : 'Success'}
              </span>
              <span className="text-muted-foreground">{feedback.message}</span>
            </div>
          </div>
        )}

        <div className="grid md:grid-cols-2 gap-x-6 gap-y-5">
          {/* Batch Select */}
          <FormField
            control={form.control}
            name="batch_id"
            render={({ field }) => (
              <FormItem className="md:col-span-2">
                <FormLabel className="uppercase tracking-wider text-xs font-semibold text-muted-foreground">Target Batch / Class</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value}>
                  <FormControl>
                    <SelectTrigger className="h-11 bg-background/50 text-sm">
                      <SelectValue placeholder="Select graduation batch..." />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {batches.map((b) => (
                      <SelectItem key={b.id} value={b.id} className="cursor-pointer">
                        {b.year} — {b.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Full Name */}
          <FormField
            control={form.control}
            name="name"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="uppercase tracking-wider text-xs font-semibold text-muted-foreground">Full Name</FormLabel>
                <FormControl>
                  <Input placeholder="E.g. Jonathan Doe" className="h-11 bg-background/50" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Phone Number */}
          <FormField
            control={form.control}
            name="phone_number"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="uppercase tracking-wider text-xs font-semibold text-muted-foreground">Contact Number</FormLabel>
                <FormControl>
                  <Input placeholder="+91 12345 67890" className="h-11 bg-background/50" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Bio */}
          <FormField
            control={form.control}
            name="description"
            render={({ field }) => (
              <FormItem className="md:col-span-2">
                <FormLabel className="uppercase tracking-wider text-xs font-semibold text-muted-foreground">Professional Biography</FormLabel>
                <FormControl>
                  <textarea
                    {...field}
                    placeholder="Describe career achievements, current location, or status..."
                    className="flex w-full rounded-lg border border-input bg-background/50 px-3 py-3 text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent min-h-[120px] resize-y placeholder:text-muted-foreground"
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Photo Upload */}
          <FormField
            control={form.control}
            name="photo"
            render={({ field }) => (
              <FormItem className="md:col-span-2">
                <FormLabel className="uppercase tracking-wider text-xs font-semibold text-muted-foreground">Profile Photo</FormLabel>
                <FormControl>
                  <div className="relative group cursor-pointer overflow-hidden rounded-lg border-2 border-dashed border-input bg-background/30 hover:bg-background/50 hover:border-primary/50 transition-colors">
                    <Input
                      type="file"
                      accept="image/*"
                      className="absolute inset-0 w-full h-full opacity-0 z-10 cursor-pointer"
                      onChange={(e) => field.onChange(e.target.files)}
                    />
                    <div className="pointer-events-none p-8 flex flex-col items-center justify-center text-center">
                      <UploadCloud className="size-8 text-muted-foreground mb-3 group-hover:text-primary transition-colors" />
                      <p className="text-sm font-medium group-hover:text-primary transition-colors">Click to upload</p>
                      <p className="text-xs text-muted-foreground mt-1">JPEG, PNG or WEBP (Max 5MB)</p>
                    </div>
                  </div>
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        {/* Submit */}
        <div className="pt-4 border-t border-border/50">
          <Button
            type="submit"
            disabled={isUploading || batches.length === 0}
            className="w-full h-11 mt-2"
          >
            {isUploading ? (
              <span className="flex items-center gap-2">
                <Loader2 className="size-4 animate-spin" />
                Saving Profile...
              </span>
            ) : (
              'Save Alumni Profile'
            )}
          </Button>
          {batches.length === 0 && (
            <p className="text-center text-destructive text-xs font-medium mt-3">
              No batches available. Create a batch first.
            </p>
          )}
        </div>
      </form>
    </Form>
  )
}
