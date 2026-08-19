"""
Tests for Indian Bank Registry and IFSC Validation (Feature 4).
"""

import pytest
from app.core.banks import SUPPORTED_BANKS, get_supported_banks, validate_bank_and_ifsc


def test_supported_banks_list():
    """
    Ensure top Indian banks exist with valid canonical prefixes.
    """
    banks = get_supported_banks()
    assert len(banks) >= 15

    bank_codes = {b["code"] for b in banks}
    assert "SBI" in bank_codes
    assert "HDFC" in bank_codes
    assert "ICICI" in bank_codes
    assert "AXIS" in bank_codes
    assert "KOTAK" in bank_codes
    assert "PNB" in bank_codes
    assert "BOB" in bank_codes
    assert "CANARA" in bank_codes


def test_valid_bank_and_ifsc_combinations():
    """
    Test correct matching bank and IFSC codes pass validation.
    """
    # HDFC
    valid, err = validate_bank_and_ifsc("HDFC Bank", "HDFC0001234")
    assert valid is True
    assert err is None

    # SBI
    valid, err = validate_bank_and_ifsc("State Bank of India", "SBIN0000456")
    assert valid is True
    assert err is None

    # Axis (UTIB)
    valid, err = validate_bank_and_ifsc("Axis Bank", "UTIB0000789")
    assert valid is True
    assert err is None

    # Kotak (KKBK)
    valid, err = validate_bank_and_ifsc("Kotak Mahindra Bank", "KKBK0000321")
    assert valid is True
    assert err is None


def test_mismatched_bank_and_ifsc_rejected():
    """
    Test that mismatched bank and IFSC prefix is rejected with explanatory message.
    """
    # HDFC bank selected, but SBI IFSC entered
    valid, err = validate_bank_and_ifsc("HDFC Bank", "SBIN0001234")
    assert valid is False
    assert "does not match HDFC Bank" in err
    assert "HDFC" in err

    # SBI selected, but ICICI IFSC entered
    valid, err = validate_bank_and_ifsc("State Bank of India", "ICIC0001234")
    assert valid is False
    assert "does not match State Bank of India" in err
    assert "SBIN" in err


def test_invalid_ifsc_format_rejected():
    """
    Test general format validation (11 chars, 5th char 0).
    """
    # Too short
    valid, err = validate_bank_and_ifsc("HDFC Bank", "HDFC123")
    assert valid is False
    assert "Invalid IFSC format" in err

    # Non-zero 5th character
    valid, err = validate_bank_and_ifsc("HDFC Bank", "HDFC1001234")
    assert valid is False
    assert "Invalid IFSC format" in err
