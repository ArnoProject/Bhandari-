import { useState, useRef, useEffect } from "react";
import { createClient } from "@supabase/supabase-js";

const SUPA_URL = "https://ajwniougsadsvfaaxryb.supabase.co";
const SUPA_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFqd25pb3Vnc2Fkc3ZmYWF4cnliIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzYxMjEzMDksImV4cCI6MjA5MTY5NzMwOX0.rSvnFp6msExdw1b_UBL5d04HioZzSadaaGSjIOmPLc0";
const db = createClient(SUPA_URL, SUPA_KEY);

const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
const today = () => new Date().toISOString().slice(0, 10);
const fmt$ = (n) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2 }).format(n || 0);
const fmtTime = (seconds) => { const h = Math.floor(seconds / 3600); const m = Math.floor((seconds % 3600) / 60); const s = seconds % 60; return `${String(h).padStart(2,"0")}:${String(m).padStart(2,"0")}:${String(s).padStart(2,"0")}`; };

const parseWithAI = async (base64Data, mediaType, prompt) => {
  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514", max_tokens: 1000,
        messages: [{ role: "user", content: [
          { type: mediaType.includes("pdf") ? "document" : "image", source: { type: "base64", media_type: mediaType, data: base64Data } },
          { type: "text", text: prompt }
        ]}]
      })
    });
    const data = await response.json();
    return data.content?.[0]?.text || "";
  } catch { return ""; }
};

const toBase64 = (file) => new Promise((res, rej) => { const r = new FileReader(); r.onload = ev => res(ev.target.result); r.onerror = rej; r.readAsDataURL(file); });

// DOT Pre-trip checklist items
const PRETRIP_ITEMS = [
  { id: "engine_oil", label: "Engine Oil Level", category: "Engine" },
  { id: "coolant", label: "Coolant Level", category: "Engine" },
  { id: "belts", label: "Belts & Hoses", category: "Engine" },
  { id: "air_filter", label: "Air Filter", category: "Engine" },
  { id: "steering", label: "Steering Fluid", category: "Engine" },
  { id: "front_brakes", label: "Front Brakes", category: "Brakes" },
  { id: "rear_brakes", label: "Rear Brakes", category: "Brakes" },
  { id: "brake_lines", label: "Brake Lines & Hoses", category: "Brakes" },
  { id: "parking_brake", label: "Parking Brake", category: "Brakes" },
  { id: "air_pressure", label: "Air Pressure (90-120 PSI)", category: "Brakes" },
  { id: "steer_tires", label: "Steer Tires", category: "Tires" },
  { id: "drive_tires", label: "Drive Tires", category: "Tires" },
  { id: "trailer_tires", label: "Trailer Tires", category: "Tires" },
  { id: "tire_pressure", label: "Tire Pressure", category: "Tires" },
  { id: "lug_nuts", label: "Lug Nuts & Wheel Seals", category: "Tires" },
  { id: "headlights", label: "Headlights", category: "Lights" },
  { id: "tail_lights", label: "Tail Lights", category: "Lights" },
  { id: "brake_lights", label: "Brake Lights", category: "Lights" },
  { id: "turn_signals", label: "Turn Signals", category: "Lights" },
  { id: "marker_lights", label: "Marker & Clearance Lights", category: "Lights" },
  { id: "horn", label: "Horn", category: "Cab" },
  { id: "wipers", label: "Windshield Wipers", category: "Cab" },
  { id: "mirrors", label: "Mirrors (adjusted)", category: "Cab" },
  { id: "seatbelt", label: "Seat Belt", category: "Cab" },
  { id: "fire_ext", label: "Fire Extinguisher", category: "Safety" },
  { id: "triangles", label: "Emergency Triangles (3)", category: "Safety" },
  { id: "first_aid", label: "First Aid Kit", category: "Safety" },
  { id: "fifth_wheel", label: "Fifth Wheel & Kingpin", category: "Coupling" },
  { id: "glad_hands", label: "Glad Hands & Air Lines", category: "Coupling" },
  { id: "safety_chains", label: "Safety Chains", category: "Coupling" },
  { id: "landing_gear", label: "Landing Gear (retracted)", category: "Coupling" },
  { id: "cargo_secure", label: "Cargo Secured", category: "Cargo" },
  { id: "doors_latched", label: "Doors Latched & Sealed", category: "Cargo" },
  { id: "reefer_temp", label: "Reefer Temperature Set", category: "Cargo" },
  { id: "fuel_level", label: "Fuel Level Adequate", category: "Fuel" },
  { id: "def_level", label: "DEF Level", category: "Fuel" },
];

const CATEGORIES = [...new Set(PRETRIP_ITEMS.map(i => i.category))];

