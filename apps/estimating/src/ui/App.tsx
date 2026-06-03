import { useState } from 'react';

// Placeholder shell. The real UI (project list, sign-piece editor, BC export view)
// is wired up in the next task — this just lets `vite build` succeed during the
// scaffolding phase.
export function App() {
  const [, setReady] = useState(false);
  return (
    <div style={{ padding: 24, fontFamily: '"Open Sans", sans-serif' }}>
      <header
        style={{
          height: 64,
          background: '#141464',
          color: '#fff',
          display: 'flex',
          alignItems: 'center',
          padding: '0 24px',
          marginBottom: 24,
          borderRadius: 10,
        }}
      >
        <strong>Lumineo Estimating</strong>
      </header>
      <main>
        <p style={{ color: '#3f3f46' }}>
          App scaffold ready. Data extraction and engine wire-up are coming in
          the next commit on this branch.
        </p>
        <button
          onClick={() => setReady(true)}
          style={{
            background: '#E8151B',
            color: '#fff',
            border: 0,
            padding: '10px 16px',
            borderRadius: 7,
            fontWeight: 600,
          }}
        >
          Acknowledge
        </button>
      </main>
    </div>
  );
}
