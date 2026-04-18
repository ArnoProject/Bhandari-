import { useState, useRef, useEffect } from "react";
import { createClient } from "@supabase/supabase-js";

const SUPA_URL = "https://ajwniougsadsvfaaxryb.supabase.co";
const SUPA_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFqd25pb3Vnc2Fkc3ZmYWF4cnliIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzYxMjEzMDksImV4cCI6MjA5MTY5NzMwOX0.rSvnFp6msExdw1b_UBL5d04HioZzSadaaGSjIOmPLc0";
const db = createClient(SUPA_URL, SUPA_KEY);

// Apex Capital factoring rates
const APEX_FEE_PCT = 2.30;
const APEX_RESERVE_PCT = 5.00;

const calcFactoring = (gross) => {
  const g = Number(gross || 0);
  const fee = g * (APEX_FEE_PCT / 100);
  const reserve = g * (APEX_RESERVE_PCT / 100);
  const advance = g - fee - reserve;
  return { gross: g, fee, reserve, advance };
};

const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
const today = () => new Date().toISOString().slice(0, 10);
const fmt$ = (n) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2 }).format(n || 0);
const fmtN = (n, d = 2) => Number(n || 0).toFixed(d);
const fmtMi = (n) => Number(n || 0).toLocaleString();

const TRUCK_COLORS = [
  { value: "#d97706", label: "🟡 Gold" }, { value: "#2563eb", label: "🔵 Blue" },
  { value: "#16a34a", label: "🟢 Green" }, { value: "#dc2626", label: "🔴 Red" },
  { value: "#7c3aed", label: "🟣 Purple" }, { value: "#ea580c", label: "🟠 Orange" },
  { value: "#0891b2", label: "🩵 Cyan" }, { value: "#db2777", label: "🩷 Pink" },
  { value: "#65a30d", label: "🟢 Lime" }, { value: "#0d9488", label: "🩵 Teal" },
];
const EXP_CATS = ["Maintenance","Repairs","Insurance","Permits","Registration","Tires","Equipment","Tolls","Office","Factoring","Other"];
const MAKES = ["Kenworth","Peterbilt","Freightliner","Volvo","International","Mack","Western Star","Other"];
const TRAILER_MAKES = ["Utility","Wabash","Great Dane","Hyundai","Stoughton","Vanguard","Other"];
const TRAILER_TYPES = ["Reefer","Dry Van","Flatbed","Step Deck","Lowboy","Tanker","Other"];
const STATUSES = ["Pending","In Transit","Delivered","Cancelled"];
const FACTORING_STATUSES = ["Not Submitted","Ready to Factor","Submitted","Advance Received","Reserve Released","On Hold"];
const MAINT_CATS = ["Oil Change","Brake Service","Tire Change/Rotation","DOT Inspection","Filter Replace","Coolant Service","Transmission","DPF/DEF","Lights","Other"];
const TIRE_POSITIONS_TRUCK = ["Steer - Left","Steer - Right","Drive Axle 1 - Left Outer","Drive Axle 1 - Left Inner","Drive Axle 1 - Right Inner","Drive Axle 1 - Right Outer","Drive Axle 2 - Left Outer","Drive Axle 2 - Left Inner","Drive Axle 2 - Right Inner","Drive Axle 2 - Right Outer"];
const TIRE_POSITIONS_TRAILER = ["Axle 1 - Left Outer","Axle 1 - Left Inner","Axle 1 - Right Inner","Axle 1 - Right Outer","Axle 2 - Left Outer","Axle 2 - Left Inner","Axle 2 - Right Inner","Axle 2 - Right Outer","Axle 3 - Left Outer","Axle 3 - Left Inner","Axle 3 - Right Inner","Axle 3 - Right Outer"];
const BRAKE_POSITIONS_TRUCK = ["Front Axle - Left","Front Axle - Right","Drive Axle 1 - Left","Drive Axle 1 - Right","Drive Axle 2 - Left","Drive Axle 2 - Right"];
const BRAKE_POSITIONS_TRAILER = ["Axle 1 - Left","Axle 1 - Right","Axle 2 - Left","Axle 2 - Right","Axle 3 - Left","Axle 3 - Right"];
const LUMPER_PAID_BY = ["Out of Pocket","Broker Paid","Company Paid"];
const LUMPER_REIMBURSED = ["Yes","No","Pending"];
const INSURANCE_FREQ = ["Monthly","Quarterly","Semi-Annual","Annual"];
const COVERAGE_TYPES = ["Primary Liability","Cargo","Physical Damage","General Liability","Occupational Accident","Bobtail","Full Fleet Policy"];

const searchCities = async (query) => {
  if (!query || query.length < 2) return [];
  try {
    const res = await fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&addressdetails=1&limit=8&countrycodes=us`, { headers: { "Accept-Language": "en" } });
    const data = await res.json();
    return data.filter(d => d.address && (d.address.city || d.address.town || d.address.village || d.address.county)).map(d => {
      const city = d.address.city || d.address.town || d.address.village || d.address.county;
      const state = d.address.state_code || d.address.state || "";
      return { label: `${city}, ${state}`, lat: parseFloat(d.lat), lon: parseFloat(d.lon) };
    }).filter((v, i, a) => a.findIndex(t => t.label === v.label) === i);
  } catch { return []; }
};

const calcMiles = async (origin, dest) => {
  try {
    const res = await fetch(`https://router.project-osrm.org/route/v1/driving/${origin.lon},${origin.lat};${dest.lon},${dest.lat}?overview=false`);
    const data = await res.json();
    if (data.routes?.[0]) return Math.round(data.routes[0].distance / 1609.34);
    return null;
  } catch { return null; }
};

const parseWithAI = async (base64Data, mediaType, prompt) => {
  try {
    const response = await fetch("/api/parse", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001", max_tokens: 2000,
        messages: [{ role: "user", content: [
          { type: mediaType.includes("pdf") ? "document" : "image", source: { type: "base64", media_type: mediaType, data: base64Data } },
          { type: "text", text: prompt }
        ]}]
      })
    });
    const data = await response.json();
    if (data.error) { console.error("AI error:", data.error); return null; }
    const text = data.content?.[0]?.text || "";
    if (!text) return null;
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) return JSON.parse(jsonMatch[0]);
    return JSON.parse(text.replace(/```json|```/g, "").trim());
  } catch (e) { console.error("parseWithAI error:", e); return null; }
};

const parseTCSCsv = (text) => {
  const lines = text.trim().split("\n").filter(l => l.trim());
  if (lines.length < 2) return [];
  const header = lines[0].toLowerCase().split(",").map(h => h.trim().replace(/"/g, ""));
  return lines.slice(1).map(line => {
    const cols = line.split(",").map(c => c.trim().replace(/"/g, ""));
    const obj = {}; header.forEach((h, i) => { obj[h] = cols[i] || ""; });
    const gallons = parseFloat(obj.gallons || obj.qty || obj.quantity || 0);
    const ppg = parseFloat(obj.ppg || obj.price || obj["unit price"] || 0);
    const total = parseFloat(obj.amount || obj.total || obj["net amount"] || (gallons * ppg) || 0);
    const date = obj.date || obj["trans date"] || obj["transaction date"] || "";
    const loc = obj.location || obj.site || obj.merchant || obj.store || "";
    const truck = obj.truck || obj.unit || obj.vehicle || obj["card #"] || "";
    if (!date || gallons === 0) return null;
    return { id: uid(), date, truckRaw: truck.trim(), gallons, price_per: ppg, total: Math.abs(total), location: loc, load_num: "" };
  }).filter(Boolean);
};

const printPaystub = (driver, driverLoads, period) => {
  const totalGross = driverLoads.reduce((s, l) => s + Number(l.rate || 0) + Number(l.detention || 0), 0);
  const totalPay = driverLoads.reduce((s, l) => {
    const mi = l.isTeamLoad ? Number(l.miles || 0) / 2 : Number(l.miles || 0);
    return s + Number(l.driverCpm || 0) * mi + Number(l.driverOopExpenses || 0);
  }, 0);
  const totalMiles = driverLoads.reduce((s, l) => s + (l.isTeamLoad ? Number(l.miles || 0) / 2 : Number(l.miles || 0)), 0);
  const totalDetention = driverLoads.reduce((s, l) => s + Number(l.detention || 0), 0);
  const w = window.open("", "_blank");
  w.document.write(`<html><head><title>Paystub - ${driver}</title><style>body{font-family:'Courier New',monospace;max-width:700px;margin:40px auto;color:#111}.header{text-align:center;border-bottom:3px solid #000;padding-bottom:20px;margin-bottom:20px}.row{display:flex;justify-content:space-between;padding:5px 0;font-size:14px}.row.total{font-weight:900;font-size:17px;border-top:2px solid #000;margin-top:10px;padding-top:10px}.load-row{display:grid;grid-template-columns:1fr 2fr 1fr 1fr 1fr;gap:8px;padding:6px 0;border-bottom:1px solid #eee;font-size:12px}.section-title{font-weight:900;font-size:12px;text-transform:uppercase;border-bottom:1px solid #000;padding-bottom:4px;margin-bottom:10px;margin-top:20px}</style></head><body><div class="header"><div style="font-size:24px;font-weight:900">⛟ BHANDARI LOGISTICS LLC</div><div>DRIVER PAY STATEMENT</div></div><div class="row"><span>Driver:</span><span><b>${driver}</b></span></div><div class="row"><span>Period:</span><span>${period}</span></div><div class="row"><span>Loads:</span><span>${driverLoads.length}</span></div><div class="row"><span>Miles:</span><span>${fmtMi(totalMiles)}</span></div><div class="section-title">Load Detail</div>${driverLoads.map(l => { const g = Number(l.rate || 0) + Number(l.detention || 0); const pay = g * (Number(l.driverPct || 0) / 100); return `<div class="load-row"><span>${l.loadNum}</span><span>${(l.origin||'').split(',')[0]} → ${(l.dest||'').split(',')[0]}</span><span>${fmtMi(l.miles)}mi</span><span>${fmt$(g)}</span><span>${fmt$(pay)}</span></div>`; }).join('')}<div class="section-title">Summary</div><div class="row"><span>Gross:</span><span>${fmt$(totalGross)}</span></div><div class="row"><span>Detention:</span><span>${fmt$(totalDetention)}</span></div><div class="row total"><span>TOTAL PAY:</span><span>${fmt$(totalPay)}</span></div><script>window.onload=()=>window.print();</script></body></html>`);
  w.document.close();
};

// ─── SHARED UI ────────────────────────────────────────────────────────────────
const Badge = ({ label, color = "#6b7280" }) => (<span style={{ background: color + "18", color, border: `1.5px solid ${color}44`, borderRadius: 20, padding: "2px 10px", fontSize: 11, fontWeight: 700, whiteSpace: "nowrap" }}>{label}</span>);
const StatusBadge = ({ s }) => { const map = { Delivered: "#16a34a", "In Transit": "#d97706", Pending: "#6b7280", Cancelled: "#dc2626" }; return <Badge label={s} color={map[s] || "#6b7280"} />; };
const FactoringBadge = ({ s }) => { const map = { "Not Submitted": "#9ca3af", "Ready to Factor": "#2563eb", "Submitted": "#d97706", "Advance Received": "#16a34a", "Reserve Released": "#7c3aed", "On Hold": "#dc2626" }; return <Badge label={s} color={map[s] || "#9ca3af"} />; };
const StatCard = ({ label, value, sub, accent = "#2563eb", icon }) => (<div style={{ background: "#fff", border: `1.5px solid ${accent}30`, borderRadius: 13, padding: "18px 20px", position: "relative", overflow: "hidden", boxShadow: "0 1px 4px rgba(0,0,0,0.07)" }}><div style={{ position: "absolute", right: 14, top: 14, fontSize: 24, opacity: 0.12 }}>{icon}</div><div style={{ color: "#6b7280", fontSize: 10, fontWeight: 700, letterSpacing: 1.2, textTransform: "uppercase", marginBottom: 5 }}>{label}</div><div style={{ color: accent, fontSize: 22, fontWeight: 900, fontFamily: "'Courier New',monospace", lineHeight: 1 }}>{value}</div>{sub && <div style={{ color: "#9ca3af", fontSize: 11, marginTop: 5 }}>{sub}</div>}</div>);
const TH = ({ children }) => (<th style={{ background: "#f9fafb", color: "#6b7280", fontWeight: 700, fontSize: 10, letterSpacing: 1, textTransform: "uppercase", padding: "12px 14px", textAlign: "left", borderBottom: "1.5px solid #e5e7eb", whiteSpace: "nowrap" }}>{children}</th>);
const TD = ({ children, mono, color, bold }) => (<td style={{ padding: "11px 14px", borderBottom: "1px solid #f3f4f6", color: color || "#374151", fontFamily: mono ? "'Courier New',monospace" : undefined, fontWeight: bold ? 700 : 400, fontSize: 13, verticalAlign: "middle" }}>{children}</td>);
const PrimaryBtn = ({ onClick, children, style }) => (<button onClick={onClick} style={{ background: "linear-gradient(135deg,#d97706,#b45309)", color: "#fff", border: "none", borderRadius: 9, padding: "10px 20px", fontWeight: 800, cursor: "pointer", fontSize: 13, ...style }}>{children}</button>);
const SecondaryBtn = ({ onClick, children, style }) => (<button onClick={onClick} style={{ background: "#fff", color: "#2563eb", border: "1.5px solid #2563eb", borderRadius: 9, padding: "10px 16px", fontWeight: 700, cursor: "pointer", fontSize: 13, ...style }}>{children}</button>);
const SaveBtn = ({ onClick, label, loading }) => (<button onClick={onClick} disabled={loading} style={{ background: loading ? "#d1d5db" : "linear-gradient(135deg,#d97706,#b45309)", color: loading ? "#6b7280" : "#fff", border: "none", borderRadius: 10, padding: "13px 0", fontWeight: 900, cursor: loading ? "not-allowed" : "pointer", fontSize: 15, width: "100%", marginTop: 10 }}>{loading ? "Saving..." : label}</button>);
const AlertCard = ({ color, icon, title, sub }) => (<div style={{ background: color + "10", border: `1.5px solid ${color}44`, borderRadius: 10, padding: "12px 16px", display: "flex", alignItems: "center", gap: 12 }}><div style={{ fontSize: 24 }}>{icon}</div><div><div style={{ color, fontWeight: 700, fontSize: 13 }}>{title}</div><div style={{ color: "#6b7280", fontSize: 12 }}>{sub}</div></div></div>);

const inputStyle = { background: "#fff", border: "1.5px solid #d1d5db", borderRadius: 8, color: "#111827", padding: "10px 12px", fontSize: 13, width: "100%", boxSizing: "border-box", outline: "none" };
const labelStyle = { color: "#6b7280", fontSize: 10, fontWeight: 700, letterSpacing: 1, textTransform: "uppercase" };
const fgrid = { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 14 };

const Field = ({ label, type = "text", value, onChange, options, span, placeholder }) => (
  <div style={{ display: "flex", flexDirection: "column", gap: 5, gridColumn: span ? "1 / -1" : undefined }}>
    <label style={labelStyle}>{label}</label>
    {options ? (<select value={value} onChange={e => onChange(e.target.value)} style={inputStyle}>{options.map(o => <option key={o.value ?? o} value={o.value ?? o}>{o.label ?? o}</option>)}</select>) : (<input type={type} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} style={inputStyle} />)}
  </div>
);

const ModalShell = ({ title, onClose, children, wide, extraWide }) => (
  <div style={{ position: "fixed", inset: 0, background: "#00000066", zIndex: 9999, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }} onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
    <div style={{ background: "#fff", border: "1.5px solid #e5e7eb", borderRadius: 16, width: extraWide ? "min(1100px,97vw)" : wide ? "min(900px,97vw)" : "min(700px,96vw)", maxHeight: "94vh", overflowY: "auto", padding: 28, boxShadow: "0 20px 60px rgba(0,0,0,0.15)" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 22 }}>
        <h2 style={{ margin: 0, color: "#111827", fontSize: 18, fontWeight: 900 }}>{title}</h2>
        <button onClick={onClose} style={{ background: "#f3f4f6", border: "none", color: "#6b7280", cursor: "pointer", fontSize: 18, borderRadius: 8, width: 32, height: 32, display: "flex", alignItems: "center", justifyContent: "center" }}>×</button>
      </div>
      {children}
    </div>
  </div>
);

// ─── LOGIN SCREEN ─────────────────────────────────────────────────────────────
const LoginScreen = ({ onLogin }) => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleLogin = async () => {
    if (!email || !password) { setError("Please enter your email and password"); return; }
    setLoading(true); setError("");
    const { error } = await db.auth.signInWithPassword({ email, password });
    if (error) setError("Invalid email or password. Please try again.");
    else onLogin();
    setLoading(false);
  };

  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "100vh", background: "#f3f4f6", fontFamily: "'DM Sans','Segoe UI',sans-serif" }}>
      <div style={{ background: "#fff", borderRadius: 20, padding: "48px 40px", width: "min(440px,92vw)", boxShadow: "0 20px 60px rgba(0,0,0,0.12)", border: "1.5px solid #e5e7eb" }}>
        <div style={{ textAlign: "center", marginBottom: 36 }}>
          <div style={{ fontSize: 56, marginBottom: 10 }}>⛟</div>
          <div style={{ fontSize: 28, fontWeight: 900, color: "#d97706", letterSpacing: 3 }}>BHANDARI</div>
          <div style={{ fontSize: 11, color: "#9ca3af", letterSpacing: 5, marginTop: 3 }}>LOGISTICS LLC</div>
          <div style={{ width: 50, height: 3, background: "linear-gradient(135deg,#d97706,#b45309)", borderRadius: 99, margin: "18px auto 0" }} />
        </div>
        <div style={{ textAlign: "center", color: "#374151", fontSize: 14, fontWeight: 600, marginBottom: 24 }}>Sign in to your fleet dashboard</div>
        {error && <div style={{ background: "#fef2f2", border: "1.5px solid #fecaca", borderRadius: 10, padding: "11px 14px", marginBottom: 18, color: "#dc2626", fontSize: 13, textAlign: "center" }}>⚠️ {error}</div>}
        <div style={{ marginBottom: 16 }}>
          <label style={labelStyle}>Email Address</label>
          <input type="email" value={email} onChange={e => setEmail(e.target.value)} onKeyDown={e => e.key === "Enter" && handleLogin()} placeholder="you@example.com" style={{ ...inputStyle, padding: "13px 14px", marginTop: 7, background: "#f9fafb" }} />
        </div>
        <div style={{ marginBottom: 28 }}>
          <label style={labelStyle}>Password</label>
          <input type="password" value={password} onChange={e => setPassword(e.target.value)} onKeyDown={e => e.key === "Enter" && handleLogin()} placeholder="••••••••" style={{ ...inputStyle, padding: "13px 14px", marginTop: 7, background: "#f9fafb" }} />
        </div>
        <button onClick={handleLogin} disabled={loading} style={{ background: loading ? "#d1d5db" : "linear-gradient(135deg,#d97706,#b45309)", color: loading ? "#6b7280" : "#fff", border: "none", borderRadius: 12, padding: "15px 0", fontWeight: 900, cursor: loading ? "not-allowed" : "pointer", fontSize: 16, width: "100%" }}>
          {loading ? "Signing in..." : "🔐 Sign In"}
        </button>
        <div style={{ textAlign: "center", marginTop: 20, color: "#9ca3af", fontSize: 12 }}>🔒 Secured · Bhandari Logistics LLC · Omaha, NE</div>
      </div>
    </div>
  );
};

// ─── CITY INPUT ───────────────────────────────────────────────────────────────
const CityInput = ({ label, value, onChange, onCitySelect, placeholder }) => {
  const [query, setQuery] = useState(value || "");
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [open, setOpen] = useState(false);
  const timer = useRef(null);
  useEffect(() => { setQuery(value || ""); }, [value]);
  const handleChange = (v) => {
    setQuery(v); onChange(v);
    clearTimeout(timer.current);
    if (v.length < 2) { setResults([]); setOpen(false); return; }
    setSearching(true);
    timer.current = setTimeout(async () => { const r = await searchCities(v); setResults(r); setOpen(r.length > 0); setSearching(false); }, 400);
  };
  const select = (city) => { setQuery(city.label); onChange(city.label); onCitySelect(city); setOpen(false); setResults([]); };
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 5, position: "relative" }}>
      <label style={labelStyle}>{label}</label>
      <div style={{ position: "relative" }}>
        <input value={query} onChange={e => handleChange(e.target.value)} onBlur={() => setTimeout(() => setOpen(false), 200)} onFocus={() => results.length > 0 && setOpen(true)} placeholder={placeholder || "Type city..."} style={{ ...inputStyle, paddingRight: 36 }} />
        <div style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)" }}>{searching ? "⏳" : "📍"}</div>
      </div>
      {open && results.length > 0 && (
        <div style={{ position: "absolute", top: "100%", left: 0, right: 0, background: "#fff", border: "1.5px solid #d1d5db", borderRadius: 8, zIndex: 9999, boxShadow: "0 8px 24px rgba(0,0,0,0.12)", maxHeight: 200, overflowY: "auto" }}>
          {results.map((r, i) => (<div key={i} onMouseDown={() => select(r)} style={{ padding: "10px 14px", cursor: "pointer", fontSize: 13, color: "#111827", borderBottom: i < results.length - 1 ? "1px solid #f3f4f6" : "none" }} onMouseEnter={e => e.currentTarget.style.background = "#f9fafb"} onMouseLeave={e => e.currentTarget.style.background = "#fff"}>📍 {r.label}</div>))}
        </div>
      )}
    </div>
  );
};

