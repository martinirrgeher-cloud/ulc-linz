import {
  CircleCheck,
  CirclePlay,
  Pause,
  Play,
  RotateCcw,
  Square,
  TimerReset,
  Volume2,
  VolumeX,
} from "lucide-react";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type FocusEvent,
  type KeyboardEvent,
} from "react";
import { useNavigationGuard } from "@/components/layout/NavigationGuardContext";
import {
  DEFAULT_COUNTDOWN_SETTINGS,
  formatClock,
  normalizeInteger,
  plannedDurationSeconds,
  shouldAnnounceRemainingSecond,
  type CountdownPhase,
  type CountdownSettings,
} from "@/features/countdown/timer";
import "@/styles/countdown.css";

const SETTINGS_STORAGE_KEY = "ulc-countdown-settings-v1";

interface WakeLockSentinelLike {
  released: boolean;
  release: () => Promise<void>;
  addEventListener: (type: "release", listener: () => void) => void;
}

type WakeLockNavigator = Navigator & {
  wakeLock?: {
    request: (type: "screen") => Promise<WakeLockSentinelLike>;
  };
};

function readStoredSettings(): CountdownSettings {
  try {
    const stored = window.localStorage.getItem(SETTINGS_STORAGE_KEY);
    if (!stored) return DEFAULT_COUNTDOWN_SETTINGS;
    const parsed = JSON.parse(stored) as Partial<CountdownSettings>;
    return {
      workSeconds: normalizeInteger(parsed.workSeconds ?? 30, 5, 3600),
      restSeconds: normalizeInteger(parsed.restSeconds ?? 15, 1, 3600),
      exerciseCount: normalizeInteger(parsed.exerciseCount ?? 8, 1, 200),
      workAnnouncementInterval: normalizeInteger(
        parsed.workAnnouncementInterval ?? 10,
        0,
        3600,
      ),
      restAnnouncementInterval: normalizeInteger(
        parsed.restAnnouncementInterval ?? 5,
        0,
        3600,
      ),
      announceRemainingExercises: parsed.announceRemainingExercises ?? true,
      voiceEnabled: parsed.voiceEnabled ?? true,
    };
  } catch {
    return DEFAULT_COUNTDOWN_SETTINGS;
  }
}

function phaseLabel(phase: CountdownPhase): string {
  if (phase === "work") return "Belastung";
  if (phase === "rest") return "Pause";
  if (phase === "complete") return "Fertig";
  return "Bereit";
}

type NumericSettingKey =
  | "workSeconds"
  | "restSeconds"
  | "exerciseCount"
  | "workAnnouncementInterval"
  | "restAnnouncementInterval";

const NUMERIC_LIMITS: Record<NumericSettingKey, { minimum: number; maximum: number }> = {
  workSeconds: { minimum: 5, maximum: 3600 },
  restSeconds: { minimum: 1, maximum: 3600 },
  exerciseCount: { minimum: 1, maximum: 200 },
  workAnnouncementInterval: { minimum: 0, maximum: 3600 },
  restAnnouncementInterval: { minimum: 0, maximum: 3600 },
};

function settingsDrafts(settings: CountdownSettings): Record<NumericSettingKey, string> {
  return {
    workSeconds: String(settings.workSeconds),
    restSeconds: String(settings.restSeconds),
    exerciseCount: String(settings.exerciseCount),
    workAnnouncementInterval: String(settings.workAnnouncementInterval),
    restAnnouncementInterval: String(settings.restAnnouncementInterval),
  };
}

function normalizeDraft(
  key: NumericSettingKey,
  rawValue: string,
  fallback: number,
): number {
  const trimmed = rawValue.trim();
  if (!trimmed) return fallback;
  const { minimum, maximum } = NUMERIC_LIMITS[key];
  return normalizeInteger(Number(trimmed), minimum, maximum);
}

