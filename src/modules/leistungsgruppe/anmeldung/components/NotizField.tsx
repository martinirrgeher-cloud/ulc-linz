import React from "react";
import styles from "../styles/Anmeldung.css";

type Props = {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
};

export const NotizField: React.FC<Props> = ({ value, onChange, placeholder }) => {
  return (
    <textarea
      className={styles.note}
      placeholder={placeholder ?? "Zusatzinfo / Notiz…"}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      rows={2}
    />
  );
};
