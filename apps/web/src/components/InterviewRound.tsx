"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  AudioLines,
  Captions,
  CheckCircle2,
  ChevronRight,
  Languages,
  Maximize2,
  Mic,
  PhoneOff,
  PlugZap,
  Send,
  Signal,
  Users,
  Video,
  VideoOff,
  Volume2,
} from "lucide-react";
import { api } from "@/lib/api";
import type {
  InterviewCodingProblem,
  InterviewCodingReview,
  InterviewTurn,
  Workspace,
} from "@/lib/types";
import { Badge, Button, Card, ErrorBanner } from "./ui";
import { InterviewCodingRound } from "./InterviewCodingRound";

type RecognitionEvent = { results: ArrayLike<{ 0: { transcript: string } }> };
type RecognitionInstance = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start: () => void;
  stop: () => void;
  onresult: ((event: RecognitionEvent) => void) | null;
  onspeechstart: (() => void) | null;
  onend: (() => void) | null;
  onerror: (() => void) | null;
};

function browserRecognition(): (new () => RecognitionInstance) | undefined {
  const target = window as unknown as {
    SpeechRecognition?: new () => RecognitionInstance;
    webkitSpeechRecognition?: new () => RecognitionInstance;
  };
  return target.SpeechRecognition || target.webkitSpeechRecognition;
}

function formatDuration(seconds: number): string {
  const minutes = Math.floor(seconds / 60).toString().padStart(2, "0");
  const remaining = (seconds % 60).toString().padStart(2, "0");
  return `${minutes}:${remaining}`;
}

type CaptureState = "idle" | "waiting" | "recording" | "transcribing" | "ready" | "skipping";

