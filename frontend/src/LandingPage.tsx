import { ArrowRight, ArrowUpRight, BookOpenText, Check, FileText, Layers3, ShieldCheck } from 'lucide-react'
import { BrandMark } from './Brand'
import { APP_NAME } from './product'
import { ThemeToggle } from './components/ThemeToggle'
import type { Theme } from './theme'

type Props = { onEnter: () => void; theme: Theme; onToggleTheme: () => void }

// Fine contours inspired by the supplied wave reference. Vector paths stay sharp
// at every viewport size and inherit the selected theme without an image filter.
function WaveField() {
  return <svg className="hero-wave-field" viewBox="0 0 1440 260" preserveAspectRatio="none" aria-hidden="true">
    {Array.from({ length: 32 }, (_, index) => {
      const t = index / 31
      return <path key={index} d={`M-40 ${170 + t * 65} C150 ${170 - t * 180} 235 ${30 + t * 260} 420 ${110 + t * 70} S620 ${240 - t * 340} 760 ${115 + t * 40} S1040 ${15 + t * 245} 1180 ${110 - t * 30} S1370 ${180 - t * 190} 1480 ${105 + t * 55}`} />
    })}
  </svg>
}

export function LandingPage({ onEnter, theme, onToggleTheme }: Props) {
  return <div className="landing">
    <header className="landing-header">
      <a className="landing-brand" href="#top" aria-label={`${APP_NAME} home`}><BrandMark /><span>{APP_NAME}</span><small>ALPHA</small></a>
      <nav aria-label="Landing navigation"><a href="#how-it-works">How it works</a><a href="#workspace-preview">Workspace</a></nav>
      <div className="landing-header-actions"><ThemeToggle theme={theme} onToggle={onToggleTheme} /><button className="landing-header-cta" type="button" onClick={onEnter}>Explore projects <ArrowUpRight size={16} /></button></div>
    </header>

    <main id="top">
      <section className="landing-hero">
        <WaveField />
        <div className="hero-content">
          <div className="hero-eyebrow"><span /> AI-POWERED COMPLIANCE MONITORING</div>
          <h1>Monitor your compliance<br /><em>with confidence.</em></h1>
          <p>Bring grant requirements, source documents, and review decisions into one clear workspace. Know what needs attention—and the evidence behind it.</p>
          <div className="hero-actions"><button className="hero-cta" type="button" onClick={onEnter}>Explore projects <ArrowRight size={17} /></button><a className="hero-secondary" href="#workspace-preview">See the workspace <ArrowUpRight size={16} /></a></div>
          <span className="hero-note">Built for grant teams. Guided by evidence.</span>
        </div>
      </section>

      <section className="landing-preview-section" id="workspace-preview" aria-labelledby="preview-heading">
        <div className="landing-section-heading"><div><span className="landing-kicker">THE WORKSPACE</span><h2 id="preview-heading">A clearer path from<br />document to decision.</h2></div><p>Start with a question. Open the relevant source. Keep the human decision visible.</p></div>
        <div className="preview-stage">
          <div className="preview-window">
            <div className="preview-window-top"><span><BrandMark /> {APP_NAME}</span><span className="preview-window-dots"><i /><i /><i /></span></div>
            <div className="preview-window-body">
              <div className="preview-mini-nav"><strong>Taps for Rights</strong><span>Overview</span><span className="active">Evidence workspace</span><span>Issues</span><span>Obligations</span><span>Review history</span></div>
              <div className="preview-document">
                <div className="preview-document-toolbar"><span><FileText size={14} /> Contribution agreement</span><small>Original source</small></div>
                <div className="preview-document-canvas"><div className="preview-document-paper"><span>WATER CARE / TAPS FOR RIGHTS</span><h3>Contribution<br />Agreement</h3><div className="preview-paper-rule" /><p>Read the original.<br />Keep the context.</p><div className="preview-paper-lines" aria-hidden="true"><i /><i /><i /><i /><i /><i /></div><small>Document view · illustrative preview</small></div></div>
              </div>
              <div className="preview-assistant"><span className="preview-assistant-label"><BookOpenText size={15} /> Ask the documents</span><h3>A question.<br />A source.<br />A clearer next step.</h3><p>Investigate requirements while keeping the original document in view.</p><div className="preview-question">When is the final report due?<ArrowUpRight size={15} /></div><small>Every answer needs evidence.<br />Every decision stays with you.</small></div>
            </div>
          </div>
        </div>
      </section>

      <section className="landing-steps" id="how-it-works" aria-labelledby="steps-heading">
        <div className="landing-section-heading"><div><span className="landing-kicker">HOW IT WORKS</span><h2 id="steps-heading">Three steps. One source<br />of truth.</h2></div><p>From the first question to the final review, keep your team connected to the evidence.</p></div>
        <div className="landing-step-grid">
          <article><span className="step-number">01</span><div className="step-icon"><BookOpenText size={22} /></div><h3>Ask or browse</h3><p>Work from a question, obligation, issue, or reporting date. Each view leads back to the same evidence.</p></article>
          <article><span className="step-number">02</span><div className="step-icon"><Layers3 size={22} /></div><h3>Inspect the source</h3><p>Open the original PDF page or workbook reference. Conflicting statements stay side by side.</p></article>
          <article><span className="step-number">03</span><div className="step-icon"><ShieldCheck size={22} /></div><h3>Decide together</h3><p>Record a review action. The assistant flags uncertainty; staff make the final call.</p></article>
        </div>
      </section>

      <section className="landing-principle"><div><span className="landing-kicker">OUR PRINCIPLE</span><h2>Sources for truth.<br /><em>People for decisions.</em></h2></div><div className="principle-list"><p><Check size={18} /> Every finding needs a traceable citation.</p><p><Check size={18} /> Conflicts stay visible until a person resolves them.</p><p><Check size={18} /> Missing evidence is named, never filled in.</p></div></section>
      <section className="landing-final"><span className="landing-kicker">YOUR NEXT STEP</span><h2>Less searching.<br />More clarity.</h2><button className="hero-cta" type="button" onClick={onEnter}>Open {APP_NAME} <ArrowRight size={19} /></button></section>
    </main>
    <footer className="landing-footer"><span><BrandMark /> {APP_NAME}</span><p>WaterAid Canada Challenge A6 · Synthetic Water Care case</p><span>Evidence first. Human reviewed.</span></footer>
  </div>
}
