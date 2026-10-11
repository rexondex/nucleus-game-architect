import type { ButtonHTMLAttributes, ReactNode } from 'react'

/**
 * 공통 UI 동작 버튼.
 * 시각 스타일과 기본 접근성 속성은 이 컴포넌트가 소유하고, 실제 동작은 props로 받는다.
 */
interface ActionButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  children: ReactNode
}

export function ActionButton({ children, className = '', type = 'button', ...props }: ActionButtonProps) {
  return (
    <button className={`action-button ${className}`.trim()} type={type} {...props}>
      {children}
    </button>
  )
}
