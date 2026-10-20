import {createRoot} from 'react-dom/client';
import './index.css';

// 原型入口独立加载，避免 App 初始化的 WebSocket 和历史恢复将模拟场景切成实时数据。
const prototype = ['/codex/prototype', '/codex/prototype/3d'].includes(window.location.pathname.replace(/\/$/, ''));
const application = prototype
  ? import('./PrototypeApp.tsx')
  : import('./App.tsx');

application.then(({ default: App }) => {
  createRoot(document.getElementById('root')!).render(<App />);
});
