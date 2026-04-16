import { useState, useRef, useEffect, useCallback } from "react";
import { createClient } from "@supabase/supabase-js";

const SUPA_URL = "https://ajwniougsadsvfaaxryb.supabase.co";
const SUPA_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFqd25pb3Vnc2Fkc3ZmYWF4cnliIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzYxMjEzMDksImV4cCI6MjA5MTY5NzMwOX0.rSvnFp6msExdw1b_UBL5d04HioZzSadaaGSjIOmPLc0";
const db = createClient(SUPA_URL, SUPA_KEY);

const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
const today = () => new Date().toISOString().slice(0, 10);
const fmt$ = (n) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2 }).format(n || 0);
const fmtN = (n, d = 2) => Number(n || 0).toFixed(d);
const fmtMi = (n) => Number(n || 0).toLocaleString();

const TRUCK_COLORS = [
  { value: "#d97706", label: "🟡 Gold" },
  { value: "#2563eb", label: "🔵 Blue" },
  { value: "#16a34a", label: "🟢 Green" },
  { value: "#dc2626", label: "🔴 Red" },
  { value: "#7c3aed", label: "🟣 Purple" },
  { value: "#ea580c", label: "🟠 Orange" },
  { value: "#0891b2", label: "🩵 Cyan" },
  { value: "#db2777", label: "🩷 Pink" },
  { value: "#65a30d", label: "🟢 Lime" },
  { value: "#0d9488", label: "🩵 Teal" },
];

const EXP_CATS = ["Maintenance","Repairs","Insurance","Permits","Registration","Tires","Equipment","Tolls","Office","Factoring","Other"];
const MAKES = ["Kenworth","Peterbilt","Freightliner","Volvo","International","Mack","Western Star","Other"];
const STATUSES = ["Pending","In Transit","Delivered","Cancelled"];

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
    const url = `https://router.project-osrm.org/route/v1/driving/${origin.lon},${origin.lat};${dest.lon},${dest.lat}?overview=false`;
    const res = await fetch(url);
    const data = await res.json();
    if (data.routes && data.routes[0]) return Math.round(data.routes[0].distance / 1609.34);
    return null;
  } catch { return null; }
};

const parseRateCon = async (base64Data, mediaType) => {
  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 1000,
        messages: [{ role: "user", content: [{ type: mediaType.includes("pdf") ? "document" : "image", source: { type: "base64", media_type: mediaType, data: base64Data } }, { type: "text", text: `Extract load information from this rate confirmation. Return ONLY JSON:\n{\n"loadNum":"load/ref number","origin":"city, ST","dest":"city, ST","miles":number or null,"rate":total rate number,"detention":number or null,"driver":null,"driverPct":28,"broker":"broker name","pickupDate":"YYYY-MM-DD or null","commodity":"what is being hauled","notes":"special instructions"\n}\nReturn ONLY the JSON.` }] }]
      })
    });
    const data = await response.json();
    const text = data.content?.[0]?.text || "{}";
    return JSON.parse(text.replace(/```json|```/g, "").trim());
  } catch { return null; }
};

