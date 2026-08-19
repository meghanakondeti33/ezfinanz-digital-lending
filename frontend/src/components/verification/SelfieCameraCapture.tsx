/**
 * SelfieCameraCapture Component for Step 3 Live Photo Verification.
 *
 * Implements real browser camera capture using the MediaDevices API:
 * - On-demand camera permission requesting (never on page load).
 * - Live camera stream with face-positioning guide overlay.
 * - Frame freezing on capture with live preview.
 * - Retake vs Confirm & Upload controls.
 * - Graceful error handling for permission denied, device missing, or hardware busy.
 * - Local file fallback upload for test/headless environments.
 * - Explicit assessment environment disclosures.
 * - Rigorous camera track stopping upon capture, retake, verify, or unmount.
 */

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Button } from '../ui/Button';
import { Card } from '../ui/Card';
import { uploadSelfie } from '../../lib/verification-api';
import type { SelfieData } from '../../types/verification';

interface SelfieCameraCaptureProps {
  applicationId: string;
  existingSelfie: SelfieData | null;
  initialMode?: 'retake' | 'capture';
  onSelfieVerified: (data: SelfieData) => void;
  onContinue: () => void;
}

type CameraState =
  | 'idle'
  | 'requesting_permission'
  | 'streaming'
  | 'captured'
  | 'uploading'
  | 'error';

