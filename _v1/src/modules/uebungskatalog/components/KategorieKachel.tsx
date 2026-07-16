import React from "react";

export function KategorieKachel({ title, onClick }:{ title:string; onClick:()=>void }) {
  return (
    <div className="kategorie-kachel" onClick={onClick}>
      {title}
    </div>
  );
}