const parseTCSCsv = (text) => {
  const lines = text.trim().split("\n").filter(l => l.trim());
  if (lines.length < 2) return [];
  const header = lines[0].toLowerCase().split(",").map(h => h.trim().replace(/"/g, ""));
  return lines.slice(1).map(line => {
    const cols = line.split(",").map(c => c.trim().replace(/"/g, ""));
    const obj = {};
    header.forEach((h, i) => { obj[h] = cols[i] || ""; });
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
  const totalPay = driverLoads.reduce((s, l) => { const g = Number(l.rate || 0) + Number(l.detention || 0); return s + g * (Number(l.driverPct || 0) / 100); }, 0);
  const totalMiles = driverLoads.reduce((s, l) => s + Number(l.miles || 0), 0);
  const totalDetention = driverLoads.reduce((s, l) => s + Number(l.detention || 0), 0);
  const w = window.open("", "_blank");
  w.document.write(`<html><head><title>Paystub - ${driver}</title><style>body{font-family:'Courier New',monospace;max-width:700px;margin:40px auto;color:#111}.header{text-align:center;border-bottom:3px solid #000;padding-bottom:20px;margin-bottom:20px}.row{display:flex;justify-content:space-between;padding:5px 0;font-size:14px}.row.total{font-weight:900;font-size:17px;border-top:2px solid #000;margin-top:10px;padding-top:10px}.load-row{display:grid;grid-template-columns:1fr 2fr 1fr 1fr 1fr;gap:8px;padding:6px 0;border-bottom:1px solid #eee;font-size:12px}.section-title{font-weight:900;font-size:12px;text-transform:uppercase;border-bottom:1px solid #000;padding-bottom:4px;margin-bottom:10px;margin-top:20px}</style></head><body><div class="header"><div style="font-size:24px;font-weight:900">⛟ BHANDARI LOGISTICS LLC</div><div style="margin-top:6px">DRIVER PAY STATEMENT</div></div><div class="row"><span>Driver:</span><span><b>${driver}</b></span></div><div class="row"><span>Period:</span><span>${period}</span></div><div class="row"><span>Loads:</span><span>${driverLoads.length}</span></div><div class="row"><span>Miles:</span><span>${fmtMi(totalMiles)}</span></div><div class="section-title">Load Detail</div>${driverLoads.map(l=>{const g=Number(l.rate||0)+Number(l.detention||0);const pay=g*(Number(l.driverPct||0)/100);return`<div class="load-row"><span>${l.loadNum}</span><span>${(l.origin||'').split(',')[0]}→${(l.dest||'').split(',')[0]}</span><span>${fmtMi(l.miles)}mi</span><span>${fmt$(g)}</span><span>${fmt$(pay)}</span></div>`;}).join('')}<div class="section-title">Summary</div><div class="row"><span>Gross Revenue:</span><span>${fmt$(totalGross)}</span></div><div class="row"><span>Detention:</span><span>${fmt$(totalDetention)}</span></div><div class="row total"><span>TOTAL PAY:</span><span>${fmt$(totalPay)}</span></div><script>window.onload=()=>window.print();</script></body></html>`);
  w.document.close();
};

const Badge = ({ label, color = "#6b7280" }) => (<span style={{ background: color + "18", color, border: `1.5px solid ${color}44`, borderRadius: 20, padding: "2px 10px", fontSize: 11, fontWeight: 700, whiteSpace: "nowrap" }}>{label}</span>);
const StatusBadge = ({ s }) => { const map = { Delivered: "#16a34a", "In Transit": "#d97706", Pending: "#6b7280", Cancelled: "#dc2626" }; return <Badge label={s} color={map[s] || "#6b7280"} />; };
const StatCard = ({ label, value, sub, accent = "#2563eb", icon }) => (<div style={{ background: "#fff", border: `1.5px solid ${accent}30`, borderRadius: 13, padding: "18px 20px", position: "relative", overflow: "hidden", boxShadow: "0 1px 4px rgba(0,0,0,0.07)" }}><div style={{ position: "absolute", right: 14, top: 14, fontSize: 24, opacity: 0.12 }}>{icon}</div><div style={{ color: "#6b7280", fontSize: 10, fontWeight: 700, letterSpacing: 1.2, textTransform: "uppercase", marginBottom: 5 }}>{label}</div><div style={{ color: accent, fontSize: 22, fontWeight: 900, fontFamily: "'Courier New',monospace", lineHeight: 1 }}>{value}</div>{sub && <div style={{ color: "#9ca3af", fontSize: 11, marginTop: 5 }}>{sub}</div>}</div>);
const TH = ({ children }) => (<th style={{ background: "#f9fafb", color: "#6b7280", fontWeight: 700, fontSize: 10, letterSpacing: 1, textTransform: "uppercase", padding: "12px 14px", textAlign: "left", borderBottom: "1.5px solid #e5e7eb", whiteSpace: "nowrap" }}>{children}</th>);
const TD = ({ children, mono, color, bold }) => (<td style={{ padding: "12px 14px", borderBottom: "1px solid #f3f4f6", color: color || "#374151", fontFamily: mono ? "'Courier New',monospace" : undefined, fontWeight: bold ? 700 : 400, fontSize: 13, verticalAlign: "middle" }}>{children}</td>);
const PrimaryBtn = ({ onClick, children, style }) => (<button onClick={onClick} style={{ background: "linear-gradient(135deg,#d97706,#b45309)", color: "#fff", border: "none", borderRadius: 9, padding: "10px 20px", fontWeight: 800, cursor: "pointer", fontSize: 13, ...style }}>{children}</button>);
const SecondaryBtn = ({ onClick, children }) => (<button onClick={onClick} style={{ background: "#fff", color: "#2563eb", border: "1.5px solid #2563eb", borderRadius: 9, padding: "10px 16px", fontWeight: 700, cursor: "pointer", fontSize: 13 }}>{children}</button>);
const SaveBtn = ({ onClick, label, loading }) => (<button onClick={onClick} disabled={loading} style={{ background: loading ? "#d1d5db" : "linear-gradient(135deg,#d97706,#b45309)", color: loading ? "#6b7280" : "#fff", border: "none", borderRadius: 10, padding: "13px 0", fontWeight: 900, cursor: loading ? "not-allowed" : "pointer", fontSize: 15, width: "100%", marginTop: 10 }}>{loading ? "Saving..." : label}</button>);

const inputStyle = { background: "#fff", border: "1.5px solid #d1d5db", borderRadius: 8, color: "#111827", padding: "10px 12px", fontSize: 13, width: "100%", boxSizing: "border-box", outline: "none" };
const labelStyle = { color: "#6b7280", fontSize: 10, fontWeight: 700, letterSpacing: 1, textTransform: "uppercase" };
const fgrid = { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 14 };

const Field = ({ label, type = "text", value, onChange, options, span, placeholder }) => (
  <div style={{ display: "flex", flexDirection: "column", gap: 5, gridColumn: span ? "1 / -1" : undefined }}>
    <label style={labelStyle}>{label}</label>
    {options ? (<select value={value} onChange={e => onChange(e.target.value)} style={inputStyle}>{options.map(o => <option key={o.value ?? o} value={o.value ?? o}>{o.label ?? o}</option>)}</select>) : (<input type={type} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} style={inputStyle} />)}
  </div>
);

const ModalShell = ({ title, onClose, children, wide }) => (
  <div style={{ position: "fixed", inset: 0, background: "#00000066", zIndex: 9999, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }} onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
    <div style={{ background: "#fff", border: "1.5px solid #e5e7eb", borderRadius: 16, width: wide ? "min(900px,97vw)" : "min(700px,96vw)", maxHeight: "94vh", overflowY: "auto", padding: 28, boxShadow: "0 20px 60px rgba(0,0,0,0.15)" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 22 }}>
        <h2 style={{ margin: 0, color: "#111827", fontSize: 18, fontWeight: 900 }}>{title}</h2>
        <button onClick={onClose} style={{ background: "#f3f4f6", border: "none", color: "#6b7280", cursor: "pointer", fontSize: 18, borderRadius: 8, width: 32, height: 32, display: "flex", alignItems: "center", justifyContent: "center" }}>×</button>
      </div>
      {children}
    </div>
  </div>
);

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
    timer.current = setTimeout(async () => {
      const r = await searchCities(v);
      setResults(r); setOpen(r.length > 0); setSearching(false);
    }, 400);
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
          {results.map((r, i) => (
            <div key={i} onMouseDown={() => select(r)} style={{ padding: "10px 14px", cursor: "pointer", fontSize: 13, color: "#111827", borderBottom: i < results.length - 1 ? "1px solid #f3f4f6" : "none" }} onMouseEnter={e => e.currentTarget.style.background = "#f9fafb"} onMouseLeave={e => e.currentTarget.style.background = "#fff"}>📍 {r.label}</div>
          ))}
        </div>
      )}
    </div>
  );
};

const RateConModal = ({ onClose, onLoad, trucks }) => {
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
      const result = await parseRateCon(base64, mediaType);
      if (result) {
        setParsed(result);
        setF({ date: result.pickupDate || today(), loadNum: result.loadNum || "", origin: result.origin || "", dest: result.dest || "", miles: result.miles ? String(result.miles) : "", rate: result.rate ? String(result.rate) : "", detention: result.detention ? String(result.detention) : "0", driver: "", driverPct: "28", truckId: trucks[0]?.id || "", status: "Pending" });
      } else setError("Could not read document. Try a clearer image or PDF.");
    } catch { setError("Error reading file. Please try again."); }
    setParsing(false);
  };
  return (
    <ModalShell title="🤖 Upload Rate Confirmation" onClose={onClose} wide>
      {!f ? (
        <>
          <div style={{ background: "#eff6ff", border: "1.5px solid #bfdbfe", borderRadius: 10, padding: "14px 18px", marginBottom: 18 }}>
            <div style={{ color: "#1e40af", fontWeight: 700, marginBottom: 6 }}>How it works:</div>
            <div style={{ color: "#1e3a8a", fontSize: 13, lineHeight: 1.7 }}>Upload your rate confirmation (PDF or photo) and AI automatically reads and fills in load number, origin, destination, miles, rate, and more.</div>
          </div>
          {parsing ? (
            <div style={{ textAlign: "center", padding: "40px 0" }}>
              <div style={{ fontSize: 48, marginBottom: 16 }}>🤖</div>
              <div style={{ color: "#d97706", fontWeight: 800, fontSize: 18, marginBottom: 8 }}>Reading your rate confirmation...</div>
              <div style={{ color: "#6b7280" }}>AI is extracting load details</div>
            </div>
          ) : (
            <>
              <div style={{ border: "2px dashed #d1d5db", borderRadius: 12, padding: 40, textAlign: "center", cursor: "pointer", background: "#f9fafb" }} onClick={() => fileRef.current?.click()} onMouseEnter={e => e.currentTarget.style.borderColor = "#d97706"} onMouseLeave={e => e.currentTarget.style.borderColor = "#d1d5db"}>
                <div style={{ fontSize: 48, marginBottom: 12 }}>📄</div>
                <div style={{ color: "#374151", fontSize: 16, fontWeight: 700, marginBottom: 6 }}>Click to upload Rate Confirmation</div>
                <div style={{ color: "#9ca3af", fontSize: 13 }}>PDF, JPG, PNG, or photo of paper rate con</div>
                <input ref={fileRef} type="file" accept=".pdf,.jpg,.jpeg,.png,.webp,image/*" style={{ display: "none" }} onChange={handleFile} />
              </div>
              {error && <div style={{ background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 8, padding: "12px 16px", marginTop: 16, color: "#dc2626", fontSize: 13 }}>⚠️ {error}</div>}
            </>
          )}
        </>
      ) : (
        <>
          <div style={{ background: "#f0fdf4", border: "1.5px solid #bbf7d0", borderRadius: 10, padding: "12px 16px", marginBottom: 16 }}>
            <div style={{ color: "#166534", fontWeight: 700 }}>✅ Rate con read! Review and correct below:</div>
            {parsed?.broker && <div style={{ color: "#15803d", fontSize: 13, marginTop: 4 }}>🏢 {parsed.broker} {parsed?.commodity && `· 📦 ${parsed.commodity}`}</div>}
          </div>
          <div style={fgrid}>
            <Field label="Load Number" value={f.loadNum} onChange={v => setF(p => ({ ...p, loadNum: v }))} placeholder="L-1001" />
            <Field label="Date" type="date" value={f.date} onChange={v => setF(p => ({ ...p, date: v }))} />
            <Field label="Truck" value={f.truckId} onChange={v => setF(p => ({ ...p, truckId: v }))} options={trucks.map(t => ({ value: t.id, label: t.name }))} />
            <Field label="Driver Name" value={f.driver} onChange={v => setF(p => ({ ...p, driver: v }))} placeholder="Full name" />
            <Field label="Origin City" value={f.origin} onChange={v => setF(p => ({ ...p, origin: v }))} />
            <Field label="Destination" value={f.dest} onChange={v => setF(p => ({ ...p, dest: v }))} />
            <Field label="Miles" type="number" value={f.miles} onChange={v => setF(p => ({ ...p, miles: v }))} />
            <Field label="Load Rate ($)" type="number" value={f.rate} onChange={v => setF(p => ({ ...p, rate: v }))} />
            <Field label="Detention ($)" type="number" value={f.detention} onChange={v => setF(p => ({ ...p, detention: v }))} />
            <Field label="Driver Pay %" type="number" value={f.driverPct} onChange={v => setF(p => ({ ...p, driverPct: v }))} />
            <Field label="Status" value={f.status} onChange={v => setF(p => ({ ...p, status: v }))} options={STATUSES} />
          </div>
          {f.rate && (() => { const g = Number(f.rate||0)+Number(f.detention||0); const dp = g*(Number(f.driverPct||0)/100); return (<div style={{ background:"#f0fdf4",border:"1.5px solid #bbf7d0",borderRadius:10,padding:"14px 16px",marginBottom:14 }}><div style={{ color:"#6b7280",fontSize:10,fontWeight:700,marginBottom:10 }}>LIVE PREVIEW</div><div style={{ display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:10,textAlign:"center" }}>{[{l:"Gross",v:fmt$(g),c:"#16a34a"},{l:"Driver Pay",v:fmt$(dp),c:"#d97706"},{l:"Your Cut",v:fmt$(g-dp),c:"#2563eb"},{l:"$/Mile",v:`$${fmtN(f.miles?g/f.miles:0)}`,c:"#7c3aed"}].map(s=>(<div key={s.l}><div style={{color:"#6b7280",fontSize:10,marginBottom:3}}>{s.l}</div><div style={{color:s.c,fontFamily:"monospace",fontWeight:800}}>{s.v}</div></div>))}</div></div>); })()}
          <div style={{ display: "flex", gap: 12 }}>
            <button onClick={() => { setF(null); setParsed(null); }} style={{ flex: 1, background: "#f3f4f6", border: "1.5px solid #e5e7eb", borderRadius: 10, padding: "12px", fontWeight: 700, cursor: "pointer", fontSize: 14, color: "#374151", marginTop: 10 }}>📄 Try Different File</button>
            <SaveBtn onClick={() => { onLoad(f); onClose(); }} label="✅ Save This Load" loading={false} />
          </div>
        </>
      )}
    </ModalShell>
  );
};

