declare global {
  interface Window {
    Telegram?: {
      WebApp: {
        ready(): void;
        expand(): void;
        initData: string;
        initDataUnsafe: {
          user?: {
            id: number;
            first_name: string;
            last_name?: string;
            username?: string;
          };
        };
        themeParams: Record<string, string>;
        colorScheme: "light" | "dark";
        HapticFeedback: {
          impactOccurred(style: "light" | "medium" | "heavy"): void;
          notificationOccurred(type: "error" | "success" | "warning"): void;
          selectionChanged(): void;
        };
        BackButton: {
          show(): void;
          hide(): void;
          onClick(cb: () => void): void;
          offClick(cb: () => void): void;
        };
        onEvent(event: string, cb: () => void): void;
      };
    };
  }
}

const tg = window.Telegram?.WebApp;

export function initTelegram(): void {
  if (tg) { tg.ready(); tg.expand(); }
}

export function getInitData(): string {
  return tg?.initData ?? "";
}

export function getTelegramUser() {
  return tg?.initDataUnsafe?.user ?? null;
}

export function haptic(type: "light" | "medium" | "heavy" = "light"): void {
  tg?.HapticFeedback?.impactOccurred(type);
}

export function hapticSuccess(): void {
  tg?.HapticFeedback?.notificationOccurred("success");
}

export function hapticSelection(): void {
  tg?.HapticFeedback?.selectionChanged();
}

export function showBackButton(onBack: () => void): void {
  if (tg?.BackButton) { tg.BackButton.show(); tg.BackButton.onClick(onBack); }
}

export function hideBackButton(): void {
  tg?.BackButton?.hide();
}

export function syncTheme(): void {
  if (!tg) return;
  const params = tg.themeParams;
  const root = document.documentElement;
  if (params.bg_color) root.style.setProperty("--tg-bg", params.bg_color);
  if (params.text_color) root.style.setProperty("--tg-text", params.text_color);
  if (params.hint_color) root.style.setProperty("--tg-hint", params.hint_color);
  if (params.button_color) root.style.setProperty("--tg-button", params.button_color);
  if (params.secondary_bg_color) root.style.setProperty("--tg-surface", params.secondary_bg_color);
  tg.onEvent("themeChanged", syncTheme);
}
