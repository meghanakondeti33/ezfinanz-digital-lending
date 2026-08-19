"""
Email Service.

Handles email dispatch, HTML email templating, secure verification token generation,
cryptographic token verification, and rate limiting with mock/development fallback.
"""

import base64
import hashlib
import hmac
import json
import logging
import time
from datetime import datetime, timezone
from typing import Any

from app.core.config import settings
from app.core.exceptions import RateLimitError, ServiceUnavailableError, UnauthorizedError, ValidationError

logger = logging.getLogger(__name__)

# In-memory storage for test/mock outbox and rate limit tracking
MOCK_OUTBOX: list[dict[str, Any]] = []
_RESEND_TIMESTAMPS: dict[str, float] = {}


def create_email_verification_token(user_id: str, email: str) -> str:
    """
    Generate a secure, URL-safe, time-limited, tamper-evident email verification token.
    Payload: {"uid": user_id, "em": email, "iat": timestamp, "exp": expiration_timestamp}
    Signature: HMAC-SHA256(payload_b64, secret)
    """
    now = int(time.time())
    exp = now + (settings.EMAIL_VERIFICATION_TOKEN_EXPIRE_HOURS * 3600)
    
    payload = {
        "uid": str(user_id),
        "em": email.strip().lower(),
        "iat": now,
        "exp": exp,
    }
    
    payload_json = json.dumps(payload, separators=(',', ':'), sort_keys=True)
    payload_b64 = base64.urlsafe_b64encode(payload_json.encode('utf-8')).decode('utf-8').rstrip('=')
    
    sig = hmac.new(
        settings.JWT_SECRET_KEY.encode('utf-8'),
        payload_b64.encode('utf-8'),
        hashlib.sha256
    ).digest()
    sig_b64 = base64.urlsafe_b64encode(sig).decode('utf-8').rstrip('=')
    
    return f"{payload_b64}.{sig_b64}"


def verify_email_verification_token(token: str) -> dict[str, Any]:
    """
    Verify the cryptographic signature and expiration of an email verification token.
    Returns the decoded payload dict: {"uid": ..., "em": ..., "iat": ..., "exp": ...}
    Raises UnauthorizedError or ValidationError on invalid, expired, or tampered tokens.
    """
    if not token or "." not in token:
        raise ValidationError("Invalid verification token format.")
    
    parts = token.split(".")
    if len(parts) != 2:
        raise ValidationError("Malformed verification token structure.")
    
    payload_b64, sig_b64 = parts
    
    # Verify HMAC signature
    expected_sig = hmac.new(
        settings.JWT_SECRET_KEY.encode('utf-8'),
        payload_b64.encode('utf-8'),
        hashlib.sha256
    ).digest()
    
    try:
        # Re-pad base64
        padding_needed = (4 - len(sig_b64) % 4) % 4
        actual_sig = base64.urlsafe_b64decode(sig_b64 + '=' * padding_needed)
    except Exception:
        raise UnauthorizedError("Invalid or tampered verification token signature.")
    
    if not hmac.compare_digest(expected_sig, actual_sig):
        raise UnauthorizedError("Invalid or tampered verification token signature.")
    
    # Decode and parse payload
    try:
        padding_needed = (4 - len(payload_b64) % 4) % 4
        payload_json = base64.urlsafe_b64decode(payload_b64 + '=' * padding_needed).decode('utf-8')
        payload = json.loads(payload_json)
    except Exception:
        raise ValidationError("Failed to parse verification token payload.")
    
    # Check expiration
    now = int(time.time())
    if now > payload.get("exp", 0):
        raise UnauthorizedError("Verification link has expired. Please request a new verification email.")
    
    if not payload.get("uid") or not payload.get("em"):
        raise ValidationError("Missing required user data in verification token.")
    
    return payload


def check_resend_rate_limit(email: str) -> None:
    """
    Enforces resend cooldown on verification emails (default 60s).
    """
    clean_email = email.strip().lower()
    last_sent = _RESEND_TIMESTAMPS.get(clean_email)
    now = time.time()
    
    if last_sent:
        elapsed = now - last_sent
        cooldown = settings.EMAIL_RESEND_COOLDOWN_SECONDS
        if elapsed < cooldown:
            remaining = int(cooldown - elapsed)
            raise RateLimitError(
                f"Please wait {remaining} seconds before requesting another verification email."
            )
    
    _RESEND_TIMESTAMPS[clean_email] = now


