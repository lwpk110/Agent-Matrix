import { CodexSessionPrototype } from './components/CodexSessionPrototype';
import { Codex3DTopology } from './components/codex3d/Codex3DTopology';

/** 原型只传入模拟场景配置，始终可以与实时页面并排比较。 */
export default function PrototypeApp() {
  const threeDimensional = window.location.pathname.replace(/\/$/, '').endsWith('/3d');
  return threeDimensional
    ? <Codex3DTopology prototypeMode />
    : <CodexSessionPrototype prototypeMode />;
}
