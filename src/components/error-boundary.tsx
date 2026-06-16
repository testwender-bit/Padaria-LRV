'use client'

import { Component, ReactNode } from 'react'

interface Props {
  children: ReactNode
}

interface State {
  hasError: boolean
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError(): State {
    return { hasError: true }
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="text-center space-y-4">
            <p className="text-lg font-semibold text-red-600">Algo deu errado</p>
            <p className="text-sm text-muted-foreground">Ocorreu um erro inesperado. Tente recarregar a página.</p>
            <button
              onClick={() => this.setState({ hasError: false })}
              className="px-4 py-2 bg-[#1A3A5C] text-white rounded-lg hover:bg-[#2C5282] transition-colors"
            >
              Tentar novamente
            </button>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}
