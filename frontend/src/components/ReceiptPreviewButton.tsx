import { useState } from 'react'

import { apiBlobRequest } from '../api/client'

export default function ReceiptPreviewButton({
  paymentId,
  filename,
}: {
  paymentId: number
  filename: string
}) {
  const [opening, setOpening] = useState(false)
  const [error, setError] = useState('')

  async function handleOpen() {
    if (opening) return

    setOpening(true)
    setError('')

    // Reserve the tab during the user gesture so Safari permits the
    // authenticated request to finish before opening the receipt.
    const previewWindow = window.open('about:blank', '_blank')
    if (previewWindow) previewWindow.opener = null

    try {
      const receipt = await apiBlobRequest(
        `/api/payments/${paymentId}/receipt`,
      )
      const url = URL.createObjectURL(receipt)
      if (previewWindow && !previewWindow.closed) {
        previewWindow.location.replace(url)
      } else {
        const link = document.createElement('a')
        link.href = url
        link.download = filename
        document.body.append(link)
        link.click()
        link.remove()
      }

      window.setTimeout(() => URL.revokeObjectURL(url), 120_000)
    } catch (cause) {
      previewWindow?.close()
      setError(
        cause instanceof Error
          ? cause.message
          : 'Unable to open this receipt.',
      )
    } finally {
      setOpening(false)
    }
  }

  return (
    <div className="min-w-0">
      <button
        type="button"
        onClick={handleOpen}
        disabled={opening}
        aria-label={`${opening ? 'Opening' : 'View'} receipt ${filename}`}
        className="inline-flex min-h-11 items-center justify-center rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-xs font-medium text-white/65 transition hover:bg-white/[0.08] disabled:cursor-wait disabled:opacity-50"
      >
        {opening ? 'Opening...' : 'View receipt'}
      </button>
      {error && (
        <p role="alert" className="mt-1 text-xs text-red-300">
          {error}
        </p>
      )}
    </div>
  )
}
