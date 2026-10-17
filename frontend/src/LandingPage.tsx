import type { CSSProperties } from 'react'
import { ArrowRight, ArrowUpRight, BookOpenText, Check, FileSearch2, Layers3, ShieldCheck } from 'lucide-react'
import { BrandMark } from './Brand'

type Props = { onEnter: () => void }

function SignalField() {
  return <div className="signal-field" aria-hidden="true">{Array.from({ length: 44 }, (_, index) => <i key={index} style={{ '--i': index } as CSSProperties} />)}</div>
}

export function LandingPage({ onEnter }: Props) {
  return <div className="landing">
    <header className="landing-header">
      <a className="landing-brand" href="#top" aria-label="GrantGuard home"><BrandMark light /><span>GrantGuard</span><small>ALPHA</small></a>
      <nav aria-label="Landing navigation"><a href="#how-it-works">How it works</a><a href="#workspace-preview">Workspace</a></nav>
      <button className="landing-header-cta" type="button" onClick={onEnter}>Explore projects <ArrowUpRight size={16} /></button>
    </header>

    <main id="top">
      <section className="landing-hero">
        <SignalField />
        <div className="hero-content">
          <div className="hero-eyebrow"><span /> WATER CARE · TAPS FOR RIGHTS</div>
          <h1>Know what the<br /><em>grant requires.</em></h1>
          <p>Turn scattered agreement, report, and workbook details into questions your team can inspect and resolve—with the original source always close at hand.</p>
          <button className="hero-cta" type="button" onClick={onEnter}>Explore projects <ArrowRight size={19} /></button>
          <span className="hero-note">Synthetic Water Care case · 30 June 2022 scenario</span>
        </div>
      </section>

      <section className="landing-preview-section" id="workspace-preview" aria-labelledby="preview-heading">
        <div className="landing-section-heading"><div><span className="landing-kicker">THE WORKSPACE</span><h2 id="preview-heading">A clearer path from<br />document to decision.</h2></div><p>Start with a question. Open the relevant source. Keep the human decision visible.</p></div>
        <div className="preview-stage">
          <div className="preview-window">
            <div className="preview-window-top"><span><BrandMark /> GrantGuard</span><span className="preview-window-dots"><i /><i /><i /></span></div>
            <div className="preview-window-body">
              <div className="preview-mini-nav"><strong>Project workspace</strong><span className="active">Overview</span><span>Evidence workspace</span><span>Issues</span><span>Obligations</span><span>Review history</span></div>
              <div className="preview-mini-main"><small>EVIDENCE WORKSPACE / TAPS FOR RIGHTS</small><h3>What needs attention?</h3><p>Ask a question, trace the source, and record a decision.</p><div className="preview-mini-prompt"><FileSearch2 size={19} /><span>When is the final report due?</span><ArrowRight size={17} /></div><div className="preview-mini-cards"><div><span>01 / ASK</span><strong>Start with the question.</strong><small>Use the source pack to investigate.</small></div><div><span>02 / INSPECT</span><strong>Read the cited page.</strong><small>See the original document in context.</small></div></div></div>
              <div className="preview-mini-source"><div className="preview-mini-paper"><span>CONTRIBUTION AGREEMENT</span><i /><i /><i /><i /><i /><b /></div><small>Original source · page view</small></div>
            </div>
          </div>
        </div>
      </section>

      <section className="landing-steps" id="how-it-works" aria-labelledby="steps-heading">
        <div className="landing-section-heading"><div><span className="landing-kicker">HOW IT WORKS</span><h2 id="steps-heading">Three steps. One source<br />of truth.</h2></div><p>Built around the team’s shared finding store and cited source documents.</p></div>
        <div className="landing-step-grid">
          <article><span className="step-number">01</span><div className="step-icon"><BookOpenText size={22} /></div><h3>Ask or browse</h3><p>Work from a question, obligation, issue, or reporting date. Each view leads back to the same evidence.</p></article>
          <article><span className="step-number">02</span><div className="step-icon"><Layers3 size={22} /></div><h3>Inspect the source</h3><p>Open the original PDF page or workbook reference. Conflicting statements stay side by side.</p></article>
          <article><span className="step-number">03</span><div className="step-icon"><ShieldCheck size={22} /></div><h3>Decide together</h3><p>Record a review action. The assistant flags uncertainty; staff make the final call.</p></article>
        </div>
      </section>

      <section className="landing-principle"><div><span className="landing-kicker">OUR PRINCIPLE</span><h2>Sources for truth.<br /><em>People for decisions.</em></h2></div><div className="principle-list"><p><Check size={18} /> Every finding needs a traceable citation.</p><p><Check size={18} /> Conflicts stay visible until a person resolves them.</p><p><Check size={18} /> Missing evidence is named, never filled in.</p></div></section>
      <section className="landing-final"><span className="landing-kicker">READY TO EXPLORE?</span><h2>See the source. See the question.<br />Make the next move.</h2><button className="hero-cta" type="button" onClick={onEnter}>Open GrantGuard <ArrowRight size={19} /></button></section>
    </main>
    <footer className="landing-footer"><span><BrandMark light /> GrantGuard</span><p>WaterAid Canada Challenge A6 · Synthetic Water Care case</p><span>Evidence first. Human reviewed.</span></footer>
  </div>
}