const LoadForm = ({ onClose, onSave, saving, trucks, editItem }) => {
  const [f, setF] = useState(editItem || { date: today(), loadNum: "", origin: "", dest: "", miles: "", rate: "", detention: "0", driver: "", driverPct: "28", truckId: trucks[0]?.id || "", status: "Pending" });
  const [originCoords, setOriginCoords] = useState(null);
  const [destCoords, setDestCoords] = useState(null);
  const [calcingMiles, setCalcingMiles] = useState(false);
  const handleOriginSelect = async (city) => { setOriginCoords(city); if (destCoords) { setCalcingMiles(true); const m = await calcMiles(city, destCoords); if (m) setF(p => ({ ...p, miles: String(m) })); setCalcingMiles(false); } };
  const handleDestSelect = async (city) => { setDestCoords(city); if (originCoords) { setCalcingMiles(true); const m = await calcMiles(originCoords, city); if (m) setF(p => ({ ...p, miles: String(m) })); setCalcingMiles(false); } };
  const g = Number(f.rate || 0) + Number(f.detention || 0);
  const dp = g * (Number(f.driverPct || 0) / 100);
  return (
    <ModalShell title={editItem ? "✏️ Edit Load" : "🚛 Add Load"} onClose={onClose}>
      <div style={fgrid}>
        <Field label="Load Number" value={f.loadNum||""} onChange={v=>setF(p=>({...p,loadNum:v}))} placeholder="L-1001"/>
        <Field label="Date" type="date" value={f.date||today()} onChange={v=>setF(p=>({...p,date:v}))}/>
        <Field label="Assign Truck" value={f.truckId||""} onChange={v=>setF(p=>({...p,truckId:v}))} options={trucks.map(t=>({value:t.id,label:t.name}))}/>
        <Field label="Driver Name" value={f.driver||""} onChange={v=>setF(p=>({...p,driver:v}))} placeholder="Full name"/>
      </div>
      <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:14 }}>
        <CityInput label="Origin City" value={f.origin} onChange={v=>setF(p=>({...p,origin:v}))} onCitySelect={handleOriginSelect}/>
        <CityInput label="Destination City" value={f.dest} onChange={v=>setF(p=>({...p,dest:v}))} onCitySelect={handleDestSelect}/>
      </div>
      <div style={{ marginBottom:14 }}>
        <label style={labelStyle}>Miles {calcingMiles?"⏳ Calculating route...":originCoords&&destCoords&&f.miles?"✅ Auto-calculated":""}</label>
        <input type="number" value={f.miles||""} onChange={e=>setF(p=>({...p,miles:e.target.value}))} placeholder={calcingMiles?"Calculating...":"Pick cities above for auto-miles"} style={{...inputStyle,marginTop:5,borderColor:calcingMiles?"#d97706":originCoords&&destCoords&&f.miles?"#16a34a":"#d1d5db"}}/>
      </div>
      <div style={fgrid}>
        <Field label="Load Rate ($)" type="number" value={f.rate||""} onChange={v=>setF(p=>({...p,rate:v}))}/>
        <Field label="Detention ($)" type="number" value={f.detention||"0"} onChange={v=>setF(p=>({...p,detention:v}))}/>
        <Field label="Driver Pay %" type="number" value={f.driverPct||"28"} onChange={v=>setF(p=>({...p,driverPct:v}))}/>
        <Field label="Status" value={f.status||"Pending"} onChange={v=>setF(p=>({...p,status:v}))} options={STATUSES}/>
      </div>
      {f.rate&&(<div style={{background:"#f0fdf4",border:"1.5px solid #bbf7d0",borderRadius:10,padding:"14px 16px",marginBottom:14}}><div style={{color:"#6b7280",fontSize:10,fontWeight:700,marginBottom:10}}>LIVE PREVIEW</div><div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:10,textAlign:"center"}}>{[{l:"Gross",v:fmt$(g),c:"#16a34a"},{l:"Driver Pay",v:fmt$(dp),c:"#d97706"},{l:"Your Cut",v:fmt$(g-dp),c:"#2563eb"},{l:"$/Mile",v:`$${fmtN(f.miles?g/f.miles:0)}`,c:"#7c3aed"}].map(s=>(<div key={s.l}><div style={{color:"#6b7280",fontSize:10,marginBottom:3}}>{s.l}</div><div style={{color:s.c,fontFamily:"monospace",fontWeight:800}}>{s.v}</div></div>))}</div></div>)}
      <SaveBtn onClick={()=>onSave(f)} label={editItem?"💾 Update Load":"✅ Save Load"} loading={saving}/>
    </ModalShell>
  );
};

const TruckForm = ({ onClose, onSave, saving, trucks, editId }) => {
  const existing = trucks.find(t => t.id === editId);
  const [f, setF] = useState(existing || { name:"",plate:"",year:"",make:"Kenworth",model:"",color:TRUCK_COLORS[0].value,active:true });
  return (
    <ModalShell title={editId?"✏️ Edit Truck":"🚚 Add Truck"} onClose={onClose}>
      <div style={fgrid}>
        <Field label="Truck Name" value={f.name||""} onChange={v=>setF(p=>({...p,name:v}))} placeholder="e.g. Truck 1"/>
        <Field label="License Plate" value={f.plate||""} onChange={v=>setF(p=>({...p,plate:v}))} placeholder="NE-0000"/>
        <Field label="Year" value={f.year||""} onChange={v=>setF(p=>({...p,year:v}))} placeholder="2021"/>
        <Field label="Make" value={f.make||"Kenworth"} onChange={v=>setF(p=>({...p,make:v}))} options={MAKES}/>
        <Field label="Model" value={f.model||""} onChange={v=>setF(p=>({...p,model:v}))} placeholder="T680, 389..."/>
        <Field label="Color" value={f.color||TRUCK_COLORS[0].value} onChange={v=>setF(p=>({...p,color:v}))} options={TRUCK_COLORS}/>
        <Field label="Status" value={f.active?"active":"inactive"} onChange={v=>setF(p=>({...p,active:v==="active"}))} options={[{value:"active",label:"Active"},{value:"inactive",label:"Inactive"}]}/>
      </div>
      <SaveBtn onClick={()=>onSave(f)} label={editId?"💾 Update Truck":"✅ Add Truck"} loading={saving}/>
    </ModalShell>
  );
};

const FuelForm = ({ onClose, onSave, saving, trucks, editItem }) => {
  const [f, setF] = useState(editItem || { date:today(),truckId:trucks[0]?.id||"",gallons:"",pricePer:"",total:"",location:"",loadNum:"" });
  const tot = Number(f.total)||(Number(f.gallons)*Number(f.pricePer));
  return (
    <ModalShell title={editItem?"✏️ Edit Fuel":"⛽ Add Fuel Entry"} onClose={onClose}>
      <div style={fgrid}>
        <Field label="Date" type="date" value={f.date||today()} onChange={v=>setF(p=>({...p,date:v}))}/>
        <Field label="Truck" value={f.truckId||""} onChange={v=>setF(p=>({...p,truckId:v}))} options={trucks.map(t=>({value:t.id,label:t.name}))}/>
        <Field label="Gallons" type="number" value={f.gallons||""} onChange={v=>setF(p=>({...p,gallons:v}))}/>
        <Field label="Price Per Gallon ($)" type="number" value={f.pricePer||""} onChange={v=>setF(p=>({...p,pricePer:v}))}/>
        <Field label="Total Amount ($)" type="number" value={f.total||""} onChange={v=>setF(p=>({...p,total:v}))}/>
        <Field label="Location / Stop" value={f.location||""} onChange={v=>setF(p=>({...p,location:v}))} placeholder="Love's - I-10 Houston TX"/>
        <Field label="Load # (optional)" value={f.loadNum||""} onChange={v=>setF(p=>({...p,loadNum:v}))}/>
      </div>
      {tot>0&&<div style={{background:"#fef2f2",border:"1.5px solid #fecaca",borderRadius:10,padding:"12px",marginBottom:14,textAlign:"center",color:"#dc2626",fontFamily:"monospace",fontWeight:900,fontSize:22}}>Total: {fmt$(tot)}</div>}
      <SaveBtn onClick={()=>onSave(f)} label={editItem?"💾 Update":"✅ Save Fuel Entry"} loading={saving}/>
    </ModalShell>
  );
};

const ExpenseForm = ({ onClose, onSave, saving, trucks, editItem }) => {
  const [f, setF] = useState(editItem || { date:today(),truckId:"FLEET",category:"Maintenance",description:"",amount:"" });
  const truckOptsAll = [{ value:"FLEET",label:"Fleet-wide" },...trucks.map(t=>({value:t.id,label:t.name}))];
  return (
    <ModalShell title="💳 Add Expense" onClose={onClose}>
      <div style={fgrid}>
        <Field label="Date" type="date" value={f.date||today()} onChange={v=>setF(p=>({...p,date:v}))}/>
        <Field label="Truck / Fleet" value={f.truckId||"FLEET"} onChange={v=>setF(p=>({...p,truckId:v}))} options={truckOptsAll}/>
        <Field label="Category" value={f.category||"Maintenance"} onChange={v=>setF(p=>({...p,category:v}))} options={EXP_CATS}/>
        <Field label="Amount ($)" type="number" value={f.amount||""} onChange={v=>setF(p=>({...p,amount:v}))}/>
        <Field label="Description" value={f.description||""} onChange={v=>setF(p=>({...p,description:v}))} span placeholder="What was this for?"/>
      </div>
      <SaveBtn onClick={()=>onSave(f)} label="✅ Save Expense" loading={saving}/>
    </ModalShell>
  );
};

const CsvImportForm = ({ onClose, onImport, saving, trucks }) => {
  const [csvRows,setCsvRows]=useState([]);const [csvMapping,setCsvMapping]=useState({});const [csvDone,setCsvDone]=useState(false);const fileRef=useRef();
  const handleFile=(e)=>{const file=e.target.files[0];if(!file)return;const reader=new FileReader();reader.onload=(ev)=>{const rows=parseTCSCsv(ev.target.result);const mapping={};rows.forEach(r=>{mapping[r.truckRaw]=mapping[r.truckRaw]||trucks[0]?.id||"";});setCsvMapping(mapping);setCsvRows(rows);};reader.readAsText(file);};
  const doImport=async()=>{const toInsert=csvRows.map(r=>({id:r.id,date:r.date,truck_id:csvMapping[r.truckRaw]||trucks[0]?.id,gallons:r.gallons,price_per:r.price_per,total:r.total,location:r.location,load_num:r.load_num||""}));await onImport(toInsert);setCsvDone(true);};
  return (
    <ModalShell title="📥 Import TCS Fuel Card CSV" onClose={onClose} wide>
      {!csvDone?(<><div style={{background:"#fffbeb",border:"1px solid #fde68a",borderRadius:10,padding:"14px 18px",marginBottom:18}}><div style={{color:"#92400e",fontWeight:700,marginBottom:8}}>How to export from TCS:</div><ol style={{color:"#78350f",fontSize:13,lineHeight:2,paddingLeft:20,margin:0}}><li>Go to tcsfleet.com → Reports → Transaction Report</li><li>Select date range → Export CSV → upload below</li></ol></div><div style={{border:"2px dashed #d1d5db",borderRadius:12,padding:32,textAlign:"center",cursor:"pointer",background:"#f9fafb"}} onClick={()=>fileRef.current?.click()} onMouseEnter={e=>e.currentTarget.style.borderColor="#d97706"} onMouseLeave={e=>e.currentTarget.style.borderColor="#d1d5db"}><div style={{fontSize:40,marginBottom:10}}>📄</div><div style={{color:"#374151",fontSize:15,fontWeight:600}}>Click to upload TCS CSV</div><input ref={fileRef} type="file" accept=".csv" style={{display:"none"}} onChange={handleFile}/></div>{csvRows.length>0&&(<><div style={{color:"#16a34a",fontWeight:700,marginBottom:12,marginTop:16}}>✅ {csvRows.length} transactions found</div>{Object.keys(csvMapping).map(raw=>(<div key={raw} style={{display:"flex",alignItems:"center",gap:12,marginBottom:10}}><span style={{color:"#374151",fontSize:13,background:"#f3f4f6",padding:"6px 10px",borderRadius:7,minWidth:130,fontFamily:"monospace"}}>"{raw}"</span><span style={{color:"#9ca3af"}}>→</span><select value={csvMapping[raw]} onChange={e=>setCsvMapping(p=>({...p,[raw]:e.target.value}))} style={{...inputStyle,flex:1}}>{trucks.map(t=><option key={t.id} value={t.id}>{t.name}</option>)}</select></div>))}<SaveBtn onClick={doImport} label={`📥 Import ${csvRows.length} Transactions`} loading={saving}/></>)}</>):(<div style={{textAlign:"center",padding:"40px 0"}}><div style={{fontSize:64,marginBottom:16}}>✅</div><div style={{color:"#16a34a",fontWeight:900,fontSize:24}}>Imported!</div><PrimaryBtn onClick={onClose} style={{marginTop:20}}>Done</PrimaryBtn></div>)}
    </ModalShell>
  );
};

