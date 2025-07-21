export interface UiProps {
  title: string
  subtitle?: string
}

export function Ui({ title, subtitle }: UiProps) {
  return (
    <div className="ui-component">
      <h2>{title}</h2>
      {subtitle && <p>{subtitle}</p>}
    </div>
  )
}

export default Ui
