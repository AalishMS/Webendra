/* One very large vehicle. No timetable. */
class TempoTransition {
  constructor() {
    this.layer = document.createElement('div');
    this.layer.className = 'tempo-stage';
    this.layer.setAttribute('aria-hidden', 'true');
    this.layer.hidden = true;
    this.layer.innerHTML = `<div class="tempo-vehicle">
      <svg viewBox="0 0 960 660" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="tempo-green" x2="0" y2="1"><stop stop-color="#258753"/><stop offset="1" stop-color="#0b5138"/></linearGradient>
          <linearGradient id="tempo-yellow" x2="0" y2="1"><stop stop-color="#ffd957"/><stop offset="1" stop-color="#e7a919"/></linearGradient>
        </defs>
        <g class="tempo-exhaust" fill="#bcbcbc">
          <ellipse cx="105" cy="555" rx="24" ry="16"/>
          <ellipse cx="66" cy="541" rx="30" ry="23"/>
          <ellipse cx="22" cy="522" rx="34" ry="29"/>
        </g>
        <ellipse cx="496" cy="615" rx="413" ry="17" fill="#000" opacity=".10"/>
        <g class="tempo-body" stroke="#182b25" stroke-width="7" stroke-linejoin="round">
          <!-- Closed rear canvas gives the wipe an unbroken trailing edge. -->
          <path d="M142 479V150Q144 83 219 80H597Q649 85 684 143L749 289 764 483Z" fill="#202824"/>
          <path d="M141 151Q139 82 218 80H597Q637 82 666 120L682 159H146" fill="url(#tempo-yellow)"/>
          <path d="M168 177H434V391H164Z" fill="#303a31"/>
          <path d="M187 186V365M211 181V370M407 178V370" stroke="#58604d" stroke-width="3"/>
          <path d="M456 168H581V395H457Z" fill="#dee6d8"/>
          <path d="M461 323H529Q549 326 549 352V400H461" fill="#382e26"/>
          <path d="M590 167H637L701 306H590Z" fill="#c5dedd"/>
          <path d="M607 176L661 290" stroke="#fff" stroke-width="12" opacity=".55"/>
          <!-- A driver who has done this route before. -->
          <path d="M563 371L578 282Q594 258 618 283L648 331 680 334" fill="none" stroke="#e7d9b9" stroke-width="27" stroke-linecap="round"/>
          <path d="M563 371L603 373 629 417" fill="none" stroke="#514434" stroke-width="28" stroke-linecap="round"/>
          <ellipse cx="597" cy="242" rx="23" ry="29" fill="#a87451"/>
          <path d="M573 236Q568 204 600 208L617 223" fill="#242523"/>
          <path d="M604 245H619" stroke-width="5"/>
          <path d="M672 323L701 306M685 316L701 361" fill="none"/>
          <path d="M140 389H582L616 423H726L749 289Q779 299 798 353L850 463V547H140Z" fill="url(#tempo-green)"/>
          <path d="M145 396H576L613 431H808" fill="none" stroke="#f8c635" stroke-width="13"/>
          <path d="M443 166V485M582 169V397M164 457H414" fill="none" stroke="#152f26"/>
          <path d="M456 451H595V491H456Z" fill="#133c2d"/>
          <path d="M466 494H619" stroke="#9baba3" stroke-width="12"/>
          <path d="M724 291L764 407" stroke="#f8cd46" stroke-width="18"/>
          <path d="M760 300L770 253 793 248" fill="none" stroke-width="8"/>
          <ellipse cx="800" cy="245" rx="18" ry="26" fill="#263c33"/>
          <path d="M817 407L837 433 838 466H812Z" fill="#fff2c1"/>
          <path d="M140 451H157V490H140" fill="#c8472f"/>
          <path d="M137 534H849" stroke="#202723" stroke-width="22"/>
          <path d="M142 549H111" stroke="#5c635c" stroke-width="13"/>
          <path d="M208 548A75 75 0 0 1 358 548M724 548A70 70 0 0 1 864 548" fill="#162c22"/>
          <path d="M171 413V434M184 413V434M197 413V434M210 413V434" stroke-width="4"/>
          <path d="M847 508H878V542H850" fill="#929c94"/>
        </g>
        ${[283, 794].map(x => `<g class="tempo-wheel" style="transform-origin:${x}px 552px" stroke="#202321">
          <circle cx="${x}" cy="552" r="62" fill="#242625" stroke-width="8"/>
          <circle cx="${x}" cy="552" r="37" fill="#adb2a7" stroke-width="6"/>
          <path d="M${x} 520V584M${x-32} 552H${x+32}M${x-23} 529L${x+23} 575M${x+23} 529L${x-23} 575" stroke-width="5"/>
          <circle cx="${x}" cy="552" r="11" fill="#626c62" stroke-width="4"/>
        </g>`).join('')}
      </svg>
    </div>`;
    document.body.append(this.layer);
    this.vehicle = this.layer.firstElementChild;
    this.muted = false;
    this.soundButton = document.createElement('button');
    this.soundButton.className = 'tempo-sound';
    this.soundButton.type = 'button';
    this.soundButton.innerHTML = '<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path d="M4 9H8L13 5V19L8 15H4Z"/><path class="sound-waves" d="M16 8Q20 12 16 16M19 5Q25 12 19 19" fill="none"/></svg>';
    this.soundButton.addEventListener('click', () => {
      this.muted = !this.muted;
      this.updateSoundButton();
      if (this.muted) this.stopSound?.();
    });
    this.updateSoundButton();
    document.body.append(this.soundButton);
  }

