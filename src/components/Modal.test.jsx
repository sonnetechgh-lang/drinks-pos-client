/* @vitest-environment happy-dom */
import * as React from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, describe, expect, it, vi } from 'vitest'
import Modal from './Modal'

globalThis.IS_REACT_ACT_ENVIRONMENT = true

let root
let container

const render = async (ui) => {
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
  await React.act(async () => {
    root.render(ui)
  })
}

afterEach(async () => {
  if (root) {
    await React.act(async () => {
      root.unmount()
    })
  }
  document.body.innerHTML = ''
  root = null
  container = null
})

describe('Modal', () => {
  it('closes on Escape when allowed', async () => {
    const onClose = vi.fn()
    await render(
      <Modal open onClose={onClose} title="Test modal">
        <button type="button">Inside</button>
      </Modal>
    )

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))

    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('keeps Tab focus inside the dialog', async () => {
    await render(
      <Modal open onClose={() => {}} title="Test modal">
        <button type="button">First</button>
        <button type="button">Last</button>
      </Modal>
    )

    const buttons = document.querySelectorAll('button:not([tabindex="-1"])')
    const closeButton = buttons[0]
    const lastButton = buttons[buttons.length - 1]
    lastButton.focus()

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true }))

    expect(document.activeElement).toBe(closeButton)
  })

  it('returns focus to the opener after close', async () => {
    function Harness() {
      const [open, setOpen] = React.useState(false)
      return (
        <>
          <button type="button" onClick={() => setOpen(true)}>Open modal</button>
          <Modal open={open} onClose={() => setOpen(false)} title="Test modal">
            <button type="button">Inside</button>
          </Modal>
        </>
      )
    }

    await render(<Harness />)
    const opener = document.querySelector('button')
    opener.focus()

    await React.act(async () => {
      opener.click()
    })

    await React.act(async () => {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    })

    expect(document.activeElement).toBe(opener)
  })
})