export function CountdownPage() {
  const [settings, setSettings] = useState<CountdownSettings>(readStoredSettings);
  const settingsRef = useRef(settings);
  const [numberDrafts, setNumberDrafts] = useState(() => settingsDrafts(settings));
  const [phase, setPhase] = useState<CountdownPhase>("idle");
  const phaseRef = useRef<CountdownPhase>("idle");
  const [currentExercise, setCurrentExercise] = useState(1);
  const currentExerciseRef = useRef(1);
  const [remainingSeconds, setRemainingSeconds] = useState(settings.workSeconds);
  const remainingSecondsRef = useRef(settings.workSeconds);
  const [paused, setPaused] = useState(false);
  const pausedRef = useRef(false);
  const endAtRef = useRef(0);
  const phaseDurationRef = useRef(settings.workSeconds);
  const announcedKeysRef = useRef(new Set<string>());
  const transitionRunningRef = useRef(false);
  const wakeLockRef = useRef<WakeLockSentinelLike | null>(null);
  const [wakeLockActive, setWakeLockActive] = useState(false);
  const [voiceAvailable] = useState(
    () => typeof window !== "undefined" && "speechSynthesis" in window,
  );

  const active = phase === "work" || phase === "rest";
  const timerInProgress = active || paused;
  const currentPhaseDuration = phase === "rest"
    ? settings.restSeconds
    : settings.workSeconds;
  const progress = phase === "complete"
    ? 100
    : Math.min(
        100,
        Math.max(
          0,
          ((currentPhaseDuration - remainingSeconds) / currentPhaseDuration) * 100,
        ),
      );

  useEffect(() => {
    settingsRef.current = settings;
    window.localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings));
    if (phase === "idle") {
      setRemainingSeconds(settings.workSeconds);
      remainingSecondsRef.current = settings.workSeconds;
    }
  }, [phase, settings]);

  const releaseWakeLock = useCallback(async () => {
    const current = wakeLockRef.current;
    wakeLockRef.current = null;
    setWakeLockActive(false);
    if (current && !current.released) {
      try {
        await current.release();
      } catch {
        // Das Gerät kann die Sperre bereits selbst aufgehoben haben.
      }
    }
  }, []);

  const requestWakeLock = useCallback(async () => {
    const existing = wakeLockRef.current;
    if (existing && !existing.released) return;
    const wakeLockNavigator = navigator as WakeLockNavigator;
    if (!wakeLockNavigator.wakeLock || document.visibilityState !== "visible") return;
    try {
      const sentinel = await wakeLockNavigator.wakeLock.request("screen");
      wakeLockRef.current = sentinel;
      setWakeLockActive(true);
      sentinel.addEventListener("release", () => {
        if (wakeLockRef.current === sentinel) wakeLockRef.current = null;
        setWakeLockActive(false);
      });
    } catch {
      setWakeLockActive(false);
    }
  }, []);

  const speak = useCallback((text: string, interrupt = false) => {
    if (!settingsRef.current.voiceEnabled || !("speechSynthesis" in window)) return;
    if (interrupt) window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = "de-AT";
    utterance.rate = 1;
    const voices = window.speechSynthesis.getVoices();
    const germanVoice = voices.find((voice) => voice.lang === "de-AT")
      ?? voices.find((voice) => voice.lang.startsWith("de"));
    if (germanVoice) utterance.voice = germanVoice;
    window.speechSynthesis.speak(utterance);
  }, []);

  const updatePhaseState = useCallback((nextPhase: CountdownPhase) => {
    phaseRef.current = nextPhase;
    setPhase(nextPhase);
  }, []);

  const setRemaining = useCallback((value: number) => {
    remainingSecondsRef.current = value;
    setRemainingSeconds(value);
  }, []);

  const setExercise = useCallback((value: number) => {
    currentExerciseRef.current = value;
    setCurrentExercise(value);
  }, []);

  const completeCountdown = useCallback(() => {
    transitionRunningRef.current = false;
    pausedRef.current = false;
    setPaused(false);
    updatePhaseState("complete");
    setRemaining(0);
    window.speechSynthesis?.cancel();
    speak("Training beendet");
    void releaseWakeLock();
  }, [releaseWakeLock, setRemaining, speak, updatePhaseState]);

  const beginPhase = useCallback((nextPhase: "work" | "rest", exercise: number) => {
    const currentSettings = settingsRef.current;
    const duration = nextPhase === "work"
      ? currentSettings.workSeconds
      : currentSettings.restSeconds;
    updatePhaseState(nextPhase);
    setExercise(exercise);
    phaseDurationRef.current = duration;
    announcedKeysRef.current.clear();
    setRemaining(duration);
    endAtRef.current = Date.now() + duration * 1000;
    transitionRunningRef.current = false;
    if (nextPhase === "work") {
      speak(`Belastung. Übung ${exercise} von ${currentSettings.exerciseCount}`);
    } else {
      speak("Pause");
    }
  }, [setExercise, setRemaining, speak, updatePhaseState]);

  const finishCurrentPhase = useCallback(() => {
    if (transitionRunningRef.current) return;
    transitionRunningRef.current = true;
    const currentSettings = settingsRef.current;
    const currentPhase = phaseRef.current;
    const exercise = currentExerciseRef.current;

    if (currentPhase === "work") {
      if (exercise >= currentSettings.exerciseCount) {
        completeCountdown();
        return;
      }
      if (currentSettings.announceRemainingExercises) {
        const remainingExercises = currentSettings.exerciseCount - exercise;
        speak(
          remainingExercises === 1
            ? "Noch eine Übung"
            : `Noch ${remainingExercises} Übungen`,
        );
      }
      beginPhase("rest", exercise);
      return;
    }

    if (currentPhase === "rest") {
      beginPhase("work", exercise + 1);
      return;
    }

    transitionRunningRef.current = false;
  }, [beginPhase, completeCountdown, speak]);

  useEffect(() => {
    if (!active || paused) return undefined;

    const tick = () => {
      const nextRemaining = Math.max(0, Math.ceil((endAtRef.current - Date.now()) / 1000));
      if (nextRemaining !== remainingSecondsRef.current) {
        setRemaining(nextRemaining);
        if (nextRemaining > 0) {
          const currentSettings = settingsRef.current;
          const currentPhase = phaseRef.current;
          const interval = currentPhase === "work"
            ? currentSettings.workAnnouncementInterval
            : currentSettings.restAnnouncementInterval;
          const key = `${currentPhase}:${currentExerciseRef.current}:${nextRemaining}`;
          if (
            shouldAnnounceRemainingSecond(
              nextRemaining,
              phaseDurationRef.current,
              interval,
            ) && !announcedKeysRef.current.has(key)
          ) {
            announcedKeysRef.current.add(key);
            speak(nextRemaining <= 5 ? String(nextRemaining) : `${nextRemaining} Sekunden`);
          }
        }
      }
      if (nextRemaining <= 0) finishCurrentPhase();
    };

    tick();
    const intervalId = window.setInterval(tick, 200);
    return () => window.clearInterval(intervalId);
  }, [active, finishCurrentPhase, paused, setRemaining, speak]);

  useEffect(() => {
    function handleVisibilityChange() {
      if (document.visibilityState === "visible" && active && !pausedRef.current) {
        void requestWakeLock();
      }
    }
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => document.removeEventListener("visibilitychange", handleVisibilityChange);
  }, [active, requestWakeLock]);

  useEffect(() => () => {
    window.speechSynthesis?.cancel();
    void releaseWakeLock();
  }, [releaseWakeLock]);

  useEffect(() => {
    if (!timerInProgress) return undefined;
    const beforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", beforeUnload);
    return () => window.removeEventListener("beforeunload", beforeUnload);
  }, [timerInProgress]);

  const navigationGuard = useMemo(
    () => timerInProgress
      ? () => window.confirm("Der laufende Countdown wird beendet. Wirklich verlassen?")
      : null,
    [timerInProgress],
  );
  useNavigationGuard(navigationGuard);

  function updateNumberDraft(key: NumericSettingKey, rawValue: string) {
    setNumberDrafts((current) => ({ ...current, [key]: rawValue }));
  }

  function commitNumberSetting(key: NumericSettingKey) {
    const nextValue = normalizeDraft(key, numberDrafts[key], settingsRef.current[key]);
    const nextSettings = { ...settingsRef.current, [key]: nextValue };
    settingsRef.current = nextSettings;
    setSettings(nextSettings);
    setNumberDrafts((current) => ({ ...current, [key]: String(nextValue) }));
  }

  function commitAllNumberSettings(): CountdownSettings {
    const current = settingsRef.current;
    const nextSettings: CountdownSettings = {
      ...current,
      workSeconds: normalizeDraft("workSeconds", numberDrafts.workSeconds, current.workSeconds),
      restSeconds: normalizeDraft("restSeconds", numberDrafts.restSeconds, current.restSeconds),
      exerciseCount: normalizeDraft("exerciseCount", numberDrafts.exerciseCount, current.exerciseCount),
      workAnnouncementInterval: normalizeDraft(
        "workAnnouncementInterval",
        numberDrafts.workAnnouncementInterval,
        current.workAnnouncementInterval,
      ),
      restAnnouncementInterval: normalizeDraft(
        "restAnnouncementInterval",
        numberDrafts.restAnnouncementInterval,
        current.restAnnouncementInterval,
      ),
    };
    settingsRef.current = nextSettings;
    setSettings(nextSettings);
    setNumberDrafts(settingsDrafts(nextSettings));
    return nextSettings;
  }

  function numberFieldHandlers(key: NumericSettingKey) {
    return {
      value: numberDrafts[key],
      onFocus: (event: FocusEvent<HTMLInputElement>) => event.currentTarget.select(),
      onChange: (event: ChangeEvent<HTMLInputElement>) => updateNumberDraft(key, event.target.value),
      onBlur: () => commitNumberSetting(key),
      onKeyDown: (event: KeyboardEvent<HTMLInputElement>) => {
        if (event.key === "Enter") event.currentTarget.blur();
      },
    };
  }

  function startCountdown() {
    const nextSettings = commitAllNumberSettings();
    settingsRef.current = nextSettings;
    window.speechSynthesis?.cancel();
    pausedRef.current = false;
    setPaused(false);
    setExercise(1);
    void requestWakeLock();
    beginPhase("work", 1);
  }

  function pauseCountdown() {
    if (!active || paused) return;
    const currentRemaining = Math.max(1, Math.ceil((endAtRef.current - Date.now()) / 1000));
    setRemaining(currentRemaining);
    pausedRef.current = true;
    setPaused(true);
    window.speechSynthesis?.cancel();
    void releaseWakeLock();
  }

  function resumeCountdown() {
    if (!paused || !active) return;
    endAtRef.current = Date.now() + remainingSecondsRef.current * 1000;
    pausedRef.current = false;
    setPaused(false);
    void requestWakeLock();
    speak(phaseRef.current === "work" ? "Belastung fortsetzen" : "Pause fortsetzen", true);
  }

  function resetCountdown(requireConfirmation = true) {
    if (
      requireConfirmation &&
      timerInProgress &&
      !window.confirm("Countdown beenden und auf die Einstellungen zurücksetzen?")
    ) return;
    window.speechSynthesis?.cancel();
    pausedRef.current = false;
    setPaused(false);
    transitionRunningRef.current = false;
    updatePhaseState("idle");
    setExercise(1);
    setRemaining(settingsRef.current.workSeconds);
    void releaseWakeLock();
  }

  const plannedDuration = plannedDurationSeconds(settings);

  return (
    <section className="countdown-page">
      <div className="page-heading countdown-heading">
        <div>
          <p className="eyebrow">Nützliches</p>
          <h1>Intervall-Countdown</h1>
          <p>Belastung und Pause mit automatischen Sprachansagen steuern.</p>
        </div>
      </div>

      <div className="countdown-layout">
        <section className={`countdown-display phase-${phase}`} aria-label="Countdown">
          <div className="countdown-phase-line" aria-live="polite">
            <span>{phaseLabel(phase)}</span>
            {active && <strong>Übung {currentExercise}/{settings.exerciseCount}</strong>}
          </div>

          <div className="countdown-clock" aria-label={`${remainingSeconds} Sekunden verbleibend`}>
            {formatClock(remainingSeconds)}
          </div>

          <div className="countdown-progress" aria-hidden="true">
            <span style={{ width: `${progress}%` }} />
          </div>

          <div className="countdown-status-row">
            <span>
              <TimerReset aria-hidden="true" />
              Gesamt {formatClock(plannedDuration)}
            </span>
            <span className={settings.voiceEnabled && voiceAvailable ? "active" : ""}>
              {settings.voiceEnabled && voiceAvailable
                ? <Volume2 aria-hidden="true" />
                : <VolumeX aria-hidden="true" />}
              {settings.voiceEnabled && voiceAvailable ? "Ansagen aktiv" : "Ohne Ansagen"}
            </span>
            {wakeLockActive && <span className="active">Bildschirm bleibt aktiv</span>}
          </div>

          <div className="countdown-actions">
            {phase === "idle" && (
              <button type="button" className="primary-button" onClick={startCountdown}>
                <CirclePlay aria-hidden="true" />
                Starten
              </button>
            )}

            {active && !paused && (
              <>
                <button type="button" className="primary-button" onClick={pauseCountdown}>
                  <Pause aria-hidden="true" />
                  Pausieren
                </button>
                <button type="button" className="secondary-button" onClick={() => resetCountdown()}>
                  <Square aria-hidden="true" />
                  Beenden
                </button>
              </>
            )}

            {active && paused && (
              <>
                <button type="button" className="primary-button" onClick={resumeCountdown}>
                  <Play aria-hidden="true" />
                  Fortsetzen
                </button>
                <button type="button" className="secondary-button" onClick={() => resetCountdown()}>
                  <Square aria-hidden="true" />
                  Beenden
                </button>
              </>
            )}

            {phase === "complete" && (
              <button type="button" className="primary-button" onClick={() => resetCountdown(false)}>
                <RotateCcw aria-hidden="true" />
                Neuer Countdown
              </button>
            )}
          </div>

          {phase === "complete" && (
            <div className="countdown-complete" role="status">
              <CircleCheck aria-hidden="true" />
              <strong>{settings.exerciseCount} Übungen abgeschlossen</strong>
            </div>
          )}
        </section>

        <section className="countdown-settings" aria-disabled={timerInProgress}>
          <header>
            <div>
              <h2>Einstellungen</h2>
              <p>Die letzten fünf Sekunden jeder Phase werden immer eingezählt.</p>
            </div>
          </header>

          <div className="countdown-setting-grid">
            <label>
              <span>Belastung</span>
              <div className="countdown-number-field">
                <input
                  type="number"
                  inputMode="numeric"
                  min="5"
                  max="3600"
                  {...numberFieldHandlers("workSeconds")}
                  disabled={timerInProgress}
                />
                <small>Sek.</small>
              </div>
            </label>
            <label>
              <span>Pause</span>
              <div className="countdown-number-field">
                <input
                  type="number"
                  inputMode="numeric"
                  min="1"
                  max="3600"
                  {...numberFieldHandlers("restSeconds")}
                  disabled={timerInProgress}
                />
                <small>Sek.</small>
              </div>
            </label>
            <label>
              <span>Übungen</span>
              <div className="countdown-number-field">
                <input
                  type="number"
                  inputMode="numeric"
                  min="1"
                  max="200"
                  {...numberFieldHandlers("exerciseCount")}
                  disabled={timerInProgress}
                />
                <small>Anzahl</small>
              </div>
            </label>
          </div>

          <div className="countdown-announcement-grid">
            <label>
              <span>Zwischenansage Belastung</span>
              <div className="countdown-number-field">
                <input
                  type="number"
                  inputMode="numeric"
                  min="0"
                  max="3600"
                  {...numberFieldHandlers("workAnnouncementInterval")}
                  disabled={timerInProgress}
                  aria-describedby="countdown-work-announcement-hint"
                />
                <small>Sek.</small>
              </div>
              <small id="countdown-work-announcement-hint" className="countdown-field-hint">0 = keine Zwischenansage</small>
            </label>
            <label>
              <span>Zwischenansage Pause</span>
              <div className="countdown-number-field">
                <input
                  type="number"
                  inputMode="numeric"
                  min="0"
                  max="3600"
                  {...numberFieldHandlers("restAnnouncementInterval")}
                  disabled={timerInProgress}
                  aria-describedby="countdown-rest-announcement-hint"
                />
                <small>Sek.</small>
              </div>
              <small id="countdown-rest-announcement-hint" className="countdown-field-hint">0 = keine Zwischenansage</small>
            </label>
          </div>

          <div className="countdown-options">
            <label className="ui-choice-row">
              <input
                type="checkbox"
                checked={settings.announceRemainingExercises}
                disabled={timerInProgress || !settings.voiceEnabled}
                onChange={(event: ChangeEvent<HTMLInputElement>) => setSettings((current) => ({
                  ...current,
                  announceRemainingExercises: event.target.checked,
                }))}
              />
              <span>Nach jeder Belastung verbleibende Übungen ansagen</span>
            </label>
            <label className="ui-choice-row">
              <input
                type="checkbox"
                checked={settings.voiceEnabled}
                disabled={timerInProgress || !voiceAvailable}
                onChange={(event: ChangeEvent<HTMLInputElement>) => setSettings((current) => ({
                  ...current,
                  voiceEnabled: event.target.checked,
                }))}
              />
              <span>Sprachausgabe verwenden</span>
            </label>
          </div>

          {!voiceAvailable && (
            <p className="countdown-note">Dieser Browser unterstützt keine Sprachausgabe. Der Countdown funktioniert trotzdem.</p>
          )}
        </section>
      </div>
    </section>
  );
}
