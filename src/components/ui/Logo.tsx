import type { CSSProperties } from "react";

interface LogoProps {
  style?: CSSProperties;
  /** 游戏停车场模式：左上角文案改为「炼狱停车场」 */
  isGameMode?: boolean;
}

const HELL_PARKING_GRADIENT =
  "linear-gradient(90deg, #F59D3C 0%, #FFD5A8 25%, #F59D3C 51.44%, #EE4034 71.15%, #F59D3C 100%)";

export default function Logo({ style, isGameMode = false }: LogoProps) {
  return (
    <div
      style={{
        position: "fixed",
        left: 36,
        top: 26,
        zIndex: 999,
        display: "flex",
        alignItems: "center",
        gap: 24,
        pointerEvents: "none",
        ...style,
      }}
    >
      <img
        src={
          isGameMode
            ? "./image/diyutingchechanglogo.png"
            : "./image/xiaomi 1.png"
        }
        alt={isGameMode ? "炼狱停车场 logo" : "小米汽车 logo"}
        style={{
          width: 40,
          height: 40,
          objectFit: "contain",
          display: "block",
          flexShrink: 0,
        }}
      />
      <span
        style={{
          fontSize: 24,
          fontWeight: 800,
          lineHeight: 1,
          letterSpacing: "0.04em",
          whiteSpace: "nowrap",
          ...(isGameMode
            ? {
                display: "inline-block",
                backgroundImage: HELL_PARKING_GRADIENT,
                WebkitBackgroundClip: "text",
                backgroundClip: "text",
                WebkitTextFillColor: "transparent",
                color: "transparent",
                // 渐变字 + clip 时 text-shadow 常无效，用 drop-shadow 沿字形投影
                filter: "drop-shadow(0 1px 1px rgba(0, 0, 0, 0.35))",
              }
            : {
                color: "#ffffff",
                textShadow: "0 1px 2px rgba(0,0,0,0.15)",
              }),
        }}
      >
        {isGameMode ? "炼狱停车场" : "小米汽车"}
      </span>
    </div>
  );
}
