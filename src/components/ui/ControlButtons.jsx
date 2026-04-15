import { useEffect } from "react"; // 首先导入 useEffect

export default function ControlButtons({ keyPressed, onKeyChange, style }) {
  // 1. 新增：键盘事件处理逻辑
  useEffect(() => {
    // 按键按下时触发
    const handleKeyDown = (e) => {
      // 将按键转为小写（兼容大写 W/A/S/D）
      const key = e.key.toLowerCase();
      // 只处理 W/A/S/D 四个键
      if (["w", "a", "s", "d"].includes(key)) {
        onKeyChange(key, true); // 通知父组件：该键被按下
      }
    };

    // 按键松开时触发
    const handleKeyUp = (e) => {
      const key = e.key.toLowerCase();
      if (["w", "a", "s", "d"].includes(key)) {
        onKeyChange(key, false); // 通知父组件：该键被松开
      }
    };

    // 绑定全局键盘事件（监听整个窗口的按键）
    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);

    // 组件卸载时移除事件监听（避免内存泄漏）
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, [onKeyChange]); // 依赖项：确保 onKeyChange 变化时重新绑定事件

  // 2. 原有鼠标交互逻辑（保持不变）
  const handlePress = (key) => onKeyChange(key, true);
  const handleRelease = (key) => onKeyChange(key, false);

  return (
    <ul id="Control_f" style={style}>
      <li className="Control_s">
        <button
          className={`Direction_Control ${keyPressed.w ? "button-active" : ""}`}
          id="W_Control"
          onMouseDown={() => handlePress("w")}
          onMouseUp={() => handleRelease("w")}
          onMouseLeave={() => handleRelease("w")}
        >
          W
        </button>
      </li>
      <li className="Control_s">
        <button
          className={`Direction_Control ${keyPressed.a ? "button-active" : ""}`}
          id="A_Control"
          onMouseDown={() => handlePress("a")}
          onMouseUp={() => handleRelease("a")}
          onMouseLeave={() => handleRelease("a")}
        >
          A
        </button>
        <button
          className={`Direction_Control ${keyPressed.s ? "button-active" : ""}`}
          id="S_Control"
          onMouseDown={() => handlePress("s")}
          onMouseUp={() => handleRelease("s")}
          onMouseLeave={() => handleRelease("s")}
        >
          S
        </button>
        <button
          className={`Direction_Control ${keyPressed.d ? "button-active" : ""}`}
          id="D_Control"
          onMouseDown={() => handlePress("d")}
          onMouseUp={() => handleRelease("d")}
          onMouseLeave={() => handleRelease("d")}
        >
          D
        </button>
      </li>
    </ul>
  );
}
