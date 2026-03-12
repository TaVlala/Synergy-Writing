import { sanitizeRichHtml, stripHTML } from '../utils';

function sortApproved(contributions) {
  return contributions
    .filter(item => (item.status || 'approved') === 'approved')
    .sort((a, b) => (a.sort_order ?? Infinity) - (b.sort_order ?? Infinity) || a.created_at - b.created_at);
}

function makeSafeFilename(title, extension) {
  return `${title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.${extension}`;
}

export function useRoomExports({ room, contributions, roomId, apiFetch, onError, onComplete }) {
  const handleExportTxt = () => {
    const title = room?.title || 'Untitled Story';
    const approved = sortApproved(contributions);
    const content = approved.map(item => stripHTML(item.content)).join('\n\n');
    const fullText = `${title}\n${'='.repeat(title.length)}\n\n${content}`;

    const blob = new Blob([fullText], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = makeSafeFilename(title, 'txt');
    anchor.click();
    URL.revokeObjectURL(url);
    onComplete?.();
  };

  const exportAsPDF = async () => {
    const { jsPDF } = await import('jspdf');
    const title = room?.title || 'Untitled Story';
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const container = document.createElement('div');
    container.style.width = '170mm';
    container.style.fontSize = '12pt';
    container.style.fontFamily = 'serif';
    container.style.color = '#000';
    container.style.lineHeight = '1.5';
    container.style.whiteSpace = 'pre-wrap';
    container.style.wordBreak = 'break-word';

    const heading = document.createElement('h1');
    heading.style.fontSize = '24pt';
    heading.style.textAlign = 'center';
    heading.style.marginBottom = '20pt';
    heading.innerText = title;
    container.appendChild(heading);

    sortApproved(contributions).forEach(item => {
      const section = document.createElement('div');
      section.style.marginBottom = '12pt';
      section.innerHTML = sanitizeRichHtml(item.content);
      container.appendChild(section);
    });

    document.body.appendChild(container);

    try {
      await doc.html(container, { x: 20, y: 20, width: 170, windowWidth: 800, autoPaging: 'text' });
      doc.save(makeSafeFilename(title, 'pdf'));
    } catch (err) {
      console.error('PDF export failed:', err);
      onError?.('PDF export failed. Please try again.');
    } finally {
      document.body.removeChild(container);
      onComplete?.();
    }
  };

  const exportAsWord = async () => {
    const { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType } = await import('docx');
    const { saveAs } = await import('file-saver');
    const title = room?.title || 'Untitled Story';

    const children = [
      new Paragraph({ text: title, heading: HeadingLevel.HEADING_1, alignment: AlignmentType.CENTER }),
      new Paragraph({ text: '' }),
    ];

    sortApproved(contributions).forEach(item => {
      const tempDiv = document.createElement('div');
      tempDiv.innerHTML = sanitizeRichHtml(item.content);
      const authorColor = (item.author_color || '#000000').replace('#', '');
      const runs = [];

      const walk = node => {
        if (node.nodeType === Node.TEXT_NODE) {
          runs.push(new TextRun({
            text: node.textContent,
            color: authorColor,
            bold: ['B', 'STRONG'].includes(node.parentElement?.tagName),
            italics: ['I', 'EM'].includes(node.parentElement?.tagName),
          }));
          return;
        }
        node.childNodes.forEach(walk);
      };

      walk(tempDiv);
      children.push(new Paragraph({
        children: runs.length ? runs : [new TextRun({ text: stripHTML(item.content), color: authorColor })],
        spacing: { after: 200 },
      }));
    });

    const doc = new Document({ sections: [{ properties: {}, children }] });
    const blob = await Packer.toBlob(doc);
    saveAs(blob, makeSafeFilename(title, 'docx'));
    onComplete?.();
  };

  const handleExportEpub = async () => {
    const title = room?.title || 'Untitled Story';
    const approved = sortApproved(contributions);
    const bodyHtml = approved
      .map(item => `<div style="color: ${item.author_color || '#000'}; margin-bottom: 1em;">${sanitizeRichHtml(item.content)}</div>`)
      .join('\n');
    const chapters = [{ title, content: bodyHtml || '<p> </p>' }];

    try {
      const { saveAs } = await import('file-saver');
      const response = await apiFetch(`/api/rooms/${roomId}/export/epub`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, chapters }),
      });
      if (!response.ok) {
        const errBody = await response.text();
        throw new Error(errBody || `Server error ${response.status}`);
      }
      const blob = await response.blob();
      saveAs(blob, makeSafeFilename(title, 'epub'));
    } catch (err) {
      console.error('EPUB export failed:', err);
      onError?.('EPUB export failed. Please try again.');
    } finally {
      onComplete?.();
    }
  };

  return {
    handleExportTxt,
    exportAsPDF,
    exportAsWord,
    handleExportEpub,
  };
}