// ─── Login Screen ─────────────────────────────────────────────────────────────
const LoginScreen = ({ onLogin }) => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleLogin = async () => {
    if (!email || !password) { setError("Enter email and password"); return; }
    setLoading(true); setError("");
    const { error } = await db.auth.signInWithPassword({ email, password });
    if (error) setError("Invalid email or password");
    else onLogin();
    setLoading(false);
  };

  return (
    <div style={{ minHeight: "100vh", background: "#0f172a", display: "flex", alignItems: "center", justifyContent: "center", padding: 20, fontFamily: "'DM Sans','Segoe UI',sans-serif" }}>
      <div style={{ background: "#1e293b", borderRadius: 20, padding: "40px 28px", width: "100%", maxWidth: 380, border: "1px solid rgba(255,255,255,0.1)" }}>
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <div style={{ fontSize: 52 }}>⛟</div>
          <div style={{ color: "#f59e0b", fontSize: 22, fontWeight: 900, letterSpacing: 2, marginTop: 8 }}>BHANDARI</div>
          <div style={{ color: "#64748b", fontSize: 11, letterSpacing: 4 }}>DRIVER PORTAL</div>
          <div style={{ width: 40, height: 3, background: "#f59e0b", borderRadius: 99, margin: "14px auto 0" }} />
        </div>
        {error && <div style={{ background: "#dc262620", border: "1px solid #dc262644", borderRadius: 10, padding: "10px 14px", marginBottom: 16, color: "#f87171", fontSize: 13, textAlign: "center" }}>⚠️ {error}</div>}
        <div style={{ marginBottom: 14 }}>
          <label style={{ color: "#64748b", fontSize: 10, fontWeight: 700, letterSpacing: 1, textTransform: "uppercase" }}>Email</label>
          <input type="email" value={email} onChange={e => setEmail(e.target.value)} onKeyDown={e => e.key === "Enter" && handleLogin()} placeholder="your@email.com"
            style={{ background: "#0f172a", border: "1px solid rgba(255,255,255,0.15)", borderRadius: 10, color: "#fff", padding: "13px 14px", fontSize: 15, width: "100%", boxSizing: "border-box", outline: "none", marginTop: 6 }} />
        </div>
        <div style={{ marginBottom: 24 }}>
          <label style={{ color: "#64748b", fontSize: 10, fontWeight: 700, letterSpacing: 1, textTransform: "uppercase" }}>Password</label>
          <input type="password" value={password} onChange={e => setPassword(e.target.value)} onKeyDown={e => e.key === "Enter" && handleLogin()} placeholder="••••••••"
            style={{ background: "#0f172a", border: "1px solid rgba(255,255,255,0.15)", borderRadius: 10, color: "#fff", padding: "13px 14px", fontSize: 15, width: "100%", boxSizing: "border-box", outline: "none", marginTop: 6 }} />
        </div>
        <button onClick={handleLogin} disabled={loading} style={{ background: loading ? "#334155" : "linear-gradient(135deg,#f59e0b,#d97706)", color: loading ? "#64748b" : "#fff", border: "none", borderRadius: 12, padding: "16px 0", fontWeight: 900, cursor: loading ? "not-allowed" : "pointer", fontSize: 16, width: "100%" }}>
          {loading ? "Signing in..." : "🔐 Sign In"}
        </button>
        <div style={{ textAlign: "center", marginTop: 20, color: "#475569", fontSize: 12 }}>Bhandari Logistics LLC · Omaha, NE</div>
      </div>
    </div>
  );
};

