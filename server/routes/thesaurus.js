const express = require('express');

function createThesaurusRouter() {
  const router = express.Router();

  router.get('/thesaurus', async (req, res) => {
    const word = String(req.query.word || '').trim().toLowerCase();
    const context = String(req.query.context || '').trim();
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.set('Pragma', 'no-cache');
    res.set('Expires', '0');


    if (!word) {
      return res.status(400).json({ error: 'word is required' });
    }

    try {
      const url = `https://api.datamuse.com/words?rel_syn=${encodeURIComponent(word)}&max=40${context ? `&ml=${encodeURIComponent(context)}` : ''}`;
      const response = await fetch(url);

      if (!response.ok) {
        return res.status(502).json({ error: 'Thesaurus lookup failed' });
      }

      const data = await response.json();
      const seen = new Set();
      const synonyms = [];

      data.forEach(({ word: candidate }) => {
        if (candidate && candidate !== word && !seen.has(candidate)) {
          seen.add(candidate);
          synonyms.push(candidate);
        }
      });

      return res.json({ word, synonyms: synonyms.slice(0, 30) });
    } catch (_error) {
      return res.status(502).json({ error: 'Thesaurus lookup failed' });
    }
  });

  return router;
}

module.exports = {
  createThesaurusRouter,
};
