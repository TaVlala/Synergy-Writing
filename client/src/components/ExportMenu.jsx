import React, { useEffect } from 'react';
import { Download, FileText, FileDown, FileType2, BookOpen } from 'lucide-react';

function ExportMenu({
  show,
  onToggle,
  onExportTxt,
  onExportPdf,
  onExportDocx,
  onExportEpub,
  menuRef,
}) {
  useEffect(() => {
    const handleOutsideClick = event => {
      if (!show) return;
      if (menuRef?.current && !menuRef.current.contains(event.target)) {
        onToggle(false);
      }
    };

    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, [menuRef, onToggle, show]);

  return (
    <div className="export-menu-wrap" ref={menuRef}>
      <button
        className={`btn btn-secondary btn-icon-only ${show ? 'active' : ''}`}
        onClick={() => onToggle(!show)}
        title="Export Document"
      >
        <Download size={15} />
      </button>
      {show && (
        <div className="export-dropdown">
          <button onClick={onExportTxt} className="export-item">
            <span className="export-icon"><FileText size={16} /></span>
            <div className="export-info">
              <span className="export-label">Plain Text</span>
              <span className="export-ext">.txt</span>
            </div>
          </button>
          <button onClick={onExportPdf} className="export-item">
            <span className="export-icon"><FileDown size={16} /></span>
            <div className="export-info">
              <span className="export-label">PDF Document</span>
              <span className="export-ext">.pdf</span>
            </div>
          </button>
          <button onClick={onExportDocx} className="export-item">
            <span className="export-icon"><FileType2 size={16} /></span>
            <div className="export-info">
              <span className="export-label">Word Document</span>
              <span className="export-ext">.docx</span>
            </div>
          </button>
          <button onClick={onExportEpub} className="export-item">
            <span className="export-icon"><BookOpen size={16} /></span>
            <div className="export-info">
              <span className="export-label">EPUB Book</span>
              <span className="export-ext">.epub</span>
            </div>
          </button>
        </div>
      )}
    </div>
  );
}

export default React.memo(ExportMenu);