export default function App() {
  const [trucks,setTrucks]=useState([]);const [loads,setLoads]=useState([]);const [fuelLog,setFuelLog]=useState([]);const [expenses,setExpenses]=useState([]);
  const [loading,setLoading]=useState(true);const [saving,setSaving]=useState(false);const [tab,setTab]=useState("dashboard");const [truckView,setTruckView]=useState("FLEET");
  const [modal,setModal]=useState(null);const [editItem,setEditItem]=useState(null);const [toast,setToast]=useState(null);const [paystubDriver,setPaystubDriver]=useState("");const [paystubPeriod,setPaystubPeriod]=useState("weekly");

  const showToast=(msg,type="success")=>{setToast({msg,type});setTimeout(()=>setToast(null),3500);};

  const fetchAll=async()=>{
    setLoading(true);
    try{
      const [t,l,f,e]=await Promise.all([db.from("trucks").select("*").order("created_at"),db.from("loads").select("*").order("date",{ascending:false}),db.from("fuel").select("*").order("date",{ascending:false}),db.from("expenses").select("*").order("date",{ascending:false})]);
      if(t.data)setTrucks(t.data.map(r=>({id:r.id,name:r.name,plate:r.plate,year:r.year,make:r.make,model:r.model,color:r.color,active:r.active})));
      if(l.data)setLoads(l.data.map(r=>({id:r.id,date:r.date,loadNum:r.load_num,origin:r.origin,dest:r.dest,miles:r.miles,rate:r.rate,detention:r.detention,driver:r.driver,driverPct:r.driver_pct,truckId:r.truck_id,status:r.status})));
      if(f.data)setFuelLog(f.data.map(r=>({id:r.id,date:r.date,truckId:r.truck_id,gallons:r.gallons,pricePer:r.price_per,total:r.total,location:r.location,loadNum:r.load_num})));
      if(e.data)setExpenses(e.data.map(r=>({id:r.id,date:r.date,truckId:r.truck_id,category:r.category,description:r.description,amount:r.amount})));
    }catch{showToast("Error loading data","error");}
    setLoading(false);
  };

  useEffect(()=>{fetchAll();},[]);
  const closeModal=()=>{setModal(null);setEditItem(null);};

  const saveTruck=async(f)=>{if(!f.name)return;setSaving(true);const row={id:editItem?.id||("T"+uid()),name:f.name,plate:f.plate||"",year:f.year||"",make:f.make||"Kenworth",model:f.model||"",color:f.color||TRUCK_COLORS[0].value,active:f.active!==false};const{error}=await db.from("trucks").upsert(row);if(error)showToast("Save failed","error");else{await fetchAll();closeModal();showToast(editItem?"Truck updated ✓":"Truck added ✓");}setSaving(false);};
  const saveLoad=async(f)=>{if(!f.loadNum||!f.rate)return;setSaving(true);const row={id:editItem?.id||uid(),date:f.date,load_num:f.loadNum,origin:f.origin,dest:f.dest,miles:Number(f.miles),rate:Number(f.rate),detention:Number(f.detention||0),driver:f.driver,driver_pct:Number(f.driverPct||28),truck_id:f.truckId,status:f.status};const{error}=await db.from("loads").upsert(row);if(error)showToast("Save failed","error");else{await fetchAll();closeModal();showToast(editItem?"Load updated ✓":"Load added ✓");}setSaving(false);};
  const saveLoadDirect=async(f)=>{if(!f.loadNum||!f.rate){showToast("Missing load # or rate","error");return;}setSaving(true);const row={id:uid(),date:f.date,load_num:f.loadNum,origin:f.origin,dest:f.dest,miles:Number(f.miles||0),rate:Number(f.rate),detention:Number(f.detention||0),driver:f.driver||"",driver_pct:Number(f.driverPct||28),truck_id:f.truckId||trucks[0]?.id||"",status:f.status||"Pending"};const{error}=await db.from("loads").upsert(row);if(error)showToast("Save failed","error");else{await fetchAll();showToast("Load saved from rate con ✓");}setSaving(false);};
  const saveFuel=async(f)=>{const tot=Number(f.total)||(Number(f.gallons)*Number(f.pricePer));if(!f.truckId||!tot)return;setSaving(true);const row={id:editItem?.id||uid(),date:f.date,truck_id:f.truckId,gallons:Number(f.gallons),price_per:Number(f.pricePer),total:tot,location:f.location||"",load_num:f.loadNum||""};const{error}=await db.from("fuel").upsert(row);if(error)showToast("Save failed","error");else{await fetchAll();closeModal();showToast("Fuel saved ✓");}setSaving(false);};
  const saveExp=async(f)=>{if(!f.description||!f.amount)return;setSaving(true);const row={id:editItem?.id||uid(),date:f.date,truck_id:f.truckId,category:f.category,description:f.description,amount:Number(f.amount)};const{error}=await db.from("expenses").upsert(row);if(error)showToast("Save failed","error");else{await fetchAll();closeModal();showToast("Expense saved ✓");}setSaving(false);};
  const importFuel=async(rows)=>{setSaving(true);const{error}=await db.from("fuel").upsert(rows);if(error)showToast("Import failed","error");else{await fetchAll();showToast(`${rows.length} imported ✓`);}setSaving(false);};
  const delLoad=async(id)=>{if(!confirm("Delete?"))return;await db.from("loads").delete().eq("id",id);await fetchAll();showToast("Deleted","warn");};
  const delFuel=async(id)=>{if(!confirm("Delete?"))return;await db.from("fuel").delete().eq("id",id);await fetchAll();showToast("Deleted","warn");};
  const delExp=async(id)=>{if(!confirm("Delete?"))return;await db.from("expenses").delete().eq("id",id);await fetchAll();showToast("Deleted","warn");};

  const filtLoads=truckView==="FLEET"?loads:loads.filter(l=>l.truckId===truckView);
  const filtFuel=truckView==="FLEET"?fuelLog:fuelLog.filter(f=>f.truckId===truckView);
  const filtExp=truckView==="FLEET"?expenses:expenses.filter(e=>e.truckId===truckView||e.truckId==="FLEET");
  const totalRev=filtLoads.reduce((s,l)=>s+Number(l.rate||0)+Number(l.detention||0),0);
  const totalDPay=filtLoads.reduce((s,l)=>{const g=Number(l.rate||0)+Number(l.detention||0);return s+g*(Number(l.driverPct||0)/100);},0);
  const totalFuel=filtFuel.reduce((s,f)=>s+Number(f.total||0),0);
  const totalExp=filtExp.reduce((s,e)=>s+Number(e.amount||0),0);
  const totalMiles=filtLoads.reduce((s,l)=>s+Number(l.miles||0),0);
  const totalDetain=filtLoads.reduce((s,l)=>s+Number(l.detention||0),0);
  const totalGals=filtFuel.reduce((s,f)=>s+Number(f.gallons||0),0);
  const totalProfit=totalRev-totalDPay-totalFuel-totalExp;
  const margin=totalRev?(totalProfit/totalRev)*100:0;
  const avgRPM=totalMiles?totalRev/totalMiles:0;
  const cpm=totalMiles?(totalDPay+totalFuel+totalExp)/totalMiles:0;
  const mpg=(totalMiles&&totalGals)?totalMiles/totalGals:0;
  const truckById=id=>trucks.find(t=>t.id===id);

  const truckSummaries=trucks.map(t=>{const tl=loads.filter(l=>l.truckId===t.id);const tf2=fuelLog.filter(f=>f.truckId===t.id);const te=expenses.filter(e=>e.truckId===t.id);const rev=tl.reduce((s,l)=>s+Number(l.rate||0)+Number(l.detention||0),0);const dp=tl.reduce((s,l)=>{const g=Number(l.rate||0)+Number(l.detention||0);return s+g*(Number(l.driverPct||0)/100);},0);const fuel=tf2.reduce((s,f)=>s+Number(f.total||0),0);const exp=te.reduce((s,e)=>s+Number(e.amount||0),0);const mi=tl.reduce((s,l)=>s+Number(l.miles||0),0);const gals=tf2.reduce((s,f)=>s+Number(f.gallons||0),0);const profit=rev-dp-fuel-exp;return{...t,rev,dp,fuel,exp,mi,gals,profit,numLoads:tl.length,margin:rev?(profit/rev)*100:0,rpm:mi?rev/mi:0,mpg:(mi&&gals)?mi/gals:0};});

  const laneMap={};loads.forEach(l=>{const key=`${l.origin?.split(",")[0]?.trim()} → ${l.dest?.split(",")[0]?.trim()}`;if(!laneMap[key])laneMap[key]={lane:key,loads:0,miles:0,revenue:0,profit:0};const g=Number(l.rate||0)+Number(l.detention||0);laneMap[key].loads++;laneMap[key].miles+=Number(l.miles||0);laneMap[key].revenue+=g;laneMap[key].profit+=g-g*(Number(l.driverPct||0)/100);});
  const lanes=Object.values(laneMap).sort((a,b)=>b.revenue-a.revenue);
  const driverNames=[...new Set(loads.map(l=>l.driver).filter(Boolean))];
  const driverStats=driverNames.map(name=>{const dl=loads.filter(l=>l.driver===name);const rev=dl.reduce((s,l)=>s+Number(l.rate||0)+Number(l.detention||0),0);const pay=dl.reduce((s,l)=>{const g=Number(l.rate||0)+Number(l.detention||0);return s+g*(Number(l.driverPct||0)/100);},0);const mi=dl.reduce((s,l)=>s+Number(l.miles||0),0);const det=dl.reduce((s,l)=>s+Number(l.detention||0),0);return{name,loads:dl.length,rev,pay,mi,det,pct:dl[0]?.driverPct||28};});
  const getPaystubLoads=(driver)=>{const now=new Date();return loads.filter(l=>{if(l.driver!==driver)return false;const d=new Date(l.date);if(paystubPeriod==="weekly")return(now-d)/86400000<=7;if(paystubPeriod==="biweekly")return(now-d)/86400000<=14;if(paystubPeriod==="monthly")return d.getMonth()===now.getMonth()&&d.getFullYear()===now.getFullYear();return true;});};

  const S={app:{display:"flex",minHeight:"100vh",background:"#f3f4f6",fontFamily:"'DM Sans','Segoe UI',sans-serif",color:"#111827"},sidebar:{width:240,background:"#1e293b",display:"flex",flexDirection:"column",flexShrink:0,position:"sticky",top:0,height:"100vh",overflowY:"auto"},main:{flex:1,padding:"28px 30px",overflowY:"auto",minWidth:0},ph:{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:22,flexWrap:"wrap",gap:12},h1:{margin:0,fontSize:22,fontWeight:900,color:"#111827"},grid:(n)=>({display:"grid",gridTemplateColumns:`repeat(${n},1fr)`,gap:14,marginBottom:20}),card:{background:"#fff",border:"1.5px solid #e5e7eb",borderRadius:13,padding:"20px 22px",marginBottom:18,boxShadow:"0 1px 4px rgba(0,0,0,0.05)"},tableWrap:{background:"#fff",border:"1.5px solid #e5e7eb",borderRadius:13,overflow:"hidden",marginBottom:18,boxShadow:"0 1px 4px rgba(0,0,0,0.05)"},navBtn:(a)=>({display:"flex",alignItems:"center",gap:10,padding:"11px 20px",cursor:"pointer",border:"none",background:a?"rgba(255,255,255,0.12)":"none",borderLeft:a?"3px solid #f59e0b":"3px solid transparent",color:a?"#f59e0b":"#94a3b8",fontWeight:a?700:500,fontSize:13,width:"100%",textAlign:"left"}),btnDel:{background:"#fef2f2",color:"#dc2626",border:"1px solid #fecaca",borderRadius:7,padding:"4px 10px",cursor:"pointer",fontSize:11,fontWeight:700},btnEdt:{background:"#eff6ff",color:"#2563eb",border:"1px solid #bfdbfe",borderRadius:7,padding:"4px 10px",cursor:"pointer",fontSize:11,fontWeight:700},btnPrint:{background:"#f0fdf4",color:"#16a34a",border:"1px solid #bbf7d0",borderRadius:7,padding:"4px 10px",cursor:"pointer",fontSize:11,fontWeight:700}};

  const TruckBar=()=>(<div style={{display:"flex",gap:8,flexWrap:"wrap",marginBottom:20}}>{[{id:"FLEET",name:"All Fleet",color:"#d97706"},...trucks].map(t=>(<button key={t.id} onClick={()=>setTruckView(t.id)} style={{background:truckView===t.id?t.color:"#fff",border:`1.5px solid ${truckView===t.id?t.color:"#d1d5db"}`,borderRadius:9,padding:"7px 16px",color:truckView===t.id?"#fff":"#374151",fontWeight:700,cursor:"pointer",fontSize:12}}>{t.id==="FLEET"?"🚛 ":""}{t.name}</button>))}</div>);

  if(loading)return(<div style={{display:"flex",alignItems:"center",justifyContent:"center",minHeight:"100vh",background:"#f3f4f6",flexDirection:"column",gap:16}}><div style={{fontSize:56}}>⛟</div><div style={{color:"#d97706",fontSize:24,fontWeight:900}}>BHANDARI</div><div style={{color:"#6b7280",fontSize:14}}>Loading your fleet...</div></div>);

  const Dashboard=()=>(<><div style={S.ph}><div><h1 style={S.h1}>Dashboard</h1><div style={{color:"#6b7280",fontSize:12,marginTop:3}}>Bhandari Logistics LLC</div></div><button onClick={fetchAll} style={{background:"#fff",border:"1.5px solid #d1d5db",borderRadius:9,color:"#6b7280",padding:"9px 16px",cursor:"pointer",fontSize:13,fontWeight:600}}>🔄 Refresh</button></div><TruckBar/><div style={S.grid(5)}><StatCard label="Gross Revenue" value={fmt$(totalRev)} sub={`${filtLoads.length} loads`} accent="#16a34a" icon="💰"/><StatCard label="Net Profit" value={fmt$(totalProfit)} sub={`${fmtN(margin)}% margin`} accent={totalProfit>=0?"#16a34a":"#dc2626"} icon="📈"/><StatCard label="Driver Pay" value={fmt$(totalDPay)} sub="Total payroll" accent="#d97706" icon="👤"/><StatCard label="Fuel Spend" value={fmt$(totalFuel)} sub={`${fmtN(mpg,1)} MPG`} accent="#dc2626" icon="⛽"/><StatCard label="Rate/Mile" value={`$${fmtN(avgRPM)}`} sub={`CPM $${fmtN(cpm)}`} accent="#2563eb" icon="🛣️"/></div>{trucks.length===0?(<div style={{...S.card,textAlign:"center",padding:"48px 24px"}}><div style={{fontSize:56,marginBottom:16}}>🚚</div><div style={{color:"#111827",fontWeight:800,fontSize:20,marginBottom:8}}>Welcome to Bhandari!</div><div style={{color:"#6b7280",fontSize:14,marginBottom:24}}>Start by adding your trucks.</div><PrimaryBtn onClick={()=>{setTab("fleet");setModal("truck");}}>+ Add Your First Truck</PrimaryBtn></div>):(<><div style={S.card}><div style={{color:"#6b7280",fontSize:11,fontWeight:700,letterSpacing:1,marginBottom:16,textTransform:"uppercase"}}>Truck Performance</div><div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(200px,1fr))",gap:12}}>{truckSummaries.map(t=>(<div key={t.id} onClick={()=>setTruckView(t.id)} style={{background:"#f9fafb",border:`2px solid ${t.color}`,borderRadius:11,padding:"14px 16px",cursor:"pointer"}}><div style={{display:"flex",alignItems:"center",gap:8,marginBottom:12}}><div style={{width:10,height:10,borderRadius:"50%",background:t.color}}/><span style={{color:"#111827",fontWeight:800,fontSize:14}}>{t.name}</span><span style={{color:"#9ca3af",fontSize:11,marginLeft:"auto"}}>{t.numLoads} loads</span></div>{[{l:"Revenue",v:fmt$(t.rev),c:"#16a34a"},{l:"Profit",v:fmt$(t.profit),c:t.profit>=0?"#16a34a":"#dc2626"},{l:"Fuel",v:fmt$(t.fuel),c:"#dc2626"},{l:"$/mi",v:`$${fmtN(t.rpm)}`,c:"#d97706"}].map(r=>(<div key={r.l} style={{display:"flex",justifyContent:"space-between",padding:"4px 0",borderBottom:"1px solid #e5e7eb"}}><span style={{color:"#6b7280",fontSize:11}}>{r.l}</span><span style={{color:r.c,fontSize:12,fontWeight:700,fontFamily:"monospace"}}>{r.v}</span></div>))}<div style={{marginTop:10,background:"#e5e7eb",borderRadius:99,height:5}}><div style={{width:`${Math.min(100,Math.max(0,t.margin))}%`,height:"100%",background:t.color,borderRadius:99}}/></div><div style={{color:"#6b7280",fontSize:10,marginTop:3}}>{fmtN(t.margin)}% margin</div></div>))}</div></div><div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:18}}><div style={S.card}><div style={{color:"#6b7280",fontSize:11,fontWeight:700,letterSpacing:1,marginBottom:14,textTransform:"uppercase"}}>P&L Summary</div>{[{l:"Gross Revenue",v:totalRev,c:"#16a34a"},{l:"− Driver Pay",v:-totalDPay,c:"#dc2626"},{l:"− Fuel",v:-totalFuel,c:"#dc2626"},{l:"− Expenses",v:-totalExp,c:"#dc2626"}].map(r=>(<div key={r.l} style={{display:"flex",justifyContent:"space-between",padding:"9px 0",borderBottom:"1px solid #f3f4f6"}}><span style={{color:"#374151",fontSize:13}}>{r.l}</span><span style={{color:r.c,fontFamily:"monospace",fontWeight:700}}>{fmt$(r.v)}</span></div>))}<div style={{display:"flex",justifyContent:"space-between",marginTop:14,paddingTop:14,borderTop:"2px solid #d97706"}}><span style={{color:"#111827",fontWeight:800,fontSize:15}}>NET PROFIT</span><span style={{color:totalProfit>=0?"#16a34a":"#dc2626",fontWeight:900,fontSize:20,fontFamily:"monospace"}}>{fmt$(totalProfit)}</span></div></div><div style={S.card}><div style={{color:"#6b7280",fontSize:11,fontWeight:700,letterSpacing:1,marginBottom:14,textTransform:"uppercase"}}>Recent Loads</div>{loads.length===0&&<div style={{color:"#9ca3af",fontSize:13}}>No loads yet.</div>}{loads.slice(0,6).map(l=>{const g=Number(l.rate||0)+Number(l.detention||0);const truck=truckById(l.truckId);return(<div key={l.id} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"9px 0",borderBottom:"1px solid #f3f4f6"}}><div><div style={{color:"#d97706",fontWeight:700,fontSize:13}}>{l.loadNum}</div><div style={{color:"#9ca3af",fontSize:11}}>{l.origin} → {l.dest}</div>{truck&&<Badge label={truck.name} color={truck.color}/>}</div><div style={{textAlign:"right"}}><div style={{color:"#16a34a",fontFamily:"monospace",fontWeight:700}}>{fmt$(g)}</div><StatusBadge s={l.status}/></div></div>);})}</div></div></>)}</>);

  const Loads=()=>(<><div style={S.ph}><div><h1 style={S.h1}>Load Management</h1></div><div style={{display:"flex",gap:10,flexWrap:"wrap"}}><button onClick={()=>setModal("rateCon")} style={{background:"#eff6ff",color:"#2563eb",border:"1.5px solid #2563eb",borderRadius:9,padding:"10px 16px",fontWeight:700,cursor:"pointer",fontSize:13}}>🤖 Upload Rate Con</button><PrimaryBtn onClick={()=>{setEditItem(null);setModal("load");}}>+ Add Load</PrimaryBtn></div></div><TruckBar/><div style={S.grid(5)}><StatCard label="In Transit" value={filtLoads.filter(l=>l.status==="In Transit").length} accent="#d97706" icon="🚛"/><StatCard label="Pending" value={filtLoads.filter(l=>l.status==="Pending").length} accent="#6b7280" icon="⏳"/><StatCard label="Delivered" value={filtLoads.filter(l=>l.status==="Delivered").length} accent="#16a34a" icon="✅"/><StatCard label="Detention" value={fmt$(totalDetain)} accent="#7c3aed" icon="⏱️"/><StatCard label="Total Rev" value={fmt$(totalRev)} accent="#16a34a" icon="💰"/></div><div style={S.tableWrap}><div style={{overflowX:"auto"}}><table style={{width:"100%",borderCollapse:"collapse"}}><thead><tr>{["Load#","Date","Truck","Origin → Dest","Miles","Rate","Detention","Driver","Pay%","Driver$","Profit","$/mi","Status",""].map(h=><TH key={h}>{h}</TH>)}</tr></thead><tbody>{filtLoads.length===0&&<tr><td colSpan={14} style={{padding:"32px",textAlign:"center",color:"#9ca3af"}}>No loads yet. Click "+ Add Load" or "🤖 Upload Rate Con"</td></tr>}{filtLoads.map(l=>{const g=Number(l.rate||0)+Number(l.detention||0);const dp=g*(Number(l.driverPct||0)/100);const pr=g-dp;const truck=truckById(l.truckId);return(<tr key={l.id} onMouseEnter={e=>e.currentTarget.style.background="#f9fafb"} onMouseLeave={e=>e.currentTarget.style.background="#fff"}><TD color="#d97706" bold>{l.loadNum}</TD><TD>{l.date}</TD><TD>{truck&&<Badge label={truck.name} color={truck.color}/>}</TD><TD>{l.origin} → {l.dest}</TD><TD mono>{fmtMi(l.miles)}</TD><TD mono>{fmt$(l.rate)}</TD><TD mono color={Number(l.detention)>0?"#7c3aed":"#9ca3af"}>{fmt$(l.detention)}</TD><TD>{l.driver}</TD><TD mono>{l.driverPct}%</TD><TD mono color="#dc2626">{fmt$(dp)}</TD><TD mono color={pr>=0?"#16a34a":"#dc2626"} bold>{fmt$(pr)}</TD><TD mono>${fmtN(Number(l.miles)?g/Number(l.miles):0)}</TD><TD><StatusBadge s={l.status}/></TD><TD><div style={{display:"flex",gap:5}}><button style={S.btnEdt} onClick={()=>{setEditItem(l);setModal("load");}}>Edit</button><button style={S.btnDel} onClick={()=>delLoad(l.id)}>Del</button></div></TD></tr>);})}</tbody></table></div></div></>);

  const Fuel=()=>(<><div style={S.ph}><div><h1 style={S.h1}>Fuel Tracker</h1></div><div style={{display:"flex",gap:10}}><SecondaryBtn onClick={()=>setModal("csvImport")}>📥 Import TCS CSV</SecondaryBtn><PrimaryBtn onClick={()=>{setEditItem(null);setModal("fuel");}}>+ Add Manual</PrimaryBtn></div></div><TruckBar/><div style={S.grid(5)}><StatCard label="Total Fuel" value={fmt$(totalFuel)} accent="#dc2626" icon="⛽"/><StatCard label="Gallons" value={fmtN(totalGals,0)+" gal"} accent="#d97706" icon="🛢️"/><StatCard label="Avg MPG" value={fmtN(mpg,2)} accent="#16a34a" icon="📊"/><StatCard label="Avg PPG" value={"$"+fmtN(totalGals?totalFuel/totalGals:0,3)} accent="#2563eb" icon="💲"/><StatCard label="Fuel%Rev" value={fmtN(totalRev?totalFuel/totalRev*100:0)+"%"} accent="#7c3aed" icon="📉"/></div><div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(170px,1fr))",gap:12,marginBottom:18}}>{truckSummaries.map(t=>(<div key={t.id} style={{background:"#fff",border:`2px solid ${t.color}`,borderRadius:11,padding:14}}><div style={{color:t.color,fontWeight:800,fontSize:13,marginBottom:8}}>{t.name}</div><div style={{color:"#dc2626",fontFamily:"monospace",fontWeight:800,fontSize:18}}>{fmt$(t.fuel)}</div><div style={{color:"#6b7280",fontSize:11,marginTop:4}}>{fmtN(t.gals,0)} gal · {fmtN(t.mpg,1)} MPG</div></div>))}</div><div style={S.tableWrap}><div style={{overflowX:"auto"}}><table style={{width:"100%",borderCollapse:"collapse"}}><thead><tr>{["Date","Truck","Location","Gallons","$/Gal","Total","Load#",""].map(h=><TH key={h}>{h}</TH>)}</tr></thead><tbody>{filtFuel.length===0&&<tr><td colSpan={8} style={{padding:"32px",textAlign:"center",color:"#9ca3af"}}>No fuel entries yet.</td></tr>}{filtFuel.map(f=>{const t=truckById(f.truckId);return(<tr key={f.id} onMouseEnter={e=>e.currentTarget.style.background="#f9fafb"} onMouseLeave={e=>e.currentTarget.style.background="#fff"}><TD>{f.date}</TD><TD>{t&&<Badge label={t.name} color={t.color}/>}</TD><TD>{f.location||"—"}</TD><TD mono>{fmtN(f.gallons,1)}</TD><TD mono>${fmtN(f.pricePer,3)}</TD><TD mono color="#dc2626" bold>{fmt$(f.total)}</TD><TD color="#d97706">{f.loadNum||"—"}</TD><TD><div style={{display:"flex",gap:5}}><button style={S.btnEdt} onClick={()=>{setEditItem(f);setModal("fuel");}}>Edit</button><button style={S.btnDel} onClick={()=>delFuel(f.id)}>Del</button></div></TD></tr>);})}</tbody></table></div></div></>);

  const Expenses=()=>{const byCat=[...new Set(filtExp.map(e=>e.category))].map(c=>({c,t:filtExp.filter(e=>e.category===c).reduce((s,e)=>s+Number(e.amount||0),0)}));return(<><div style={S.ph}><div><h1 style={S.h1}>Expenses</h1></div><PrimaryBtn onClick={()=>{setEditItem(null);setModal("expense");}}>+ Add Expense</PrimaryBtn></div><TruckBar/><div style={{display:"flex",gap:12,flexWrap:"wrap",marginBottom:20}}>{byCat.map(ec=>(<div key={ec.c} style={{background:"#fff",border:"1.5px solid #e5e7eb",borderRadius:10,padding:"12px 16px",minWidth:130}}><div style={{color:"#6b7280",fontSize:10,fontWeight:700,textTransform:"uppercase"}}>{ec.c}</div><div style={{color:"#d97706",fontFamily:"monospace",fontWeight:800,fontSize:18,marginTop:4}}>{fmt$(ec.t)}</div></div>))}<div style={{background:"#fff",border:"1.5px solid #fecaca",borderRadius:10,padding:"12px 16px",minWidth:130}}><div style={{color:"#6b7280",fontSize:10,fontWeight:700,textTransform:"uppercase"}}>Total</div><div style={{color:"#dc2626",fontFamily:"monospace",fontWeight:800,fontSize:18,marginTop:4}}>{fmt$(totalExp)}</div></div></div><div style={S.tableWrap}><div style={{overflowX:"auto"}}><table style={{width:"100%",borderCollapse:"collapse"}}><thead><tr>{["Date","Truck","Category","Description","Amount",""].map(h=><TH key={h}>{h}</TH>)}</tr></thead><tbody>{filtExp.length===0&&<tr><td colSpan={6} style={{padding:"32px",textAlign:"center",color:"#9ca3af"}}>No expenses yet.</td></tr>}{filtExp.map(e=>{const t=e.truckId==="FLEET"?{name:"Fleet",color:"#6b7280"}:truckById(e.truckId);return(<tr key={e.id} onMouseEnter={ev=>ev.currentTarget.style.background="#f9fafb"} onMouseLeave={ev=>ev.currentTarget.style.background="#fff"}><TD>{e.date}</TD><TD>{t&&<Badge label={t.name} color={t.color}/>}</TD><TD><span style={{background:"#f3f4f6",borderRadius:6,padding:"2px 8px",fontSize:11,color:"#374151",fontWeight:600}}>{e.category}</span></TD><TD>{e.description}</TD><TD mono color="#dc2626" bold>{fmt$(e.amount)}</TD><TD><button style={S.btnDel} onClick={()=>delExp(e.id)}>Del</button></TD></tr>);})}</tbody></table></div></div></>);};

  const Fleet=()=>(<><div style={S.ph}><div><h1 style={S.h1}>Fleet Management</h1></div><PrimaryBtn onClick={()=>{setEditItem(null);setModal("truck");}}>+ Add Truck</PrimaryBtn></div><div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(290px,1fr))",gap:18}}>{truckSummaries.map(t=>(<div key={t.id} style={{background:"#fff",border:`2px solid ${t.color}`,borderRadius:14,padding:22,boxShadow:"0 2px 8px rgba(0,0,0,0.06)"}}><div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:18}}><div><div style={{color:t.color,fontWeight:900,fontSize:20}}>{t.name}</div><div style={{color:"#6b7280",fontSize:12,marginTop:2}}>{[t.year,t.make,t.model].filter(Boolean).join(" ")||"No details"}</div>{t.plate&&<div style={{color:"#9ca3af",fontSize:11}}>{t.plate}</div>}</div><div style={{display:"flex",gap:6}}><button style={S.btnEdt} onClick={()=>{setEditItem(t);setModal("truck");}}>Edit</button><Badge label={t.active?"Active":"Inactive"} color={t.active?"#16a34a":"#dc2626"}/></div></div><div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>{[{l:"Revenue",v:fmt$(t.rev),c:"#16a34a"},{l:"Profit",v:fmt$(t.profit),c:t.profit>=0?"#16a34a":"#dc2626"},{l:"Fuel",v:fmt$(t.fuel),c:"#dc2626"},{l:"Driver Pay",v:fmt$(t.dp),c:"#d97706"},{l:"Miles",v:fmtMi(t.mi),c:"#2563eb"},{l:"Loads",v:t.numLoads,c:"#6b7280"},{l:"MPG",v:fmtN(t.mpg,1),c:"#7c3aed"},{l:"$/Mile",v:"$"+fmtN(t.rpm),c:"#d97706"}].map(r=>(<div key={r.l} style={{background:"#f9fafb",borderRadius:8,padding:"10px 12px",border:"1px solid #e5e7eb"}}><div style={{color:"#6b7280",fontSize:10,fontWeight:700,textTransform:"uppercase"}}>{r.l}</div><div style={{color:r.c,fontFamily:"monospace",fontWeight:700,fontSize:14,marginTop:3}}>{r.v}</div></div>))}</div><div style={{marginTop:14}}><div style={{display:"flex",justifyContent:"space-between",marginBottom:5}}><span style={{color:"#6b7280",fontSize:11}}>Profit Margin</span><span style={{color:t.color,fontSize:12,fontWeight:700}}>{fmtN(t.margin)}%</span></div><div style={{background:"#e5e7eb",borderRadius:99,height:6}}><div style={{width:`${Math.min(100,Math.max(0,t.margin))}%`,height:"100%",background:t.color,borderRadius:99}}/></div></div></div>))}{trucks.length===0&&<div style={{...S.card,textAlign:"center",padding:40}}><div style={{fontSize:40,marginBottom:12}}>🚚</div><div style={{color:"#6b7280"}}>No trucks yet.</div></div>}</div></>);

  const Drivers=()=>(<><div style={S.ph}><div><h1 style={S.h1}>Drivers & Paystubs</h1><div style={{color:"#6b7280",fontSize:12,marginTop:3}}>Drivers appear automatically when you add loads with a driver name</div></div><PrimaryBtn onClick={()=>{setEditItem(null);setModal("load");}}>+ Add Load with Driver</PrimaryBtn></div><div style={{display:"flex",gap:12,alignItems:"center",marginBottom:20}}><div style={{color:"#374151",fontSize:13,fontWeight:600}}>Pay Period:</div>{["weekly","biweekly","monthly","all"].map(p=>(<button key={p} onClick={()=>setPaystubPeriod(p)} style={{background:paystubPeriod===p?"#d97706":"#fff",border:`1.5px solid ${paystubPeriod===p?"#d97706":"#d1d5db"}`,borderRadius:8,padding:"7px 16px",color:paystubPeriod===p?"#fff":"#374151",fontWeight:700,cursor:"pointer",fontSize:12}}>{p.charAt(0).toUpperCase()+p.slice(1)}</button>))}</div>{driverStats.length===0&&(<div style={{...S.card,textAlign:"center",padding:48}}><div style={{fontSize:48,marginBottom:16}}>👤</div><div style={{color:"#111827",fontWeight:700,fontSize:16,marginBottom:8}}>No drivers yet</div><div style={{color:"#6b7280",fontSize:14,marginBottom:24}}>Add a load with a driver name and they appear here automatically with pay tracking and paystubs.</div><PrimaryBtn onClick={()=>{setEditItem(null);setModal("load");}}>+ Add Your First Load</PrimaryBtn></div>)}<div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(320px,1fr))",gap:18}}>{driverStats.map(d=>{const periodLoads=getPaystubLoads(d.name);const periodPay=periodLoads.reduce((s,l)=>{const g=Number(l.rate||0)+Number(l.detention||0);return s+g*(Number(l.driverPct||0)/100);},0);return(<div key={d.name} style={{background:"#fff",border:"1.5px solid #e5e7eb",borderRadius:14,padding:22,boxShadow:"0 2px 8px rgba(0,0,0,0.06)"}}><div style={{display:"flex",alignItems:"center",gap:14,marginBottom:18}}><div style={{width:52,height:52,borderRadius:"50%",background:"linear-gradient(135deg,#d97706,#b45309)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:20,fontWeight:900,color:"#fff"}}>{d.name.split(" ").map(n=>n[0]).join("").slice(0,2)}</div><div><div style={{color:"#111827",fontWeight:800,fontSize:16}}>{d.name}</div><div style={{color:"#6b7280",fontSize:12}}>{d.pct}% pay · {d.loads} loads</div></div></div>{[{l:"All-Time Revenue",v:fmt$(d.rev),c:"#16a34a"},{l:"All-Time Pay",v:fmt$(d.pay),c:"#d97706"},{l:"Total Miles",v:fmtMi(d.mi)+" mi",c:"#2563eb"},{l:"Detention",v:fmt$(d.det),c:"#7c3aed"}].map(r=>(<div key={r.l} style={{display:"flex",justifyContent:"space-between",padding:"8px 0",borderBottom:"1px solid #f3f4f6"}}><span style={{color:"#374151",fontSize:12}}>{r.l}</span><span style={{color:r.c,fontFamily:"monospace",fontWeight:700}}>{r.v}</span></div>))}<div style={{background:"#fffbeb",border:"1.5px solid #fde68a",borderRadius:10,padding:"12px 14px",margin:"14px 0"}}><div style={{color:"#92400e",fontSize:10,fontWeight:700,letterSpacing:1,marginBottom:6}}>{paystubPeriod.toUpperCase()} PAY ({periodLoads.length} loads)</div><div style={{color:"#d97706",fontFamily:"monospace",fontWeight:900,fontSize:24}}>{fmt$(periodPay)}</div></div><div style={{display:"flex",gap:8}}><button onClick={()=>printPaystub(d.name,periodLoads,paystubPeriod)} style={{...S.btnPrint,flex:1,padding:"9px",textAlign:"center",fontSize:13}}>🖨️ Print Paystub</button><button onClick={()=>{setPaystubDriver(d.name);setModal("driverLoads");}} style={{...S.btnEdt,flex:1,padding:"9px",textAlign:"center",fontSize:13}}>📋 View Runs</button></div></div>);})}</div></>);

  const Lanes=()=>(<><div style={S.ph}><h1 style={S.h1}>Lane Analytics</h1></div><div style={S.grid(4)}><StatCard label="Total Lanes" value={lanes.length} accent="#2563eb" icon="🗺️"/><StatCard label="Best RPM" value={lanes.length?`$${fmtN(Math.max(...lanes.map(l=>l.miles?l.revenue/l.miles:0)))}`:"—"} accent="#16a34a" icon="🏆"/><StatCard label="Total Miles" value={fmtMi(lanes.reduce((s,l)=>s+l.miles,0))} accent="#d97706" icon="🛣️"/><StatCard label="Total Revenue" value={fmt$(lanes.reduce((s,l)=>s+l.revenue,0))} accent="#16a34a" icon="💰"/></div><div style={S.tableWrap}><div style={{overflowX:"auto"}}><table style={{width:"100%",borderCollapse:"collapse"}}><thead><tr>{["Lane","Loads","Miles","Revenue","Profit","$/Mile","Avg/Load"].map(h=><TH key={h}>{h}</TH>)}</tr></thead><tbody>{lanes.length===0&&<tr><td colSpan={7} style={{padding:"32px",textAlign:"center",color:"#9ca3af"}}>No lane data yet.</td></tr>}{lanes.map((l,i)=>{const rpm=l.miles?l.revenue/l.miles:0;return(<tr key={l.lane} onMouseEnter={e=>e.currentTarget.style.background="#f9fafb"} onMouseLeave={e=>e.currentTarget.style.background="#fff"}><TD bold color={i===0?"#d97706":"#111827"}>{i===0?"🏆 ":""}{l.lane}</TD><TD mono>{l.loads}</TD><TD mono>{fmtMi(l.miles)}</TD><TD mono color="#16a34a">{fmt$(l.revenue)}</TD><TD mono color={l.profit>=0?"#16a34a":"#dc2626"}>{fmt$(l.profit)}</TD><TD mono color={rpm>=3?"#16a34a":rpm>=2?"#d97706":"#dc2626"} bold>${fmtN(rpm)}</TD><TD mono>{fmt$(l.loads?l.revenue/l.loads:0)}</TD></tr>);})}</tbody></table></div></div></>);

  const Reports=()=>{const netMi=avgRPM-cpm;return(<><div style={S.ph}><h1 style={S.h1}>Reports & KPIs</h1></div><TruckBar/><div style={S.grid(4)}><StatCard label="Cost/Mile" value={"$"+fmtN(cpm)} sub="All-in CPM" accent="#dc2626" icon="⚙️"/><StatCard label="Revenue/Mile" value={"$"+fmtN(avgRPM)} sub="Gross RPM" accent="#16a34a" icon="💹"/><StatCard label="Net/Mile" value={"$"+fmtN(netMi)} sub="After all costs" accent={netMi>=0?"#16a34a":"#dc2626"} icon="🎯"/><StatCard label="Fuel%Rev" value={fmtN(totalRev?totalFuel/totalRev*100:0)+"%"} sub="Target <25%" accent="#7c3aed" icon="⛽"/></div><div style={S.card}><div style={{color:"#6b7280",fontSize:11,fontWeight:700,letterSpacing:1,marginBottom:16,textTransform:"uppercase"}}>KPI Benchmarks</div>{[{l:"Revenue/Mile",v:avgRPM,target:3.0,f:v=>`$${fmtN(v)}`,note:"target $3.00+"},{l:"Profit Margin",v:margin,target:15,f:v=>`${fmtN(v)}%`,note:"target 15%+"},{l:"Cost/Mile",v:cpm,target:2.5,f:v=>`$${fmtN(v)}`,note:"target <$2.50",inv:true},{l:"Fuel%Rev",v:totalRev?totalFuel/totalRev*100:0,target:25,f:v=>`${fmtN(v)}%`,note:"target <25%",inv:true},{l:"Fleet MPG",v:mpg,target:6.5,f:v=>`${fmtN(v,1)}`,note:"target 6.5+"}].map(k=>{const good=k.inv?k.v<=k.target:k.v>=k.target;const pct=Math.min(100,Math.abs((k.v/k.target)*100));return(<div key={k.l} style={{marginBottom:18}}><div style={{display:"flex",justifyContent:"space-between",marginBottom:6}}><span style={{color:"#374151",fontSize:13,fontWeight:600}}>{k.l}</span><span style={{color:good?"#16a34a":"#dc2626",fontWeight:700,fontFamily:"monospace"}}>{k.f(k.v)} <span style={{color:"#9ca3af",fontSize:10,fontWeight:400}}>({k.note})</span></span></div><div style={{background:"#e5e7eb",borderRadius:99,height:7}}><div style={{width:`${pct}%`,height:"100%",background:good?"#16a34a":"#dc2626",borderRadius:99}}/></div></div>);})}</div></>);};

  const DriverLoadsModal=()=>{const dl=getPaystubLoads(paystubDriver);const pay=dl.reduce((s,l)=>{const g=Number(l.rate||0)+Number(l.detention||0);return s+g*(Number(l.driverPct||0)/100);},0);return(<ModalShell title={`📋 ${paystubDriver} — ${paystubPeriod}`} onClose={closeModal} wide><div style={{marginBottom:16,display:"flex",justifyContent:"space-between",alignItems:"center"}}><div style={{color:"#374151",fontWeight:600}}>{dl.length} loads · {fmt$(pay)} pay</div><PrimaryBtn onClick={()=>printPaystub(paystubDriver,dl,paystubPeriod)} style={{padding:"8px 16px",fontSize:12}}>🖨️ Print Paystub</PrimaryBtn></div><div style={{overflowX:"auto"}}><table style={{width:"100%",borderCollapse:"collapse"}}><thead><tr>{["Load#","Date","Route","Miles","Rate","Detention","Driver Pay","Status"].map(h=><TH key={h}>{h}</TH>)}</tr></thead><tbody>{dl.length===0&&<tr><td colSpan={8} style={{padding:"32px",textAlign:"center",color:"#9ca3af"}}>No loads this period.</td></tr>}{dl.map(l=>{const g=Number(l.rate||0)+Number(l.detention||0);const dp=g*(Number(l.driverPct||0)/100);return(<tr key={l.id}><TD color="#d97706" bold>{l.loadNum}</TD><TD>{l.date}</TD><TD>{l.origin} → {l.dest}</TD><TD mono>{fmtMi(l.miles)}</TD><TD mono>{fmt$(l.rate)}</TD><TD mono color="#7c3aed">{fmt$(l.detention)}</TD><TD mono color="#d97706" bold>{fmt$(dp)}</TD><TD><StatusBadge s={l.status}/></TD></tr>);})}</tbody></table></div></ModalShell>);};

  const NAV=[{id:"dashboard",label:"Dashboard",icon:"📊"},{id:"loads",label:"Loads",icon:"🚛"},{id:"fuel",label:"Fuel",icon:"⛽"},{id:"expenses",label:"Expenses",icon:"💳"},{id:"fleet",label:"Fleet",icon:"🚚"},{id:"drivers",label:"Drivers",icon:"👤"},{id:"lanes",label:"Lanes",icon:"🗺️"},{id:"reports",label:"Reports",icon:"📈"}];
  const allRev=loads.reduce((s,l)=>s+Number(l.rate||0)+Number(l.detention||0),0);
  const allCosts=loads.reduce((s,l)=>{const g=Number(l.rate||0)+Number(l.detention||0);return s+g*(Number(l.driverPct||0)/100);},0)+fuelLog.reduce((s,f)=>s+Number(f.total||0),0)+expenses.reduce((s,e)=>s+Number(e.amount||0),0);
  const allProfit=allRev-allCosts;

  return (
    <div style={S.app}>
      <div style={S.sidebar}>
        <div style={{padding:"22px 20px 20px",borderBottom:"1px solid rgba(255,255,255,0.1)"}}>
          <div style={{fontSize:18,fontWeight:900,color:"#f59e0b"}}>⛟ BHANDARI</div>
          <div style={{color:"#64748b",fontSize:10,marginTop:2,letterSpacing:2}}>LOGISTICS LLC</div>
        </div>
        <div style={{margin:"14px 12px 8px",background:"rgba(255,255,255,0.07)",borderRadius:10,padding:"14px 16px"}}>
          <div style={{color:"#64748b",fontSize:9,fontWeight:700,letterSpacing:1.5,marginBottom:8}}>FLEET SNAPSHOT</div>
          <div style={{color:"#4ade80",fontWeight:900,fontFamily:"monospace",fontSize:17}}>{fmt$(allRev)}</div>
          <div style={{color:"#64748b",fontSize:10,marginBottom:8}}>Gross Revenue</div>
          <div style={{color:allProfit>=0?"#4ade80":"#f87171",fontWeight:800,fontFamily:"monospace",fontSize:15}}>{fmt$(allProfit)}</div>
          <div style={{color:"#64748b",fontSize:10}}>Net Profit</div>
        </div>
        <div style={{flex:1}}>{NAV.map(n=>(<button key={n.id} style={S.navBtn(tab===n.id)} onClick={()=>setTab(n.id)}><span style={{fontSize:16}}>{n.icon}</span>{n.label}</button>))}</div>
        <div style={{padding:"14px 16px",borderTop:"1px solid rgba(255,255,255,0.1)"}}>
          <div style={{color:"#475569",fontSize:9,fontWeight:700,letterSpacing:1.5,marginBottom:10}}>ACTIVE TRUCKS</div>
          {trucks.filter(t=>t.active).map(t=>(<div key={t.id} style={{display:"flex",alignItems:"center",gap:8,marginBottom:6,cursor:"pointer"}} onClick={()=>{setTruckView(t.id);setTab("dashboard");}}><div style={{width:8,height:8,borderRadius:"50%",background:t.color}}/><span style={{color:"#94a3b8",fontSize:12}}>{t.name}</span><span style={{color:"#4ade8044",fontFamily:"monospace",fontSize:10,marginLeft:"auto"}}>{fmt$(truckSummaries.find(s=>s.id===t.id)?.profit||0)}</span></div>))}
          {trucks.length===0&&<div style={{color:"#475569",fontSize:11}}>No trucks yet</div>}
        </div>
        <div style={{padding:"10px 12px",borderTop:"1px solid rgba(255,255,255,0.1)"}}>
          <div style={{color:"#475569",fontSize:9,letterSpacing:1,marginBottom:4}}>☁️ SYNCED TO CLOUD</div>
          <div style={{color:"#4ade8033",fontSize:10}}>Data saves automatically</div>
        </div>
      </div>
      <div style={S.main}>
        {tab==="dashboard"&&<Dashboard/>}{tab==="loads"&&<Loads/>}{tab==="fuel"&&<Fuel/>}{tab==="expenses"&&<Expenses/>}{tab==="fleet"&&<Fleet/>}{tab==="drivers"&&<Drivers/>}{tab==="lanes"&&<Lanes/>}{tab==="reports"&&<Reports/>}
      </div>
      {modal==="truck"&&<TruckForm onClose={closeModal} onSave={saveTruck} saving={saving} trucks={trucks} editId={editItem?.id}/>}
      {modal==="load"&&<LoadForm onClose={closeModal} onSave={saveLoad} saving={saving} trucks={trucks} editItem={editItem}/>}
      {modal==="fuel"&&<FuelForm onClose={closeModal} onSave={saveFuel} saving={saving} trucks={trucks} editItem={editItem}/>}
      {modal==="expense"&&<ExpenseForm onClose={closeModal} onSave={saveExp} saving={saving} trucks={trucks} editItem={editItem}/>}
      {modal==="csvImport"&&<CsvImportForm onClose={closeModal} onImport={importFuel} saving={saving} trucks={trucks}/>}
      {modal==="rateCon"&&<RateConModal onClose={closeModal} onLoad={saveLoadDirect} trucks={trucks}/>}
      {modal==="driverLoads"&&<DriverLoadsModal/>}
      {toast&&(<div style={{position:"fixed",bottom:24,right:24,background:toast.type==="error"?"#fef2f2":toast.type==="warn"?"#fffbeb":"#f0fdf4",border:`1.5px solid ${toast.type==="error"?"#fecaca":toast.type==="warn"?"#fde68a":"#bbf7d0"}`,borderRadius:10,padding:"12px 20px",color:toast.type==="error"?"#dc2626":toast.type==="warn"?"#d97706":"#16a34a",fontWeight:700,fontSize:13,zIndex:99999,boxShadow:"0 8px 24px rgba(0,0,0,0.12)"}}>{toast.msg}</div>)}
      <style>{`*{box-sizing:border-box}body{margin:0}::-webkit-scrollbar{width:5px;height:5px}::-webkit-scrollbar-track{background:#f3f4f6}::-webkit-scrollbar-thumb{background:#d1d5db;border-radius:99px}select option{background:#fff}@keyframes pulse{0%,100%{opacity:0.5}50%{opacity:1}}`}</style>
    </div>
  );
}
