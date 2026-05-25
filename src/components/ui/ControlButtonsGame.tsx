// 游戏模式专用的 WASD 按钮（带四个图层 + 文字）

import { useEffect } from "react";

interface ControlButtonsGameProps {
  keyPressed: {
    w: boolean;
    a: boolean;
    s: boolean;
    d: boolean;
    space: boolean;
  };
  onKeyChange: (key: string, pressed: boolean) => void;
  enableSpaceJump?: boolean;
  style?: React.CSSProperties;
}

export default function ControlButtonsGame({
  keyPressed,
  onKeyChange,
  enableSpaceJump = false,
  style,
}: ControlButtonsGameProps) {
  // ==================== 键盘事件（和原来完全一致） ====================
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase();
      const targetKey = key === " " ? "space" : key;
      if (["w", "a", "s", "d"].includes(targetKey)) {
        onKeyChange(targetKey, true);
      }
      if (enableSpaceJump && targetKey === "space") {
        onKeyChange("space", true);
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase();
      const targetKey = key === " " ? "space" : key;
      if (["w", "a", "s", "d"].includes(targetKey)) {
        onKeyChange(targetKey, false);
      }
      if (enableSpaceJump && targetKey === "space") {
        onKeyChange("space", false);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, [onKeyChange, enableSpaceJump]);

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
      <li className="Control_s_game controls-row">
        {/* WASD 区域：保证 W 永远在 S 正上方 */}
        <div className="wasd-stack">
          <div className="wasd-row w-row">{renderKey("w")}</div>
          <div className="wasd-row asd-row">
            {renderKey("a")}
            {renderKey("s")}
            {renderKey("d")}
          </div>
        </div>

        {/* SPACE 区域：与 WASD 分组，避免把 W 中心拉偏 */}
        {enableSpaceJump && (
          <div
            className={`game-key-wrapper ${keyPressed.space ? "active" : ""}`}
            onMouseDown={() => handlePress("space")}
            onMouseUp={() => handleRelease("space")}
            onMouseLeave={() => handleRelease("space")}
            style={{ marginLeft: "12px", minWidth: 120, width: 120 }}
          >
            <div className="layer-glow" />
            <div className="layer-border" />
            <div className="layer-inner-shadow" />
            <div className="layer-body">
              <span className="key-text">SPACE</span>
            </div>
          </div>
        )}
      </li>
    </ul>
  );
}
