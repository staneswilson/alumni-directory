'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { Search, Phone, ArrowRight, User2, Link2, Users2, Star, X, ChevronLeft, ChevronRight } from 'lucide-react'
import { createClient } from '@/utils/supabase/client'
import { Skeleton } from '@/components/ui/skeleton'
import { ThemeToggle } from '@/components/ThemeToggle'
import { Dialog, DialogContent, DialogTitle, DialogClose } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

type Student = {
  id: string
  name: string
  description: string
  phone_number: string
  photo_url: string
  is_representative?: boolean
  batches: {
    id?: string
    year: number
    name: string
  }
}

type BatchSummary = {
  id: string
  year: number
  name: string
  students?: { id: string; name: string; photo_url: string | null; is_representative?: boolean }[]
}

export default function PublicSearch() {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<Student[]>([])
  const [batchResults, setBatchResults] = useState<BatchSummary[]>([])
  const [recentBatches, setRecentBatches] = useState<BatchSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [hasSearched, setHasSearched] = useState(false)
  const [selectedStudentIndex, setSelectedStudentIndex] = useState<number | null>(null)
  
  const supabase = createClient()

  const fetchRecentBatches = async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('batches')
      .select(`
        id, year, name,
        students(id, name, photo_url, is_representative)
      `)
      .order('year', { ascending: false })
      .limit(6)

    if (!error && data) {
      setRecentBatches(data as unknown as BatchSummary[])
    }
    setLoading(false)
  }

  const handleSearch = async (e?: React.FormEvent, overrideQuery?: string, specificBatchId?: string) => {
    if (e) e.preventDefault()

    const searchQuery = overrideQuery !== undefined ? overrideQuery : query

    // If empty query, revert to showing recent batches
    if (!searchQuery.trim() && !specificBatchId) {
      setHasSearched(false)
      if (recentBatches.length === 0) fetchRecentBatches()
      return
    }

    if (overrideQuery !== undefined) {
      setQuery(overrideQuery)
    }

    setHasSearched(true)
    setLoading(true)
    setBatchResults([])

    const isNumber = !isNaN(Number(searchQuery.trim()))
    
    // If it's a year search and no specific batch is selected, check for multiple batches first
    if (isNumber && !specificBatchId) {
      const { data: batches, error: batchError } = await supabase
        .from('batches')
        .select(`
          id, year, name,
          students(id, name, photo_url, is_representative)
        `)
        .eq('year', Number(searchQuery.trim()))
        .order('name', { ascending: true })

      if (!batchError && batches && batches.length > 1) {
        setBatchResults(batches as unknown as BatchSummary[])
        setResults([])
        setLoading(false)
        return
      }
    }

    // Standard student search or specific batch search
    let supabaseQuery = supabase
      .from('students')
      .select(`
        id, name, description, phone_number, photo_url, is_representative,
        batches!inner(id, year, name)
      `)
      .order('name', { ascending: true })

    if (specificBatchId) {
      supabaseQuery = supabaseQuery.eq('batch_id', specificBatchId)
    } else if (isNumber) {
      supabaseQuery = supabaseQuery.eq('batches.year', Number(searchQuery.trim()))
    } else {
      supabaseQuery = supabaseQuery.ilike('name', `%${searchQuery.trim()}%`)
    }

    const { data, error } = await supabaseQuery

    if (error) {
      console.error('Directory Query Failed:', error)
      setResults([])
    } else {
      setResults((data as unknown) as Student[])
    }

    setLoading(false)
  }

  // Navigation for Modal
  const nextStudent = useCallback(() => {
    if (selectedStudentIndex !== null && selectedStudentIndex < results.length - 1) {
      setSelectedStudentIndex(selectedStudentIndex + 1)
    }
  }, [selectedStudentIndex, results.length])

  const prevStudent = useCallback(() => {
    if (selectedStudentIndex !== null && selectedStudentIndex > 0) {
      setSelectedStudentIndex(selectedStudentIndex - 1)
    }
  }, [selectedStudentIndex])

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (selectedStudentIndex === null) return
      if (e.key === 'ArrowRight') nextStudent()
      if (e.key === 'ArrowLeft') prevStudent()
      if (e.key === 'Escape') setSelectedStudentIndex(null)
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [selectedStudentIndex, nextStudent, prevStudent])

  // Load baseline directory on mount
  useEffect(() => {
    fetchRecentBatches()
  }, [])

  return (
    <>
      <div className="absolute top-4 right-4 z-[100] pointer-events-auto">
        <ThemeToggle className="rounded-full shadow-sm bg-background/50 backdrop-blur-md border border-border" />
      </div>

      <div className="w-full relative z-50 flex flex-col items-center justify-start min-h-dvh pt-14 sm:pt-16 md:pt-20 pb-24 md:pb-48 font-sans selection:bg-[#d4af37]/30 selection:text-foreground pointer-events-none">
        <div className="w-full max-w-[1240px] mx-auto px-6 sm:px-8 md:px-10 flex flex-col items-center h-full pointer-events-none">

          {/* Hero */}
          <div className="w-full text-center mb-5 md:mb-12 animate-in fade-in slide-in-from-bottom-8 duration-1000">
            <div className="inline-flex items-center justify-center px-3 py-1 rounded-full border border-[#d4af37]/30 bg-[#d4af37]/10 mb-4 md:mb-8 backdrop-blur-md">
              <Link2 className="w-3.5 h-3.5 mr-1.5 text-[#d4af37]" />
              <span className="text-[10px] md:text-xs font-bold tracking-[0.2em] uppercase text-[#d4af37]">
                Global Connections
              </span>
            </div>

            <h1 className="text-3xl sm:text-4xl md:text-7xl font-bold tracking-tight text-foreground m-0 leading-tight drop-shadow-sm">
              The Alumni Network
            </h1>
            <p className="mt-3 md:mt-6 text-muted-foreground text-sm sm:text-base md:text-xl font-medium tracking-wide max-w-2xl mx-auto drop-shadow-sm">
              Discover relationships and bridge graduating classes.
            </p>
          </div>

          {/* Search Bar */}
          <form
            onSubmit={handleSearch}
            className="w-full max-w-3xl relative animate-in fade-in slide-in-from-bottom-8 duration-1000 delay-150 z-50 group mb-6 md:mb-14 pointer-events-auto"
          >
            <div className="absolute inset-0 bg-card/80 backdrop-blur-xl rounded-xl md:rounded-2xl border border-border shadow-2xl transition-all duration-300 group-focus-within:border-[#d4af37] group-focus-within:ring-2 group-focus-within:ring-[#d4af37]/20" />

            <div className="relative flex items-center h-14 md:h-20 px-3 md:px-6">
              <Search strokeWidth={2.5} className="w-5 h-5 md:w-6 md:h-6 text-muted-foreground group-focus-within:text-[#d4af37] transition-colors duration-300 mr-2 md:mr-4 shrink-0" />

              <input
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value)
                  if (e.target.value === '') {
                    setHasSearched(false)
                  }
                }}
                className="w-full bg-transparent border-none text-base sm:text-xl md:text-3xl text-foreground placeholder:text-muted-foreground/50 outline-none font-semibold tracking-tight h-full min-w-0"
                placeholder="Name or class year..."
              />

              <button
                type="submit"
                disabled={loading}
                className="ml-2 px-4 md:px-8 py-2.5 md:py-3 bg-[#d4af37] hover:bg-[#f3cc4a] text-black rounded-lg md:rounded-xl font-bold text-xs md:text-base transition-all duration-300 flex items-center shrink-0 disabled:opacity-70 active:scale-95 shadow-[0_0_20px_rgba(212,175,55,0.4)]"
              >
                {loading ? (
                  <span className="animate-pulse">...</span>
                ) : (
                  <>
                    <span className="hidden sm:inline">Locate</span>
                    <ArrowRight strokeWidth={2.5} className="w-4 h-4 sm:ml-2" />
                  </>
                )}
              </button>
            </div>
          </form>

          {/* Results Area */}
          <div className="w-full pointer-events-auto">

            {/* STATE 1: RECENT BATCHES GRID & MULTI-BATCH SEARCH RESULTS */}
            {(!hasSearched || batchResults.length > 0) && (
              <div className="w-full animate-in fade-in duration-700">
                <h3 className="text-base md:text-xl font-bold text-foreground mb-4 md:mb-6 border-b border-border pb-2 flex items-center justify-between">
                  <div className="flex items-center">
                    <Users2 className="w-4 h-4 md:w-5 md:h-5 mr-2 md:mr-3 text-[#d4af37]" />
                    {batchResults.length > 0 ? `Batches in ${query}` : 'Active Batches'}
                  </div>
                  {batchResults.length > 0 && (
                    <button 
                      onClick={() => { setBatchResults([]); setHasSearched(false); setQuery(''); }}
                      className="text-xs font-bold text-[#d4af37] hover:underline"
                    >
                      Clear Search
                    </button>
                  )}
                </h3>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
                  {loading && (batchResults.length === 0 && recentBatches.length === 0) && (
                    Array.from({ length: 3 }).map((_, i) => (
                      <div key={i} className="bg-card/60 backdrop-blur-md border border-border rounded-2xl p-6">
                        <div className="flex justify-between items-start mb-4">
                          <div>
                            <Skeleton className="h-7 w-16 rounded-md mb-2" />
                            <Skeleton className="h-4 w-28 rounded-md" />
                          </div>
                          <Skeleton className="h-6 w-20 rounded-full" />
                        </div>
                        <div className="pt-4 border-t border-border flex items-center">
                          <Skeleton className="w-8 h-8 rounded-full mr-3" />
                          <div>
                            <Skeleton className="h-3 w-16 rounded mb-1.5" />
                            <Skeleton className="h-4 w-24 rounded" />
                          </div>
                        </div>
                      </div>
                    ))
                  )}

                  {(batchResults.length > 0 ? batchResults : recentBatches).map(batch => (
                    <div
                      key={batch.id}
                      onClick={() => {
                        handleSearch(undefined, String(batch.year), batch.id)
                      }}
                      className="group cursor-pointer bg-card/60 backdrop-blur-md border border-border rounded-2xl p-6 hover:border-[#d4af37]/40 hover:-translate-y-1 transition-all duration-300 shadow-xl"
                    >
                      <div className="flex justify-between items-start mb-4">
                        <div>
                          <h4 className="text-2xl font-black text-foreground group-hover:text-[#d4af37] transition-colors">{batch.year}</h4>
                          <p className="text-sm font-medium text-muted-foreground">{batch.name}</p>
                        </div>
                        <div className="bg-[#d4af37]/10 border border-[#d4af37]/20 text-[#d4af37] font-bold text-xs px-3 py-1 rounded-full">
                          {batch.students?.length || 0} Networked
                        </div>
                      </div>

                      <div className="pt-4 border-t border-border">
                        {batch.students && batch.students.length > 0 ? (
                          <div className="flex items-center">
                            {(() => {
                              const rep = batch.students.find(s => s.is_representative) || batch.students[0]
                              return (
                                <>
                                  {rep.photo_url ? (
                                    /* eslint-disable-next-line @next/next/no-img-element */
                                    <img src={rep.photo_url} className="w-8 h-8 rounded-full border border-border mr-3 object-cover shadow-sm" alt="Rep" />
                                  ) : (
                                    <div className="w-8 h-8 rounded-full bg-muted border border-border mr-3 flex items-center justify-center text-muted-foreground">
                                      <User2 className="w-4 h-4" />
                                    </div>
                                  )}
                                  <div>
                                    <p className="text-xs text-[#d4af37] font-semibold uppercase tracking-wider flex items-center gap-1">
                                      <Star className="w-3 h-3" /> Representative
                                    </p>
                                    <p className="text-sm font-bold text-foreground/80">{rep.name}</p>
                                  </div>
                                </>
                              )
                            })()}
                          </div>
                        ) : (
                          <p className="text-sm italic text-muted-foreground/60 font-medium">No alumni registered yet.</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* STATE 2: STUDENT SEARCH RESULTS */}
            {hasSearched && batchResults.length === 0 && (
              <div className="w-full animate-in fade-in duration-700">
                <div className="flex items-center justify-between mb-6 border-b border-border pb-4">
                  <h3 className="text-base md:text-xl font-bold text-foreground flex items-center">
                    <Users2 className="w-4 h-4 md:w-5 md:h-5 mr-3 text-[#d4af37]" />
                    Network Connections
                  </h3>
                  {!loading && results.length > 0 && (
                    <span className="text-[10px] font-bold uppercase tracking-widest text-[#d4af37] bg-[#d4af37]/10 px-3 py-1 rounded-full border border-[#d4af37]/20">
                      {results.length} found
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 lg:gap-x-6 gap-4 sm:gap-4">
                  {loading && results.length === 0 && (
                    Array.from({ length: 6 }).map((_, i) => (
                      <div key={i} className="flex flex-row items-center bg-card/40 backdrop-blur-md border border-border rounded-2xl overflow-hidden p-4">
                        <Skeleton className="w-16 h-16 sm:w-20 sm:h-20 shrink-0 rounded-full mr-4" />
                        <div className="flex flex-col flex-1 w-full space-y-2.5">
                          <div className="flex justify-between items-center w-full">
                            <Skeleton className="h-5 w-1/2 rounded-md" />
                            <Skeleton className="h-5 w-12 rounded-full" />
                          </div>
                          <Skeleton className="h-4 w-3/4 rounded-md" />
                          <Skeleton className="h-3 w-1/3 rounded-md mt-1" />
                        </div>
                      </div>
                    ))
                  )}

                  {!loading && results.map((student, index) => (
                    <div
                      key={student.id}
                      onClick={() => setSelectedStudentIndex(index)}
                      className="group cursor-pointer flex flex-row items-center bg-card/60 backdrop-blur-md border border-border rounded-2xl overflow-hidden hover:border-[#d4af37]/60 transition-all duration-300 shadow-sm hover:shadow-md hover:-translate-y-1 p-4"
                    >
                      <div className="w-16 h-16 sm:w-20 sm:h-20 shrink-0 border-2 border-transparent group-hover:border-[#d4af37]/30 transition-colors duration-300 rounded-full overflow-hidden bg-muted relative flex items-center justify-center mr-4 sm:mr-5">
                        {student.photo_url ? (
                          /* eslint-disable-next-line @next/next/no-img-element */
                          <img
                            src={student.photo_url}
                            alt={student.name}
                            className="w-full h-full object-cover transition-transform duration-700 ease-out group-hover:scale-110"
                          />
                        ) : (
                          <User2 strokeWidth={1.5} className="w-8 h-8 opacity-50 text-muted-foreground group-hover:text-[#d4af37]" />
                        )}
                      </div>

                      <div className="flex flex-col flex-1 min-w-0 py-1">
                        <div className="flex justify-between items-start gap-2 mb-1.5">
                          <h3 className="text-lg sm:text-xl font-bold tracking-tight text-foreground truncate group-hover:text-[#d4af37] transition-colors flex items-center gap-2">
                            {student.name}
                            {student.is_representative && (
                              <span className="text-[9px] uppercase tracking-widest bg-[#d4af37]/10 text-[#d4af37] border border-[#d4af37]/20 px-2 py-0.5 rounded-full flex items-center gap-1 mt-0.5 whitespace-nowrap">
                                <Star className="w-2.5 h-2.5" /> Rep
                              </span>
                            )}
                          </h3>
                          <span className="text-[10px] font-bold uppercase tracking-widest text-[#d4af37] bg-[#d4af37]/10 px-2.5 py-1 rounded-full border border-[#d4af37]/20 shrink-0">
                            &apos;{String(student.batches.year).slice(-2)}
                          </span>
                        </div>

                        {student.description ? (
                          <p className="text-muted-foreground text-sm leading-relaxed font-medium truncate mb-2.5">
                            {student.description}
                          </p>
                        ) : (
                          <p className="text-muted-foreground/50 text-sm italic font-medium mb-2.5">
                            No biography available.
                          </p>
                        )}

                        <div className="flex items-center mt-auto">
                          {student.phone_number ? (
                            <span className="text-xs font-bold tracking-wider uppercase text-foreground/70 flex items-center group-hover:text-foreground transition-colors">
                              <Phone className="w-3 h-3 mr-1.5 text-[#d4af37]" />
                              {student.phone_number}
                            </span>
                          ) : (
                            <span className="text-xs font-bold tracking-wider uppercase text-muted-foreground/40 flex items-center">
                              <Phone className="w-3 h-3 mr-1.5 opacity-50" />
                              Unlisted
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}

                  {/* Highly Visible Empty State for Search */}
                  {!loading && results.length === 0 && (
                    <div className="col-span-full w-full py-16 md:py-24 mt-4 text-center bg-card/80 backdrop-blur-xl rounded-2xl border border-border shadow-md">
                      <Link2 strokeWidth={2.5} className="w-12 h-12 mx-auto text-[#d4af37] mb-6" />
                      <h3 className="text-2xl md:text-3xl font-bold tracking-tight text-foreground mb-4">No Connections Formed</h3>
                      <p className="text-muted-foreground font-medium text-base md:text-lg max-w-md mx-auto px-4">
                        We couldn&apos;t triangulate an alumni matching those parameters in the network.
                      </p>
                      <button 
                        onClick={() => { setHasSearched(false); setQuery(''); }}
                        className="mt-8 text-[#d4af37] font-bold uppercase tracking-widest text-xs border border-[#d4af37]/30 px-6 py-2 rounded-full hover:bg-[#d4af37]/10 transition-colors"
                      >
                        Reset Search
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )}

          </div>
        </div>
      </div>

      {/* PREMIUM STUDENT DETAIL MODAL */}
      <Dialog open={selectedStudentIndex !== null} onOpenChange={(open) => !open && setSelectedStudentIndex(null)}>
        <DialogContent className="p-0 border-none bg-transparent shadow-none max-w-5xl w-full h-[100dvh] sm:h-auto overflow-hidden sm:rounded-[2rem] pointer-events-auto">
          <div className="relative w-full h-full sm:aspect-[1.6/1] bg-card/60 backdrop-blur-3xl sm:border border-white/10 sm:rounded-[2rem] overflow-hidden flex flex-col md:flex-row animate-in fade-in zoom-in-95 duration-500">
            
            {/* Immersive Background Layer */}
            {selectedStudentIndex !== null && results[selectedStudentIndex] && (
              <div className="absolute inset-0 z-0 opacity-20 pointer-events-none">
                {results[selectedStudentIndex].photo_url ? (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img 
                    src={results[selectedStudentIndex].photo_url} 
                    alt="" 
                    className="w-full h-full object-cover blur-[100px] scale-150" 
                  />
                ) : (
                  <div className="w-full h-full bg-[#d4af37]/10" />
                )}
              </div>
            )}

            {/* Close Button */}
            <DialogClose className="absolute top-6 right-6 z-[100] w-12 h-12 rounded-full bg-white/10 hover:bg-[#d4af37] backdrop-blur-xl flex items-center justify-center text-white transition-all duration-500 hover:rotate-90 active:scale-90 border border-white/10 shadow-2xl">
              <X className="w-6 h-6" />
            </DialogClose>

            {/* Navigation Arrows (Desktop Only) */}
            <div className="absolute inset-y-0 left-0 w-24 z-50 flex items-center justify-center pointer-events-none hidden md:flex">
              {selectedStudentIndex !== null && selectedStudentIndex > 0 && (
                <button 
                  onClick={(e) => { e.stopPropagation(); prevStudent(); }} 
                  className="w-14 h-14 rounded-full bg-black/20 hover:bg-[#d4af37] text-white flex items-center justify-center backdrop-blur-xl transition-all duration-300 pointer-events-auto group border border-white/5 active:scale-90"
                >
                  <ChevronLeft className="w-7 h-7 group-hover:-translate-x-1 transition-transform" />
                </button>
              )}
            </div>
            <div className="absolute inset-y-0 right-0 w-24 z-50 flex items-center justify-center pointer-events-none hidden md:flex">
              {selectedStudentIndex !== null && selectedStudentIndex < results.length - 1 && (
                <button 
                  onClick={(e) => { e.stopPropagation(); nextStudent(); }} 
                  className="w-14 h-14 rounded-full bg-black/20 hover:bg-[#d4af37] text-white flex items-center justify-center backdrop-blur-xl transition-all duration-300 pointer-events-auto group border border-white/5 active:scale-90"
                >
                  <ChevronRight className="w-7 h-7 group-hover:translate-x-1 transition-transform" />
                </button>
              )}
            </div>

            {selectedStudentIndex !== null && results[selectedStudentIndex] && (() => {
              const student = results[selectedStudentIndex]
              return (
                <>
                  {/* Left Side / Top: Visual Identity */}
                  <div className="w-full md:w-[42%] h-[40dvh] md:h-full relative overflow-hidden group z-10 shrink-0">
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent z-10" />
                    {student.photo_url ? (
                      /* eslint-disable-next-line @next/next/no-img-element */
                      <img 
                        src={student.photo_url} 
                        alt={student.name} 
                        className="w-full h-full object-cover animate-in fade-in duration-1000 group-hover:scale-105 transition-transform duration-[3000ms] ease-out" 
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-card to-muted">
                        <User2 size={160} strokeWidth={0.5} className="text-[#d4af37]/20" />
                      </div>
                    )}
                    
                    {/* Floating Info Badges Over Photo */}
                    <div className="absolute bottom-6 left-6 right-6 flex flex-wrap gap-3 items-end z-20">
                      <div className="bg-white/10 backdrop-blur-xl border border-white/20 text-white px-4 py-2 rounded-2xl flex items-center gap-2.5 shadow-2xl">
                        <Users2 size={16} className="text-[#d4af37]" />
                        <span className="text-xs font-black uppercase tracking-[0.2em]">{student.batches.year} • {student.batches.name}</span>
                      </div>
                      {student.is_representative && (
                        <div className="bg-[#d4af37] text-black px-4 py-2 rounded-2xl flex items-center gap-2 shadow-2xl animate-bounce-slow">
                          <Star size={16} fill="currentColor" />
                          <span className="text-[10px] font-black uppercase tracking-tighter">Representative</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Right Side / Bottom: Content Hub */}
                  <div className="w-full md:w-[58%] h-[60dvh] md:h-full flex flex-col z-10 bg-background/40 md:bg-transparent overflow-y-auto md:overflow-visible">
                    <div className="p-8 md:p-14 flex flex-col flex-1">
                      <DialogTitle className="sr-only">{student.name}</DialogTitle>
                      
                      <div className="mb-8 md:mb-12 animate-in slide-in-from-bottom-8 duration-700">
                        <div className="w-12 h-1.5 bg-[#d4af37] mb-6 rounded-full" />
                        <h2 className="text-5xl md:text-7xl font-black tracking-tighter text-foreground leading-[0.95] mb-2 drop-shadow-2xl">
                          {student.name}
                        </h2>
                      </div>
                      
                      <div className="space-y-10 flex-1 animate-in fade-in duration-1000 delay-300">
                        <div className="max-w-lg">
                          <h4 className="text-[11px] font-black uppercase tracking-[0.4em] text-[#d4af37] mb-4 opacity-80">Historical Record / Bio</h4>
                          <p className="text-xl md:text-2xl text-muted-foreground/90 leading-relaxed font-medium tracking-tight">
                            {student.description || "An esteemed member of our alumni network. Their legacy remains preserved within these halls."}
                          </p>
                        </div>

                        <div className="pt-8 border-t border-white/5 max-w-lg">
                           <h4 className="text-[11px] font-black uppercase tracking-[0.4em] text-[#d4af37] mb-5 opacity-80">Direct Channels</h4>
                           {student.phone_number ? (
                             <a 
                               href={`tel:${student.phone_number}`}
                               className="inline-flex items-center gap-6 bg-foreground text-background px-8 py-5 rounded-[1.5rem] font-black group hover:scale-[1.02] active:scale-95 transition-all shadow-[0_20px_50px_rgba(0,0,0,0.3)] hover:shadow-[0_20px_50px_rgba(212,175,55,0.2)]"
                             >
                               <div className="bg-[#d4af37] p-2 rounded-lg text-black">
                                 <Phone className="w-5 h-5" />
                               </div>
                               <span className="text-lg">{student.phone_number}</span>
                               <ArrowRight className="w-5 h-5 ml-2 group-hover:translate-x-2 transition-transform duration-500" />
                             </a>
                           ) : (
                             <div className="flex items-center gap-4 text-muted-foreground/60 italic font-medium p-4 rounded-2xl bg-white/5 border border-white/5 w-fit">
                               <div className="bg-white/5 p-2 rounded-lg">
                                 <Phone className="w-5 h-5 opacity-40" />
                               </div>
                               <span>Communication line is private.</span>
                             </div>
                           )}
                        </div>
                      </div>

                      {/* Integrated Mobile Navigation Footer */}
                      <div className="mt-12 md:hidden flex items-center justify-between pt-8 border-t border-white/5 pb-8">
                          <button 
                            disabled={selectedStudentIndex <= 0}
                            onClick={prevStudent}
                            className="flex items-center gap-3 font-black uppercase tracking-widest text-xs disabled:opacity-30 group"
                          >
                            <div className="w-10 h-10 rounded-full border border-white/10 flex items-center justify-center group-hover:bg-white/5 transition-colors">
                              <ChevronLeft className="w-5 h-5" />
                            </div>
                            Prev
                          </button>
                          
                          <div className="flex flex-col items-center">
                            <span className="text-[12px] font-black text-[#d4af37] tracking-tighter">
                              {selectedStudentIndex + 1} <span className="text-muted-foreground/40 font-medium">/</span> {results.length}
                            </span>
                            <div className="flex gap-1 mt-1">
                               {results.map((_, i) => (
                                 <div key={i} className={cn("h-1 rounded-full transition-all duration-500", i === selectedStudentIndex ? "w-4 bg-[#d4af37]" : "w-1 bg-white/10")} />
                               ))}
                            </div>
                          </div>

                          <button 
                            disabled={selectedStudentIndex >= results.length - 1}
                            onClick={nextStudent}
                            className="flex items-center gap-3 font-black uppercase tracking-widest text-xs disabled:opacity-30 group text-right"
                          >
                            Next
                            <div className="w-10 h-10 rounded-full border border-white/10 flex items-center justify-center group-hover:bg-white/5 transition-colors">
                              <ChevronRight className="w-5 h-5" />
                            </div>
                          </button>
                      </div>
                    </div>
                  </div>
                </>
              )
            })()}
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
