import { trpc } from "@/lib/trpc";
import type { AIResponse, GraphNode, PrototypeState, SessionSnapshot, SessionMode, ThinkEvent, ThinkTraceSession } from "@shared/types";
import { eventsThrough, responseToSnapshot } from "@shared/session";
import * as THREE from "three";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowDown,
  ArrowRight,
  BrainCircuit,
  Check,
  ChevronRight,
  CircleAlert,
  Clock3,
  Crosshair,
  GitBranch,
  Lightbulb,
  Loader2,
  Mic,
  Mic2,
  Pause,
  Play,
  Plus,
  RotateCcw,
  Send,
  Sparkles,
  Target,
  WandSparkles,
  Zap,
} from "lucide-react";

const emptySnapshot: SessionSnapshot = {
  understanding: "",
  reasoning: "",
  solution: "",
  nextStep: "",
  decisions: [],
  graph: { nodes: [], edges: [] },
  design: { name: "", description: "", components: [] },
  prototype: { name: "", productType: "", purpose: "", description: "", components: [], connections: [], interactions: [], environment: "", appearance: "", functionalFlow: [], assembly: [] },
};

const formatTime = (timestamp: string) => new Date(timestamp).toLocaleTimeString([], { hour: "numeric", minute: "2-digit", second: "2-digit" });
const formatShortDate = (timestamp: string) => new Date(timestamp).toLocaleDateString([], { month: "short", day: "numeric" });
type SpeechRecognitionLike = { start: () => void; stop: () => void; onresult: ((event: { results: { 0: { 0: { transcript: string } } } }) => void) | null; onend: (() => void) | null; onerror: (() => void) | null };

function LogoMark() {
  return <div className="logo-mark"><span /><span /><span /></div>;
}

function Pill({ children, tone = "violet" }: { children: React.ReactNode; tone?: "violet" | "green" | "red" | "slate" }) {
  return <span className={`pill pill-${tone}`}><span className="pill-dot" />{children}</span>;
}

function SectionLabel({ icon: Icon, children, action }: { icon: React.ElementType; children: React.ReactNode; action?: React.ReactNode }) {
  return <div className="section-label"><div className="section-label-main"><Icon size={13} />{children}</div>{action}</div>;
}

function GraphCanvas({ nodes, edges }: { nodes: GraphNode[]; edges: { source: string; target: string; label: string }[] }) {
  const positions = useMemo(() => {
    const width = 560;
    const height = 290;
    const columns = Math.max(1, Math.ceil(Math.sqrt(nodes.length || 1)));
    const rows = Math.max(1, Math.ceil((nodes.length || 1) / columns));
    return new Map(nodes.map((node, index) => {
      const col = index % columns;
      const row = Math.floor(index / columns);
      return [node.id, { x: 62 + (col * (width - 124)) / Math.max(columns - 1, 1), y: 52 + (row * (height - 104)) / Math.max(rows - 1, 1) }];
    }));
  }, [nodes]);
  const colorFor = (type: GraphNode["type"]) => ({ idea: "#a78bfa", thought: "#60a5fa", insight: "#22d3ee", problem: "#fb7185", constraint: "#fbbf24", decision: "#c084fc", solution: "#34d399", component: "#818cf8" }[type]);

  if (!nodes.length) return <div className="empty-graph"><GitBranch size={20} /><p>Your reasoning graph will appear here.</p><span>Start thinking to map the idea.</span></div>;
  return <div className="graph-wrap">
    <svg viewBox="0 0 560 290" role="img" aria-label="AI reasoning graph">
      <defs><filter id="nodeGlow"><feGaussianBlur stdDeviation="3" result="coloredBlur" /><feMerge><feMergeNode in="coloredBlur" /><feMergeNode in="SourceGraphic" /></feMerge></filter></defs>
      <g className="graph-lines">{edges.map((edge, index) => {
        const source = positions.get(edge.source); const target = positions.get(edge.target);
        if (!source || !target) return null;
        return <g key={`${edge.source}-${edge.target}-${index}`}><line x1={source.x} y1={source.y} x2={target.x} y2={target.y} stroke="#374161" strokeWidth="1.5" /><text x={(source.x + target.x) / 2} y={(source.y + target.y) / 2 - 5} fill="#657090" fontSize="8" textAnchor="middle">{edge.label}</text></g>;
      })}</g>
      {nodes.map(node => { const point = positions.get(node.id) ?? { x: 40, y: 40 }; const color = colorFor(node.type); return <g key={node.id} className="graph-node" transform={`translate(${point.x}, ${point.y})`} filter="url(#nodeGlow)"><circle r="9" fill="#0d1325" stroke={color} strokeWidth="2" /><circle r="3" fill={color} /><text y="-16" fill="#e4e8f3" fontSize="10" textAnchor="middle">{node.label.slice(0, 22)}</text><text y="23" fill="#697593" fontSize="8" textAnchor="middle">{node.type}</text></g>; })}
    </svg>
    <div className="graph-legend">{[["idea", "Idea"], ["thought", "Thought"], ["insight", "AI insight"], ["component", "Component"]].map(([type, label]) => <span key={type}><i style={{ background: colorFor(type as GraphNode["type"]) }} />{label}</span>)}</div>
  </div>;
}

