import React from 'react'

export default function ResetButton({ onReset }) {
  return (
    <button className="button-quiet" onClick={onReset} aria-label="Reset match"><span aria-hidden="true">↺</span> Reset match</button>
  )
}