// ─── FORM COMPONENTS ──────────────────────────────────────────────────────────
const TruckForm = ({ onClose, onSave, saving, trucks, editId }) => {
  const existing = trucks.find(t => t.id === editId);
  const [f, setF] = useState(existing || { name: "", plate: "", year: "", make: "Kenworth", model: "", color: TRUCK_COLORS[0].value, active: true });
  return (
    <ModalShell title={editId ? "✏️ Edit Truck" : "🚚 Add Truck"} onClose={onClose}>
      <div style={fgrid}>
        <Field label="Truck Name / Number" value={f.name || ""} onChange={v => setF(p => ({ ...p, name: v }))} placeholder="e.g. Truck 102" />
        <Field label="License Plate" value={f.plate || ""} onChange={v => setF(p => ({ ...p, plate: v }))} placeholder="NE-0000" />
        <Field label="Year" value={f.year || ""} onChange={v => setF(p => ({ ...p, year: v }))} placeholder="2021" />
        <Field label="Make" value={f.make || "Kenworth"} onChange={v => setF(p => ({ ...p, make: v }))} options={MAKES} />
        <Field label="Model" value={f.model || ""} onChange={v => setF(p => ({ ...p, model: v }))} placeholder="T680, 389..." />
        <Field label="Color" value={f.color || TRUCK_COLORS[0].value} onChange={v => setF(p => ({ ...p, color: v }))} options={TRUCK_COLORS} />
        <Field label="Status" value={f.active ? "active" : "inactive"} onChange={v => setF(p => ({ ...p, active: v === "active" }))} options={[{ value: "active", label: "Active" }, { value: "inactive", label: "Inactive" }]} />
      </div>
      <SaveBtn onClick={() => onSave(f)} label={editId ? "💾 Update Truck" : "✅ Add Truck"} loading={saving} />
    </ModalShell>
  );
};

const TrailerForm = ({ onClose, onSave, saving, trailers, editId }) => {
  const existing = trailers.find(t => t.id === editId);
  const [f, setF] = useState(existing || { name: "", plate: "", year: "", make: "Utility", model: "", type: "Reefer", color: TRUCK_COLORS[2].value, active: true });
  return (
    <ModalShell title={editId ? "✏️ Edit Trailer" : "🚛 Add Trailer"} onClose={onClose}>
      <div style={fgrid}>
        <Field label="Trailer Number" value={f.name || ""} onChange={v => setF(p => ({ ...p, name: v }))} placeholder="e.g. Trailer 101" />
        <Field label="License Plate" value={f.plate || ""} onChange={v => setF(p => ({ ...p, plate: v }))} placeholder="NE-0000" />
        <Field label="Year" value={f.year || ""} onChange={v => setF(p => ({ ...p, year: v }))} placeholder="2020" />
        <Field label="Make" value={f.make || "Utility"} onChange={v => setF(p => ({ ...p, make: v }))} options={TRAILER_MAKES} />
        <Field label="Model" value={f.model || ""} onChange={v => setF(p => ({ ...p, model: v }))} placeholder="3000R..." />
        <Field label="Type" value={f.type || "Reefer"} onChange={v => setF(p => ({ ...p, type: v }))} options={TRAILER_TYPES} />
        <Field label="Color Tag" value={f.color || TRUCK_COLORS[2].value} onChange={v => setF(p => ({ ...p, color: v }))} options={TRUCK_COLORS} />
        <Field label="Status" value={f.active ? "active" : "inactive"} onChange={v => setF(p => ({ ...p, active: v === "active" }))} options={[{ value: "active", label: "Active" }, { value: "inactive", label: "Inactive" }]} />
      </div>
      <SaveBtn onClick={() => onSave(f)} label={editId ? "💾 Update Trailer" : "✅ Add Trailer"} loading={saving} />
    </ModalShell>
  );
};

const MaintenanceForm = ({ onClose, onSave, saving, trucks, trailers, editItem }) => {
  const [f, setF] = useState(editItem || { date: today(), entity_id: trucks[0]?.id || "", entity_type: "truck", category: "Oil Change", description: "", miles_at_service: "", next_due_miles: "", next_due_date: "", cost: "", position: "", notes: "" });
  const isTire = f.category === "Tire Change/Rotation";
  const isBrake = f.category === "Brake Service";
  const entityList = f.entity_type === "truck" ? trucks : trailers;
  const tirePos = f.entity_type === "truck" ? TIRE_POSITIONS_TRUCK : TIRE_POSITIONS_TRAILER;
  const brakePos = f.entity_type === "truck" ? BRAKE_POSITIONS_TRUCK : BRAKE_POSITIONS_TRAILER;
  return (
    <ModalShell title={editItem ? "✏️ Edit Service Record" : "🔧 Add Maintenance Record"} onClose={onClose} wide>
      <div style={fgrid}>
        <Field label="Equipment Type" value={f.entity_type} onChange={v => setF(p => ({ ...p, entity_type: v, entity_id: v === "truck" ? trucks[0]?.id || "" : trailers[0]?.id || "" }))} options={[{ value: "truck", label: "Truck" }, { value: "trailer", label: "Trailer" }]} />
        <Field label={f.entity_type === "truck" ? "Select Truck" : "Select Trailer"} value={f.entity_id} onChange={v => setF(p => ({ ...p, entity_id: v }))} options={entityList.map(e => ({ value: e.id, label: e.name }))} />
        <Field label="Service Date" type="date" value={f.date} onChange={v => setF(p => ({ ...p, date: v }))} />
        <Field label="Service Category" value={f.category} onChange={v => setF(p => ({ ...p, category: v, position: "" }))} options={MAINT_CATS} />
        {(isTire || isBrake) && <Field label={isTire ? "Tire Position" : "Brake Position"} value={f.position} onChange={v => setF(p => ({ ...p, position: v }))} options={isTire ? tirePos : brakePos} span />}
        <Field label="Miles at Service" type="number" value={f.miles_at_service} onChange={v => setF(p => ({ ...p, miles_at_service: v }))} placeholder="e.g. 450000" />
        <Field label="Next Due Miles" type="number" value={f.next_due_miles} onChange={v => setF(p => ({ ...p, next_due_miles: v }))} placeholder="e.g. 465000" />
        <Field label="Next Due Date" type="date" value={f.next_due_date} onChange={v => setF(p => ({ ...p, next_due_date: v }))} />
        <Field label="Cost ($)" type="number" value={f.cost} onChange={v => setF(p => ({ ...p, cost: v }))} placeholder="0.00" />
        <Field label="Description" value={f.description} onChange={v => setF(p => ({ ...p, description: v }))} placeholder="Details of service..." span />
        <Field label="Notes" value={f.notes} onChange={v => setF(p => ({ ...p, notes: v }))} placeholder="Additional notes..." span />
      </div>
      <SaveBtn onClick={() => onSave(f)} label={editItem ? "💾 Update Record" : "✅ Save Service Record"} loading={saving} />
    </ModalShell>
  );
};

const LoadForm = ({ onClose, onSave, saving, trucks, trailers, drivers, editItem }) => {
  const [f, setF] = useState(editItem || { date: today(), loadNum: "", origin: "", dest: "", miles: "", rate: "", detention: "0", driver: "", driverCpm: "0", driverOopExpenses: "0", isTeamLoad: false, driver2: "", driver2Cpm: "0", truckId: trucks[0]?.id || "", trailerId: "", status: "Pending", lumperCost: "0", lumperPaidBy: "Out of Pocket", lumperReimbursed: "No", lumperReimbursedAmount: "0", toll: "0", factoringStatus: "Not Submitted", brokerName: "", brokerMC: "" });
  const [originCoords, setOriginCoords] = useState(null);
  const [destCoords, setDestCoords] = useState(null);
  const [calcingMiles, setCalcingMiles] = useState(false);

  const handleOriginSelect = async (city) => { setOriginCoords(city); if (destCoords) { setCalcingMiles(true); const m = await calcMiles(city, destCoords); if (m) setF(p => ({ ...p, miles: String(m) })); setCalcingMiles(false); } };
  const handleDestSelect = async (city) => { setDestCoords(city); if (originCoords) { setCalcingMiles(true); const m = await calcMiles(originCoords, city); if (m) setF(p => ({ ...p, miles: String(m) })); setCalcingMiles(false); } };

  // Auto-fill CPM when driver selected from profile
  const handleDriverSelect = (name) => {
    const profile = drivers.find(d => d.name === name);
    const isTeam = profile?.isTeamDriver || false;
    const partner = profile?.teamPartner || "";
    const partnerProfile = partner ? drivers.find(d => d.name === partner) : null;
    setF(p => ({
      ...p,
      driver: name,
      driverCpm: profile ? String(profile.cpm) : p.driverCpm,
      isTeamLoad: isTeam ? true : p.isTeamLoad,
      driver2: isTeam && partner ? partner : p.driver2,
      driver2Cpm: isTeam && partnerProfile ? String(partnerProfile.cpm) : p.driver2Cpm,
    }));
  };
  const handleDriver2Select = (name) => {
    const profile = drivers.find(d => d.name === name);
    setF(p => ({ ...p, driver2: name, driver2Cpm: profile ? String(profile.cpm) : p.driver2Cpm }));
  };

  const g = Number(f.rate || 0) + Number(f.detention || 0);
  const splitMiles = f.isTeamLoad ? Number(f.miles || 0) / 2 : Number(f.miles || 0);
  const driverPay = Number(f.driverCpm || 0) * splitMiles;
  const driver2Pay = f.isTeamLoad ? Number(f.driver2Cpm || 0) * splitMiles : 0;
  const totalDriverPay = driverPay + driver2Pay;
  const driverOop = Number(f.driverOopExpenses || 0);
  const lumperNet = f.lumperPaidBy === "Out of Pocket" && f.lumperReimbursed !== "Yes" ? Number(f.lumperCost || 0) : 0;
  const profit = g - totalDriverPay - driverOop - lumperNet - Number(f.toll || 0);
  const fct = calcFactoring(g);

  return (
    <ModalShell title={editItem ? "✏️ Edit Load" : "🚛 Add Load"} onClose={onClose} wide>
      <div style={fgrid}>
        <Field label="Load Number" value={f.loadNum || ""} onChange={v => setF(p => ({ ...p, loadNum: v }))} placeholder="L-1001" />
        <Field label="Date" type="date" value={f.date || today()} onChange={v => setF(p => ({ ...p, date: v }))} />
        <Field label="Assign Truck" value={f.truckId || ""} onChange={v => setF(p => ({ ...p, truckId: v }))} options={trucks.map(t => ({ value: t.id, label: t.name }))} />
        <Field label="Assign Trailer" value={f.trailerId || ""} onChange={v => setF(p => ({ ...p, trailerId: v }))} options={[{ value: "", label: "— None —" }, ...trailers.map(t => ({ value: t.id, label: t.name }))]} />
        <Field label="Broker / Customer Name" value={f.brokerName || ""} onChange={v => setF(p => ({ ...p, brokerName: v }))} placeholder="e.g. Echo Global Logistics" />
        <Field label="Broker MC#" value={f.brokerMC || ""} onChange={v => setF(p => ({ ...p, brokerMC: v }))} placeholder="MC-000000" />
      </div>

      {/* Driver section */}
      <div style={{ background: "#fffbeb", border: "1.5px solid #fde68a", borderRadius: 10, padding: "14px 16px", marginBottom: 14 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
          <div style={{ color: "#92400e", fontWeight: 700, fontSize: 12 }}>👤 DRIVER & PAY</div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <label style={{ color: "#92400e", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
              <input type="checkbox" checked={f.isTeamLoad || false} onChange={e => setF(p => ({ ...p, isTeamLoad: e.target.checked }))} style={{ marginRight: 6 }} />
              🚛🚛 Team Load (2 drivers)
            </label>
          </div>
        </div>

        {/* Driver 1 */}
        <div style={{ marginBottom: f.isTeamLoad ? 14 : 0 }}>
          {f.isTeamLoad && <div style={{ color: "#92400e", fontSize: 11, fontWeight: 700, marginBottom: 8, textTransform: "uppercase" }}>Driver 1</div>}
          <div style={fgrid}>
            <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
              <label style={labelStyle}>Driver Name</label>
              <input list="driverList" value={f.driver || ""} onChange={e => handleDriverSelect(e.target.value)} placeholder="Type or select driver" style={inputStyle} />
              <datalist id="driverList">{drivers.map(d => <option key={d.id} value={d.name} />)}</datalist>
              {drivers.find(d => d.name === f.driver) && <div style={{ color: "#16a34a", fontSize: 11 }}>✅ CPM auto-filled</div>}
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
              <label style={labelStyle}>CPM ($/mile){f.isTeamLoad ? " — split miles" : ""}</label>
              <input type="number" value={f.driverCpm || "0"} onChange={e => setF(p => ({ ...p, driverCpm: e.target.value }))} placeholder="0.55" style={inputStyle} />
              {f.driverCpm > 0 && f.miles > 0 && <div style={{ color: "#d97706", fontSize: 11 }}>= {fmt$(driverPay)} for {fmtMi(splitMiles)} mi{f.isTeamLoad ? " (½ miles)" : ""}</div>}
            </div>
          </div>
        </div>

        {/* Driver 2 — only shown for team loads */}
        {f.isTeamLoad && (
          <div style={{ borderTop: "1px dashed #fde68a", paddingTop: 14 }}>
            <div style={{ color: "#92400e", fontSize: 11, fontWeight: 700, marginBottom: 8, textTransform: "uppercase" }}>Driver 2</div>
            <div style={fgrid}>
              <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                <label style={labelStyle}>Driver 2 Name</label>
                <input list="driverList2" value={f.driver2 || ""} onChange={e => handleDriver2Select(e.target.value)} placeholder="Type or select driver" style={inputStyle} />
                <datalist id="driverList2">{drivers.map(d => <option key={d.id} value={d.name} />)}</datalist>
                {drivers.find(d => d.name === f.driver2) && <div style={{ color: "#16a34a", fontSize: 11 }}>✅ CPM auto-filled</div>}
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                <label style={labelStyle}>CPM ($/mile) — split miles</label>
                <input type="number" value={f.driver2Cpm || "0"} onChange={e => setF(p => ({ ...p, driver2Cpm: e.target.value }))} placeholder="0.55" style={inputStyle} />
                {f.driver2Cpm > 0 && f.miles > 0 && <div style={{ color: "#d97706", fontSize: 11 }}>= {fmt$(driver2Pay)} for {fmtMi(splitMiles)} mi (½ miles)</div>}
              </div>
            </div>
          </div>
        )}

        {/* OOP + Total */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginTop: 12 }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
            <label style={labelStyle}>Driver Out of Pocket Expenses ($)</label>
            <input type="number" value={f.driverOopExpenses || "0"} onChange={e => setF(p => ({ ...p, driverOopExpenses: e.target.value }))} placeholder="0.00" style={inputStyle} />
            <div style={{ color: "#6b7280", fontSize: 10 }}>Tolls, parking, scale tickets</div>
          </div>
          <div style={{ background: "#fff", borderRadius: 8, padding: "10px 12px", border: "1px solid #fde68a" }}>
            <div style={{ color: "#6b7280", fontSize: 10, fontWeight: 700 }}>TOTAL DRIVER COST</div>
            <div style={{ color: "#d97706", fontFamily: "monospace", fontWeight: 900, fontSize: 18, marginTop: 4 }}>{fmt$(totalDriverPay + driverOop)}</div>
            {f.isTeamLoad && <div style={{ color: "#9ca3af", fontSize: 10 }}>{fmt$(driverPay)} + {fmt$(driver2Pay)}</div>}
          </div>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 14 }}>
        <CityInput label="Origin City" value={f.origin} onChange={v => setF(p => ({ ...p, origin: v }))} onCitySelect={handleOriginSelect} />
        <CityInput label="Destination City" value={f.dest} onChange={v => setF(p => ({ ...p, dest: v }))} onCitySelect={handleDestSelect} />
      </div>
      <div style={{ marginBottom: 14 }}>
        <label style={labelStyle}>Miles {calcingMiles ? "⏳ Calculating..." : originCoords && destCoords && f.miles ? "✅ Auto-calculated" : ""}</label>
        <input type="number" value={f.miles || ""} onChange={e => setF(p => ({ ...p, miles: e.target.value }))} placeholder="Pick cities above for auto-miles" style={{ ...inputStyle, marginTop: 5, borderColor: originCoords && destCoords && f.miles ? "#16a34a" : "#d1d5db" }} />
      </div>
      <div style={fgrid}>
        <Field label="Load Rate ($)" type="number" value={f.rate || ""} onChange={v => setF(p => ({ ...p, rate: v }))} />
        <Field label="Detention ($)" type="number" value={f.detention || "0"} onChange={v => setF(p => ({ ...p, detention: v }))} />
        <Field label="Toll Cost ($)" type="number" value={f.toll || "0"} onChange={v => setF(p => ({ ...p, toll: v }))} />
        <Field label="Load Status" value={f.status || "Pending"} onChange={v => setF(p => ({ ...p, status: v }))} options={STATUSES} />
        <Field label="Factoring Status" value={f.factoringStatus || "Not Submitted"} onChange={v => setF(p => ({ ...p, factoringStatus: v }))} options={FACTORING_STATUSES} span />
      </div>

      {/* Lumper */}
      <div style={{ background: "#fef3c7", border: "1.5px solid #fde68a", borderRadius: 10, padding: "14px 16px", marginBottom: 14 }}>
        <div style={{ color: "#92400e", fontWeight: 700, fontSize: 12, marginBottom: 10 }}>🧾 LUMPER FEES</div>
        <div style={fgrid}>
          <Field label="Lumper Cost ($)" type="number" value={f.lumperCost || "0"} onChange={v => setF(p => ({ ...p, lumperCost: v }))} />
          <Field label="Paid By" value={f.lumperPaidBy || "Out of Pocket"} onChange={v => setF(p => ({ ...p, lumperPaidBy: v }))} options={LUMPER_PAID_BY} />
          {f.lumperPaidBy === "Out of Pocket" && <>
            <Field label="Reimbursed?" value={f.lumperReimbursed || "No"} onChange={v => setF(p => ({ ...p, lumperReimbursed: v }))} options={LUMPER_REIMBURSED} />
            <Field label="Reimbursed Amount ($)" type="number" value={f.lumperReimbursedAmount || "0"} onChange={v => setF(p => ({ ...p, lumperReimbursedAmount: v }))} />
          </>}
        </div>
      </div>

      {/* Live preview */}
      {f.rate && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 14 }}>
          <div style={{ background: "#f0fdf4", border: "1.5px solid #bbf7d0", borderRadius: 10, padding: "14px 16px" }}>
            <div style={{ color: "#6b7280", fontSize: 10, fontWeight: 700, marginBottom: 10 }}>LOAD PROFIT PREVIEW</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, textAlign: "center" }}>
              {[{ l: "Gross", v: fmt$(g), c: "#16a34a" }, { l: "Driver Cost", v: fmt$(driverPay + driverOop), c: "#d97706" }, { l: "Your Profit", v: fmt$(profit), c: profit >= 0 ? "#16a34a" : "#dc2626" }].map(s => (
                <div key={s.l}><div style={{ color: "#6b7280", fontSize: 10, marginBottom: 3 }}>{s.l}</div><div style={{ color: s.c, fontFamily: "monospace", fontWeight: 800 }}>{s.v}</div></div>
              ))}
            </div>
          </div>
          <div style={{ background: "#eff6ff", border: "1.5px solid #bfdbfe", borderRadius: 10, padding: "14px 16px" }}>
            <div style={{ color: "#6b7280", fontSize: 10, fontWeight: 700, marginBottom: 10 }}>APEX FACTORING PREVIEW</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, textAlign: "center" }}>
              {[{ l: "Fee 2.3%", v: fmt$(fct.fee), c: "#dc2626" }, { l: "Reserve 5%", v: fmt$(fct.reserve), c: "#d97706" }, { l: "You Get", v: fmt$(fct.advance), c: "#2563eb" }].map(s => (
                <div key={s.l}><div style={{ color: "#6b7280", fontSize: 10, marginBottom: 3 }}>{s.l}</div><div style={{ color: s.c, fontFamily: "monospace", fontWeight: 800 }}>{s.v}</div></div>
              ))}
            </div>
          </div>
        </div>
      )}
      <SaveBtn onClick={() => onSave(f)} label={editItem ? "💾 Update Load" : "✅ Save Load"} loading={saving} />
    </ModalShell>
  );
};