export function InterviewRound({
  workspace,
  onComplete,
}: {
  workspace: Workspace;
  onComplete: () => void;
}) {
  const plan = workspace.interview_plan.data;
  const [questionIndex, setQuestionIndex] = useState(0);
  const [followUp, setFollowUp] = useState<string | null>(null);
  const [followUpCount, setFollowUpCount] = useState(0);
  const [recoveryFollowUp, setRecoveryFollowUp] = useState(false);
  const [answer, setAnswer] = useState("");
  const [turns, setTurns] = useState<InterviewTurn[]>([]);
  const [loading, setLoading] = useState(false);
  const [voiceMode, setVoiceMode] = useState<"realtime" | "browser">("browser");
  const [realtimeState, setRealtimeState] = useState<"idle" | "connecting" | "connected" | "failed">("idle");
  const [captureState, setCaptureState] = useState<CaptureState>("idle");
  const [error, setError] = useState("");
  const [preferredLanguage, setPreferredLanguage] = useState("python");
  const [dsaStarted, setDsaStarted] = useState(false);
  const [codingReview, setCodingReview] = useState<InterviewCodingReview | null>(null);
  const [codingFollowUpComplete, setCodingFollowUpComplete] = useState(false);
  const [leadIn, setLeadIn] = useState(plan.opening);
  const [interviewerSpeaking, setInterviewerSpeaking] = useState(false);
  const [candidateSpeaking, setCandidateSpeaking] = useState(false);
  const [cameraReady, setCameraReady] = useState(false);
  const [cameraEnabled, setCameraEnabled] = useState(false);
  const [captionsVisible, setCaptionsVisible] = useState(true);
  const [remainingSeconds, setRemainingSeconds] = useState(
    workspace.assessment.config.interview_minutes * 60,
  );
  const [listenCue, setListenCue] = useState(0);
  const [noAnswerExpired, setNoAnswerExpired] = useState(false);
  const recognition = useRef<RecognitionInstance | null>(null);
  const peer = useRef<RTCPeerConnection | null>(null);
  const dataChannel = useRef<RTCDataChannel | null>(null);
  const micStream = useRef<MediaStream | null>(null);
  const audioElement = useRef<HTMLAudioElement | null>(null);
  const candidateVideo = useRef<HTMLVideoElement | null>(null);
  const candidateCamera = useRef<MediaStream | null>(null);
  const lastSpoken = useRef("");
  const transcriptItems = useRef<Record<string, string>>({});
  const answerRef = useRef("");
  const noAnswerTimer = useRef<number | null>(null);
  const browserSilenceTimer = useRef<number | null>(null);
  const audioLevelFrame = useRef<number | null>(null);
  const audioContext = useRef<AudioContext | null>(null);
  const audioAnalyser = useRef<AnalyserNode | null>(null);
  const speechDetected = useRef(false);
  const speechActivitySeen = useRef(false);
  const speechFrames = useRef(0);
  const silenceStartedAt = useRef<number | null>(null);
  const captureGeneration = useRef(0);
  const manualSubmitRequested = useRef(false);
  const currentQuestion = plan.questions[questionIndex];
  const interviewDone = questionIndex >= plan.questions.length;

  const displayedQuestion = followUp || currentQuestion?.question || "";

  useEffect(() => {
    const timer = window.setInterval(
      () => setRemainingSeconds((value) => Math.max(0, value - 1)),
      1000,
    );
    navigator.mediaDevices.getUserMedia({ video: true, audio: false })
      .then(async (stream) => {
        candidateCamera.current = stream;
        if (candidateVideo.current) {
          candidateVideo.current.srcObject = stream;
          await candidateVideo.current.play();
          setCameraReady(true);
          setCameraEnabled(true);
        }
      })
      .catch(() => {
        setCameraReady(false);
        setCameraEnabled(false);
      });
    return () => {
      window.clearInterval(timer);
      if (noAnswerTimer.current) window.clearTimeout(noAnswerTimer.current);
      if (browserSilenceTimer.current) window.clearTimeout(browserSilenceTimer.current);
      if (audioLevelFrame.current) window.cancelAnimationFrame(audioLevelFrame.current);
      void audioContext.current?.close();
      recognition.current?.stop();
      micStream.current?.getTracks().forEach((track) => track.stop());
      candidateCamera.current?.getTracks().forEach((track) => track.stop());
      peer.current?.close();
      window.speechSynthesis?.cancel();
    };
  }, []);

  useEffect(() => {
    if (remainingSeconds > 0 || interviewDone) return;
    recognition.current?.stop();
    micStream.current?.getAudioTracks().forEach((track) => {
      track.enabled = false;
    });
    setCandidateSpeaking(false);
    setQuestionIndex(plan.questions.length);
  }, [interviewDone, plan.questions.length, remainingSeconds]);

  const browserSpeak = useCallback((text: string) => {
    if (!window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    const voices = window.speechSynthesis.getVoices();
    utterance.voice =
      voices.find((voice) => /Aria|Jenny|Samantha|Ava|Sonia|Google UK English Female/i.test(voice.name)) ||
      voices.find((voice) => voice.lang.startsWith("en")) ||
      null;
    utterance.rate = 0.94;
    utterance.pitch = 1.01;
    utterance.volume = 1;
    utterance.onstart = () => setInterviewerSpeaking(true);
    utterance.onend = () => {
      setInterviewerSpeaking(false);
      setListenCue((value) => value + 1);
    };
    utterance.onerror = () => {
      setInterviewerSpeaking(false);
      setListenCue((value) => value + 1);
    };
    window.speechSynthesis.speak(utterance);
    window.speechSynthesis.resume();
  }, []);

  const realtimeSpeak = useCallback((text: string) => {
    if (!dataChannel.current || dataChannel.current.readyState !== "open") {
      browserSpeak(text);
      return;
    }
    setInterviewerSpeaking(true);
    dataChannel.current.send(JSON.stringify({
      event_id: `interviewer-${Date.now()}`,
      type: "response.create",
      response: {
        input: [],
        output_modalities: ["audio"],
        metadata: { kind: "interviewer_line" },
        instructions: (
          "Say exactly the text below from beginning to end. Do not shorten it, answer it, add words, "
          + `or stop early.\n\n${text}`
        ),
      },
    }));
  }, [browserSpeak]);

  const speakText = useCallback((text: string, force = false) => {
    const normalized = text.trim();
    if (!normalized || (!force && lastSpoken.current === normalized)) return;
    lastSpoken.current = normalized;
    if (voiceMode === "realtime" && realtimeState === "connected") realtimeSpeak(normalized);
    else browserSpeak(normalized);
  }, [browserSpeak, realtimeSpeak, realtimeState, voiceMode]);

  useEffect(() => {
    if (interviewDone || !displayedQuestion) return;
    if (realtimeState === "idle" || realtimeState === "connecting") return;
    const spokenTurn = `${leadIn} ${displayedQuestion}`.trim();
    const timer = window.setTimeout(() => speakText(spokenTurn), 350);
    return () => window.clearTimeout(timer);
  }, [displayedQuestion, interviewDone, leadIn, realtimeState, speakText]);

  useEffect(() => {
    if (!interviewDone || dsaStarted) return;
    const timer = window.setTimeout(() => speakText(plan.preferred_language_prompt), 350);
    return () => window.clearTimeout(timer);
  }, [dsaStarted, interviewDone, plan.preferred_language_prompt, speakText]);

  const connectRealtime = useCallback(async () => {
    if (realtimeState === "connecting" || realtimeState === "connected") return;
    setRealtimeState("connecting");
    try {
      const token = await api.realtimeSession(workspace.attempt.id);
      const pc = new RTCPeerConnection();
      peer.current = pc;
      const audio = document.createElement("audio");
      audio.autoplay = true;
      audio.preload = "auto";
      audio.volume = 1;
      audioElement.current = audio;
      pc.ontrack = (event) => {
        audio.srcObject = event.streams[0];
        void audio.play().catch(() => {
          setError("Audio playback was blocked. Use Replay question once to enable Maya’s voice.");
        });
      };
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          channelCount: 1,
        },
      });
      micStream.current = stream;
      const microphoneTrack = stream.getAudioTracks()[0];
      microphoneTrack.enabled = false;
      pc.addTrack(microphoneTrack);
      const channel = pc.createDataChannel("oai-events");
      dataChannel.current = channel;
      channel.addEventListener("open", () => {
        setRealtimeState("connected");
        setVoiceMode("realtime");
      });
      channel.addEventListener("message", (event) => {
        try {
          const message = JSON.parse(event.data);
          if (message.type === "response.output_audio.delta") {
            setInterviewerSpeaking(true);
          }
          if (message.type === "response.output_audio.done") {
            window.setTimeout(() => {
              setInterviewerSpeaking(false);
              setListenCue((value) => value + 1);
            }, 350);
          }
          if (message.type === "conversation.item.input_audio_transcription.delta" && message.delta) {
            const itemId = String(message.item_id || "current");
            transcriptItems.current[itemId] = `${transcriptItems.current[itemId] || ""}${message.delta}`;
            answerRef.current = transcriptItems.current[itemId].trim();
            setAnswer(answerRef.current);
          }
          if (message.type === "conversation.item.input_audio_transcription.completed") {
            const transcript = String(message.transcript || "").trim();
            if (transcript) {
              const itemId = String(message.item_id || "current");
              transcriptItems.current[itemId] = transcript;
              answerRef.current = transcript;
              setAnswer(answerRef.current);
              setCaptureState("ready");
            } else if (speechActivitySeen.current) {
              setCaptureState("idle");
              setError("Your voice was detected, but the words were unclear. Maya will ask you to repeat the answer.");
              browserSpeak("I heard you, but I didn’t catch the words clearly. Could you repeat your answer?");
            } else {
              setNoAnswerExpired(true);
            }
            setCandidateSpeaking(false);
          }
          if (message.type === "conversation.item.input_audio_transcription.failed") {
            setCaptureState("skipping");
            setCandidateSpeaking(false);
            setNoAnswerExpired(true);
          }
          if (message.type === "error") {
            const realtimeMessage = message.error?.message || message.message;
            if (realtimeMessage) setError(`Realtime audio: ${realtimeMessage}`);
          }
        } catch {
          // Ignore non-JSON diagnostics from the data channel.
        }
      });
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      const response = await fetch("https://api.openai.com/v1/realtime/calls", {
        method: "POST",
        body: offer.sdp,
        headers: {
          Authorization: `Bearer ${token.value}`,
          "Content-Type": "application/sdp",
        },
      });
      if (!response.ok) throw new Error(`Realtime WebRTC failed (${response.status})`);
      await pc.setRemoteDescription({ type: "answer", sdp: await response.text() });
    } catch (caught) {
      micStream.current?.getTracks().forEach((track) => track.stop());
      micStream.current = null;
      setRealtimeState("failed");
      setVoiceMode("browser");
      setCaptureState("idle");
      console.info("Realtime voice unavailable; using browser voice.", caught);
    }
  }, [browserSpeak, realtimeState, workspace.attempt.id]);

  useEffect(() => {
    if (realtimeState !== "idle") return;
    const timer = window.setTimeout(() => void connectRealtime(), 500);
    return () => window.clearTimeout(timer);
  }, [connectRealtime, realtimeState]);

  const stopRealtimeLevelMonitor = () => {
    captureGeneration.current += 1;
    if (audioLevelFrame.current) {
      window.cancelAnimationFrame(audioLevelFrame.current);
      audioLevelFrame.current = null;
    }
    if (audioContext.current) {
      void audioContext.current.close().catch(() => undefined);
      audioContext.current = null;
      audioAnalyser.current = null;
    }
    speechDetected.current = false;
    speechFrames.current = 0;
    silenceStartedAt.current = null;
  };

  const monitorRealtimeAnswer = async (stream: MediaStream) => {
    stopRealtimeLevelMonitor();
    const context = new AudioContext();
    const analyser = context.createAnalyser();
    analyser.fftSize = 2048;
    analyser.smoothingTimeConstant = 0.15;
    context.createMediaStreamSource(stream).connect(analyser);
    await context.resume();
    audioContext.current = context;
    audioAnalyser.current = analyser;

    const generation = ++captureGeneration.current;
    const samples = new Float32Array(analyser.fftSize);
    let noiseFloor = 0.0035;

    const finish = () => {
      if (generation !== captureGeneration.current) return;
      stopRealtimeLevelMonitor();
      stream.getAudioTracks().forEach((track) => {
        track.enabled = false;
      });
      setCandidateSpeaking(false);
      setCaptureState("transcribing");
      if (dataChannel.current?.readyState === "open") {
        dataChannel.current.send(JSON.stringify({
          event_id: `commit-answer-${Date.now()}`,
          type: "input_audio_buffer.commit",
        }));
      }
    };

    const sampleLevel = () => {
      if (generation !== captureGeneration.current || !audioAnalyser.current) return;
      audioAnalyser.current.getFloatTimeDomainData(samples);
      let energy = 0;
      for (const sample of samples) energy += sample * sample;
      const rms = Math.sqrt(energy / samples.length);
      const activityThreshold = Math.max(0.0035, Math.min(0.012, noiseFloor * 1.25));
      const startThreshold = Math.max(0.0045, Math.min(0.018, noiseFloor * 1.6));
      const continueThreshold = Math.max(0.0035, Math.min(0.014, noiseFloor * 1.3));

      if (!speechDetected.current) {
        if (rms >= activityThreshold) {
          speechFrames.current += 1;
          if (speechFrames.current >= 2 && !speechActivitySeen.current) {
            speechActivitySeen.current = true;
            if (noAnswerTimer.current) {
              window.clearTimeout(noAnswerTimer.current);
              noAnswerTimer.current = null;
            }
          }
        } else {
          if (rms < 0.006) noiseFloor = noiseFloor * 0.97 + rms * 0.03;
          speechFrames.current = 0;
        }
        if (
          speechFrames.current >= 6
          && (rms >= startThreshold || speechActivitySeen.current)
        ) {
          speechDetected.current = true;
          speechActivitySeen.current = true;
          silenceStartedAt.current = null;
          if (noAnswerTimer.current) {
            window.clearTimeout(noAnswerTimer.current);
            noAnswerTimer.current = null;
          }
          setCandidateSpeaking(true);
          setCaptureState("recording");
        }
      } else if (rms > continueThreshold) {
        silenceStartedAt.current = null;
      } else {
        silenceStartedAt.current ??= performance.now();
        if (performance.now() - silenceStartedAt.current >= 3200) {
          finish();
          return;
        }
      }
      audioLevelFrame.current = window.requestAnimationFrame(sampleLevel);
    };

    audioLevelFrame.current = window.requestAnimationFrame(sampleLevel);
  };

  const startBrowserRecording = () => {
    const Recognition = browserRecognition();
    if (!Recognition) {
      setError("Voice transcription is unavailable in this browser. Retry the Realtime connection.");
      return;
    }
    const instance = new Recognition();
    instance.continuous = true;
    instance.interimResults = false;
    instance.lang = "en-US";
    instance.onspeechstart = () => {
      speechActivitySeen.current = true;
      if (noAnswerTimer.current) {
        window.clearTimeout(noAnswerTimer.current);
        noAnswerTimer.current = null;
      }
      setCandidateSpeaking(true);
      setCaptureState("recording");
    };
    instance.onresult = (event) => {
      const latest = event.results[event.results.length - 1]?.[0]?.transcript;
      if (latest) {
        speechActivitySeen.current = true;
        if (noAnswerTimer.current) {
          window.clearTimeout(noAnswerTimer.current);
          noAnswerTimer.current = null;
        }
        if (browserSilenceTimer.current) window.clearTimeout(browserSilenceTimer.current);
        answerRef.current = `${answerRef.current}${answerRef.current ? " " : ""}${latest}`.trim();
        setAnswer(answerRef.current);
        setCandidateSpeaking(true);
        setCaptureState("recording");
        browserSilenceTimer.current = window.setTimeout(() => recognition.current?.stop(), 1600);
      }
    };
    instance.onend = () => {
      setCandidateSpeaking(false);
      if (answerRef.current) {
        setCaptureState("ready");
      } else if (manualSubmitRequested.current) {
        manualSubmitRequested.current = false;
        setCaptureState("idle");
        setError("No clear words were captured. Your microphone will reopen so you can answer again.");
        window.setTimeout(() => setListenCue((value) => value + 1), 500);
      } else {
        setCaptureState("waiting");
      }
    };
    instance.onerror = () => {
      setCandidateSpeaking(false);
      setCaptureState("idle");
      setError("I couldn’t capture that answer. Please try recording again.");
    };
    recognition.current = instance;
    instance.start();
    setVoiceMode("browser");
    setCandidateSpeaking(false);
    setCaptureState("waiting");
  };

  const startAnswerRecording = () => {
    if (interviewerSpeaking || loading || (interviewDone && !codingReview)) return;
    setError("");
    setNoAnswerExpired(false);
    setAnswer("");
    answerRef.current = "";
    transcriptItems.current = {};
    speechActivitySeen.current = false;
    manualSubmitRequested.current = false;
    if (noAnswerTimer.current) window.clearTimeout(noAnswerTimer.current);
    noAnswerTimer.current = window.setTimeout(() => {
      noAnswerTimer.current = null;
      if (speechActivitySeen.current || speechDetected.current) return;
      stopRealtimeLevelMonitor();
      micStream.current?.getAudioTracks().forEach((track) => {
        track.enabled = false;
      });
      if (dataChannel.current?.readyState === "open") {
        dataChannel.current.send(JSON.stringify({
          event_id: `clear-silent-answer-${Date.now()}`,
          type: "input_audio_buffer.clear",
        }));
      }
      setCandidateSpeaking(false);
      setNoAnswerExpired(true);
    }, 15000);

    const stream = micStream.current;
    const track = stream?.getAudioTracks()[0];
    if (realtimeState === "connected" && track && dataChannel.current?.readyState === "open") {
      dataChannel.current.send(JSON.stringify({
        event_id: `clear-answer-${Date.now()}`,
        type: "input_audio_buffer.clear",
      }));
      track.enabled = true;
      setCandidateSpeaking(false);
      setCaptureState("waiting");
      void monitorRealtimeAnswer(stream).catch(() => {
        track.enabled = false;
        if (dataChannel.current?.readyState === "open") {
          dataChannel.current.send(JSON.stringify({
            event_id: `clear-audio-monitor-fallback-${Date.now()}`,
            type: "input_audio_buffer.clear",
          }));
        }
        startBrowserRecording();
      });
      return;
    }
    startBrowserRecording();
  };

  useEffect(() => {
    if (!listenCue || loading || (interviewDone && !codingReview)) return;
    const timer = window.setTimeout(startAnswerRecording, 250);
    return () => window.clearTimeout(timer);
  // startAnswerRecording intentionally follows the current question state.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [listenCue]);

  const toggleCamera = async () => {
    const track = candidateCamera.current?.getVideoTracks()[0];
    if (track) {
      track.enabled = !track.enabled;
      setCameraEnabled(track.enabled);
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
      candidateCamera.current = stream;
      if (candidateVideo.current) {
        candidateVideo.current.srcObject = stream;
        await candidateVideo.current.play();
      }
      setCameraReady(true);
      setCameraEnabled(true);
    } catch {
      setCameraReady(false);
      setCameraEnabled(false);
      setError("Camera access is unavailable. You can continue with audio and text.");
    }
  };

  const toggleFullscreen = async () => {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await document.documentElement.requestFullscreen();
    } catch {
      setError("Full-screen mode could not be changed. Use your browser’s full-screen control instead.");
    }
  };

  const endInterview = async () => {
    if (!window.confirm("End this interview and open the report?")) return;
    await api.completeAttempt(workspace.attempt.id).catch(() => undefined);
    onComplete();
  };

  const submitAnswer = async (
    answerText = answerRef.current,
    skipFollowUps = false,
  ) => {
    if (!currentQuestion || !answerText.trim() || loading) return;
    if (noAnswerTimer.current) window.clearTimeout(noAnswerTimer.current);
    micStream.current?.getAudioTracks().forEach((track) => {
      track.enabled = false;
    });
    recognition.current?.stop();
    manualSubmitRequested.current = false;
    setLoading(true);
    setError("");
    try {
      const response = await api.interviewReply({
        attempt_id: workspace.attempt.id,
        question_id: currentQuestion.id,
        topic: currentQuestion.topic,
        question: displayedQuestion,
        expected_signals: currentQuestion.expected_signals,
        answer: answerText.trim(),
        follow_up_count: skipFollowUps ? currentQuestion.max_follow_ups : followUpCount,
        max_follow_ups: currentQuestion.max_follow_ups,
        recovery_question: recoveryFollowUp,
      });
      setTurns((current) => [...current, response.turn]);
      setAnswer("");
      answerRef.current = "";
      setCaptureState("idle");
      if (
        !skipFollowUps
        && !recoveryFollowUp
        && response.turn.follow_up
        && followUpCount < currentQuestion.max_follow_ups
      ) {
        setLeadIn(response.turn.acknowledgement);
        setFollowUp(response.turn.follow_up);
        setRecoveryFollowUp(response.turn.follow_up_kind === "basic_recovery");
        setFollowUpCount((value) => value + 1);
      } else {
        const nextQuestion = plan.questions[questionIndex + 1];
        const transition = nextQuestion
          ? nextQuestion.kind === "closing"
            ? "One last thing before we code."
            : nextQuestion.topic === currentQuestion.topic
              ? "Staying with that for a moment."
              : ""
          : "";
        setLeadIn(`${response.turn.acknowledgement} ${transition}`.trim());
        setFollowUp(null);
        setRecoveryFollowUp(false);
        setFollowUpCount(0);
        setQuestionIndex((value) => value + 1);
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not evaluate this answer.");
    } finally {
      setLoading(false);
      setNoAnswerExpired(false);
    }
  };

  const submitCodingFollowUp = async (answerText: string) => {
    if (!codingReview || !answerText.trim() || loading) return;
    if (noAnswerTimer.current) window.clearTimeout(noAnswerTimer.current);
    micStream.current?.getAudioTracks().forEach((track) => {
      track.enabled = false;
    });
    recognition.current?.stop();
    manualSubmitRequested.current = false;
    setLoading(true);
    setError("");
    try {
      await api.answerInterviewCodeFollowUp(
        workspace.attempt.id,
        codingReview.submission_id,
        codingReview.follow_up,
        answerText.trim(),
      );
      setCodingFollowUpComplete(true);
      setCaptureState("idle");
      setAnswer("");
      answerRef.current = "";
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not save the coding follow-up answer.");
    } finally {
      setLoading(false);
      setNoAnswerExpired(false);
    }
  };

  const requestAnswerSubmission = () => {
    if (loading || interviewerSpeaking || captureState === "skipping") return;
    setError("");
    setNoAnswerExpired(false);
    if (noAnswerTimer.current) {
      window.clearTimeout(noAnswerTimer.current);
      noAnswerTimer.current = null;
    }

    if (captureState === "ready" && answerRef.current.trim()) {
      if (interviewDone && codingReview) void submitCodingFollowUp(answerRef.current);
      else void submitAnswer(answerRef.current);
      return;
    }

    manualSubmitRequested.current = true;
    if (voiceMode === "realtime" && dataChannel.current?.readyState === "open") {
      stopRealtimeLevelMonitor();
      micStream.current?.getAudioTracks().forEach((track) => {
        track.enabled = false;
      });
      setCandidateSpeaking(false);
      setCaptureState("transcribing");
      dataChannel.current.send(JSON.stringify({
        event_id: `commit-manual-answer-${Date.now()}`,
        type: "input_audio_buffer.commit",
      }));
      return;
    }

    if (browserSilenceTimer.current) {
      window.clearTimeout(browserSilenceTimer.current);
      browserSilenceTimer.current = null;
    }
    recognition.current?.stop();
    setCandidateSpeaking(false);
    if (answerRef.current.trim() && captureState !== "recording" && captureState !== "waiting") {
      setCaptureState("ready");
    }
  };

  useEffect(() => {
    if (
      !manualSubmitRequested.current
      || captureState !== "ready"
      || !answer.trim()
      || loading
    ) return;
    manualSubmitRequested.current = false;
    if (interviewDone && codingReview) void submitCodingFollowUp(answerRef.current);
    else void submitAnswer(answerRef.current);
  // Submission handlers intentionally read the latest interview state once
  // speech transcription has finalized after the candidate presses Submit.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [answer, captureState, codingReview, interviewDone, loading]);

  useEffect(() => {
    if (!noAnswerExpired || loading || interviewDone) return;
    setCaptureState("skipping");
    void submitAnswer("No response was provided within 15 seconds.", true);
  // submitAnswer reads the current question at the silence deadline.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [noAnswerExpired]);

  useEffect(() => {
    if (!noAnswerExpired || loading || !interviewDone || !codingReview) return;
    setCaptureState("skipping");
    void submitCodingFollowUp("No response was provided within 15 seconds.");
  // The coding follow-up also advances after the silence deadline.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [codingReview, interviewDone, noAnswerExpired]);

  if (interviewDone) {
    return (
      <div className="space-y-7">
        <Card className="overflow-hidden">
          <div className="bg-[#17333b] p-8 text-white sm:p-10">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[.14em] text-emerald-300"><CheckCircle2 size={16} /> Conversation complete</div>
            <h1 className="mt-3 font-serif text-4xl font-bold">Now, let’s work through one easy coding question.</h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-white/60">{plan.preferred_language_prompt}</p>
            <div className="mt-5 flex max-w-sm items-center gap-2">
              <Languages size={18} className="text-emerald-300" />
              <select value={preferredLanguage} onChange={(event) => setPreferredLanguage(event.target.value)} className="rounded-xl border border-white/[0.15] bg-white/10 px-4 py-2.5 text-sm font-bold text-white outline-none">
                {["python", "java", "javascript", "typescript", "c", "cpp", "csharp", "go"].map((language) => <option key={language} value={language} className="text-black">{language}</option>)}
              </select>
            </div>
          </div>
        </Card>
        {!dsaStarted ? (
          <Card className="p-6 sm:p-8">
            <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-center">
              <div>
                <div className="text-xs font-black uppercase tracking-[.13em] text-brand-700">Language selected</div>
                <p className="mt-2 max-w-xl text-sm leading-6 text-muted">
                  A direct easy DSA question is selected fresh for this interview. There are no test cases; Maya will discuss your submitted code.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button variant="secondary" onClick={() => speakText(plan.preferred_language_prompt, true)}>
                  <Volume2 size={15} /> Replay prompt
                </Button>
                <Button onClick={() => setDsaStarted(true)}>
                  Open coding question <ChevronRight size={16} />
                </Button>
              </div>
            </div>
          </Card>
        ) : (
          <InterviewCodingRound
            workspace={workspace}
            language={preferredLanguage}
            followUpComplete={codingFollowUpComplete}
            onProblemPresented={(problem: InterviewCodingProblem) =>
              speakText(`Here is your coding question. ${problem.title}. ${problem.prompt}`, true)
            }
            onFollowUp={(review: InterviewCodingReview) => {
              setCodingReview(review);
              setCodingFollowUpComplete(false);
              speakText(`${review.acknowledgement} ${review.follow_up}`, true);
            }}
          />
        )}
        {codingReview && !codingFollowUpComplete && (
          <Card className="p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="text-xs font-black uppercase tracking-[.12em] text-brand-700">
                  Code discussion
                </div>
                <p className="mt-2 text-sm font-semibold">{codingReview.follow_up}</p>
              </div>
              <Badge tone={captureState === "recording" ? "red" : captureState === "ready" ? "green" : "amber"}>
                {interviewerSpeaking
                  ? "Maya speaking"
                  : captureState === "waiting"
                    ? "listening"
                    : captureState === "recording"
                      ? "recording answer"
                      : captureState === "transcribing"
                        ? "transcribing"
                        : "preparing"}
              </Badge>
            </div>
            {answer && <p className="mt-3 rounded-xl bg-slate-50 p-3 text-xs leading-6 text-slate-700">{answer}</p>}
            <Button
              className="mt-4 w-full"
              loading={loading}
              disabled={
                interviewerSpeaking
                || captureState === "skipping"
                || (!answer.trim() && captureState !== "recording" && captureState !== "transcribing")
              }
              onClick={requestAnswerSubmission}
            >
              Submit spoken answer <Send size={15} />
            </Button>
          </Card>
        )}
        {codingFollowUpComplete && (
          <div className="flex justify-end">
            <Button onClick={async () => {
              await api.completeAttempt(workspace.attempt.id).catch(() => undefined);
              onComplete();
            }}>Finish interview and open report <ChevronRight size={16} /></Button>
          </div>
        )}
      </div>
    );
  }

  const progress = ((questionIndex + (followUp ? 0.5 : 0)) / plan.questions.length) * 100;
  return (
    <div className="space-y-4">
      {error && <ErrorBanner message={error} />}
      <section className="overflow-hidden rounded-[28px] border border-slate-700 bg-[#101418] text-white shadow-2xl">
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 px-5 py-3.5">
          <div className="flex min-w-0 items-center gap-3">
            <div className="grid size-9 shrink-0 place-items-center rounded-xl bg-emerald-400/[0.15] text-emerald-300">
              <AudioLines size={18} />
            </div>
            <div className="min-w-0">
              <div className="truncate text-sm font-bold">Technical interview · {currentQuestion.topic}</div>
              <div className="mt-0.5 flex items-center gap-2 text-[11px] text-white/50">
                <span className={remainingSeconds <= 60 ? "font-bold text-rose-300" : ""}>
                  {formatDuration(remainingSeconds)} remaining
                </span>
                <span>•</span>
                <span className="inline-flex items-center gap-1"><Signal size={11} /> Live</span>
                <span>•</span>
                <span className="inline-flex items-center gap-1"><Users size={11} /> 2 participants</span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-[11px] font-semibold text-white/[0.65]">
              Maya · AI interviewer
            </span>
            <span className="hidden rounded-full bg-emerald-400/10 px-3 py-1.5 text-[11px] font-semibold text-emerald-300 sm:inline-flex">
              {realtimeState === "connected" ? "Natural voice connected" : realtimeState === "connecting" ? "Connecting voice…" : "Browser voice"}
            </span>
          </div>
        </header>

        <div className="grid min-h-[660px] lg:grid-cols-[minmax(0,1fr)_360px]">
          <div className="relative flex min-h-[540px] flex-col overflow-hidden bg-[radial-gradient(circle_at_50%_28%,#34424d_0,#1c252c_42%,#12171b_78%)]">
            <div className="absolute left-5 top-5 z-20 flex flex-wrap items-center gap-2">
              <Badge tone="blue">{currentQuestion.topic}</Badge>
              <span className="rounded-full bg-black/[0.35] px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-white/70 backdrop-blur">
                {recoveryFollowUp ? "Basic follow-up" : followUp ? `Follow-up ${followUpCount}` : currentQuestion.kind}
              </span>
            </div>

            <div className="flex flex-1 items-center justify-center px-6 py-20">
              <div className="relative">
                <div className={`absolute -inset-7 rounded-full border border-emerald-300/20 transition ${interviewerSpeaking ? "animate-ping opacity-70" : "opacity-0"}`} />
                <div className={`absolute -inset-3 rounded-full border-2 transition ${interviewerSpeaking ? "border-emerald-300/60 shadow-[0_0_45px_rgba(110,231,183,.22)]" : "border-white/10"}`} />
                <div className="relative grid size-40 place-items-center overflow-hidden rounded-full bg-gradient-to-br from-[#ecc9b0] via-[#d99c7e] to-[#7d4c43] shadow-2xl sm:size-52">
                  <div className="absolute inset-x-6 top-5 h-24 rounded-[50%_50%_42%_42%] bg-[#302825] sm:inset-x-8 sm:h-32" />
                  <div className="absolute bottom-0 h-[78%] w-[68%] rounded-[48%_48%_40%_40%] bg-[#e9b898]">
                    <div className="absolute left-[22%] top-[42%] size-2 rounded-full bg-[#302825]" />
                    <div className="absolute right-[22%] top-[42%] size-2 rounded-full bg-[#302825]" />
                    <div className="absolute left-1/2 top-[63%] h-2 w-8 -translate-x-1/2 rounded-b-full border-b-2 border-[#9f5e58]" />
                  </div>
                  <div className="absolute bottom-0 h-[28%] w-full bg-gradient-to-b from-[#355b66] to-[#223a43]" />
                </div>
                <div className="absolute -bottom-4 left-1/2 flex -translate-x-1/2 items-center gap-2 whitespace-nowrap rounded-full bg-black/[0.55] px-3.5 py-2 text-xs font-semibold shadow-lg backdrop-blur-md">
                  {interviewerSpeaking && <span className="size-2 animate-pulse rounded-full bg-emerald-400" />}
                  Maya {interviewerSpeaking ? "is speaking" : "Interviewer"}
                </div>
              </div>
            </div>

            <div className="absolute bottom-24 right-5 z-20 h-32 w-48 overflow-hidden rounded-2xl border border-white/[0.15] bg-[#20282e] shadow-2xl sm:h-40 sm:w-60">
              <video ref={candidateVideo} muted playsInline className={`h-full w-full object-cover ${cameraEnabled ? "" : "hidden"}`} />
              {(!cameraReady || !cameraEnabled) && (
                <div className="grid h-full place-items-center text-center text-white/[0.55]">
                  <div>
                    <div className="mx-auto grid size-12 place-items-center rounded-full bg-white/10"><VideoOff size={20} /></div>
                    <div className="mt-2 text-xs">Camera off</div>
                  </div>
                </div>
              )}
              <div className="absolute inset-x-0 bottom-0 flex items-center justify-between bg-gradient-to-t from-black/70 to-transparent px-3 pb-2 pt-7 text-[11px] font-semibold">
                <span>You</span>
                {(candidateSpeaking || captureState === "recording") && <span className="rounded-full bg-emerald-400/90 px-2 py-0.5 text-[9px] font-bold uppercase text-emerald-950">Speaking</span>}
              </div>
            </div>

            {captionsVisible && (
              <div className="absolute inset-x-4 bottom-24 z-10 flex justify-center sm:inset-x-10 sm:pr-64">
                <div className="max-w-3xl rounded-2xl bg-black/[0.65] px-5 py-3 text-center text-sm leading-6 shadow-xl backdrop-blur-md sm:text-base">
                  {leadIn && <span className="mr-1 text-white/[0.65]">{leadIn}</span>}
                  <span className="font-semibold text-white">{displayedQuestion}</span>
                </div>
              </div>
            )}

            <div className="relative z-30 flex flex-wrap items-center justify-center gap-2 border-t border-white/10 bg-black/25 px-4 py-4 backdrop-blur-lg">
              <button
                type="button"
                disabled
                className={`grid size-11 place-items-center rounded-full ${
                  captureState === "recording" || captureState === "waiting"
                    ? "bg-emerald-500 text-emerald-950"
                    : "bg-white/[0.12] text-white/55"
                }`}
                aria-label="Microphone is controlled automatically"
                title="Microphone opens automatically after each question"
              >
                <Mic size={19} />
              </button>
              <button
                type="button"
                onClick={() => void toggleCamera()}
                className={`grid size-11 place-items-center rounded-full transition ${cameraEnabled ? "bg-white/[0.12] hover:bg-white/20" : "bg-rose-600 hover:bg-rose-500"}`}
                aria-label={cameraEnabled ? "Turn off camera" : "Turn on camera"}
                title={cameraEnabled ? "Turn off camera" : "Turn on camera"}
              >
                {cameraEnabled ? <Video size={19} /> : <VideoOff size={19} />}
              </button>
              <button type="button" onClick={() => setCaptionsVisible((value) => !value)} className={`grid size-11 place-items-center rounded-full transition ${captionsVisible ? "bg-sky-500 text-white" : "bg-white/[0.12] hover:bg-white/20"}`} title="Toggle captions">
                <Captions size={19} />
              </button>
              <button type="button" onClick={() => speakText(`${leadIn} ${displayedQuestion}`, true)} className="grid size-11 place-items-center rounded-full bg-white/[0.12] transition hover:bg-white/20" title="Replay question">
                <Volume2 size={19} />
              </button>
              <button type="button" onClick={() => void toggleFullscreen()} className="grid size-11 place-items-center rounded-full bg-white/[0.12] transition hover:bg-white/20" title="Toggle full screen">
                <Maximize2 size={19} />
              </button>
              <button type="button" onClick={() => void endInterview()} className="ml-2 grid h-11 w-16 place-items-center rounded-full bg-rose-600 transition hover:bg-rose-500" title="End interview">
                <PhoneOff size={20} />
              </button>
            </div>
          </div>

          <aside className="flex min-h-0 flex-col border-l border-white/10 bg-[#171c20]">
            <div className="border-b border-white/10 px-5 py-4">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-sm font-bold">Live conversation</h2>
                  <p className="mt-1 text-[11px] text-white/[0.45]">Questions are spoken and shown together.</p>
                </div>
                <div className="text-right text-[10px] font-semibold uppercase tracking-wider text-white/[0.45]">
                  {questionIndex + 1}/{plan.questions.length}
                </div>
              </div>
              <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/10">
                <div className="h-full rounded-full bg-emerald-400 transition-all duration-500" style={{ width: `${progress}%` }} />
              </div>
            </div>

            <div className="flex-1 space-y-4 overflow-y-auto px-4 py-5">
              {turns.slice(-4).map((turn, index) => (
                <div key={`${turn.question_id}-${index}`} className="space-y-2">
                  <div className="max-w-[92%] rounded-2xl rounded-tl-md bg-white/[0.08] px-3.5 py-3 text-xs leading-5 text-white/75">
                    <div className="mb-1 text-[9px] font-bold uppercase tracking-wider text-emerald-300">Maya</div>
                    {turn.question}
                  </div>
                  <div className="ml-auto max-w-[92%] rounded-2xl rounded-tr-md bg-sky-500/20 px-3.5 py-3 text-xs leading-5 text-white/80">
                    <div className="mb-1 text-[9px] font-bold uppercase tracking-wider text-sky-300">You</div>
                    {turn.answer}
                  </div>
                </div>
              ))}
              <div className="max-w-[94%] rounded-2xl rounded-tl-md border border-emerald-300/[0.15] bg-emerald-300/[0.08] px-3.5 py-3 text-xs leading-5 text-white/[0.85]">
                <div className="mb-1.5 flex items-center gap-2 text-[9px] font-bold uppercase tracking-wider text-emerald-300">
                  <span className={`size-1.5 rounded-full bg-emerald-400 ${interviewerSpeaking ? "animate-pulse" : ""}`} />
                  Maya · current question
                </div>
                {leadIn && <span className="text-white/[0.55]">{leadIn} </span>}
                {displayedQuestion}
              </div>
            </div>

            <div className="border-t border-white/10 p-4">
              <div className="flex items-center justify-between gap-3">
                <div className="text-[10px] font-bold uppercase tracking-[.12em] text-white/[0.45]">Voice answer</div>
                <span className={`rounded-full px-2.5 py-1 text-[9px] font-bold uppercase tracking-wider ${
                  captureState === "recording"
                    ? "bg-rose-500/20 text-rose-300"
                    : captureState === "waiting"
                      ? "bg-emerald-400/15 text-emerald-300"
                    : captureState === "transcribing"
                      ? "bg-amber-400/15 text-amber-200"
                      : captureState === "ready"
                        ? "bg-emerald-400/15 text-emerald-300"
                        : "bg-white/5 text-white/40"
                }`}>
                  {captureState === "recording"
                    ? "recording"
                    : captureState === "waiting"
                      ? "listening"
                    : captureState === "transcribing"
                      ? "transcribing"
                        : captureState === "ready"
                          ? "answer ready"
                          : captureState === "skipping"
                            ? "moving on"
                        : interviewerSpeaking
                          ? "Maya speaking"
                          : "ready to record"}
                </span>
              </div>
              <div className="mt-2 min-h-28 rounded-2xl border border-white/10 bg-white/5 px-3.5 py-3 text-sm leading-6 text-white/80">
                {answer ? (
                  <p>{answer}</p>
                ) : (
                  <div className="flex min-h-20 items-center justify-center text-center text-xs leading-5 text-white/35">
                    {captureState === "recording"
                      ? "I’m listening. Keep speaking naturally."
                      : captureState === "waiting"
                        ? "Your microphone is live. Start answering now."
                      : captureState === "transcribing"
                        ? "Turning your answer into a transcript…"
                        : captureState === "skipping"
                          ? "No answer was detected within 15 seconds. Moving to the next question…"
                        : interviewerSpeaking
                          ? "Wait for Maya to finish speaking."
                          : "Maya will open your microphone automatically after the question."}
                  </div>
                )}
              </div>
              <Button
                className="mt-3 w-full"
                loading={loading}
                disabled={
                  interviewerSpeaking
                  || captureState === "skipping"
                  || (!answer.trim() && captureState !== "recording" && captureState !== "transcribing")
                }
                onClick={requestAnswerSubmission}
              >
                {captureState === "transcribing" ? "Finish transcription and submit" : "Submit answer"}
                <Send size={15} />
              </Button>
              <p className="mt-3 text-center text-[10px] leading-5 text-white/40">
                Speak naturally, then press Submit answer when you are finished. If you do not begin within 15 seconds, the interview continues.
              </p>
              {realtimeState === "failed" && (
                <button type="button" onClick={() => void connectRealtime()} className="mt-3 inline-flex items-center gap-1.5 text-[11px] font-semibold text-white/[0.45] transition hover:text-white/75">
                  <PlugZap size={13} /> Retry natural Realtime voice
                </button>
              )}
            </div>
          </aside>
        </div>
      </section>
      <p className="px-2 text-center text-xs leading-5 text-muted">
        Maya is an AI interviewer. Questions, follow-ups, and evidence are generated from the uploaded resume and role description.
      </p>
    </div>
  );
}