export const SelfieCameraCapture: React.FC<SelfieCameraCaptureProps> = ({
  applicationId,
  existingSelfie,
  initialMode,
  onSelfieVerified,
  onContinue,
}) => {
  const [cameraState, setCameraState] = useState<CameraState>(
    initialMode === 'retake' ? 'requesting_permission' : 'idle'
  );
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [capturedBlob, setCapturedBlob] = useState<Blob | null>(null);
  const [capturedDataUrl, setCapturedDataUrl] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Stop active camera stream tracks
  const stopStream = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => {
        try {
          track.stop();
        } catch (e) {
          console.warn('[Camera] Error stopping track:', e);
        }
      });
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  }, []);

  // Cleanup camera stream on unmount
  useEffect(() => {
    return () => {
      stopStream();
    };
  }, [stopStream]);

  // If component mounted in retake mode, automatically start camera
  useEffect(() => {
    if (initialMode === 'retake') {
      handleStartCamera();
    }
  }, [initialMode]);

  // Request camera access and start live preview
  const handleStartCamera = async () => {
    setErrorMessage(null);
    setCameraState('requesting_permission');

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setErrorMessage(
        'Camera access is not supported by your browser or connection. You may upload a photo instead.'
      );
      setCameraState('error');
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: 'user',
          width: { ideal: 640, max: 1280 },
          height: { ideal: 480, max: 720 },
        },
        audio: false,
      });

      streamRef.current = stream;
      setCameraState('streaming');

      // Attach stream to video element
      setTimeout(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play().catch((err) => {
            console.error('[Camera] Play error:', err);
          });
        }
      }, 50);
    } catch (err: any) {
      console.error('[Camera] getUserMedia error:', err);
      stopStream();

      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        setErrorMessage(
          'Camera permission was denied. Please allow camera access in your browser settings to proceed with live photo verification.'
        );
      } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
        setErrorMessage(
          'No camera device was detected on your system. You can upload a photo file instead.'
        );
      } else if (err.name === 'NotReadableError' || err.name === 'TrackStartError') {
        setErrorMessage(
          'Camera is currently in use by another application. Please close other camera apps and try again.'
        );
      } else {
        setErrorMessage(
          `Unable to access camera (${err.message || 'Unknown error'}). You can try again or upload a photo.`
        );
      }
      setCameraState('error');
    }
  };

  // Capture current video frame onto canvas and freeze image
  const handleCapturePhoto = () => {
    if (!videoRef.current || !canvasRef.current) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;

    const width = video.videoWidth || 640;
    const height = video.videoHeight || 480;

    canvas.width = width;
    canvas.height = height;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Draw video frame to canvas
    ctx.drawImage(video, 0, 0, width, height);

    // Get Data URL for preview
    const dataUrl = canvas.toDataURL('image/jpeg', 0.9);
    setCapturedDataUrl(dataUrl);

    // Convert canvas to Blob for backend upload
    canvas.toBlob(
      (blob) => {
        if (blob) {
          setCapturedBlob(blob);
          // Stop live stream once captured
          stopStream();
          setCameraState('captured');
        } else {
          setErrorMessage('Failed to capture photo frame. Please try again.');
          setCameraState('error');
        }
      },
      'image/jpeg',
      0.9
    );
  };

  // Retake photo: clear preview and restart live camera
  const handleRetake = () => {
    setCapturedBlob(null);
    setCapturedDataUrl(null);
    setErrorMessage(null);
    handleStartCamera();
  };

  // Upload captured/selected photo to backend
  const handleUploadAndVerify = async (blobToUpload?: Blob) => {
    const blob = blobToUpload || capturedBlob;
    if (!blob) {
      setErrorMessage('No photo captured. Please take a photo first.');
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      const response = await uploadSelfie(applicationId, blob, 'live_selfie.jpg');
      setCameraState('idle');
      stopStream();
      onSelfieVerified(response);
    } catch (err: any) {
      console.error('[Selfie] Upload error:', err);
      const msg =
        err.response?.data?.error?.message ||
        err.response?.data?.detail ||
        "We couldn't verify the photo. Please try again.";
      setErrorMessage(msg);
      setCameraState('captured');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Fallback: Handle file upload if camera is unavailable
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setErrorMessage('Please select a valid image file (JPEG, PNG, or WebP).');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setErrorMessage('Image size must be less than 5MB.');
      return;
    }

    setErrorMessage(null);
    const reader = new FileReader();
    reader.onload = (event) => {
      setCapturedDataUrl(event.target?.result as string);
      setCapturedBlob(file);
      stopStream();
      setCameraState('captured');
    };
    reader.readAsDataURL(file);
  };

  // 1. If Photo Approved / Verified: show completed card
  if (existingSelfie && (existingSelfie.status === 'PHOTO_APPROVED' || existingSelfie.status === 'VERIFIED')) {
    return (
      <div className="p-6 bg-white border border-[#C5E0D5] rounded-xl space-y-4 shadow-xs">
        <div className="flex items-center justify-between border-b border-[#E5E2DC] pb-3">
          <span className="text-xs font-bold uppercase tracking-wider text-[#1E5C4A] font-mono">
            Live photo verification
          </span>
          <span className="text-xs font-semibold px-2.5 py-1 bg-[#E8F5E9] text-[#1E5C4A] rounded-full border border-[#C5E0D5]">
            ✓ Photo approved
          </span>
        </div>

        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <span className="w-6 h-6 rounded-full bg-[#E8F5E9] text-[#1E5C4A] flex items-center justify-center font-bold text-sm">
              ✓
            </span>
            <span className="text-base font-bold text-[#1E5C4A]">
              ✓ Photo approved
            </span>
          </div>
          <p className="text-sm text-[#686D76] leading-relaxed">
            Your live photo has been verified. You can continue with your loan application.
          </p>
        </div>

        <div className="p-3.5 bg-[#F7F5F1] border border-[#E5E2DC] rounded-xl text-xs text-[#686D76] flex items-center justify-between">
          <span>Photo reference ID: {existingSelfie.id.slice(0, 8)}...</span>
          <span className="font-semibold text-[#1E5C4A]">Status: Verified</span>
        </div>

        <div className="pt-2 flex justify-end">
          <Button variant="primary" size="md" onClick={onContinue}>
            Continue with loan application →
          </Button>
        </div>
      </div>
    );
  }

  // 2. If Photo Submitted & Pending Review: show pending confirmation card
  if (existingSelfie && existingSelfie.status === 'PHOTO_PENDING_REVIEW' && cameraState === 'idle') {
    return (
      <div className="p-6 bg-white border border-[#ECCBB3] rounded-xl space-y-4 shadow-xs">
        <div className="flex items-center justify-between border-b border-[#E5E2DC] pb-3">
          <span className="text-xs font-bold uppercase tracking-wider text-[#B5652D] font-mono">
            Live photo verification
          </span>
          <span className="text-xs font-semibold px-2.5 py-1 bg-[#F9F3EE] text-[#B5652D] rounded-full border border-[#ECCBB3]">
            ⏳ Under review
          </span>
        </div>

        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <span className="w-6 h-6 rounded-full bg-[#F9F3EE] text-[#B5652D] flex items-center justify-center font-bold text-sm">
              ✓
            </span>
            <span className="text-base font-bold text-[#14161A]">
              ✓ Photo submitted
            </span>
          </div>
          <p className="text-sm text-[#686D76] leading-relaxed">
            Your new photo has been submitted and is awaiting review. You don&apos;t need to submit another photo right now.
          </p>
        </div>

        <div className="p-3.5 bg-[#F7F5F1] border border-[#E5E2DC] rounded-xl text-xs text-[#686D76] flex items-center justify-between">
          <span>Submitted on: {new Date(existingSelfie.submitted_at).toLocaleString('en-IN')}</span>
          <span className="font-semibold text-[#B5652D]">Status: Under review</span>
        </div>

        <div className="pt-2 flex items-center justify-between">
          <button
            type="button"
            onClick={handleStartCamera}
            className="text-xs text-[#686D76] hover:text-[#14161A] underline cursor-pointer"
          >
            Retake / replace photo
          </button>
          <Button variant="primary" size="md" onClick={onContinue}>
            Continue with loan application →
          </Button>
        </div>
      </div>
    );
  }

  // 3. If Photo Retake is required: show clear guidance and retake CTA
  if (existingSelfie && existingSelfie.status === 'PHOTO_RETAKE_REQUIRED' && cameraState === 'idle') {
    return (
      <div className="p-6 bg-white border-2 border-[#8C3A32] rounded-xl space-y-4 shadow-sm">
        <div className="flex items-center justify-between border-b border-[#F0D0CB] pb-3">
          <span className="text-xs font-bold uppercase tracking-wider text-[#8C3A32] font-mono">
            Live photo verification
          </span>
          <span className="text-xs font-semibold px-2.5 py-1 bg-[#FBEFEC] text-[#8C3A32] rounded-full border border-[#F0D0CB]">
            ⚠️ Action Required
          </span>
        </div>

        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <span className="w-6 h-6 rounded-full bg-[#FBEFEC] text-[#8C3A32] flex items-center justify-center font-bold text-sm">
              ⚠️
            </span>
            <span className="text-base font-bold text-[#8C3A32]">
              Photo retake required
            </span>
          </div>
          <p className="text-sm text-[#686D76] leading-relaxed">
            We couldn&apos;t approve the photo you submitted. Please submit a new photo.
          </p>
        </div>

        <div className="p-4 bg-[#FAF8F5] border border-[#E5E2DC] rounded-xl text-xs text-[#14161A] space-y-1.5">
          <div className="font-bold text-[#8C3A32]">Reason:</div>
          <p className="text-xs text-[#686D76]">
            &ldquo;{existingSelfie.rejection_reason || 'Please submit a clearer photo with your face fully visible.'}&rdquo;
          </p>
        </div>

        <div className="pt-2 flex justify-end">
          <Button variant="danger" size="md" onClick={handleStartCamera}>
            📸 Retake photo →
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Informational Header */}
      <div className="p-4 bg-[#F7F5F1] border border-[#E5E2DC] rounded-xl space-y-1.5">
        <div className="flex items-center justify-between">
          <span className="text-sm font-bold text-[#14161A]">Live photo check</span>
          <span className="text-[11px] font-mono font-semibold px-2 py-0.5 bg-[#F9F3EE] text-[#B5652D] rounded-full border border-[#ECCBB3]">
            Step 3 of 4
          </span>
        </div>
        <p className="text-xs text-[#686D76] leading-relaxed">
          Confirm your identity with a quick live photo. Ensure your face is clearly visible,
          well-lit, and without sunglasses or hats.
        </p>
        <p className="text-[11px] text-[#8A8D93] italic pt-0.5">
          For this assessment environment, liveness verification is simulated after capture.
        </p>
      </div>

      {/* Error Alert */}
      {errorMessage && (
        <div className="p-3.5 rounded-xl bg-[#FBEFEC] border border-[#F0D0CB] text-[#8C3A32] text-xs flex items-start gap-2.5 font-medium">
          <span className="text-sm">⚠️</span>
          <div className="flex-1">
            <span className="block font-semibold">Camera Notice</span>
            <span className="opacity-90">{errorMessage}</span>
          </div>
        </div>
      )}

      {/* Hidden canvas for capturing video frames */}
      <canvas ref={canvasRef} className="hidden" />

      {/* Hidden file input for fallback */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileSelect}
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
      />

      {/* State 1: IDLE / Initial prompt */}
      {cameraState === 'idle' && (
        <Card variant="elevated" padding="lg" className="text-center space-y-4 bg-white border-[#E5E2DC]">
          <div className="w-16 h-16 rounded-full bg-[#F9F3EE] border border-[#ECCBB3] flex items-center justify-center mx-auto text-2xl text-[#9C4F1C]">
            📷
          </div>
          <div>
            <span className="text-base font-bold text-[#14161A] block">
              Capture Live Photo
            </span>
            <p className="text-xs sm:text-sm text-[#686D76] max-w-sm mx-auto mt-1">
              Click below to allow camera access and position your face inside the frame.
            </p>
          </div>

          <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3">
            <Button
              variant="primary"
              size="md"
              onClick={handleStartCamera}
              className="w-full sm:w-auto"
            >
              Start Camera & Capture →
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => fileInputRef.current?.click()}
              className="text-xs text-[#686D76]"
            >
              Upload photo instead
            </Button>
          </div>
        </Card>
      )}

      {/* State 2: Requesting Permission */}
      {cameraState === 'requesting_permission' && (
        <Card variant="elevated" padding="lg" className="text-center space-y-3 bg-white">
          <div className="animate-spin w-8 h-8 border-2 border-[#B5652D] border-t-transparent rounded-full mx-auto" />
          <span className="text-sm font-bold text-[#14161A] block">
            Requesting Camera Permission...
          </span>
          <p className="text-xs text-[#686D76]">
            Please click "Allow" on the browser prompt to activate your camera.
          </p>
        </Card>
      )}

      {/* State 3: Live Video Streaming */}
      {cameraState === 'streaming' && (
        <Card variant="elevated" padding="md" className="space-y-3 bg-[#14161A] text-white">
          <div className="relative w-full max-w-md mx-auto aspect-4/3 bg-black rounded-xl overflow-hidden shadow-inner flex items-center justify-center">
            {/* Live video feed */}
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="w-full h-full object-cover transform -scale-x-100"
            />

            {/* Oval Face Positioning Guide Overlay */}
            <div className="absolute inset-0 pointer-events-none flex flex-col items-center justify-center">
              <div className="w-48 h-64 border-2 border-dashed border-white/70 rounded-[50%] shadow-[0_0_0_9999px_rgba(0,0,0,0.35)] flex items-center justify-center">
                <span className="text-[11px] font-mono text-white/90 bg-black/60 px-2 py-0.5 rounded-full">
                  Align Face Here
                </span>
              </div>
            </div>

            {/* Live Indicator */}
            <div className="absolute top-3 left-3 flex items-center gap-1.5 px-2 py-0.5 bg-black/60 backdrop-blur-xs rounded-full text-[10px] font-mono text-emerald-400">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span>LIVE</span>
            </div>
          </div>

          <div className="flex items-center justify-between pt-1 px-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                stopStream();
                setCameraState('idle');
              }}
              className="text-white/80 hover:text-white hover:bg-white/10 text-xs"
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              size="md"
              onClick={handleCapturePhoto}
              className="bg-[#B5652D] hover:bg-[#9C4F1C] text-white shadow-md text-sm px-6"
            >
              📸 Capture Photo
            </Button>
          </div>
        </Card>
      )}

      {/* State 4: Captured Frame Preview */}
      {cameraState === 'captured' && capturedDataUrl && (
        <Card variant="elevated" padding="md" className="space-y-4 bg-white border-[#E5E2DC]">
          <div className="text-center space-y-1">
            <span className="text-sm font-bold text-[#14161A] block">
              Photo Preview
            </span>
            <p className="text-xs text-[#686D76]">
              Please review your photo. Ensure your facial features are distinct and clear.
            </p>
          </div>

          <div className="relative w-full max-w-sm mx-auto aspect-4/3 bg-[#F7F5F1] rounded-xl overflow-hidden border border-[#E5E2DC] shadow-sm">
            <img
              src={capturedDataUrl}
              alt="Captured live selfie preview"
              className="w-full h-full object-cover"
            />
            <div className="absolute bottom-2 right-2 px-2 py-0.5 bg-black/60 text-white rounded text-[10px] font-mono">
              Ready to verify
            </div>
          </div>

          <div className="flex items-center justify-between pt-2 border-t border-[#E5E2DC]">
            <Button
              variant="outline"
              size="sm"
              onClick={handleRetake}
              disabled={isSubmitting}
              className="text-xs"
            >
              ↺ Retake
            </Button>
            <Button
              variant="primary"
              size="md"
              onClick={() => handleUploadAndVerify()}
              isLoading={isSubmitting}
              className="text-xs sm:text-sm font-semibold"
            >
              ✓ Use this photo
            </Button>
          </div>
        </Card>
      )}

      {/* State 5: Error fallback option */}
      {cameraState === 'error' && (
        <Card variant="default" padding="md" className="text-center space-y-3 bg-[#FAF8F5]">
          <span className="text-xs font-semibold text-[#686D76] block">
            Alternative verification option:
          </span>
          <div className="flex items-center justify-center gap-3">
            <Button
              variant="outline"
              size="sm"
              onClick={handleStartCamera}
              className="text-xs"
            >
              Try Camera Again
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={() => fileInputRef.current?.click()}
              className="text-xs"
            >
              Upload Photo File →
            </Button>
          </div>
        </Card>
      )}
    </div>
  );
};

export default SelfieCameraCapture;
