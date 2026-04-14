import React from "react";

const POPUP_IMG = "./image/result_popup/";

function formatMmSs(totalSec: number) {
  const s = Math.max(0, Math.floor(totalSec));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${String(m).padStart(2, "0")}:${String(r).padStart(2, "0")}`;
}

interface GameHUDProps {
  wallet: number;
  maxWallet: number;
  collisionCount: number;
  difficultyStars: 1 | 2 | 3 | 4;
  winText: string;
  loseText: string;
  winSubText: string;
  loseSubText: string;
  /** 本关倒计时上限（秒），用于胜利结算「消耗时间」 */
  timeLimitSec: number;
  targetSpotId: string;
  remainingTime: number;
  currentLevelIndex: number;
  maxUnlockedLevelIndex: number;
  currentLevel: number;
  totalLevels: number;
  gameResult: "win" | "lose" | null;
  onRetry: () => void;
  onNextLevel: () => void;
  onExit: () => void;
  /** 选择指定关卡（0-based） */
  onSelectLevel: (levelIndex: number) => void;
  isLastLevel: boolean;
}

// =================================================================
// --- 结算弹窗：切图 + 布局 ---
// =================================================================

const ImageChromeButton = ({
  idleUrl,
  hoverUrl,
  onClick,
  children,
  textColor = "#f2f2f2",
  style,
}: {
  idleUrl: string;
  hoverUrl: string;
  onClick: () => void;
  children: React.ReactNode;
  textColor?: string;
  style?: React.CSSProperties;
}) => {
  const [hover, setHover] = React.useState(false);
  return (
    <button
      type="button"
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        flex: 1,
        minHeight: 48,
        border: "none",
        cursor: "pointer",
        padding: "9px 40px",
        color: textColor,
        fontSize: 15,
        fontWeight: 700,
        letterSpacing: 1,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 12,
        backgroundImage: `url(${hover ? hoverUrl : idleUrl})`,
        backgroundSize: "100% 100%",
        backgroundRepeat: "no-repeat",
        backgroundPosition: "center",
        transition: "filter 0.15s ease",
        filter: hover ? "brightness(1.06)" : "none",
        ...style,
      }}
    >
      {children}
    </button>
  );
};

const GameResultUI = ({
  result,
  collisionCount,
  wallet,
  winText,
  loseText,
  winSubText,
  loseSubText,
  timeLimitSec,
  remainingTime,
  totalLevels,
  currentLevelIndex,
  maxUnlockedLevelIndex,
  onRetry,
  onNextLevel,
  onExit,
  onSelectLevel,
  isLastLevel,
}: {
  result: "win" | "lose";
  collisionCount: number;
  wallet: number;
  winText: string;
  loseText: string;
  winSubText: string;
  loseSubText: string;
  timeLimitSec: number;
  remainingTime: number;
  totalLevels: number;
  currentLevelIndex: number;
  maxUnlockedLevelIndex: number;
  onRetry: () => void;
  onNextLevel: () => void;
  onExit: () => void;
  onSelectLevel: (levelIndex: number) => void;
  isLastLevel: boolean;
}) => {
  const isWin = result === "win";
  const [showLevelPicker, setShowLevelPicker] = React.useState(false);
  const accent = isWin ? "#39ff9c" : "#ff7a21";
  const titlecolor = isWin ? "#F1F1F1" : "#FFECEC";
  const titleGlow = isWin
    ? "0 0 24px rgba(57,255,156,0.75)"
    : "0 0 28px rgba(255,120,80,0.85)";
  const subBorder = isWin
    ? "rgba(57,255,156,0.55)"
    : "rgba(255, 110, 132, 0.50)";
  const subBackground = isWin
    ? "rgba(57,255,156,0.10)"
    : "rgba(255, 110, 132, 0.10)";
  const subTextColor = isWin ? "#51FF33" : "#FF6E84";

  const elapsedSec = Math.max(0, timeLimitSec - remainingTime);
  const perfectionFilled = Math.max(0, Math.min(5, 5 - collisionCount));

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 16,
        background: "rgba(0,0,0,0.72)",
        backdropFilter: "blur(6px)",
        WebkitBackdropFilter: "blur(6px)",
        zIndex: 2000,
        fontFamily: "'Segoe UI', 'PingFang SC', 'Microsoft YaHei', sans-serif",
      }}
    >
      <div
        style={{
          width: "min(600px, 94vw)",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 12,
        }}
      >
        <div
          style={{
            position: "relative",
            width: "min(560px, 94vw)",
            maxHeight: "min(90vh, 720px)",
            overflow: "auto",
            borderRadius: 2,
            boxShadow: "0 12px 48px rgba(0,0,0,0.55)",
            backgroundImage: `url(${POPUP_IMG}${isWin ? "win_popup_bg.png" : "lose_popup_bg.png"})`,
            backgroundSize: "100% 100%",
            backgroundPosition: "center",
          }}
        >
          <button
            type="button"
            onClick={onExit}
            style={{
              position: "absolute",
              top: 14,
              left: 14,
              zIndex: 2,
              display: "flex",
              alignItems: "center",
              gap: 8,
              padding: "6px 8px",
              border: "none",
              background: "transparent",
              color: "#eaeaea",
              fontSize: 14,
              fontWeight: 400,
              cursor: "pointer",
            }}
          >
            <img
              src={`${POPUP_IMG}${isWin ? "win_icon_back.png" : "lose_icon_back.png"}`}
              alt=""
              style={{ width: 18, height: 18, objectFit: "contain" }}
            />
            返回展厅
          </button>

          <div style={{ padding: "52px 72px 32px" }}>
            <h1
              style={{
                marginTop: 12,
                textAlign: "center",
                fontSize: "36px",
                fontWeight: 900,
                color: titlecolor,
                letterSpacing: 2,
                lineHeight: 1.35,
                textShadow: titleGlow,
              }}
            >
              {isWin ? winText : loseText}
            </h1>

            <div
              style={{
                margin: "8px auto 24px",
                padding: "6px 16px",
                width: "fit-content",
                maxWidth: "100%",
                borderRadius: 8,
                border: `1px solid ${subBorder}`,
                background: subBackground,
                justifyContent: "center",
                display: "flex",
                alignItems: "flex-end",
                gap: 8,
              }}
            >
              <img
                src={`${POPUP_IMG}${isWin ? "win_icon_subtitle.png" : "lose_icon_subtitle.png"}`}
                alt=""
                style={{
                  width: 20,
                  height: 20,
                  objectFit: "contain",
                  flexShrink: 0,
                  marginTop: 2,
                  marginLeft: 4,
                  marginBottom: 2,
                }}
              />
              <span
                style={{ fontSize: 13, color: subTextColor, lineHeight: 1.5 }}
              >
                {isWin ? winSubText : loseSubText}
              </span>
            </div>

            {isWin ? (
              <>
                <ResultStatRow
                  labelCn="消耗时间"
                  labelEn="TIME"
                  value={formatMmSs(elapsedSec)}
                  iconSrc={`${POPUP_IMG}win_icon_timer.png`}
                  accent={accent}
                />
                <div
                  style={{
                    display: "flex",
                    alignItems: "stretch",
                    gap: 0,
                    marginBottom: 10,
                    background: "rgba(0,0,0,0.35)",
                    borderLeft: `3px solid ${accent}`,
                    borderRadius: 0,
                    padding: "12px 24px",
                  }}
                >
                  <div style={{ flex: 1 }}>
                    <div
                      style={{
                        fontSize: 12,
                        color: "#aaaaaa",
                        marginBottom: 4,
                      }}
                    >
                      钱包余额 / WALLET
                    </div>
                    <div
                      style={{
                        fontSize: 20,
                        fontWeight: 800,
                        color: accent,
                        fontVariantNumeric: "tabular-nums",
                      }}
                    >
                      {wallet}
                    </div>
                  </div>
                  <div
                    style={{
                      width: 1,
                      alignSelf: "stretch",
                      background: "rgba(255,255,255,0.12)",
                      margin: "0 12px",
                    }}
                  />
                  <div style={{ flex: 1 }}>
                    <div
                      style={{
                        fontSize: 12,
                        color: "#aaaaaa",
                        marginBottom: 4,
                      }}
                    >
                      碰撞次数 / COLLISION
                    </div>
                    <div
                      style={{ fontSize: 20, fontWeight: 800, color: accent }}
                    >
                      {collisionCount} 次
                    </div>
                  </div>
                  <img
                    src={`${POPUP_IMG}win_icon_wallet.png`}
                    alt=""
                    style={{
                      width: 30,
                      height: 30,
                      objectFit: "contain",
                      alignSelf: "center",
                    }}
                  />
                </div>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                    marginBottom: 10,
                    background: "rgba(0,0,0,0.35)",
                    borderLeft: `3px solid ${accent}`,
                    borderRadius: 0,
                    padding: "12px 24px",
                  }}
                >
                  <div style={{ flex: 1 }}>
                    <div
                      style={{
                        fontSize: 12,
                        color: "#aaaaaa",
                        marginBottom: 6,
                      }}
                    >
                      评分 / SCORE
                    </div>
                    <div style={{ display: "flex", gap: 5 }}>
                      {[0, 1, 2, 3, 4].map((i) => (
                        <img
                          key={i}
                          src={
                            i < perfectionFilled
                              ? "./image/star-s-fill_light.png"
                              : "./image/star-s-fill_normal.png"
                          }
                          alt=""
                          style={{
                            width: 22,
                            height: 22,
                            objectFit: "contain",
                          }}
                        />
                      ))}
                    </div>
                  </div>
                  <img
                    src={`${POPUP_IMG}win_icon_perfection.png`}
                    alt=""
                    style={{ width: 30, height: 30, objectFit: "contain" }}
                  />
                </div>
              </>
            ) : (
              <>
                <ResultStatRow
                  labelCn="剩余时间"
                  labelEn="TIME"
                  value={formatMmSs(remainingTime)}
                  iconSrc={`${POPUP_IMG}lose_icon_timer.png`}
                  accent={accent}
                />
                <ResultStatRow
                  labelCn="碰撞次数"
                  labelEn="COLLISION"
                  value={`${collisionCount} 次`}
                  iconSrc={`${POPUP_IMG}lose_icon_collision.png`}
                  accent={accent}
                />
                <ResultStatRow
                  labelCn="钱包余额"
                  labelEn="WALLET"
                  value={`${wallet}`}
                  iconSrc={`${POPUP_IMG}lose_icon_wallet.png`}
                  accent={accent}
                />
              </>
            )}

            <div
              style={{
                display: "flex",
                gap: 10,
                marginTop: 32,
                alignItems: "stretch",
              }}
            >
              <ImageChromeButton
                idleUrl={`${POPUP_IMG}btn_select_level_idle.png`}
                hoverUrl={`${POPUP_IMG}btn_select_level_hover.png`}
                onClick={() => setShowLevelPicker((prev) => !prev)}
                textColor="#e8e8e8"
              >
                <img
                  src={`${POPUP_IMG}icon_select_level.png`}
                  alt=""
                  style={{ width: 18, height: 18, objectFit: "contain" }}
                />
                选择关卡
              </ImageChromeButton>
              <ImageChromeButton
                idleUrl={`${POPUP_IMG}${isWin ? "win_btn_primary_idle.png" : "lose_btn_primary_idle.png"}`}
                hoverUrl={`${POPUP_IMG}${isWin ? "win_btn_primary_hover.png" : "lose_btn_primary_hover.png"}`}
                onClick={isWin ? onNextLevel : onRetry}
                textColor={isWin ? "#ffffff" : "#111111"}
              >
                {isWin ? (
                  isLastLevel ? (
                    "重新开始"
                  ) : (
                    "下一关"
                  )
                ) : (
                  <>
                    <img
                      src={`${POPUP_IMG}icon_retry.png`}
                      alt=""
                      style={{ width: 18, height: 18, objectFit: "contain" }}
                    />
                    再来一次
                  </>
                )}
              </ImageChromeButton>
            </div>
          </div>
        </div>
        {showLevelPicker && (
          <LevelPickerRow
            totalLevels={totalLevels}
            currentLevelIndex={currentLevelIndex}
            maxUnlockedLevelIndex={maxUnlockedLevelIndex}
            onPickLevel={(levelIndex) => {
              setShowLevelPicker(false);
              onSelectLevel(levelIndex);
            }}
          />
        )}
      </div>
    </div>
  );
};

function LevelPickerRow({
  totalLevels,
  currentLevelIndex,
  maxUnlockedLevelIndex,
  onPickLevel,
}: {
  totalLevels: number;
  currentLevelIndex: number;
  maxUnlockedLevelIndex: number;
  onPickLevel: (levelIndex: number) => void;
}) {
  return (
    <div
      style={{
        width: "min(530px)",
        padding: "16px 14px",
        background: "rgba(0,0,0,0.6)",
        border: "1px solid rgba(255,255,255,0.1)",
        borderRadius: 4,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 14,
        flexWrap: "wrap",
      }}
    >
      {Array.from({ length: totalLevels }, (_, idx) => {
        const unlocked = idx <= maxUnlockedLevelIndex;
        return (
          <LevelPickButton
            key={idx}
            label={`关卡-${idx + 1}`}
            isCurrent={idx === currentLevelIndex}
            disabled={!unlocked}
            onClick={() => {
              if (!unlocked) return;
              onPickLevel(idx);
            }}
          />
        );
      })}
    </div>
  );
}

function LevelPickButton({
  label,
  isCurrent,
  disabled,
  onClick,
}: {
  label: string;
  isCurrent: boolean;
  disabled: boolean;
  onClick: () => void;
}) {
  const [hover, setHover] = React.useState(false);

  const borderColor = disabled
    ? "rgba(255,255,255,0.22)"
    : isCurrent || hover
      ? "#4cf35b"
      : "rgba(255,255,255,0.7)";
  const textColor = disabled
    ? "rgba(255,255,255,0.35)"
    : isCurrent || hover
      ? "#4cf35b"
      : "#ffffff";

  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        minWidth: 56,
        padding: "8px 12px",
        border: `1px solid ${borderColor}`,
        borderRadius: 5,
        background: disabled
          ? "rgba(255,255,255,0.04)"
          : isCurrent || hover
            ? "rgba(76,243,91,0.12)"
            : "rgba(255,255,255,0.02)",
        color: textColor,
        fontSize: 14,
        fontWeight: 500,
        cursor: disabled ? "not-allowed" : "pointer",
        transition: "all 0.15s ease",
      }}
    >
      {label}
    </button>
  );
}

function ResultStatRow({
  labelCn,
  labelEn,
  value,
  iconSrc,
  accent,
}: {
  labelCn: string;
  labelEn: string;
  value: string;
  iconSrc: string;
  accent: string;
}) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 12,
        marginBottom: 12,
        background: "rgba(0,0,0,0.35)",
        borderLeft: `3px solid ${accent}`,
        borderRadius: 0,
        padding: "12px 24px",
      }}
    >
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 12, color: "#aaaaaa", marginBottom: 4 }}>
          {labelCn} / {labelEn}
        </div>
        <div
          style={{
            fontSize: 22,
            fontWeight: 800,
            color: accent,
            fontVariantNumeric: "tabular-nums",
            letterSpacing: 1,
          }}
        >
          {value}
        </div>
      </div>
      <img
        src={iconSrc}
        alt=""
        style={{ width: 30, height: 30, objectFit: "contain", flexShrink: 0 }}
      />
    </div>
  );
}

// =================================================================
// --- 主组件：GameHUD ---
// =================================================================
export const GameHUD: React.FC<GameHUDProps> = ({
  wallet,
  maxWallet,
  collisionCount,
  difficultyStars,
  winText,
  loseText,
  winSubText,
  loseSubText,
  timeLimitSec,
  targetSpotId,
  remainingTime,
  currentLevelIndex,
  maxUnlockedLevelIndex,
  currentLevel,
  totalLevels,
  gameResult,
  onRetry,
  onNextLevel,
  onExit,
  onSelectLevel,
  isLastLevel,
}) => {
  const pct = Math.max(0, wallet / maxWallet);
  const isTimeWarning = remainingTime <= 10;

  return (
    <>
      {/* 剩余时间样式 */}
      <div
        style={{
          position: "fixed",
          top: 30,
          left: "50%",
          transform: "translateX(-50%)",
          minWidth: 56,
          padding: "8px 22px",
          borderRadius: 50,
          border: `2px solid ${isTimeWarning ? "#ff6666" : "#00ff88"}`,
          background: "rgba(22, 27, 22, 0.6)",
          color: isTimeWarning ? "#ff6666" : "#ffffff",
          fontSize: 24,
          fontWeight: 800,
          letterSpacing: 2,
          textAlign: "center",
          zIndex: 1600,
          pointerEvents: "none",
          boxShadow: `0 0 8px ${isTimeWarning ? "#ff444433" : "#00ff8833"}`,
          fontFamily: "'Segoe UI', sans-serif",
          visibility: gameResult ? "hidden" : "visible",
        }}
      >
        {remainingTime}
      </div>

      {/* --- 顶部核心 UI 面板 --- */}
      <div
        style={{
          position: "fixed",
          top: 120,
          right: 40,
          width: 280,
          height: 140,
          backgroundImage: `url('./image/Level background.png')`, // 使用你的背景切图
          backgroundSize: "100% 100%",
          padding: "16px 14px",
          display: "flex",
          flexDirection: "column",
          gap: 6,
          zIndex: 1500,
          pointerEvents: "none", // 避免遮挡点击
          visibility: gameResult ? "hidden" : "visible",
        }}
      >
        {/* 1. 关卡标题行 */}
        <div style={{ display: "flex", alignItems: "baseline", gap: 16 }}>
          <span
            style={{
              fontSize: 20,
              fontWeight: 900,
              color: "#fff",
              letterSpacing: 2,
            }}
          >
            关卡
          </span>
          <span style={{ fontSize: 24, fontWeight: 800, color: "#FFF8A5" }}>
            {currentLevel}{" "}
            <span style={{ color: "rgba(255,255,255,0.3)", fontSize: 18 }}>
              / {totalLevels}
            </span>
          </span>
        </div>

        {/* 2. 目标 & 难度行 */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginTop: 8,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ color: "rgba(255,255,255,0.6)", fontSize: 14 }}>
              目标
            </span>
            <span style={{ color: "#FFF8A5", fontSize: 16, fontWeight: 400 }}>
              {targetSpotId}
            </span>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
            <span style={{ color: "rgba(255,255,255,0.6)", fontSize: 14 }}>
              难度
            </span>
            {[1, 2, 3, 4].map((star) => (
              <img
                key={star}
                src={
                  star <= difficultyStars
                    ? "./image/star-s-fill_light.png"
                    : "./image/star-s-fill_normal.png"
                }
                style={{ width: 18, height: 18, objectFit: "contain" }}
                alt="star"
              />
            ))}
          </div>
        </div>

        {/* 3. 统计项行（钱包和碰撞） */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginTop: 12,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <img
              src="./image/wallet_icon.png"
              style={{ width: 20, objectFit: "contain" }}
              alt="wallet"
            />
            <span style={{ fontSize: 16, fontWeight: 400, color: "#fff" }}>
              ¥ {wallet}
            </span>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <img
              src="./image/Collision_icon.png"
              style={{ width: 20, objectFit: "contain" }}
              alt="collision"
            />
            <span
              style={{
                fontSize: 16,
                fontWeight: 400,
                color: collisionCount > 0 ? "#ff4d4d" : "#fff",
              }}
            >
              {collisionCount}
            </span>
          </div>
        </div>

        {/* 4. 底部进度条 + 左右装饰块 */}
        <div
          style={{
            width: "100%",
            height: 14,
            position: "relative",
            marginTop: 4,
            display: "flex",
            alignItems: "center",
            gap: 10,
          }}
        >
          <div
            style={{
              width: 8,
              height: 4,
              background: "rgba(255,255,255,0.5)",
              borderRadius: 1,
            }}
          />
          <div
            style={{
              flex: 1,
              height: 4,
              background: "rgba(255,255,255,0.12)",
              borderRadius: 3,
              position: "relative",
              overflow: "hidden",
            }}
          >
            <div
              style={{
                width: `${pct * 100}%`,
                height: "100%",
                background: "#FFEA4F",
                boxShadow: "0 0 12px #FFEA4F",
                transition: "width 0.4s cubic-bezier(0.2, 0, 0.2, 1)",
                borderRadius: 3,
              }}
            />
          </div>
          <div
            style={{
              width: 8,
              height: 4,
              background: "rgba(255,255,255,0.5)",
              borderRadius: 1,
            }}
          />
        </div>
      </div>

      {gameResult && (
        <GameResultUI
          result={gameResult}
          collisionCount={collisionCount}
          wallet={wallet}
          winText={winText}
          loseText={loseText}
          winSubText={winSubText}
          loseSubText={loseSubText}
          timeLimitSec={timeLimitSec}
          remainingTime={remainingTime}
          totalLevels={totalLevels}
          currentLevelIndex={currentLevelIndex}
          maxUnlockedLevelIndex={maxUnlockedLevelIndex}
          onRetry={onRetry}
          onNextLevel={onNextLevel}
          onExit={onExit}
          onSelectLevel={onSelectLevel}
          isLastLevel={isLastLevel}
        />
      )}
    </>
  );
};
