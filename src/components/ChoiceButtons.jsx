import React from 'react'

export default function ChoiceButtons({ onChoose, disabled, userChoice }) {
  return (
    <div className="choice-buttons">
      <button className={"choice-button" + (userChoice === 'Rock' ? ' selected' : '')} id="rock" onClick={() => onChoose('Rock')} disabled={disabled}>
        <span className="choice-icon" aria-hidden="true">🪨</span>Rock
      </button>
      <button className={"choice-button" + (userChoice === 'Paper' ? ' selected' : '')} id="paper" onClick={() => onChoose('Paper')} disabled={disabled}>
        <span className="choice-icon" aria-hidden="true">📄</span>Paper
      </button>
      <button className={"choice-button" + (userChoice === 'Scissors' ? ' selected' : '')} id="scissors" onClick={() => onChoose('Scissors')} disabled={disabled}>
        <span className="choice-icon" aria-hidden="true">✂️</span>Scissors
      </button>
    </div>
  )
}
