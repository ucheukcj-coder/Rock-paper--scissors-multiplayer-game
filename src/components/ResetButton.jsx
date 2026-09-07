import React from 'react'

export default function ResetButton({ onReset }) {
  return (
    <div id="reset">
      <button id="reset-button" onClick={onReset}>
        <span className="reset-icon" aria-hidden="true">🔄</span>Reset
      </button>
    </div>
  )
}
