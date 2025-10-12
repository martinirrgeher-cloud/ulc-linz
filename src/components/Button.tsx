interface Props extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  label: string;
}

export default function Button({ label, ...props }: Props) {
  return <button className="btn" {...props}>{label}</button>;
}
