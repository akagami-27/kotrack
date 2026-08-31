import {
  useState,
  type ChangeEvent,
} from 'react'
import { Link } from 'react-router-dom'

import { apiRequest } from '../api/client'
import { useAuth } from '../auth/AuthContext'

type UserProfile = {
  id: number
  name: string
  role: string
  is_active: boolean
  created_at: string
  avatar_data: string | null
}

export default function Profile() {
  const { user, updateUser } = useAuth()

  const [name, setName] =
    useState(user?.name ?? '')

  const [avatar, setAvatar] =
    useState<string | null>(
      user?.avatar_data ?? null,
    )

  const [saving, setSaving] =
    useState(false)

  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  async function handleImageChange(
    event: ChangeEvent<HTMLInputElement>,
  ) {
    const file =
      event.target.files?.[0]

    if (!file) {
      return
    }

    try {
      setError('')
      setSuccess('')

      const compressed =
        await compressAvatar(file)

      setAvatar(compressed)

      setSuccess(
        'New profile picture selected. Save your profile to apply it.',
      )
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Unable to process image.',
      )
    } finally {
      event.target.value = ''
    }
  }

  async function handleRemoveAvatar() {
    if (!avatar) {
      return
    }

    setSaving(true)
    setError('')
    setSuccess('')

    try {
      const updated =
        await apiRequest<UserProfile>(
          '/api/users/me',
          {
            method: 'PATCH',
            body: JSON.stringify({
              avatar_data: null,
            }),
          },
        )

      setAvatar(updated.avatar_data)

      updateUser(updated)

      setSuccess(
        'Profile picture removed successfully.',
      )
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Unable to remove profile picture.',
      )
    } finally {
      setSaving(false)
    }
  }

  async function handleSave() {
    const trimmedName =
      name.trim()

    if (!trimmedName) {
      setError('Name cannot be empty.')
      return
    }

    setSaving(true)
    setError('')
    setSuccess('')

    try {
      const updated =
        await apiRequest<UserProfile>(
          '/api/users/me',
          {
            method: 'PATCH',
            body: JSON.stringify({
              name: trimmedName,
              avatar_data: avatar,
            }),
          },
        )

      setName(updated.name)
      setAvatar(updated.avatar_data)

      updateUser(updated)

      setSuccess(
        'Profile updated successfully.',
      )
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Unable to update profile.',
      )
    } finally {
      setSaving(false)
    }
  }

  return (
    <main className="min-h-screen overflow-hidden bg-[#070910] text-white">

      {/* Ambient background */}
      <div className="pointer-events-none fixed inset-0">
        <div className="absolute left-1/2 top-[-300px] h-[600px] w-[600px] -translate-x-1/2 rounded-full bg-violet-500/[0.07] blur-[150px]" />

        <div className="absolute bottom-[-250px] left-[-150px] h-[500px] w-[500px] rounded-full bg-blue-500/[0.05] blur-[150px]" />
      </div>

      {/* Header */}
      <header className="relative z-10 border-b border-white/[0.06]">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-5 py-5 sm:px-8">

          <Link
            to="/dashboard"
            className="flex items-center gap-3"
          >
            <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04]">
              <span className="font-bold">
                K
              </span>
            </div>

            <div>
              <p className="text-sm font-semibold">
                KoTrack
              </p>

              <p className="text-[10px] uppercase tracking-wider text-white/25">
                Profile
              </p>
            </div>
          </Link>

          <Link
            to="/dashboard"
            className="rounded-xl border border-white/10 bg-white/[0.03] px-4 py-2 text-xs text-white/50 transition hover:bg-white/[0.07] hover:text-white"
          >
            Dashboard
          </Link>

        </div>
      </header>

      {/* Content */}
      <div className="relative z-10 mx-auto max-w-3xl px-5 py-10 sm:px-8">

        {/* Heading */}
        <div className="mb-8">

          <p className="text-xs uppercase tracking-[0.16em] text-white/25">
            Account
          </p>

          <div className="mt-3 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">

            <div>
              <h1 className="text-3xl font-semibold tracking-tight">
                Profile
              </h1>

              <p className="mt-2 text-sm text-white/35">
                Manage your account information and profile picture.
              </p>
            </div>

            <Link
              to="/settings"
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-4 py-2.5 text-xs font-medium text-white/55 transition hover:border-violet-400/20 hover:bg-white/[0.07] hover:text-white"
            >
              <SettingsIcon />
              Settings
            </Link>

          </div>
        </div>

        {/* Messages */}
        {(error || success) && (
          <div
            role="alert"
            className={`mb-6 rounded-xl border px-4 py-3 text-sm ${
              error
                ? 'border-red-400/10 bg-red-400/[0.05] text-red-300'
                : 'border-emerald-400/10 bg-emerald-400/[0.05] text-emerald-300'
            }`}
          >
            {error || success}
          </div>
        )}

        {/* Profile card */}
        <section className="rounded-3xl border border-white/[0.08] bg-white/[0.025] p-6 shadow-[0_30px_100px_rgba(0,0,0,0.25)] backdrop-blur-xl sm:p-8">

          {/* Avatar */}
          <div className="flex flex-col gap-6 sm:flex-row sm:items-center">

            <div className="shrink-0">

              {avatar ? (
                <img
                  src={avatar}
                  alt="Profile avatar"
                  className="h-28 w-28 rounded-3xl border border-white/10 object-cover shadow-[0_0_40px_rgba(139,92,246,0.08)]"
                />
              ) : (
                <div className="flex h-28 w-28 items-center justify-center rounded-3xl border border-white/10 bg-gradient-to-br from-violet-400/[0.12] to-blue-400/[0.08] text-4xl font-semibold text-white/70">
                  {name
                    .charAt(0)
                    .toUpperCase() || '?'}
                </div>
              )}

            </div>

            <div className="min-w-0">

              <p className="text-xs uppercase tracking-[0.14em] text-white/25">
                Profile picture
              </p>

              <h2 className="mt-2 text-lg font-semibold">
                {name || 'Your profile'}
              </h2>

              <p className="mt-2 max-w-md text-xs leading-5 text-white/30">
                Images are automatically resized to a maximum
                of 256×256 pixels and converted to compressed
                WebP before being uploaded.
              </p>

              <div className="mt-4 flex flex-wrap gap-2">

                <label className="cursor-pointer rounded-xl bg-white px-4 py-2.5 text-xs font-semibold text-black transition hover:bg-white/90">

                  Change picture

                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleImageChange}
                    disabled={saving}
                    className="hidden"
                  />

                </label>

                {avatar && (
                  <button
                    type="button"
                    onClick={handleRemoveAvatar}
                    disabled={saving}
                    className="rounded-xl border border-white/10 px-4 py-2.5 text-xs text-white/50 transition hover:border-red-400/20 hover:bg-red-400/[0.05] hover:text-red-300 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    {saving
                      ? 'Removing...'
                      : 'Remove picture'}
                  </button>
                )}

              </div>

            </div>

          </div>

          <div className="my-8 border-t border-white/[0.06]" />

          {/* Name */}
          <div>

            <label
              htmlFor="profile-name"
              className="mb-2 block text-xs font-medium text-white/50"
            >
              Name
            </label>

            <input
              id="profile-name"
              type="text"
              value={name}
              onChange={(event) =>
                setName(event.target.value)
              }
              maxLength={255}
              disabled={saving}
              className="w-full rounded-xl border border-white/[0.08] bg-black/20 px-4 py-3 text-sm text-white outline-none transition placeholder:text-white/15 focus:border-violet-400/30 focus:bg-white/[0.03] disabled:cursor-not-allowed disabled:opacity-50"
            />

          </div>

          {/* Account information */}
          <div className="mt-5 grid gap-5 sm:grid-cols-2">

            <ProfileValue
              label="User ID"
              value={`#${user?.id ?? '—'}`}
            />

            <ProfileValue
              label="Role"
              value={user?.role ?? 'USER'}
            />

            <ProfileValue
              label="Account status"
              value={
                user?.is_active
                  ? 'Active'
                  : 'Inactive'
              }
            />

            <ProfileValue
              label="Member since"
              value={
                user?.created_at
                  ? new Date(
                      user.created_at,
                    ).toLocaleDateString(
                      'en-MY',
                      {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric',
                      },
                    )
                  : '—'
              }
            />

          </div>

          {/* Save */}
          <button
            type="button"
            onClick={handleSave}
            disabled={
              saving ||
              !name.trim()
            }
            className="mt-7 w-full rounded-xl bg-white py-3 text-xs font-semibold text-black shadow-[0_0_30px_rgba(255,255,255,0.05)] transition hover:bg-white/90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {saving
              ? 'Saving changes...'
              : 'Save profile'}
          </button>

        </section>

        {/* Settings */}
        <section className="mt-6 rounded-2xl border border-white/[0.06] bg-white/[0.02] p-5">

          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">

            <div>
              <p className="text-sm font-medium text-white/65">
                Account settings
              </p>

              <p className="mt-1 text-xs leading-5 text-white/30">
                Change your password and manage account security.
              </p>
            </div>

            <Link
              to="/settings"
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-4 py-2.5 text-xs font-medium text-white/50 transition hover:border-violet-400/20 hover:bg-white/[0.07] hover:text-white"
            >
              Open settings
              <ArrowIcon />
            </Link>

          </div>

        </section>

      </div>
    </main>
  )
}


