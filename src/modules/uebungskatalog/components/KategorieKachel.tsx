interface Props {
  title: string;
  onClick: () => void;
}

export function KategorieKachel({ title, onClick }: Props) {
  return (
    <div className="kategorie-kachel" onClick={onClick}>
      <span>{title}</span>
    </div>
  );
}