function materialColor(material: string) {
  const value = material.toLowerCase();
  if (value.includes("purple") || value.includes("violet")) return 0x8b5cf6;
  if (value.includes("blue") || value.includes("steel") || value.includes("metal")) return 0x4f86f7;
  if (value.includes("cyan") || value.includes("glass") || value.includes("light")) return 0x22d3ee;
  if (value.includes("green") || value.includes("rubber")) return 0x34d399;
  if (value.includes("orange") || value.includes("amber")) return 0xf59e0b;
  if (value.includes("red") || value.includes("warning")) return 0xfb7185;
  if (value.includes("white") || value.includes("ceramic")) return 0xe6edf8;
  return 0x64748b;
}

function PrototypeViewer({ prototype, busy, onRegenerate }: { prototype: PrototypeState; busy: boolean; onRegenerate: () => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [resetToken, setResetToken] = useState(0);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !prototype.components.length) return;
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0b1020);
    const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 100);
    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    const resize = () => { const width = canvas.clientWidth || 500; const height = canvas.clientHeight || 320; renderer.setSize(width, height, false); camera.aspect = width / height; camera.updateProjectionMatrix(); };
    resize();
    const ambient = new THREE.AmbientLight(0x9aa9d5, 2.2); scene.add(ambient);
    const key = new THREE.DirectionalLight(0xb9c8ff, 3); key.position.set(4, 7, 6); scene.add(key);
    const rim = new THREE.PointLight(0x7c3aed, 14, 18); rim.position.set(-4, 2, -3); scene.add(rim);
    const grid = new THREE.GridHelper(9, 18, 0x253253, 0x151d35); grid.position.y = -1.5; scene.add(grid);
    const assembly = new THREE.Group(); scene.add(assembly);
    const meshes = new Map<string, THREE.Object3D>();
    const makeGeometry = (component: PrototypeState["components"][number]) => {
      const [x, y, z] = component.dimensions.map(value => Math.max(Math.min(Math.abs(value), 5), 0.08));
      if (component.geometry === "wheel" || component.geometry === "torus") return new THREE.TorusGeometry(Math.max(x / 2, 0.18), Math.max(y / 4, 0.055), 14, 32);
      if (component.geometry === "cylinder" || component.geometry === "tube") return new THREE.CylinderGeometry(Math.max(x / 2, 0.06), Math.max(z / 2, 0.06), Math.max(y, 0.1), 20);
      if (component.geometry === "sphere") return new THREE.SphereGeometry(Math.max(x / 2, 0.12), 22, 14);
      if (component.geometry === "cone") return new THREE.ConeGeometry(Math.max(x / 2, 0.12), Math.max(y, 0.15), 20);
      if (component.geometry === "dish") return new THREE.SphereGeometry(Math.max(x / 2, 0.12), 20, 10, 0, Math.PI * 2, 0, Math.PI / 2);
      if (component.geometry === "capsule") return new THREE.CapsuleGeometry(Math.max(x / 3, 0.08), Math.max(y - x, 0.08), 6, 16);
      return new THREE.BoxGeometry(x, y, z);
    };
    prototype.components.forEach(component => {
      const holder = new THREE.Group(); holder.name = component.name; holder.position.set(...component.position); holder.rotation.set(...component.rotation); holder.scale.set(...component.scale);
      const mesh = new THREE.Mesh(makeGeometry(component), new THREE.MeshStandardMaterial({ color: materialColor(component.material), roughness: 0.34, metalness: component.material.toLowerCase().includes("metal") ? 0.75 : 0.18 }));
      holder.userData.componentId = component.id;
      if (component.geometry === "wheel") mesh.rotation.x = Math.PI / 2;
      holder.add(mesh); assembly.add(holder); meshes.set(component.id, holder);
    });
    const connectionPairs = new Set(prototype.components.flatMap(component => component.connections.map(targetId => `${component.id}|${targetId}`)));
    prototype.connections.forEach(connection => connectionPairs.add(`${connection.from}|${connection.to}`));
    connectionPairs.forEach(pair => { const [sourceId, targetId] = pair.split("|"); const source = meshes.get(sourceId); const target = meshes.get(targetId); if (source && target) { const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints([source.position.clone(), target.position.clone()]), new THREE.LineBasicMaterial({ color: 0x5eead4, transparent: true, opacity: 0.35 })); assembly.add(line); } });
    const bounds = new THREE.Box3().setFromObject(assembly); const center = bounds.getCenter(new THREE.Vector3()); assembly.position.sub(center); const size = bounds.getSize(new THREE.Vector3()); const radius = Math.max(size.length() * 0.7, 3.8);
    let yaw = 0.62; let pitch = 0.25; let distance = radius; let dragging = false; let last = { x: 0, y: 0 };
    const updateCamera = () => { camera.position.set(Math.sin(yaw) * Math.cos(pitch) * distance, Math.sin(pitch) * distance, Math.cos(yaw) * Math.cos(pitch) * distance); camera.lookAt(0, 0, 0); };
    updateCamera();
    const onPointerDown = (event: PointerEvent) => { dragging = true; last = { x: event.clientX, y: event.clientY }; canvas.setPointerCapture(event.pointerId); };
    const onPointerMove = (event: PointerEvent) => { if (!dragging) return; yaw -= (event.clientX - last.x) * 0.012; pitch = Math.max(-1.1, Math.min(1.1, pitch + (event.clientY - last.y) * 0.009)); last = { x: event.clientX, y: event.clientY }; updateCamera(); };
    const onPointerUp = () => { dragging = false; };
    const onWheel = (event: WheelEvent) => { event.preventDefault(); distance = Math.max(radius * 0.55, Math.min(radius * 2.2, distance + event.deltaY * 0.008)); updateCamera(); };
    const onClick = (event: MouseEvent) => { const rect = canvas.getBoundingClientRect(); const pointer = new THREE.Vector2(((event.clientX - rect.left) / rect.width) * 2 - 1, -((event.clientY - rect.top) / rect.height) * 2 + 1); const raycaster = new THREE.Raycaster(); raycaster.setFromCamera(pointer, camera); const hit = raycaster.intersectObjects(Array.from(meshes.values()), true)[0]; const object = hit?.object; const holder = object?.parent; if (holder?.userData.componentId) setSelectedId(holder.userData.componentId as string); };
    canvas.addEventListener("pointerdown", onPointerDown); canvas.addEventListener("pointermove", onPointerMove); canvas.addEventListener("pointerup", onPointerUp); canvas.addEventListener("pointerleave", onPointerUp); canvas.addEventListener("click", onClick); canvas.addEventListener("wheel", onWheel, { passive: false }); window.addEventListener("resize", resize);
    let frame = 0; const animate = () => { frame = requestAnimationFrame(animate); renderer.render(scene, camera); }; animate();
    return () => { cancelAnimationFrame(frame); window.removeEventListener("resize", resize); canvas.removeEventListener("pointerdown", onPointerDown); canvas.removeEventListener("pointermove", onPointerMove); canvas.removeEventListener("pointerup", onPointerUp); canvas.removeEventListener("pointerleave", onPointerUp); canvas.removeEventListener("click", onClick); canvas.removeEventListener("wheel", onWheel); renderer.dispose(); scene.traverse(object => { if (object instanceof THREE.Mesh) { object.geometry.dispose(); if (Array.isArray(object.material)) object.material.forEach(material => material.dispose()); else object.material.dispose(); } }); };
  }, [prototype, resetToken]);

  if (!prototype.components.length) return <div className="prototype-empty"><Crosshair size={21} /><strong>Prototype space is waiting</strong><span>Start thinking to generate a model from your product.</span></div>;
  const selected = prototype.components.find(component => component.id === selectedId);
  return <div className="prototype-shell"><div className="prototype-toolbar"><span><span className="live-dot" />AI GENERATED · {prototype.productType}</span><div className="prototype-toolbar-actions"><button onClick={onRegenerate} disabled={busy}>{busy ? <Loader2 size={13} className="spin" /> : <WandSparkles size={13} />} {busy ? "Generating" : "Regenerate"}</button><button onClick={() => setResetToken(value => value + 1)} aria-label="Reset camera"><RotateCcw size={13} /> Reset view</button></div></div><div className="prototype-explanation">{prototype.purpose} {prototype.environment ? `· ${prototype.environment}` : ""}</div><canvas ref={canvasRef} className="prototype-canvas" /><div className="prototype-caption"><span>{prototype.components.length} AI-identified components</span><span className="caption-divider" />{prototype.name}</div><div className="prototype-component-list">{prototype.components.slice(0, 6).map(component => <button key={component.id} className={selectedId === component.id ? "prototype-component-selected" : ""} onClick={() => setSelectedId(component.id)}><span className="component-swatch" style={{ background: `#${materialColor(component.material).toString(16).padStart(6, "0")}` }} /><span><strong>{component.name}</strong><small>{component.role}</small></span></button>)}</div>{selected && <div className="prototype-selected-info"><strong>{selected.name}</strong><span>{selected.role}</span><small>{selected.geometry} · {selected.material}</small></div>}<div className="prototype-flow"><span>FLOW</span>{prototype.functionalFlow.slice(0, 3).join(" → ") || prototype.description}</div></div>;
}

