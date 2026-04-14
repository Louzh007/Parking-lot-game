// 性能优化配置
export const PERFORMANCE_CONFIG = {
  // 渲染设置
  RENDER: {
    DPR: [1, 1.5], // 设备像素比
    SHADOWS: true,
    ANTIALIAS: true,
    PERFORMANCE_THRESHOLD: 0.5, // 性能阈值
  },

  // 粒子系统设置
  PARTICLES: {
    BACKGROUND_COUNT: 2000, // 背景粒子数量
    GROUND_SIZE: 3, // 地面粒子系统大小
    GROUND_SPACING: 0.5, // 地面粒子间距
  },

  // 后处理效果
  POSTPROCESSING: {
    BLOOM_INTENSITY: 0.5,
    BLOOM_THRESHOLD: 10,
  },

  // 动画设置
  ANIMATION: {
    MIXER_UPDATE_SPEED: 0.5, // 动画混合器更新速度
    FRAME_SKIP_THRESHOLD: 0.01, // 帧跳过阈值
  },

  // 调试设置
  DEBUG: {
    SHOW_PERFORMANCE_MONITOR: true,
    LOG_PERFORMANCE: false,
  },
};

// 根据设备性能自动调整设置
export function getAdaptiveConfig() {
  const isLowEndDevice =
    navigator.hardwareConcurrency <= 4 || (navigator as any).deviceMemory <= 4;

  if (isLowEndDevice) {
    return {
      ...PERFORMANCE_CONFIG,
      PARTICLES: {
        ...PERFORMANCE_CONFIG.PARTICLES,
        BACKGROUND_COUNT: 1000,
        GROUND_SIZE: 2,
        GROUND_SPACING: 0.8,
      },
      POSTPROCESSING: {
        ...PERFORMANCE_CONFIG.POSTPROCESSING,
        BLOOM_INTENSITY: 0.3,
      },
    };
  }

  return PERFORMANCE_CONFIG;
}
