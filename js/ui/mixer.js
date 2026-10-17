// Mixer controls affect volume/muting only; playback timing is untouched.
export function renderMixer(container,engine){
  container.replaceChildren();
  engine.tracks.forEach((t,i)=>{
    const row=document.createElement('div');row.className='track';
    const name=document.createElement('strong');name.textContent=t.name;
    const mute=document.createElement('button');mute.type='button';
    const solo=document.createElement('button');solo.type='button';solo.className='solo-button';
    const refresh=()=>{
      mute.textContent=t.muted?'Unmute':'Mute';mute.classList.toggle('muted',t.muted);mute.setAttribute('aria-pressed',String(t.muted));
      solo.textContent='Solo';solo.classList.toggle('solo-active',t.solo);solo.setAttribute('aria-pressed',String(t.solo));
    };
    mute.onclick=()=>{engine.setMute(i,!t.muted);refresh()};
    solo.onclick=()=>{engine.setSolo(i,!t.solo);refresh()};
    const slider=document.createElement('input');slider.type='range';slider.min='0';slider.max='100';slider.value='100';slider.setAttribute('aria-label',`${t.name} volume`);
    const out=document.createElement('output');out.textContent='100%';
    slider.oninput=()=>{engine.setVolume(i,Number(slider.value)/100);out.textContent=`${slider.value}%`};
    refresh();row.append(name,mute,solo,slider,out);container.append(row);
  });
}
