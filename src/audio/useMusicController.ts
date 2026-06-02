import { useCallback, useEffect, useMemo, useRef, useState } from "react";

type MusicTrack =
  | "showroomIdle"
  | "showroomDriveBeauty"
  | "showroomDriveF1"
  | "showroomDriveAE86"
  | "gameDrive";

type SoundEffect = "begin" | "crash" | "failure" | "success";

interface KeyPressedState {
  w: boolean;
  s: boolean;
}

interface UseMusicControllerOptions {
  isGameMode: boolean;
  keyPressed: KeyPressedState;
  wheelSpeed: number;
  gameResult: "win" | "lose" | null;
  isLoading: boolean;
  gameSessionKey: number;
  isMuted: boolean;
  collisionCount: number;
  gameIntroActive: boolean;
  gameBgmSrc?: string;
}

const TRACKS: Record<MusicTrack, string> = {
  showroomIdle: "/BGM/dipingxian6.mp3",
  showroomDriveBeauty: "/BGM/beauty%20and%20a%20beat.mp3",
  showroomDriveF1: "/BGM/F1.mp3",
  showroomDriveAE86: "/BGM/AE86.mp3",
  gameDrive: "/BGM/TokyoDrift.mp3",
};

const ENGINE_TRACK = "/BGM/engine.mp3";
const DEFAULT_GAME_BGM = TRACKS.gameDrive;

const SOUND_EFFECTS: Record<SoundEffect, string> = {
  begin: "/BGM/Begin.mp3",
  crash: "/BGM/Crash.mp3",
  failure: "/BGM/Failure.mp3",
  success: "/BGM/Success.mp3",
};

const SHOWROOM_DRIVE_TRACKS: MusicTrack[] = [
  "showroomDriveBeauty",
  "showroomDriveF1",
  "showroomDriveAE86",
];

const MASTER_VOLUME = 0.55;
const FADE_DURATION_MS = 1200;
const STOPPED_SPEED_THRESHOLD = 0.015;
const SHOWROOM_STOP_GRACE_MS = 3000;
const SHOWROOM_TRACK_REUSE_MS = 15000;
const ENGINE_MAX_VOLUME = 0.5;
const ENGINE_LOW_VOLUME = 0.02;
const ENGINE_SPEED_VOLUME_THRESHOLD = 0.1;
const SFX_VOLUME = 0.75;
const CRASH_SFX_COOLDOWN_MS = 250;
const LAST_SHOWROOM_DRIVE_TRACK_KEY = "parkingGame:lastShowroomDriveTrack";

const pickRandomShowroomDriveTrack = (previousTrack: MusicTrack | null) => {
  const candidates = SHOWROOM_DRIVE_TRACKS.filter(
    (track) => track !== previousTrack,
  );
  const trackPool = candidates.length > 0 ? candidates : SHOWROOM_DRIVE_TRACKS;
  const index = Math.floor(Math.random() * trackPool.length);
  return trackPool[index];
};

const isShowroomDriveTrack = (
  track: MusicTrack | null,
): track is (typeof SHOWROOM_DRIVE_TRACKS)[number] => {
  return Boolean(track && SHOWROOM_DRIVE_TRACKS.includes(track as MusicTrack));
};

