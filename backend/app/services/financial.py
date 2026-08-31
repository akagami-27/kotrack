"""
Financial calculation logic for drink sessions.

Everything here uses `Decimal` exclusively. Python `float` must never be
used for money: floats cannot represent values like 0.1 or 9.375 exactly,
which leads to off-by-a-cent totals and non-reproducible rounding.

The backend is the single source of truth for `total_cost` and
`amount_owed`. Callers (API layer) must always compute these values with
the functions below rather than accepting them from a client.
"""
from decimal import ROUND_HALF_UP, Decimal

CENTS = Decimal("0.01")


def _to_money(value: Decimal) -> Decimal:
    """Round a Decimal to exactly 2 decimal places (cents), half-up."""
    return value.quantize(CENTS, rounding=ROUND_HALF_UP)


def calculate_session_total(packets_used: Decimal, price_per_packet: Decimal) -> Decimal:
    """
    Compute the total cost of a drink session.

    Example: 1.5 packets x RM25.00 = RM37.50
    """
    packets_used = Decimal(packets_used)
    price_per_packet = Decimal(price_per_packet)

    if packets_used <= 0:
        raise ValueError("packets_used must be greater than zero")
    if price_per_packet <= 0:
        raise ValueError("price_per_packet must be greater than zero")

    raw_total = packets_used * price_per_packet
    return _to_money(raw_total)


def split_amount(total: Decimal, num_participants: int) -> list[Decimal]:
    """
    Split `total` into `num_participants` amounts that:

      1. Are each valid 2-decimal-place money values.
      2. Sum EXACTLY back to `total` (no rounding drift).

    The algorithm is deterministic: it works entirely in integer cents, so
    the same inputs always produce the same outputs regardless of platform
    or floating-point behavior.

    Approach (largest-remainder-free, purely positional):
      - Convert the total to integer cents.
      - Every participant gets `total_cents // n` cents as a base share.
      - The `total_cents % n` leftover cents are distributed one each to
        the first `remainder` participants (by position in the returned
        list). Callers that need the extra cents assigned to specific
        people should pass participants in a defined, stable order (e.g.
        sorted by user_id) so the distribution is reproducible.

    Example: RM37.50 across 4 participants ->
      [RM9.38, RM9.38, RM9.37, RM9.37]  (sum == RM37.50 exactly)
    """
    if num_participants <= 0:
        raise ValueError("num_participants must be greater than zero")

    total = _to_money(Decimal(total))
    total_cents = int((total * 100).to_integral_value(rounding=ROUND_HALF_UP))

    base_cents, remainder_cents = divmod(total_cents, num_participants)

    amounts_cents = [
        base_cents + (1 if i < remainder_cents else 0)
        for i in range(num_participants)
    ]

    amounts = [Decimal(c) / Decimal(100) for c in amounts_cents]

    # Defensive invariant check -- must always hold by construction.
    assert sum(amounts) == total, "split_amount rounding invariant violated"

    return amounts


def split_session_cost(
    total_cost: Decimal, user_ids: list[int]
) -> dict[int, Decimal]:
    """
    Split a session's total cost between the given participant user IDs.

    Participants are sorted by user_id before splitting so that the
    distribution of "extra cent" remainders is deterministic and
    independent of the order the caller happened to supply.

    Raises ValueError if `user_ids` contains duplicates (a user cannot
    appear twice in the same session).
    """
    if not user_ids:
        raise ValueError("A session must have at least one participant")

    if len(set(user_ids)) != len(user_ids):
        raise ValueError("Duplicate user_id in participant list")

    sorted_ids = sorted(user_ids)
    amounts = split_amount(total_cost, len(sorted_ids))

    return dict(zip(sorted_ids, amounts))
