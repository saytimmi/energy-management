import { render } from "preact";

function App() {
  return <div style={{ color: "white", padding: "20px" }}>Preact works!</div>;
}

render(<App />, document.getElementById("app")!);
