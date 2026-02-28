import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Camera, Save, Square, Upload, Wifi, WifiOff, Eye, Layers, RefreshCw, Server, Cpu } from 'lucide-react';

const DEFAULT_API = 'http://172.31.10.70:5000';

const FogRemovalSystem = () => {
  const [isProcessing, setIsProcessing]   = useState(false);
  const [status, setStatus]               = useState('Connecting...');
  const [modelLoaded, setModelLoaded]     = useState(false);
  const [apiConnected, setApiConnected]   = useState(false);
  const [apiInfo, setApiInfo]             = useState(null);
  const [fps, setFps]                     = useState(0);
  const [backendFps, setBackendFps]       = useState(0);
  const [showApiPanel, setShowApiPanel]   = useState(false);
  const [latency, setLatency]             = useState(null);

  const videoRef      = useRef(null);
  const canvasRef     = useRef(null);
  const displayRef    = useRef(null);
  const streamRef     = useRef(null);
  const animRef       = useRef(null);
  const fileInputRef  = useRef(null);
  const processingRef = useRef(false);
  const fpsRef        = useRef({ count: 0, last: Date.now() });
  const bFpsRef       = useRef({ count: 0, last: Date.now() });
  const inFlightRef   = useRef(false);
  const lastSentRef   = useRef(0);
  const latestRef     = useRef({ img: null, at: 0 });
  const THROTTLE_MS   = 150;

  const [apiBase, setApiBase] = useState(() => {
    try { return localStorage.getItem('fogApiBase') || DEFAULT_API; } catch { return DEFAULT_API; }
  });
  const apiBaseRef = useRef(apiBase);
  useEffect(() => { apiBaseRef.current = apiBase; }, [apiBase]);

  const pingBackend = useCallback(async (base) => {
    const url = base || apiBaseRef.current;
    try {
      const t0  = Date.now();
      const res = await fetch(`${url}/`, { method: 'GET', signal: AbortSignal.timeout(3000) });
      const ms  = Date.now() - t0;
      const json = await res.json();
      setApiConnected(true);
      setLatency(ms);
      setApiInfo({ modelLoaded: json.model_loaded, modelPath: json.model_path });
      setModelLoaded(true);
      setStatus(json.model_loaded ? 'Ready' : 'Model not loaded on server');
      return true;
    } catch {
      setApiConnected(false);
      setLatency(null);
      setApiInfo(null);
      setModelLoaded(false);
      setStatus('Backend unreachable');
      return false;
    }
  }, []);

  useEffect(() => {
    pingBackend();
    const id = setInterval(() => { if (!processingRef.current) pingBackend(); }, 5000);
    return () => {
      clearInterval(id);
      if (animRef.current) cancelAnimationFrame(animRef.current);
      if (streamRef.current) streamRef.current.getTracks().forEach(t => t.stop());
    };
  }, [pingBackend]);

  const renderLoop = useCallback(async () => {
    if (!processingRef.current || !videoRef.current) return;
    const video  = videoRef.current;
    const canvas = canvasRef.current;
    if (!canvas || !video.videoWidth) { animRef.current = requestAnimationFrame(renderLoop); return; }
    const ctx    = canvas.getContext('2d');
    const holder = displayRef.current;

    if (holder && (canvas.width !== holder.clientWidth || canvas.height !== holder.clientHeight)) {
      canvas.width = holder.clientWidth; canvas.height = holder.clientHeight;
    }

    const now   = Date.now();
    const fresh = latestRef.current.img && now - latestRef.current.at < 800;
    const src   = fresh ? latestRef.current.img : video;
    const srcW  = src.videoWidth  || src.naturalWidth  || src.width;
    const srcH  = src.videoHeight || src.naturalHeight || src.height;

    if (srcW && srcH) {
      const scale = Math.max(canvas.width / srcW, canvas.height / srcH);
      const dW    = Math.ceil(srcW * scale), dH = Math.ceil(srcH * scale);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(src, Math.floor((canvas.width - dW) / 2), Math.floor((canvas.height - dH) / 2), dW, dH);
    }

    fpsRef.current.count++;
    if (now - fpsRef.current.last >= 1000) { setFps(fpsRef.current.count); fpsRef.current = { count: 0, last: now }; }

    if (!inFlightRef.current && now - lastSentRef.current >= THROTTLE_MS) {
      inFlightRef.current = true; lastSentRef.current = now;
      const tmp = document.createElement('canvas');
      tmp.width  = 320;
      tmp.height = Math.round((video.videoHeight / video.videoWidth) * 320);
      tmp.getContext('2d').drawImage(video, 0, 0, tmp.width, tmp.height);
      const dataUrl  = tmp.toDataURL('image/jpeg', 0.75);
      const sendAt   = Date.now();
      fetch(`${apiBaseRef.current}/process_frame`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ frame: dataUrl })
      })
        .then(r => r.json())
        .then(json => {
          if (json && json.frame) {
            setApiConnected(true);
            setLatency(Date.now() - sendAt);
            bFpsRef.current.count++;
            if (Date.now() - bFpsRef.current.last >= 1000) {
              setBackendFps(bFpsRef.current.count);
              bFpsRef.current = { count: 0, last: Date.now() };
            }
            const img = new Image();
            img.onload = () => { latestRef.current = { img, at: Date.now() }; };
            img.src = json.frame;
          }
        })
        .catch(() => setApiConnected(false))
        .finally(() => { inFlightRef.current = false; });
    }
    animRef.current = requestAnimationFrame(renderLoop);
  }, []);

  const startCamera = async () => {
    if (!modelLoaded) { setStatus('Backend not ready'); return; }
    try {
      setStatus('Starting camera...');
      const stream = await navigator.mediaDevices.getUserMedia({ video: { width: { ideal: 1280 }, height: { ideal: 720 } } });
      videoRef.current.srcObject = stream;
      videoRef.current.play().catch(() => {});
      streamRef.current = stream;
      setIsProcessing(true); processingRef.current = true;
      setStatus('Live');
      latestRef.current = { img: null, at: 0 };
      const go = () => {
        if (videoRef.current?.videoWidth > 0) {
          const c = canvasRef.current, h = displayRef.current;
          if (c && h) { c.width = h.clientWidth; c.height = h.clientHeight; }
          renderLoop();
        }
      };
      videoRef.current.onloadedmetadata = go;
      videoRef.current.oncanplay        = go;
      videoRef.current.onplaying        = go;
    } catch { setStatus('Camera access denied'); }
  };

  const stopCamera = () => {
    if (animRef.current) cancelAnimationFrame(animRef.current);
    if (streamRef.current) { streamRef.current.getTracks().forEach(t => t.stop()); streamRef.current = null; }
    if (videoRef.current) { videoRef.current.srcObject = null; videoRef.current.src = ''; }
    latestRef.current = { img: null, at: 0 };
    setIsProcessing(false); processingRef.current = false;
    setFps(0); setBackendFps(0); setStatus('Stopped');
  };

  const handleFileChange = (e) => {
    const file = e.target.files?.[0]; if (!file) return;
    if (streamRef.current) { streamRef.current.getTracks().forEach(t => t.stop()); streamRef.current = null; }
    videoRef.current.srcObject = null;
    videoRef.current.src = URL.createObjectURL(file);
    videoRef.current.loop = true;
    videoRef.current.play().catch(() => {});
    setIsProcessing(true); processingRef.current = true;
    setStatus('Processing video');
    latestRef.current = { img: null, at: 0 };
    videoRef.current.onloadedmetadata = () => renderLoop();
  };

  const saveFrame = () => {
    canvasRef.current?.toBlob(blob => {
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob); a.download = `defogged-${Date.now()}.png`; a.click();
      setStatus('Saved ✓'); setTimeout(() => setStatus(isProcessing ? 'Live' : 'Ready'), 2000);
    });
  };

  const saveApiConfig = () => {
    try { localStorage.setItem('fogApiBase', apiBase); } catch {}
    pingBackend(apiBase);
  };

  const statusColor =
    status === 'Live'  ? '#00ff88' : status === 'Ready' ? '#00d4ff' :
    (status.includes('Error') || status === 'Stopped' || status.includes('denied') || status.includes('unreachable')) ? '#ff4060' : '#f0c040';

  return (
    <div style={{ minHeight: '100vh', background: '#080c12', fontFamily: "'JetBrains Mono','Fira Code',monospace", color: '#c8d8e8' }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@300;400;600;700&family=Barlow+Condensed:wght@300;400;600;700&display=swap');
        *{box-sizing:border-box;margin:0;padding:0}
        :root{--cyan:#00d4ff;--green:#00ff88;--amber:#f0c040;--red:#ff4060;--bg0:#080c12;--bg1:#0d1420;--bg2:#111b2a;--border:rgba(0,212,255,.15);--text:#c8d8e8;--text-dim:#5a7a9a}
        .panel{background:var(--bg1);border:1px solid var(--border);border-radius:4px;position:relative;overflow:hidden}
        .panel::before{content:'';position:absolute;top:0;left:0;right:0;height:1px;background:linear-gradient(90deg,transparent,var(--cyan),transparent);opacity:.5}
        .btn{display:inline-flex;align-items:center;gap:8px;padding:10px 20px;border:1px solid;border-radius:3px;font-family:inherit;font-size:11px;font-weight:600;letter-spacing:.08em;text-transform:uppercase;cursor:pointer;transition:all .15s;background:transparent;position:relative;overflow:hidden}
        .btn::after{content:'';position:absolute;inset:0;background:currentColor;opacity:0;transition:opacity .15s}
        .btn:hover::after{opacity:.08}.btn:active::after{opacity:.15}
        .btn-start{color:var(--green);border-color:rgba(0,255,136,.4)}.btn-start:hover{border-color:var(--green);box-shadow:0 0 16px rgba(0,255,136,.2)}
        .btn-stop{color:var(--red);border-color:rgba(255,64,96,.4)}.btn-stop:hover{border-color:var(--red);box-shadow:0 0 16px rgba(255,64,96,.2)}
        .btn-load{color:var(--cyan);border-color:rgba(0,212,255,.4)}.btn-load:hover{border-color:var(--cyan);box-shadow:0 0 16px rgba(0,212,255,.2)}
        .btn-save{color:var(--amber);border-color:rgba(240,192,64,.4)}.btn-save:hover{border-color:var(--amber);box-shadow:0 0 16px rgba(240,192,64,.2)}
        .btn-dim{color:var(--text-dim);border-color:var(--border)}.btn-dim:hover{border-color:var(--text-dim)}
        .btn:disabled{opacity:.2;cursor:not-allowed;pointer-events:none}
        .metric{display:flex;flex-direction:column;gap:2px;padding:12px 20px;border-right:1px solid var(--border)}
        .metric:last-child{border-right:none}
        .metric-label{font-size:9px;letter-spacing:.12em;text-transform:uppercase;color:var(--text-dim)}
        .metric-value{font-size:20px;font-weight:700;font-family:'Barlow Condensed',sans-serif;letter-spacing:.02em}
        .label-tag{font-size:9px;letter-spacing:.14em;text-transform:uppercase;color:var(--text-dim);padding:3px 8px;border:1px solid var(--border);border-radius:2px}
        .api-input{background:var(--bg0);border:1px solid var(--border);border-radius:3px;color:var(--text);font-family:inherit;font-size:11px;padding:8px 12px;width:100%;outline:none;transition:border-color .15s}
        .api-input:focus{border-color:var(--cyan)}
        .scanline{position:absolute;inset:0;background:repeating-linear-gradient(0deg,transparent,transparent 2px,rgba(0,0,0,.04) 2px,rgba(0,0,0,.04) 4px);pointer-events:none;z-index:2}
        .corner{position:absolute;width:16px;height:16px;border-color:var(--cyan);border-style:solid;opacity:.5}
        .corner-tl{top:10px;left:10px;border-width:2px 0 0 2px}
        .corner-tr{top:10px;right:10px;border-width:2px 2px 0 0}
        .corner-bl{bottom:10px;left:10px;border-width:0 0 2px 2px}
        .corner-br{bottom:10px;right:10px;border-width:0 2px 2px 0}
        .pulse{animation:pulse 1.8s ease-in-out infinite}
        @keyframes pulse{0%,100%{opacity:1}50%{opacity:.4}}
        .blink{animation:blink 1s step-end infinite}
        @keyframes blink{0%,100%{opacity:1}50%{opacity:0}}
        .fade-in{animation:fadeIn .2s ease}
        @keyframes fadeIn{from{opacity:0;transform:translateY(-4px)}to{opacity:1;transform:translateY(0)}}
        .glow-cyan{text-shadow:0 0 24px rgba(0,212,255,.5)}
        .badge{display:flex;align-items:center;gap:6px;padding:4px 10px;border:1px solid var(--border);border-radius:3px;font-size:10px;letter-spacing:.06em}
      `}</style>

      {/* HEADER */}
      <header style={{ borderBottom: '1px solid var(--border)', padding: '0 32px' }}>
        <div style={{ maxWidth: 1440, margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: 60 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <Eye size={18} color="var(--cyan)" />
            <span className="glow-cyan" style={{ fontFamily: "'Barlow Condensed',sans-serif", fontSize: 22, fontWeight: 700, letterSpacing: '.06em', color: '#fff' }}>
              DEFOG<span style={{ color: 'var(--cyan)' }}>AI</span>
            </span>
            <span className="label-tag">Flask Backend</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <div className="badge" style={{ borderColor: apiConnected ? 'rgba(0,255,136,.3)' : 'rgba(255,64,96,.25)' }}>
              <Server size={12} color={apiConnected ? 'var(--green)' : 'var(--red)'} />
              <span style={{ color: apiConnected ? 'var(--green)' : 'var(--red)' }}>{apiConnected ? 'BACKEND ONLINE' : 'BACKEND OFFLINE'}</span>
              {latency && apiConnected && <span style={{ color: 'var(--text-dim)' }}>{latency}ms</span>}
            </div>
            {apiInfo && (
              <div className="badge">
                <Cpu size={12} color={apiInfo.modelLoaded ? 'var(--cyan)' : 'var(--amber)'} />
                <span style={{ color: apiInfo.modelLoaded ? 'var(--cyan)' : 'var(--amber)' }}>{apiInfo.modelLoaded ? 'MODEL LOADED' : 'MODEL MISSING'}</span>
              </div>
            )}
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 600 }}>
              <span className={isProcessing ? 'pulse' : ''} style={{ width: 8, height: 8, borderRadius: '50%', background: statusColor, display: 'inline-block' }} />
              <span style={{ color: statusColor }}>{status.toUpperCase()}</span>
            </div>
          </div>
        </div>
      </header>

      {/* BODY */}
      <div style={{ maxWidth: 1440, margin: '0 auto', padding: '20px 32px', display: 'flex', flexDirection: 'column', gap: 16 }}>

        {/* Controls + Metrics */}
        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'stretch' }}>
          <div className="panel" style={{ padding: '16px 20px', display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', flex: 1 }}>
            <span className="label-tag" style={{ marginRight: 6 }}><Layers size={9} style={{ display: 'inline', marginRight: 4 }} />Controls</span>
            <button className="btn btn-start" onClick={startCamera} disabled={isProcessing || !modelLoaded}><Camera size={13} /> Start Camera</button>
            <button className="btn btn-stop"  onClick={stopCamera}  disabled={!isProcessing}><Square size={13} /> Stop</button>
            <button className="btn btn-load"  onClick={() => fileInputRef.current?.click()} disabled={isProcessing || !modelLoaded}><Upload size={13} /> Load Video</button>
            <button className="btn btn-save"  onClick={saveFrame}   disabled={!isProcessing}><Save size={13} /> Save Frame</button>
            <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
              <button className="btn btn-dim" onClick={() => pingBackend()}><RefreshCw size={12} /> Ping</button>
              <button className="btn btn-dim" onClick={() => setShowApiPanel(p => !p)}>⚙ Config</button>
            </div>
          </div>
          <div className="panel" style={{ display: 'flex' }}>
            <div className="metric">
              <span className="metric-label">Display FPS</span>
              <span className="metric-value" style={{ color: isProcessing ? 'var(--green)' : 'var(--text-dim)' }}>{fps}<span style={{ fontSize: 11, color: 'var(--text-dim)' }}> fps</span></span>
            </div>
            <div className="metric">
              <span className="metric-label">Backend FPS</span>
              <span className="metric-value" style={{ color: apiConnected && isProcessing ? 'var(--cyan)' : 'var(--text-dim)' }}>{backendFps}<span style={{ fontSize: 11, color: 'var(--text-dim)' }}> fps</span></span>
            </div>
            <div className="metric">
              <span className="metric-label">Latency</span>
              <span className="metric-value" style={{ fontSize: 17, color: latency ? (latency < 200 ? 'var(--green)' : latency < 500 ? 'var(--amber)' : 'var(--red)') : 'var(--text-dim)' }}>
                {latency ? latency : '—'}<span style={{ fontSize: 11, color: 'var(--text-dim)' }}>{latency ? ' ms' : ''}</span>
              </span>
            </div>
            <div className="metric">
              <span className="metric-label">Mode</span>
              <span className="metric-value" style={{ color: 'var(--cyan)', fontSize: 14 }}>FLASK</span>
            </div>
          </div>
        </div>

        {/* API Config */}
        {showApiPanel && (
          <div className="panel fade-in" style={{ padding: '16px 20px' }}>
            <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
              <span className="label-tag">Flask Server Base URL</span>
              <input className="api-input" value={apiBase} onChange={e => setApiBase(e.target.value)} placeholder="http://172.31.10.70:5000" style={{ flex: 1, minWidth: 240 }} />
              <button className="btn btn-load" onClick={saveApiConfig} style={{ whiteSpace: 'nowrap' }}><RefreshCw size={12} /> Save & Ping</button>
            </div>
            <div style={{ marginTop: 10, display: 'flex', gap: 24, fontSize: 10, color: 'var(--text-dim)' }}>
              <span>Health: <code style={{ color: 'var(--cyan)' }}>GET {apiBase}/</code></span>
              <span>Inference: <code style={{ color: 'var(--cyan)' }}>POST {apiBase}/process_frame</code></span>
            </div>
            {apiInfo && (
              <div style={{ marginTop: 8, padding: '8px 12px', background: 'var(--bg0)', borderRadius: 3, fontSize: 10, color: 'var(--text-dim)' }}>
                <span style={{ color: apiInfo.modelLoaded ? 'var(--green)' : 'var(--amber)', marginRight: 16 }}>{apiInfo.modelLoaded ? '✓ Model loaded' : '✗ Model not loaded'}</span>
                {apiInfo.modelPath && <span>Path: <code style={{ color: '#8899aa' }}>{apiInfo.modelPath}</code></span>}
              </div>
            )}
          </div>
        )}

        {/* VIEWPORT */}
        <div className="panel">
          <div style={{ padding: '9px 18px', borderBottom: '1px solid var(--border)', background: 'var(--bg2)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span className="label-tag" style={{ color: isProcessing ? 'var(--green)' : 'var(--text-dim)', borderColor: isProcessing ? 'rgba(0,255,136,.3)' : undefined }}>
                {isProcessing ? <><span className="blink">●</span> LIVE</> : '○ STANDBY'}
              </span>
              <span style={{ fontSize: 10, color: 'var(--text-dim)' }}>Dehazed Output — Flask Neural Model · fog_removal_model.h5.keras</span>
            </div>
            <div style={{ display: 'flex', gap: 5 }}>
              {['#ff4060','#f0c040','#00ff88'].map((c, i) => <span key={i} style={{ width: 10, height: 10, borderRadius: '50%', background: c, display: 'inline-block' }} />)}
            </div>
          </div>

          <div ref={displayRef} style={{ position: 'relative', width: '100%', height: '66vh', background: '#02060e', overflow: 'hidden' }}>
            <canvas ref={canvasRef} style={{ width: '100%', height: '100%', display: 'block' }} />
            <div className="scanline" />
            <div className="corner corner-tl" /><div className="corner corner-tr" />
            <div className="corner corner-bl" /><div className="corner corner-br" />

            {!isProcessing && (
              <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 20, zIndex: 3 }}>
                <div style={{ width: 80, height: 80, border: '1px solid rgba(0,212,255,.2)', borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,212,255,.03)' }}>
                  <Camera size={30} color="rgba(0,212,255,.3)" />
                </div>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontFamily: "'Barlow Condensed',sans-serif", fontSize: 20, letterSpacing: '.12em', color: 'rgba(200,216,232,.3)' }}>NO SIGNAL</div>
                  <div style={{ fontSize: 10, color: 'var(--text-dim)', marginTop: 6, letterSpacing: '.08em' }}>
                    {modelLoaded ? 'PRESS START CAMERA OR LOAD VIDEO' : 'WAITING FOR BACKEND CONNECTION'}
                  </div>
                  {!apiConnected && (
                    <div style={{ marginTop: 14, padding: '6px 14px', border: '1px solid rgba(255,64,96,.3)', borderRadius: 3, fontSize: 10, color: 'var(--red)', display: 'inline-block' }}>
                      Flask server offline — check ⚙ Config · expected {DEFAULT_API}
                    </div>
                  )}
                </div>
              </div>
            )}

            {isProcessing && (
              <>
                <div style={{ position: 'absolute', top: 14, right: 14, zIndex: 4, background: 'rgba(8,12,18,.85)', backdropFilter: 'blur(4px)', border: '1px solid var(--border)', borderRadius: 3, padding: '4px 10px', fontSize: 10, letterSpacing: '.1em', display: 'flex', gap: 10 }}>
                  <span style={{ color: 'var(--green)' }}>DSP {fps} fps</span>
                  <span style={{ color: 'var(--border)' }}>|</span>
                  <span style={{ color: 'var(--cyan)' }}>NET {backendFps} fps</span>
                </div>
                <div style={{ position: 'absolute', top: 14, left: 14, zIndex: 4, background: 'rgba(8,12,18,.85)', backdropFilter: 'blur(4px)', border: `1px solid ${apiConnected ? 'rgba(0,255,136,.3)' : 'rgba(255,64,96,.3)'}`, borderRadius: 3, padding: '4px 10px', fontSize: 10, letterSpacing: '.08em', display: 'flex', alignItems: 'center', gap: 6 }}>
                  {apiConnected
                    ? <><Wifi size={11} color="var(--green)" /><span style={{ color: 'var(--green)' }}>Flask Connected</span></>
                    : <><WifiOff size={11} color="var(--red)" /><span style={{ color: 'var(--red)' }}>Reconnecting...</span></>}
                </div>
              </>
            )}
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: 'var(--text-dim)', letterSpacing: '.06em' }}>
          <span>DEFOGAI · FLASK BACKEND PIPELINE · {apiBase}</span>
          <span>THROTTLE {THROTTLE_MS}ms · JPEG 75% · SCALE 320px</span>
        </div>
      </div>

      <video ref={videoRef} playsInline muted style={{ position: 'absolute', opacity: 0, pointerEvents: 'none', width: 1, height: 1 }} />
      <input ref={fileInputRef} type="file" accept="video/*" onChange={handleFileChange} style={{ display: 'none' }} />
    </div>
  );
};

export default FogRemovalSystem;