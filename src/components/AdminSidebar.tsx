"use client"

import { useState } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { BarChart3, GraduationCap, LogOut, Plus, UserPlus, Users, Loader2, KeyRound } from "lucide-react"
import { updateAdminPassword } from "@/app/admin/actions"

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarSeparator,
  useSidebar,
} from "@/components/ui/sidebar"

const navItems = [
  {
    title: "Dashboard",
    href: "/admin",
    icon: BarChart3,
  },
  {
    title: "Alumni",
    href: "/admin/alumni",
    icon: UserPlus,
  },
  {
    title: "Batches",
    href: "/admin/batches",
    icon: Plus,
  },
  {
    title: "Users",
    href: "/admin/users",
    icon: Users,
  },
]

export function AdminSidebar({
  signOutAction,
}: {
  signOutAction: () => Promise<void>
}) {
  const pathname = usePathname()
  const [isOpen, setIsOpen] = useState(false)
  const [isUpdating, setIsUpdating] = useState(false)
  const [pwdFeedback, setPwdFeedback] = useState<{ type: 'error' | 'success', msg: string } | null>(null)
  const { setOpenMobile } = useSidebar()
  const [newPassword, setNewPassword] = useState('')

  async function handlePasswordChange(e: React.FormEvent) {
    e.preventDefault()
    if (newPassword.length < 6) {
      setPwdFeedback({ type: 'error', msg: 'Password must be at least 6 characters.' })
      return
    }

    setIsUpdating(true)
    setPwdFeedback(null)
    const res = await updateAdminPassword(newPassword)
    setIsUpdating(false)

    if (res.error) {
      setPwdFeedback({ type: 'error', msg: res.error })
    } else {
      setPwdFeedback({ type: 'success', msg: 'Password updated successfully.' })
      setNewPassword('')
      setTimeout(() => setIsOpen(false), 2000)
    }
  }

  return (
    <Sidebar variant="inset">
      <SidebarHeader className="h-14 flex justify-center px-4">
        <div className="flex items-center gap-3 w-full">
          <div className="flex aspect-square size-9 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <GraduationCap className="size-5" />
          </div>
          <div className="flex flex-col leading-none">
            <span className="font-bold text-sm tracking-tight">Admin Portal</span>
            <span className="text-[11px] text-muted-foreground">Alumni Directory</span>
          </div>
        </div>
      </SidebarHeader>

      <SidebarSeparator />

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Management</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {navItems.map((item) => (
                <SidebarMenuItem key={item.href}>
                  <SidebarMenuButton
                    isActive={pathname === item.href}
                    tooltip={item.title}
                    render={<Link href={item.href} />}
                    onClick={() => setOpenMobile(false)}
                  >
                    <item.icon className="size-4" />
                    <span>{item.title}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="pb-4 pt-0">
        <SidebarSeparator className="mb-2" />
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              onClick={() => {
                setIsOpen(true)
                setOpenMobile(false)
              }}
              tooltip="Change Password"
            >
              <KeyRound className="size-4" />
              <span>Change Password</span>
            </SidebarMenuButton>
          </SidebarMenuItem>

          <SidebarMenuItem>
            <form action={signOutAction} className="w-full">
              <SidebarMenuButton
                type="submit"
                tooltip="Sign Out"
                className="text-muted-foreground hover:text-destructive hover:bg-destructive/10"
              >
                <LogOut className="size-4" />
                <span>Sign Out</span>
              </SidebarMenuButton>
            </form>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>

      {/* Fallback Dialog using plain HTML if Shadcn wasn't fully set up here, or use pure custom overlay since it's just a simple action */}
      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4">
          <div className="bg-card w-full max-w-sm rounded-xl p-6 shadow-xl relative top-[-5%] border animate-in fade-in zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:fade-out data-[state=closed]:zoom-out-95">
            <h2 className="text-xl font-semibold mb-2">Change Password</h2>
            <p className="text-sm text-muted-foreground mb-4">Set a new password for your account.</p>

            <form onSubmit={handlePasswordChange}>
              {pwdFeedback && (
                <div className={`mb-4 p-3 text-sm rounded ${pwdFeedback.type === 'error' ? 'bg-destructive/10 text-destructive' : 'bg-emerald-500/10 text-emerald-500'}`}>
                  {pwdFeedback.msg}
                </div>
              )}
              <div className="space-y-2 mb-4">
                <label className="text-sm font-medium">New Password</label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  required
                />
              </div>
              <div className="flex justify-end gap-2">
                <button type="button" onClick={() => setIsOpen(false)} className="px-4 py-2 text-sm rounded-md hover:bg-muted font-medium">Cancel</button>
                <button type="submit" disabled={isUpdating} className="px-4 py-2 text-sm rounded-md bg-primary text-primary-foreground font-medium flex items-center">
                  {isUpdating ? <Loader2 className="size-4 animate-spin mr-2" /> : null}
                  Update Password
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </Sidebar>
  )
}
