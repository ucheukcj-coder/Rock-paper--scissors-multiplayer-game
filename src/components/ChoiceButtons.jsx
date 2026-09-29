import React from 'react'

export default function ChoiceButtons({ onChoose, disabled, userChoice }) {
  return (
    <div className="choice-buttons">
      <button className={"choice-button" + (userChoice === 'Rock' ? ' selected' : '')} id="rock" onClick={() => onChoose('Rock')} disabled={disabled} aria-label="Choose rock">
        <span className="choice-icon" aria-hidden="true">✊</span><span>Rock</span>
      </button>
      <button className={"choice-button" + (userChoice === 'Paper' ? ' selected' : '')} id="paper" onClick={() => onChoose('Paper')} disabled={disabled} aria-label="Choose paper">
        <span className="choice-icon" aria-hidden="true">✋</span><span>Paper</span>
      </button>
      <button className={"choice-button" + (userChoice === 'Scissors' ? ' selected' : '')} id="scissors" onClick={() => onChoose('Scissors')} disabled={disabled} aria-label="Choose scissors">
        <span className="choice-icon" aria-hidden="true">✌</span><span>Scissors</span>
      </button>
    </div>
  )
}
