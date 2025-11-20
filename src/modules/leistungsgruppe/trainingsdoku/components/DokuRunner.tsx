import React, { useState } from "react";
import { useTrainingsdoku } from "../hooks/useTrainingsdoku";
import "../styles/Trainingsdoku.css";

export default function DokuRunner(){
  const {
    planItems, setItemStatus, addExtra, finishAndSummarize, persist
  } = useTrainingsdoku() as any;

  return <div className="td-card">Nutze die Seite <strong>Trainingsdoku</strong>, nicht die Komponente direkt.</div>;
}
