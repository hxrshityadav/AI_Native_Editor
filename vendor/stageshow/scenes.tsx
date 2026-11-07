import { createRoot } from 'react-dom/client';
import { Stage } from './kit/stage';
import { Window, Text } from './kit/window';
import Gold from './gold';
import './scenes.css';

// Still illustrations only. The actual tools retain their own controls and measured results.
const kind = new URLSearchParams(location.search).get('scene') || 'photo';
const labels = { photo: 'Image resizer', video: 'Video trimmer', audio: 'Audio cutter', ai: 'Manual captions' };
function Scene() {
  return <Stage width={520} height={260} compact={{ below: 500, width: 358, height: 240 }} theme="dark" fidelity="realistic" accent="#efb45b" className={`rf-scene rf-scene-${kind}`} tokens={{ '--ss-canvas': '#171717', '--ss-surface': '#242424', '--ss-chrome': '#242424', '--ss-text': '#f5f3ed', '--ss-shadow-hero': 'none', '--ss-font': 'system-ui, sans-serif' }}>
    {(_, __, layout) => <Window title={labels[kind as keyof typeof labels]} lights="grey" className="rf-window">
      {kind === 'photo' ? <div className="rf-photo">
        <img src="/samples/finishing-preview.webp" alt="" />
        <div className="rf-crop" />
        <div className="rf-size"><Text>1080 × 1080</Text></div>
      </div> : kind === 'video' ? <div className="rf-video">
        <img src="/samples/finishing-preview.webp" alt="" />
        <div className="rf-ruler"><Text>00:00</Text><Text>00:05</Text><Text>00:10</Text></div>
        <div className="rf-film">{Array.from({ length: 7 }, (_, i) => <img key={i} src="/samples/finishing-preview.webp" alt="" />)}</div>
        <div className="rf-playhead" />
      </div> : kind === 'audio' ? <div className="rf-audio">
        <div className="rf-audio-title"><Text>Keep the part you love.</Text><Text>00:08 — 00:24</Text></div>
        <div className="rf-wave">{Array.from({ length: layout === 'compact' ? 42 : 62 }, (_, i) => <span key={i} style={{ height: `${16 + (Math.sin(i * 1.8) + 1) * 28 + (i % 5) * 5}px` }} />)}</div>
        <div className="rf-selection" />
      </div> : <div className="rf-captions">
        <img src="/samples/finishing-preview.webp" alt="" />
        <div className="rf-caption"><Text>Make every</Text>{' '}<Text className="rf-caption-highlight">word</Text>{' '}<Text>count.</Text></div>
      </div>}
    </Window>}
  </Stage>;
}
createRoot(document.getElementById('root')!).render(kind === 'gold' ? <Gold /> : <Scene />);
