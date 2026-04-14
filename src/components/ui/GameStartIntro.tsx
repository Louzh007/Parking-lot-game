import type { CSSProperties } from "react";
import { useEffect, useLayoutEffect, useRef, useState } from "react";

const SLIDE_MS = 240; // 稍微拉长一点，更舒适自然
const HOLD_MS = 1000; // 稍缩短一点，避免太拖
const MASK_FADE_MS = 240; // 蒙版退场淡出
const STAGGER_MS = 30; // 右图比左图晚一点出现，增加节奏感

const IMG_LEFT = encodeURI("./image/Start animation - Left.png");
const IMG_RIGHT = encodeURI("./image/Start animation - Right.png");

const root: CSSProperties = {
  position: "fixed",
  inset: 0,
  zIndex: 8000,
  pointerEvents: "auto",
};

const maskBase: CSSProperties = {
  position: "absolute",
  inset: 0,
  background: "rgba(20, 11, 5, 0.85)",
};

const stage: CSSProperties = {
  position: "absolute",
  inset: 0,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  overflow: "hidden",
  pointerEvents: "none",
};

const artBase: CSSProperties = {
  position: "absolute",
  left: "50%",
  top: "50%",
  width: "100vw",
  height: "100vh",
  objectFit: "cover",
  objectPosition: "center center",
  pointerEvents: "none",
  userSelect: "none",
  willChange: "transform, opacity", // 性能优化
  transition: `transform ${SLIDE_MS}ms cubic-bezier(0.25, 0.46, 0.45, 0.94), 
               scale ${SLIDE_MS}ms cubic-bezier(0.25, 0.46, 0.45, 0.94),
               opacity ${SLIDE_MS}ms cubic-bezier(0.25, 0.46, 0.45, 0.94)`,
};

type Props = {
  active: boolean;
  onComplete: () => void;
};

export function GameStartIntro({ active, onComplete }: Props) {
  const [atCenter, setAtCenter] = useState(false);
  const [maskOpacity, setMaskOpacity] = useState(0);
  const [maskTransition, setMaskTransition] = useState("none");
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;

  // 入场：绘制前立刻不透明且无 transition，避免闪屏；下一帧再挂上淡出用的 transition
  useLayoutEffect(() => {
    if (!active) return;

    setMaskTransition("none");
    setMaskOpacity(1);
    const id = requestAnimationFrame(() => {
      setMaskTransition(`opacity ${MASK_FADE_MS}ms ease`);
    });
    return () => cancelAnimationFrame(id);
  }, [active]);

  useEffect(() => {
    if (!active) {
      setAtCenter(false);
      setMaskOpacity(0);
      setMaskTransition("none");
      return;
    }

    setAtCenter(false);

    let raf1 = 0;
    const timers: number[] = [];

    const raf0 = requestAnimationFrame(() => {
      raf1 = requestAnimationFrame(() => {
        setAtCenter(true);

        timers.push(
          window.setTimeout(() => {
            setAtCenter(false);
          }, SLIDE_MS + HOLD_MS),
        );

        timers.push(
          window.setTimeout(
            () => {
              setMaskOpacity(0);
            },
            SLIDE_MS + HOLD_MS + SLIDE_MS,
          ),
        );

        timers.push(
          window.setTimeout(
            () => {
              onCompleteRef.current();
            },
            SLIDE_MS + HOLD_MS + MASK_FADE_MS,
          ),
        );
      });
    });

    return () => {
      cancelAnimationFrame(raf0);
      cancelAnimationFrame(raf1);
      timers.forEach((t) => window.clearTimeout(t));
    };
  }, [active]);

  if (!active) return null;

  const maskStyle: CSSProperties = {
    ...maskBase,
    opacity: maskOpacity,
    transition: maskTransition,
  };

  const leftArt: CSSProperties = {
    ...artBase,
    transform: `translate(-50%, -50%) translateX(${atCenter ? "0vw" : "-110vw"}) translateY(${atCenter ? "0vh" : "30vh"}) scale(${atCenter ? "1" : "0.9"})`,
    opacity: atCenter ? 1 : 0,
  };

  const rightArt: CSSProperties = {
    ...artBase,
    transform: `translate(-50%, -50%) translateX(${atCenter ? "0vw" : "110vw"}) translateY(${atCenter ? "0vh" : "-30vh"}) scale(${atCenter ? "1" : "0.9"})`,
    opacity: atCenter ? 1 : 0,
    // 右图 stagger（更自然有节奏）
    transitionDelay: `${STAGGER_MS}ms`,
  };

  return (
    <div style={root} aria-hidden>
      <div style={maskStyle} />
      <div style={stage}>
        <img src={IMG_LEFT} alt="" draggable={false} style={leftArt} />
        <img src={IMG_RIGHT} alt="" draggable={false} style={rightArt} />
      </div>
    </div>
  );
}
