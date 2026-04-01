import ThreeBackground from '@/components/ThreeBackground'
import PublicSearch from '@/components/PublicSearch'

export default function PublicPage() {
  return (
    <main className="relative flex min-h-screen min-h-dvh flex-col items-center justify-start bg-background text-foreground overflow-x-hidden">
      <ThreeBackground />
      <PublicSearch />
      
      {/* Footer / Branding */}
      <div className="relative z-50 w-full text-center py-8 text-muted-foreground text-xs font-medium tracking-wider pointer-events-none">
         © {new Date().getFullYear()} Alumni Association. All rights reserved.
      </div>
    </main>
  )
}