  updateSoundButton() {
    this.soundButton.setAttribute('aria-label', this.muted ? 'Unmute Tempo sounds' : 'Mute Tempo sounds');
    this.soundButton.setAttribute('aria-pressed', String(this.muted));
    this.soundButton.title = this.muted ? 'Unmute Tempo sounds' : 'Mute Tempo sounds';
  }

  unlockAudio() {
    if (this.muted) return;
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      this.audio ||= new AudioContext();
      this.audio.resume().catch(() => {});
    } catch { /* Navigation still works without Web Audio. */ }
  }

  startSound(duration) {
    const ctx = this.audio;
    if (this.muted || !ctx || ctx.state !== 'running') return;
    const t = ctx.currentTime;
    const seconds = duration / 1000;
    const master = ctx.createGain();
    master.gain.setValueAtTime(0, t);
    master.gain.linearRampToValueAtTime(.22, t + .4);
    master.gain.setValueAtTime(.22, t + seconds - .7);
    master.gain.linearRampToValueAtTime(0, t + seconds);
    master.connect(ctx.destination);
    const nodes = [];
    const engine = ctx.createOscillator();
    engine.type = 'sawtooth';
    engine.frequency.setValueAtTime(47, t);
    engine.frequency.linearRampToValueAtTime(63, t + seconds * .7);
    engine.frequency.linearRampToValueAtTime(43, t + seconds);
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 420;
    const pulse = ctx.createGain();
    pulse.gain.value = .48;
    const chug = ctx.createOscillator();
    chug.frequency.value = 11;
    const depth = ctx.createGain();
    depth.gain.value = .36;
    chug.connect(depth).connect(pulse.gain);
    engine.connect(filter).connect(pulse).connect(master);
    nodes.push(engine, chug);
    // Two short, nasal honks from a vehicle with considerable self-belief.
    for (const offset of [1.05, 1.29]) {
      for (const frequency of [370, 493]) {
        const horn = ctx.createOscillator();
        horn.type = 'square';
        horn.frequency.value = frequency;
        const envelope = ctx.createGain();
        envelope.gain.setValueAtTime(0, t);
        envelope.gain.setValueAtTime(0, t + offset);
        envelope.gain.linearRampToValueAtTime(.09, t + offset + .015);
        envelope.gain.exponentialRampToValueAtTime(.001, t + offset + .18);
        horn.connect(envelope).connect(master);
        nodes.push(horn);
      }
    }
    nodes.forEach(node => { node.start(t); node.stop(t + seconds); });
    const stop = () => {
      master.gain.cancelScheduledValues(ctx.currentTime);
      master.gain.setTargetAtTime(0, ctx.currentTime, .015);
      nodes.forEach(node => { try { node.stop(ctx.currentTime + .08); } catch {} });
      setTimeout(() => master.disconnect(), 120);
      this.stopSound = null;
    };
    this.stopSound = stop;
    engine.onended = () => master.disconnect();
  }

  run(reveal, reducedMotion) {
    const duration = 4300;
    this.layer.hidden = false;
    this.startSound(duration);
    return new Promise(resolve => {
      let start;
      const finish = () => {
        cancelAnimationFrame(this.frame);
        this.layer.hidden = true;
        this.stopSound?.();
        this.finish = null;
        reveal(Infinity);
        resolve();
      };
      this.finish = finish;
      const tick = now => {
        start ??= now;
        const progress = Math.min((now - start) / duration, 1);
        if (progress === 1 || reducedMotion.matches || document.hidden) return finish();
        const width = this.vehicle.getBoundingClientRect().width;
        const x = -width + progress * (window.innerWidth + width);
        this.vehicle.style.transform = `translate3d(${x}px, 0, 0)`;
        // The canvas rear is at x=142 in the 960-unit drawing.
        reveal(x + width * 142 / 960);
        this.frame = requestAnimationFrame(tick);
      };
      this.frame = requestAnimationFrame(tick);
    });
  }
}
