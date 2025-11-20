import React, { useState } from "react";
import { useTrainingsdoku } from "../hooks/useTrainingsdoku";
import "../styles/Trainingsdoku.css";
import { toISODate } from "../../common/date";

export default function TrainingsdokuPage(){
  const {
    dateISO, setDateISO,
    athleteId, setAthleteId,
    athleteName, setAthleteName,
    planItems, doku,
    beginTraining, setItemStatus, addExtra, finishAndSummarize, persist
  } = useTrainingsdoku();

  const [modifyIdx, setModifyIdx] = useState<number|null>(null);
  const [modifyVals, setModifyVals] = useState<any>({ reps:"", menge:"", einheit:"", gewicht:"", strecke:"", dauerMin:"", comment:"" });

  function confirmModify(){
    if (modifyIdx==null) return;
    const patch:any = {};
    if (modifyVals.reps !== "") patch.reps = Number(modifyVals.reps);
    if (modifyVals.menge !== "") patch.menge = Number(modifyVals.menge);
    if (modifyVals.einheit !== "") patch.einheit = modifyVals.einheit;
    if (modifyVals.gewicht !== "") patch.gewicht = Number(modifyVals.gewicht);
    if (modifyVals.strecke !== "") patch.strecke = Number(modifyVals.strecke);
    if (modifyVals.dauerMin !== "") patch.dauerMin = Number(modifyVals.dauerMin);
    setItemStatus(modifyIdx, "MODIFIED", patch);
    setModifyIdx(null);
    setModifyVals({ reps:"", menge:"", einheit:"", gewicht:"", strecke:"", dauerMin:"", comment:"" });
  }

  return (
    <div className="td-container">
      <div className="td-header">
        <div>
          <div>Datum</div>
          <input className="td-input" type="date" value={dateISO} onChange={e=>setDateISO(e.target.value || toISODate(new Date()))} />
        </div>
        <div>
          <div>Athlet-ID</div>
          <input className="td-input" placeholder="athlete-123" value={athleteId} onChange={e=>setAthleteId(e.target.value)} />
        </div>
        <div>
          <div>Name (optional)</div>
          <input className="td-input" placeholder="Raphael Briel" value={athleteName} onChange={e=>setAthleteName(e.target.value)} />
        </div>
        <div style={{marginLeft:"auto", alignSelf:"flex-end"}}>
          <button className="td-btn" onClick={beginTraining}>Training starten</button>
          <button className="td-btn primary" onClick={async()=>{ finishAndSummarize(); await persist(); alert("Gespeichert."); }}>Abschließen & Speichern</button>
        </div>
      </div>

      <div className="td-card">
        <div style={{fontWeight:600, marginBottom:6}}>Plan ({planItems.length} Übungen)</div>
        {planItems.length===0 && <div className="td-chip">Kein Plan für diesen Tag.</div>}
        {planItems.map((it:any, idx:number)=>(
          <div key={it.id} className="td-card" style={{marginBottom:6}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
              <div>
                <div style={{fontWeight:600}}>{it.nameCache ?? it.exerciseId}</div>
                <div className={"td-status " + (doku?.logsByDate?.[dateISO]?.items?.[idx]?.status ?? "")}>
                  Status: {doku?.logsByDate?.[dateISO]?.items?.[idx]?.status ?? "offen"}
                </div>
              </div>
              <div className="td-actions">
                <button className="td-btn" onClick={()=>setItemStatus(idx, "AS_PLANNED")}>✔ wie geplant</button>
                <button className="td-btn" onClick={()=>setModifyIdx(idx)}>✎ anpassen</button>
                <button className="td-btn" onClick={()=>setItemStatus(idx, "SKIPPED")}>⏭ überspringen</button>
              </div>
            </div>
            <div className="td-row">
              <input className="td-input" readOnly value={it.target?.reps ?? ""} placeholder="Wdh." />
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
                <input className="td-input" readOnly value={it.target?.menge ?? ""} placeholder="Menge" />
                <input className="td-input" readOnly value={it.target?.einheit ?? ""} placeholder="Einheit" />
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="td-card">
        <div style={{fontWeight:600, marginBottom:6}}>Zusatzübung</div>
        <ExtraForm onAdd={(ex)=>addExtra(ex)} />
      </div>

      {doku?.logsByDate?.[dateISO]?.summary && (
        <div className="td-card">
          <div style={{fontWeight:600, marginBottom:6}}>Analyse</div>
          <div className="td-summary">
            <div className="td-chip">✔ {doku.logsByDate[dateISO].summary.asPlanned} geplant</div>
            <div className="td-chip">✎ {doku.logsByDate[dateISO].summary.modified} angepasst</div>
            <div className="td-chip">⏭ {doku.logsByDate[dateISO].summary.skipped} übersprungen</div>
            <div className="td-chip">➕ {doku.logsByDate[dateISO].summary.extra} extra</div>
          </div>
        </div>
      )}

      {modifyIdx!=null && (
        <div className="td-card">
          <div style={{fontWeight:600, marginBottom:6}}>Übung anpassen</div>
          <div className="td-row">
            <input className="td-input" type="number" placeholder="Wdh." value={modifyVals.reps} onChange={e=>setModifyVals({...modifyVals, reps:e.target.value})} />
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
              <input className="td-input" type="number" placeholder="Menge" value={modifyVals.menge} onChange={e=>setModifyVals({...modifyVals, menge:e.target.value})} />
              <input className="td-input" placeholder="Einheit" value={modifyVals.einheit} onChange={e=>setModifyVals({...modifyVals, einheit:e.target.value})} />
            </div>
          </div>
          <div className="td-row">
            <input className="td-input" type="number" placeholder="Gewicht (kg)" value={modifyVals.gewicht} onChange={e=>setModifyVals({...modifyVals, gewicht:e.target.value})} />
            <input className="td-input" type="number" placeholder="Strecke (km)" value={modifyVals.strecke} onChange={e=>setModifyVals({...modifyVals, strecke:e.target.value})} />
          </div>
          <div className="td-row">
            <input className="td-input" type="number" placeholder="Dauer (min)" value={modifyVals.dauerMin} onChange={e=>setModifyVals({...modifyVals, dauerMin:e.target.value})} />
            <input className="td-input" placeholder="Kommentar" value={modifyVals.comment} onChange={e=>setModifyVals({...modifyVals, comment:e.target.value})} />
          </div>
          <div className="td-actions" style={{marginTop:8}}>
            <button className="td-btn" onClick={()=>setModifyIdx(null)}>Abbrechen</button>
            <button className="td-btn primary" onClick={confirmModify}>Übernehmen</button>
          </div>
        </div>
      )}
    </div>
  );
}

function ExtraForm({ onAdd }:{ onAdd:(ex:{exerciseId:string; actual?:any; comment?:string})=>void }){
  const [data, setData] = useState<any>({ id:"", reps:"", menge:"", einheit:"", gewicht:"", strecke:"", dauerMin:"", comment:"" });
  function add(){
    if (!data.id) return;
    const actual:any = {};
    if (data.reps !== "") actual.reps = Number(data.reps);
    if (data.menge !== "") actual.menge = Number(data.menge);
    if (data.einheit !== "") actual.einheit = data.einheit;
    if (data.gewicht !== "") actual.gewicht = Number(data.gewicht);
    if (data.strecke !== "") actual.strecke = Number(data.strecke);
    if (data.dauerMin !== "") actual.dauerMin = Number(data.dauerMin);
    onAdd({ exerciseId: data.id, actual, comment: data.comment || undefined });
    setData({ id:"", reps:"", menge:"", einheit:"", gewicht:"", strecke:"", dauerMin:"", comment:"" });
  }
  return (
    <div>
      <div className="td-row">
        <input className="td-input" placeholder="Übungs-ID" value={data.id} onChange={e=>setData({...data, id:e.target.value})} />
        <input className="td-input" placeholder="Kommentar (optional)" value={data.comment} onChange={e=>setData({...data, comment:e.target.value})} />
      </div>
      <div className="td-row">
        <input className="td-input" type="number" placeholder="Wdh." value={data.reps} onChange={e=>setData({...data, reps:e.target.value})} />
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
          <input className="td-input" type="number" placeholder="Menge" value={data.menge} onChange={e=>setData({...data, menge:e.target.value})} />
          <input className="td-input" placeholder="Einheit" value={data.einheit} onChange={e=>setData({...data, einheit:e.target.value})} />
        </div>
      </div>
      <div className="td-row">
        <input className="td-input" type="number" placeholder="Gewicht (kg)" value={data.gewicht} onChange={e=>setData({...data, gewicht:e.target.value})} />
        <input className="td-input" type="number" placeholder="Strecke (km)" value={data.strecke} onChange={e=>setData({...data, strecke:e.target.value})} />
      </div>
      <div className="td-row">
        <input className="td-input" type="number" placeholder="Dauer (min)" value={data.dauerMin} onChange={e=>setData({...data, dauerMin:e.target.value})} />
        <div></div>
      </div>
      <div className="td-actions" style={{marginTop:8}}>
        <button className="td-btn" onClick={add}>➕ Extra hinzufügen</button>
      </div>
    </div>
  );
}