export function useMusicController({
  isGameMode,
  keyPressed,
  wheelSpeed,
  gameResult,
  isLoading,
  gameSessionKey,
  isMuted,
  collisionCount,
  gameIntroActive,
  gameBgmSrc = DEFAULT_GAME_BGM,
}: UseMusicControllerOptions) {
  const audioByTrackRef = useRef<Partial<Record<MusicTrack, HTMLAudioElement>>>(
    {},
  );
  const sfxByNameRef = useRef<Partial<Record<SoundEffect, HTMLAudioElement>>>(
    {},
  );
  const engineAudioRef = useRef<HTMLAudioElement | null>(null);
  const currentTrackRef = useRef<MusicTrack | null>(null);
  const showroomDriveTrackRef = useRef<MusicTrack | null>(null);
  const gameDriveStartedRef = useRef(false);
  const lastGameSessionKeyRef = useRef(gameSessionKey);
  const fadeFrameRef = useRef<number | null>(null);
  const showroomStopTimerRef = useRef<number | null>(null);
  const showroomStoppedAtRef = useRef<number | null>(null);
  const wasGameIntroActiveRef = useRef(false);
  const previousGameResultRef = useRef<"win" | "lose" | null>(null);
  const previousCollisionCountRef = useRef(collisionCount);
  const lastCrashSfxAtRef = useRef(0);
  const [targetTrack, setTargetTrack] = useState<MusicTrack | null>(null);
  const [audioUnlockNonce, setAudioUnlockNonce] = useState(0);
  const normalizedGameBgmSrc = gameBgmSrc || DEFAULT_GAME_BGM;

  const readLastShowroomDriveTrack = useCallback(() => {
    const storedTrack = window.localStorage.getItem(
      LAST_SHOWROOM_DRIVE_TRACK_KEY,
    );

    if (isShowroomDriveTrack(storedTrack as MusicTrack | null)) {
      return storedTrack as MusicTrack;
    }

    return null;
  }, []);

  const pickNextShowroomDriveTrack = useCallback(() => {
    const previousTrack =
      showroomDriveTrackRef.current ?? readLastShowroomDriveTrack();
    const nextTrack = pickRandomShowroomDriveTrack(previousTrack);
    window.localStorage.setItem(LAST_SHOWROOM_DRIVE_TRACK_KEY, nextTrack);
    return nextTrack;
  }, [readLastShowroomDriveTrack]);

  const isCarActive = useMemo(() => {
    return (
      keyPressed.w ||
      keyPressed.s ||
      Math.abs(wheelSpeed) > STOPPED_SPEED_THRESHOLD
    );
  }, [keyPressed.s, keyPressed.w, wheelSpeed]);

  useEffect(() => {
    const clearShowroomStopTimer = () => {
      if (showroomStopTimerRef.current) {
        window.clearTimeout(showroomStopTimerRef.current);
        showroomStopTimerRef.current = null;
      }
    };

    if (isLoading) {
      clearShowroomStopTimer();
      setTargetTrack(null);
      return;
    }

    if (lastGameSessionKeyRef.current !== gameSessionKey) {
      lastGameSessionKeyRef.current = gameSessionKey;
      gameDriveStartedRef.current = false;
    }

    if (isGameMode) {
      clearShowroomStopTimer();
      showroomStoppedAtRef.current = null;

      if (gameResult) {
        gameDriveStartedRef.current = false;
        setTargetTrack(null);
        return;
      }

      if (isCarActive) {
        gameDriveStartedRef.current = true;
      }

      setTargetTrack(gameDriveStartedRef.current ? "gameDrive" : null);
      return;
    }

    gameDriveStartedRef.current = false;

    if (isCarActive) {
      clearShowroomStopTimer();

      const now = performance.now();
      const stoppedAt = showroomStoppedAtRef.current;
      const shouldReuseTrack =
        Boolean(showroomDriveTrackRef.current) &&
        stoppedAt !== null &&
        now - stoppedAt <= SHOWROOM_TRACK_REUSE_MS;

      if (!shouldReuseTrack) {
        if (showroomDriveTrackRef.current) {
          const previousAudio =
            audioByTrackRef.current[showroomDriveTrackRef.current];
          if (previousAudio) {
            previousAudio.currentTime = 0;
          }
        }

        showroomDriveTrackRef.current = pickNextShowroomDriveTrack();
      }

      showroomStoppedAtRef.current = null;

      if (!showroomDriveTrackRef.current) {
        showroomDriveTrackRef.current = pickNextShowroomDriveTrack();
      }

      setTargetTrack(showroomDriveTrackRef.current);
      return;
    }

    if (!showroomStoppedAtRef.current) {
      showroomStoppedAtRef.current = performance.now();
    }

    if (!showroomStopTimerRef.current) {
      showroomStopTimerRef.current = window.setTimeout(() => {
        showroomStopTimerRef.current = null;
        setTargetTrack("showroomIdle");
      }, SHOWROOM_STOP_GRACE_MS);
    }

    if (!showroomDriveTrackRef.current) {
      setTargetTrack("showroomIdle");
    }

    return clearShowroomStopTimer;
  }, [
    gameResult,
    gameSessionKey,
    isCarActive,
    isGameMode,
    isLoading,
    pickNextShowroomDriveTrack,
  ]);

  const playSoundEffect = useCallback(
    (effect: SoundEffect) => {
      const audio = sfxByNameRef.current[effect];
      if (!audio) return;

      audio.pause();
      audio.currentTime = 0;
      audio.volume = SFX_VOLUME;
      audio.muted = isMuted;
      void audio.play().catch(() => undefined);
    },
    [isMuted],
  );

  useEffect(() => {
    const audioByTrack = audioByTrackRef.current;
    const sfxByName = sfxByNameRef.current;

    Object.entries(TRACKS).forEach(([track, src]) => {
      const audio = new Audio(src);
      audio.loop = true;
      audio.preload = "auto";
      audio.volume = 0;
      audioByTrack[track as MusicTrack] = audio;
    });

    Object.entries(SOUND_EFFECTS).forEach(([effect, src]) => {
      const audio = new Audio(src);
      audio.loop = false;
      audio.preload = "auto";
      audio.volume = SFX_VOLUME;
      sfxByName[effect as SoundEffect] = audio;
    });

    const engineAudio = new Audio(ENGINE_TRACK);
    engineAudio.loop = true;
    engineAudio.preload = "auto";
    engineAudio.volume = 0;
    engineAudioRef.current = engineAudio;

    return () => {
      if (fadeFrameRef.current) {
        window.cancelAnimationFrame(fadeFrameRef.current);
      }

      Object.values(audioByTrack).forEach((audio) => {
        audio.pause();
        audio.src = "";
      });

      Object.values(sfxByName).forEach((audio) => {
        audio.pause();
        audio.src = "";
      });

      engineAudio.pause();
      engineAudio.src = "";
      engineAudioRef.current = null;
    };
  }, []);

  useEffect(() => {
    Object.values(audioByTrackRef.current).forEach((audio) => {
      audio.muted = isMuted;
    });

    Object.values(sfxByNameRef.current).forEach((audio) => {
      audio.muted = isMuted;
    });

    if (engineAudioRef.current) {
      engineAudioRef.current.muted = isMuted;
    }
  }, [isMuted]);

  useEffect(() => {
    const gameAudio = audioByTrackRef.current.gameDrive;
    if (!gameAudio) return;

    const nextSrc = new URL(normalizedGameBgmSrc, window.location.href).href;
    if (gameAudio.src === nextSrc) return;

    if (currentTrackRef.current === "gameDrive") {
      gameAudio.pause();
      gameAudio.volume = 0;
      currentTrackRef.current = null;
      setTargetTrack(null);
    }

    gameAudio.src = normalizedGameBgmSrc;
    gameAudio.currentTime = 0;
    gameAudio.load();
  }, [normalizedGameBgmSrc]);

  useEffect(() => {
    if (isGameMode && gameIntroActive && !wasGameIntroActiveRef.current) {
      playSoundEffect("begin");
    }

    wasGameIntroActiveRef.current = gameIntroActive;
  }, [gameIntroActive, isGameMode, playSoundEffect]);

  useEffect(() => {
    if (
      isGameMode &&
      gameResult &&
      gameResult !== previousGameResultRef.current
    ) {
      playSoundEffect(gameResult === "win" ? "success" : "failure");
    }

    previousGameResultRef.current = gameResult;
  }, [gameResult, isGameMode, playSoundEffect]);

  useEffect(() => {
    if (collisionCount > previousCollisionCountRef.current && isGameMode) {
      const now = performance.now();
      if (now - lastCrashSfxAtRef.current >= CRASH_SFX_COOLDOWN_MS) {
        lastCrashSfxAtRef.current = now;
        playSoundEffect("crash");
      }
    }

    previousCollisionCountRef.current = collisionCount;
  }, [collisionCount, isGameMode, playSoundEffect]);

  useEffect(() => {
    const engineAudio = engineAudioRef.current;
    if (!engineAudio) return;

    if (isGameMode || isLoading || !isCarActive || keyPressed.s) {
      engineAudio.pause();
      engineAudio.currentTime = 0;
      engineAudio.volume = 0;
      return;
    }

    const isAccelerating = keyPressed.w;
    const speedFactor = Math.min(
      Math.abs(wheelSpeed) / ENGINE_SPEED_VOLUME_THRESHOLD,
      1,
    );
    const targetVolume =
      isAccelerating || speedFactor >= 1
        ? ENGINE_MAX_VOLUME
        : ENGINE_LOW_VOLUME +
          (ENGINE_MAX_VOLUME - ENGINE_LOW_VOLUME) * speedFactor;

    engineAudio.volume = targetVolume;
    void engineAudio.play().catch(() => undefined);
  }, [
    isCarActive,
    isGameMode,
    isLoading,
    keyPressed.s,
    keyPressed.w,
    wheelSpeed,
  ]);

  useEffect(() => {
    const retryAfterUserGesture = () => {
      setAudioUnlockNonce((nonce) => nonce + 1);
    };
    const listenerOptions = { once: true };

    window.addEventListener(
      "pointerdown",
      retryAfterUserGesture,
      listenerOptions,
    );
    window.addEventListener("keydown", retryAfterUserGesture, listenerOptions);

    return () => {
      window.removeEventListener("pointerdown", retryAfterUserGesture);
      window.removeEventListener("keydown", retryAfterUserGesture);
    };
  }, []);

  useEffect(() => {
    if (targetTrack === currentTrackRef.current) return;

    if (fadeFrameRef.current) {
      window.cancelAnimationFrame(fadeFrameRef.current);
    }

    const previousTrack = currentTrackRef.current;
    const previousAudio = previousTrack
      ? audioByTrackRef.current[previousTrack]
      : null;
    const nextAudio = targetTrack ? audioByTrackRef.current[targetTrack] : null;
    const startedAt = performance.now();
    const previousStartVolume = previousAudio?.volume ?? 0;

    currentTrackRef.current = targetTrack;

    if (nextAudio) {
      if (!isShowroomDriveTrack(targetTrack) || nextAudio.currentTime <= 0) {
        nextAudio.currentTime = 0;
      }
      nextAudio.volume = 0;
      void nextAudio.play().catch(() => {
        currentTrackRef.current = previousTrack;
      });
    }

    const fade = (now: number) => {
      const progress = Math.min(
        Math.max((now - startedAt) / FADE_DURATION_MS, 0),
        1,
      );

      if (previousAudio) {
        previousAudio.volume = previousStartVolume * (1 - progress);
      }

      if (nextAudio) {
        nextAudio.volume = MASTER_VOLUME * progress;
      }

      if (progress < 1) {
        fadeFrameRef.current = window.requestAnimationFrame(fade);
        return;
      }

      if (previousAudio) {
        previousAudio.pause();
        if (
          !(
            isShowroomDriveTrack(previousTrack) &&
            targetTrack === "showroomIdle"
          )
        ) {
          previousAudio.currentTime = 0;
        }
        previousAudio.volume = 0;
      }

      if (nextAudio) {
        nextAudio.volume = MASTER_VOLUME;
      }

      fadeFrameRef.current = null;
    };

    fadeFrameRef.current = window.requestAnimationFrame(fade);
  }, [audioUnlockNonce, targetTrack]);
}
