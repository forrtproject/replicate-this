import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { StatusBadge } from './StatusBadge'

describe('StatusBadge', () => {
  it('renders "In progress" for in_progress', () => {
    render(<StatusBadge status="in_progress" />)
    expect(screen.getByText('In progress')).toBeInTheDocument()
  })

  it('renders Published for the terminal published status', () => {
    render(<StatusBadge status="published" />)
    expect(screen.getByText('Published')).toBeInTheDocument()
  })

  it('renders Pending review for pending, so it never reads as reviewed', () => {
    render(<StatusBadge status="pending" />)
    expect(screen.getByText('Pending review')).toBeInTheDocument()
  })

  it('names the next action for an approved nomination', () => {
    render(<StatusBadge status="approved" />)
    expect(screen.getByText('Looking for contributors')).toBeInTheDocument()
  })
})
