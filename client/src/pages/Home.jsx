import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useUser } from '../App';
import { Users, Type, CheckCircle, Download, MessageCircle, Gamepad2, Moon, Sun } from 'lucide-react';

const FEATURES = [
  {
    Icon: Users,
    title: 'Write Together',
    desc: 'Multiple contributors, one shared story. See every addition appear in real time.',
  },
  {
    Icon: Type,
    title: 'Rich Text Editor',
    desc: 'Full WYSIWYG formatting — bold, italic, headings, lists, links and images.',
  },
  {
    Icon: CheckCircle,
    title: 'Review & Approve',
    desc: 'Curate every submission. Approve, reject, and reorder until the story is right.',
  },
  {
    Icon: Download,
    title: 'Export Anywhere',
    desc: 'Download finished stories as TXT, PDF, Word doc, or EPUB — ready to publish.',
  },
  {
    Icon: MessageCircle,
    title: 'Live Chat',
    desc: 'Discuss ideas and give feedback without ever leaving the writing room.',
  },
  {
    Icon: Gamepad2,
    title: 'Writer Games',
    desc: 'Recharge between sessions with Wordle, Hangman, and Word Ladder.',
  },
];

function Home() {
  const { theme, toggleTheme } = useUser();
  const navigate = useNavigate();

  return (
    <div className="landing-page">
      <button className="theme-toggle" onClick={toggleTheme} title="Toggle theme">
        {theme === 'light' ? <Moon size={18} /> : <Sun size={18} />}
      </button>

      {/* ── HERO ── */}
      <section className="landing-hero">
        <img src="/assets/logo.svg" alt="Penwove" className="landing-logo" />
        <h1 className="home-title">Penwove</h1>
        <p className="landing-tagline">Where stories are written together.</p>
        <p className="landing-desc">
          A real-time collaborative writing platform for writers, teams, and storytellers.
          Contribute, review, and export — all in one place.
        </p>
        <button className="btn btn-primary landing-cta" onClick={() => navigate('/start')}>
          Start Writing →
        </button>
      </section>

      {/* ── FEATURES ── */}
      <section className="landing-features">
        <h2 className="landing-section-title">Everything you need to write together</h2>
        <p className="landing-section-sub">From first draft to final export — Penwove has you covered.</p>
        <div className="features-grid">
          {FEATURES.map(({ Icon, title, desc }) => (
            <div key={title} className="feature-card">
              <span className="feature-icon"><Icon size={28} strokeWidth={1.5} /></span>
              <h3 className="feature-title">{title}</h3>
              <p className="feature-desc">{desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer className="landing-footer">
        <p>© {new Date().getFullYear()} Penwove — made for writers.</p>
      </footer>
    </div>
  );
}

export default Home;
