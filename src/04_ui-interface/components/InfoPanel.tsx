import type { ReactNode } from 'react'

interface InfoPanelProps {
  eyebrow: string
  title: string
  children: ReactNode
}

/** 재사용 정보 패널. 내용과 동작은 호출부가 제공한다. */
export function InfoPanel({ eyebrow, title, children }: InfoPanelProps) {
  return (
    <section className="info-panel">
      <span className="panel-eyebrow">{eyebrow}</span>
      <h2>{title}</h2>
      {children}
    </section>
  )
}
