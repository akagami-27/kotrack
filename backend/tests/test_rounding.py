"""
Tests for the deterministic money-splitting / rounding algorithm.

Every test enforces the core invariant demanded by the spec:

    sum(all participant amounts) == session total   (EXACTLY, no drift)

and that every individual amount is a valid 2-decimal-place value.
"""
from decimal import Decimal

import pytest

from app.services.financial import (
    calculate_session_total,
    split_amount,
    split_session_cost,
)

TWO_PLACES = Decimal("0.01")


def _assert_valid_split(total: Decimal, amounts: list[Decimal]) -> None:
    # Every amount must already be quantized to exactly 2 decimal places.
    for amount in amounts:
        assert amount == amount.quantize(TWO_PLACES)

    # The amounts must sum EXACTLY back to the total -- no rounding drift.
    assert sum(amounts) == total


@pytest.mark.parametrize(
    "total_str,n",
    [
        ("25.00", 1),
        ("25.00", 2),
        ("25.00", 3),
        ("25.00", 7),
        ("25.00", 8),
        ("12.50", 3),
        ("37.50", 4),
        ("37.50", 7),
    ],
)
def test_split_amount_sums_exactly(total_str, n):
    total = Decimal(total_str)
    amounts = split_amount(total, n)

    assert len(amounts) == n
    _assert_valid_split(total, amounts)


def test_split_25_over_2_is_even():
    amounts = split_amount(Decimal("25.00"), 2)
    assert amounts == [Decimal("12.50"), Decimal("12.50")]


def test_split_25_over_3_matches_expected_cents():
    # 2500 cents / 3 = 833 remainder 1 -> one participant gets an extra cent.
    amounts = split_amount(Decimal("25.00"), 3)
    assert sorted(amounts) == sorted(
        [Decimal("8.34"), Decimal("8.33"), Decimal("8.33")]
    )
    assert sum(amounts) == Decimal("25.00")


def test_split_25_over_7():
    # 2500 / 7 = 357 remainder 1
    amounts = split_amount(Decimal("25.00"), 7)
    assert amounts.count(Decimal("3.58")) == 1
    assert amounts.count(Decimal("3.57")) == 6
    assert sum(amounts) == Decimal("25.00")


def test_split_25_over_8_is_even():
    # 2500 / 8 = 312.5 -> not integer cents-per-person, but total is exact.
    amounts = split_amount(Decimal("25.00"), 8)
    assert sum(amounts) == Decimal("25.00")
    assert amounts.count(Decimal("3.13")) == 4
    assert amounts.count(Decimal("3.12")) == 4


def test_split_37_50_over_4_matches_spec_example():
    # From the spec: RM37.50 / 4 -> 9.37, 9.37, 9.38, 9.38 (in some order),
    # total EXACTLY RM37.50.
    amounts = split_amount(Decimal("37.50"), 4)
    assert sorted(amounts) == sorted(
        [Decimal("9.37"), Decimal("9.37"), Decimal("9.38"), Decimal("9.38")]
    )
    assert sum(amounts) == Decimal("37.50")


def test_split_37_50_over_7():
    amounts = split_amount(Decimal("37.50"), 7)
    assert len(amounts) == 7
    assert sum(amounts) == Decimal("37.50")


def test_split_is_deterministic():
    """Calling split_amount repeatedly with the same inputs must always
    produce the exact same output (no reliance on dict ordering, randomness,
    float rounding modes, etc.)."""
    results = {tuple(split_amount(Decimal("37.50"), 4)) for _ in range(50)}
    assert len(results) == 1


def test_split_amount_rejects_zero_or_negative_participants():
    with pytest.raises(ValueError):
        split_amount(Decimal("25.00"), 0)
    with pytest.raises(ValueError):
        split_amount(Decimal("25.00"), -1)


def test_calculate_session_total_basic():
    # 1.5 packets x RM25.00 = RM37.50
    assert calculate_session_total(Decimal("1.5"), Decimal("25.00")) == Decimal("37.50")


def test_calculate_session_total_whole_and_half_packets():
    assert calculate_session_total(Decimal("1"), Decimal("25.00")) == Decimal("25.00")
    assert calculate_session_total(Decimal("2"), Decimal("25.00")) == Decimal("50.00")
    assert calculate_session_total(Decimal("0.5"), Decimal("25.00")) == Decimal("12.50")


def test_calculate_session_total_rejects_non_positive_input():
    with pytest.raises(ValueError):
        calculate_session_total(Decimal("0"), Decimal("25.00"))
    with pytest.raises(ValueError):
        calculate_session_total(Decimal("1"), Decimal("0"))


def test_split_session_cost_maps_user_ids_to_amounts_and_sums_exactly():
    total = calculate_session_total(Decimal("1.5"), Decimal("25.00"))  # 37.50
    split = split_session_cost(total, [101, 102, 103, 104])

    assert set(split.keys()) == {101, 102, 103, 104}
    assert sum(split.values()) == Decimal("37.50")
    for amount in split.values():
        assert amount == amount.quantize(TWO_PLACES)


def test_split_session_cost_rejects_duplicate_participants():
    with pytest.raises(ValueError):
        split_session_cost(Decimal("25.00"), [1, 2, 2])


def test_split_session_cost_rejects_empty_participant_list():
    with pytest.raises(ValueError):
        split_session_cost(Decimal("25.00"), [])


def test_split_session_cost_is_order_independent():
    """Splitting for the same set of participants gives the same per-user
    amounts regardless of the order user_ids are supplied in, because the
    service sorts them before splitting."""
    total = Decimal("37.50")
    split_a = split_session_cost(total, [4, 3, 2, 1])
    split_b = split_session_cost(total, [1, 2, 3, 4])
    assert split_a == split_b
