"""Validation helpers for user-provided images and payment receipts."""

import base64
import binascii


MAX_AVATAR_DATA_URL_LENGTH = 500_000

_AVATAR_PREFIXES = {
    "data:image/webp;base64": "webp",
    "data:image/jpeg;base64": "jpeg",
}

_HEIC_BRANDS = {
    b"heic",
    b"heix",
    b"hevc",
    b"hevx",
    b"heim",
    b"heis",
    b"hevm",
    b"hevs",
}
_HEIF_BRANDS = {b"mif1", b"msf1"}


def validate_avatar_data(data_url: str) -> None:
    """Accept only bounded, correctly encoded JPEG or WebP avatar data."""
    if len(data_url) > MAX_AVATAR_DATA_URL_LENGTH:
        raise ValueError("Avatar image is too large")

    try:
        prefix, encoded = data_url.split(",", 1)
    except ValueError as exc:
        raise ValueError("Avatar must be a valid JPEG or WebP image") from exc

    image_format = _AVATAR_PREFIXES.get(prefix)
    if image_format is None or not encoded:
        raise ValueError("Avatar must be a valid JPEG or WebP image")

    try:
        image_data = base64.b64decode(encoded, validate=True)
    except (binascii.Error, ValueError) as exc:
        raise ValueError("Avatar image data is invalid") from exc

    if image_format == "webp":
        is_valid_image = (
            len(image_data) >= 12
            and image_data[:4] == b"RIFF"
            and image_data[8:12] == b"WEBP"
        )
    else:
        is_valid_image = image_data.startswith(b"\xff\xd8\xff")

    if not is_valid_image:
        raise ValueError("Avatar image data does not match its file type")


def detect_receipt_content_type(data: bytes) -> str | None:
    """Return a supported content type only when the file signature matches."""
    if data.startswith(b"%PDF-"):
        return "application/pdf"

    if data.startswith(b"\xff\xd8\xff"):
        return "image/jpeg"

    if data.startswith(b"\x89PNG\r\n\x1a\n"):
        return "image/png"

    if (
        len(data) >= 12
        and data[:4] == b"RIFF"
        and data[8:12] == b"WEBP"
    ):
        return "image/webp"

    if len(data) >= 16 and data[4:8] == b"ftyp":
        brand_limit = min(len(data) - 3, 64)
        brands = {data[8:12]}
        brands.update(
            data[offset : offset + 4]
            for offset in range(16, brand_limit, 4)
        )
        if brands & _HEIC_BRANDS:
            return "image/heic"
        if brands & _HEIF_BRANDS:
            return "image/heif"

    return None
