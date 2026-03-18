export function LoadingScreen() {
  return (
    <div class="screen loading-screen">
      <div class="pulse-ring" />
      <p class="loading-text">Загружаю...</p>
    </div>
  );
}

export function WelcomeScreen({ message }: { message?: string }) {
  return (
    <div class="screen" style={{ display: "flex", flexDirection: "column" }}>
      <div class="welcome-content">
        <div class="welcome-icon">✨</div>
        <h1>Привет!</h1>
        <p>{message ?? "Напиши боту как ты себя чувствуешь — я начну отслеживать твою энергию."}</p>
      </div>
    </div>
  );
}

export function ErrorScreen() {
  return (
    <div class="screen" style={{ display: "flex", flexDirection: "column" }}>
      <div class="welcome-content">
        <div class="welcome-icon">😔</div>
        <h1>Не удалось загрузить</h1>
        <p>Проверь соединение и попробуй снова</p>
        <button class="retry-btn" onClick={() => location.reload()}>🔄 Повторить</button>
      </div>
    </div>
  );
}