function Timeline({ events, currentIndex, onSelect, replaying, onReplay }: { events: ThinkEvent[]; currentIndex: number; onSelect: (index: number) => void; replaying: boolean; onReplay: () => void }) {
  return <div className="timeline-panel"><div className="timeline-header"><SectionLabel icon={Clock3}>THINKING TIMELINE</SectionLabel><div className="timeline-actions"><span className="event-count">{events.length} {events.length === 1 ? "event" : "events"}</span><button className="ghost-btn" onClick={onReplay} disabled={events.length < 2 || replaying}>{replaying ? <><Pause size={13} /> Replaying</> : <><Play size={13} /> Replay</>}</button></div></div>{events.length === 0 ? <div className="empty-timeline">Timeline events will lock in as you think.</div> : <div className="timeline-list">{events.map((event, index) => { const active = index === currentIndex; const offTopic = event.aiResponse.isOffTopic; return <button key={event.id} className={`timeline-event ${active ? "timeline-active" : ""} ${offTopic ? "timeline-offtopic" : ""}`} onClick={() => onSelect(index)}><span className="timeline-marker"><span /></span><span className="timeline-event-copy"><span className="timeline-event-top"><strong>{index === 0 ? "Idea created" : offTopic ? "Possible distraction" : event.aiResponse.nextStep || "Thought explored"}</strong><time>{formatTime(event.timestamp)}</time></span><span className="timeline-event-content">{event.content}</span><span className="timeline-event-meta">{event.author} · {formatShortDate(event.timestamp)}</span></span>{active && <ChevronRight size={14} className="timeline-chevron" />}</button>; })}</div>}</div>;
}

