import {loadMkv} from './audio/mkv-loader.js';
import {PlaybackEngine} from './audio/playback-engine.js';
import {renderMixer} from './ui/mixer.js';
const file=document.querySelector('#file'),status=document.querySelector('#status'),transport=document.querySelector('#transport'),play=document.querySelector('#play'),stop=document.querySelector('#stop'),masterVolume=document.querySelector('#master-volume'),masterVolumeValue=document.querySelector('#master-volume-value'),seek=document.querySelector('#seek'),clock=document.querySelector('#clock');
const audioState=document.querySelector('#audio-state');
const testHtmlAudio=document.querySelector('#test-html-audio');
// Generate a self-contained PCM WAV beep to test iOS's native HTML audio path.
function makeBeepWav(){
  const sampleRate=22050,seconds=0.8,count=Math.floor(sampleRate*seconds);
  const bytes=new ArrayBuffer(44+count*2),view=new DataView(bytes);
  const str=(offset,text)=>{for(let i=0;i<text.length;i++)view.setUint8(offset+i,text.charCodeAt(i))};
  str(0,'RIFF');view.setUint32(4,36+count*2,true);str(8,'WAVE');str(12,'fmt ');
  view.setUint32(16,16,true);view.setUint16(20,1,true);view.setUint16(22,1,true);
  view.setUint32(24,sampleRate,true);view.setUint32(28,sampleRate*2,true);
  view.setUint16(32,2,true);view.setUint16(34,16,true);
  str(36,'data');view.setUint32(40,count*2,true);
  for(let i=0;i<count;i++){
    const fade=Math.min(1,i/(sampleRate*.025),(count-i-1)/(sampleRate*.04));
    const sample=Math.sin(2*Math.PI*660*i/sampleRate)*0.5*Math.max(0,fade);
    view.setInt16(44+i*2,Math.round(sample*32767),true);
  }
  return new Blob([bytes],{type:'audio/wav'});
}
let htmlAudio;
testHtmlAudio.onclick=()=>{
  try{
    if(htmlAudio){htmlAudio.pause();htmlAudio.src='';htmlAudio=null}
    const url=URL.createObjectURL(makeBeepWav());
    const audio=new Audio();htmlAudio=audio;
    audio.setAttribute('playsinline','');audio.volume=1;audio.src=url;
    audio.onended=()=>{audioState.textContent='HTML Audio: finished · Did you hear a beep?';URL.revokeObjectURL(url)};
    audio.onerror=()=>{audioState.textContent=`HTML Audio error: ${audio.error?.message||audio.error?.code||'unknown'}`;URL.revokeObjectURL(url)};
    audioState.textContent='HTML Audio: starting…';
    const result=audio.play();
    if(result?.then)result.then(()=>{audioState.textContent='HTML Audio: playing · Did you hear a beep?'}).catch(e=>{audioState.textContent=`HTML Audio error: ${e.message}`;URL.revokeObjectURL(url)});
  }catch(e){audioState.textContent=`HTML Audio error: ${e.message}`}
};

const fmt=t=>`${Math.floor(t/60)}:${String(Math.floor(t%60)).padStart(2,'0')}`;
const engine=new PlaybackEngine((p,d,playing)=>{if(document.activeElement!==seek)seek.value=d?Math.round(p/d*1000):0;clock.textContent=`${fmt(p)} / ${fmt(d)}`;play.textContent=playing?'Pause':'Play'},()=>{play.textContent='Play'});
audioState.textContent='Playback: native HTML Audio';
file.addEventListener('change',async()=>{const chosen=file.files?.[0];if(!chosen)return;play.disabled=true;stop.disabled=true;transport.hidden=true;engine.unload();status.textContent=`Opening ${chosen.name}…`;try{const stems=await loadMkv(chosen,s=>status.textContent=s);status.textContent=`Preparing ${stems.length} HTML Audio tracks…`;await engine.load(stems);renderMixer(document.querySelector('#tracks'),engine);transport.hidden=false;play.disabled=false;stop.disabled=false;status.textContent=`Ready: ${chosen.name} · ${stems.length} instruments`; }catch(e){console.error(e);status.textContent=`Could not open MKV: ${e.message}`}});
play.onclick=async()=>{if(engine.playing)engine.pause();else {try{await engine.play()}catch(e){audioState.textContent=`Audio error: ${e.message}`;console.error(e)}}};seek.oninput=()=>engine.seek(Number(seek.value)/1000*engine.duration);

stop.onclick=()=>{engine.stop();engine.tick()};
masterVolume.oninput=()=>{engine.setMasterVolume(Number(masterVolume.value)/100);masterVolumeValue.textContent=`${masterVolume.value}%`};