/* ========================================================================= */
/* Profile Value                                                             */
/* ========================================================================= */

function ProfileValue({
  label,
  value,
}: {
  label: string
  value: string
}) {
  return (
    <div>

      <p className="mb-2 text-xs font-medium text-white/50">
        {label}
      </p>

      <div className="rounded-xl border border-white/[0.06] bg-black/10 px-4 py-3 text-sm text-white/40">
        {value}
      </div>

    </div>
  )
}


/* ========================================================================= */
/* Avatar Compression                                                        */
/* ========================================================================= */

async function compressAvatar(
  file: File,
): Promise<string> {
  if (!file.type.startsWith('image/')) {
    throw new Error(
      'Please select an image file.',
    )
  }

  if (file.size > 10 * 1024 * 1024) {
    throw new Error(
      'Please select an image smaller than 10 MB.',
    )
  }

  if (!('createImageBitmap' in window)) {
    throw new Error(
      'Your browser does not support image processing.',
    )
  }

  const bitmap =
    await createImageBitmap(file)

  try {
    const maxSize = 256

    const scale = Math.min(
      1,
      maxSize /
        Math.max(
          bitmap.width,
          bitmap.height,
        ),
    )

    const width = Math.max(
      1,
      Math.round(
        bitmap.width * scale,
      ),
    )

    const height = Math.max(
      1,
      Math.round(
        bitmap.height * scale,
      ),
    )

    const canvas =
      document.createElement('canvas')

    canvas.width = width
    canvas.height = height

    const context =
      canvas.getContext('2d')

    if (!context) {
      throw new Error(
        'Unable to process the selected image.',
      )
    }

    context.drawImage(
      bitmap,
      0,
      0,
      width,
      height,
    )

    const result =
      canvas.toDataURL(
        'image/webp',
        0.8,
      )

    if (
      !result.startsWith(
        'data:image/webp;base64,',
      )
    ) {
      throw new Error(
        'Your browser could not create a WebP image.',
      )
    }

    if (result.length > 450_000) {
      throw new Error(
        'The compressed image is still too large. Please choose another picture.',
      )
    }

    return result

  } finally {
    bitmap.close()
  }
}


/* ========================================================================= */
/* Icons                                                                     */
/* ========================================================================= */

function SettingsIcon() {
  return (
    <svg
      width="15"
      height="15"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
    >
      <circle
        cx="12"
        cy="12"
        r="3"
      />

      <path d="M19 12a7 7 0 0 0-.1-1.2l2-1.5-2-3.4-2.4 1a7.5 7.5 0 0 0-2-1.2L14.2 3h-4.4l-.3 2.7a7.5 7.5 0 0 0-2 1.2l-2.4-1-2 3.4 2 1.5 2 1.5a7 7 0 0 0 0 2.4l-2 1.5 2 3.4 2.4-1a7.5 7.5 0 0 0 2 1.2l.3 2.7h4.4l.3-2.7a7.5 7.5 0 0 0 2-1.2l2.4 1 2-3.4-2-1.5c.1-.4.1-.8.1-1.2Z" />
    </svg>
  )
}


function ArrowIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
    >
      <path d="M5 12h13" />
      <path d="m13 6 6 6-6 6" />
    </svg>
  )
}