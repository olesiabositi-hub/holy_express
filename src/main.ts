import "@fontsource/golos-text/400.css";
import "@fontsource/golos-text/600.css";
import "@fontsource/golos-text/700.css";
import "@fontsource/golos-text/800.css";
import "./styles.css";
import { createWorld } from "./world/world";
import { createHub } from "./ui/hub";
import { load } from "./state";

const S = load();
let hub: ReturnType<typeof createHub> | null = null;

function noWebGL() {
  try {
    const c = document.createElement("canvas");
    return !(c.getContext("webgl2") || c.getContext("webgl"));
  } catch {
    return true;
  }
}

if (noWebGL()) {
  document.getElementById("ui")!.innerHTML =
    '<div class="modal-bg"><div class="modal"><h2>Нужен WebGL</h2><p class="lead">Браузер не смог запустить 3D. Попробуй свежий Chrome, Safari или Firefox.</p></div></div>';
} else {
  const world = createWorld(document.getElementById("world")!, {
    hover: (i) => hub?.hover(i),
    select: (i) => hub?.select(i),
    santa: () => hub?.santaCaught(),
  });
  hub = createHub(document.getElementById("ui")!, world, S);
  setTimeout(() => hub!.showIntroIfNeeded(), new URLSearchParams(location.search).has("nointro") ? 0 : 3200);
}
