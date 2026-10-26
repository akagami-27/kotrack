import base64
from types import SimpleNamespace

import pytest

from app.api.users import update_my_profile
from app.schemas.user import UserUpdate
from app.services.upload_validation import (
    detect_receipt_content_type,
    validate_avatar_data,
)


def _data_url(content_type: str, data: bytes) -> str:
    encoded = base64.b64encode(data).decode("ascii")
    return f"data:{content_type};base64,{encoded}"


@pytest.mark.parametrize(
    ("content_type", "data"),
    [
        (
            "image/webp",
            b"RIFF" + (4).to_bytes(4, "little") + b"WEBP",
        ),
        ("image/jpeg", b"\xff\xd8\xffavatar"),
    ],
)
def test_avatar_validation_accepts_browser_output(
    content_type: str,
    data: bytes,
) -> None:
    validate_avatar_data(_data_url(content_type, data))


@pytest.mark.parametrize(
    "data_url",
    [
        "not-a-data-url",
        "data:image/png;base64,iVBORw0KGgo=",
        "data:image/jpeg;base64,not base64!",
        _data_url("image/jpeg", b"not a jpeg"),
        _data_url("image/webp", b"not a webp"),
    ],
)
def test_avatar_validation_rejects_invalid_or_unsupported_data(
    data_url: str,
) -> None:
    with pytest.raises(ValueError):
        validate_avatar_data(data_url)


def test_avatar_validation_enforces_encoded_size_limit() -> None:
    with pytest.raises(ValueError, match="too large"):
        validate_avatar_data("x" * 500_001)


@pytest.mark.parametrize(
    ("data", "content_type"),
    [
        (b"%PDF-1.7\nreceipt", "application/pdf"),
        (b"\xff\xd8\xffreceipt", "image/jpeg"),
        (b"\x89PNG\r\n\x1a\nreceipt", "image/png"),
        (
            b"RIFF" + (4).to_bytes(4, "little") + b"WEBP",
            "image/webp",
        ),
        (
            (20).to_bytes(4, "big") + b"ftypheic" + b"\0" * 4 + b"heic",
            "image/heic",
        ),
        (
            (20).to_bytes(4, "big") + b"ftypmif1" + b"\0" * 4 + b"mif1",
            "image/heif",
        ),
    ],
)
def test_receipt_detection_accepts_supported_signatures(
    data: bytes,
    content_type: str,
) -> None:
    assert detect_receipt_content_type(data) == content_type


@pytest.mark.parametrize(
    "data",
    [b"", b"<html>not a receipt</html>", b"MZ\x00\x00executable"],
)
def test_receipt_detection_rejects_unsupported_signatures(
    data: bytes,
) -> None:
    assert detect_receipt_content_type(data) is None


class _FakeDatabase:
    def flush(self) -> None:
        pass

    def commit(self) -> None:
        pass

    def refresh(self, _user: object) -> None:
        pass

    def rollback(self) -> None:
        pass


def test_profile_patch_distinguishes_omitted_avatar_from_null() -> None:
    user = SimpleNamespace(name="Ari", avatar_data="existing-avatar")
    database = _FakeDatabase()

    updated = update_my_profile(
        UserUpdate(),
        current_user=user,
        db=database,  # type: ignore[arg-type]
    )
    assert updated.avatar_data == "existing-avatar"

    updated = update_my_profile(
        UserUpdate(avatar_data=None),
        current_user=user,  # type: ignore[arg-type]
        db=database,  # type: ignore[arg-type]
    )
    assert updated.avatar_data is None
