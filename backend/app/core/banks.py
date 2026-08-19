"""
Curated Indian Bank Registry and Bank-Specific IFSC Code Validation.

Contains standard IFSC prefixes, bank metadata, and strict format validation rules.
"""

import re
from typing import TypedDict


class BankInfo(TypedDict):
    name: str
    code: str
    ifsc_prefix: str
    example_ifsc: str


SUPPORTED_BANKS: list[BankInfo] = [
    {
        "name": "State Bank of India",
        "code": "SBI",
        "ifsc_prefix": "SBIN",
        "example_ifsc": "SBIN0001234",
    },
    {
        "name": "HDFC Bank",
        "code": "HDFC",
        "ifsc_prefix": "HDFC",
        "example_ifsc": "HDFC0001234",
    },
    {
        "name": "ICICI Bank",
        "code": "ICICI",
        "ifsc_prefix": "ICIC",
        "example_ifsc": "ICIC0001234",
    },
    {
        "name": "Axis Bank",
        "code": "AXIS",
        "ifsc_prefix": "UTIB",
        "example_ifsc": "UTIB0001234",
    },
    {
        "name": "Kotak Mahindra Bank",
        "code": "KOTAK",
        "ifsc_prefix": "KKBK",
        "example_ifsc": "KKBK0001234",
    },
    {
        "name": "Punjab National Bank",
        "code": "PNB",
        "ifsc_prefix": "PUNB",
        "example_ifsc": "PUNB0001234",
    },
    {
        "name": "Bank of Baroda",
        "code": "BOB",
        "ifsc_prefix": "BARB",
        "example_ifsc": "BARB0001234",
    },
    {
        "name": "Canara Bank",
        "code": "CANARA",
        "ifsc_prefix": "CNRB",
        "example_ifsc": "CNRB0001234",
    },
    {
        "name": "Union Bank of India",
        "code": "UNION",
        "ifsc_prefix": "UBIN",
        "example_ifsc": "UBIN0001234",
    },
    {
        "name": "Indian Bank",
        "code": "INDIAN",
        "ifsc_prefix": "IDIB",
        "example_ifsc": "IDIB0001234",
    },
    {
        "name": "IDBI Bank",
        "code": "IDBI",
        "ifsc_prefix": "IBKL",
        "example_ifsc": "IBKL0001234",
    },
    {
        "name": "IndusInd Bank",
        "code": "INDUSIND",
        "ifsc_prefix": "INDB",
        "example_ifsc": "INDB0001234",
    },
    {
        "name": "Federal Bank",
        "code": "FEDERAL",
        "ifsc_prefix": "FDRL",
        "example_ifsc": "FDRL0001234",
    },
    {
        "name": "Yes Bank",
        "code": "YES",
        "ifsc_prefix": "YESB",
        "example_ifsc": "YESB0001234",
    },
    {
        "name": "Bank of India",
        "code": "BOI",
        "ifsc_prefix": "BKID",
        "example_ifsc": "BKID0001234",
    },
]

# Quick lookup maps
BANK_BY_NAME = {b["name"].lower(): b for b in SUPPORTED_BANKS}
BANK_BY_CODE = {b["code"].upper(): b for b in SUPPORTED_BANKS}

IFSC_REGEX = re.compile(r"^[A-Z]{4}0[A-Z0-9]{6}$")


def get_supported_banks() -> list[BankInfo]:
    """
    Returns the list of configured supported Indian banks.
    """
    return SUPPORTED_BANKS


def validate_bank_and_ifsc(bank_name: str, ifsc_code: str) -> tuple[bool, str | None]:
    """
    Validates general IFSC format AND verifies that the IFSC prefix matches the chosen bank.
    Returns (is_valid: bool, error_message: str | None).
    """
    clean_ifsc = (ifsc_code or "").strip().upper()
    clean_bank = (bank_name or "").strip()

    if not clean_ifsc:
        return False, "IFSC code is required."

    if not IFSC_REGEX.match(clean_ifsc):
        return False, "Invalid IFSC format. IFSC must be 11 alphanumeric characters (e.g. HDFC0001234, 5th character must be '0')."

    # Find bank in registry
    matched_bank = BANK_BY_NAME.get(clean_bank.lower())
    if not matched_bank:
        # Check by code or partial name
        for b in SUPPORTED_BANKS:
            if b["code"].lower() in clean_bank.lower() or clean_bank.lower() in b["name"].lower():
                matched_bank = b
                break

    if matched_bank:
        expected_prefix = matched_bank["ifsc_prefix"]
        if not clean_ifsc.startswith(expected_prefix):
            return False, (
                f"This IFSC code does not match {matched_bank['name']}. "
                f"Expected prefix '{expected_prefix}' (e.g. {matched_bank['example_ifsc']})."
            )

    return True, None
