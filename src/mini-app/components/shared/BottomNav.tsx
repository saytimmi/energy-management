import { hapticSelection } from "../../telegram";
import { navigate, currentRoute, type Route } from "../../router";

interface NavItem {
  route: Route;
  label: string;
  icon: string;
}

const items: NavItem[] = [
  { route: "hub", label: "Главная", icon: '<path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/>' },
  { route: "energy", label: "Энергия", icon: '<polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>' },
  { route: "habits", label: "Привычки", icon: '<path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/>' },
  { route: "journal", label: "Дневник", icon: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="8" y1="13" x2="16" y2="13"/><line x1="8" y1="17" x2="13" y2="17"/>' },
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
            <svg class="nav-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" dangerouslySetInnerHTML={{ __html: item.icon }} />
          </div>
          <span class="nav-label">{item.label}</span>
        </button>
      ))}
    </nav>
  );
}
