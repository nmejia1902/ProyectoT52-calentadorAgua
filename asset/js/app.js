(() => {
  const state = {
    on: false, auto: true, sp: 55, t: 45, level: 60,
    fillOpen: false, drainOpen: false, heaterOn: false,
    alarmTh: 70, alarmHyst: 2, alarmActive: false, alarmLatched: false,
    alarmSoundOn: true, capacity: 400
  };

  const LIMITS = {
    UPPER: 95,   
    LOWER: 10    
  };

  const K = { dt: 0.5, fillRate: 0.06, drainRate: 0.07, heatRate: 0.06, coolRate: 0.008, inletTemp: 25, mixFactor: 0.015, hyst: 1.5 };

  const $ = (id) => document.getElementById(id);
  const els = {
    tankSize: $("tankSize"), headerMode: $("headerMode"), powerDot: $("powerDot"),
    powerText: $("powerText"), btnPower: $("btnPower"), btnFill: $("btnFill"),
    btnDrain: $("btnDrain"), btnMode: $("btnMode"), btnHeater: $("btnHeater"),
    setpoint: $("setpoint"), spVal: $("spVal"), waterFill: document.getElementById("waterFill"),
    coilGroup: document.getElementById("coilGroup"), autoLabel: document.getElementById("autoLabel"),
    tempVal: $("tempVal"), levelVal: $("levelVal"), valvesText: $("valvesText"),
    heaterText: $("heaterText"), alarmBar: $("alarmBar"), alarmTemp: $("alarmTemp"),
    alarmTh: $("alarmTh"), alarmThText: $("alarmThText"), alarmThVal: $("alarmThVal"),
    btnAck: $("btnAck"), btnMute: $("btnMute")
  };

  function updateTankParams(){
    const base = 400;
    const scale = base / state.capacity;
    K.fillRate = 0.06 * scale;
    K.drainRate = 0.07 * scale;
  }
  els.tankSize.addEventListener("change", e => { state.capacity = +e.target.value; updateTankParams(); });

  function clamp(v,a,b){return Math.max(a,Math.min(b,v));}
  function setPressed(b,v){b.setAttribute("aria-pressed",String(v));}
  function setDisabled(b,d){b.disabled=!!d;b.style.opacity=d?.6:1;}

  let audioCtx=null,beepOsc=null,beepGain=null,beepTimer=null;
  function initAudio(){if(audioCtx)return;audioCtx=new(window.AudioContext||window.webkitAudioContext)();beepOsc=audioCtx.createOscillator();beepGain=audioCtx.createGain();beepOsc.type="square";beepOsc.frequency.value=880;beepGain.gain.value=0;beepOsc.connect(beepGain).connect(audioCtx.destination);beepOsc.start();}
  function startBeep(){if(!state.alarmSoundOn)return;initAudio();stopBeep();beepTimer=setInterval(()=>{beepGain.gain.value=beepGain.gain.value===0?0.1:0;},300);}
  function stopBeep(){if(beepTimer){clearInterval(beepTimer);beepTimer=null;}if(beepGain)beepGain.gain.value=0;}

  function updateUI(){
    setPressed(els.btnPower,state.on);
    els.powerDot.className="state-dot "+(state.on?"dot-on":"dot-off");
    els.powerText.textContent=state.on?"Sistema encendido":"Sistema apagado";
    els.btnPower.textContent=state.on?"APAGAR":"ENCENDER";

    setPressed(els.btnFill,state.fillOpen);
    els.btnFill.textContent="Llenado: "+(state.fillOpen?"ABIERTO":"CERRADO");
    setPressed(els.btnDrain,state.drainOpen);
    els.btnDrain.textContent="Vaciado: "+(state.drainOpen?"ABIERTO":"CERRADO");
    
   
    let valvesStatus = "";
    if (state.fillOpen) valvesStatus += "Llenado ";
    if (state.drainOpen) valvesStatus += "Vaciado ";
    if (!valvesStatus) valvesStatus = "Válvulas cerradas";
    
  
    if (state.auto && state.drainOpen) {
      valvesStatus += " (AUTO)";
    }
    els.valvesText.textContent = valvesStatus;

    setPressed(els.btnMode,state.auto);
    els.btnMode.textContent=state.auto?"Modo automático":"Modo manual";
    els.headerMode.textContent=state.auto?"MODO AUTOMÁTICO":"MODO MANUAL";

    els.autoLabel.style.opacity=state.auto?1:0;
    setPressed(els.btnHeater,state.heaterOn);
    els.btnHeater.textContent="Resistencia: "+(state.heaterOn?"ENCENDIDA":"APAGADA");
    els.heaterText.innerHTML=`<span class="state-dot ${state.heaterOn?"dot-on":"dot-off"}"></span>Resistencia ${state.heaterOn?"encendida":"apagada"}`;
    setDisabled(els.btnHeater,state.auto);

   
    const waterHeight = clamp(180*(1-state.level/100)+60,60,240);
    els.waterFill.setAttribute("y",waterHeight);
    els.waterFill.setAttribute("height",240-waterHeight);

    if (state.level >= LIMITS.UPPER + 2 || state.level <= LIMITS.LOWER + 5) {
      els.waterFill.style.fill = "#F59E0B";
    } else {
      els.waterFill.style.fill = "url(#waterGrad)";
    }
    
    els.levelVal.textContent=state.level.toFixed(0);
    els.tempVal.textContent=state.t.toFixed(1);
    els.spVal.textContent=state.sp.toFixed(0);
    els.alarmThText.textContent=els.alarmThVal.textContent=state.alarmTh.toFixed(0);

    els.coilGroup.style.opacity=state.heaterOn?.9:.25;
    els.coilGroup.classList.toggle("glow",state.heaterOn);
    els.alarmTemp.textContent=state.t.toFixed(1);
    els.alarmBar.classList.toggle("show",state.alarmActive||state.alarmLatched);
  }

  function loop(){
    if(state.on){
      const dt=K.dt;
      
      if (state.auto) {

        if (state.level >= LIMITS.UPPER && !state.drainOpen) {
          state.drainOpen = true;
          state.fillOpen = false; 
        }
        
  
        if (state.level <= LIMITS.LOWER && state.drainOpen) {
          state.drainOpen = false;
        }

        if (state.level <= LIMITS.LOWER + 5 && !state.fillOpen && !state.drainOpen) {
          state.fillOpen = true;
        }
        
        if (state.level >= LIMITS.UPPER + 2 && state.fillOpen) {
          state.fillOpen = false;
        }
      }
      
      if(state.fillOpen&&!state.drainOpen)state.level+=K.fillRate*100*dt;
      else if(state.drainOpen&&!state.fillOpen)state.level-=K.drainRate*100*dt;
      
   
      state.level=clamp(state.level,0,100);


      const loss=(state.t-K.inletTemp)*K.coolRate*dt;
      if(state.heaterOn)state.t+=K.heatRate*dt;
      else state.t-=loss;

      if(state.level<5)state.t-=loss*3;

 
      if(state.auto){
        if(state.t<state.sp-K.hyst)state.heaterOn=true;
        else if(state.t>state.sp+K.hyst)state.heaterOn=false;
      }
      
      if(state.t>state.alarmTh){
        state.alarmActive=true;state.alarmLatched=true;state.heaterOn=false;startBeep();
      }
    }
    updateUI();
  }

  els.btnPower.onclick=()=>{state.on=!state.on;if(!state.on){Object.assign(state,{heaterOn:false,fillOpen:false,drainOpen:false,alarmActive:false});stopBeep();}updateUI();};
  els.btnFill.onclick=()=>{if(!state.on)return;if(state.drainOpen)return;state.fillOpen=!state.fillOpen;updateUI();};
  els.btnDrain.onclick=()=>{if(!state.on)return;if(state.fillOpen)return;state.drainOpen=!state.drainOpen;updateUI();};
  els.btnMode.onclick=()=>{state.auto=!state.auto;updateUI();};
  els.btnHeater.onclick=()=>{if(state.auto||!state.on)return;state.heaterOn=!state.heaterOn;updateUI();};
  els.setpoint.oninput=e=>{state.sp=+e.target.value;updateUI();};
  els.alarmTh.oninput=e=>{state.alarmTh=+e.target.value;updateUI();};
  els.btnAck.onclick=()=>{state.alarmActive=false;state.alarmLatched=false;stopBeep();updateUI();};
  els.btnMute.onclick=()=>{state.alarmSoundOn=!state.alarmSoundOn;setPressed(els.btnMute,!state.alarmSoundOn);els.btnMute.textContent=state.alarmSoundOn?"Silenciar":"Reactivar sonido";if(!state.alarmSoundOn)stopBeep();};
  
  updateTankParams();
  updateUI();
  setInterval(loop,K.dt*1000);
})();