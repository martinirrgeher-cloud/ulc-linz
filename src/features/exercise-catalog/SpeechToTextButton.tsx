import { useEffect, useRef, useState } from "react";
import { Mic, MicOff } from "lucide-react";

type SpeechRecognitionAlternativeLike = {
  transcript: string;
};

type SpeechRecognitionResultLike = {
  readonly length: number;
  readonly isFinal: boolean;
  [index: number]: SpeechRecognitionAlternativeLike;
};

type SpeechRecognitionResultListLike = {
  readonly length: number;
  [index: number]: SpeechRecognitionResultLike;
};

type SpeechRecognitionEventLike = Event & {
  results: SpeechRecognitionResultListLike;
};

type SpeechRecognitionErrorEventLike = Event & {
  error: string;
};

type SpeechRecognitionLike = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEventLike) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
};

type SpeechRecognitionConstructor = new () => SpeechRecognitionLike;

type SpeechRecognitionWindow = Window & typeof globalThis & {
  SpeechRecognition?: SpeechRecognitionConstructor;
  webkitSpeechRecognition?: SpeechRecognitionConstructor;
};

type SpeechToTextButtonProps = {
  label: string;
  disabled?: boolean;
  onTranscript: (transcript: string) => void;
};

function recognitionConstructor(): SpeechRecognitionConstructor | null {
  if (typeof window === "undefined") return null;
  const speechWindow = window as SpeechRecognitionWindow;
  return speechWindow.SpeechRecognition ?? speechWindow.webkitSpeechRecognition ?? null;
}

export function SpeechToTextButton({ label, disabled = false, onTranscript }: SpeechToTextButtonProps) {
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const [listening, setListening] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const supported = recognitionConstructor() !== null;

  useEffect(() => () => {
    recognitionRef.current?.abort();
    recognitionRef.current = null;
  }, []);

  function stopRecognition() {
    recognitionRef.current?.stop();
  }

  function startRecognition() {
    const Recognition = recognitionConstructor();
    if (!Recognition || disabled) return;

    setError(null);
    const recognition = new Recognition();
    recognition.lang = "de-AT";
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.onresult = (event) => {
      const transcripts: string[] = [];
      for (let resultIndex = 0; resultIndex < event.results.length; resultIndex += 1) {
        const result = event.results[resultIndex];
        const alternative = result?.[0];
        if (result?.isFinal && alternative?.transcript.trim()) transcripts.push(alternative.transcript.trim());
      }
      const transcript = transcripts.join(" ").trim();
      if (transcript) onTranscript(transcript);
    };
    recognition.onerror = (event) => {
      if (event.error !== "aborted" && event.error !== "no-speech") {
        setError("Spracheingabe nicht möglich");
      }
      setListening(false);
    };
    recognition.onend = () => {
      recognitionRef.current = null;
      setListening(false);
    };

    recognitionRef.current = recognition;
    setListening(true);
    try {
      recognition.start();
    } catch {
      recognitionRef.current = null;
      setListening(false);
      setError("Spracheingabe nicht möglich");
    }
  }

  const buttonLabel = !supported
    ? `${label}: Spracheingabe wird von diesem Browser nicht unterstützt`
    : listening
      ? `${label}: Spracheingabe stoppen`
      : `${label}: Spracheingabe starten`;

  return (
    <span className="exercise-speech-control">
      <button
        type="button"
        className={`exercise-speech-button ${listening ? "listening" : ""}`}
        onClick={listening ? stopRecognition : startRecognition}
        disabled={disabled || !supported}
        aria-label={buttonLabel}
        title={buttonLabel}
      >
        {supported ? <Mic aria-hidden="true" /> : <MicOff aria-hidden="true" />}
      </button>
      {listening && <small aria-live="polite">Hört zu …</small>}
      {error && <small className="error" aria-live="polite">{error}</small>}
    </span>
  );
}
