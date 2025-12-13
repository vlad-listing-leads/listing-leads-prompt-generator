'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Spinner } from '@/components/ui/spinner'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { User, Mail, Lock, AlertTriangle, Trash2, Shield } from 'lucide-react'

export default function AccountPage() {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(true)
  const [user, setUser] = useState<{ id: string; email: string } | null>(null)
  const [isMemberstackUser, setIsMemberstackUser] = useState(false)

  // Form states
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [email, setEmail] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')

  // Loading states
  const [isSavingName, setIsSavingName] = useState(false)
  const [isSavingEmail, setIsSavingEmail] = useState(false)
  const [isSavingPassword, setIsSavingPassword] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)

  // Messages
  const [nameMessage, setNameMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [emailMessage, setEmailMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [passwordMessage, setPasswordMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [deleteMessage, setDeleteMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  // Delete confirmation
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [deleteConfirmText, setDeleteConfirmText] = useState('')

  useEffect(() => {
    const fetchUser = async () => {
      const supabase = createClient()

      const { data: { user } } = await supabase.auth.getUser()

      if (!user) {
        router.push('/login')
        return
      }

      setUser({ id: user.id, email: user.email || '' })
      setEmail(user.email || '')

      // Fetch profile
      const { data: profile } = await supabase
        .from('profiles')
        .select('first_name, last_name, memberstack_id')
        .eq('id', user.id)
        .single()

      if (profile) {
        setFirstName(profile.first_name || '')
        setLastName(profile.last_name || '')
        setIsMemberstackUser(!!profile.memberstack_id)
      }

      setIsLoading(false)
    }

    fetchUser()
  }, [router])

  const handleUpdateName = async () => {
    if (!user) return

    setIsSavingName(true)
    setNameMessage(null)

    try {
      const supabase = createClient()

      const { error } = await supabase
        .from('profiles')
        .update({
          first_name: firstName,
          last_name: lastName,
          full_name: `${firstName} ${lastName}`.trim()
        })
        .eq('id', user.id)

      if (error) throw error

      setNameMessage({ type: 'success', text: 'Name updated successfully' })
    } catch (err) {
      setNameMessage({ type: 'error', text: err instanceof Error ? err.message : 'Failed to update name' })
    } finally {
      setIsSavingName(false)
    }
  }

  const handleUpdateEmail = async () => {
    if (!user) return

    setIsSavingEmail(true)
    setEmailMessage(null)

    try {
      const supabase = createClient()

      const { error } = await supabase.auth.updateUser({ email })

      if (error) throw error

      setEmailMessage({ type: 'success', text: 'Check your new email for a confirmation link' })
    } catch (err) {
      setEmailMessage({ type: 'error', text: err instanceof Error ? err.message : 'Failed to update email' })
    } finally {
      setIsSavingEmail(false)
    }
  }

  const handleUpdatePassword = async () => {
    if (!user) return

    if (newPassword !== confirmPassword) {
      setPasswordMessage({ type: 'error', text: 'Passwords do not match' })
      return
    }

    if (newPassword.length < 6) {
      setPasswordMessage({ type: 'error', text: 'Password must be at least 6 characters' })
      return
    }

    setIsSavingPassword(true)
    setPasswordMessage(null)

    try {
      const supabase = createClient()

      const { error } = await supabase.auth.updateUser({ password: newPassword })

      if (error) throw error

      setPasswordMessage({
        type: 'success',
        text: isMemberstackUser
          ? 'Password set! You can now log in directly with your email and password.'
          : 'Password updated successfully'
      })
      setNewPassword('')
      setConfirmPassword('')
    } catch (err) {
      setPasswordMessage({ type: 'error', text: err instanceof Error ? err.message : 'Failed to update password' })
    } finally {
      setIsSavingPassword(false)
    }
  }

  const handleDeleteAccount = async () => {
    if (deleteConfirmText !== 'DELETE') {
      setDeleteMessage({ type: 'error', text: 'Please type DELETE to confirm' })
      return
    }

    setIsDeleting(true)
    setDeleteMessage(null)

    try {
      const response = await fetch('/api/account/delete', {
        method: 'DELETE',
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || 'Failed to delete account')
      }

      // Sign out and redirect
      const supabase = createClient()
      await supabase.auth.signOut()
      router.push('/login')
    } catch (err) {
      setDeleteMessage({ type: 'error', text: err instanceof Error ? err.message : 'Failed to delete account' })
      setIsDeleting(false)
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Spinner size="lg" />
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-white">Account Settings</h1>
        <p className="mt-1 text-gray-400">Manage your account information and security</p>
      </div>

      <div className="space-y-6">
        {/* Update Name */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="w-5 h-5" />
              Display Name
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="firstName">First Name</Label>
                  <Input
                    id="firstName"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    placeholder="John"
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label htmlFor="lastName">Last Name</Label>
                  <Input
                    id="lastName"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    placeholder="Doe"
                    className="mt-1"
                  />
                </div>
              </div>
              {nameMessage && (
                <p className={`text-sm ${nameMessage.type === 'success' ? 'text-green-400' : 'text-red-400'}`}>
                  {nameMessage.text}
                </p>
              )}
              <Button
                onClick={handleUpdateName}
                disabled={isSavingName}
                variant="outline"
              >
                {isSavingName ? <Spinner size="sm" /> : 'Update Name'}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Update Email */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Mail className="w-5 h-5" />
              Email Address
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Enter your email"
                  className="mt-1"
                />
              </div>
              {emailMessage && (
                <p className={`text-sm ${emailMessage.type === 'success' ? 'text-green-400' : 'text-red-400'}`}>
                  {emailMessage.text}
                </p>
              )}
              <Button
                onClick={handleUpdateEmail}
                disabled={isSavingEmail || email === user?.email}
                variant="outline"
              >
                {isSavingEmail ? <Spinner size="sm" /> : 'Update Email'}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Update Password */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Lock className="w-5 h-5" />
              {isMemberstackUser ? 'Set Password' : 'Password'}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {isMemberstackUser && (
                <div className="flex items-start gap-3 p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg">
                  <Shield className="w-5 h-5 text-blue-400 mt-0.5 flex-shrink-0" />
                  <div className="text-sm text-gray-300">
                    <p className="font-medium text-blue-400 mb-1">Optional: Set a direct login password</p>
                    <p className="text-gray-400">
                      You're signed in via Memberstack. You can optionally set a password to log in directly to this app without going through the main site.
                    </p>
                  </div>
                </div>
              )}
              <div>
                <Label htmlFor="newPassword">{isMemberstackUser ? 'Password' : 'New Password'}</Label>
                <Input
                  id="newPassword"
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder={isMemberstackUser ? 'Enter a password' : 'Enter new password'}
                  className="mt-1"
                />
              </div>
              <div>
                <Label htmlFor="confirmPassword">Confirm Password</Label>
                <Input
                  id="confirmPassword"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Confirm password"
                  className="mt-1"
                />
              </div>
              {passwordMessage && (
                <p className={`text-sm ${passwordMessage.type === 'success' ? 'text-green-400' : 'text-red-400'}`}>
                  {passwordMessage.text}
                </p>
              )}
              <Button
                onClick={handleUpdatePassword}
                disabled={isSavingPassword || !newPassword || !confirmPassword}
                variant="outline"
              >
                {isSavingPassword ? <Spinner size="sm" /> : (isMemberstackUser ? 'Set Password' : 'Update Password')}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Danger Zone */}
        <Card className="border-red-500/20">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-red-400">
              <AlertTriangle className="w-5 h-5" />
              Danger Zone
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <p className="text-sm text-gray-400">
                Once you delete your account, there is no going back. All your designs and data will be permanently removed.
              </p>

              {!showDeleteConfirm ? (
                <Button
                  onClick={() => setShowDeleteConfirm(true)}
                  variant="outline"
                  className="border-red-500/50 text-red-400 hover:bg-red-500/10 hover:text-red-300"
                >
                  <Trash2 className="w-4 h-4 mr-2" />
                  Delete Account
                </Button>
              ) : (
                <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl space-y-4">
                  <p className="text-sm text-red-400 font-medium">
                    Are you absolutely sure? This action cannot be undone.
                  </p>
                  <div>
                    <Label htmlFor="deleteConfirm" className="text-red-400">
                      Type DELETE to confirm
                    </Label>
                    <Input
                      id="deleteConfirm"
                      value={deleteConfirmText}
                      onChange={(e) => setDeleteConfirmText(e.target.value)}
                      placeholder="DELETE"
                      className="mt-1 border-red-500/30 focus:border-red-500"
                    />
                  </div>
                  {deleteMessage && (
                    <p className={`text-sm ${deleteMessage.type === 'success' ? 'text-green-400' : 'text-red-400'}`}>
                      {deleteMessage.text}
                    </p>
                  )}
                  <div className="flex gap-2">
                    <Button
                      onClick={() => {
                        setShowDeleteConfirm(false)
                        setDeleteConfirmText('')
                        setDeleteMessage(null)
                      }}
                      variant="outline"
                    >
                      Cancel
                    </Button>
                    <Button
                      onClick={handleDeleteAccount}
                      disabled={isDeleting || deleteConfirmText !== 'DELETE'}
                      className="bg-red-500 hover:bg-red-600 text-white border-0"
                    >
                      {isDeleting ? <Spinner size="sm" /> : 'Delete My Account'}
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
