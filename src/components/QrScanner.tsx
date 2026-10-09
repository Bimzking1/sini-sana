import { useEffect, useRef, useState } from "react";
import jsQR from "jsqr";

interface QrScannerProps {
  onResult: (data: string) => void;
  onClose: () => void;
  notice?: string | null;
}

type Status = "starting" | "active" | "denied";

export default function QrScanner({ onResult, onClose, notice }: QrScannerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const handledRef = useRef(false);
  const [status, setStatus] = useState<Status>("starting");
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    let cancelled = false;
    let interval: number | undefined;

    const cameraSupported =
      typeof navigator !== "undefined" &&
      !!navigator.mediaDevices?.getUserMedia &&
      (window.isSecureContext ||
        window.location.hostname === "localhost" ||
        window.location.hostname === "127.0.0.1");

    if (!cameraSupported) {
      setErrorMessage("QR scanning needs a camera on a secure connection (HTTPS or localhost).");
      setStatus("denied");
      return;
    }

    const scan = (): void => {
      const video = videoRef.current;
      if (!video || handledRef.current || video.readyState < 2 || video.videoWidth === 0) return;

      const scale = Math.min(1, 480 / video.videoWidth);
      const canvasWidth = Math.floor(video.videoWidth * scale);
      const canvasHeight = Math.floor(video.videoHeight * scale);
      const canvas = document.createElement("canvas");
      canvas.width = canvasWidth;
      canvas.height = canvasHeight;
      const context = canvas.getContext("2d", { willReadFrequently: true });
      if (!context) return;
      context.drawImage(video, 0, 0, canvasWidth, canvasHeight);

      let imageData: ImageData;
      try {
        imageData = context.getImageData(0, 0, canvasWidth, canvasHeight);
      } catch {
        return;
      }

      const decoded = jsQR(imageData.data, canvasWidth, canvasHeight, {
        inversionAttempts: "attemptBoth",
      });
      if (decoded?.data) {
        handledRef.current = true;
        if (interval !== undefined) window.clearInterval(interval);
        onResult(decoded.data);
      }
    };

    const start = async (): Promise<void> => {
      let stream: MediaStream | null = null;
      try {
        try {
          stream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: "environment" },
          });
        } catch {
          stream = await navigator.mediaDevices.getUserMedia({ video: true });
        }
      } catch {
        if (cancelled) return;
        setErrorMessage("Camera permission was denied, or no camera is available.");
        setStatus("denied");
        return;
      }
      if (cancelled) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }
      streamRef.current = stream;
      const video = videoRef.current;
      if (video) {
        video.srcObject = stream;
        setStatus("active");
        interval = window.setInterval(scan, 250);
      }
    };

    void start();

    return () => {
      cancelled = true;
      if (interval !== undefined) window.clearInterval(interval);
      streamRef.current?.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    };
  }, [onResult]);

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-slate-950 pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]">
      <div className="flex shrink-0 items-center justify-between px-3 py-3 text-white md:px-5">
        <button
          type="button"
          onClick={onClose}
          aria-label="Close scanner"
          className="flex h-9 w-9 items-center justify-center rounded-full bg-white/10 text-white transition hover:bg-white/20 active:scale-[0.96]"
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
            <path
              d="M4 4l8 8m0-8-8 8"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
            />
          </svg>
        </button>
        <span className="text-sm font-semibold text-white/90 md:text-base">
          Scan a Sini Sana QR
        </span>
        <span className="w-9" aria-hidden="true" />
      </div>

      <div className="relative min-h-0 flex-1 overflow-hidden">
        <video
          ref={videoRef}
          autoPlay
          muted
          playsInline
          className="absolute inset-0 h-full w-full object-cover"
        />

        {status === "starting" && (
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="h-9 w-9 animate-spin rounded-full border-2 border-brand-light-blue border-t-white" />
          </div>
        )}

        {status === "active" && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <div className="relative h-[62%] max-h-[26rem] w-[62%] max-w-[26rem]">
              <span className="absolute left-0 top-0 h-12 w-12 rounded-tl-2xl border-l-4 border-t-4 border-brand-light-blue md:h-16 md:w-16" />
              <span className="absolute right-0 top-0 h-12 w-12 rounded-tr-2xl border-r-4 border-t-4 border-brand-light-blue md:h-16 md:w-16" />
              <span className="absolute bottom-0 left-0 h-12 w-12 rounded-bl-2xl border-b-4 border-l-4 border-brand-light-blue md:h-16 md:w-16" />
              <span className="absolute bottom-0 right-0 h-12 w-12 rounded-br-2xl border-b-4 border-r-4 border-brand-light-blue md:h-16 md:w-16" />
              <span className="absolute inset-x-8 top-0 h-0.5 animate-pulse rounded-full bg-brand-orange shadow-[0_0_12px_#FA6B4D]" />
            </div>
          </div>
        )}

        {notice && (
          <div className="pointer-events-none absolute inset-x-0 top-3 flex justify-center px-4">
            <span className="animate-pop rounded-full bg-rose-600 px-4 py-2 text-sm font-medium text-white shadow-lg">
              {notice}
            </span>
          </div>
        )}

        {status === "denied" && (
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-slate-950/80 px-6 text-center">
            <span className="flex h-12 w-12 items-center justify-center rounded-full bg-rose-500/15 text-rose-400">
              <svg width="22" height="22" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                <path
                  d="M8 6.5v3m0 2.5a.5.5 0 1 1 0 1 .5.5 0 0 1 0-1ZM2 8a6 6 0 1 1 12 0A6 6 0 0 1 2 8Z"
                  stroke="currentColor"
                  strokeWidth="1.4"
                  strokeLinecap="round"
                />
              </svg>
            </span>
            <p className="mt-4 max-w-sm text-sm font-medium text-white md:text-base">
              {errorMessage}
            </p>
            <button
              type="button"
              onClick={onClose}
              className="mt-5 rounded-full bg-white px-5 py-2.5 text-sm font-semibold text-slate-900 transition hover:bg-slate-200 active:scale-[0.98]"
            >
              Enter code instead
            </button>
          </div>
        )}
      </div>

      <div className="flex shrink-0 items-center justify-between gap-3 bg-slate-950 px-5 py-4 md:py-5">
        <p className="text-xs leading-relaxed text-white/60 md:text-sm">
          Point your camera at a Sini Sana QR code to join its room.
        </p>
        <button
          type="button"
          onClick={onClose}
          className="shrink-0 rounded-full bg-white/10 px-4 py-2 text-sm font-medium text-white transition hover:bg-white/20 active:scale-[0.98]"
        >
          Enter code instead
        </button>
      </div>
    </div>
  );
}