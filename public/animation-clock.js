export class NetworkAnimationClock {
  constructor(now=0,paused=false){this.last=now;this.now=now;this.paused=paused;}
  sample(now){const elapsed=Math.max(0,now-this.last);this.last=now;if(this.paused)return 0;this.now+=elapsed;return elapsed/1000;}
  setPaused(value,now){this.sample(now);this.paused=!!value;this.last=now;return this.paused;}
  resetFrame(now){this.last=now;}
}