// ─── DRIVER PROFILE FORM ──────────────────────────────────────────────────────
const DriverProfileForm = ({ onClose, onSave, saving, editItem, allDrivers }) => {
  const [f, setF] = useState(editItem || { name: "", email: "", phone: "", cpm: "", notes: "", active: true, is_team_driver: false, team_partner: "" });
  return (
    <ModalShell title={editItem ? "✏️ Edit Driver" : "👤 Add Driver"} onClose={onClose}>
      <div style={fgrid}>
        <Field label="Driver Full Name" value={f.name || ""} onChange={v => setF(p => ({ ...p, name: v }))} placeholder="Full name" />
        <Field label="Phone Number" value={f.phone || ""} onChange={v => setF(p => ({ ...p, phone: v }))} placeholder="555-000-0000" />
        <Field label="Email" value={f.email || ""} onChange={v => setF(p => ({ ...p, email: v }))} placeholder="driver@email.com" />
        <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
          <label style={labelStyle}>Pay Rate ($ per mile CPM)</label>
          <input type="number" value={f.cpm || ""} onChange={e => setF(p => ({ ...p, cpm: e.target.value }))} placeholder="e.g. 0.55" step="0.01" style={inputStyle} />
          {f.cpm > 0 && <div style={{ color: "#16a34a", fontSize: 11 }}>= {fmt$(Number(f.cpm) * 500)} per 500 miles · {fmt$(Number(f.cpm) * 1000)} per 1000 miles</div>}
        </div>
        <Field label="Status" value={f.active ? "active" : "inactive"} onChange={v => setF(p => ({ ...p, active: v === "active" }))} options={[{ value: "active", label: "Active" }, { value: "inactive", label: "Inactive" }]} />
        <Field label="Notes" value={f.notes || ""} onChange={v => setF(p => ({ ...p, notes: v }))} placeholder="Any notes..." />
      </div>

      {/* Team Driver Section */}
      <div style={{ background: "#f5f3ff", border: "1.5px solid #ddd6fe", borderRadius: 10, padding: "14px 16px", marginBottom: 14 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
          <input type="checkbox" id="isTeam" checked={f.is_team_driver || false} onChange={e => setF(p => ({ ...p, is_team_driver: e.target.checked, team_partner: e.target.checked ? p.team_partner : "" }))} style={{ width: 16, height: 16, cursor: "pointer" }} />
          <label htmlFor="isTeam" style={{ color: "#7c3aed", fontWeight: 700, fontSize: 13, cursor: "pointer" }}>🚛🚛 This is a Team Driver</label>
        </div>
        {f.is_team_driver && (
          <div>
            <label style={labelStyle}>Team Partner</label>
            <select value={f.team_partner || ""} onChange={e => setF(p => ({ ...p, team_partner: e.target.value }))} style={inputStyle}>
              <option value="">— Select Team Partner —</option>
              {allDrivers?.filter(d => d.name !== f.name).map(d => <option key={d.id} value={d.name}>{d.name}</option>)}
            </select>
            {f.team_partner && <div style={{ color: "#7c3aed", fontSize: 11, marginTop: 6 }}>✅ {f.name || "This driver"} will be automatically paired with {f.team_partner} on team loads</div>}
          </div>
        )}
        {!f.is_team_driver && <div style={{ color: "#9ca3af", fontSize: 12 }}>Check this if driver runs team loads with a partner</div>}
      </div>

      <SaveBtn onClick={() => onSave(f)} label={editItem ? "💾 Update Driver" : "✅ Add Driver"} loading={saving} />
    </ModalShell>
  );
};

// ─── REPAIR RECEIPT MODAL ─────────────────────────────────────────────────────
const RepairReceiptModal = ({ onClose, onSave, saving, trucks }) => {
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [scanning, setScanning] = useState(false);
  const [result, setResult] = useState(null);
  const [f, setF] = useState({ date: today(), truckId: trucks[0]?.id || "", category: "Repairs", description: "", amount: "" });
  const fileRef = useRef();

  const handleFile = async (e) => {
    const file = e.target.files[0]; if (!file) return;
    const b64 = await new Promise((res, rej) => { const r = new FileReader(); r.onload = ev => res(ev.target.result); r.onerror = rej; r.readAsDataURL(file); });
    setPreview(b64);
    setScanning(true);
    try {
      const mediaType = file.type || "image/jpeg";
      const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514", max_tokens: 500,
          messages: [{ role: "user", content: [
            { type: "image", source: { type: "base64", media_type: mediaType, data: b64.split(",")[1] } },
            { type: "text", text: `This is a repair/expense receipt. Extract: vendor name, total amount, date, description of work/items. Return ONLY JSON: {"vendor":"name","amount":number,"date":"YYYY-MM-DD or null","description":"what was repaired/purchased"}` }
          ]}]
        })
      });
      const data = await response.json();
      const text = data.content?.[0]?.text || "{}";
      const parsed = JSON.parse(text.replace(/```json|```/g, "").trim());
      setResult(parsed);
      setF(p => ({ ...p, description: parsed.vendor ? `${parsed.vendor} — ${parsed.description}` : parsed.description || "", amount: parsed.amount ? String(parsed.amount) : "", date: parsed.date || today() }));
    } catch { }
    setScanning(false);
  };

  return (
    <ModalShell title="🧾 Scan Repair Receipt" onClose={onClose} wide>
      <div style={{ background: "#fffbeb", border: "1.5px solid #fde68a", borderRadius: 10, padding: "14px 18px", marginBottom: 18 }}>
        <div style={{ color: "#92400e", fontWeight: 700, marginBottom: 4 }}>Take a photo of any receipt — AI reads it and fills in the details automatically.</div>
      </div>
      <input ref={fileRef} type="file" accept="image/*,application/pdf" capture="environment" style={{ display: "none" }} onChange={handleFile} />
      {!preview ? (
        <div style={{ border: "2px dashed #d1d5db", borderRadius: 12, padding: 40, textAlign: "center", cursor: "pointer", background: "#f9fafb", marginBottom: 16 }} onClick={() => fileRef.current?.click()} onMouseEnter={e => e.currentTarget.style.borderColor = "#d97706"} onMouseLeave={e => e.currentTarget.style.borderColor = "#d1d5db"}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>🧾</div>
          <div style={{ color: "#374151", fontSize: 16, fontWeight: 700 }}>Click to scan / photo receipt</div>
          <div style={{ color: "#9ca3af", fontSize: 13 }}>Repair bill, parts receipt, any expense</div>
        </div>
      ) : (
        <div style={{ marginBottom: 16 }}>
          {preview.startsWith("data:image") && <img src={preview} style={{ width: "100%", borderRadius: 10, marginBottom: 10, maxHeight: 200, objectFit: "cover" }} alt="receipt" />}
          {scanning ? <div style={{ textAlign: "center", padding: "16px 0", color: "#d97706", fontWeight: 700 }}>🤖 AI reading receipt...</div>
            : result && <div style={{ background: "#f0fdf4", border: "1.5px solid #bbf7d0", borderRadius: 10, padding: "12px 14px", marginBottom: 12 }}>
              <div style={{ color: "#166534", fontWeight: 700, marginBottom: 4 }}>✅ Receipt read! Review below:</div>
              {result.vendor && <div style={{ color: "#15803d", fontSize: 13 }}>🏪 {result.vendor}</div>}
            </div>}
          <button onClick={() => { setPreview(null); setResult(null); }} style={{ background: "#f3f4f6", border: "1.5px solid #e5e7eb", borderRadius: 8, padding: "8px 16px", cursor: "pointer", fontSize: 13, color: "#374151", fontWeight: 600 }}>🔄 Retake</button>
        </div>
      )}
      <div style={fgrid}>
        <Field label="Date" type="date" value={f.date} onChange={v => setF(p => ({ ...p, date: v }))} />
        <Field label="Truck" value={f.truckId} onChange={v => setF(p => ({ ...p, truckId: v }))} options={trucks.map(t => ({ value: t.id, label: t.name }))} />
        <Field label="Category" value={f.category} onChange={v => setF(p => ({ ...p, category: v }))} options={["Repairs","Maintenance","Tires","Equipment","Other"]} />
        <Field label="Amount ($)" type="number" value={f.amount} onChange={v => setF(p => ({ ...p, amount: v }))} placeholder="0.00" />
        <Field label="Description" value={f.description} onChange={v => setF(p => ({ ...p, description: v }))} placeholder="What was repaired / purchased?" span />
      </div>
      {f.amount && <div style={{ background: "#fef2f2", border: "1.5px solid #fecaca", borderRadius: 10, padding: "12px", marginBottom: 14, textAlign: "center", color: "#dc2626", fontFamily: "monospace", fontWeight: 900, fontSize: 22 }}>{fmt$(f.amount)}</div>}
      <SaveBtn onClick={() => onSave(f)} label="✅ Save Expense" loading={saving} />
    </ModalShell>
  );
};

