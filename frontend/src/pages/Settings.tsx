import { useState } from 'react'
import { Link } from 'react-router-dom'

import { apiRequest } from '../api/client'

type User = {
  id: number
  name: string
  role: string
  is_active: boolean
  created_at: string
  avatar_data: string | null
}

export default function Settings() {
  const [currentPassword, setCurrentPassword] =
    useState('')

  const [newPassword, setNewPassword] =
    useState('')

  const [confirmPassword, setConfirmPassword] =
    useState('')

  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  async function handleChangePassword() {
    setError('')
    setSuccess('')

    if (
      !currentPassword ||
      !newPassword ||
      !confirmPassword
    ) {
      setError('Please complete all password fields.')
      return
    }

    if (newPassword !== confirmPassword) {
      setError('New passwords do not match.')
      return
    }

    if (newPassword.length < 8) {
      setError(
        'New password must be at least 8 characters.',
      )
      return
    }

    if (currentPassword === newPassword) {
      setError(
        'New password must be different from the current password.',
      )
      return
    }

    setSaving(true)

    try {
      await apiRequest<User>(
        '/api/users/me/password',
        {
          method: 'POST',
          body: JSON.stringify({
            current_password: currentPassword,
            new_password: newPassword,
          }),
        },
      )

      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')

      setSuccess(
        'Password changed successfully.',
      )
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Unable to change password.',
      )
    } finally {
      setSaving(false)
    }
  }

  return (
    <main className="min-h-screen bg-[#070910] text-white">
      <div className="mx-auto max-w-3xl px-5 py-10 sm:px-8">

        <div className="mb-8 flex items-center justify-between gap-4">

          <div>
            <p className="text-xs uppercase tracking-[0.16em] text-white/25">
              Account
            </p>

            <h1 className="mt-2 text-3xl font-semibold">
              Settings
            </h1>

            <p className="mt-2 text-sm text-white/35">
              Manage your account security.
            </p>
          </div>

          <Link
            to="/profile"
            className="rounded-xl border border-white/10 bg-white/[0.03] px-4 py-2 text-xs text-white/50 transition hover:bg-white/[0.07] hover:text-white"
          >
            Profile
          </Link>

        </div>

        {(error || success) && (
          <div
            className={`mb-6 rounded-xl border px-4 py-3 text-sm ${
              error
                ? 'border-red-400/10 bg-red-400/[0.05] text-red-300'
                : 'border-emerald-400/10 bg-emerald-400/[0.05] text-emerald-300'
            }`}
          >
            {error || success}
          </div>
        )}

        <section className="rounded-3xl border border-white/[0.08] bg-white/[0.025] p-6 sm:p-8">

          <p className="text-xs uppercase tracking-[0.14em] text-white/25">
            Security
          </p>

          <h2 className="mt-2 text-lg font-semibold">
            Change password
          </h2>

          <p className="mt-2 text-sm leading-6 text-white/30">
            Your current password is required before a new
            password can be saved.
          </p>

          <div className="mt-7 space-y-5">

            <PasswordField
              id="current-password"
              label="Current password"
              value={currentPassword}
              onChange={setCurrentPassword}
              disabled={saving}
              autoComplete="current-password"
            />

            <PasswordField
              id="new-password"
              label="New password"
              value={newPassword}
              onChange={setNewPassword}
              disabled={saving}
              autoComplete="new-password"
            />

            <PasswordField
              id="confirm-password"
              label="Confirm new password"
              value={confirmPassword}
              onChange={setConfirmPassword}
              disabled={saving}
              autoComplete="new-password"
            />

          </div>

          <button
            type="button"
            onClick={handleChangePassword}
            disabled={
              saving ||
              !currentPassword ||
              !newPassword ||
              !confirmPassword
            }
            className="mt-7 w-full rounded-xl bg-white py-3 text-xs font-semibold text-black transition hover:bg-white/90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {saving
              ? 'Changing password...'
              : 'Change password'}
          </button>

        </section>

        <section className="mt-6 rounded-2xl border border-white/[0.06] bg-white/[0.02] p-5">
          <div className="flex gap-4">

            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/[0.03] text-xs text-white/50">
              i
            </div>

            <div>
              <p className="text-sm font-medium text-white/60">
                Profile pictures
              </p>

              <p className="mt-1 text-xs leading-5 text-white/30">
                Profile pictures are resized and compressed
                before being stored. Your original high-resolution
                image is not uploaded to the server.
              </p>
            </div>

          </div>
        </section>

      </div>
    </main>
  )
}


function PasswordField({
  id,
  label,
  value,
  onChange,
  disabled,
  autoComplete,
}: {
  id: string
  label: string
  value: string
  onChange: (value: string) => void
  disabled: boolean
  autoComplete: string
}) {
  return (
    <div>
      <label
        htmlFor={id}
        className="mb-2 block text-xs font-medium text-white/50"
      >
        {label}
      </label>

      <input
        id={id}
        type="password"
        value={value}
        onChange={(event) =>
          onChange(event.target.value)
        }
        disabled={disabled}
        autoComplete={autoComplete}
        minLength={8}
        className="w-full rounded-xl border border-white/[0.08] bg-black/20 px-4 py-3 text-sm outline-none transition focus:border-white/20 disabled:opacity-50"
      />
    </div>
  )
}