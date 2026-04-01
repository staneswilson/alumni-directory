'use client'

import { useState } from 'react'
import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { Loader2, ShieldCheck, Lock } from 'lucide-react'

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
import { login } from './actions'

const formSchema = z.object({
  email: z.string().email({ message: 'Invalid email address.' }),
  password: z.string().min(6, { message: 'Password must be at least 6 characters.' }),
})

export default function LoginPage() {
  const [serverError, setServerError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      email: '',
      password: '',
    },
  })

  async function onSubmit(values: z.infer<typeof formSchema>) {
    setIsLoading(true)
    setServerError(null)
    const result = await login(values.email, values.password)
    
    if (result?.error) {
      setServerError(result.error)
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-dvh flex flex-col items-center justify-center bg-[#050505] p-4 relative overflow-hidden font-sans selection:bg-[#d4af37]/30 selection:text-white">
      {/* Premium Vignette Backgrounds */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(212,175,55,0.03)_0%,transparent_70%)] pointer-events-none" />
      <div className="absolute top-0 inset-x-0 h-40 bg-gradient-to-b from-[#d4af37]/5 to-transparent pointer-events-none" />
      
      <div className="w-full max-w-[420px] relative z-10 animate-in fade-in slide-in-from-bottom-8 duration-1000">
        
        {/* Header/Logo Area */}
        <div className="flex flex-col items-center text-center mb-10">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-zinc-900 border border-zinc-800 shadow-[0_0_30px_rgba(212,175,55,0.1)] mb-6">
            <ShieldCheck strokeWidth={1.5} className="w-8 h-8 text-[#d4af37]" />
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-white mb-2">
            Alumni Login
          </h1>
          <p className="text-zinc-500 text-sm font-medium tracking-wide">
            Access your directory account.
          </p>
        </div>

        {/* Login Card */}
        <div className="bg-zinc-950/80 backdrop-blur-2xl border border-zinc-800/80 rounded-[2rem] p-8 sm:p-10 shadow-2xl relative overflow-hidden">
          {/* Subtle top edge highlight */}
          <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-[#d4af37]/30 to-transparent" />

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem className="space-y-3">
                    <FormLabel className="text-zinc-400 font-semibold text-xs tracking-wider uppercase">Email Address</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="alumni@example.com"
                        className="h-14 bg-zinc-900/50 border-zinc-800 text-white placeholder:text-zinc-600 rounded-xl px-4 focus-visible:ring-1 focus-visible:ring-[#d4af37] focus-visible:border-[#d4af37]/50 transition-all font-medium text-base"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage className="text-red-400 text-xs font-medium" />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem className="space-y-3">
                    <FormLabel className="text-zinc-400 font-semibold text-xs tracking-wider uppercase">Password</FormLabel>
                    <FormControl>
                      <Input
                        type="password"
                        placeholder="••••••••"
                        className="h-14 bg-zinc-900/50 border-zinc-800 text-white placeholder:text-zinc-600 rounded-xl px-4 focus-visible:ring-1 focus-visible:ring-[#d4af37] focus-visible:border-[#d4af37]/50 transition-all font-medium text-lg tracking-widest"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage className="text-red-400 text-xs font-medium" />
                  </FormItem>
                )}
              />

              {serverError && (
                <div className="p-4 bg-red-950/30 border border-red-900/50 rounded-xl flex items-start gap-3 mt-4">
                  <Lock className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
                  <p className="text-sm text-red-400 font-medium leading-relaxed">
                    {serverError}
                  </p>
                </div>
              )}

              <Button 
                type="submit" 
                className="w-full h-14 bg-[#d4af37] hover:bg-[#e8c84a] text-black rounded-xl font-bold text-base transition-all duration-300 mt-8 shadow-[0_0_20px_rgba(212,175,55,0.2)] hover:shadow-[0_0_30px_rgba(212,175,55,0.4)]"
                disabled={isLoading}
              >
                {isLoading ? (
                  <span className="flex items-center">
                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                    Authenticating...
                  </span>
                ) : (
                  'Sign In'
                )}
              </Button>
            </form>
          </Form>
        </div>

        {/* Footer info */}
        <p className="text-center text-zinc-600 text-[10px] font-medium tracking-wide mt-10 uppercase">
          Powered by the Stanes Alumni Network
        </p>
      </div>
    </div>
  )
}
