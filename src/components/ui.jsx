import { useState } from "react";
// import { FaShuffle } from "react-icons/fa6";
import { CAMERAS, COLORS, useApp } from "./state";

export function UI({ showCameraControls = true }) {
  const colorIndex = useApp((state) => state.colorIndex);
  const currentCamera = useApp((state) => state.currentCamera);

  const [interfaceVisible, setInterfaceVisible] = useState(true);
  // 从全局状态获取提示框信息
  const { tip } = useApp();

  // 根据提示类型返回对应的文本
  const getTipText = (type) => {
    switch (type) {
      case "doorOpen":
        return "打开车门";
      case "doorClose":
        return "关闭车门";
      case "weiyiOpen":
        return "打开尾翼";
      case "weiyiClose":
        return "关闭尾翼";
      default:
        return "";
    }
  };

  return (
    <>
      {showCameraControls && (
        <div
          style={{
            position: "absolute",
            top: 0,
            left: "50%",
            transform: "translateX(-50%)",
            width: "100%",
            zIndex: 1000,
            padding: "1rem 2rem",
            boxSizing: "border-box",
            maxWidth: "700px",
            pointerEvents: "none",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            opacity: interfaceVisible ? 1 : 0,
            transition: "opacity 0.3s ease-in-out",
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "center",
              gap: "0.6rem",
              marginTop: "1rem",
            }}
          >
            {CAMERAS.map((text, i) => {
              const isActive = currentCamera === i;
              return (
              <button
                key={i}
                style={{
                  padding: "0.5rem 0.5rem",
                  minWidth: "4.5rem",
                  cursor: "pointer",
                  pointerEvents: "all",
                  borderRadius: "10px",
                  border: isActive ? "3px solid #FFF" : "3px solid transparent",
                  background: isActive
                    ? "linear-gradient(180deg, #E8E8E8 0%, #FEFEFE 100%)"
                    : "#555",
                  color: isActive ? "#000" : "#fff",
                  boxShadow: isActive
                    ? "0 2.698px 2.923px -1.349px rgba(0, 0, 0, 0.25)"
                    : "none",
                  transition:
                    "background 0.3s, color 0.3s, box-shadow 0.3s, border-color 0.3s",
                }}
                onClick={() =>
                  useApp.setState((state) => ({
                    currentCamera: i,
                  }))
                }
              >
                {text}
              </button>
            );
            })}
          </div>
        </div>
      )}

      {/* 鼠标悬停车门车尾翼提示框 */}
      <div>
        {/* 提示框：根据全局状态动态渲染 */}
        <div
          className="door-tip"
          style={{
            display: tip.visible ? "block" : "none",
            left: `${tip.position.x}px`,
            top: `${tip.position.y}px`,
          }}
        >
          {getTipText(tip.type)}
        </div>
      </div>

      <footer
        style={{
          position: "absolute",
          bottom: "3.2rem",
          left: "50%",
          transform: "translateX(-50%)",
          width: "100%",
          display: "flex",
          flexDirection: "row",
          maxWidth: "700px",
          alignItems: "center",
          justifyContent: "center",
          gap: "2rem", // 元素间距
          padding: "1rem 1rem",
          boxSizing: "border-box",
          color: "#fff",
          zIndex: 1000,
          pointerEvents: "none",
        }}
      >
        <h3
          style={{
            fontFamily: '"Bricolage Grotesque", sans-serif',
            color: "#fff",
            fontWeight: "800",
            textAlign: "right",
            margin: 4,
            // marginRight: "2rem",
            opacity: interfaceVisible ? 1 : 0,
            transition: "opacity 0.3s ease-in-out",
          }}
        >
          车漆选择
        </h3>
        <div
          style={{
            // width: "100%",
            display: "flex",
            alignItems: "center",
            justifyContent: "flex-start",
            gap: "0.8rem",
            opacity: interfaceVisible ? 1 : 0,
            transition: "opacity 0.3s ease-in-out",
          }}
        >
          {/* 数组的 map 方法回调函数的参数格式是 (element, index, array)，即：
           第一个参数：当前遍历的元素（这里是 color 对象）
           第二个参数：当前元素的索引（index）
           第三个参数：原数组本身 */}
          {COLORS.map(
            (
              color,
              i,
              // 遍历 COLORS 数组，每个元素生成一个 span
            ) => (
              <span
                key={i}
                style={{
                  display: "inline-block",
                  width: "1.2rem",
                  aspectRatio: "1 / 1", // 设置宽高比为1:1
                  // backgroundColor: color.color,
                  background: `url(${color.url}) center/cover`, // 图片加载失败时显示原颜色
                  // backgroundImage: `url(${color.url})`,
                  borderRadius: "50%",
                  marginRight: "0.6rem",
                  outline:
                    colorIndex === i
                      ? "3px solid #ffffff"
                      : "0px solid #ffffff5b",
                  // outlineWidth: colorIndex === i ? "4px" : "1px",
                  cursor: "pointer",
                  pointerEvents: "all",
                }}
                onClick={() => useApp.setState({ colorIndex: i })}
              />
            ),
          )}

          {/* 下面是随机颜色的按钮 */}
          {/* <span
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              width: "1.5rem",
              aspectRatio: "1 / 1",
              backgroundColor: "#555",
              borderRadius: "50%",
              marginRight: "0.5rem",
              outline: "2px solid #fff",
              outlineWidth: colorIndex === -1 ? "5px" : "1px",
              cursor: "pointer", // 允许点击
              pointerEvents: "all", 
            }}
            onClick={() => useApp.setState({ colorIndex: -1 })}
          >
            <FaShuffle
              size="0.8rem"
              style={{
                color: "#ffffffff",
                pointerEvents: "none",
              }}
            />
          </span> */}
        </div>
      </footer>
    </>
  );
}
