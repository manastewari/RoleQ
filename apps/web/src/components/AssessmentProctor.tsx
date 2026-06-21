"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Camera,
  CheckCircle2,
  CircleAlert,
  Expand,
  LoaderCircle,
  Mic,
  MonitorUp,
  Radio,
  ShieldCheck,
} from "lucide-react";
import { api } from "@/lib/api";
import type { ProctorEvent } from "@/lib/types";
import { Badge, Button, Card, ErrorBanner } from "./ui";

type NativeFaceDetector = {
  detect: (source: CanvasImageSource) => Promise<unknown[]>;
};

type ProtectionPhase = "consent" | "requesting" | "ready" | "active" | "interrupted" | "finalizing";

export function AssessmentProctor({
  attemptId,
  requested,
  completed,
  onStarted,
  onFinalized,
}: {
  attemptId: string;
  requested: boolean;
  completed: boolean;
  onStarted: () => void;
  onFinalized?: () => void;
}) {
  const [phase, setPhase] = useState<ProtectionPhase>("consent");
  const [consent, setConsent] = useState(false);
  const [events, setEvents] = useState<ProctorEvent[]>([]);
  const [error, setError] = useState("");
  const [permissions, setPermissions] = useState({
    camera: false,
    microphone: false,
    screen: false,
  });
  const screenVideo = useRef<HTMLVideoElement>(null);
  const cameraVideo = useRef<HTMLVideoElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const screenStream = useRef<MediaStream | null>(null);
  const cameraStream = useRef<MediaStream | null>(null);
  const recorder = useRef<MediaRecorder | null>(null);
  const chunks = useRef<Blob[]>([]);
  const animationFrame = useRef<number | null>(null);
  const faceTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const activeRef = useRef(false);
  const finalizedRef = useRef(false);
  const blurStarted = useRef<number | null>(null);

  const persistEvent = useCallback(async (
    type: string,
    severity: ProctorEvent["severity"],
    message: string,
    metadata: Record<string, unknown> = {},
    takeSnapshot = false,
  ) => {
    const event: ProctorEvent = {
      type,
      severity,
      message,
      occurred_at: new Date().toISOString(),
      metadata,
    };
    setEvents((current) => [event, ...current].slice(0, 40));
    try {
      if (takeSnapshot && canvas.current) {
        const blob = await new Promise<Blob | null>((resolve) =>
          canvas.current?.toBlob(resolve, "image/jpeg", 0.82),
        );
        if (blob) {
          const artifact = await api.uploadArtifact(attemptId, "snapshot", blob);
          event.metadata = { ...event.metadata, artifact_id: artifact.id };
        }
      }
      await api.recordProctorEvents(attemptId, [event]);
    } catch {
      // Preserve the local event timeline if the API disconnects briefly.
    }
  }, [attemptId]);

  const stopTracks = useCallback(() => {
    screenStream.current?.getTracks().forEach((track) => track.stop());
    cameraStream.current?.getTracks().forEach((track) => track.stop());
    screenStream.current = null;
    cameraStream.current = null;
    if (screenVideo.current) screenVideo.current.srcObject = null;
    if (cameraVideo.current) cameraVideo.current.srcObject = null;
  }, []);

  const stopRecorder = useCallback(async () => {
    if (animationFrame.current) cancelAnimationFrame(animationFrame.current);
    if (faceTimer.current) clearInterval(faceTimer.current);
    animationFrame.current = null;
    faceTimer.current = null;

    const recording = await new Promise<Blob>((resolve) => {
      if (!recorder.current || recorder.current.state === "inactive") {
        resolve(new Blob(chunks.current, { type: "video/webm" }));
        return;
      }
      recorder.current.onstop = () => resolve(new Blob(chunks.current, { type: "video/webm" }));
      recorder.current.stop();
    });
    recorder.current = null;
    chunks.current = [];
    if (recording.size) {
      await api.uploadArtifact(attemptId, "recording", recording);
    }
  }, [attemptId]);

  const interrupt = useCallback(async (type: string, message: string) => {
    if (!activeRef.current) return;
    activeRef.current = false;
    setPhase("interrupted");
    await persistEvent(type, "high", message, {}, true);
    await stopRecorder().catch(() => undefined);
    stopTracks();
    setPermissions({ camera: false, microphone: false, screen: false });
  }, [persistEvent, stopRecorder, stopTracks]);

  useEffect(() => {
    const onVisibility = () => {
      if (activeRef.current && document.hidden) {
        void persistEvent("tab_hidden", "medium", "Assessment tab became hidden.", {}, true);
      }
    };
    const onBlur = () => {
      if (activeRef.current) blurStarted.current = Date.now();
    };
    const onFocus = () => {
      if (activeRef.current && blurStarted.current) {
        const durationMs = Date.now() - blurStarted.current;
        if (durationMs > 2500) {
          void persistEvent(
            "window_blur",
            "medium",
            "Assessment window lost focus for more than 2.5 seconds.",
            { duration_ms: durationMs },
            true,
          );
        }
        blurStarted.current = null;
      }
    };
    const onFullscreen = () => {
      if (activeRef.current && !document.fullscreenElement) {
        void interrupt("fullscreen_exit", "Candidate exited full-screen mode.");
      }
    };
    const onRestrictedAction = (event: Event) => {
      if (!activeRef.current) return;
      event.preventDefault();
      void persistEvent(event.type, "low", `${event.type} attempt detected in the assessment window.`);
    };

    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("blur", onBlur);
    window.addEventListener("focus", onFocus);
    document.addEventListener("fullscreenchange", onFullscreen);
    document.addEventListener("copy", onRestrictedAction);
    document.addEventListener("paste", onRestrictedAction);
    document.addEventListener("contextmenu", onRestrictedAction);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("blur", onBlur);
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("fullscreenchange", onFullscreen);
      document.removeEventListener("copy", onRestrictedAction);
      document.removeEventListener("paste", onRestrictedAction);
      document.removeEventListener("contextmenu", onRestrictedAction);
    };
  }, [interrupt, persistEvent]);

  const draw = useCallback(() => {
    const ctx = canvas.current?.getContext("2d");
    if (!ctx || !canvas.current || !screenVideo.current || !cameraVideo.current) return;
    const target = canvas.current;
    ctx.fillStyle = "#101722";
    ctx.fillRect(0, 0, target.width, target.height);
    if (screenVideo.current.readyState >= 2) {
      ctx.drawImage(screenVideo.current, 0, 0, target.width, target.height);
    }
    if (cameraVideo.current.readyState >= 2) {
      const width = 260;
      const height = 146;
      const x = target.width - width - 24;
      const y = target.height - height - 24;
      ctx.fillStyle = "rgba(16,23,34,.78)";
      ctx.fillRect(x - 5, y - 5, width + 10, height + 10);
      ctx.drawImage(cameraVideo.current, x, y, width, height);
    }
    animationFrame.current = requestAnimationFrame(draw);
  }, []);

  const startFaceChecks = useCallback(() => {
    const FaceDetectorCtor = (
      window as unknown as {
        FaceDetector?: new (options: { fastMode: boolean; maxDetectedFaces: number }) => NativeFaceDetector;
      }
    ).FaceDetector;
    if (!FaceDetectorCtor) {
      void persistEvent(
        "face_detector_unavailable",
        "info",
        "Native on-device face detection is unavailable in this browser.",
      );
      return;
    }
    const detector = new FaceDetectorCtor({ fastMode: true, maxDetectedFaces: 3 });
    faceTimer.current = setInterval(async () => {
      if (!activeRef.current || !cameraVideo.current || cameraVideo.current.readyState < 2) return;
      try {
        const faces = await detector.detect(cameraVideo.current);
        if (faces.length === 0) {
          void persistEvent(
            "no_face",
            "medium",
            "No face was visible during a periodic on-device check.",
            {},
            true,
          );
        } else if (faces.length > 1) {
          void persistEvent(
            "multiple_faces",
            "high",
            "Multiple faces were visible during a periodic on-device check.",
            { count: faces.length },
            true,
          );
        }
      } catch {
        // Face detection is advisory and never interrupts the assessment.
      }
    }, 7000);
  }, [persistEvent]);

  const requestPermissions = async () => {
    if (!consent) return;
    setError("");
    setPhase("requesting");
    stopTracks();
    try {
      const camera = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: { echoCancellation: true, noiseSuppression: true },
      });
      cameraStream.current = camera;
      setPermissions((current) => ({ ...current, camera: true, microphone: true }));

      const display = await navigator.mediaDevices.getDisplayMedia({
        video: {
          displaySurface: "monitor",
          frameRate: { ideal: 15, max: 20 },
        },
        audio: true,
        selfBrowserSurface: "exclude",
        surfaceSwitching: "exclude",
        monitorTypeSurfaces: "include",
      } as DisplayMediaStreamOptions);
      screenStream.current = display;

      const displaySurface = display.getVideoTracks()[0]?.getSettings().displaySurface;
      if (displaySurface && displaySurface !== "monitor") {
        display.getTracks().forEach((track) => track.stop());
        camera.getTracks().forEach((track) => track.stop());
        setPermissions({ camera: false, microphone: false, screen: false });
        setPhase("consent");
        throw new Error("Please choose Entire Screen in the sharing dialog. Browser-tab or window sharing is not accepted.");
      }

      if (cameraVideo.current) {
        cameraVideo.current.srcObject = camera;
        await cameraVideo.current.play();
      }
      if (screenVideo.current) {
        screenVideo.current.srcObject = display;
        await screenVideo.current.play();
      }
      setPermissions({ camera: true, microphone: true, screen: true });
      setPhase("ready");
    } catch (caught) {
      stopTracks();
      setPermissions({ camera: false, microphone: false, screen: false });
      setPhase("consent");
      setError(
        caught instanceof Error
          ? caught.message
          : "Camera, microphone, and entire-screen access are required before the assessment can begin.",
      );
    }
  };

  const beginAssessment = async () => {
    setError("");
    const displayTrack = screenStream.current?.getVideoTracks()[0];
    const cameraTrack = cameraStream.current?.getVideoTracks()[0];
    const microphoneTrack = cameraStream.current?.getAudioTracks()[0];
    if (!displayTrack || !cameraTrack || !microphoneTrack) {
      setPhase("consent");
      setError("Required media access was lost. Grant camera, microphone, and entire-screen access again.");
      return;
    }
    try {
      await document.documentElement.requestFullscreen();
      if (!document.fullscreenElement) {
        throw new Error("Full-screen mode is required to begin the assessment.");
      }

      displayTrack.addEventListener("ended", () =>
        void interrupt("screen_stopped", "Entire-screen sharing stopped during the assessment."),
      );
      cameraTrack.addEventListener("ended", () =>
        void interrupt("camera_stopped", "Camera access stopped during the assessment."),
      );
      microphoneTrack.addEventListener("ended", () =>
        void interrupt("microphone_stopped", "Microphone access stopped during the assessment."),
      );

      if (!canvas.current) throw new Error("The protected recording canvas was not initialized.");
      const composite = canvas.current.captureStream(15);
      composite.addTrack(microphoneTrack);
      const displayAudio = screenStream.current?.getAudioTracks()[0];
      if (displayAudio) composite.addTrack(displayAudio);
      const mimeType = MediaRecorder.isTypeSupported("video/webm;codecs=vp9,opus")
        ? "video/webm;codecs=vp9,opus"
        : "video/webm";
      recorder.current = new MediaRecorder(composite, { mimeType });
      chunks.current = [];
      recorder.current.ondataavailable = (event) => {
        if (event.data.size) chunks.current.push(event.data);
      };
      recorder.current.start(1000);

      activeRef.current = true;
      finalizedRef.current = false;
      setPhase("active");
      draw();
      startFaceChecks();
      await persistEvent(
        "session_started",
        "info",
        "Assessment started in full-screen mode with camera, microphone, and entire-screen capture active.",
        { display_surface: displayTrack.getSettings().displaySurface || "unknown" },
      );
      onStarted();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not enter required full-screen mode.");
    }
  };

  const finalize = useCallback(async () => {
    if (finalizedRef.current) return;
    finalizedRef.current = true;
    activeRef.current = false;
    setPhase("finalizing");
    try {
      await stopRecorder();
      await persistEvent(
        "session_completed",
        "info",
        "Protected assessment capture completed and the recording was stored with a 30-day expiry.",
      );
    } finally {
      stopTracks();
      if (document.fullscreenElement) {
        await document.exitFullscreen().catch(() => undefined);
      }
      setPhase("consent");
      onFinalized?.();
    }
  }, [onFinalized, persistEvent, stopRecorder, stopTracks]);

  useEffect(() => {
    if (completed) void finalize();
  }, [completed, finalize]);

  useEffect(() => {
    return () => {
      activeRef.current = false;
      if (animationFrame.current) cancelAnimationFrame(animationFrame.current);
      if (faceTimer.current) clearInterval(faceTimer.current);
      if (recorder.current?.state === "recording") recorder.current.stop();
      stopTracks();
    };
  }, [stopTracks]);

  if (!requested && phase !== "active" && phase !== "finalizing") return null;

  const permissionItems = [
    { key: "camera", label: "Camera", icon: Camera, ready: permissions.camera },
    { key: "microphone", label: "Microphone", icon: Mic, ready: permissions.microphone },
    { key: "screen", label: "Entire screen", icon: MonitorUp, ready: permissions.screen },
  ];

  return (
    <>
      <video ref={screenVideo} muted playsInline className="hidden" />
      <video ref={cameraVideo} muted playsInline className="hidden" />
      <canvas ref={canvas} width={1280} height={720} className="hidden" />

      {phase === "active" && (
        <div className="fixed right-5 top-5 z-[90] flex items-center gap-3 rounded-2xl border border-white/15 bg-[#10262d]/95 px-4 py-3 text-white shadow-2xl backdrop-blur">
          <span className="relative flex size-3">
            <span className="absolute inline-flex size-full animate-ping rounded-full bg-rose-400 opacity-60" />
            <span className="relative inline-flex size-3 rounded-full bg-rose-500" />
          </span>
          <div>
            <div className="text-xs font-extrabold">Protected assessment active</div>
            <div className="mt-0.5 text-[10px] text-white/55">Full screen · camera · mic · entire screen</div>
          </div>
          <Badge tone="green">{events.length} events</Badge>
        </div>
      )}

      {phase !== "active" && (
        <div className="fixed inset-0 z-[100] grid place-items-center overflow-y-auto bg-[#0d2027]/94 p-5 backdrop-blur-sm">
          <Card className="w-full max-w-3xl overflow-hidden">
            <div className="bg-[#17333b] p-7 text-white sm:p-9">
              <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[.14em] text-emerald-300">
                <ShieldCheck size={17} /> Assessment security check
              </div>
              <h2 className="mt-3 font-serif text-3xl font-bold sm:text-4xl">
                {phase === "interrupted" ? "Protected session interrupted" : "Prepare your assessment space"}
              </h2>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-white/60">
                The assessment cannot begin or continue until full-screen mode, camera, microphone, and entire-screen sharing are active.
              </p>
            </div>
            <div className="p-6 sm:p-8">
              {error && <div className="mb-5"><ErrorBanner message={error} /></div>}

              <div className="grid gap-3 sm:grid-cols-3">
                {permissionItems.map(({ key, label, icon: Icon, ready }) => (
                  <div
                    key={key}
                    className={`rounded-2xl border p-4 ${ready ? "border-emerald-200 bg-emerald-50" : "border-line bg-slate-50"}`}
                  >
                    <div className="flex items-center justify-between">
                      <Icon size={20} className={ready ? "text-emerald-700" : "text-muted"} />
                      {ready ? <CheckCircle2 size={17} className="text-emerald-600" /> : <CircleAlert size={17} className="text-slate-400" />}
                    </div>
                    <div className="mt-5 text-sm font-extrabold">{label}</div>
                    <div className="mt-1 text-[11px] text-muted">{ready ? "Access ready" : "Permission required"}</div>
                  </div>
                ))}
              </div>

              {phase !== "ready" && phase !== "finalizing" && (
                <label className="mt-5 flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-xs leading-6 text-amber-950">
                  <input
                    type="checkbox"
                    checked={consent}
                    onChange={(event) => setConsent(event.target.checked)}
                    className="mt-1"
                  />
                  <span>
                    I consent to camera, microphone, entire-screen capture, and timestamped integrity events for this assessment.
                    Recordings expire after 30 days and do not produce an automatic cheating or hiring decision.
                  </span>
                </label>
              )}

              <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-2 text-[11px] leading-5 text-muted">
                  <Radio size={15} /> If a required permission stops, the assessment is blocked until protection is restored.
                </div>
                {phase === "ready" ? (
                  <Button onClick={beginAssessment}>
                    <Expand size={16} /> Enter full screen and begin
                  </Button>
                ) : phase === "finalizing" ? (
                  <div className="flex items-center gap-2 text-sm font-bold text-brand-700">
                    <LoaderCircle size={17} className="animate-spin" /> Finalizing recording…
                  </div>
                ) : (
                  <Button
                    loading={phase === "requesting"}
                    disabled={!consent}
                    onClick={requestPermissions}
                  >
                    <Camera size={16} /> Allow camera, mic, and screen
                  </Button>
                )}
              </div>
            </div>
          </Card>
        </div>
      )}
    </>
  );
}
