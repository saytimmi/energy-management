interface BalanceScreenProps {
  param?: string;
}

export function BalanceScreen({ param }: BalanceScreenProps) {
  return (
    <div class="screen">
      <header class="app-header">
        <h1 style={{ fontSize: "18px", fontWeight: 700 }}>⚖️ Баланс жизни</h1>
      </header>
      <main class="views">
        <div style={{ padding: "40px 20px", textAlign: "center", color: "var(--text2)" }}>
          Колесо баланса скоро появится
          {param && <div style={{ marginTop: 8, fontSize: 13 }}>Раздел: {param}</div>}
        </div>
      </main>
    </div>
  );
}
