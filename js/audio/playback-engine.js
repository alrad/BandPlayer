// Native HTMLMediaElement playback; deliberately does not use AudioContext.
export class PlaybackEngine {
  constructor(onTick, onEnd) {
    this.onTick=onTick; this.onEnd=onEnd; this.tracks=[]; this.duration=0;
    this.offset=0; this.playing=false; this.masterVolume=1; this.generation=0;
    this.timer=setInterval(()=>this.tick(),150);
  }
  async load(mp3s) {
    this.unload();
    const generation=this.generation;
    try {
      for (const item of mp3s) {
        const url=URL.createObjectURL(new Blob([item.bytes],{type:'audio/mpeg'}));
        const audio=new Audio(); audio.preload='auto'; audio.src=url;
        const track={name:item.name,audio,url,volume:1,muted:false,solo:false};
        this.tracks.push(track);
        audio.load();
      }
      await Promise.all(this.tracks.map(t=>this.waitForMetadata(t.audio)));
      if(generation!==this.generation) return;
      this.duration=Math.max(0,...this.tracks.map(t=>Number.isFinite(t.audio.duration)?t.audio.duration:0));
      this.offset=0; this.tick();
    } catch(e) { this.unload(); throw e; }
  }
  waitForMetadata(audio) {
    return new Promise((resolve,reject)=>{
      if(audio.readyState>=1) return resolve();
      const cleanup=()=>{audio.removeEventListener('loadedmetadata',ok);audio.removeEventListener('error',fail)};
      const ok=()=>{cleanup();resolve()};
      const fail=()=>{cleanup();reject(new Error(`MP3 metadata error (${audio.error?.code||'unknown'})`))};
      audio.addEventListener('loadedmetadata',ok); audio.addEventListener('error',fail);
    });
  }
  get position() {
    if(!this.playing) return this.offset;
    const times=this.tracks.filter(t=>!t.audio.paused && !t.audio.ended).map(t=>t.audio.currentTime);
    return times.length?Math.min(this.duration,Math.max(...times)):this.offset;
  }
  async play() {
    if(this.playing||!this.tracks.length)return;
    if(this.offset>=this.duration)this.offset=0;
    const generation=this.generation;
    for(const t of this.tracks) {
      if(Number.isFinite(t.audio.duration)) t.audio.currentTime=Math.min(this.offset,Math.max(0,t.audio.duration-.01));
      this.applyVolume(t);
    }
    // Invoke all play() calls synchronously within the same user gesture on iOS.
    const starts=this.tracks.map(t=>t.audio.play());
    const results=await Promise.allSettled(starts);
    if(generation!==this.generation)return;
    const failed=results.find(r=>r.status==='rejected');
    if(failed){this.tracks.forEach(t=>t.audio.pause());throw failed.reason;}
    this.playing=true;this.tick();
  }
  pause(){if(!this.playing)return;this.offset=this.position;this.tracks.forEach(t=>t.audio.pause());this.playing=false;this.tick()}
  stop(){this.tracks.forEach(t=>t.audio.pause());this.playing=false;this.offset=0;for(const t of this.tracks){try{t.audio.currentTime=0}catch{}}this.tick()}
  unload(){this.generation++;this.tracks.forEach(t=>{t.audio.pause();t.audio.removeAttribute('src');t.audio.load();URL.revokeObjectURL(t.url)});this.tracks=[];this.playing=false;this.offset=0;this.duration=0;this.tick()}
  seek(seconds){this.offset=Math.max(0,Math.min(Number(seconds)||0,this.duration));for(const t of this.tracks){try{t.audio.currentTime=Math.min(this.offset,Math.max(0,(Number.isFinite(t.audio.duration)?t.audio.duration:this.duration)-.01))}catch{}}this.tick()}
  applyVolume(t){t.audio.volume=Math.max(0,Math.min(1,t.volume*this.masterVolume));t.audio.muted=t.muted||(this.tracks.some(track=>track.solo)&&!t.solo)}
  setMasterVolume(v){this.masterVolume=Math.max(0,Math.min(1,v));this.tracks.forEach(t=>this.applyVolume(t))}
  setVolume(i,v){const t=this.tracks[i];if(!t)return;t.volume=Math.max(0,Math.min(1,v));this.applyVolume(t)}
  setMute(i,m){const t=this.tracks[i];if(!t)return;t.muted=!!m;this.applyVolume(t)}
  setSolo(i,value){const t=this.tracks[i];if(!t)return;t.solo=!!value;this.tracks.forEach(track=>this.applyVolume(track))}
  tick(){
    if(this.playing&&this.duration>0){
      const p=this.position;
      if(p>=this.duration-.12||this.tracks.every(t=>t.audio.ended)) {this.stop();this.onEnd?.();return;}
      // No automatic per-track seeking or playback-rate corrections.
      // Separate HTML audio elements free-run until explicit user seek.
    }
    this.onTick?.(this.position,this.duration,this.playing);
  }
}