// ─── FACTORING DETAIL MODAL ───────────────────────────────────────────────────
const FactoringDetailModal = ({ load, truck, trailer, onClose, onUpdateStatus }) => {
  const g = Number(load.rate || 0) + Number(load.detention || 0);
  const fct = calcFactoring(g);
  const [copied, setCopied] = useState(false);

  const copyAll = () => {
    const text = [
      `INVOICE #: ${load.loadNum}`,
      `REFERENCE #: ${load.loadNum}`,
      `CUSTOMER / BROKER: ${load.brokerName || ""}${load.brokerMC ? ` (${load.brokerMC})` : ""}`,
      `EQUIPMENT: Reefer`,
      `PICKUP: ${load.origin} — ${load.date}`,
      `DROPOFF: ${load.dest}`,
      `DRIVER: ${load.driver || ""}`,
      `TRUCK #: ${truck?.name || ""}`,
      `TRAILER #: ${trailer?.name || ""}`,
      `LINE HAUL AMOUNT: ${fmt$(g)}`,
      ``,
      `--- APEX CAPITAL BREAKDOWN ---`,
      `Factoring Fee (${APEX_FEE_PCT}%): -${fmt$(fct.fee)}`,
      `Reserve (${APEX_RESERVE_PCT}%): -${fmt$(fct.reserve)}`,
      `ADVANCE TO YOU: ${fmt$(fct.advance)}`,
      `Reserve balance (released later): ${fmt$(fct.reserve)}`,
    ].join("\n");
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  return (
    <ModalShell title="💼 Apex Capital — Factoring Details" onClose={onClose} wide>
      {/* Apex form fill section */}
      <div style={{ background: "#eff6ff", border: "1.5px solid #bfdbfe", borderRadius: 12, padding: "18px 20px", marginBottom: 20 }}>
        <div style={{ color: "#1e40af", fontWeight: 800, fontSize: 13, marginBottom: 14 }}>📋 Fill out Apex Capital form with this info:</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          {[
            { l: "Invoice Number", v: load.loadNum, hi: true },
            { l: "Reference Number", v: load.loadNum },
            { l: "Customer Name or MC#", v: `${load.brokerName || "—"}${load.brokerMC ? ` (${load.brokerMC})` : ""}`, hi: true },
            { l: "Equipment Type", v: "Reefer" },
            { l: "Pickup — City/State", v: load.origin || "—", hi: true },
            { l: "Pickup Date", v: load.date },
            { l: "Dropoff — City/State", v: load.dest || "—", hi: true },
            { l: "Dropoff Date", v: load.date },
            { l: "Driver", v: load.driver || "—" },
            { l: "Truck #", v: truck?.name || "—" },
            { l: "Trailer #", v: trailer?.name || "—" },
            { l: "Line Haul Amount", v: fmt$(g), hi: true },
          ].map(r => (
            <div key={r.l} style={{ background: "#fff", borderRadius: 8, padding: "10px 14px", border: `1.5px solid ${r.hi ? "#bfdbfe" : "#e5e7eb"}` }}>
              <div style={{ color: "#6b7280", fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1 }}>{r.l}</div>
              <div style={{ color: r.hi ? "#1e40af" : "#111827", fontWeight: r.hi ? 800 : 500, fontSize: 14, marginTop: 4 }}>{r.v}</div>
            </div>
          ))}
        </div>
        <button onClick={copyAll} style={{ marginTop: 16, background: copied ? "#16a34a" : "#2563eb", color: "#fff", border: "none", borderRadius: 10, padding: "13px 0", fontWeight: 900, cursor: "pointer", fontSize: 15, width: "100%" }}>
          {copied ? "✅ Copied to Clipboard!" : "📋 Copy All Info to Clipboard"}
        </button>
      </div>

      {/* Breakdown */}
      <div style={{ background: "#f9fafb", border: "1.5px solid #e5e7eb", borderRadius: 12, padding: "18px 20px", marginBottom: 20 }}>
        <div style={{ color: "#374151", fontWeight: 800, fontSize: 14, marginBottom: 14 }}>💰 Apex Capital Factoring Breakdown</div>
        {[
          { l: "Gross Invoice Amount", v: fmt$(fct.gross), c: "#16a34a", big: true },
          { l: `Factoring Fee (${APEX_FEE_PCT}%)`, v: `− ${fmt$(fct.fee)}`, c: "#dc2626" },
          { l: `Reserve Withheld (${APEX_RESERVE_PCT}%)`, v: `− ${fmt$(fct.reserve)}`, c: "#d97706" },
          { l: "💵 Advance Paid to You", v: fmt$(fct.advance), c: "#2563eb", big: true },
          { l: "Reserve Balance (released later by Apex)", v: fmt$(fct.reserve), c: "#7c3aed" },
        ].map(r => (
          <div key={r.l} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 0", borderBottom: "1px solid #e5e7eb" }}>
            <span style={{ color: "#374151", fontSize: 13 }}>{r.l}</span>
            <span style={{ color: r.c, fontFamily: "monospace", fontWeight: r.big ? 900 : 700, fontSize: r.big ? 18 : 14 }}>{r.v}</span>
          </div>
        ))}
      </div>

      {/* Status update */}
      <div>
        <div style={{ color: "#6b7280", fontSize: 11, fontWeight: 700, letterSpacing: 1, textTransform: "uppercase", marginBottom: 10 }}>Update Factoring Status</div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {FACTORING_STATUSES.map(s => (
            <button key={s} onClick={() => { onUpdateStatus(s); onClose(); }}
              style={{ background: load.factoringStatus === s ? "#2563eb" : "#f3f4f6", color: load.factoringStatus === s ? "#fff" : "#374151", border: `1.5px solid ${load.factoringStatus === s ? "#2563eb" : "#e5e7eb"}`, borderRadius: 8, padding: "9px 16px", fontWeight: 700, cursor: "pointer", fontSize: 12 }}>
              {s}
            </button>
          ))}
        </div>
      </div>
    </ModalShell>
  );
};

const RateConModal = ({ onClose, onLoad, trucks, trailers, drivers }) => {
  const [parsing, setParsing] = useState(false);
  const [f, setF] = useState(null);
  const [parsed, setParsed] = useState(null);
  const [error, setError] = useState(null);
  const fileRef = useRef();
  const handleFile = async (e) => {
    const file = e.target.files[0]; if (!file) return;
    setParsing(true); setError(null);
    try {
      const base64 = await new Promise((res, rej) => { const r = new FileReader(); r.onload = ev => res(ev.target.result.split(",")[1]); r.onerror = rej; r.readAsDataURL(file); });
      const mediaType = file.type || (file.name.endsWith(".pdf") ? "application/pdf" : "image/jpeg");
      const result = await parseWithAI(base64, mediaType, `You are reading a trucking rate confirmation document. Extract all load information you can find. Return ONLY valid JSON with no other text:\n{"loadNum":"load or reference number","origin":"pickup city, ST","dest":"delivery city, ST","miles":number or null,"rate":total rate as number,"detention":number or null,"broker":"broker or shipper company name","brokerMC":"MC number or null","pickupDate":"YYYY-MM-DD or null","commodity":"what is being hauled"}\nIf you cannot find a value use null. Return ONLY the JSON object, nothing else.`);
      if (result && (result.loadNum || result.rate || result.origin)) {
        setParsed(result);
        setF({ date: result.pickupDate || today(), loadNum: result.loadNum || "", origin: result.origin || "", dest: result.dest || "", miles: result.miles ? String(result.miles) : "", rate: result.rate ? String(result.rate) : "", detention: result.detention ? String(result.detention) : "0", driver: "", driverCpm: "0", driverOopExpenses: "0", truckId: trucks[0]?.id || "", trailerId: "", status: "Pending", lumperCost: "0", lumperPaidBy: "Out of Pocket", lumperReimbursed: "No", lumperReimbursedAmount: "0", toll: "0", factoringStatus: "Ready to Factor", brokerName: result.broker || "", brokerMC: result.brokerMC || "" });
      } else setError("Could not read document. Make sure it's a clear PDF or photo of the rate con. Try uploading a PDF directly if using a photo.");
    } catch { setError("Error reading file. Please try again."); }
    setParsing(false);
  };

  const handleDriverSelect = (name) => {
    const profile = drivers?.find(d => d.name === name);
    setF(p => ({ ...p, driver: name, driverCpm: profile ? String(profile.cpm) : p.driverCpm }));
  };

  return (
    <ModalShell title="🤖 Upload Rate Confirmation" onClose={onClose} wide>
      {!f ? (
        <>
          <div style={{ background: "#eff6ff", border: "1.5px solid #bfdbfe", borderRadius: 10, padding: "14px 18px", marginBottom: 18 }}>
            <div style={{ color: "#1e40af", fontWeight: 700, marginBottom: 4 }}>AI reads your rate con and fills everything — including broker info for factoring. Factoring status auto-set to "Ready to Factor".</div>
          </div>
          {parsing ? (<div style={{ textAlign: "center", padding: "40px 0" }}><div style={{ fontSize: 48, marginBottom: 16 }}>🤖</div><div style={{ color: "#d97706", fontWeight: 800, fontSize: 18 }}>Reading your rate confirmation...</div></div>)
            : (<>
              <div style={{ border: "2px dashed #d1d5db", borderRadius: 12, padding: 40, textAlign: "center", cursor: "pointer", background: "#f9fafb" }} onClick={() => fileRef.current?.click()} onMouseEnter={e => e.currentTarget.style.borderColor = "#d97706"} onMouseLeave={e => e.currentTarget.style.borderColor = "#d1d5db"}>
                <div style={{ fontSize: 48, marginBottom: 12 }}>📄</div>
                <div style={{ color: "#374151", fontSize: 16, fontWeight: 700, marginBottom: 6 }}>Click to upload Rate Confirmation</div>
                <div style={{ color: "#9ca3af", fontSize: 13 }}>PDF, JPG, PNG, or photo</div>
                <input ref={fileRef} type="file" accept=".pdf,.jpg,.jpeg,.png,.webp,image/*" style={{ display: "none" }} onChange={handleFile} />
              </div>
              {error && <div style={{ background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 8, padding: "12px 16px", marginTop: 16, color: "#dc2626", fontSize: 13 }}>⚠️ {error}</div>}
            </>)}
        </>
      ) : (
        <>
          <div style={{ background: "#f0fdf4", border: "1.5px solid #bbf7d0", borderRadius: 10, padding: "12px 16px", marginBottom: 16 }}>
            <div style={{ color: "#166534", fontWeight: 700 }}>✅ Rate con read! Factoring set to "Ready to Factor". Review and correct:</div>
            {parsed?.broker && <div style={{ color: "#15803d", fontSize: 13, marginTop: 4 }}>🏢 {parsed.broker} {parsed?.brokerMC && `· MC# ${parsed.brokerMC}`}</div>}
          </div>
          <div style={fgrid}>
            <Field label="Load Number" value={f.loadNum} onChange={v => setF(p => ({ ...p, loadNum: v }))} />
            <Field label="Date" type="date" value={f.date} onChange={v => setF(p => ({ ...p, date: v }))} />
            <Field label="Truck" value={f.truckId} onChange={v => setF(p => ({ ...p, truckId: v }))} options={trucks.map(t => ({ value: t.id, label: t.name }))} />
            <Field label="Trailer" value={f.trailerId || ""} onChange={v => setF(p => ({ ...p, trailerId: v }))} options={[{ value: "", label: "— None —" }, ...trailers.map(t => ({ value: t.id, label: t.name }))]} />
            <Field label="Broker / Customer" value={f.brokerName} onChange={v => setF(p => ({ ...p, brokerName: v }))} />
            <Field label="Broker MC#" value={f.brokerMC} onChange={v => setF(p => ({ ...p, brokerMC: v }))} />
            <Field label="Origin" value={f.origin} onChange={v => setF(p => ({ ...p, origin: v }))} />
            <Field label="Destination" value={f.dest} onChange={v => setF(p => ({ ...p, dest: v }))} />
            <Field label="Miles" type="number" value={f.miles} onChange={v => setF(p => ({ ...p, miles: v }))} />
            <Field label="Rate ($)" type="number" value={f.rate} onChange={v => setF(p => ({ ...p, rate: v }))} />
          </div>
          {/* Driver section */}
          <div style={{ background: "#fffbeb", border: "1.5px solid #fde68a", borderRadius: 10, padding: "14px 16px", marginBottom: 14 }}>
            <div style={{ color: "#92400e", fontWeight: 700, fontSize: 12, marginBottom: 10 }}>👤 ASSIGN DRIVER</div>
            <div style={fgrid}>
              <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                <label style={labelStyle}>Select Driver</label>
                <select value={f.driver || ""} onChange={e => handleDriverSelect(e.target.value)} style={inputStyle}>
                  <option value="">— Select Driver —</option>
                  {drivers?.map(d => <option key={d.id} value={d.name}>{d.name} (${Number(d.cpm).toFixed(2)}/mi)</option>)}
                </select>
                {f.driver && drivers?.find(d => d.name === f.driver) && <div style={{ color: "#16a34a", fontSize: 11 }}>✅ CPM auto-filled from profile</div>}
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                <label style={labelStyle}>Driver CPM ($/mile)</label>
                <input type="number" value={f.driverCpm || "0"} onChange={e => setF(p => ({ ...p, driverCpm: e.target.value }))} placeholder="0.55" style={inputStyle} />
                {f.driverCpm > 0 && f.miles > 0 && <div style={{ color: "#d97706", fontSize: 11 }}>= ${(Number(f.driverCpm) * Number(f.miles)).toFixed(2)} for {Number(f.miles).toLocaleString()} miles</div>}
              </div>
            </div>
          </div>
          <div style={{ display: "flex", gap: 12 }}>
            <button onClick={() => { setF(null); setParsed(null); }} style={{ flex: 1, background: "#f3f4f6", border: "1.5px solid #e5e7eb", borderRadius: 10, padding: "12px", fontWeight: 700, cursor: "pointer", fontSize: 14, color: "#374151", marginTop: 10 }}>📄 Try Different File</button>
            <SaveBtn onClick={() => { onLoad(f); onClose(); }} label="✅ Save This Load" loading={false} />
          </div>
        </>
      )}
    </ModalShell>
  );
};

const FuelForm = ({ onClose, onSave, saving, trucks, editItem }) => {
  const [f, setF] = useState(editItem || { date: today(), truckId: trucks[0]?.id || "", gallons: "", pricePer: "", total: "", location: "", loadNum: "" });
  const tot = Number(f.total) || (Number(f.gallons) * Number(f.pricePer));
  return (
    <ModalShell title={editItem ? "✏️ Edit Fuel" : "⛽ Add Fuel Entry"} onClose={onClose}>
      <div style={fgrid}>
        <Field label="Date" type="date" value={f.date || today()} onChange={v => setF(p => ({ ...p, date: v }))} />
        <Field label="Truck" value={f.truckId || ""} onChange={v => setF(p => ({ ...p, truckId: v }))} options={trucks.map(t => ({ value: t.id, label: t.name }))} />
        <Field label="Gallons" type="number" value={f.gallons || ""} onChange={v => setF(p => ({ ...p, gallons: v }))} />
        <Field label="Price Per Gallon ($)" type="number" value={f.pricePer || ""} onChange={v => setF(p => ({ ...p, pricePer: v }))} />
        <Field label="Total Amount ($)" type="number" value={f.total || ""} onChange={v => setF(p => ({ ...p, total: v }))} />
        <Field label="Location / Stop" value={f.location || ""} onChange={v => setF(p => ({ ...p, location: v }))} placeholder="Love's - I-10 Houston TX" />
        <Field label="Load # (optional)" value={f.loadNum || ""} onChange={v => setF(p => ({ ...p, loadNum: v }))} />
      </div>
      {tot > 0 && <div style={{ background: "#fef2f2", border: "1.5px solid #fecaca", borderRadius: 10, padding: "12px", marginBottom: 14, textAlign: "center", color: "#dc2626", fontFamily: "monospace", fontWeight: 900, fontSize: 22 }}>Total: {fmt$(tot)}</div>}
      <SaveBtn onClick={() => onSave(f)} label={editItem ? "💾 Update" : "✅ Save Fuel Entry"} loading={saving} />
    </ModalShell>
  );
};

const MudflapModal = ({ onClose, onImport, saving, trucks }) => {
  const [parsing, setParsing] = useState(false);
  const [transactions, setTransactions] = useState([]);
  const [mapping, setMapping] = useState({});
  const [done, setDone] = useState(false);
  const [error, setError] = useState(null);
  const fileRef = useRef();
  const handleFile = async (e) => {
    const file = e.target.files[0]; if (!file) return;
    setParsing(true); setError(null);
    try {
      const base64 = await new Promise((res, rej) => { const r = new FileReader(); r.onload = ev => res(ev.target.result.split(",")[1]); r.onerror = rej; r.readAsDataURL(file); });
      const result = await parseWithAI(base64, "application/pdf", `Extract ALL fuel transactions from this Mudflap statement. Return ONLY a JSON array:\n[{"date":"YYYY-MM-DD","location":"station name and city","gallons":number,"amount":number,"saved":number}]\nConvert partial dates using the statement year. Return ONLY the JSON array.`);
      if (result && Array.isArray(result) && result.length > 0) {
        setTransactions(result);
        const m = {}; result.forEach((_, i) => { m[i] = trucks[0]?.id || ""; }); setMapping(m);
      } else setError("Could not read transactions. Try a clearer PDF.");
    } catch { setError("Error reading file."); }
    setParsing(false);
  };
  const doImport = async () => { const rows = transactions.map((t, i) => ({ id: uid(), date: t.date, truck_id: mapping[i] || trucks[0]?.id, gallons: Number(t.gallons || 0), price_per: Number(t.gallons) > 0 ? Number(t.amount) / Number(t.gallons) : 0, total: Number(t.amount || 0), location: t.location || "", load_num: "" })); await onImport(rows); setDone(true); };
  return (
    <ModalShell title="🟠 Import Mudflap Statement" onClose={onClose} extraWide>
      {done ? (<div style={{ textAlign: "center", padding: "40px 0" }}><div style={{ fontSize: 64, marginBottom: 16 }}>✅</div><div style={{ color: "#16a34a", fontWeight: 900, fontSize: 24 }}>Imported!</div><PrimaryBtn onClick={onClose} style={{ marginTop: 20 }}>Done</PrimaryBtn></div>)
        : transactions.length === 0 ? (<>
          <div style={{ background: "#fff7ed", border: "1.5px solid #fed7aa", borderRadius: 10, padding: "14px 18px", marginBottom: 18 }}><div style={{ color: "#c2410c", fontWeight: 700 }}>Upload Mudflap PDF → AI reads transactions → assign each to a truck → import to fuel log.</div></div>
          {parsing ? (<div style={{ textAlign: "center", padding: "40px 0" }}><div style={{ fontSize: 48, marginBottom: 16 }}>🤖</div><div style={{ color: "#d97706", fontWeight: 800, fontSize: 18 }}>Reading Mudflap statement...</div></div>)
            : (<>
              <div style={{ border: "2px dashed #d1d5db", borderRadius: 12, padding: 40, textAlign: "center", cursor: "pointer", background: "#f9fafb" }} onClick={() => fileRef.current?.click()} onMouseEnter={e => e.currentTarget.style.borderColor = "#ea580c"} onMouseLeave={e => e.currentTarget.style.borderColor = "#d1d5db"}>
                <div style={{ fontSize: 48, marginBottom: 12 }}>🟠</div>
                <div style={{ color: "#374151", fontSize: 16, fontWeight: 700 }}>Click to upload Mudflap PDF Statement</div>
                <input ref={fileRef} type="file" accept=".pdf" style={{ display: "none" }} onChange={handleFile} />
              </div>
              {error && <div style={{ background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 8, padding: "12px 16px", marginTop: 16, color: "#dc2626", fontSize: 13 }}>⚠️ {error}</div>}
            </>)}
        </>)
        : (<>
          <div style={{ background: "#f0fdf4", border: "1.5px solid #bbf7d0", borderRadius: 10, padding: "12px 16px", marginBottom: 18 }}><div style={{ color: "#166534", fontWeight: 700 }}>✅ {transactions.length} transactions found — assign each to a truck:</div></div>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead><tr>{["Date", "Location", "Gallons", "Amount", "Saved", "Assign to Truck"].map(h => <TH key={h}>{h}</TH>)}</tr></thead>
              <tbody>{transactions.map((t, i) => (<tr key={i} onMouseEnter={e => e.currentTarget.style.background = "#f9fafb"} onMouseLeave={e => e.currentTarget.style.background = "#fff"}><TD>{t.date}</TD><TD>{t.location}</TD><TD mono>{fmtN(t.gallons, 1)}</TD><TD mono color="#dc2626" bold>{fmt$(t.amount)}</TD><TD mono color="#16a34a">{fmt$(t.saved)}</TD><TD><select value={mapping[i] || ""} onChange={e => setMapping(p => ({ ...p, [i]: e.target.value }))} style={{ ...inputStyle, width: "auto", minWidth: 150 }}>{trucks.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}</select></TD></tr>))}</tbody>
            </table>
          </div>
          <SaveBtn onClick={doImport} label={`📥 Import ${transactions.length} Transactions`} loading={saving} />
        </>)}
    </ModalShell>
  );
};

const ExpenseForm = ({ onClose, onSave, saving, trucks, editItem }) => {
  const [f, setF] = useState(editItem || { date: today(), truckId: "FLEET", category: "Maintenance", description: "", amount: "" });
  return (
    <ModalShell title="💳 Add Expense" onClose={onClose}>
      <div style={fgrid}>
        <Field label="Date" type="date" value={f.date || today()} onChange={v => setF(p => ({ ...p, date: v }))} />
        <Field label="Truck / Fleet" value={f.truckId || "FLEET"} onChange={v => setF(p => ({ ...p, truckId: v }))} options={[{ value: "FLEET", label: "Fleet-wide" }, ...trucks.map(t => ({ value: t.id, label: t.name }))]} />
        <Field label="Category" value={f.category || "Maintenance"} onChange={v => setF(p => ({ ...p, category: v }))} options={EXP_CATS} />
        <Field label="Amount ($)" type="number" value={f.amount || ""} onChange={v => setF(p => ({ ...p, amount: v }))} />
        <Field label="Description" value={f.description || ""} onChange={v => setF(p => ({ ...p, description: v }))} span placeholder="What was this for?" />
      </div>
      <SaveBtn onClick={() => onSave(f)} label="✅ Save Expense" loading={saving} />
    </ModalShell>
  );
};

const InsuranceForm = ({ onClose, onSave, saving, trucks, trailers, editItem }) => {
  const [f, setF] = useState(editItem || { provider: "", policy_number: "", coverage_type: "Primary Liability", premium_amount: "", payment_frequency: "Monthly", start_date: today(), end_date: "", entity_id: "FLEET", entity_type: "fleet", notes: "" });
  const entityOpts = [{ value: "FLEET", label: "Entire Fleet" }, ...trucks.map(t => ({ value: t.id, label: `Truck - ${t.name}` })), ...trailers.map(t => ({ value: t.id, label: `Trailer - ${t.name}` }))];
  return (
    <ModalShell title={editItem ? "✏️ Edit Insurance" : "🛡️ Add Insurance Policy"} onClose={onClose} wide>
      <div style={fgrid}>
        <Field label="Insurance Provider" value={f.provider || ""} onChange={v => setF(p => ({ ...p, provider: v }))} placeholder="e.g. Progressive" />
        <Field label="Policy Number" value={f.policy_number || ""} onChange={v => setF(p => ({ ...p, policy_number: v }))} placeholder="POL-000000" />
        <Field label="Coverage Type" value={f.coverage_type || "Primary Liability"} onChange={v => setF(p => ({ ...p, coverage_type: v }))} options={COVERAGE_TYPES} />
        <Field label="Premium Amount ($)" type="number" value={f.premium_amount || ""} onChange={v => setF(p => ({ ...p, premium_amount: v }))} />
        <Field label="Payment Frequency" value={f.payment_frequency || "Monthly"} onChange={v => setF(p => ({ ...p, payment_frequency: v }))} options={INSURANCE_FREQ} />
        <Field label="Covers" value={f.entity_id || "FLEET"} onChange={v => setF(p => ({ ...p, entity_id: v }))} options={entityOpts} />
        <Field label="Start Date" type="date" value={f.start_date || today()} onChange={v => setF(p => ({ ...p, start_date: v }))} />
        <Field label="Expiration Date" type="date" value={f.end_date || ""} onChange={v => setF(p => ({ ...p, end_date: v }))} />
        <Field label="Notes" value={f.notes || ""} onChange={v => setF(p => ({ ...p, notes: v }))} span placeholder="Additional notes..." />
      </div>
      <SaveBtn onClick={() => onSave(f)} label={editItem ? "💾 Update Policy" : "✅ Save Policy"} loading={saving} />
    </ModalShell>
  );
};

const CsvImportForm = ({ onClose, onImport, saving, trucks }) => {
  const [csvRows, setCsvRows] = useState([]); const [csvMapping, setCsvMapping] = useState({}); const [csvDone, setCsvDone] = useState(false); const fileRef = useRef();
  const handleFile = (e) => { const file = e.target.files[0]; if (!file) return; const reader = new FileReader(); reader.onload = (ev) => { const rows = parseTCSCsv(ev.target.result); const mapping = {}; rows.forEach(r => { mapping[r.truckRaw] = mapping[r.truckRaw] || trucks[0]?.id || ""; }); setCsvMapping(mapping); setCsvRows(rows); }; reader.readAsText(file); };
  const doImport = async () => { const toInsert = csvRows.map(r => ({ id: r.id, date: r.date, truck_id: csvMapping[r.truckRaw] || trucks[0]?.id, gallons: r.gallons, price_per: r.price_per, total: r.total, location: r.location, load_num: r.load_num || "" })); await onImport(toInsert); setCsvDone(true); };
  return (
    <ModalShell title="📥 Import TCS Fuel Card CSV" onClose={onClose} wide>
      {!csvDone ? (<><div style={{ background: "#fffbeb", border: "1px solid #fde68a", borderRadius: 10, padding: "14px 18px", marginBottom: 18 }}><ol style={{ color: "#78350f", fontSize: 13, lineHeight: 2, paddingLeft: 20, margin: 0 }}><li>tcsfleet.com → Reports → Transaction Report</li><li>Select date range → Export CSV → upload below</li></ol></div><div style={{ border: "2px dashed #d1d5db", borderRadius: 12, padding: 32, textAlign: "center", cursor: "pointer", background: "#f9fafb" }} onClick={() => fileRef.current?.click()} onMouseEnter={e => e.currentTarget.style.borderColor = "#d97706"} onMouseLeave={e => e.currentTarget.style.borderColor = "#d1d5db"}><div style={{ fontSize: 40, marginBottom: 10 }}>📄</div><div style={{ color: "#374151", fontSize: 15, fontWeight: 600 }}>Click to upload TCS CSV</div><input ref={fileRef} type="file" accept=".csv" style={{ display: "none" }} onChange={handleFile} /></div>{csvRows.length > 0 && (<><div style={{ color: "#16a34a", fontWeight: 700, marginBottom: 12, marginTop: 16 }}>✅ {csvRows.length} transactions found</div>{Object.keys(csvMapping).map(raw => (<div key={raw} style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 10 }}><span style={{ color: "#374151", fontSize: 13, background: "#f3f4f6", padding: "6px 10px", borderRadius: 7, minWidth: 130, fontFamily: "monospace" }}>"{raw}"</span><span style={{ color: "#9ca3af" }}>→</span><select value={csvMapping[raw]} onChange={e => setCsvMapping(p => ({ ...p, [raw]: e.target.value }))} style={{ ...inputStyle, flex: 1 }}>{trucks.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}</select></div>))}<SaveBtn onClick={doImport} label={`📥 Import ${csvRows.length} Transactions`} loading={saving} /></>)}</>) : (<div style={{ textAlign: "center", padding: "40px 0" }}><div style={{ fontSize: 64, marginBottom: 16 }}>✅</div><div style={{ color: "#16a34a", fontWeight: 900, fontSize: 24 }}>Imported!</div><PrimaryBtn onClick={onClose} style={{ marginTop: 20 }}>Done</PrimaryBtn></div>)}
    </ModalShell>
  );
};

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN APP
// ═══════════════════════════════════════════════════════════════════════════════
export default function App() {
  const [session, setSession] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [trucks, setTrucks] = useState([]);
  const [trailers, setTrailers] = useState([]);
  const [loads, setLoads] = useState([]);
  const [fuelLog, setFuelLog] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [maintenance, setMaintenance] = useState([]);
  const [insurance, setInsurance] = useState([]);
  const [driverProfiles, setDriverProfiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [tab, setTab] = useState("dashboard");
  const [truckView, setTruckView] = useState("FLEET");
  const [modal, setModal] = useState(null);
  const [editItem, setEditItem] = useState(null);
  const [toast, setToast] = useState(null);
  const [paystubDriver, setPaystubDriver] = useState("");
  const [paystubPeriod, setPaystubPeriod] = useState("weekly");
  const [factoringLoad, setFactoringLoad] = useState(null);

  // ─── AUTH ──────────────────────────────────────────────────────────────────
  useEffect(() => {
    db.auth.getSession().then(({ data: { session } }) => { setSession(session); setAuthLoading(false); });
    const { data: { subscription } } = db.auth.onAuthStateChange((_event, session) => { setSession(session); setAuthLoading(false); });
    return () => subscription.unsubscribe();
  }, []);

  const handleSignOut = async () => { await db.auth.signOut(); };
  const showToast = (msg, type = "success") => { setToast({ msg, type }); setTimeout(() => setToast(null), 3500); };

  const fetchAll = async () => {
    setLoading(true);
    try {
      const [t, tr, l, f, e, m, ins, dr] = await Promise.all([
        db.from("trucks").select("*").order("created_at"),
        db.from("trailers").select("*").order("created_at"),
        db.from("loads").select("*").order("date", { ascending: false }),
        db.from("fuel").select("*").order("date", { ascending: false }),
        db.from("expenses").select("*").order("date", { ascending: false }),
        db.from("maintenance").select("*").order("date", { ascending: false }),
        db.from("insurance").select("*").order("created_at", { ascending: false }),
        db.from("drivers").select("*").order("name"),
      ]);
      if (t.data) setTrucks(t.data.map(r => ({ id: r.id, name: r.name, plate: r.plate, year: r.year, make: r.make, model: r.model, color: r.color, active: r.active })));
      if (tr.data) setTrailers(tr.data.map(r => ({ id: r.id, name: r.name, plate: r.plate, year: r.year, make: r.make, model: r.model, type: r.type, color: r.color, active: r.active })));
      if (l.data) setLoads(l.data.map(r => ({ id: r.id, date: r.date, loadNum: r.load_num, origin: r.origin, dest: r.dest, miles: r.miles, rate: r.rate, detention: r.detention, driver: r.driver, driverCpm: r.driver_cpm || 0, driverOopExpenses: r.driver_oop_expenses || 0, isTeamLoad: r.is_team_load || false, driver2: r.driver2 || "", driver2Cpm: r.driver2_cpm || 0, truckId: r.truck_id, trailerId: r.trailer_id, status: r.status, lumperCost: r.lumper_cost, lumperPaidBy: r.lumper_paid_by, lumperReimbursed: r.lumper_reimbursed, lumperReimbursedAmount: r.lumper_reimbursed_amount, toll: r.toll, factoringStatus: r.factoring_status || "Not Submitted", brokerName: r.broker_name || "", brokerMC: r.broker_mc || "" })));
      if (f.data) setFuelLog(f.data.map(r => ({ id: r.id, date: r.date, truckId: r.truck_id, gallons: r.gallons, pricePer: r.price_per, total: r.total, location: r.location, loadNum: r.load_num })));
      if (e.data) setExpenses(e.data.map(r => ({ id: r.id, date: r.date, truckId: r.truck_id, category: r.category, description: r.description, amount: r.amount })));
      if (m.data) setMaintenance(m.data.map(r => ({ id: r.id, entityId: r.entity_id, entityType: r.entity_type, category: r.category, description: r.description, date: r.date, milesAtService: r.miles_at_service, nextDueMiles: r.next_due_miles, nextDueDate: r.next_due_date, cost: r.cost, position: r.position, notes: r.notes })));
      if (ins.data) setInsurance(ins.data.map(r => ({ id: r.id, provider: r.provider, policyNumber: r.policy_number, coverageType: r.coverage_type, premiumAmount: r.premium_amount, paymentFrequency: r.payment_frequency, startDate: r.start_date, endDate: r.end_date, entityId: r.entity_id, notes: r.notes })));
      if (dr.data) setDriverProfiles(dr.data.map(r => ({ id: r.id, name: r.name, email: r.email, phone: r.phone, cpm: r.cpm, active: r.active, notes: r.notes, isTeamDriver: r.is_team_driver || false, teamPartner: r.team_partner || "" })));
    } catch { showToast("Error loading data", "error"); }
    setLoading(false);
  };

  useEffect(() => { if (session) fetchAll(); }, [session]);
  const closeModal = () => { setModal(null); setEditItem(null); };

  // ─── SAVE FUNCTIONS ────────────────────────────────────────────────────────
  const saveTruck = async (f) => { if (!f.name) return; setSaving(true); const { error } = await db.from("trucks").upsert({ id: editItem?.id || ("T" + uid()), name: f.name, plate: f.plate || "", year: f.year || "", make: f.make || "Kenworth", model: f.model || "", color: f.color || TRUCK_COLORS[0].value, active: f.active !== false }); if (error) showToast("Save failed", "error"); else { await fetchAll(); closeModal(); showToast(editItem ? "Truck updated ✓" : "Truck added ✓"); } setSaving(false); };
  const saveTrailer = async (f) => { if (!f.name) return; setSaving(true); const { error } = await db.from("trailers").upsert({ id: editItem?.id || ("TR" + uid()), name: f.name, plate: f.plate || "", year: f.year || "", make: f.make || "Utility", model: f.model || "", type: f.type || "Reefer", color: f.color || TRUCK_COLORS[2].value, active: f.active !== false }); if (error) showToast("Save failed", "error"); else { await fetchAll(); closeModal(); showToast(editItem ? "Trailer updated ✓" : "Trailer added ✓"); } setSaving(false); };

  const saveLoad = async (f) => {
    if (!f.loadNum || !f.rate) return; setSaving(true);
    const { error } = await db.from("loads").upsert({ id: editItem?.id || uid(), date: f.date, load_num: f.loadNum, origin: f.origin, dest: f.dest, miles: Number(f.miles || 0), rate: Number(f.rate), detention: Number(f.detention || 0), driver: f.driver, driver_cpm: Number(f.driverCpm || 0), driver_oop_expenses: Number(f.driverOopExpenses || 0), is_team_load: f.isTeamLoad || false, driver2: f.driver2 || "", driver2_cpm: Number(f.driver2Cpm || 0), truck_id: f.truckId, trailer_id: f.trailerId || null, status: f.status, lumper_cost: Number(f.lumperCost || 0), lumper_paid_by: f.lumperPaidBy || "Out of Pocket", lumper_reimbursed: f.lumperReimbursed || "No", lumper_reimbursed_amount: Number(f.lumperReimbursedAmount || 0), toll: Number(f.toll || 0), factoring_status: f.factoringStatus || "Not Submitted", broker_name: f.brokerName || "", broker_mc: f.brokerMC || "" });
    if (error) showToast("Save failed", "error"); else { await fetchAll(); closeModal(); showToast(editItem ? "Load updated ✓" : "Load added ✓"); } setSaving(false);
  };

  const saveLoadDirect = async (f) => {
    if (!f.loadNum || !f.rate) { showToast("Missing load # or rate", "error"); return; }
    setSaving(true);
    const { error } = await db.from("loads").upsert({
      id: uid(), date: f.date, load_num: f.loadNum, origin: f.origin, dest: f.dest,
      miles: Number(f.miles || 0), rate: Number(f.rate), detention: Number(f.detention || 0),
      driver: f.driver || "", driver_cpm: Number(f.driverCpm || 0), driver_oop_expenses: 0,
      is_team_load: false, driver2: "", driver2_cpm: 0,
      truck_id: f.truckId || trucks[0]?.id || "", trailer_id: f.trailerId || null,
      status: f.status || "Pending", lumper_cost: 0, lumper_paid_by: "Out of Pocket",
      lumper_reimbursed: "No", lumper_reimbursed_amount: 0, toll: 0,
      factoring_status: f.factoringStatus || "Ready to Factor",
      broker_name: f.brokerName || "", broker_mc: f.brokerMC || ""
    });
    if (error) { console.error("saveLoadDirect error:", error); showToast("Save failed: " + error.message, "error"); }
    else { await fetchAll(); showToast("Load saved from rate con ✓"); }
    setSaving(false);
  };

  const updateFactoringStatus = async (loadId, status) => {
    await db.from("loads").update({ factoring_status: status }).eq("id", loadId);
    await fetchAll(); showToast(`Status: ${status} ✓`);
  };

  const saveFuel = async (f) => { const tot = Number(f.total) || (Number(f.gallons) * Number(f.pricePer)); if (!f.truckId || !tot) return; setSaving(true); const { error } = await db.from("fuel").upsert({ id: editItem?.id || uid(), date: f.date, truck_id: f.truckId, gallons: Number(f.gallons), price_per: Number(f.pricePer), total: tot, location: f.location || "", load_num: f.loadNum || "" }); if (error) showToast("Save failed", "error"); else { await fetchAll(); closeModal(); showToast("Fuel saved ✓"); } setSaving(false); };
  const saveExp = async (f) => { if (!f.description || !f.amount) return; setSaving(true); const { error } = await db.from("expenses").upsert({ id: editItem?.id || uid(), date: f.date, truck_id: f.truckId, category: f.category, description: f.description, amount: Number(f.amount) }); if (error) showToast("Save failed", "error"); else { await fetchAll(); closeModal(); showToast("Expense saved ✓"); } setSaving(false); };
  const saveMaintenance = async (f) => {
    if (!f.entity_id || !f.category) return; setSaving(true);
    const { error } = await db.from("maintenance").upsert({ id: editItem?.id || uid(), entity_id: f.entity_id, entity_type: f.entity_type, category: f.category, description: f.description || "", date: f.date, miles_at_service: Number(f.miles_at_service || 0), next_due_miles: Number(f.next_due_miles || 0), next_due_date: f.next_due_date || null, cost: Number(f.cost || 0), position: f.position || "", notes: f.notes || "" });
    if (error) showToast("Save failed", "error");
    else {
      if (Number(f.cost) > 0) { const eName = f.entity_type === "truck" ? trucks.find(t => t.id === f.entity_id)?.name : trailers.find(t => t.id === f.entity_id)?.name; await db.from("expenses").insert({ id: uid(), date: f.date, truck_id: f.entity_type === "truck" ? f.entity_id : "FLEET", category: "Maintenance", description: `${f.category}${f.position ? ` - ${f.position}` : ""} (${eName})`, amount: Number(f.cost) }); }
      await fetchAll(); closeModal(); showToast("Service record saved ✓");
    }
    setSaving(false);
  };
  const saveInsurance = async (f) => { if (!f.provider || !f.premium_amount) return; setSaving(true); const { error } = await db.from("insurance").upsert({ id: editItem?.id || uid(), provider: f.provider, policy_number: f.policy_number || "", coverage_type: f.coverage_type, premium_amount: Number(f.premium_amount), payment_frequency: f.payment_frequency, start_date: f.start_date, end_date: f.end_date || null, entity_id: f.entity_id, entity_type: f.entity_type || "fleet", notes: f.notes || "" }); if (error) showToast("Save failed", "error"); else { await fetchAll(); closeModal(); showToast("Policy saved ✓"); } setSaving(false); };
  const saveDriver = async (f) => { if (!f.name) return; setSaving(true); const { error } = await db.from("drivers").upsert({ id: editItem?.id || uid(), name: f.name, email: f.email || "", phone: f.phone || "", cpm: Number(f.cpm || 0), active: f.active !== false, notes: f.notes || "", is_team_driver: f.is_team_driver || false, team_partner: f.team_partner || "" }); if (error) showToast("Save failed", "error"); else { await fetchAll(); closeModal(); showToast(editItem ? "Driver updated ✓" : "Driver added ✓"); } setSaving(false); };
  const delDriver = async (id) => { if (!confirm("Delete driver?")) return; await db.from("drivers").delete().eq("id", id); await fetchAll(); showToast("Deleted", "warn"); };
  const importFuel = async (rows) => { setSaving(true); const { error } = await db.from("fuel").upsert(rows); if (error) showToast("Import failed", "error"); else { await fetchAll(); showToast(`${rows.length} transactions imported ✓`); } setSaving(false); };
  const delLoad = async (id) => { if (!confirm("Delete?")) return; await db.from("loads").delete().eq("id", id); await fetchAll(); showToast("Deleted", "warn"); };
  const delFuel = async (id) => { if (!confirm("Delete?")) return; await db.from("fuel").delete().eq("id", id); await fetchAll(); showToast("Deleted", "warn"); };
  const delExp = async (id) => { if (!confirm("Delete?")) return; await db.from("expenses").delete().eq("id", id); await fetchAll(); showToast("Deleted", "warn"); };
  const delMaintenance = async (id) => { if (!confirm("Delete?")) return; await db.from("maintenance").delete().eq("id", id); await fetchAll(); showToast("Deleted", "warn"); };
  const delInsurance = async (id) => { if (!confirm("Delete?")) return; await db.from("insurance").delete().eq("id", id); await fetchAll(); showToast("Deleted", "warn"); };

  // ─── COMPUTED VALUES ───────────────────────────────────────────────────────
  const filtLoads = truckView === "FLEET" ? loads : loads.filter(l => l.truckId === truckView);
  const filtFuel = truckView === "FLEET" ? fuelLog : fuelLog.filter(f => f.truckId === truckView);
  const filtExp = truckView === "FLEET" ? expenses : expenses.filter(e => e.truckId === truckView || e.truckId === "FLEET");
  const totalRev = filtLoads.reduce((s, l) => s + Number(l.rate || 0) + Number(l.detention || 0), 0);
  const totalDPay = filtLoads.reduce((s, l) => { const pay = Number(l.driverCpm || 0) * Number(l.miles || 0); return s + pay + Number(l.driverOopExpenses || 0); }, 0);
  const totalFuel = filtFuel.reduce((s, f) => s + Number(f.total || 0), 0);
  const totalExp = filtExp.reduce((s, e) => s + Number(e.amount || 0), 0);
  const totalMiles = filtLoads.reduce((s, l) => s + Number(l.miles || 0), 0);
  const totalDetain = filtLoads.reduce((s, l) => s + Number(l.detention || 0), 0);
  const totalGals = filtFuel.reduce((s, f) => s + Number(f.gallons || 0), 0);
  const totalLumper = filtLoads.reduce((s, l) => { if (l.lumperPaidBy === "Out of Pocket" && l.lumperReimbursed !== "Yes") return s + Number(l.lumperCost || 0); return s; }, 0);
  const totalTolls = filtLoads.reduce((s, l) => s + Number(l.toll || 0), 0);
  const totalProfit = totalRev - totalDPay - totalFuel - totalExp - totalLumper - totalTolls;
  const margin = totalRev ? (totalProfit / totalRev) * 100 : 0;
  const avgRPM = totalMiles ? totalRev / totalMiles : 0;
  const cpm = totalMiles ? (totalDPay + totalFuel + totalExp + totalLumper + totalTolls) / totalMiles : 0;
  const mpg = (totalMiles && totalGals) ? totalMiles / totalGals : 0;
  const truckById = id => trucks.find(t => t.id === id);
  const trailerById = id => trailers.find(t => t.id === id);

  const truckSummaries = trucks.map(t => {
    const tl = loads.filter(l => l.truckId === t.id);
    const tf2 = fuelLog.filter(f => f.truckId === t.id);
    const te = expenses.filter(e => e.truckId === t.id);
    const rev = tl.reduce((s, l) => s + Number(l.rate || 0) + Number(l.detention || 0), 0);
    const dp = tl.reduce((s, l) => { const pay = Number(l.driverCpm || 0) * Number(l.miles || 0); return s + pay + Number(l.driverOopExpenses || 0); }, 0);
    const fuel = tf2.reduce((s, f) => s + Number(f.total || 0), 0);
    const exp = te.reduce((s, e) => s + Number(e.amount || 0), 0);
    const mi = tl.reduce((s, l) => s + Number(l.miles || 0), 0);
    const gals = tf2.reduce((s, f) => s + Number(f.gallons || 0), 0);
    const lumper = tl.reduce((s, l) => { if (l.lumperPaidBy === "Out of Pocket" && l.lumperReimbursed !== "Yes") return s + Number(l.lumperCost || 0); return s; }, 0);
    const profit = rev - dp - fuel - exp - lumper;
    const lastMaint = maintenance.filter(m => m.entityId === t.id).sort((a, b) => new Date(b.date) - new Date(a.date))[0];
    return { ...t, rev, dp, fuel, exp, mi, gals, profit, numLoads: tl.length, margin: rev ? (profit / rev) * 100 : 0, rpm: mi ? rev / mi : 0, mpg: (mi && gals) ? mi / gals : 0, lastMaint };
  });

  const maintAlerts = maintenance.filter(m => { if (!m.nextDueDate) return false; const days = Math.ceil((new Date(m.nextDueDate) - new Date()) / 86400000); return days <= 30; });
  const insAlerts = insurance.filter(i => { if (!i.endDate) return false; const days = Math.ceil((new Date(i.endDate) - new Date()) / 86400000); return days <= 60; });

  // Factoring computed
  const readyToFactor = loads.filter(l => l.factoringStatus === "Ready to Factor");
  const submittedLoads = loads.filter(l => l.factoringStatus === "Submitted");
  const advanceReceivedLoads = loads.filter(l => l.factoringStatus === "Advance Received");
  const totalAdvances = advanceReceivedLoads.reduce((s, l) => s + calcFactoring(Number(l.rate || 0) + Number(l.detention || 0)).advance, 0);
  const totalReserveHeld = [...submittedLoads, ...advanceReceivedLoads].reduce((s, l) => s + calcFactoring(Number(l.rate || 0) + Number(l.detention || 0)).reserve, 0);

  const laneMap = {};
  loads.forEach(l => { const key = `${l.origin?.split(",")[0]?.trim()} → ${l.dest?.split(",")[0]?.trim()}`; if (!laneMap[key]) laneMap[key] = { lane: key, loads: 0, miles: 0, revenue: 0, profit: 0 }; const g = Number(l.rate || 0) + Number(l.detention || 0); laneMap[key].loads++; laneMap[key].miles += Number(l.miles || 0); laneMap[key].revenue += g; laneMap[key].profit += g - g * (Number(l.driverPct || 0) / 100); });
  const lanes = Object.values(laneMap).sort((a, b) => b.revenue - a.revenue);
  const driverNames = [...new Set([...loads.map(l => l.driver), ...loads.filter(l => l.isTeamLoad && l.driver2).map(l => l.driver2)].filter(Boolean))];
  const driverStats = driverNames.map(name => {
    const dl = loads.filter(l => l.driver === name);
    const dl2 = loads.filter(l => l.isTeamLoad && l.driver2 === name);
    const rev = dl.reduce((s, l) => s + Number(l.rate || 0) + Number(l.detention || 0), 0);
    const pay = dl.reduce((s, l) => { const mi = l.isTeamLoad ? Number(l.miles || 0) / 2 : Number(l.miles || 0); return s + Number(l.driverCpm || 0) * mi + Number(l.driverOopExpenses || 0); }, 0)
              + dl2.reduce((s, l) => { const mi = Number(l.miles || 0) / 2; return s + Number(l.driver2Cpm || 0) * mi; }, 0);
    const mi = dl.reduce((s, l) => s + (l.isTeamLoad ? Number(l.miles || 0) / 2 : Number(l.miles || 0)), 0)
             + dl2.reduce((s, l) => s + Number(l.miles || 0) / 2, 0);
    const det = dl.reduce((s, l) => s + Number(l.detention || 0), 0);
    const profile = driverProfiles.find(d => d.name === name);
    const allLoads = [...dl, ...dl2.map(l => ({ ...l, driverCpm: l.driver2Cpm, driver: name }))];
    return { name, loads: allLoads.length, rev, pay, mi, det, cpm: profile?.cpm || dl[0]?.driverCpm || 0, allLoads };
  });
  const getPaystubLoads = (driver) => {
    const now = new Date();
    const inPeriod = (d) => {
      const date = new Date(d);
      if (paystubPeriod === "weekly") return (now - date) / 86400000 <= 7;
      if (paystubPeriod === "biweekly") return (now - date) / 86400000 <= 14;
      if (paystubPeriod === "monthly") return date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear();
      return true;
    };
    const primary = loads.filter(l => l.driver === driver && inPeriod(l.date));
    const asDriver2 = loads.filter(l => l.isTeamLoad && l.driver2 === driver && inPeriod(l.date))
      .map(l => ({ ...l, driverCpm: l.driver2Cpm, _isDriver2: true }));
    return [...primary, ...asDriver2];
  };

  // ─── STYLES ────────────────────────────────────────────────────────────────
  const S = {
    app: { display: "flex", minHeight: "100vh", background: "#f3f4f6", fontFamily: "'DM Sans','Segoe UI',sans-serif", color: "#111827" },
    sidebar: { width: 240, background: "#1e293b", display: "flex", flexDirection: "column", flexShrink: 0, position: "sticky", top: 0, height: "100vh", overflowY: "auto" },
    main: { flex: 1, padding: "28px 30px", overflowY: "auto", minWidth: 0 },
    ph: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 22, flexWrap: "wrap", gap: 12 },
    h1: { margin: 0, fontSize: 22, fontWeight: 900, color: "#111827" },
    grid: (n) => ({ display: "grid", gridTemplateColumns: `repeat(${n},1fr)`, gap: 14, marginBottom: 20 }),
    card: { background: "#fff", border: "1.5px solid #e5e7eb", borderRadius: 13, padding: "20px 22px", marginBottom: 18, boxShadow: "0 1px 4px rgba(0,0,0,0.05)" },
    tableWrap: { background: "#fff", border: "1.5px solid #e5e7eb", borderRadius: 13, overflow: "hidden", marginBottom: 18, boxShadow: "0 1px 4px rgba(0,0,0,0.05)" },
    navBtn: (a) => ({ display: "flex", alignItems: "center", gap: 10, padding: "10px 20px", cursor: "pointer", border: "none", background: a ? "rgba(255,255,255,0.12)" : "none", borderLeft: a ? "3px solid #f59e0b" : "3px solid transparent", color: a ? "#f59e0b" : "#94a3b8", fontWeight: a ? 700 : 500, fontSize: 13, width: "100%", textAlign: "left" }),
    btnDel: { background: "#fef2f2", color: "#dc2626", border: "1px solid #fecaca", borderRadius: 7, padding: "4px 10px", cursor: "pointer", fontSize: 11, fontWeight: 700 },
    btnEdt: { background: "#eff6ff", color: "#2563eb", border: "1px solid #bfdbfe", borderRadius: 7, padding: "4px 10px", cursor: "pointer", fontSize: 11, fontWeight: 700 },
    btnPrint: { background: "#f0fdf4", color: "#16a34a", border: "1px solid #bbf7d0", borderRadius: 7, padding: "4px 10px", cursor: "pointer", fontSize: 11, fontWeight: 700 },
    btnFactor: { background: "#eff6ff", color: "#2563eb", border: "1px solid #bfdbfe", borderRadius: 7, padding: "4px 10px", cursor: "pointer", fontSize: 11, fontWeight: 700 },
  };

  const TruckBar = () => (
    <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 20 }}>
      {[{ id: "FLEET", name: "All Fleet", color: "#d97706" }, ...trucks].map(t => (
        <button key={t.id} onClick={() => setTruckView(t.id)} style={{ background: truckView === t.id ? t.color : "#fff", border: `1.5px solid ${truckView === t.id ? t.color : "#d1d5db"}`, borderRadius: 9, padding: "7px 16px", color: truckView === t.id ? "#fff" : "#374151", fontWeight: 700, cursor: "pointer", fontSize: 12 }}>
          {t.id === "FLEET" ? "🚛 " : ""}{t.name}
        </button>
      ))}
    </div>
  );

  // ─── AUTH SCREENS ──────────────────────────────────────────────────────────
  if (authLoading) return (<div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "100vh", background: "#f3f4f6", flexDirection: "column", gap: 16 }}><div style={{ fontSize: 56 }}>⛟</div><div style={{ color: "#d97706", fontSize: 24, fontWeight: 900 }}>BHANDARI</div></div>);
  if (!session) return <LoginScreen onLogin={() => {}} />;
  if (loading) return (<div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "100vh", background: "#f3f4f6", flexDirection: "column", gap: 16 }}><div style={{ fontSize: 56 }}>⛟</div><div style={{ color: "#d97706", fontSize: 24, fontWeight: 900 }}>BHANDARI</div><div style={{ color: "#6b7280", fontSize: 14 }}>Loading your fleet...</div></div>);

  // ─── PAGE COMPONENTS ───────────────────────────────────────────────────────
  const Dashboard = () => (
    <>
      <div style={S.ph}><div><h1 style={S.h1}>Dashboard</h1><div style={{ color: "#6b7280", fontSize: 12, marginTop: 3 }}>Bhandari Logistics LLC · Omaha, NE</div></div><button onClick={fetchAll} style={{ background: "#fff", border: "1.5px solid #d1d5db", borderRadius: 9, color: "#6b7280", padding: "9px 16px", cursor: "pointer", fontSize: 13, fontWeight: 600 }}>🔄 Refresh</button></div>
      <TruckBar />
      {(maintAlerts.length > 0 || insAlerts.length > 0 || readyToFactor.length > 0) && (
        <div style={{ marginBottom: 18 }}>
          <div style={{ color: "#6b7280", fontSize: 11, fontWeight: 700, letterSpacing: 1, marginBottom: 10, textTransform: "uppercase" }}>⚠️ Alerts</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(280px,1fr))", gap: 10 }}>
            {readyToFactor.length > 0 && <div onClick={() => setTab("factoring")} style={{ cursor: "pointer" }}><AlertCard color="#2563eb" icon="💼" title={`${readyToFactor.length} load${readyToFactor.length > 1 ? "s" : ""} ready to factor`} sub={`Total: ${fmt$(readyToFactor.reduce((s, l) => s + Number(l.rate || 0) + Number(l.detention || 0), 0))} — click to open Factoring`} /></div>}
            {maintAlerts.slice(0, 3).map(m => { const days = Math.ceil((new Date(m.nextDueDate) - new Date()) / 86400000); const entity = m.entityType === "truck" ? trucks.find(t => t.id === m.entityId) : trailers.find(t => t.id === m.entityId); return (<AlertCard key={m.id} color={days <= 7 ? "#dc2626" : "#d97706"} icon={days <= 7 ? "🔴" : "🟡"} title={`${m.category} — ${entity?.name}`} sub={days <= 0 ? "OVERDUE!" : `Due in ${days} days`} />); })}
            {insAlerts.slice(0, 2).map(i => { const days = Math.ceil((new Date(i.endDate) - new Date()) / 86400000); return (<AlertCard key={i.id} color="#7c3aed" icon="🛡️" title={`${i.provider} expiring`} sub={`Expires in ${days} days`} />); })}
          </div>
        </div>
      )}
      <div style={S.grid(5)}>
        <StatCard label="Gross Revenue" value={fmt$(totalRev)} sub={`${filtLoads.length} loads`} accent="#16a34a" icon="💰" />
        <StatCard label="Net Profit" value={fmt$(totalProfit)} sub={`${fmtN(margin)}% margin`} accent={totalProfit >= 0 ? "#16a34a" : "#dc2626"} icon="📈" />
        <StatCard label="Driver Pay" value={fmt$(totalDPay)} sub="Total payroll" accent="#d97706" icon="👤" />
        <StatCard label="Fuel Spend" value={fmt$(totalFuel)} sub={`${fmtN(mpg, 1)} MPG`} accent="#dc2626" icon="⛽" />
        <StatCard label="Rate/Mile" value={`$${fmtN(avgRPM)}`} sub={`CPM $${fmtN(cpm)}`} accent="#2563eb" icon="🛣️" />
      </div>
      {trucks.length === 0 ? (
        <div style={{ ...S.card, textAlign: "center", padding: "48px 24px" }}>
          <div style={{ fontSize: 56, marginBottom: 16 }}>🚚</div>
          <div style={{ color: "#111827", fontWeight: 800, fontSize: 20, marginBottom: 8 }}>Welcome to Bhandari Fleet!</div>
          <div style={{ color: "#6b7280", fontSize: 14, marginBottom: 24 }}>Start by adding your trucks and trailers in Fleet & Trailers.</div>
          <PrimaryBtn onClick={() => { setTab("fleet"); setModal("truck"); }}>+ Add Your First Truck</PrimaryBtn>
        </div>
      ) : (
        <>
          <div style={S.card}>
            <div style={{ color: "#6b7280", fontSize: 11, fontWeight: 700, letterSpacing: 1, marginBottom: 16, textTransform: "uppercase" }}>Truck Performance</div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(200px,1fr))", gap: 12 }}>
              {truckSummaries.map(t => (
                <div key={t.id} onClick={() => setTruckView(t.id)} style={{ background: "#f9fafb", border: `2px solid ${t.color}`, borderRadius: 11, padding: "14px 16px", cursor: "pointer" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}><div style={{ width: 10, height: 10, borderRadius: "50%", background: t.color }} /><span style={{ color: "#111827", fontWeight: 800, fontSize: 14 }}>{t.name}</span><span style={{ color: "#9ca3af", fontSize: 11, marginLeft: "auto" }}>{t.numLoads} loads</span></div>
                  {[{ l: "Revenue", v: fmt$(t.rev), c: "#16a34a" }, { l: "Profit", v: fmt$(t.profit), c: t.profit >= 0 ? "#16a34a" : "#dc2626" }, { l: "Fuel", v: fmt$(t.fuel), c: "#dc2626" }, { l: "$/mi", v: `$${fmtN(t.rpm)}`, c: "#d97706" }].map(r => (<div key={r.l} style={{ display: "flex", justifyContent: "space-between", padding: "3px 0", borderBottom: "1px solid #e5e7eb" }}><span style={{ color: "#6b7280", fontSize: 11 }}>{r.l}</span><span style={{ color: r.c, fontSize: 12, fontWeight: 700, fontFamily: "monospace" }}>{r.v}</span></div>))}
                  {t.lastMaint && <div style={{ color: "#9ca3af", fontSize: 10, marginTop: 6 }}>🔧 {t.lastMaint.category} ({t.lastMaint.date})</div>}
                  <div style={{ marginTop: 8, background: "#e5e7eb", borderRadius: 99, height: 5 }}><div style={{ width: `${Math.min(100, Math.max(0, t.margin))}%`, height: "100%", background: t.color, borderRadius: 99 }} /></div>
                  <div style={{ color: "#6b7280", fontSize: 10, marginTop: 3 }}>{fmtN(t.margin)}% margin</div>
                </div>
              ))}
            </div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 18 }}>
            <div style={S.card}>
              <div style={{ color: "#6b7280", fontSize: 11, fontWeight: 700, letterSpacing: 1, marginBottom: 14, textTransform: "uppercase" }}>P&L Summary</div>
              {[{ l: "Gross Revenue", v: totalRev, c: "#16a34a" }, { l: "− Driver Pay", v: -totalDPay, c: "#dc2626" }, { l: "− Fuel", v: -totalFuel, c: "#dc2626" }, { l: "− Lumper (net)", v: -totalLumper, c: "#dc2626" }, { l: "− Tolls", v: -totalTolls, c: "#dc2626" }, { l: "− Expenses", v: -totalExp, c: "#dc2626" }].map(r => (<div key={r.l} style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: "1px solid #f3f4f6" }}><span style={{ color: "#374151", fontSize: 13 }}>{r.l}</span><span style={{ color: r.c, fontFamily: "monospace", fontWeight: 700 }}>{fmt$(r.v)}</span></div>))}
              <div style={{ display: "flex", justifyContent: "space-between", marginTop: 14, paddingTop: 14, borderTop: "2px solid #d97706" }}><span style={{ color: "#111827", fontWeight: 800, fontSize: 15 }}>NET PROFIT</span><span style={{ color: totalProfit >= 0 ? "#16a34a" : "#dc2626", fontWeight: 900, fontSize: 20, fontFamily: "monospace" }}>{fmt$(totalProfit)}</span></div>
            </div>
            <div style={S.card}>
              <div style={{ color: "#6b7280", fontSize: 11, fontWeight: 700, letterSpacing: 1, marginBottom: 14, textTransform: "uppercase" }}>Recent Loads</div>
              {loads.length === 0 && <div style={{ color: "#9ca3af", fontSize: 13 }}>No loads yet.</div>}
              {loads.slice(0, 6).map(l => { const g = Number(l.rate || 0) + Number(l.detention || 0); const truck = truckById(l.truckId); return (<div key={l.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 0", borderBottom: "1px solid #f3f4f6" }}><div><div style={{ color: "#d97706", fontWeight: 700, fontSize: 13 }}>{l.loadNum}</div><div style={{ color: "#9ca3af", fontSize: 11 }}>{l.origin} → {l.dest}</div>{truck && <Badge label={truck.name} color={truck.color} />}</div><div style={{ textAlign: "right" }}><div style={{ color: "#16a34a", fontFamily: "monospace", fontWeight: 700 }}>{fmt$(g)}</div><FactoringBadge s={l.factoringStatus || "Not Submitted"} /></div></div>); })}
            </div>
          </div>
        </>
      )}
    </>
  );

  // ─── FACTORING TAB ────────────────────────────────────────────────────────
  const Factoring = () => (
    <>
      <div style={S.ph}><div><h1 style={S.h1}>Factoring Manager</h1><div style={{ color: "#6b7280", fontSize: 12, marginTop: 3 }}>Apex Capital Corp · {APEX_FEE_PCT}% fee · {APEX_RESERVE_PCT}% reserve held</div></div></div>
      <div style={S.grid(4)}>
        <StatCard label="Ready to Factor" value={readyToFactor.length} sub={fmt$(readyToFactor.reduce((s, l) => s + Number(l.rate || 0) + Number(l.detention || 0), 0))} accent="#2563eb" icon="💼" />
        <StatCard label="Submitted to Apex" value={submittedLoads.length} sub="Awaiting advance" accent="#d97706" icon="📤" />
        <StatCard label="Advances Received" value={fmt$(totalAdvances)} sub={`${advanceReceivedLoads.length} loads paid`} accent="#16a34a" icon="💵" />
        <StatCard label="Reserve Balance" value={fmt$(totalReserveHeld)} sub="Held by Apex — released later" accent="#7c3aed" icon="🏦" />
      </div>

      {/* Ready to factor action queue */}
      {readyToFactor.length > 0 && (
        <div style={{ background: "#fff", border: "2px solid #bfdbfe", borderRadius: 13, padding: "20px 22px", marginBottom: 18 }}>
          <div style={{ color: "#1e40af", fontSize: 12, fontWeight: 800, letterSpacing: 1, marginBottom: 16, textTransform: "uppercase" }}>💼 Ready to Submit to Apex Capital ({readyToFactor.length} loads)</div>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead><tr>{["Load #", "Broker / Customer", "Route", "Date", "Gross", "Fee 2.3%", "Reserve 5%", "You Receive", "Truck", "Driver", "Actions"].map(h => <TH key={h}>{h}</TH>)}</tr></thead>
              <tbody>
                {readyToFactor.map(l => {
                  const g = Number(l.rate || 0) + Number(l.detention || 0);
                  const fct = calcFactoring(g);
                  const truck = truckById(l.truckId);
                  const trailer = trailerById(l.trailerId);
                  return (
                    <tr key={l.id} onMouseEnter={e => e.currentTarget.style.background = "#eff6ff"} onMouseLeave={e => e.currentTarget.style.background = "#fff"}>
                      <TD color="#d97706" bold>{l.loadNum}</TD>
                      <TD><div style={{ fontWeight: 700 }}>{l.brokerName || "—"}</div><div style={{ color: "#9ca3af", fontSize: 10 }}>{l.brokerMC || ""}</div></TD>
                      <TD>{l.origin?.split(",")[0]} → {l.dest?.split(",")[0]}</TD>
                      <TD>{l.date}</TD>
                      <TD mono color="#16a34a" bold>{fmt$(g)}</TD>
                      <TD mono color="#dc2626">−{fmt$(fct.fee)}</TD>
                      <TD mono color="#d97706">−{fmt$(fct.reserve)}</TD>
                      <TD mono color="#2563eb" bold>{fmt$(fct.advance)}</TD>
                      <TD>{truck && <Badge label={truck.name} color={truck.color} />}</TD>
                      <TD>{l.driver || "—"}</TD>
                      <TD>
                        <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                          <button style={S.btnFactor} onClick={() => { setFactoringLoad(l); setModal("factoringDetail"); }}>📋 View & Copy</button>
                          <button style={{ ...S.btnFactor, background: "#f0fdf4", color: "#16a34a", border: "1px solid #bbf7d0" }} onClick={() => updateFactoringStatus(l.id, "Submitted")}>✅ Mark Submitted</button>
                        </div>
                      </TD>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Full factoring tracker */}
      <div style={S.card}>
        <div style={{ color: "#6b7280", fontSize: 11, fontWeight: 700, letterSpacing: 1, marginBottom: 16, textTransform: "uppercase" }}>All Loads — Factoring Status Tracker</div>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead><tr>{["Load #", "Date", "Broker", "Route", "Gross", "Advance", "Reserve", "Status", ""].map(h => <TH key={h}>{h}</TH>)}</tr></thead>
            <tbody>
              {loads.length === 0 && <tr><td colSpan={9} style={{ padding: "32px", textAlign: "center", color: "#9ca3af" }}>No loads yet.</td></tr>}
              {loads.map(l => {
                const g = Number(l.rate || 0) + Number(l.detention || 0);
                const fct = calcFactoring(g);
                return (
                  <tr key={l.id} onMouseEnter={e => e.currentTarget.style.background = "#f9fafb"} onMouseLeave={e => e.currentTarget.style.background = "#fff"}>
                    <TD color="#d97706" bold>{l.loadNum}</TD>
                    <TD>{l.date}</TD>
                    <TD>{l.brokerName || "—"}</TD>
                    <TD>{l.origin?.split(",")[0]} → {l.dest?.split(",")[0]}</TD>
                    <TD mono color="#16a34a">{fmt$(g)}</TD>
                    <TD mono color="#2563eb">{fmt$(fct.advance)}</TD>
                    <TD mono color="#7c3aed">{fmt$(fct.reserve)}</TD>
                    <TD><FactoringBadge s={l.factoringStatus || "Not Submitted"} /></TD>
                    <TD><button style={S.btnFactor} onClick={() => { setFactoringLoad(l); setModal("factoringDetail"); }}>💼 Details</button></TD>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );

  const Loads = () => (
    <>
      <div style={S.ph}><div><h1 style={S.h1}>Load Management</h1></div><div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}><button onClick={() => setModal("rateCon")} style={{ background: "#eff6ff", color: "#2563eb", border: "1.5px solid #2563eb", borderRadius: 9, padding: "10px 16px", fontWeight: 700, cursor: "pointer", fontSize: 13 }}>🤖 Upload Rate Con</button><PrimaryBtn onClick={() => { setEditItem(null); setModal("load"); }}>+ Add Load</PrimaryBtn></div></div>
      <TruckBar />
      <div style={S.grid(5)}><StatCard label="In Transit" value={filtLoads.filter(l => l.status === "In Transit").length} accent="#d97706" icon="🚛" /><StatCard label="Pending" value={filtLoads.filter(l => l.status === "Pending").length} accent="#6b7280" icon="⏳" /><StatCard label="Delivered" value={filtLoads.filter(l => l.status === "Delivered").length} accent="#16a34a" icon="✅" /><StatCard label="Ready to Factor" value={filtLoads.filter(l => l.factoringStatus === "Ready to Factor").length} accent="#2563eb" icon="💼" /><StatCard label="Total Rev" value={fmt$(totalRev)} accent="#16a34a" icon="💰" /></div>
      <div style={S.tableWrap}><div style={{ overflowX: "auto" }}><table style={{ width: "100%", borderCollapse: "collapse" }}><thead><tr>{["Load#", "Date", "Truck", "Trailer", "Origin → Dest", "Miles", "Rate", "Lumper", "Driver", "Profit", "Factoring", "Status", ""].map(h => <TH key={h}>{h}</TH>)}</tr></thead><tbody>
        {filtLoads.length === 0 && <tr><td colSpan={13} style={{ padding: "32px", textAlign: "center", color: "#9ca3af" }}>No loads yet.</td></tr>}
        {filtLoads.map(l => {
          const g = Number(l.rate || 0) + Number(l.detention || 0);
          const splitMi = l.isTeamLoad ? Number(l.miles || 0) / 2 : Number(l.miles || 0);
          const dp = Number(l.driverCpm || 0) * splitMi + Number(l.driver2Cpm || 0) * (l.isTeamLoad ? splitMi : 0);
          const lumperNet = l.lumperPaidBy === "Out of Pocket" && l.lumperReimbursed !== "Yes" ? Number(l.lumperCost || 0) : 0;
          const pr = g - dp - lumperNet - Number(l.toll || 0);
          const truck = truckById(l.truckId);
          const trailer = trailerById(l.trailerId);
          return (<tr key={l.id} onMouseEnter={e => e.currentTarget.style.background = "#f9fafb"} onMouseLeave={e => e.currentTarget.style.background = "#fff"}>
            <TD color="#d97706" bold>{l.loadNum}{l.isTeamLoad && <span style={{ background: "#7c3aed20", color: "#7c3aed", border: "1px solid #7c3aed44", borderRadius: 6, padding: "1px 5px", fontSize: 9, fontWeight: 700, marginLeft: 4 }}>TEAM</span>}</TD>
            <TD>{l.date}</TD>
            <TD>{truck && <Badge label={truck.name} color={truck.color} />}</TD>
            <TD>{trailer && <Badge label={trailer.name} color={trailer.color || "#16a34a"} />}</TD>
            <TD>{l.origin} → {l.dest}</TD>
            <TD mono>{fmtMi(l.miles)}</TD><TD mono>{fmt$(l.rate)}</TD>
            <TD mono color={lumperNet > 0 ? "#dc2626" : "#9ca3af"}>{lumperNet > 0 ? fmt$(lumperNet) : "—"}</TD>
            <TD><div>{l.driver}</div>{l.isTeamLoad && l.driver2 && <div style={{ color: "#7c3aed", fontSize: 11 }}>+ {l.driver2}</div>}</TD>
            <TD mono color={pr >= 0 ? "#16a34a" : "#dc2626"} bold>{fmt$(pr)}</TD>
            <TD><FactoringBadge s={l.factoringStatus || "Not Submitted"} /></TD>
            <TD><StatusBadge s={l.status} /></TD>
            <TD><div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
              <button style={S.btnFactor} onClick={() => { setFactoringLoad(l); setModal("factoringDetail"); }}>💼</button>
              <button style={S.btnEdt} onClick={() => { setEditItem(l); setModal("load"); }}>Edit</button>
              <button style={S.btnDel} onClick={() => delLoad(l.id)}>Del</button>
            </div></TD>
          </tr>);
        })}
      </tbody></table></div></div>
    </>
  );

  const Fuel = () => (
    <>
      <div style={S.ph}><div><h1 style={S.h1}>Fuel Tracker</h1></div><div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        <button onClick={() => setModal("mudflap")} style={{ background: "#fff7ed", color: "#ea580c", border: "1.5px solid #ea580c", borderRadius: 9, padding: "10px 16px", fontWeight: 700, cursor: "pointer", fontSize: 13 }}>🟠 Import Mudflap PDF</button>
        <SecondaryBtn onClick={() => setModal("csvImport")}>📥 Import TCS CSV</SecondaryBtn>
        <PrimaryBtn onClick={() => { setEditItem(null); setModal("fuel"); }}>+ Add Manual</PrimaryBtn>
      </div></div>
      <TruckBar />
      <div style={S.grid(5)}><StatCard label="Total Fuel" value={fmt$(totalFuel)} accent="#dc2626" icon="⛽" /><StatCard label="Gallons" value={fmtN(totalGals, 0) + " gal"} accent="#d97706" icon="🛢️" /><StatCard label="Avg MPG" value={fmtN(mpg, 2)} accent="#16a34a" icon="📊" /><StatCard label="Avg PPG" value={"$" + fmtN(totalGals ? totalFuel / totalGals : 0, 3)} accent="#2563eb" icon="💲" /><StatCard label="Fuel%Rev" value={fmtN(totalRev ? totalFuel / totalRev * 100 : 0) + "%"} accent="#7c3aed" icon="📉" /></div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(170px,1fr))", gap: 12, marginBottom: 18 }}>{truckSummaries.map(t => (<div key={t.id} style={{ background: "#fff", border: `2px solid ${t.color}`, borderRadius: 11, padding: 14 }}><div style={{ color: t.color, fontWeight: 800, fontSize: 13, marginBottom: 8 }}>{t.name}</div><div style={{ color: "#dc2626", fontFamily: "monospace", fontWeight: 800, fontSize: 18 }}>{fmt$(t.fuel)}</div><div style={{ color: "#6b7280", fontSize: 11, marginTop: 4 }}>{fmtN(t.gals, 0)} gal · {fmtN(t.mpg, 1)} MPG</div></div>))}</div>
      <div style={S.tableWrap}><div style={{ overflowX: "auto" }}><table style={{ width: "100%", borderCollapse: "collapse" }}><thead><tr>{["Date", "Truck", "Location", "Gallons", "$/Gal", "Total", "Load#", ""].map(h => <TH key={h}>{h}</TH>)}</tr></thead><tbody>
        {filtFuel.length === 0 && <tr><td colSpan={8} style={{ padding: "32px", textAlign: "center", color: "#9ca3af" }}>No fuel entries yet.</td></tr>}
        {filtFuel.map(f => { const t = truckById(f.truckId); return (<tr key={f.id} onMouseEnter={e => e.currentTarget.style.background = "#f9fafb"} onMouseLeave={e => e.currentTarget.style.background = "#fff"}><TD>{f.date}</TD><TD>{t && <Badge label={t.name} color={t.color} />}</TD><TD>{f.location || "—"}</TD><TD mono>{fmtN(f.gallons, 1)}</TD><TD mono>${fmtN(f.pricePer, 3)}</TD><TD mono color="#dc2626" bold>{fmt$(f.total)}</TD><TD color="#d97706">{f.loadNum || "—"}</TD><TD><div style={{ display: "flex", gap: 5 }}><button style={S.btnEdt} onClick={() => { setEditItem(f); setModal("fuel"); }}>Edit</button><button style={S.btnDel} onClick={() => delFuel(f.id)}>Del</button></div></TD></tr>); })}
      </tbody></table></div></div>
    </>
  );

  const Maintenance = () => {
    const [filterEntity, setFilterEntity] = useState("ALL");
    const filtered = filterEntity === "ALL" ? maintenance : maintenance.filter(m => m.entityId === filterEntity);
    const allEntities = [...trucks.map(t => ({ id: t.id, name: t.name, type: "truck", color: t.color })), ...trailers.map(t => ({ id: t.id, name: t.name, type: "trailer", color: t.color || "#16a34a" }))];
    return (
      <>
        <div style={S.ph}><div><h1 style={S.h1}>Maintenance Tracker</h1><div style={{ color: "#6b7280", fontSize: 12, marginTop: 3 }}>Service costs auto-log to expenses</div></div><PrimaryBtn onClick={() => { setEditItem(null); setModal("maintenance"); }}>+ Add Service Record</PrimaryBtn></div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 20 }}>
          <button onClick={() => setFilterEntity("ALL")} style={{ background: filterEntity === "ALL" ? "#d97706" : "#fff", border: `1.5px solid ${filterEntity === "ALL" ? "#d97706" : "#d1d5db"}`, borderRadius: 9, padding: "7px 16px", color: filterEntity === "ALL" ? "#fff" : "#374151", fontWeight: 700, cursor: "pointer", fontSize: 12 }}>All</button>
          {allEntities.map(e => (<button key={e.id} onClick={() => setFilterEntity(e.id)} style={{ background: filterEntity === e.id ? e.color : "#fff", border: `1.5px solid ${filterEntity === e.id ? e.color : "#d1d5db"}`, borderRadius: 9, padding: "7px 16px", color: filterEntity === e.id ? "#fff" : "#374151", fontWeight: 700, cursor: "pointer", fontSize: 12 }}>{e.type === "trailer" ? "🚛 " : "🚚 "}{e.name}</button>))}
        </div>
        {maintAlerts.length > 0 && <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(280px,1fr))", gap: 10, marginBottom: 18 }}>{maintAlerts.map(m => { const days = Math.ceil((new Date(m.nextDueDate) - new Date()) / 86400000); const entity = m.entityType === "truck" ? trucks.find(t => t.id === m.entityId) : trailers.find(t => t.id === m.entityId); return (<AlertCard key={m.id} color={days <= 0 ? "#dc2626" : days <= 7 ? "#dc2626" : "#d97706"} icon={days <= 0 ? "🔴" : "🟡"} title={`${m.category}${m.position ? ` — ${m.position}` : ""} — ${entity?.name}`} sub={days <= 0 ? `OVERDUE by ${Math.abs(days)} days` : `Due in ${days} days (${m.nextDueDate})`} />); })}</div>}
        <div style={S.tableWrap}><div style={{ overflowX: "auto" }}><table style={{ width: "100%", borderCollapse: "collapse" }}><thead><tr>{["Date", "Equipment", "Category", "Position", "Miles", "Next Due Miles", "Next Due Date", "Cost", "Notes", ""].map(h => <TH key={h}>{h}</TH>)}</tr></thead><tbody>
          {filtered.length === 0 && <tr><td colSpan={10} style={{ padding: "32px", textAlign: "center", color: "#9ca3af" }}>No service records yet.</td></tr>}
          {filtered.map(m => {
            const entity = m.entityType === "truck" ? trucks.find(t => t.id === m.entityId) : trailers.find(t => t.id === m.entityId);
            const daysUntil = m.nextDueDate ? Math.ceil((new Date(m.nextDueDate) - new Date()) / 86400000) : null;
            return (<tr key={m.id} onMouseEnter={e => e.currentTarget.style.background = "#f9fafb"} onMouseLeave={e => e.currentTarget.style.background = "#fff"}>
              <TD>{m.date}</TD><TD>{entity && <Badge label={entity.name} color={entity.color || "#16a34a"} />}</TD>
              <TD bold color="#374151">{m.category}</TD><TD color="#6b7280">{m.position || "—"}</TD>
              <TD mono>{m.milesAtService ? fmtMi(m.milesAtService) : "—"}</TD>
              <TD mono>{m.nextDueMiles ? fmtMi(m.nextDueMiles) : "—"}</TD>
              <TD color={daysUntil !== null && daysUntil <= 14 ? "#dc2626" : "#374151"}>{m.nextDueDate || "—"}{daysUntil !== null && daysUntil <= 30 ? <span style={{ fontSize: 10, marginLeft: 4, color: daysUntil <= 0 ? "#dc2626" : "#d97706" }}>({daysUntil <= 0 ? "OVERDUE" : `${daysUntil}d`})</span> : null}</TD>
              <TD mono color="#dc2626">{m.cost > 0 ? fmt$(m.cost) : "—"}</TD>
              <TD color="#6b7280">{m.notes || m.description || "—"}</TD>
              <TD><div style={{ display: "flex", gap: 5 }}><button style={S.btnEdt} onClick={() => { setEditItem(m); setModal("maintenance"); }}>Edit</button><button style={S.btnDel} onClick={() => delMaintenance(m.id)}>Del</button></div></TD>
            </tr>);
          })}
        </tbody></table></div></div>
      </>
    );
  };

  const Fleet = () => (
    <>
      <div style={S.ph}><div><h1 style={S.h1}>Fleet Management</h1></div><div style={{ display: "flex", gap: 10 }}><SecondaryBtn onClick={() => { setEditItem(null); setModal("trailer"); }}>+ Add Trailer</SecondaryBtn><PrimaryBtn onClick={() => { setEditItem(null); setModal("truck"); }}>+ Add Truck</PrimaryBtn></div></div>
      <div style={{ color: "#6b7280", fontSize: 11, fontWeight: 700, letterSpacing: 1, marginBottom: 12, textTransform: "uppercase" }}>Trucks ({trucks.length})</div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(280px,1fr))", gap: 18, marginBottom: 28 }}>
        {truckSummaries.map(t => (<div key={t.id} style={{ background: "#fff", border: `2px solid ${t.color}`, borderRadius: 14, padding: 20, boxShadow: "0 2px 8px rgba(0,0,0,0.06)" }}><div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 14 }}><div><div style={{ color: t.color, fontWeight: 900, fontSize: 18 }}>{t.name}</div><div style={{ color: "#6b7280", fontSize: 12, marginTop: 2 }}>{[t.year, t.make, t.model].filter(Boolean).join(" ") || "No details"}</div>{t.plate && <div style={{ color: "#9ca3af", fontSize: 11 }}>{t.plate}</div>}</div><div style={{ display: "flex", gap: 6 }}><button style={S.btnEdt} onClick={() => { setEditItem(t); setModal("truck"); }}>Edit</button><Badge label={t.active ? "Active" : "Inactive"} color={t.active ? "#16a34a" : "#dc2626"} /></div></div><div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>{[{ l: "Revenue", v: fmt$(t.rev), c: "#16a34a" }, { l: "Profit", v: fmt$(t.profit), c: t.profit >= 0 ? "#16a34a" : "#dc2626" }, { l: "Fuel", v: fmt$(t.fuel), c: "#dc2626" }, { l: "Driver Pay", v: fmt$(t.dp), c: "#d97706" }, { l: "Miles", v: fmtMi(t.mi), c: "#2563eb" }, { l: "$/Mile", v: "$" + fmtN(t.rpm), c: "#d97706" }].map(r => (<div key={r.l} style={{ background: "#f9fafb", borderRadius: 8, padding: "8px 10px", border: "1px solid #e5e7eb" }}><div style={{ color: "#6b7280", fontSize: 10, fontWeight: 700, textTransform: "uppercase" }}>{r.l}</div><div style={{ color: r.c, fontFamily: "monospace", fontWeight: 700, fontSize: 13, marginTop: 2 }}>{r.v}</div></div>))}</div>{t.lastMaint && <div style={{ background: "#fffbeb", border: "1px solid #fde68a", borderRadius: 8, padding: "8px 10px", marginTop: 10, fontSize: 12, color: "#92400e" }}>🔧 Last: {t.lastMaint.category} on {t.lastMaint.date}</div>}<div style={{ marginTop: 12, background: "#e5e7eb", borderRadius: 99, height: 5 }}><div style={{ width: `${Math.min(100, Math.max(0, t.margin))}%`, height: "100%", background: t.color, borderRadius: 99 }} /></div><div style={{ color: "#6b7280", fontSize: 10, marginTop: 3 }}>{fmtN(t.margin)}% margin</div></div>))}
        {trucks.length === 0 && <div style={{ ...S.card, textAlign: "center", padding: 32 }}><div style={{ fontSize: 36 }}>🚚</div><div style={{ color: "#6b7280", marginTop: 8 }}>No trucks yet.</div></div>}
      </div>
      <div style={{ color: "#6b7280", fontSize: 11, fontWeight: 700, letterSpacing: 1, marginBottom: 12, textTransform: "uppercase" }}>Trailers ({trailers.length})</div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(260px,1fr))", gap: 16 }}>
        {trailers.map(t => { const tMaint = maintenance.filter(m => m.entityId === t.id).sort((a, b) => new Date(b.date) - new Date(a.date))[0]; return (<div key={t.id} style={{ background: "#fff", border: `2px solid ${t.color || "#16a34a"}`, borderRadius: 14, padding: 20, boxShadow: "0 2px 8px rgba(0,0,0,0.06)" }}><div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 14 }}><div><div style={{ color: t.color || "#16a34a", fontWeight: 900, fontSize: 18 }}>🚛 {t.name}</div><div style={{ color: "#6b7280", fontSize: 12, marginTop: 2 }}>{t.type} · {[t.year, t.make, t.model].filter(Boolean).join(" ") || "No details"}</div>{t.plate && <div style={{ color: "#9ca3af", fontSize: 11 }}>{t.plate}</div>}</div><div style={{ display: "flex", gap: 6 }}><button style={S.btnEdt} onClick={() => { setEditItem(t); setModal("trailer"); }}>Edit</button><Badge label={t.active ? "Active" : "Inactive"} color={t.active ? "#16a34a" : "#dc2626"} /></div></div>{tMaint ? <div style={{ background: "#fffbeb", border: "1px solid #fde68a", borderRadius: 8, padding: "8px 10px", fontSize: 12, color: "#92400e" }}>🔧 Last: {tMaint.category} on {tMaint.date}</div> : <div style={{ color: "#9ca3af", fontSize: 12 }}>No service records yet</div>}<button onClick={() => { setEditItem(null); setModal("maintenance"); }} style={{ marginTop: 12, background: "#f0fdf4", color: "#16a34a", border: "1px solid #bbf7d0", borderRadius: 8, padding: "7px 14px", cursor: "pointer", fontSize: 12, fontWeight: 700, width: "100%" }}>+ Add Service Record</button></div>); })}
        {trailers.length === 0 && <div style={{ ...S.card, textAlign: "center", padding: 32 }}><div style={{ fontSize: 36 }}>🚛</div><div style={{ color: "#6b7280", marginTop: 8 }}>No trailers yet.</div></div>}
      </div>
    </>
  );

  const Insurance = () => {
    const totalMonthly = insurance.reduce((s, i) => { const amt = Number(i.premiumAmount || 0); if (i.paymentFrequency === "Monthly") return s + amt; if (i.paymentFrequency === "Quarterly") return s + amt / 3; if (i.paymentFrequency === "Semi-Annual") return s + amt / 6; if (i.paymentFrequency === "Annual") return s + amt / 12; return s + amt; }, 0);
    return (
      <>
        <div style={S.ph}><div><h1 style={S.h1}>Insurance Tracker</h1></div><PrimaryBtn onClick={() => { setEditItem(null); setModal("insurance"); }}>+ Add Policy</PrimaryBtn></div>
        <div style={S.grid(3)}><StatCard label="Total Policies" value={insurance.length} accent="#7c3aed" icon="🛡️" /><StatCard label="Monthly Cost" value={fmt$(totalMonthly)} sub="Estimated" accent="#dc2626" icon="💰" /><StatCard label="Annual Cost" value={fmt$(totalMonthly * 12)} sub="Projected" accent="#d97706" icon="📅" /></div>
        {insAlerts.length > 0 && <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(280px,1fr))", gap: 10, marginBottom: 18 }}>{insAlerts.map(i => { const days = Math.ceil((new Date(i.endDate) - new Date()) / 86400000); return (<AlertCard key={i.id} color="#7c3aed" icon="🛡️" title={`${i.provider} — ${i.coverageType}`} sub={`Expires in ${days} days — Renew before ${i.endDate}`} />); })}</div>}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(300px,1fr))", gap: 16 }}>
          {insurance.map(i => { const days = i.endDate ? Math.ceil((new Date(i.endDate) - new Date()) / 86400000) : null; return (<div key={i.id} style={{ background: "#fff", border: `1.5px solid ${days !== null && days <= 30 ? "#7c3aed" : "#e5e7eb"}`, borderRadius: 13, padding: 20 }}><div style={{ display: "flex", justifyContent: "space-between", marginBottom: 12 }}><div><div style={{ color: "#7c3aed", fontWeight: 900, fontSize: 16 }}>🛡️ {i.provider}</div><div style={{ color: "#6b7280", fontSize: 12 }}>{i.coverageType}</div>{i.policyNumber && <div style={{ color: "#9ca3af", fontSize: 11 }}>#{i.policyNumber}</div>}</div><div style={{ display: "flex", gap: 6 }}><button style={S.btnEdt} onClick={() => { setEditItem(i); setModal("insurance"); }}>Edit</button><button style={S.btnDel} onClick={() => delInsurance(i.id)}>Del</button></div></div>{[{ l: "Premium", v: fmt$(i.premiumAmount), c: "#dc2626" }, { l: "Frequency", v: i.paymentFrequency, c: "#374151" }, { l: "Expiration", v: i.endDate || "—", c: days !== null && days <= 30 ? "#7c3aed" : "#374151" }].map(r => (<div key={r.l} style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", borderBottom: "1px solid #f3f4f6" }}><span style={{ color: "#6b7280", fontSize: 12 }}>{r.l}</span><span style={{ color: r.c, fontWeight: 600, fontSize: 12 }}>{r.v}</span></div>))}{days !== null && days <= 60 && <div style={{ background: "#faf5ff", border: "1px solid #d8b4fe", borderRadius: 7, padding: "6px 10px", marginTop: 8, fontSize: 12, color: "#7c3aed", fontWeight: 700 }}>⚠️ Expires in {days} days</div>}</div>); })}
          {insurance.length === 0 && <div style={{ ...S.card, textAlign: "center", padding: 40 }}><div style={{ fontSize: 40 }}>🛡️</div><div style={{ color: "#6b7280", marginTop: 8 }}>No policies added yet.</div></div>}
        </div>
      </>
    );
  };

  const Expenses = () => {
    const byCat = [...new Set(filtExp.map(e => e.category))].map(c => ({ c, t: filtExp.filter(e => e.category === c).reduce((s, e) => s + Number(e.amount || 0), 0) }));
    return (
      <>
        <div style={S.ph}><div><h1 style={S.h1}>Expenses</h1></div><div style={{ display: "flex", gap: 10 }}><button onClick={() => setModal("repairReceipt")} style={{ background: "#fff7ed", color: "#ea580c", border: "1.5px solid #ea580c", borderRadius: 9, padding: "10px 16px", fontWeight: 700, cursor: "pointer", fontSize: 13 }}>🧾 Scan Receipt</button><PrimaryBtn onClick={() => { setEditItem(null); setModal("expense"); }}>+ Add Expense</PrimaryBtn></div></div>
        <TruckBar />
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 20 }}>
          {byCat.map(ec => (<div key={ec.c} style={{ background: "#fff", border: "1.5px solid #e5e7eb", borderRadius: 10, padding: "12px 16px", minWidth: 130 }}><div style={{ color: "#6b7280", fontSize: 10, fontWeight: 700, textTransform: "uppercase" }}>{ec.c}</div><div style={{ color: "#d97706", fontFamily: "monospace", fontWeight: 800, fontSize: 18, marginTop: 4 }}>{fmt$(ec.t)}</div></div>))}
          <div style={{ background: "#fff", border: "1.5px solid #fecaca", borderRadius: 10, padding: "12px 16px", minWidth: 130 }}><div style={{ color: "#6b7280", fontSize: 10, fontWeight: 700, textTransform: "uppercase" }}>Total</div><div style={{ color: "#dc2626", fontFamily: "monospace", fontWeight: 800, fontSize: 18, marginTop: 4 }}>{fmt$(totalExp)}</div></div>
        </div>
        <div style={S.tableWrap}><div style={{ overflowX: "auto" }}><table style={{ width: "100%", borderCollapse: "collapse" }}><thead><tr>{["Date", "Truck", "Category", "Description", "Amount", ""].map(h => <TH key={h}>{h}</TH>)}</tr></thead><tbody>
          {filtExp.length === 0 && <tr><td colSpan={6} style={{ padding: "32px", textAlign: "center", color: "#9ca3af" }}>No expenses yet.</td></tr>}
          {filtExp.map(e => { const t = e.truckId === "FLEET" ? { name: "Fleet", color: "#6b7280" } : truckById(e.truckId); return (<tr key={e.id} onMouseEnter={ev => ev.currentTarget.style.background = "#f9fafb"} onMouseLeave={ev => ev.currentTarget.style.background = "#fff"}><TD>{e.date}</TD><TD>{t && <Badge label={t.name} color={t.color} />}</TD><TD><span style={{ background: "#f3f4f6", borderRadius: 6, padding: "2px 8px", fontSize: 11, color: "#374151", fontWeight: 600 }}>{e.category}</span></TD><TD>{e.description}</TD><TD mono color="#dc2626" bold>{fmt$(e.amount)}</TD><TD><button style={S.btnDel} onClick={() => delExp(e.id)}>Del</button></TD></tr>); })}
        </tbody></table></div></div>
      </>
    );
  };

  const Drivers = () => (
    <>
      <div style={S.ph}>
        <div><h1 style={S.h1}>Drivers & Paystubs</h1><div style={{ color: "#6b7280", fontSize: 12, marginTop: 3 }}>Manage driver profiles and view pay history</div></div>
        <PrimaryBtn onClick={() => { setEditItem(null); setModal("driver"); }}>+ Add Driver</PrimaryBtn>
      </div>

      {/* Driver Profiles */}
      {driverProfiles.length > 0 && (
        <div style={{ marginBottom: 20 }}>
          <div style={{ color: "#6b7280", fontSize: 11, fontWeight: 700, letterSpacing: 1, marginBottom: 12, textTransform: "uppercase" }}>Driver Profiles ({driverProfiles.length})</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(280px,1fr))", gap: 14 }}>
            {driverProfiles.map(d => {
              const stats = driverStats.find(s => s.name === d.name);
              return (
                <div key={d.id} style={S.card}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                      <div style={{ width: 44, height: 44, borderRadius: "50%", background: "linear-gradient(135deg,#d97706,#b45309)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, fontWeight: 900, color: "#fff" }}>{d.name.split(" ").map(n => n[0]).join("").slice(0, 2)}</div>
                      <div><div style={{ color: "#111827", fontWeight: 800, fontSize: 15 }}>{d.name}{d.isTeamDriver && <span style={{ background: "#7c3aed20", color: "#7c3aed", border: "1px solid #7c3aed44", borderRadius: 6, padding: "1px 6px", fontSize: 10, fontWeight: 700, marginLeft: 6 }}>🚛🚛 TEAM</span>}</div><div style={{ color: "#6b7280", fontSize: 12 }}>💰 ${fmtN(d.cpm, 2)}/mile CPM</div>{d.isTeamDriver && d.teamPartner && <div style={{ color: "#7c3aed", fontSize: 11 }}>👥 Partner: {d.teamPartner}</div>}</div>
                    </div>
                    <div style={{ display: "flex", gap: 6 }}>
                      <button style={S.btnEdt} onClick={() => { setEditItem(d); setModal("driver"); }}>Edit</button>
                      <button style={S.btnDel} onClick={() => delDriver(d.id)}>Del</button>
                    </div>
                  </div>
                  {d.phone && <div style={{ color: "#6b7280", fontSize: 12, marginBottom: 4 }}>📞 {d.phone}</div>}
                  {stats && (
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginTop: 10 }}>
                      {[{ l: "Loads", v: stats.loads }, { l: "Miles", v: fmtMi(stats.mi) }, { l: "Total Pay", v: fmt$(stats.pay) }].map(r => (
                        <div key={r.l} style={{ background: "#f9fafb", borderRadius: 8, padding: "8px 10px", textAlign: "center" }}>
                          <div style={{ color: "#6b7280", fontSize: 10, fontWeight: 700 }}>{r.l}</div>
                          <div style={{ color: "#d97706", fontWeight: 800, fontSize: 13, marginTop: 2 }}>{r.v}</div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Pay period selector */}
      <div style={{ display: "flex", gap: 12, alignItems: "center", marginBottom: 20 }}>
        <div style={{ color: "#374151", fontSize: 13, fontWeight: 600 }}>Pay Period:</div>
        {["weekly", "biweekly", "monthly", "all"].map(p => (<button key={p} onClick={() => setPaystubPeriod(p)} style={{ background: paystubPeriod === p ? "#d97706" : "#fff", border: `1.5px solid ${paystubPeriod === p ? "#d97706" : "#d1d5db"}`, borderRadius: 8, padding: "7px 16px", color: paystubPeriod === p ? "#fff" : "#374151", fontWeight: 700, cursor: "pointer", fontSize: 12 }}>{p.charAt(0).toUpperCase() + p.slice(1)}</button>))}
      </div>

      {driverStats.length === 0 && driverProfiles.length === 0 && (
        <div style={{ ...S.card, textAlign: "center", padding: 48 }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>👤</div>
          <div style={{ color: "#111827", fontWeight: 700, fontSize: 16, marginBottom: 8 }}>No drivers yet</div>
          <div style={{ color: "#6b7280", fontSize: 14, marginBottom: 24 }}>Add a driver profile to set their CPM rate, or add a load with a driver name.</div>
          <PrimaryBtn onClick={() => { setEditItem(null); setModal("driver"); }}>+ Add Your First Driver</PrimaryBtn>
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(320px,1fr))", gap: 18 }}>
        {driverStats.map(d => {
          const periodLoads = getPaystubLoads(d.name);
          const periodPay = periodLoads.reduce((s, l) => {
            const mi = l.isTeamLoad ? Number(l.miles || 0) / 2 : Number(l.miles || 0);
            return s + Number(l.driverCpm || 0) * mi + Number(l.driverOopExpenses || 0);
          }, 0);
          return (
            <div key={d.name} style={{ background: "#fff", border: "1.5px solid #e5e7eb", borderRadius: 14, padding: 22, boxShadow: "0 2px 8px rgba(0,0,0,0.06)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 18 }}>
                <div style={{ width: 52, height: 52, borderRadius: "50%", background: "linear-gradient(135deg,#d97706,#b45309)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, fontWeight: 900, color: "#fff" }}>{d.name.split(" ").map(n => n[0]).join("").slice(0, 2)}</div>
                <div><div style={{ color: "#111827", fontWeight: 800, fontSize: 16 }}>{d.name}</div><div style={{ color: "#6b7280", fontSize: 12 }}>${fmtN(d.cpm, 2)}/mi · {d.loads} loads</div></div>
              </div>
              {[{ l: "All-Time Revenue", v: fmt$(d.rev), c: "#16a34a" }, { l: "All-Time Pay", v: fmt$(d.pay), c: "#d97706" }, { l: "Total Miles", v: fmtMi(d.mi) + " mi", c: "#2563eb" }, { l: "Detention", v: fmt$(d.det), c: "#7c3aed" }].map(r => (
                <div key={r.l} style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: "1px solid #f3f4f6" }}>
                  <span style={{ color: "#374151", fontSize: 12 }}>{r.l}</span>
                  <span style={{ color: r.c, fontFamily: "monospace", fontWeight: 700 }}>{r.v}</span>
                </div>
              ))}
              <div style={{ background: "#fffbeb", border: "1.5px solid #fde68a", borderRadius: 10, padding: "12px 14px", margin: "14px 0" }}>
                <div style={{ color: "#92400e", fontSize: 10, fontWeight: 700, letterSpacing: 1, marginBottom: 6 }}>{paystubPeriod.toUpperCase()} PAY ({periodLoads.length} loads)</div>
                <div style={{ color: "#d97706", fontFamily: "monospace", fontWeight: 900, fontSize: 24 }}>{fmt$(periodPay)}</div>
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <button onClick={() => printPaystub(d.name, periodLoads, paystubPeriod)} style={{ ...S.btnPrint, flex: 1, padding: "9px", textAlign: "center", fontSize: 13 }}>🖨️ Print Paystub</button>
                <button onClick={() => { setPaystubDriver(d.name); setModal("driverLoads"); }} style={{ ...S.btnEdt, flex: 1, padding: "9px", textAlign: "center", fontSize: 13 }}>📋 View Runs</button>
              </div>
            </div>
          );
        })}
      </div>
    </>
  );

  const Lanes = () => (<><div style={S.ph}><h1 style={S.h1}>Lane Analytics</h1></div><div style={S.grid(4)}><StatCard label="Total Lanes" value={lanes.length} accent="#2563eb" icon="🗺️" /><StatCard label="Best RPM" value={lanes.length ? `$${fmtN(Math.max(...lanes.map(l => l.miles ? l.revenue / l.miles : 0)))}` : "—"} accent="#16a34a" icon="🏆" /><StatCard label="Total Miles" value={fmtMi(lanes.reduce((s, l) => s + l.miles, 0))} accent="#d97706" icon="🛣️" /><StatCard label="Total Revenue" value={fmt$(lanes.reduce((s, l) => s + l.revenue, 0))} accent="#16a34a" icon="💰" /></div><div style={S.tableWrap}><div style={{ overflowX: "auto" }}><table style={{ width: "100%", borderCollapse: "collapse" }}><thead><tr>{["Lane", "Loads", "Miles", "Revenue", "Profit", "$/Mile", "Avg/Load"].map(h => <TH key={h}>{h}</TH>)}</tr></thead><tbody>{lanes.length === 0 && <tr><td colSpan={7} style={{ padding: "32px", textAlign: "center", color: "#9ca3af" }}>No lane data yet.</td></tr>}{lanes.map((l, i) => { const rpm = l.miles ? l.revenue / l.miles : 0; return (<tr key={l.lane} onMouseEnter={e => e.currentTarget.style.background = "#f9fafb"} onMouseLeave={e => e.currentTarget.style.background = "#fff"}><TD bold color={i === 0 ? "#d97706" : "#111827"}>{i === 0 ? "🏆 " : ""}{l.lane}</TD><TD mono>{l.loads}</TD><TD mono>{fmtMi(l.miles)}</TD><TD mono color="#16a34a">{fmt$(l.revenue)}</TD><TD mono color={l.profit >= 0 ? "#16a34a" : "#dc2626"}>{fmt$(l.profit)}</TD><TD mono color={rpm >= 3 ? "#16a34a" : rpm >= 2 ? "#d97706" : "#dc2626"} bold>${fmtN(rpm)}</TD><TD mono>{fmt$(l.loads ? l.revenue / l.loads : 0)}</TD></tr>); })}</tbody></table></div></div></>);

  const Reports = () => { const netMi = avgRPM - cpm; return (<><div style={S.ph}><h1 style={S.h1}>Reports & KPIs</h1></div><TruckBar /><div style={S.grid(4)}><StatCard label="Cost/Mile" value={"$" + fmtN(cpm)} sub="All-in CPM" accent="#dc2626" icon="⚙️" /><StatCard label="Revenue/Mile" value={"$" + fmtN(avgRPM)} sub="Gross RPM" accent="#16a34a" icon="💹" /><StatCard label="Net/Mile" value={"$" + fmtN(netMi)} sub="After all costs" accent={netMi >= 0 ? "#16a34a" : "#dc2626"} icon="🎯" /><StatCard label="Fuel%Rev" value={fmtN(totalRev ? totalFuel / totalRev * 100 : 0) + "%"} sub="Target <25%" accent="#7c3aed" icon="⛽" /></div><div style={S.card}><div style={{ color: "#6b7280", fontSize: 11, fontWeight: 700, letterSpacing: 1, marginBottom: 16, textTransform: "uppercase" }}>KPI Benchmarks</div>{[{ l: "Revenue/Mile", v: avgRPM, target: 3.0, f: v => `$${fmtN(v)}`, note: "target $3.00+" }, { l: "Profit Margin", v: margin, target: 15, f: v => `${fmtN(v)}%`, note: "target 15%+" }, { l: "Cost/Mile", v: cpm, target: 2.5, f: v => `$${fmtN(v)}`, note: "target <$2.50", inv: true }, { l: "Fuel%Rev", v: totalRev ? totalFuel / totalRev * 100 : 0, target: 25, f: v => `${fmtN(v)}%`, note: "target <25%", inv: true }, { l: "Fleet MPG", v: mpg, target: 6.5, f: v => `${fmtN(v, 1)}`, note: "target 6.5+" }].map(k => { const good = k.inv ? k.v <= k.target : k.v >= k.target; const pct = Math.min(100, Math.abs((k.v / k.target) * 100)); return (<div key={k.l} style={{ marginBottom: 18 }}><div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}><span style={{ color: "#374151", fontSize: 13, fontWeight: 600 }}>{k.l}</span><span style={{ color: good ? "#16a34a" : "#dc2626", fontWeight: 700, fontFamily: "monospace" }}>{k.f(k.v)} <span style={{ color: "#9ca3af", fontSize: 10, fontWeight: 400 }}>({k.note})</span></span></div><div style={{ background: "#e5e7eb", borderRadius: 99, height: 7 }}><div style={{ width: `${pct}%`, height: "100%", background: good ? "#16a34a" : "#dc2626", borderRadius: 99 }} /></div></div>); })}</div></>); };

  const DriverLoadsModal = () => { const dl = getPaystubLoads(paystubDriver); const pay = dl.reduce((s, l) => { const g = Number(l.rate || 0) + Number(l.detention || 0); return s + g * (Number(l.driverPct || 0) / 100); }, 0); return (<ModalShell title={`📋 ${paystubDriver} — ${paystubPeriod}`} onClose={closeModal} wide><div style={{ marginBottom: 16, display: "flex", justifyContent: "space-between", alignItems: "center" }}><div style={{ color: "#374151", fontWeight: 600 }}>{dl.length} loads · {fmt$(pay)} pay</div><PrimaryBtn onClick={() => printPaystub(paystubDriver, dl, paystubPeriod)} style={{ padding: "8px 16px", fontSize: 12 }}>🖨️ Print Paystub</PrimaryBtn></div><div style={{ overflowX: "auto" }}><table style={{ width: "100%", borderCollapse: "collapse" }}><thead><tr>{["Load#", "Date", "Route", "Miles", "Rate", "Detention", "Driver Pay", "Status"].map(h => <TH key={h}>{h}</TH>)}</tr></thead><tbody>{dl.length === 0 && <tr><td colSpan={8} style={{ padding: "32px", textAlign: "center", color: "#9ca3af" }}>No loads this period.</td></tr>}{dl.map(l => { const g = Number(l.rate || 0) + Number(l.detention || 0); const dp = g * (Number(l.driverPct || 0) / 100); return (<tr key={l.id}><TD color="#d97706" bold>{l.loadNum}</TD><TD>{l.date}</TD><TD>{l.origin} → {l.dest}</TD><TD mono>{fmtMi(l.miles)}</TD><TD mono>{fmt$(l.rate)}</TD><TD mono color="#7c3aed">{fmt$(l.detention)}</TD><TD mono color="#d97706" bold>{fmt$(dp)}</TD><TD><StatusBadge s={l.status} /></TD></tr>); })}</tbody></table></div></ModalShell>); };

  const NAV = [
    { id: "dashboard", label: "Dashboard", icon: "📊" },
    { id: "loads", label: "Loads", icon: "🚛" },
    { id: "factoring", label: "Factoring", icon: "💼" },
    { id: "fuel", label: "Fuel", icon: "⛽" },
    { id: "expenses", label: "Expenses", icon: "💳" },
    { id: "fleet", label: "Fleet & Trailers", icon: "🚚" },
    { id: "maintenance", label: "Maintenance", icon: "🔧" },
    { id: "insurance", label: "Insurance", icon: "🛡️" },
    { id: "drivers", label: "Drivers", icon: "👤" },
    { id: "lanes", label: "Lanes", icon: "🗺️" },
    { id: "reports", label: "Reports", icon: "📈" },
  ];

  const allRev = loads.reduce((s, l) => s + Number(l.rate || 0) + Number(l.detention || 0), 0);
  const allCosts = loads.reduce((s, l) => { const g = Number(l.rate || 0) + Number(l.detention || 0); return s + g * (Number(l.driverPct || 0) / 100); }, 0) + fuelLog.reduce((s, f) => s + Number(f.total || 0), 0) + expenses.reduce((s, e) => s + Number(e.amount || 0), 0);
  const allProfit = allRev - allCosts;

  return (
    <div style={S.app}>
      <div style={S.sidebar}>
        <div style={{ padding: "20px 20px 16px", borderBottom: "1px solid rgba(255,255,255,0.1)" }}>
          <div style={{ fontSize: 18, fontWeight: 900, color: "#f59e0b" }}>⛟ BHANDARI</div>
          <div style={{ color: "#64748b", fontSize: 10, marginTop: 2, letterSpacing: 2 }}>LOGISTICS LLC</div>
        </div>
        <div style={{ margin: "12px 12px 8px", background: "rgba(255,255,255,0.07)", borderRadius: 10, padding: "12px 14px" }}>
          <div style={{ color: "#64748b", fontSize: 9, fontWeight: 700, letterSpacing: 1.5, marginBottom: 6 }}>FLEET SNAPSHOT</div>
          <div style={{ color: "#4ade80", fontWeight: 900, fontFamily: "monospace", fontSize: 16 }}>{fmt$(allRev)}</div>
          <div style={{ color: "#64748b", fontSize: 10, marginBottom: 6 }}>Gross Revenue</div>
          <div style={{ color: allProfit >= 0 ? "#4ade80" : "#f87171", fontWeight: 800, fontFamily: "monospace", fontSize: 14 }}>{fmt$(allProfit)}</div>
          <div style={{ color: "#64748b", fontSize: 10, marginBottom: 8 }}>Net Profit</div>
          {readyToFactor.length > 0 && <div onClick={() => setTab("factoring")} style={{ background: "#2563eb20", border: "1px solid #2563eb44", borderRadius: 6, padding: "5px 8px", marginBottom: 5, color: "#93c5fd", fontSize: 10, fontWeight: 700, cursor: "pointer" }}>💼 {readyToFactor.length} ready to factor</div>}
          {maintAlerts.length > 0 && <div style={{ background: "#dc262620", border: "1px solid #dc262644", borderRadius: 6, padding: "5px 8px", color: "#f87171", fontSize: 10, fontWeight: 700 }}>⚠️ {maintAlerts.length} maintenance alert{maintAlerts.length > 1 ? "s" : ""}</div>}
        </div>
        <div style={{ flex: 1 }}>
          {NAV.map(n => (<button key={n.id} style={S.navBtn(tab === n.id)} onClick={() => setTab(n.id)}><span style={{ fontSize: 15 }}>{n.icon}</span>{n.label}{n.id === "factoring" && readyToFactor.length > 0 && <span style={{ marginLeft: "auto", background: "#2563eb", color: "#fff", borderRadius: 99, fontSize: 9, fontWeight: 800, padding: "2px 6px" }}>{readyToFactor.length}</span>}</button>))}
        </div>
        <div style={{ padding: "12px 16px", borderTop: "1px solid rgba(255,255,255,0.1)" }}>
          <div style={{ color: "#475569", fontSize: 9, fontWeight: 700, letterSpacing: 1.5, marginBottom: 8 }}>ACTIVE TRUCKS</div>
          {trucks.filter(t => t.active).map(t => (<div key={t.id} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 5, cursor: "pointer" }} onClick={() => { setTruckView(t.id); setTab("dashboard"); }}><div style={{ width: 7, height: 7, borderRadius: "50%", background: t.color }} /><span style={{ color: "#94a3b8", fontSize: 11 }}>{t.name}</span><span style={{ color: "#4ade8044", fontFamily: "monospace", fontSize: 10, marginLeft: "auto" }}>{fmt$(truckSummaries.find(s => s.id === t.id)?.profit || 0)}</span></div>))}
          {trucks.length === 0 && <div style={{ color: "#475569", fontSize: 11 }}>No trucks yet</div>}
        </div>
        <div style={{ padding: "8px 12px", borderTop: "1px solid rgba(255,255,255,0.1)" }}>
          <div style={{ color: "#475569", fontSize: 9, letterSpacing: 1, marginBottom: 6 }}>☁️ {trucks.length} trucks · {trailers.length} trailers</div>
          <button onClick={handleSignOut} style={{ background: "rgba(255,255,255,0.06)", color: "#94a3b8", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 7, padding: "7px 12px", cursor: "pointer", fontSize: 11, fontWeight: 600, width: "100%" }}>🔓 Sign Out</button>
        </div>
      </div>

      <div style={S.main}>
        {tab === "dashboard" && <Dashboard />}
        {tab === "loads" && <Loads />}
        {tab === "factoring" && <Factoring />}
        {tab === "fuel" && <Fuel />}
        {tab === "expenses" && <Expenses />}
        {tab === "fleet" && <Fleet />}
        {tab === "maintenance" && <Maintenance />}
        {tab === "insurance" && <Insurance />}
        {tab === "drivers" && <Drivers />}
        {tab === "lanes" && <Lanes />}
        {tab === "reports" && <Reports />}
      </div>

      {modal === "truck" && <TruckForm onClose={closeModal} onSave={saveTruck} saving={saving} trucks={trucks} editId={editItem?.id} />}
      {modal === "trailer" && <TrailerForm onClose={closeModal} onSave={saveTrailer} saving={saving} trailers={trailers} editId={editItem?.id} />}
      {modal === "load" && <LoadForm onClose={closeModal} onSave={saveLoad} saving={saving} trucks={trucks} trailers={trailers} drivers={driverProfiles} editItem={editItem} />}
      {modal === "fuel" && <FuelForm onClose={closeModal} onSave={saveFuel} saving={saving} trucks={trucks} editItem={editItem} />}
      {modal === "expense" && <ExpenseForm onClose={closeModal} onSave={saveExp} saving={saving} trucks={trucks} editItem={editItem} />}
      {modal === "repairReceipt" && <RepairReceiptModal onClose={closeModal} onSave={saveExp} saving={saving} trucks={trucks} />}
      {modal === "maintenance" && <MaintenanceForm onClose={closeModal} onSave={saveMaintenance} saving={saving} trucks={trucks} trailers={trailers} editItem={editItem} />}
      {modal === "insurance" && <InsuranceForm onClose={closeModal} onSave={saveInsurance} saving={saving} trucks={trucks} trailers={trailers} editItem={editItem} />}
      {modal === "driver" && <DriverProfileForm onClose={closeModal} onSave={saveDriver} saving={saving} editItem={editItem} allDrivers={driverProfiles} />}
      {modal === "rateCon" && <RateConModal onClose={closeModal} onLoad={saveLoadDirect} trucks={trucks} trailers={trailers} drivers={driverProfiles} />}
      {modal === "mudflap" && <MudflapModal onClose={closeModal} onImport={importFuel} saving={saving} trucks={trucks} />}
      {modal === "csvImport" && <CsvImportForm onClose={closeModal} onImport={importFuel} saving={saving} trucks={trucks} />}
      {modal === "driverLoads" && <DriverLoadsModal />}
      {modal === "factoringDetail" && factoringLoad && <FactoringDetailModal load={factoringLoad} truck={truckById(factoringLoad.truckId)} trailer={trailerById(factoringLoad.trailerId)} onClose={closeModal} onUpdateStatus={(status) => { updateFactoringStatus(factoringLoad.id, status); closeModal(); }} />}

      {toast && (<div style={{ position: "fixed", bottom: 24, right: 24, background: toast.type === "error" ? "#fef2f2" : toast.type === "warn" ? "#fffbeb" : "#f0fdf4", border: `1.5px solid ${toast.type === "error" ? "#fecaca" : toast.type === "warn" ? "#fde68a" : "#bbf7d0"}`, borderRadius: 10, padding: "12px 20px", color: toast.type === "error" ? "#dc2626" : toast.type === "warn" ? "#d97706" : "#16a34a", fontWeight: 700, fontSize: 13, zIndex: 99999, boxShadow: "0 8px 24px rgba(0,0,0,0.12)" }}>{toast.msg}</div>)}
      <style>{`*{box-sizing:border-box}body{margin:0}::-webkit-scrollbar{width:5px;height:5px}::-webkit-scrollbar-track{background:#f3f4f6}::-webkit-scrollbar-thumb{background:#d1d5db;border-radius:99px}select option{background:#fff}`}</style>
    </div>
  );
}
