'use client'

import { useState } from 'react'
import Papa from 'papaparse'
import * as XLSX from 'xlsx'
import { UploadCloud, CheckCircle2, AlertCircle, Loader2, ArrowLeft, Image as ImageIcon, Trash2, FileDown, Info } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/utils/supabase/client'
import { addStudent } from '../../actions'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { cn } from '@/lib/utils'

type Batch = {
  id: string
  year: number
  name: string
}

type DraftStudent = {
  id: string
  name: string
  phone_number: string
  description: string
  batch_id: string
  is_representative: boolean
  photo_file?: File | null
  photo_preview?: string | null
  status: 'pending' | 'uploading' | 'processing' | 'inserted' | 'error'
  error_message?: string
}

export default function AlumniImportClient({ batches }: { batches: Batch[] }) {
  const router = useRouter()
  const [drafts, setDrafts] = useState<DraftStudent[]>([])
  const [globalBatchId, setGlobalBatchId] = useState<string>('')
  const [isProcessing, setIsProcessing] = useState(false)
  const [isDragging, setIsDragging] = useState(false)

  const supabase = createClient()

  const rowsToDrafts = (rows: Array<Record<string, string>>): DraftStudent[] => {
    return rows
      .filter(row => {
        // Skip completely empty rows
        const values = Object.values(row)
        return values.some(v => v && String(v).trim() !== '')
      })
      .map((row, index) => {
        const name = row['Name'] || row['Full Name'] || row['name'] || row['Student Name'] || ''
        const phone = row['Phone'] || row['Phone Number'] || row['Contact'] || row['phone_number'] || row['Mobile'] || ''
        const description = row['Description'] || row['Bio'] || row['description'] || row['About'] || ''

        return {
          id: `draft-${Date.now()}-${index}`,
          name: String(name).trim(),
          phone_number: String(phone).trim(),
          description: String(description).trim(),
          batch_id: '',
          is_representative: false,
          photo_file: null,
          photo_preview: null,
          status: 'pending' as const
        }
      })
  }

  const handleFileUpload = (file: File) => {
    const ext = file.name.split('.').pop()?.toLowerCase()

    if (ext === 'csv') {
      // CSV → PapaParse
      Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        complete: (results: Papa.ParseResult<unknown>) => {
          const data = results.data as Array<Record<string, string>>
          setDrafts(rowsToDrafts(data))
        },
        error: (error: Error) => {
          console.error('Error parsing CSV:', error)
          alert('Failed to parse CSV file. Ensure it is properly formatted.')
        }
      })
    } else if (ext === 'xlsx' || ext === 'xls') {
      // Excel → xlsx library
      const reader = new FileReader()
      reader.onload = (e) => {
        try {
          const data = new Uint8Array(e.target?.result as ArrayBuffer)
          const workbook = XLSX.read(data, { type: 'array' })
          const firstSheet = workbook.Sheets[workbook.SheetNames[0]]
          const rows = XLSX.utils.sheet_to_json<Record<string, string>>(firstSheet, { defval: '' })
          setDrafts(rowsToDrafts(rows))
        } catch (err) {
          console.error('Error parsing Excel:', err)
          alert('Failed to parse Excel file. Ensure the first sheet has a header row.')
        }
      }
      reader.readAsArrayBuffer(file)
    } else {
      alert('Unsupported file type. Please upload a .csv, .xlsx, or .xls file.')
    }
  }

  const updateDraft = (id: string, updates: Partial<DraftStudent>) => {
    setDrafts(prev => prev.map(d => d.id === id ? { ...d, ...updates } : d))
  }

  const handleApplyGlobalBatch = () => {
    if (!globalBatchId) return
    setDrafts(prev => prev.map(d => ({ ...d, batch_id: globalBatchId })))
  }

  const handleRemoveDraft = (id: string) => {
    setDrafts(prev => prev.filter(d => d.id !== id))
  }

  const processImport = async () => {
    setIsProcessing(true)
    let hasErrors = false

    const draftsToProcess = [...drafts]

    for (let i = 0; i < draftsToProcess.length; i++) {
      const draft = draftsToProcess[i]

      // Skip already inserted
      if (draft.status === 'inserted') continue

      // Validation
      if (!draft.name?.trim()) {
        updateDraft(draft.id, { status: 'error', error_message: 'Name is required' })
        hasErrors = true
        continue
      }
      if (!draft.batch_id) {
        updateDraft(draft.id, { status: 'error', error_message: 'Batch is required' })
        hasErrors = true
        continue
      }

      updateDraft(draft.id, { status: 'uploading' })

      try {
        let photoUrl: string | undefined = undefined

        if (draft.photo_file) {
          const fileExt = draft.photo_file.name.split('.').pop()
          const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`

          const { error: uploadError } = await supabase.storage
            .from('alumni-photos')
            .upload(fileName, draft.photo_file, { upsert: false })

          if (uploadError) throw new Error(`Image Upload Failed: ${uploadError.message}`)

          const { data: publicUrlData } = supabase.storage
            .from('alumni-photos')
            .getPublicUrl(fileName)

          photoUrl = publicUrlData.publicUrl
        }

        updateDraft(draft.id, { status: 'processing' })

        const res = await addStudent({
          name: draft.name,
          phone_number: draft.phone_number,
          description: draft.description,
          batch_id: draft.batch_id,
          is_representative: draft.is_representative,
          photo_url: photoUrl
        })

        if (res?.error) {
          throw new Error(res.error)
        }

        updateDraft(draft.id, { status: 'inserted', error_message: '' })
      } catch (err: unknown) {
        const error = err as Error
        updateDraft(draft.id, { status: 'error', error_message: error.message || 'Unknown error' })
        hasErrors = true
      }
    }

    setIsProcessing(false)
    if (!hasErrors) {
      setTimeout(() => {
        router.push('/admin/alumni')
      }, 1500)
    }
  }

  if (drafts.length === 0) {
    return (
      <div className="space-y-6">
        {/* Import Guide & Template Downloads */}
        <div className="bg-card border rounded-xl shadow-sm overflow-hidden animate-in fade-in slide-in-from-top-4 duration-500">
          {/* Guidelines Section */}
          <div className="p-6 pb-5">
            <div className="flex items-center gap-2.5 mb-4">
              <div className="size-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                <Info className="size-4 text-primary" />
              </div>
              <div>
                <h4 className="font-bold text-sm">Import Guidelines</h4>
                <p className="text-[11px] text-muted-foreground leading-tight">Ensure your spreadsheet follows these formatting rules</p>
              </div>
            </div>
            <p className="text-sm text-muted-foreground leading-relaxed mb-5">
              Your file should contain a <strong className="text-foreground">header row</strong> with column names. The system automatically recognizes common variations — for example, <code className="bg-muted px-1.5 py-0.5 rounded text-[12px] font-semibold text-primary">Mobile</code> maps to <code className="bg-muted px-1.5 py-0.5 rounded text-[12px] font-semibold text-primary">Phone</code>, and <code className="bg-muted px-1.5 py-0.5 rounded text-[12px] font-semibold text-primary">About</code> maps to <code className="bg-muted px-1.5 py-0.5 rounded text-[12px] font-semibold text-primary">Description</code>.
            </p>
            <div>
              <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Recognized Columns</span>
              <div className="flex flex-wrap gap-2 mt-2">
                {[
                  { col: 'Name / Full Name / Student Name', required: true },
                  { col: 'Phone / Mobile / Contact', required: false },
                  { col: 'Description / Bio / About', required: false },
                ].map(({ col, required }) => (
                  <span key={col} className={cn(
                    "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-medium border",
                    required
                      ? "bg-primary/5 border-primary/20 text-primary"
                      : "bg-muted/50 border-border text-muted-foreground"
                  )}>
                    {required && <span className="size-1.5 rounded-full bg-primary" />}
                    {col}
                  </span>
                ))}
              </div>
            </div>
          </div>

          {/* Divider */}
          <div className="border-t" />

          {/* Template Downloads Section */}
          <div className="p-6 bg-muted/20">
            <div className="flex items-center gap-2.5 mb-4">
              <div className="size-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                <FileDown className="size-4 text-primary" />
              </div>
              <div>
                <h4 className="font-bold text-sm">Download Templates</h4>
                <p className="text-[11px] text-muted-foreground leading-tight">Pre-formatted files ready for data entry</p>
              </div>
            </div>
            <div className="grid sm:grid-cols-2 gap-3">
              <a href="/templates/alumni_import_template.xlsx" download className="group">
                <div className="flex items-center gap-4 p-4 rounded-xl border bg-card hover:border-primary/40 hover:shadow-md transition-all duration-200">
                  <div className="size-12 rounded-xl bg-emerald-500/10 flex items-center justify-center shrink-0 group-hover:bg-emerald-500/15 transition-colors">
                    <span className="text-emerald-600 text-[11px] font-extrabold tracking-wider">.XLSX</span>
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold group-hover:text-primary transition-colors">Excel Spreadsheet</p>
                    <p className="text-[11px] text-muted-foreground mt-0.5">Recommended — includes formatting</p>
                  </div>
                  <FileDown className="size-4 text-muted-foreground ml-auto shrink-0 group-hover:text-primary transition-colors" />
                </div>
              </a>
              <a href="/templates/alumni_import_template.csv" download className="group">
                <div className="flex items-center gap-4 p-4 rounded-xl border bg-card hover:border-primary/40 hover:shadow-md transition-all duration-200">
                  <div className="size-12 rounded-xl bg-blue-500/10 flex items-center justify-center shrink-0 group-hover:bg-blue-500/15 transition-colors">
                    <span className="text-blue-600 text-[11px] font-extrabold tracking-wider">.CSV</span>
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold group-hover:text-primary transition-colors">CSV Plain Text</p>
                    <p className="text-[11px] text-muted-foreground mt-0.5">Universal compatibility</p>
                  </div>
                  <FileDown className="size-4 text-muted-foreground ml-auto shrink-0 group-hover:text-primary transition-colors" />
                </div>
              </a>
            </div>
          </div>
        </div>

        {/* Upload Dropzone */}
        <div className={cn(
          "w-full border-2 border-dashed rounded-xl flex flex-col items-center justify-center p-10 bg-card/50 transition-all duration-300",
          isDragging ? "border-primary bg-primary/5 scale-[1.01]" : "border-border"
        )}
          onDragOver={(e) => { e.preventDefault(); setIsDragging(true) }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={(e) => {
            e.preventDefault()
            setIsDragging(false)
            const files = e.dataTransfer.files
            if (files?.length) {
              handleFileUpload(files[0])
            }
          }}
        >
          <div className="flex flex-col items-center justify-center text-center space-y-4">
            <div className={cn(
              "p-4 rounded-full transition-colors",
              isDragging ? "bg-primary/20 text-primary" : "bg-primary/10 text-primary"
            )}>
              <UploadCloud className="size-10" />
            </div>
            <div>
              <h3 className="text-xl font-bold">Upload Your File</h3>
              <p className="text-sm text-muted-foreground mt-2 max-w-md">
                Drag and drop your <strong>.csv</strong>, <strong>.xlsx</strong>, or <strong>.xls</strong> file here, or click below to browse.
              </p>
            </div>
            <Input
              type="file"
              accept=".csv,.xlsx,.xls"
              className="hidden"
              id="csv-upload"
              onChange={(e) => {
                if (e.target.files?.length) {
                  handleFileUpload(e.target.files[0])
                }
              }}
            />
            <Button size="lg" className="mt-2 gap-2" onClick={() => document.getElementById('csv-upload')?.click()}>
              <UploadCloud className="size-4" />
              Browse Files
            </Button>
          </div>
        </div>
      </div>
    )
  }

  const successCount = drafts.filter(d => d.status === 'inserted').length
  const totalCount = drafts.length

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between bg-card p-4 rounded-xl border shadow-sm">
        <div className="flex items-center gap-3">
          <Button variant="outline" size="sm" onClick={() => router.push('/admin/alumni')} disabled={isProcessing}>
            <ArrowLeft className="size-4 mr-2" /> Back
          </Button>
          <div className="text-sm font-medium">
            <span className="text-primary font-bold">{successCount}</span> / {totalCount} Processed
          </div>
        </div>

        <div className="flex items-center gap-4 w-full sm:w-auto">
          <div className="flex items-center gap-2">
            <Select value={globalBatchId} onValueChange={(val) => setGlobalBatchId(val || '')}>
              <SelectTrigger className="w-[220px] h-9">
                {globalBatchId
                  ? (() => { const b = batches.find(b => b.id === globalBatchId); return b ? `${b.year} — ${b.name}` : 'Select Batch' })()
                  : <span className="text-muted-foreground">Select Global Batch</span>
                }
              </SelectTrigger>
              <SelectContent>
                {batches.map(b => (
                  <SelectItem key={b.id} value={b.id}>{b.year} — {b.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button size="sm" variant="secondary" onClick={handleApplyGlobalBatch} disabled={!globalBatchId || isProcessing}>
              Apply to All
            </Button>
          </div>

          <Button
            className="min-w-[140px]"
            onClick={processImport}
            disabled={isProcessing || successCount === totalCount}
          >
            {isProcessing ? (
              <><Loader2 className="size-4 mr-2 animate-spin" /> Processing</>
            ) : (
              <><UploadCloud className="size-4 mr-2" /> Execute Import</>
            )}
          </Button>
        </div>
      </div>

      <div className="bg-card rounded-xl border shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader className="bg-muted/30 whitespace-nowrap">
              <TableRow>
                <TableHead className="w-[60px] text-center">Status</TableHead>
                <TableHead className="w-[80px]">Photo</TableHead>
                <TableHead className="min-w-[150px]">Full Name</TableHead>
                <TableHead className="min-w-[180px]">Batch</TableHead>
                <TableHead className="min-w-[120px]">Phone</TableHead>
                <TableHead className="min-w-[200px]">Description</TableHead>
                <TableHead className="w-[80px]">Rep?</TableHead>
                <TableHead className="w-[60px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {drafts.map((draft) => (
                <TableRow key={draft.id} className={cn(draft.status === 'error' && 'bg-destructive/5')}>
                  <TableCell className="text-center align-middle">
                    {draft.status === 'pending' && <span className="w-2 h-2 rounded-full bg-muted-foreground inline-block" />}
                    {(draft.status === 'uploading' || draft.status === 'processing') && <Loader2 className="size-4 animate-spin text-primary mx-auto" />}
                    {draft.status === 'inserted' && <CheckCircle2 className="size-5 text-emerald-500 mx-auto" />}
                    {draft.status === 'error' && <span title={draft.error_message}><AlertCircle className="size-5 text-destructive mx-auto" /></span>}
                  </TableCell>

                  <TableCell className="align-middle">
                    <div className="relative group w-10 h-10 rounded-full border bg-muted overflow-hidden">
                      <Input
                        type="file"
                        accept="image/*"
                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                        disabled={isProcessing || draft.status === 'inserted'}
                        onChange={(e) => {
                          const file = e.target.files?.[0]
                          if (file) {
                            const previewUrl = URL.createObjectURL(file)
                            updateDraft(draft.id, { photo_file: file, photo_preview: previewUrl, status: draft.status === 'error' ? 'pending' : draft.status, error_message: '' })
                          }
                        }}
                      />
                      {draft.photo_preview ? (
                        /* eslint-disable-next-line @next/next/no-img-element */
                        <img src={draft.photo_preview} alt="Preview" className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-muted-foreground">
                          <ImageIcon className="size-4" />
                        </div>
                      )}
                    </div>
                  </TableCell>

                  <TableCell className="align-middle">
                    <Input
                      value={draft.name}
                      onChange={(e) => updateDraft(draft.id, { name: e.target.value, status: draft.status === 'error' ? 'pending' : draft.status, error_message: '' })}
                      disabled={isProcessing || draft.status === 'inserted'}
                      className="h-8"
                    />
                  </TableCell>

                  <TableCell className="align-middle">
                    <Select
                      value={draft.batch_id}
                      onValueChange={(val) => updateDraft(draft.id, { batch_id: val || '', status: draft.status === 'error' ? 'pending' : draft.status, error_message: '' })}
                      disabled={isProcessing || draft.status === 'inserted'}
                    >
                      <SelectTrigger className="h-8">
                        {draft.batch_id
                          ? (() => { const b = batches.find(b => b.id === draft.batch_id); return b ? `${b.year} — ${b.name}` : 'Assign' })()
                          : <span className="text-muted-foreground">Assign</span>
                        }
                      </SelectTrigger>
                      <SelectContent>
                        {batches.map(b => (
                          <SelectItem key={b.id} value={b.id}>{b.year} — {b.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </TableCell>

                  <TableCell className="align-middle">
                    <Input
                      value={draft.phone_number}
                      onChange={(e) => updateDraft(draft.id, { phone_number: e.target.value })}
                      disabled={isProcessing || draft.status === 'inserted'}
                      className="h-8"
                    />
                  </TableCell>

                  <TableCell className="align-middle">
                    <Input
                      value={draft.description}
                      onChange={(e) => updateDraft(draft.id, { description: e.target.value })}
                      disabled={isProcessing || draft.status === 'inserted'}
                      className="h-8"
                    />
                  </TableCell>

                  <TableCell className="text-center align-middle">
                    <Checkbox
                      checked={draft.is_representative}
                      onCheckedChange={(checked) => updateDraft(draft.id, { is_representative: !!checked })}
                      disabled={isProcessing || draft.status === 'inserted'}
                    />
                  </TableCell>

                  <TableCell className="align-middle">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-destructive hover:bg-destructive/10 h-8 w-8"
                      onClick={() => handleRemoveDraft(draft.id)}
                      disabled={isProcessing || draft.status === 'inserted'}
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </TableCell>

                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  )
}