// ─── MAIN DRIVER APP ──────────────────────────────────────────────────────────
export default function DriverApp() {
  const [session, setSession] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [myLoads, setMyLoads] = useState([]);
  const [trucks, setTrucks] = useState([]);
  const [trailers, setTrailers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [screen, setScreen] = useState("home"); // home, pretrip, load, scan, detention
  const [selectedLoad, setSelectedLoad] = useState(null);
  const [toast, setToast] = useState(null);
  const [driverName, setDriverName] = useState("");

  // Pre-trip state
  const [pretripItems, setPretripItems] = useState({});
  const [pretripNotes, setPretripNotes] = useState("");
  const [pretripTruckId, setPretripTruckId] = useState("");
  const [pretripPhoto, setPretripPhoto] = useState(null);
  const [pretripSaving, setPretripSaving] = useState(false);
  const [pretripDone, setPretripDone] = useState(false);

  // Detention state
  const [detentionRunning, setDetentionRunning] = useState(false);
  const [detentionStart, setDetentionStart] = useState(null);
  const [detentionSeconds, setDetentionSeconds] = useState(0);
  const [detentionNotes, setDetentionNotes] = useState("");
  const [detentionSaved, setDetentionSaved] = useState(false);
  const detentionRef = useRef(null);

  // Scan/upload state
  const [scanType, setScanType] = useState("BOL");
  const [scanFile, setScanFile] = useState(null);
  const [scanPreview, setScanPreview] = useState(null);
  const [scanning, setScanning] = useState(false);
  const [scanResult, setScanResult] = useState(null);
  const [scanSaved, setScanSaved] = useState(false);
  const scanRef = useRef();

  // Lumper state
  const [lumperAmount, setLumperAmount] = useState("");
  const [lumperPhoto, setLumperPhoto] = useState(null);
  const [lumperSaving, setLumperSaving] = useState(false);
  const [lumperSaved, setLumperSaved] = useState(false);
  const lumperRef = useRef();

  // Delivery photo state
  const [deliveryPhoto, setDeliveryPhoto] = useState(null);
  const [deliverySaving, setDeliverySaving] = useState(false);
  const [deliverySaved, setDeliverySaved] = useState(false);
  const deliveryRef = useRef();

  const showToast = (msg, type = "success") => { setToast({ msg, type }); setTimeout(() => setToast(null), 3500); };

  // Auth
  useEffect(() => {
    db.auth.getSession().then(({ data: { session } }) => { setSession(session); setAuthLoading(false); });
    const { data: { subscription } } = db.auth.onAuthStateChange((_event, session) => { setSession(session); setAuthLoading(false); });
    return () => subscription.unsubscribe();
  }, []);

  const fetchData = async () => {
    if (!session) return;
    setLoading(true);
    try {
      const userEmail = session.user.email;
      const [l, t, tr] = await Promise.all([
        db.from("loads").select("*").order("date", { ascending: false }),
        db.from("trucks").select("*"),
        db.from("trailers").select("*"),
      ]);
      if (t.data) setTrucks(t.data);
      if (tr.data) setTrailers(tr.data);
      if (l.data) {
        const mapped = l.data.map(r => ({
          id: r.id, date: r.date, loadNum: r.load_num, origin: r.origin, dest: r.dest,
          miles: r.miles, rate: r.rate, detention: r.detention, driver: r.driver,
          truckId: r.truck_id, trailerId: r.trailer_id, status: r.status,
          lumperCost: r.lumper_cost, lumperPaidBy: r.lumper_paid_by,
          lumperReimbursed: r.lumper_reimbursed, toll: r.toll,
          assignedDriver: r.assigned_driver || r.driver || "",
          driverNotes: r.driver_notes || "", pickupPhoto: r.pickup_photo || "",
          deliveryPhoto: r.delivery_photo || "", lumperReceiptPhoto: r.lumper_receipt_photo || "",
          podSigned: r.pod_signed || false, brokerName: r.broker_name || "",
        }));
        // Show all loads for testing — in production filter by driver
        setMyLoads(mapped.slice(0, 20));
        if (mapped[0]?.driver) setDriverName(mapped[0].driver);
      }
    } catch { showToast("Error loading data", "error"); }
    setLoading(false);
  };

  useEffect(() => { if (session) fetchData(); }, [session]);

  // Detention timer
  useEffect(() => {
    if (detentionRunning) {
      detentionRef.current = setInterval(() => setDetentionSeconds(s => s + 1), 1000);
    } else {
      clearInterval(detentionRef.current);
    }
    return () => clearInterval(detentionRef.current);
  }, [detentionRunning]);

  const startDetention = () => {
    setDetentionStart(new Date().toISOString());
    setDetentionRunning(true);
    setDetentionSeconds(0);
    setDetentionSaved(false);
  };

  const stopAndSaveDetention = async () => {
    setDetentionRunning(false);
    const endTime = new Date().toISOString();
    const totalMinutes = Math.round(detentionSeconds / 60);
    const { error } = await db.from("detention_logs").insert({
      id: uid(), load_id: selectedLoad?.id || "", driver: driverName || session?.user?.email || "",
      start_time: detentionStart, end_time: endTime, total_minutes: totalMinutes, notes: detentionNotes
    });
    if (!error) {
      // Update load detention
      if (selectedLoad) {
        const newDetention = Number(selectedLoad.detention || 0) + (totalMinutes / 60 * (selectedLoad.rate > 0 ? 50 : 50));
        await db.from("loads").update({ detention: newDetention }).eq("id", selectedLoad.id);
      }
      setDetentionSaved(true);
      showToast(`Detention logged: ${totalMinutes} minutes ✓`);
      await fetchData();
    } else showToast("Save failed", "error");
  };

  // Update load status
  const updateStatus = async (loadId, status) => {
    const { error } = await db.from("loads").update({ status }).eq("id", loadId);
    if (!error) { await fetchData(); showToast(`Status: ${status} ✓`); setSelectedLoad(prev => prev ? { ...prev, status } : prev); }
    else showToast("Update failed", "error");
  };

  // Save pre-trip
  const savePretrip = async () => {
    const checkedCount = Object.values(pretripItems).filter(v => v === "ok").length;
    const totalItems = PRETRIP_ITEMS.length;
    setPretripSaving(true);
    const { error } = await db.from("pre_trips").insert({
      id: uid(), driver: driverName || session?.user?.email || "",
      truck_id: pretripTruckId, date: today(),
      items: pretripItems, photos: pretripPhoto ? [pretripPhoto] : [],
      signature: driverName || session?.user?.email || "",
      completed: checkedCount === totalItems, notes: pretripNotes
    });
    if (!error) { setPretripDone(true); showToast(`Pre-trip saved ✓ (${checkedCount}/${totalItems} items)`); }
    else showToast("Save failed", "error");
    setPretripSaving(false);
  };

  // Scan document with AI
  const handleScan = async (e) => {
    const file = e.target.files[0]; if (!file) return;
    const b64 = await toBase64(file);
    setScanPreview(b64);
    setScanFile(file);
    setScanning(true);
    const mediaType = file.type || "image/jpeg";
    const result = await parseWithAI(b64.split(",")[1], mediaType,
      `This is a ${scanType} document. Extract the key information and summarize it in 3-5 bullet points. Include: load number, dates, origin, destination, shipper, consignee, weight, pieces, any special instructions. Keep it brief and clear.`
    );
    setScanResult(result);
    setScanning(false);
  };

  const saveScan = async () => {
    if (!scanPreview || !selectedLoad) return;
    const { error } = await db.from("load_documents").insert({
      id: uid(), load_id: selectedLoad.id, doc_type: scanType,
      file_url: scanPreview, notes: scanResult || "",
      uploaded_by: driverName || session?.user?.email || ""
    });
    if (!error) { setScanSaved(true); showToast(`${scanType} saved to load ✓`); }
    else showToast("Save failed", "error");
  };

  // Save delivery photo
  const handleDeliveryPhoto = async (e) => {
    const file = e.target.files[0]; if (!file) return;
    const b64 = await toBase64(file);
    setDeliveryPhoto(b64);
  };

  const saveDeliveryPhoto = async () => {
    if (!deliveryPhoto || !selectedLoad) return;
    setDeliverySaving(true);
    const { error } = await db.from("loads").update({ delivery_photo: deliveryPhoto, status: "Delivered" }).eq("id", selectedLoad.id);
    if (!error) { setDeliverySaved(true); showToast("Delivery photo saved ✓"); await fetchData(); }
    else showToast("Save failed", "error");
    setDeliverySaving(false);
  };

  // Save lumper
  const handleLumperPhoto = async (e) => {
    const file = e.target.files[0]; if (!file) return;
    const b64 = await toBase64(file);
    setLumperPhoto(b64);
  };

  const saveLumper = async () => {
    if (!selectedLoad || !lumperAmount) return;
    setLumperSaving(true);
    const { error } = await db.from("loads").update({
      lumper_cost: Number(lumperAmount),
      lumper_paid_by: "Out of Pocket",
      lumper_reimbursed: "Pending",
      lumper_receipt_photo: lumperPhoto || ""
    }).eq("id", selectedLoad.id);
    if (!error) { setLumperSaved(true); showToast(`Lumper $${lumperAmount} saved ✓`); await fetchData(); }
    else showToast("Save failed", "error");
    setLumperSaving(false);
  };

  // Styles
  const S = {
    screen: { minHeight: "100vh", background: "#0f172a", fontFamily: "'DM Sans','Segoe UI',sans-serif", color: "#e2e8f0", paddingBottom: 80 },
    header: { background: "#1e293b", padding: "16px 20px", display: "flex", alignItems: "center", gap: 14, borderBottom: "1px solid rgba(255,255,255,0.08)", position: "sticky", top: 0, zIndex: 100 },
    card: { background: "#1e293b", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 16, padding: "18px 20px", marginBottom: 14 },
    bigBtn: (color) => ({ background: color, color: "#fff", border: "none", borderRadius: 14, padding: "18px 20px", fontWeight: 800, cursor: "pointer", fontSize: 16, width: "100%", marginBottom: 12, display: "flex", alignItems: "center", gap: 12 }),
    smallBtn: (color) => ({ background: color, color: "#fff", border: "none", borderRadius: 10, padding: "13px 20px", fontWeight: 700, cursor: "pointer", fontSize: 14, width: "100%" }),
    label: { color: "#64748b", fontSize: 10, fontWeight: 700, letterSpacing: 1, textTransform: "uppercase", marginBottom: 6, display: "block" },
    input: { background: "#0f172a", border: "1px solid rgba(255,255,255,0.15)", borderRadius: 10, color: "#fff", padding: "14px", fontSize: 15, width: "100%", boxSizing: "border-box", outline: "none" },
    tag: (color) => ({ background: color + "20", color, border: `1px solid ${color}44`, borderRadius: 20, padding: "3px 12px", fontSize: 11, fontWeight: 700 }),
  };

  const statusColor = { Pending: "#64748b", "In Transit": "#f59e0b", Delivered: "#16a34a", Cancelled: "#dc2626" };

  if (authLoading) return <div style={{ ...S.screen, display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 16 }}><div style={{ fontSize: 56 }}>⛟</div><div style={{ color: "#f59e0b", fontSize: 22, fontWeight: 900 }}>BHANDARI</div></div>;
  if (!session) return <LoginScreen onLogin={() => {}} />;

  // ── HOME SCREEN ────────────────────────────────────────────────────────────
  if (screen === "home") return (
    <div style={S.screen}>
      <div style={S.header}>
        <div style={{ fontSize: 28 }}>⛟</div>
        <div><div style={{ color: "#f59e0b", fontWeight: 900, fontSize: 16 }}>BHANDARI DRIVER</div><div style={{ color: "#64748b", fontSize: 11 }}>{session.user.email}</div></div>
        <button onClick={() => db.auth.signOut()} style={{ marginLeft: "auto", background: "rgba(255,255,255,0.06)", color: "#64748b", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, padding: "7px 12px", cursor: "pointer", fontSize: 11 }}>Sign Out</button>
      </div>

      <div style={{ padding: "20px 16px" }}>
        {/* Pre-trip button - prominent */}
        <div style={{ background: "linear-gradient(135deg,#f59e0b,#d97706)", borderRadius: 16, padding: "20px", marginBottom: 20, cursor: "pointer" }} onClick={() => { setPretripDone(false); setPretripItems({}); setScreen("pretrip"); }}>
          <div style={{ fontSize: 32, marginBottom: 8 }}>📋</div>
          <div style={{ color: "#fff", fontWeight: 900, fontSize: 20 }}>Start Pre-Trip Inspection</div>
          <div style={{ color: "rgba(255,255,255,0.8)", fontSize: 13, marginTop: 4 }}>Complete before every trip — DOT required</div>
        </div>

        <div style={{ color: "#64748b", fontSize: 11, fontWeight: 700, letterSpacing: 1, textTransform: "uppercase", marginBottom: 12 }}>My Loads ({myLoads.length})</div>

        {loading && <div style={{ textAlign: "center", color: "#64748b", padding: 40 }}>Loading...</div>}

        {myLoads.map(l => (
          <div key={l.id} style={S.card} onClick={() => { setSelectedLoad(l); setScreen("load"); setScanSaved(false); setDeliverySaved(false); setLumperSaved(false); setDeliveryPhoto(null); setLumperPhoto(null); setScanPreview(null); setScanResult(null); setDetentionSeconds(0); setDetentionRunning(false); setDetentionSaved(false); }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
              <div style={{ color: "#f59e0b", fontWeight: 900, fontSize: 18 }}>{l.loadNum}</div>
              <span style={S.tag(statusColor[l.status] || "#64748b")}>{l.status}</span>
            </div>
            <div style={{ color: "#fff", fontWeight: 700, fontSize: 15, marginBottom: 6 }}>{l.origin} → {l.dest}</div>
            <div style={{ display: "flex", gap: 16, color: "#64748b", fontSize: 12 }}>
              <span>📅 {l.date}</span>
              <span>🛣️ {Number(l.miles || 0).toLocaleString()} mi</span>
              {l.brokerName && <span>🏢 {l.brokerName}</span>}
            </div>
            {l.driverNotes && <div style={{ background: "#0f172a", borderRadius: 8, padding: "8px 12px", marginTop: 10, color: "#94a3b8", fontSize: 13 }}>📝 {l.driverNotes}</div>}
          </div>
        ))}

        {!loading && myLoads.length === 0 && (
          <div style={{ textAlign: "center", padding: "40px 20px" }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>🚛</div>
            <div style={{ color: "#64748b" }}>No loads assigned yet</div>
          </div>
        )}
      </div>

      {toast && <div style={{ position: "fixed", bottom: 20, left: 16, right: 16, background: toast.type === "error" ? "#dc2626" : "#16a34a", color: "#fff", borderRadius: 12, padding: "14px 20px", fontWeight: 700, fontSize: 14, textAlign: "center", zIndex: 9999 }}>{toast.msg}</div>}
    </div>
  );

  // ── PRE-TRIP SCREEN ────────────────────────────────────────────────────────
  if (screen === "pretrip") {
    const checkedOk = Object.values(pretripItems).filter(v => v === "ok").length;
    const checkedIssue = Object.values(pretripItems).filter(v => v === "issue").length;
    const total = PRETRIP_ITEMS.length;
    const pct = Math.round((checkedOk / total) * 100);

    return (
      <div style={S.screen}>
        <div style={S.header}>
          <button onClick={() => setScreen("home")} style={{ background: "none", border: "none", color: "#f59e0b", fontSize: 22, cursor: "pointer" }}>←</button>
          <div style={{ color: "#fff", fontWeight: 900, fontSize: 16 }}>📋 Pre-Trip Inspection</div>
          <div style={{ marginLeft: "auto", color: "#f59e0b", fontWeight: 800 }}>{checkedOk + checkedIssue}/{total}</div>
        </div>

        {pretripDone ? (
          <div style={{ padding: 24, textAlign: "center" }}>
            <div style={{ fontSize: 80, marginBottom: 16 }}>✅</div>
            <div style={{ color: "#16a34a", fontWeight: 900, fontSize: 24, marginBottom: 8 }}>Pre-Trip Complete!</div>
            <div style={{ color: "#64748b", fontSize: 14, marginBottom: 8 }}>{checkedOk} OK · {checkedIssue} Issues</div>
            <button onClick={() => setScreen("home")} style={S.smallBtn("linear-gradient(135deg,#f59e0b,#d97706)")}>← Back to Home</button>
          </div>
        ) : (
          <div style={{ padding: "16px" }}>
            {/* Progress bar */}
            <div style={{ ...S.card, marginBottom: 16 }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                <span style={{ color: "#64748b", fontSize: 12 }}>Progress</span>
                <span style={{ color: "#f59e0b", fontWeight: 700 }}>{pct}%</span>
              </div>
              <div style={{ background: "#0f172a", borderRadius: 99, height: 8 }}>
                <div style={{ width: `${pct}%`, height: "100%", background: pct === 100 ? "#16a34a" : "#f59e0b", borderRadius: 99, transition: "width 0.3s" }} />
              </div>
              {checkedIssue > 0 && <div style={{ color: "#dc2626", fontSize: 12, marginTop: 8 }}>⚠️ {checkedIssue} issue{checkedIssue > 1 ? "s" : ""} found — document and report</div>}
            </div>

            {/* Truck selector */}
            <div style={{ marginBottom: 16 }}>
              <label style={S.label}>Select Your Truck</label>
              <select value={pretripTruckId} onChange={e => setPretripTruckId(e.target.value)} style={S.input}>
                <option value="">-- Select Truck --</option>
                {trucks.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </div>

            {/* Checklist by category */}
            {CATEGORIES.map(cat => (
              <div key={cat} style={S.card}>
                <div style={{ color: "#f59e0b", fontWeight: 800, fontSize: 14, marginBottom: 14, textTransform: "uppercase", letterSpacing: 1 }}>{cat}</div>
                {PRETRIP_ITEMS.filter(i => i.category === cat).map(item => (
                  <div key={item.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 0", borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
                    <span style={{ color: pretripItems[item.id] === "ok" ? "#16a34a" : pretripItems[item.id] === "issue" ? "#dc2626" : "#94a3b8", fontSize: 14, flex: 1 }}>{item.label}</span>
                    <div style={{ display: "flex", gap: 8 }}>
                      <button onClick={() => setPretripItems(p => ({ ...p, [item.id]: p[item.id] === "ok" ? undefined : "ok" }))}
                        style={{ background: pretripItems[item.id] === "ok" ? "#16a34a" : "#0f172a", border: `2px solid ${pretripItems[item.id] === "ok" ? "#16a34a" : "rgba(255,255,255,0.2)"}`, borderRadius: 8, color: "#fff", padding: "8px 14px", cursor: "pointer", fontWeight: 700, fontSize: 13 }}>✓ OK</button>
                      <button onClick={() => setPretripItems(p => ({ ...p, [item.id]: p[item.id] === "issue" ? undefined : "issue" }))}
                        style={{ background: pretripItems[item.id] === "issue" ? "#dc2626" : "#0f172a", border: `2px solid ${pretripItems[item.id] === "issue" ? "#dc2626" : "rgba(255,255,255,0.2)"}`, borderRadius: 8, color: "#fff", padding: "8px 14px", cursor: "pointer", fontWeight: 700, fontSize: 13 }}>⚠️</button>
                    </div>
                  </div>
                ))}
              </div>
            ))}

            {/* Photo of truck */}
            <div style={S.card}>
              <div style={{ color: "#f59e0b", fontWeight: 800, fontSize: 14, marginBottom: 14 }}>📸 TRUCK PHOTO</div>
              <input type="file" accept="image/*" capture="environment" style={{ display: "none" }} ref={r => r && (r.onchange = async (e) => { const f = e.target.files[0]; if (f) { const b = await toBase64(f); setPretripPhoto(b); } })} id="pretripPhoto" />
              {pretripPhoto ? <img src={pretripPhoto} style={{ width: "100%", borderRadius: 10, marginBottom: 10 }} alt="truck" /> : null}
              <button onClick={() => document.getElementById("pretripPhoto").click()} style={S.smallBtn("#334155")}>📷 {pretripPhoto ? "Retake Photo" : "Take Truck Photo"}</button>
            </div>

            {/* Notes */}
            <div style={S.card}>
              <label style={S.label}>Notes / Issues Found</label>
              <textarea value={pretripNotes} onChange={e => setPretripNotes(e.target.value)} placeholder="Describe any issues found..." rows={3}
                style={{ ...S.input, resize: "vertical", lineHeight: 1.5 }} />
            </div>

            <button onClick={savePretrip} disabled={pretripSaving || !pretripTruckId}
              style={{ ...S.smallBtn(pretripTruckId ? "linear-gradient(135deg,#16a34a,#15803d)" : "#334155"), padding: "18px", fontSize: 17, fontWeight: 900, marginBottom: 20, opacity: pretripTruckId ? 1 : 0.5 }}>
              {pretripSaving ? "Saving..." : `✅ Submit Pre-Trip (${checkedOk}/${total} OK)`}
            </button>
          </div>
        )}
        {toast && <div style={{ position: "fixed", bottom: 20, left: 16, right: 16, background: toast.type === "error" ? "#dc2626" : "#16a34a", color: "#fff", borderRadius: 12, padding: "14px 20px", fontWeight: 700, fontSize: 14, textAlign: "center", zIndex: 9999 }}>{toast.msg}</div>}
      </div>
    );
  }

  // ── LOAD DETAIL SCREEN ─────────────────────────────────────────────────────
  if (screen === "load" && selectedLoad) {
    const l = selectedLoad;
    return (
      <div style={S.screen}>
        <div style={S.header}>
          <button onClick={() => setScreen("home")} style={{ background: "none", border: "none", color: "#f59e0b", fontSize: 22, cursor: "pointer" }}>←</button>
          <div><div style={{ color: "#f59e0b", fontWeight: 900 }}>{l.loadNum}</div><div style={{ color: "#64748b", fontSize: 11 }}>{l.origin} → {l.dest}</div></div>
          <span style={{ ...S.tag(statusColor[l.status] || "#64748b"), marginLeft: "auto" }}>{l.status}</span>
        </div>

        <div style={{ padding: "16px" }}>
          {/* Load info */}
          <div style={S.card}>
            <div style={{ color: "#f59e0b", fontWeight: 800, fontSize: 12, letterSpacing: 1, textTransform: "uppercase", marginBottom: 12 }}>Load Details</div>
            {[
              { l: "Date", v: l.date },
              { l: "Origin", v: l.origin },
              { l: "Destination", v: l.dest },
              { l: "Miles", v: Number(l.miles || 0).toLocaleString() + " mi" },
              { l: "Broker", v: l.brokerName || "—" },
              { l: "Rate", v: fmt$(l.rate) },
            ].map(r => (
              <div key={r.l} style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
                <span style={{ color: "#64748b", fontSize: 13 }}>{r.l}</span>
                <span style={{ color: "#fff", fontWeight: 600, fontSize: 13 }}>{r.v}</span>
              </div>
            ))}
            {l.driverNotes && <div style={{ background: "#0f172a", borderRadius: 8, padding: "10px 12px", marginTop: 10, color: "#94a3b8", fontSize: 13 }}>📝 {l.driverNotes}</div>}
          </div>

          {/* Status update */}
          <div style={S.card}>
            <div style={{ color: "#f59e0b", fontWeight: 800, fontSize: 12, letterSpacing: 1, textTransform: "uppercase", marginBottom: 12 }}>Update Status</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              {["Pending", "In Transit", "Delivered", "Cancelled"].map(s => (
                <button key={s} onClick={() => updateStatus(l.id, s)}
                  style={{ background: l.status === s ? statusColor[s] : "#0f172a", border: `2px solid ${l.status === s ? statusColor[s] : "rgba(255,255,255,0.1)"}`, borderRadius: 10, color: "#fff", padding: "12px", cursor: "pointer", fontWeight: 700, fontSize: 13 }}>
                  {s === "In Transit" ? "🚛 In Transit" : s === "Delivered" ? "✅ Delivered" : s === "Pending" ? "⏳ Pending" : "❌ Cancelled"}
                </button>
              ))}
            </div>
          </div>

          {/* Document Scanner */}
          <div style={S.card}>
            <div style={{ color: "#f59e0b", fontWeight: 800, fontSize: 12, letterSpacing: 1, textTransform: "uppercase", marginBottom: 12 }}>📄 Scan Document</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginBottom: 14 }}>
              {["BOL", "Rate Con", "Delivery Receipt", "Lumper Receipt", "Other"].map(t => (
                <button key={t} onClick={() => { setScanType(t); setScanPreview(null); setScanResult(null); setScanSaved(false); }}
                  style={{ background: scanType === t ? "#2563eb" : "#0f172a", border: `1.5px solid ${scanType === t ? "#2563eb" : "rgba(255,255,255,0.1)"}`, borderRadius: 8, color: "#fff", padding: "8px 6px", cursor: "pointer", fontWeight: 600, fontSize: 11, textAlign: "center" }}>
                  {t}
                </button>
              ))}
            </div>

            {scanSaved ? (
              <div style={{ textAlign: "center", padding: "20px 0" }}>
                <div style={{ fontSize: 40, marginBottom: 8 }}>✅</div>
                <div style={{ color: "#16a34a", fontWeight: 700 }}>{scanType} saved to load!</div>
                <button onClick={() => { setScanSaved(false); setScanPreview(null); setScanResult(null); }} style={{ ...S.smallBtn("#334155"), marginTop: 12 }}>Scan Another</button>
              </div>
            ) : (
              <>
                <input ref={scanRef} type="file" accept="image/*,application/pdf" capture="environment" style={{ display: "none" }} onChange={handleScan} />
                {!scanPreview ? (
                  <button onClick={() => scanRef.current?.click()} style={S.smallBtn("#1e40af")}>
                    📷 Scan / Photo {scanType}
                  </button>
                ) : (
                  <>
                    {scanPreview.startsWith("data:image") && <img src={scanPreview} style={{ width: "100%", borderRadius: 10, marginBottom: 10 }} alt="scan" />}
                    {scanning ? (
                      <div style={{ textAlign: "center", padding: "16px 0", color: "#f59e0b" }}>🤖 AI reading document...</div>
                    ) : scanResult ? (
                      <div style={{ background: "#0f172a", borderRadius: 10, padding: "12px", marginBottom: 12 }}>
                        <div style={{ color: "#94a3b8", fontSize: 12, fontWeight: 700, marginBottom: 6 }}>📋 AI SUMMARY:</div>
                        <div style={{ color: "#e2e8f0", fontSize: 13, lineHeight: 1.6, whiteSpace: "pre-line" }}>{scanResult}</div>
                      </div>
                    ) : null}
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                      <button onClick={() => { setScanPreview(null); setScanResult(null); }} style={S.smallBtn("#334155")}>🔄 Retake</button>
                      <button onClick={saveScan} disabled={scanning} style={S.smallBtn("#16a34a")}>💾 Save to Load</button>
                    </div>
                  </>
                )}
              </>
            )}
          </div>

          {/* Detention Timer */}
          <div style={S.card}>
            <div style={{ color: "#f59e0b", fontWeight: 800, fontSize: 12, letterSpacing: 1, textTransform: "uppercase", marginBottom: 12 }}>⏱️ Detention Timer</div>
            {detentionSaved ? (
              <div style={{ textAlign: "center", padding: "16px 0" }}>
                <div style={{ fontSize: 36, marginBottom: 8 }}>✅</div>
                <div style={{ color: "#16a34a", fontWeight: 700 }}>Detention logged!</div>
                <div style={{ color: "#64748b", fontSize: 13, marginTop: 4 }}>{Math.round(detentionSeconds / 60)} minutes recorded</div>
              </div>
            ) : (
              <>
                <div style={{ textAlign: "center", marginBottom: 16 }}>
                  <div style={{ color: detentionRunning ? "#f59e0b" : "#fff", fontFamily: "monospace", fontSize: 48, fontWeight: 900 }}>{fmtTime(detentionSeconds)}</div>
                  {detentionRunning && <div style={{ color: "#f59e0b", fontSize: 12, marginTop: 4 }}>⏱️ Timer running...</div>}
                </div>
                {!detentionRunning ? (
                  <button onClick={startDetention} style={S.smallBtn("linear-gradient(135deg,#f59e0b,#d97706)")}>▶️ Start Detention Timer</button>
                ) : (
                  <>
                    <div style={{ marginBottom: 10 }}>
                      <label style={S.label}>Reason for Detention</label>
                      <input value={detentionNotes} onChange={e => setDetentionNotes(e.target.value)} placeholder="e.g. Waiting to unload, dock backed up..." style={S.input} />
                    </div>
                    <button onClick={stopAndSaveDetention} style={S.smallBtn("#dc2626")}>⏹️ Stop & Save Detention</button>
                  </>
                )}
              </>
            )}
          </div>

          {/* Lumper */}
          <div style={S.card}>
            <div style={{ color: "#f59e0b", fontWeight: 800, fontSize: 12, letterSpacing: 1, textTransform: "uppercase", marginBottom: 12 }}>🧾 Lumper Fee</div>
            {lumperSaved ? (
              <div style={{ textAlign: "center", padding: "16px 0" }}>
                <div style={{ fontSize: 36, marginBottom: 8 }}>✅</div>
                <div style={{ color: "#16a34a", fontWeight: 700 }}>Lumper ${lumperAmount} saved!</div>
              </div>
            ) : (
              <>
                <div style={{ marginBottom: 12 }}>
                  <label style={S.label}>Amount Paid ($)</label>
                  <input type="number" value={lumperAmount} onChange={e => setLumperAmount(e.target.value)} placeholder="0.00" style={S.input} />
                </div>
                <input ref={lumperRef} type="file" accept="image/*" capture="environment" style={{ display: "none" }} onChange={handleLumperPhoto} />
                {lumperPhoto && <img src={lumperPhoto} style={{ width: "100%", borderRadius: 10, marginBottom: 10 }} alt="receipt" />}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 10 }}>
                  <button onClick={() => lumperRef.current?.click()} style={S.smallBtn("#334155")}>📷 {lumperPhoto ? "Retake" : "Photo Receipt"}</button>
                  <button onClick={saveLumper} disabled={lumperSaving || !lumperAmount} style={S.smallBtn(lumperAmount ? "#16a34a" : "#334155")}>💾 Save Lumper</button>
                </div>
              </>
            )}
          </div>

          {/* Delivery Photo / POD */}
          <div style={S.card}>
            <div style={{ color: "#f59e0b", fontWeight: 800, fontSize: 12, letterSpacing: 1, textTransform: "uppercase", marginBottom: 12 }}>📸 Proof of Delivery</div>
            {deliverySaved ? (
              <div style={{ textAlign: "center", padding: "16px 0" }}>
                <div style={{ fontSize: 36, marginBottom: 8 }}>✅</div>
                <div style={{ color: "#16a34a", fontWeight: 700 }}>Delivery photo saved!</div>
                <div style={{ color: "#64748b", fontSize: 13 }}>Load marked as Delivered</div>
              </div>
            ) : (
              <>
                <input ref={deliveryRef} type="file" accept="image/*" capture="environment" style={{ display: "none" }} onChange={handleDeliveryPhoto} />
                {deliveryPhoto && <img src={deliveryPhoto} style={{ width: "100%", borderRadius: 10, marginBottom: 10 }} alt="delivery" />}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                  <button onClick={() => deliveryRef.current?.click()} style={S.smallBtn("#334155")}>📷 {deliveryPhoto ? "Retake" : "Take Photo"}</button>
                  <button onClick={saveDeliveryPhoto} disabled={deliverySaving || !deliveryPhoto} style={S.smallBtn(deliveryPhoto ? "#16a34a" : "#334155")}>✅ Confirm Delivery</button>
                </div>
              </>
            )}
          </div>
        </div>

        {toast && <div style={{ position: "fixed", bottom: 20, left: 16, right: 16, background: toast.type === "error" ? "#dc2626" : "#16a34a", color: "#fff", borderRadius: 12, padding: "14px 20px", fontWeight: 700, fontSize: 14, textAlign: "center", zIndex: 9999 }}>{toast.msg}</div>}
      </div>
    );
  }

  return null;
}
