
import React from "react";

const WEEKDAYS = ["Montag","Dienstag","Mittwoch","Donnerstag","Freitag","Samstag","Sonntag"] as const;

type Props = {
  isOpen: boolean;
  onClose: () => void;

  sortOrder: "vorname" | "nachname";
  setSortOrder: (v:"vorname"|"nachname") => void;

  activeWeekdayNames: string[]; // current selected names for week
  setActiveDaysForWeek: (names: string[]) => void;

  showInactive: boolean;
  setShowInactive: (v:boolean) => void;
};

export default function SettingsOverlay(props: Props){
  const { isOpen, onClose, sortOrder, setSortOrder, activeWeekdayNames, setActiveDaysForWeek, showInactive, setShowInactive } = props;
  const [localDays, setLocalDays] = React.useState<string[]>(activeWeekdayNames);

  React.useEffect(()=>{ setLocalDays(activeWeekdayNames); }, [activeWeekdayNames]);

  if(!isOpen) return null;

  const toggleDay = (name:string)=>{
    setLocalDays(prev => prev.includes(name) ? prev.filter(x=>x!==name) : [...prev, name]);
  };

  const saveDays = ()=>{
    setActiveDaysForWeek(localDays);
    onClose();
  };

  return (
    <div className="kt-modal-backdrop" onClick={onClose}>
      <div className="kt-modal" onClick={e=>e.stopPropagation()}>
        <div className="kt-modal-header">
          <div>Einstellungen</div>
          <button className="kt-icon-btn" onClick={onClose}>✕</button>
        </div>
        <div className="kt-modal-body">

          <div>
            <div style={{fontSize:12, color:'#6b7280', marginBottom:6}}>Sortierung</div>
            <div className="kt-settings-group">
              <button className="kt-chip" data-active={sortOrder==='nachname'} onClick={()=>setSortOrder('nachname')}>Nachname</button>
              <button className="kt-chip" data-active={sortOrder==='vorname'} onClick={()=>setSortOrder('vorname')}>Vorname</button>
            </div>
          </div>

          <div>
            <div style={{fontSize:12, color:'#6b7280', marginBottom:6}}>Trainingstage (wochenbezogen)</div>
            <div className="kt-settings-group">
              {WEEKDAYS.map(d => (
                <button key={d} className="kt-chip" data-active={localDays.includes(d)} onClick={()=>toggleDay(d)}>{d}</button>
              ))}
            </div>
          </div>

          <div>
            <div style={{fontSize:12, color:'#6b7280', marginBottom:6}}>Anzeige</div>
            <div className="kt-settings-group">
              <button className="kt-chip" data-active={showInactive} onClick={()=>setShowInactive(!showInactive)}>Inaktive anzeigen</button>
            </div>
          </div>

          <div style={{display:'flex', justifyContent:'flex-end', gap:8}}>
            <button className="kt-btn" onClick={onClose}>Abbrechen</button>
            <button className="kt-btn kt-btn--primary" onClick={saveDays}>Speichern</button>
          </div>
        </div>
      </div>
    </div>
  );
}
