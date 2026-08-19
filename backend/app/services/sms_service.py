"""
SMS Service Provider Abstraction.

Supports pluggable SMS providers for sending OTPs to Indian mobile numbers:
- Fast2SMS (Direct Quick OTP API, v3 Quick Route, and DLT SMS)
- 2Factor.in
- MSG91
- Twilio
- Mock/Demo Provider
"""

import abc
import logging
import httpx
from app.core.config import settings
from app.core.exceptions import AppException, InternalServerError

logger = logging.getLogger("ezfinanz.sms")


class BaseSMSProvider(abc.ABC):
    """Abstract Base Class for SMS delivery providers."""

    @abc.abstractmethod
    def send_otp(self, phone: str, otp: str) -> bool:
        """Send a 6-digit OTP code to the specified 10-digit mobile number."""
        pass


class MockSMSProvider(BaseSMSProvider):
    """Mock SMS provider for local testing and demo mode."""

    def send_otp(self, phone: str, otp: str) -> bool:
        masked = f"+91-******{phone[-4:]}"
        logger.info(f"[MOCK SMS] Mode=demo | Generated OTP code for {masked} (simulated delivery)")
        return True


class Fast2SMSProvider(BaseSMSProvider):
    """
    Fast2SMS Gateway (India).
    Supports Quick OTP route, v3 transactional route, and DLT SMS.
    """

    def __init__(self, api_key: str):
        self.api_key = api_key.strip() if api_key else ""
        self.url = "https://www.fast2sms.com/dev/bulkV2"

    def send_otp(self, phone: str, otp: str) -> bool:
        if not self.api_key:
            logger.error("[Fast2SMS] Missing SMS_API_KEY in backend environment.")
            raise InternalServerError("Fast2SMS API Key is not configured. Please set SMS_API_KEY in backend/.env.")

        clean_phone = phone.strip()
        masked_phone = f"+91-******{clean_phone[-4:]}"
        logger.info(f"[Fast2SMS] Initiating live carrier SMS dispatch to {masked_phone}...")

        headers = {
            "authorization": self.api_key,
            "Content-Type": "application/json",
        }

        # Attempt 1: Fast2SMS Quick OTP Route
        payload_otp = {
            "variables_values": otp,
            "route": "otp",
            "numbers": clean_phone,
        }

        try:
            with httpx.Client(timeout=12.0) as client:
                logger.info("[Fast2SMS] Dispatching request to Fast2SMS Bulk V2 API (route: otp)...")
                response = client.post(self.url, headers=headers, json=payload_otp)
                logger.info(f"[Fast2SMS] Gateway HTTP Status: {response.status_code}")

                data = response.json() if response.status_code in [200, 400] else {}

                if response.status_code == 200 and data.get("return") is True:
                    logger.info(f"[Fast2SMS] Live carrier SMS successfully delivered to {masked_phone}")
                    return True

                # Attempt 2: Fallback to Fast2SMS v3 Quick Route if OTP route requires domain verification
                logger.info("[Fast2SMS] Attempting fallback to Fast2SMS Quick Transactional route (route: v3)...")
                payload_v3 = {
                    "route": "v3",
                    "sender_id": "TXTIND",
                    "message": f"Your EZFINANZ verification code is: {otp}. Valid for 5 minutes.",
                    "language": "english",
                    "flash": 0,
                    "numbers": clean_phone,
                }
                res_v3 = client.post(self.url, headers=headers, json=payload_v3)
                logger.info(f"[Fast2SMS] Fallback Gateway HTTP Status: {res_v3.status_code}")

                data_v3 = res_v3.json() if res_v3.status_code in [200, 400] else {}
                if res_v3.status_code == 200 and data_v3.get("return") is True:
                    logger.info(f"[Fast2SMS] Live SMS successfully delivered via v3 to {masked_phone}")
                    return True

                # Extract provider error message
                err_msg = data.get("message") or data_v3.get("message")
                if isinstance(err_msg, list) and len(err_msg) > 0:
                    err_str = err_msg[0]
                else:
                    err_str = str(err_msg or "Fast2SMS rejected SMS delivery request.")

                logger.error(f"[Fast2SMS] Delivery failed. Provider response: {data or data_v3}")
                raise InternalServerError(f"Fast2SMS Provider Notice: {err_str}")

        except AppException:
            raise
        except Exception as exc:
            logger.error(f"[Fast2SMS] Network exception contacting SMS gateway: {exc}")
            raise InternalServerError(f"SMS network error: {str(exc)}") from exc


class TwoFactorProvider(BaseSMSProvider):
    """
    2Factor.in SMS Gateway (India).
    Dedicated Indian OTP service.
    """

    def __init__(self, api_key: str):
        self.api_key = api_key.strip() if api_key else ""

    def send_otp(self, phone: str, otp: str) -> bool:
        if not self.api_key:
            raise InternalServerError("2Factor API Key is missing in SMS_API_KEY.")

        clean_phone = phone.strip()
        masked_phone = f"+91-******{clean_phone[-4:]}"
        logger.info(f"[2Factor] Initiating live carrier SMS dispatch to {masked_phone}...")

        url = f"https://2factor.in/API/V1/{self.api_key}/SMS/{clean_phone}/{otp}/OTP1"
        try:
            with httpx.Client(timeout=12.0) as client:
                response = client.get(url)
                logger.info(f"[2Factor] Gateway HTTP Status: {response.status_code}")
                data = response.json()

                if response.status_code == 200 and data.get("Status") == "Success":
                    logger.info(f"[2Factor] Live carrier SMS successfully delivered to {masked_phone}")
                    return True
                else:
                    logger.error(f"[2Factor] Delivery failed: {data}")
                    err_detail = data.get("Details") or "Failed to send SMS OTP via 2Factor."
                    raise InternalServerError(f"2Factor error: {err_detail}")
        except AppException:
            raise
        except Exception as exc:
            logger.error(f"[2Factor] Network error: {exc}")
            raise InternalServerError(f"SMS network error: {str(exc)}") from exc


