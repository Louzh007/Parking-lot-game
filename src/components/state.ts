import { create } from "zustand";
import { Vector3 } from "three";

export const COLORS = [
  {
    color: "#004225",
    flake: "#199861",
    perl: "#01632a",
    url: "./image/carbodycolor_orange.png",
  },

  {
    color: "#202020",
    flake: "#6b6b6b",
    perl: "#4c4c4c",
    url: "./image/carbodycolor_black_u.png",
  },
  {
    color: "#86004E",
    flake: "#FF6BD7",
    perl: "#86004E",
    url: "./image/carbodycolor_red.png",
  },
  {
    color: "#6C0086",
    flake: "#edcfff",
    perl: "#6C0086",
    url: "./image/carbodycolor_purple.png",
  },
  {
    color: "#ffffff",
    flake: "#eeffff",
    perl: "#eeffff",
    url: "./image/carbodycolor_white.png",
  },
  {
    color: "#116767",
    flake: "#29BDBD",
    perl: "#013455",
    url: "./image/carbodycolor_green_u.png",
  },
  {
    color: "#FFD323",
    flake: "#FFBE46",
    perl: "#F7B714",
    url: "./image/carbodycolor_yellow_u.png",
  },
  {
    color: "#0298A6",
    flake: "#39D4F7",
    perl: "#00B9C9",
    url: "./image/carbodycolor_canyon.png",
  },
];

// export const CAMERAS = ["Side", "Closeup", "Front", "Top", "Rear "];

// 在state.ts中添加相机位置配置
export const CAMERA_VIEWS = [
  { name: "Side", offset: new Vector3(0, 0.8, 4) }, // 侧视图
  { name: "Closeup", offset: new Vector3(-1.5, 1, -2) }, // 近景
  { name: "Left", offset: new Vector3(0, 0.8, -4) }, // 侧视图2
  { name: "Front", offset: new Vector3(3, 0.5, 0) }, // 前视图
  { name: "Top", offset: new Vector3(0, 3.5, 0) }, // 俯视图
];

export const CAMERAS = CAMERA_VIEWS.map((view) => view.name);

interface TipState {
  visible: boolean; // 是否显示
  type: string; // 提示类型：'doorOpen' | 'doorClose' | 'weiyiOpen' | 'weiyiClose'
  position: { x: number; y: number }; // 显示位置
}

interface AppState {
  colorIndex: number;
  currentCamera: number;
  setCurrentCamera: (index: number) => void; // 新增

  // 提示框状态,tip 的类型是TipState接口中的三个参数
  tip: TipState;
  //函数 setTip 中参数 newTip 的类型是 TipState接口中的三个参数
  setTip: (newTip: TipState) => void;
}

// useApp：全局状态管理（车漆颜色、相机视角）  create：创建一个 Zustand store
export const useApp = create<AppState>((set) => ({
  colorIndex: 0,
  currentCamera: 0,
  setCurrentCamera: (index) => set({ currentCamera: index }), // 实现 setter

  // 初始提示框状态（隐藏）
  tip: {
    visible: false,
    type: "",
    position: { x: 0, y: 0 },
  },
  // 更新提示框状态的方法（支持部分更新）
  setTip: (newTip) =>
    set((state) => ({
      tip: { ...state.tip, ...newTip }, // 合并新的提示框状态
    })),
  //这个方法的执行流程：接收 newTip 参数（部分更新数据）调用 Zustand 的 set 函数,  ...state.tip 保留当前所有属性,  ...newTip 覆盖需要更新的属性
}));
