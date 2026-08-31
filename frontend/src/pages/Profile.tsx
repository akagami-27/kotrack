import {
  useEffect,
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

const MAX_IMAGE_SIZE = 20 * 1024 * 1024
const MAX_AVATAR_SIZE = 450_000
const AVATAR_SIZE = 256

export default function Profile() {
  const { user, updateUser } = useAuth()

  const [name, setName] = useState(
    user?.name ?? '',
  )

  const [avatar, setAvatar] =
    useState<string | null>(
      user?.avatar_data ?? null,
    )

  const [saving, setSaving] =
    useState(false)

  const [loading, setLoading] =
    useState(true)

  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  /* ---------------------------------------------------------------------- */
  /* LOAD PROFILE                                                           */
  /* ---------------------------------------------------------------------- */

  useEffect(() => {
    let cancelled = false

    async function loadProfile() {
      try {
        setError('')

        const data =
          await apiRequest<UserProfile>(
            '/api/users/me',
          )

        if (cancelled) {
          return
        }

        setName(data.name)
        setAvatar(data.avatar_data)
      } catch (err) {
        if (cancelled) {
          return
        }

        setError(
          err instanceof Error
            ? err.message
            : 'Unable to load profile.',
        )
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    loadProfile()

    return () => {
      cancelled = true
    }
  }, [])

  /* ---------------------------------------------------------------------- */
  /* CHANGE IMAGE                                                           */
  /* ---------------------------------------------------------------------- */

  async function handleImageChange(
    event: ChangeEvent<HTMLInputElement>,
  ) {
    const file =
      event.target.files?.[0] ?? null

    // Reset the input so the same photo
    // can be selected again later.
    event.target.value = ''

    if (!file || saving) {
      return
    }

    setError('')
    setSuccess('')

    try {
      const compressed =
        await compressAvatar(file)

      setAvatar(compressed)

      setSuccess(
        'Picture selected. Tap Save profile to apply it.',
      )
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Unable to process this picture.',
      )
    }
  }

  /* ---------------------------------------------------------------------- */
  /* REMOVE IMAGE                                                           */
  /* ---------------------------------------------------------------------- */

  async function handleRemoveAvatar() {
    if (!avatar || saving) {
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

      setAvatar(null)
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

  /* ---------------------------------------------------------------------- */
  /* SAVE PROFILE                                                           */
  /* ---------------------------------------------------------------------- */

  async function handleSave() {
    const trimmedName = name.trim()

    if (!trimmedName) {
      setError('Name cannot be empty.')
      return
    }

    if (saving) {
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

  /* ---------------------------------------------------------------------- */
  /* LOADING                                                                */
  /* ---------------------------------------------------------------------- */

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#070910] text-white">
        <p className="text-xs text-white/40 sm:text-sm">
          Loading profile...
        </p>
      </main>
    )
  }

  const displayName =
    name.trim() || 'Your profile'

  const initial =
    name.trim().charAt(0).toUpperCase() || '?'

  return (
    <main className="min-h-screen overflow-x-hidden bg-[#070910] text-white">
      {/* Background */}

      <div className="pointer-events-none fixed inset-0">
        <div className="absolute left-1/2 top-[-300px] h-[600px] w-[600px] -translate-x-1/2 rounded-full bg-violet-500/[0.07] blur-[150px]" />

        <div className="absolute bottom-[-250px] left-[-150px] h-[500px] w-[500px] rounded-full bg-blue-500/[0.05] blur-[150px]" />
      </div>

      {/* Header */}

      <header className="relative z-10 border-b border-white/[0.06]">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-4 sm:px-8 sm:py-5">
          <Link
            to="/dashboard"
            className="flex items-center gap-2.5"
          >
            <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/10 bg-white/[0.04] sm:h-9 sm:w-9 sm:rounded-xl">
              <span className="text-sm font-bold">
                K
              </span>
            </div>

            <div>
              <p className="text-xs font-semibold sm:text-sm">
                KoTrack
              </p>

              <p className="text-[8px] uppercase tracking-wider text-white/25 sm:text-[10px]">
                Profile
              </p>
            </div>
          </Link>

          <Link
            to="/dashboard"
            className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-[10px] text-white/50 transition hover:bg-white/[0.07] hover:text-white sm:px-4 sm:text-xs"
          >
            Dashboard
          </Link>
        </div>
      </header>

      {/* Content */}

      <div className="relative z-10 mx-auto max-w-3xl px-4 py-6 sm:px-8 sm:py-10">
        {/* Heading */}

        <div className="mb-5 sm:mb-8">
          <p className="text-[9px] uppercase tracking-[0.16em] text-white/25 sm:text-xs">
            Account
          </p>

          <div className="mt-2 flex flex-col gap-3 sm:mt-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
                Profile
              </h1>

              <p className="mt-1.5 text-[10px] leading-4 text-white/35 sm:mt-2 sm:text-sm sm:leading-5">
                Manage your account information and
                profile picture.
              </p>
            </div>

            <Link
              to="/settings"
              className="inline-flex w-fit items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-[10px] font-medium text-white/55 transition hover:bg-white/[0.07] hover:text-white sm:px-4 sm:py-2.5 sm:text-xs"
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
            className={`mb-4 rounded-xl border px-3 py-2.5 text-[10px] leading-4 sm:mb-6 sm:px-4 sm:py-3 sm:text-sm ${
              error
                ? 'border-red-400/10 bg-red-400/[0.05] text-red-300'
                : 'border-emerald-400/10 bg-emerald-400/[0.05] text-emerald-300'
            }`}
          >
            {error || success}
          </div>
        )}

        {/* Profile */}

        <section className="rounded-2xl border border-white/[0.08] bg-white/[0.025] p-4 shadow-[0_30px_100px_rgba(0,0,0,0.25)] backdrop-blur-xl sm:rounded-3xl sm:p-8">
          {/* Avatar */}

          <div className="grid gap-4 sm:grid-cols-[auto_1fr] sm:items-center sm:gap-6">
            <div className="flex justify-center sm:justify-start">
              {avatar ? (
                <img
                  src={avatar}
                  alt="Profile avatar"
                  loading="lazy"
                  decoding="async"
                  className="h-24 w-24 rounded-2xl border border-white/10 object-cover sm:h-28 sm:w-28 sm:rounded-3xl"
                />
              ) : (
                <div className="flex h-24 w-24 items-center justify-center rounded-2xl border border-white/10 bg-gradient-to-br from-violet-400/[0.12] to-blue-400/[0.08] text-3xl font-semibold text-white/70 sm:h-28 sm:w-28 sm:rounded-3xl sm:text-4xl">
                  {initial}
                </div>
              )}
            </div>

            {/* Avatar controls */}

            <div className="min-w-0 text-center sm:text-left">
              <p className="text-[9px] uppercase tracking-[0.14em] text-white/25 sm:text-xs">
                Profile picture
              </p>

              <h2 className="mt-1.5 truncate text-base font-semibold sm:mt-2 sm:text-lg">
                {displayName}
              </h2>

              <p className="mx-auto mt-1.5 max-w-md text-[9px] leading-4 text-white/30 sm:mx-0 sm:mt-2 sm:text-xs sm:leading-5">
                JPG, PNG, WebP and other browser-supported
                image files are automatically resized and
                converted to WebP.
              </p>

              <div className="mt-3 flex flex-col gap-2 sm:mt-4 sm:flex-row">
                {/* Change */}

                <label
                  className={`inline-flex min-h-10 cursor-pointer items-center justify-center rounded-xl bg-white px-4 py-2.5 text-[10px] font-semibold text-black transition hover:bg-white/90 sm:text-xs ${
                    saving
                      ? 'pointer-events-none opacity-50'
                      : ''
                  }`}
                >
                  Change picture

                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleImageChange}
                    disabled={saving}
                    className="sr-only"
                  />
                </label>

                {/* Remove */}

                {avatar && (
                  <button
                    type="button"
                    onClick={handleRemoveAvatar}
                    disabled={saving}
                    className="inline-flex min-h-10 items-center justify-center rounded-xl border border-white/10 px-4 py-2.5 text-[10px] text-white/50 transition hover:border-red-400/20 hover:bg-red-400/[0.05] hover:text-red-300 disabled:cursor-not-allowed disabled:opacity-40 sm:text-xs"
                  >
                    {saving
                      ? 'Removing...'
                      : 'Remove picture'}
                  </button>
                )}
              </div>
            </div>
          </div>

          <div className="my-5 border-t border-white/[0.06] sm:my-8" />

          {/* Name */}

          <div>
            <label
              htmlFor="profile-name"
              className="mb-1.5 block text-[10px] font-medium text-white/50 sm:mb-2 sm:text-xs"
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
              autoComplete="name"
              className="min-h-10 w-full rounded-xl border border-white/[0.08] bg-black/20 px-3 py-2.5 text-xs text-white outline-none transition placeholder:text-white/15 focus:border-violet-400/30 focus:bg-white/[0.03] disabled:cursor-not-allowed disabled:opacity-50 sm:px-4 sm:py-3 sm:text-sm"
            />
          </div>

          {/* Account information */}

          <div className="mt-4 grid grid-cols-2 gap-2.5 sm:mt-5 sm:gap-5">
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
            className="mt-5 min-h-10 w-full rounded-xl bg-white py-2.5 text-xs font-semibold text-black transition hover:bg-white/90 disabled:cursor-not-allowed disabled:opacity-50 sm:mt-7 sm:py-3"
          >
            {saving
              ? 'Saving changes...'
              : 'Save profile'}
          </button>
        </section>

        {/* Settings */}

        <section className="mt-4 rounded-2xl border border-white/[0.06] bg-white/[0.02] p-3.5 sm:mt-6 sm:p-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs font-medium text-white/65 sm:text-sm">
                Account settings
              </p>

              <p className="mt-1 text-[9px] leading-4 text-white/30 sm:text-xs sm:leading-5">
                Change your password and manage account
                security.
              </p>
            </div>

            <Link
              to="/settings"
              className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-4 py-2.5 text-[10px] font-medium text-white/50 transition hover:bg-white/[0.07] hover:text-white sm:text-xs"
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
/* Profile Value                                                            */
/* ========================================================================= */

function ProfileValue({
  label,
  value,
}: {
  label: string
  value: string
}) {
  return (
    <div className="min-w-0">
      <p className="mb-1.5 text-[9px] font-medium text-white/50 sm:mb-2 sm:text-xs">
        {label}
      </p>

      <div className="truncate rounded-xl border border-white/[0.06] bg-black/10 px-3 py-2.5 text-[10px] text-white/40 sm:px-4 sm:py-3 sm:text-sm">
        {value}
      </div>
    </div>
  )
}

/* ========================================================================= */
/* Avatar Compression                                                       */
/* ========================================================================= */

async function compressAvatar(
  file: File,
): Promise<string> {
  if (!file.type.startsWith('image/')) {
    throw new Error(
      'Please select a valid image file.',
    )
  }

  if (file.size <= 0) {
    throw new Error(
      'The selected image is empty.',
    )
  }

  if (file.size > MAX_IMAGE_SIZE) {
    throw new Error(
      'Please select an image smaller than 20 MB.',
    )
  }

  const objectUrl =
    URL.createObjectURL(file)

  try {
    const image =
      await loadImage(objectUrl)

    const scale = Math.min(
      1,
      AVATAR_SIZE /
        Math.max(
          image.naturalWidth,
          image.naturalHeight,
        ),
    )

    const width = Math.max(
      1,
      Math.round(
        image.naturalWidth * scale,
      ),
    )

    const height = Math.max(
      1,
      Math.round(
        image.naturalHeight * scale,
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

    context.imageSmoothingEnabled = true
    context.imageSmoothingQuality = 'high'

    context.drawImage(
      image,
      0,
      0,
      width,
      height,
    )

    /*
     * The backend requires WebP.
     */
    const webp =
      canvas.toDataURL(
        'image/webp',
        0.82,
      )

    /*
     * Safari/browser does not support WebP
     * conversion through Canvas.
     */
    if (
      !webp.startsWith(
        'data:image/webp;base64,',
      )
    ) {
      throw new Error(
        'This browser cannot convert the selected picture to WebP. Please update Safari or use a newer browser.',
      )
    }

    /*
     * Try stronger compression if necessary.
     */
    if (webp.length > MAX_AVATAR_SIZE) {
      const smaller =
        canvas.toDataURL(
          'image/webp',
          0.65,
        )

      if (
        !smaller.startsWith(
          'data:image/webp;base64,',
        )
      ) {
        throw new Error(
          'Unable to create a compatible WebP image.',
        )
      }

      if (
        smaller.length >
        MAX_AVATAR_SIZE
      ) {
        throw new Error(
          'The image is still too large after compression. Please choose another picture.',
        )
      }

      return smaller
    }

    return webp
  } finally {
    URL.revokeObjectURL(objectUrl)
  }
}

/* ========================================================================= */
/* Image Loader                                                              */
/* ========================================================================= */

function loadImage(
  source: string,
): Promise<HTMLImageElement> {
  return new Promise(
    (resolve, reject) => {
      const image =
        new Image()

      image.onload = () => {
        if (
          image.naturalWidth <= 0 ||
          image.naturalHeight <= 0
        ) {
          reject(
            new Error(
              'The selected image could not be read.',
            ),
          )
          return
        }

        resolve(image)
      }

      image.onerror = () => {
        reject(
          new Error(
            'This image format cannot be read by your browser. Please try JPG or PNG.',
          ),
        )
      }

      image.src = source
    },
  )
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
      aria-hidden="true"
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
      aria-hidden="true"
    >
      <path d="M5 12h13" />
      <path d="m13 6 6 6-6 6" />
    </svg>
  )
}