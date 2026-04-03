'use client'

import { useState, useEffect, useCallback } from 'react'
import { Search, Phone, User2, Link2, Users2, Star, ArrowRight, ChevronDown } from 'lucide-react'
import { createClient } from '@/utils/supabase/client'
import { Skeleton } from '@/components/ui/skeleton'
import { ThemeToggle } from '@/components/ThemeToggle'
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
  const [batchesLimit, setBatchesLimit] = useState(6)

  const supabase = createClient()

  const fetchRecentBatches = useCallback(async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('batches')
      .select(`
        id, year, name,
        students(id, name, photo_url, is_representative)
      `)
      .order('year', { ascending: false })
      .limit(batchesLimit)

    if (!error && data) {
      setRecentBatches(data as unknown as BatchSummary[])
    }
    setLoading(false)
  }, [supabase, batchesLimit])

  useEffect(() => {
    fetchRecentBatches()
  }, [fetchRecentBatches])

  const handleSearch = async (e?: React.FormEvent, overrideQuery?: string, specificBatchId?: string) => {
    if (e) e.preventDefault()

    const searchQuery = overrideQuery !== undefined ? overrideQuery : query

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
                Official Directory
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
                    <span className="hidden sm:inline">Search</span>
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
                          <Skeleton className="h-7 w-16 mb-2" />
                          <Skeleton className="h-4 w-28" />
                        </div>
                        <div className="pt-4 border-t border-border mt-4">
                          <Skeleton className="h-8 w-full" />
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
                                  <div className="min-w-0">
                                    <p className="text-[10px] sm:text-[11px] text-[#d4af37] font-black uppercase tracking-[0.15em] flex items-center gap-1.5 mb-0.5">
                                      <Star className="w-2.5 h-2.5" /> Lead Representative
                                    </p>
                                    <p className="text-sm sm:text-base font-bold text-foreground/90 truncate">{rep.name}</p>
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

                {/* ARCHIVE EXPANSION CTA */}
                {!hasSearched && batchResults.length === 0 && (
                  <div className="mt-12 flex justify-center animate-in fade-in slide-in-from-bottom-4 duration-1000">
                    <button
                      onClick={() => setBatchesLimit(prev => prev + 12)}
                      className="group relative flex items-center justify-center h-16 px-10 rounded-2xl bg-card/40 backdrop-blur-3xl border border-[#d4af37]/20 hover:border-[#d4af37]/60 transition-all duration-500 hover:shadow-[0_20px_50px_rgba(212,175,55,0.15)] active:scale-95 overflow-hidden"
                    >
                      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-[#d4af37]/5 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000" />
                      <div className="relative flex items-center gap-4">
                        <div className="w-10 h-10 rounded-full bg-[#d4af37]/10 flex items-center justify-center group-hover:bg-[#d4af37] group-hover:text-black transition-all">
                          <ChevronDown className="w-5 h-5 group-hover:animate-bounce" />
                        </div>
                        <div className="flex flex-col items-start leading-none">
                          <span className="text-[10px] font-black uppercase tracking-[0.3em] text-[#d4af37] mb-1">Institutional Archives</span>
                          <span className="text-sm font-bold text-foreground">View Former Cohorts</span>
                        </div>
                      </div>
                    </button>
                  </div>
                )}
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
                      {results.length} Matches Found
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 sm:gap-6">
                  {loading && results.length === 0 && (
                    Array.from({ length: 6 }).map((_, i) => (
                      <div key={i} className="flex flex-row items-stretch bg-card/40 backdrop-blur-md border border-white/5 rounded-[2rem] overflow-hidden p-5 h-44">
                        <Skeleton className="w-28 h-full shrink-0 rounded-2xl mr-6" />
                        <div className="flex flex-col flex-1 py-1 space-y-3">
                          <Skeleton className="h-6 w-1/2 rounded-lg" />
                          <Skeleton className="h-4 w-full rounded-md" />
                        </div>
                      </div>
                    ))
                  )}

                  {!loading && results.map((student) => (
                    <div
                      key={student.id}
                      className="group flex flex-row items-stretch bg-card/40 backdrop-blur-xl border border-white/5 hover:border-[#d4af37]/40 rounded-[2rem] overflow-hidden transition-all duration-500 shadow-xl p-4 sm:p-5 h-auto sm:min-h-[160px] relative"
                    >
                      {/* Photo Section */}
                      <div className="w-20 h-20 sm:w-28 sm:h-auto shrink-0 relative rounded-2xl overflow-hidden bg-muted group-hover:shadow-2xl transition-all duration-700 mr-5 sm:mr-7">
                        {student.photo_url ? (
                          /* eslint-disable-next-line @next/next/no-img-element */
                          <img
                            src={student.photo_url}
                            alt={student.name}
                            className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-[#d4af37]/5 to-muted">
                            <User2 strokeWidth={1} className="w-10 h-10 opacity-30 text-[#d4af37]" />
                          </div>
                        )}
                      </div>

                      {/* Content Section */}
                      <div className="flex flex-col flex-1 min-w-0 py-1">
                        <div className="flex justify-between items-start gap-4 mb-2">
                          <div className="min-w-0">
                            <h3 className="text-xl font-black tracking-tight text-foreground truncate group-hover:text-[#d4af37] transition-colors leading-tight">
                              {student.name}
                            </h3>
                            <div className="flex items-center gap-2 mt-1">
                              <span className="text-[9px] font-black uppercase tracking-[0.2em] text-[#d4af37]/60">Batch of</span>
                              <span className="text-[11px] font-black text-foreground/80">{student.batches.year}</span>
                            </div>
                          </div>
                          {student.is_representative && (
                            <div className="bg-[#d4af37] text-black p-1 rounded-full shadow-lg">
                              <Star className="w-3 h-3 fill-current" />
                            </div>
                          )}
                        </div>

                        {student.description ? (
                          <p className="text-muted-foreground/90 text-sm md:text-[15px] leading-relaxed font-medium line-clamp-2 md:line-clamp-3 mb-4 pr-2">
                            {student.description}
                          </p>
                        ) : (
                          <p className="text-muted-foreground/30 text-xs md:text-sm italic font-medium mb-4">
                            Biographical data preserved in institutional records.
                          </p>
                        )}

                        <div className="mt-auto pt-3 border-t border-white/5">
                          {student.phone_number ? (
                            <a
                              href={`tel:${student.phone_number}`}
                              className="group/call inline-flex items-center gap-2.5 transition-all text-[#d4af37] hover:text-[#f3cc4a] active:scale-95"
                            >
                              <div className="bg-[#d4af37]/10 p-2 rounded-lg group-hover/call:bg-[#d4af37] group-hover/call:text-black transition-all shadow-sm">
                                <Phone className="w-3.5 h-3.5" />
                              </div>
                              <span className="text-[12px] font-black tracking-[0.1em] uppercase truncate">
                                {student.phone_number}
                              </span>
                            </a>
                          ) : (
                            <div className="flex items-center gap-2.5 opacity-25">
                              <div className="bg-white/10 p-2 rounded-lg">
                                <Phone className="w-3.5 h-3.5" />
                              </div>
                              <span className="text-[12px] font-black tracking-[0.1em] uppercase">
                                Private Connection
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}

                  {!loading && results.length === 0 && (
                    <div className="col-span-full w-full py-20 text-center bg-card/60 backdrop-blur-2xl rounded-[3rem] border border-white/5 shadow-2xl">
                      <Search strokeWidth={1} className="w-12 h-12 mx-auto text-[#d4af37]/40 mb-6" />
                      <h3 className="text-3xl font-black tracking-tighter text-foreground mb-4">No Profiles Located</h3>
                      <p className="text-muted-foreground/60 font-medium text-lg max-w-xs mx-auto mb-10 leading-relaxed">
                        We were unable to locate an alumni match based on your search criteria.
                      </p>
                      <button
                        onClick={() => { setHasSearched(false); setQuery(''); }}
                        className="px-12 py-4 bg-foreground text-background font-black uppercase tracking-[0.2em] text-[11px] rounded-full hover:scale-105 active:scale-95 transition-all shadow-2xl shadow-black/20"
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
    </>
  )
}