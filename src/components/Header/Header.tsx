interface Props {
  viewName: string;
  scheduleName: string;
  onNewRecord: () => void;
  onExport: () => void;
  onHome: () => void;
}

export default function Header({ viewName, scheduleName, onNewRecord, onExport, onHome }: Props) {
  return (
    <header className="header">
      <div className="header-logo">
        <div className="logo-icon">
          <svg viewBox="0 0 732 732" width="36" height="36">
            <path d="M0,0 L732,0 L732,732 L0,732 Z M162,561 L735.9,455.1 L735.8,378.5 Z M162,561 L735.5,285.8 L735.2,189.3 Z M162,561 L734.8,64.7 L734.6,-3.5 Z M162,561 L734.6,-3.5 L737,-5 L666.3,-3.7 Z M162,561 L541.8,-4.1 L445.2,-4.5 Z M162,561 L352.6,-4.7 L276,-4.9 Z" fill="#E8151B" fillRule="evenodd"/>
          </svg>
        </div>
        <div>
          <div className="logo-text">LUMINEO SIGNS</div>
          <div className="logo-sub">{scheduleName}</div>
        </div>
      </div>
      <div className="h-divider" />
      <div className="h-title">{viewName}</div>
      <div className="h-actions">
        <button className="h-icon-btn" title="Home" onClick={onHome}>
          <svg viewBox="0 0 16 16" fill="currentColor" width="14" height="14">
            <path d="M8 1L1 7h2v7h4v-4h2v4h4V7h2L8 1z"/>
          </svg>
        </button>
        <div className="h-divider" style={{ margin: '0 4px' }} />
        <button className="h-btn" onClick={onNewRecord}>
          <svg viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2" width="11" height="11">
            <path d="M7 1v12M1 7h12"/>
          </svg>
          New Record
        </button>
        <button className="h-btn sec" onClick={onExport}>
          <svg viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" width="11" height="11">
            <path d="M12 9v3H2V9M7 1v8M4 6l3 3 3-3"/>
          </svg>
          Export
        </button>
      </div>
    </header>
  );
}
