// 游戏模式专用的 WASD 按钮（带四个图层 + 文字）

import { useEffect } from "react";

interface ControlButtonsGameProps {
  keyPressed: { w: boolean; a: boolean; s: boolean; d: boolean };
  onKeyChange: (key: string, pressed: boolean) => void;
  style?: React.CSSProperties;
}

export default function ControlButtonsGame({
  keyPressed,
  onKeyChange,
  style,
}: ControlButtonsGameProps) {
  // ==================== 键盘事件（和原来完全一致） ====================
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase();
      if (["w", "a", "s", "d"].includes(key)) {
        onKeyChange(key, true);
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase();
      if (["w", "a", "s", "d"].includes(key)) {
        onKeyChange(key, false);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, [onKeyChange]);

  const handlePress = (key: string) => onKeyChange(key, true);
  const handleRelease = (key: string) => onKeyChange(key, false);

  // ==================== 单键渲染函数（四个图层） ====================
  const renderKey = (
    letter: "w" | "a" | "s" | "d",
    extraStyle: React.CSSProperties = {},
  ) => {
    const isActive = keyPressed[letter];

    return (
      <div
        className={`game-key-wrapper ${isActive ? "active" : ""}`}
        onMouseDown={() => handlePress(letter)}
        onMouseUp={() => handleRelease(letter)}
        onMouseLeave={() => handleRelease(letter)}
        style={extraStyle}
      >
        {/* 图层1：最外层发光（neon glow） */}
        <div className="layer-glow" />

        {/* 图层2：边框层（深色 + 绿色 neon 描边） */}
        <div className="layer-border" />

        {/* 图层3：内阴影 / 凹陷效果 */}
        <div className="layer-inner-shadow" />

        {/* 图层4：主按键主体（最亮的高光面） */}
        <div className="layer-body">
          <span className="key-text">{letter.toUpperCase()}</span>
        </div>
      </div>
    );
  };

  return (
    <ul id="Control_f_game" style={style}>
      {/* W 键单独一行 */}
      <li className="Control_s_game w-row">{renderKey("w")}</li>

      {/* A S D 一行 */}
      <li className="Control_s_game asd-row">
        {renderKey("a", { marginRight: "12px" })}
        {renderKey("s", { marginRight: "12px" })}
        {renderKey("d")}
      </li>
    </ul>
  );
}
