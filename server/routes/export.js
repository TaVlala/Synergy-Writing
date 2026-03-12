const express = require('express');

function createExportRouter({ sanitizeRichHtml }) {
  const router = express.Router();

  router.post('/rooms/:id/export/epub', async (req, res) => {
    const { title, chapters } = req.body || {};
    if (!title || !Array.isArray(chapters) || chapters.length === 0) {
      return res.status(400).json({ error: 'title and chapters required' });
    }

    try {
      if (typeof globalThis.File === 'undefined') {
        const { Blob } = require('buffer');
        globalThis.File = class File extends Blob {
          constructor(chunks, name, options = {}) {
            super(chunks, options);
            this.name = name;
            this.lastModified = options.lastModified || Date.now();
          }
        };
      }

      const epubGen = require('epub-gen-memory');
      const generate = epubGen.default || epubGen;
      const safeChapters = chapters.map(chapter => ({ ...chapter, content: sanitizeRichHtml(chapter.content) }));
      const buffer = await generate({ title, author: 'Penwove Contributors', publisher: 'Penwove' }, safeChapters);
      const safeTitle = title.replace(/[^a-z0-9]/gi, '_').toLowerCase();
      res.setHeader('Content-Type', 'application/epub+zip');
      res.setHeader('Content-Disposition', `attachment; filename="${safeTitle}.epub"`);
      res.send(Buffer.from(buffer));
    } catch (err) {
      console.error('EPUB generation failed:', err);
      res.status(500).json({ error: 'EPUB generation failed', detail: err.message });
    }
  });

  return router;
}

module.exports = {
  createExportRouter,
};
