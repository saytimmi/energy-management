import { hapticSelection } from "../../telegram";
import { navigate, currentRoute, type Route } from "../../router";

interface NavItem {
  route: Route;
  label: string;
  icon: string;
}

const items: NavItem[] = [
  { route: "hub", icon: "🏠", label: "Главная" },
  { route: "balance", icon: "⚖️", label: "Баланс" },
  { route: "habits", icon: "⚡", label: "Привычки" },
  { route: "kaizen", icon: "🧠", label: "Кайдзен" },
  { route: "energy", icon: "🔋", label: "Энергия" },
];

export function BottomNav() {
  const active = currentRoute.value;
  return (
    <nav class="bottom-nav">
      {items.map((item) => (
        <button
          key={item.route}
          class={`nav-btn ${active === item.route ? "active" : ""}`}
          onClick={() => { hapticSelection(); navigate(item.route); }}
        >
          <div class="nav-icon-wrap">
            <span class="nav-emoji" role="img" aria-label={item.label}>{item.icon}</span>
          </div>
          <span class="nav-label">{item.label}</span>
        </button>
      ))}
    </nav>
  );
}