export default function Home() {
  const [mode, setMode] = useState<SessionMode>("solo");
  const [ideaDraft, setIdeaDraft] = useState("");
  const [thoughtDraft, setThoughtDraft] = useState("");
  const [session, setSession] = useState<ThinkTraceSession | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [listening, setListening] = useState(false);
  const [replaying, setReplaying] = useState(false);
  const [replayIndex, setReplayIndex] = useState(0);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const analyze = trpc.thinktrace.analyze.useMutation();

  const currentIndex = replaying ? replayIndex : session?.currentEventIndex ?? -1;
  const currentEvent = session?.events[currentIndex];
  const snapshot = currentEvent?.snapshot ?? emptySnapshot;
  const activeSession = session;
  const isStarted = Boolean(session);

  useEffect(() => {
    if (!replaying || !session) return;
    if (replayIndex >= session.events.length - 1) {
      const done = window.setTimeout(() => { setReplaying(false); setSession(current => current ? { ...current, currentEventIndex: current.events.length - 1 } : current); }, 800);
      return () => window.clearTimeout(done);
    }
    const timer = window.setTimeout(() => setReplayIndex(index => index + 1), 650);
    return () => window.clearTimeout(timer);
  }, [replaying, replayIndex, session]);

  const runAnalyze = async (originalIdea: string, currentThought: string, previousEvents: ThinkEvent[]) => {
    const result = await analyze.mutateAsync({ originalIdea, currentThought, mode, previousEvents: previousEvents.map(event => ({ author: event.author, content: event.content, timestamp: event.timestamp, aiResponse: event.aiResponse })) });
    if (!result.ok) throw new Error(result.error);
    return result.response;
  };

  const createEvent = (response: AIResponse, sessionId: string, timestamp: string, type: ThinkEvent["type"], author: string, content: string, previousSnapshot?: SessionSnapshot): ThinkEvent => {
    const nextSnapshot = responseToSnapshot(response, previousSnapshot);
    return { id: `${sessionId}-${timestamp}-${Math.random().toString(36).slice(2, 7)}`, sessionId, timestamp, type, author, content, aiResponse: response, snapshot: nextSnapshot };
  };

  const startThinking = async () => {
    const originalIdea = ideaDraft.trim();
    if (!originalIdea || busy) return;
    setBusy(true); setError(""); setNotice("");
    const timestamp = new Date().toISOString();
    const sessionId = `session_${crypto.randomUUID?.() ?? `${Date.now()}_${Math.random().toString(36).slice(2)}`}`;
    try {
      const response = await runAnalyze(originalIdea, originalIdea, []);
      const event = createEvent(response, sessionId, timestamp, "idea", "You", originalIdea);
      setSession({ id: sessionId, mode, originalIdea, events: [event], currentEventIndex: 0 });
      setIdeaDraft(originalIdea);
      setNotice("Session anchored · AI understanding ready");
    } catch (caught) { setError(caught instanceof Error ? caught.message : "AI unavailable — please try again."); }
    finally { setBusy(false); }
  };

  const addThought = async () => {
    const thought = thoughtDraft.trim();
    if (!session || !thought || busy) return;
    setBusy(true); setError(""); setNotice("");
    const timestamp = new Date().toISOString();
    const activeEvents = eventsThrough(session.events, session.currentEventIndex);
    const previousSnapshot = activeEvents.at(-1)?.snapshot;
    try {
      const response = await runAnalyze(session.originalIdea, thought, activeEvents);
      const event = createEvent(response, session.id, timestamp, "thought", mode === "team" ? "You · contributor" : "You", thought, previousSnapshot);
      setSession({ ...session, events: [...activeEvents, event], currentEventIndex: activeEvents.length });
      setThoughtDraft("");
      setNotice(response.isOffTopic ? "Thought stored · possible distraction detected" : "Thought integrated · session state updated");
    } catch (caught) { setError(caught instanceof Error ? caught.message : "AI unavailable — please try again."); }
    finally { setBusy(false); }
  };

  const newSession = () => { setSession(null); setIdeaDraft(""); setThoughtDraft(""); setError(""); setNotice("New session ready"); setReplaying(false); setReplayIndex(0); };
  const rewindTo = (index: number) => { if (!session) return; setReplaying(false); setSession({ ...session, currentEventIndex: index }); setNotice(`Rewound to ${formatTime(session.events[index].timestamp)}`); };

  const toggleVoice = () => {
    const SpeechRecognition = (window as Window & { SpeechRecognition?: new () => SpeechRecognitionLike; webkitSpeechRecognition?: new () => SpeechRecognitionLike }).SpeechRecognition ?? (window as Window & { webkitSpeechRecognition?: new () => SpeechRecognitionLike }).webkitSpeechRecognition;
    if (!SpeechRecognition) { setError("Voice input is not supported in this browser."); return; }
    if (listening) { recognitionRef.current?.stop(); return; }
    const recognition = new SpeechRecognition();
    recognition.onresult = (event: { results: { 0: { 0: { transcript: string } } } }) => { const transcript = event.results[0][0].transcript; if (isStarted) setThoughtDraft(value => `${value}${value ? " " : ""}${transcript}`); else setIdeaDraft(value => `${value}${value ? " " : ""}${transcript}`); };
    recognition.onend = () => setListening(false); recognition.onerror = () => { setListening(false); setError("Voice input could not be captured. Try again or type your thought."); }; recognitionRef.current = recognition; setListening(true); recognition.start();
  };

  const playReplay = () => { if (!session || session.events.length < 2) return; setReplayIndex(0); setReplaying(true); setNotice("Replaying the actual session evolution"); };
  const regeneratePrototype = async () => {
    if (!session || !currentEvent || busy) return;
    setBusy(true); setError(""); setNotice("");
    const activeEvents = eventsThrough(session.events, session.currentEventIndex);
    const previousEvents = activeEvents.slice(0, -1);
    try {
      const response = await runAnalyze(session.originalIdea, currentEvent.content, previousEvents);
      const regenerated = createEvent(response, session.id, currentEvent.timestamp, currentEvent.type, currentEvent.author, currentEvent.content, previousEvents.at(-1)?.snapshot);
      setSession({ ...session, events: [...previousEvents, regenerated], currentEventIndex: previousEvents.length });
      setNotice("Prototype regenerated from the current AI design state");
    } catch (caught) { setError(caught instanceof Error ? caught.message : "AI prototype generation failed — please retry."); }
    finally { setBusy(false); }
  };

  return <div className="thinktrace-app">
    <header className="topbar"><div className="brand"><LogoMark /><div><div className="brand-name">THINK<span>TRACE</span></div><div className="brand-tagline">Rewind your thinking.</div></div></div><div className="topbar-actions"><div className="mode-switch" role="group" aria-label="Session mode"><button className={mode === "solo" ? "mode-active" : ""} onClick={() => setMode("solo")}>Solo</button><button className={mode === "team" ? "mode-active" : ""} onClick={() => setMode("team")}>Team</button></div><div className="session-id">{session ? <><span className="live-dot" />{session.id.slice(0, 18)}…</> : "NO ACTIVE SESSION"}</div><button className="new-session-btn" onClick={newSession}><Plus size={15} /> New session</button></div></header>

    <main className={`workspace ${isStarted ? "workspace-started" : "workspace-empty"}`}>
      {!isStarted ? <section className="hero-launch"><div className="eyebrow"><Sparkles size={13} /> A thinking workspace for product builders</div><h1>Make your idea<br /><em>traceable.</em></h1><p>Follow the thread from the first spark to a design you can see, question, and rewind.</p><div className="launch-card"><div className="launch-card-top"><div><div className="input-kicker">CURRENT IDEA</div><div className="input-hint">What are you trying to make or solve?</div></div><Pill tone="slate">AI ready</Pill></div><textarea value={ideaDraft} onChange={event => setIdeaDraft(event.target.value)} onKeyDown={event => { if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) startThinking(); }} placeholder="Describe the product, problem, or question on your mind…" rows={4} /><div className="launch-footer"><span className="keyboard-hint"><kbd>⌘</kbd><kbd>↵</kbd> to begin</span><div className="launch-actions"><button className={`mic-btn ${listening ? "mic-listening" : ""}`} onClick={toggleVoice} aria-label="Use microphone">{listening ? <Mic2 size={17} /> : <Mic size={17} />}</button><button className="primary-btn" onClick={startThinking} disabled={!ideaDraft.trim() || busy}>{busy ? <><Loader2 size={16} className="spin" /> Thinking…</> : <>Start thinking <ArrowRight size={16} /></>}</button></div></div></div><div className="hero-footnote"><span><Zap size={12} /> Real reasoning</span><span><GitBranch size={12} /> Evolving graph</span><span><RotateCcw size={12} /> Rewindable state</span><span><Crosshair size={12} /> Idea-specific prototype</span></div></section> : <>
        <section className="session-overview"><div className="overview-heading"><div><div className="eyebrow"><span className="live-dot" /> ACTIVE SESSION · {activeSession!.mode.toUpperCase()}</div><h1>{activeSession!.originalIdea}</h1></div><div className="overview-actions"><button className="ghost-btn" onClick={playReplay} disabled={activeSession!.events.length < 2 || replaying}>{replaying ? <><Pause size={14} /> Replay running</> : <><Play size={14} /> Replay</>}</button></div></div><div className="current-idea-bar"><div className="current-idea-icon"><Target size={17} /></div><div><span>Current idea</span><strong>{activeSession!.originalIdea}</strong></div><div className="idea-state"><Pill tone="green">{replaying ? "REPLAYING" : "IN FOCUS"}</Pill><span>{activeSession!.events.length} snapshots</span></div></div></section>
        <section className="thinking-grid"><div className="panel reasoning-panel"><SectionLabel icon={BrainCircuit} action={<Pill tone="violet">AI UNDERSTANDING</Pill>}>THINKING CORE</SectionLabel><div className="reasoning-content"><div className="reasoning-lead">{snapshot.understanding || "The AI will describe what it understands about your idea here."}</div><div className="reasoning-block"><div className="mini-label"><Lightbulb size={12} /> CURRENT REASONING</div><p>{snapshot.reasoning || "Add a thought to move the reasoning forward."}</p></div><div className="reasoning-block"><div className="mini-label"><WandSparkles size={12} /> SOLUTION DIRECTION</div><p>{snapshot.solution || "Your emerging solution will appear here."}</p></div>{snapshot.decisions.length > 0 && <div className="decision-list"><div className="mini-label"><Check size={12} /> DECISIONS IN THIS STATE</div>{snapshot.decisions.slice(-3).map(decision => <div key={decision.id} className="decision-item"><span className="decision-arrow">↳</span><div><strong>{decision.decision}</strong><span>{decision.reason}</span></div></div>)}</div>}</div></div><div className="panel graph-panel"><SectionLabel icon={GitBranch} action={<span className="panel-meta">{snapshot.graph.nodes.length} nodes · {snapshot.graph.edges.length} links</span>}>REASONING GRAPH</SectionLabel><GraphCanvas nodes={snapshot.graph.nodes} edges={snapshot.graph.edges} /></div></section>
        {currentEvent?.aiResponse.isOffTopic && <div className="distraction-banner"><div className="distraction-icon"><CircleAlert size={18} /></div><div><strong>Possible distraction</strong><span>{currentEvent.aiResponse.offTopicReason || "This thought may not connect to the current idea."}</span><small>{currentEvent.aiResponse.redirectQuestion || "Return to your current idea?"}</small></div><button onClick={() => setThoughtDraft("")}>Return to thread <ArrowRight size={14} /></button></div>}
        <section className="composer-row"><div className="composer-label"><div className="composer-orb"><Plus size={16} /></div><div><strong>ADD THOUGHT</strong><span>Build on what you have, one thought at a time.</span></div></div><div className="thought-composer"><textarea value={thoughtDraft} onChange={event => setThoughtDraft(event.target.value)} onKeyDown={event => { if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) addThought(); }} placeholder="What are you thinking about next?" rows={2} /><div className="composer-actions"><span className={busy ? "processing-text" : "keyboard-hint"}>{busy ? <><Loader2 size={12} className="spin" /> AI is tracing this thought…</> : <><kbd>⌘</kbd><kbd>↵</kbd> to add</>}</span><button className={`mic-btn small ${listening ? "mic-listening" : ""}`} onClick={toggleVoice}>{listening ? <Mic2 size={15} /> : <Mic size={15} />}</button><button className="send-btn" onClick={addThought} disabled={!thoughtDraft.trim() || busy}>{busy ? <Loader2 size={15} className="spin" /> : <Send size={15} />}</button></div></div></section>
        <Timeline events={activeSession!.events} currentIndex={currentIndex} onSelect={rewindTo} replaying={replaying} onReplay={playReplay} />
        <section className="final-grid"><div className="panel design-panel"><SectionLabel icon={WandSparkles} action={<Pill tone="green">EVOLVING</Pill>}>CURRENT DESIGN</SectionLabel><div className="design-content"><h2>{snapshot.design.name || "Design in progress"}</h2><p>{snapshot.design.description || "The design will evolve from your actual thinking history."}</p><div className="component-chips">{snapshot.design.components.map((component, index) => <span key={`${component}-${index}`}><span>{String(index + 1).padStart(2, "0")}</span>{component}</span>)}</div></div></div><div className="panel prototype-panel"><SectionLabel icon={Crosshair} action={<span className="panel-meta">{snapshot.prototype.components.length} parts</span>}>AI PROTOTYPE</SectionLabel><PrototypeViewer prototype={snapshot.prototype} busy={busy} onRegenerate={regeneratePrototype} /></div><div className="panel why-panel"><SectionLabel icon={Lightbulb}>WHY THIS DESIGN?</SectionLabel><div className="why-list">{snapshot.prototype.components.length ? snapshot.prototype.components.slice(0, 5).map(component => <div key={component.id} className="why-item"><div className="why-dot" /><div><strong>{component.name}</strong><p>{component.role}</p></div></div>) : <div className="why-empty">Component rationale will appear beside the prototype as the design takes shape.</div>}</div></div></section>
      </>}
      {error && <div className="toast-message toast-error"><CircleAlert size={15} />{error}<button onClick={() => setError("")}>×</button></div>}
      {notice && !error && <div className="toast-message"><Check size={15} />{notice}</div>}
    </main>
    <footer className="app-footer"><span>THINKTRACE / PRIVATE THINKING SPACE</span><span>AI reasoning is grounded in your session history</span></footer>
  </div>;
}