class MSG91Provider(BaseSMSProvider):
    """
    MSG91 SMS Gateway (India).
    """

    def __init__(self, api_key: str, template_id: str):
        self.api_key = api_key.strip() if api_key else ""
        self.template_id = template_id.strip() if template_id else ""

    def send_otp(self, phone: str, otp: str) -> bool:
        if not self.api_key:
            raise InternalServerError("MSG91 Auth Key is missing in SMS_API_KEY.")

        clean_phone = phone.strip()
        masked_phone = f"+91-******{clean_phone[-4:]}"
        logger.info(f"[MSG91] Initiating live carrier SMS dispatch to {masked_phone}...")

        url = "https://control.msg91.com/api/v5/otp"
        params = {
            "template_id": self.template_id or settings.SMS_TEMPLATE_ID,
            "mobile": f"91{clean_phone}",
            "authkey": self.api_key,
            "otp": otp,
        }
        try:
            with httpx.Client(timeout=12.0) as client:
                response = client.post(url, params=params)
                logger.info(f"[MSG91] Gateway HTTP Status: {response.status_code}")
                data = response.json()

                if response.status_code == 200 and data.get("type") == "success":
                    logger.info(f"[MSG91] Live carrier SMS successfully delivered to {masked_phone}")
                    return True
                else:
                    logger.error(f"[MSG91] Delivery failed: {data}")
                    err_msg = data.get("message") or "Failed to deliver SMS OTP via MSG91."
                    raise InternalServerError(f"MSG91 error: {err_msg}")
        except AppException:
            raise
        except Exception as exc:
            logger.error(f"[MSG91] Network error: {exc}")
            raise InternalServerError(f"SMS network error: {str(exc)}") from exc


class TwilioProvider(BaseSMSProvider):
    """
    Twilio SMS Gateway.
    """

    def __init__(self, account_sid: str, auth_token: str, from_number: str):
        self.account_sid = account_sid.strip() if account_sid else ""
        self.auth_token = auth_token.strip() if auth_token else ""
        self.from_number = from_number.strip() if from_number else ""

    def send_otp(self, phone: str, otp: str) -> bool:
        if not self.account_sid or not self.auth_token or not self.from_number:
            raise InternalServerError("Twilio credentials (SID/Auth Token/From number) are missing.")

        clean_phone = phone.strip()
        masked_phone = f"+91-******{clean_phone[-4:]}"
        logger.info(f"[Twilio] Initiating live carrier SMS dispatch to {masked_phone}...")

        url = f"https://api.twilio.com/2010-04-01/Accounts/{self.account_sid}/Messages.json"
        data = {
            "To": f"+91{clean_phone}",
            "From": self.from_number,
            "Body": f"Your EZFINANZ verification code is: {otp}. Valid for 5 minutes. Do not share this code.",
        }
        try:
            with httpx.Client(timeout=12.0) as client:
                response = client.post(url, data=data, auth=(self.account_sid, self.auth_token))
                logger.info(f"[Twilio] Gateway HTTP Status: {response.status_code}")

                if response.status_code in [200, 201]:
                    logger.info(f"[Twilio] Live carrier SMS successfully delivered to {masked_phone}")
                    return True
                else:
                    logger.error(f"[Twilio] Delivery failed: {response.text}")
                    raise InternalServerError(f"Twilio error: {response.text}")
        except AppException:
            raise
        except Exception as exc:
            logger.error(f"[Twilio] Network error: {exc}")
            raise InternalServerError(f"SMS network error: {str(exc)}") from exc


def get_sms_provider() -> BaseSMSProvider:
    """
    Factory function to retrieve the configured SMS provider.
    In OTP_MODE='demo', always returns MockSMSProvider.
    In OTP_MODE='sms', returns the configured provider.
    """
    mode = settings.OTP_MODE.lower().strip()

    if mode == "demo":
        logger.info("[SMS Factory] OTP_MODE=demo. Using MockSMSProvider.")
        return MockSMSProvider()

    provider_name = settings.SMS_PROVIDER.lower().strip()
    logger.info(f"[SMS Factory] OTP_MODE=sms. Initializing live SMS provider: {provider_name}")

    if provider_name == "fast2sms":
        return Fast2SMSProvider(api_key=settings.SMS_API_KEY)
    elif provider_name in ["2factor", "twofactor"]:
        return TwoFactorProvider(api_key=settings.SMS_API_KEY)
    elif provider_name == "msg91":
        return MSG91Provider(api_key=settings.SMS_API_KEY, template_id=settings.SMS_TEMPLATE_ID)
    elif provider_name == "twilio":
        return TwilioProvider(
            account_sid=settings.TWILIO_ACCOUNT_SID,
            auth_token=settings.TWILIO_AUTH_TOKEN,
            from_number=settings.TWILIO_FROM_NUMBER,
        )
    else:
        logger.error(f"[SMS Factory] Unknown SMS_PROVIDER '{provider_name}'.")
        raise InternalServerError(f"Unsupported SMS_PROVIDER '{provider_name}'. Configured in backend/.env.")
