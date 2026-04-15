function ModelSelector(props) {
  // 定义点击处理函数
  function handleClick(event) {
    // 获取点击元素的 data-model 属性
    const clickedModel = event.currentTarget.getAttribute("data-model");

    // 调用父组件传入的 setCurrentModel 函数
    if (props.setCurrentModel) {
      props.setCurrentModel(clickedModel);
    }
  }

  // 用if判断设置激活状态的样式， react 会根据 props.currentModel 的值改变，自动刷新
  let firstClass = "modelselect_s";
  if (props.currentModel === "xiaomi su7-action3") {
    firstClass = "modelselect_s active";
  }

  let secondClass = "modelselect_s";
  if (props.currentModel === "su7U2") {
    secondClass = "modelselect_s active";
  }

  return (
    <>
      {/* <style>{styles}</style> */}
      <ul className="modelselect_f" style={props.style}>
        {/* 第一个模型选项 */}
        <li
          className={firstClass}
          data-model="xiaomi su7-action3"
          onClick={handleClick}
        >
          <div className="modelselect_su7"></div>
        </li>

        {/* 第二个模型选项 */}
        <li className={secondClass} data-model="su7U2" onClick={handleClick}>
          <div className="modelselect_su7U"></div>
        </li>
      </ul>
    </>
  );
}

export default ModelSelector;
