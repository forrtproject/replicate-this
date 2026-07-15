import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { StatusBadge } from './StatusBadge'

describe('StatusBadge', () => {
  it('renders "In Progress" for in_progress', () => {
    render(<StatusBadge status="in_progress" />)
    expect(screen.getByText('In Progress')).toBeInTheDocument()
  })

  it('renders Published for the terminal published status', () => {
    render(<StatusBadge status="published" />)
    expect(screen.getByText('Published')).toBeInTheDocument()
  })

  it('renders Under Review for pending', () => {
    render(<StatusBadge status="pending" />)
    expect(screen.getByText('Under Review')).toBeInTheDocument()
  })
})
