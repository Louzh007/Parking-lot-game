import { useEffect, useMemo, useRef, useState } from "react";

type MusicTrack =
  | "showroomIdle"
  | "showroomDriveBeauty"
  | "showroomDriveF1"
  | "showroomDriveAE86"
  | "gameDrive";

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
}

const TRACKS: Record<MusicTrack, string> = {
  showroomIdle: "/BGM/dipingxian6.mp3",
  showroomDriveBeauty: "/BGM/beauty%20and%20a%20beat.mp3",
  showroomDriveF1: "/BGM/F1.mp3",
  showroomDriveAE86: "/BGM/AE86.mp3",
  gameDrive: "/BGM/huantaipingyang.mp3",
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

const pickRandomShowroomDriveTrack = () => {
  const index = Math.floor(Math.random() * SHOWROOM_DRIVE_TRACKS.length);
  return SHOWROOM_DRIVE_TRACKS[index];
};

const isShowroomDriveTrack = (
  track: MusicTrack | null,
): track is (typeof SHOWROOM_DRIVE_TRACKS)[number] => {
  return Boolean(
    track && SHOWROOM_DRIVE_TRACKS.includes(track as MusicTrack),
  );
};

export function useMusicController({
  isGameMode,
  keyPressed,
  wheelSpeed,
  gameResult,
  isLoading,
  gameSessionKey,
  isMuted,
}: UseMusicControllerOptions) {
  const audioByTrackRef = useRef<Partial<Record<MusicTrack, HTMLAudioElement>>>(
    {},
  );
  const currentTrackRef = useRef<MusicTrack | null>(null);
  const showroomDriveTrackRef = useRef<MusicTrack | null>(null);
  const gameDriveStartedRef = useRef(false);
  const lastGameSessionKeyRef = useRef(gameSessionKey);
  const fadeFrameRef = useRef<number | null>(null);
  const showroomStopTimerRef = useRef<number | null>(null);
  const showroomStoppedAtRef = useRef<number | null>(null);
  const [targetTrack, setTargetTrack] = useState<MusicTrack | null>(null);
  const [audioUnlockNonce, setAudioUnlockNonce] = useState(0);

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

        showroomDriveTrackRef.current = pickRandomShowroomDriveTrack();
      }

      showroomStoppedAtRef.current = null;

      if (!showroomDriveTrackRef.current) {
        showroomDriveTrackRef.current = pickRandomShowroomDriveTrack();
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
  }, [gameResult, gameSessionKey, isCarActive, isGameMode, isLoading]);

  useEffect(() => {
    const audioByTrack = audioByTrackRef.current;

    Object.entries(TRACKS).forEach(([track, src]) => {
      const audio = new Audio(src);
      audio.loop = true;
      audio.preload = "auto";
      audio.volume = 0;
      audioByTrack[track as MusicTrack] = audio;
    });

    return () => {
      if (fadeFrameRef.current) {
        window.cancelAnimationFrame(fadeFrameRef.current);
      }

      Object.values(audioByTrack).forEach((audio) => {
        audio.pause();
        audio.src = "";
      });
    };
  }, []);

  useEffect(() => {
    Object.values(audioByTrackRef.current).forEach((audio) => {
      audio.muted = isMuted;
    });
  }, [isMuted]);

  useEffect(() => {
    const retryAfterUserGesture = () => {
      setAudioUnlockNonce((nonce) => nonce + 1);
    };
    const listenerOptions = { once: true };

    window.addEventListener("pointerdown", retryAfterUserGesture, listenerOptions);
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