def send_verification_email(email: str, token: str, full_name: str | None = None) -> dict[str, Any]:
    """
    Dispatches a verification email through real SMTP or records in mock outbox for mock mode.
    Fails loudly with ServiceUnavailableError if SMTP fails or is unconfigured in SMTP mode.
    Never exposes mock verification URLs when EMAIL_MODE=smtp.
    """
    check_resend_rate_limit(email)
    
    frontend_verify_url = f"{settings.FRONTEND_URL.rstrip('/')}/verify-email?token={token}"
    recipient_name = full_name or email.split("@")[0].capitalize()
    
    subject = "Verify your email address — EZFINANZ"
    
    html_content = f"""<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Verify your EZFINANZ email</title>
  <style>
    body {{ font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #F7F5F1; color: #14161A; margin: 0; padding: 24px; }}
    .card {{ max-width: 520px; margin: 0 auto; background: #FFFFFF; border: 1px solid #E5E2DC; border-radius: 16px; padding: 36px; box-shadow: 0 4px 20px rgba(0,0,0,0.06); }}
    .header {{ border-bottom: 2px solid #B5652D; padding-bottom: 16px; margin-bottom: 24px; }}
    .logo {{ font-size: 24px; font-weight: 800; color: #B5652D; letter-spacing: -0.5px; }}
    .title {{ font-size: 20px; font-weight: 700; color: #14161A; margin: 0 0 12px; }}
    .body-text {{ font-size: 14px; line-height: 1.6; color: #686D76; margin-bottom: 24px; }}
    .button {{ display: inline-block; background-color: #B5652D; color: #FFFFFF !important; font-weight: 700; font-size: 14px; text-decoration: none; padding: 14px 28px; border-radius: 12px; margin: 12px 0 24px; }}
    .footer {{ font-size: 11px; color: #8A8D93; border-top: 1px solid #E5E2DC; padding-top: 16px; margin-top: 24px; }}
  </style>
</head>
<body>
  <div class="card">
    <div class="header">
      <span class="logo">EZFINANZ</span>
    </div>
    <h1 class="title">Verify your email address</h1>
    <p class="body-text">
      Hello {recipient_name},<br><br>
      Please verify your email to secure your EZFINANZ account and complete your digital lending onboarding.
    </p>
    <div style="text-align: center;">
      <a href="{frontend_verify_url}" class="button">Verify Email →</a>
    </div>
    <p class="body-text" style="font-size: 12px;">
      Or copy and paste this link in your browser:<br>
      <a href="{frontend_verify_url}" style="color: #B5652D; word-break: break-all;">{frontend_verify_url}</a>
    </p>
    <div class="footer">
      This link will expire in {settings.EMAIL_VERIFICATION_TOKEN_EXPIRE_HOURS} hours. If you did not create an EZFINANZ account, you can safely ignore this email.
    </div>
  </div>
</body>
</html>"""

    email_mode = settings.EMAIL_MODE.lower().strip()
    
    if email_mode == "smtp":
        # Strict SMTP Mode — must have required credentials and must attempt real delivery
        if not settings.SMTP_USER or not settings.SMTP_PASSWORD or not settings.SMTP_HOST:
            logger.error("[EMAIL SERVICE] EMAIL_MODE=smtp but SMTP_USER, SMTP_PASSWORD, or SMTP_HOST is not configured.")
            raise ServiceUnavailableError("Email delivery is not configured correctly.")

        clean_user = settings.SMTP_USER.strip()
        clean_password = settings.SMTP_PASSWORD.replace(" ", "").strip()
        clean_host = settings.SMTP_HOST.strip()
        clean_from = settings.EMAIL_FROM.strip() if settings.EMAIL_FROM else clean_user

        try:
            import smtplib
            import ssl
            from email.mime.multipart import MIMEMultipart
            from email.mime.text import MIMEText

            msg = MIMEMultipart("alternative")
            msg["Subject"] = subject
            msg["From"] = clean_from
            msg["To"] = email

            text_part = MIMEText(
                f"Hello {recipient_name},\n\nPlease verify your email address for EZFINANZ by clicking this link:\n{frontend_verify_url}\n\nThis link will expire in {settings.EMAIL_VERIFICATION_TOKEN_EXPIRE_HOURS} hours.\n",
                "plain",
            )
            html_part = MIMEText(html_content, "html")
            msg.attach(text_part)
            msg.attach(html_part)

            if settings.SMTP_PORT == 465 or not settings.SMTP_USE_TLS:
                context = ssl.create_default_context()
                with smtplib.SMTP_SSL(clean_host, settings.SMTP_PORT, context=context, timeout=15) as server:
                    server.login(clean_user, clean_password)
                    server.sendmail(clean_from, [email], msg.as_string())
            else:
                context = ssl.create_default_context()
                with smtplib.SMTP(clean_host, settings.SMTP_PORT, timeout=15) as server:
                    server.starttls(context=context)
                    server.login(clean_user, clean_password)
                    server.sendmail(clean_from, [email], msg.as_string())

            logger.info(f"[EMAIL SERVICE (SMTP)] Verification email successfully delivered to {email}")
        except Exception as e:
            logger.error(f"[EMAIL SERVICE (SMTP ERROR)] Failed to dispatch email via SMTP to {email}: {type(e).__name__} - {str(e)}")
            raise ServiceUnavailableError("Unable to send verification email. Please try again.")

        return {
            "status": "sent",
            "to": email,
            "mode": "smtp",
            "verify_url": None,
            "cooldown_seconds": settings.EMAIL_RESEND_COOLDOWN_SECONDS,
        }

    else:
        # Explicit Mock Mode
        email_record = {
            "to": email,
            "from": settings.EMAIL_FROM,
            "subject": subject,
            "token": token,
            "verify_url": frontend_verify_url,
            "html_content": html_content,
            "sent_at": datetime.now(timezone.utc).isoformat(),
            "mode": "mock",
        }
        MOCK_OUTBOX.append(email_record)
        logger.info(f"[EMAIL SERVICE (MOCK)] Verification email recorded for {email}. Link: {frontend_verify_url}")

        return {
            "status": "sent",
            "to": email,
            "mode": "mock",
            "verify_url": frontend_verify_url,
            "cooldown_seconds": settings.EMAIL_RESEND_COOLDOWN_SECONDS,
        }
