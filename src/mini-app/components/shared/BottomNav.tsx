import { hapticSelection } from "../../telegram";
import { navigate, currentRoute, type Route } from "../../router";

interface NavItem {
  route: Route;
  label: string;
  icon: (active: boolean) => any;
}

const iconColor = (active: boolean) => active ? "var(--accent)" : "var(--text3)";

const items: NavItem[] = [
  {
    route: "hub", label: "Главная",
    icon: (a) => <svg width="22" height="22" viewBox="0 0 24 24" fill="none"><path d="M3 9.5L12 3l9 6.5V20a1 1 0 01-1 1H4a1 1 0 01-1-1V9.5z" stroke={iconColor(a)} stroke-width="1.8" stroke-linejoin="round"/><path d="M9 21V14h6v7" stroke={iconColor(a)} stroke-width="1.8" stroke-linejoin="round"/></svg>,
  },
  {
    route: "balance", label: "Баланс",
    icon: (a) => <svg width="22" height="22" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="9" stroke={iconColor(a)} stroke-width="1.8"/><path d="M12 3v9l6 3" stroke={iconColor(a)} stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>,
  },
  {
    route: "habits", label: "Привычки",
    icon: (a) => <svg width="22" height="22" viewBox="0 0 24 24" fill="none"><path d="M9 11l3 3 8-8" stroke={iconColor(a)} stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M20 12v6a2 2 0 01-2 2H6a2 2 0 01-2-2V6a2 2 0 012-2h9" stroke={iconColor(a)} stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>,
  },
  {
    route: "kaizen", label: "Кайдзен",
    icon: (a) => <svg width="22" height="22" viewBox="0 0 24 24" fill="none"><path d="M12 3c-1.5 4-4.5 7-8 8 3.5 1 6.5 4 8 8 1.5-4 4.5-7 8-8-3.5-1-6.5-4-8-8z" stroke={iconColor(a)} stroke-width="1.8" stroke-linejoin="round"/></svg>,
  },
  {
    route: "energy", label: "Энергия",
    icon: (a) => <svg width="22" height="22" viewBox="0 0 24 24" fill="none"><path d="M13 2L4 14h7l-1 8 9-12h-7l1-8z" stroke={iconColor(a)} stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>,
  },
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
            {item.icon(active === item.route)}
          </div>
          <span class="nav-label">{item.label}</span>
        </button>
      ))}
    </nav>
  );
}
