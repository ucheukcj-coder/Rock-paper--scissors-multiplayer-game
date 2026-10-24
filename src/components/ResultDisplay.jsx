import React from 'react'

const choiceIcons = { Rock: '✊', Paper: '✋', Scissors: '✌' }

export default function ResultDisplay({ userChoice, computerChoice, result, opponentMade, opponentName, opponentCaption, playerName }) {
  const resultClass = result === 'You Win' ? 'win' : result === 'You Lose' ? 'lose' : result === 'Draw' ? 'draw' : ''

  return (
    <section className={`match-stage${result ? ' has-result' : ''}`} aria-label="Round matchup">
      <div className="player-panel user-panel">
        <div className="player-heading">
          <span className="player-icon" aria-hidden="true">{playerName.slice(0, 1).toUpperCase()}</span>
          <div><h2 className="player-name">{playerName}</h2><div className="player-caption">YOUR HAND</div></div>
        </div>
        <div className={'choice-display' + (userChoice ? '' : ' is-empty')} aria-live="polite">
          {userChoice ? choiceIcons[userChoice] : '✋'}
        </div>
        <div className="choice-text">{userChoice || 'Choose your move below'}</div>
      </div>
      <div className="versus-column">
        <div>
          <div className="result-label">{result ? 'ROUND RESULT' : 'TIME LEFT'}</div>
          <div id="result" className={'result-value ' + resultClass} aria-live="polite">{result || 'VS'}</div>
          <div className="opponent-action">{opponentMade && !computerChoice ? 'Opponent has picked' : ''}</div>
        </div>
      </div>
      <div className="player-panel opponent-panel">
        <div className="player-heading">
          <div><h2 className="player-name">{opponentName}</h2><div className="player-caption">OPPONENT’S HAND</div></div>
          <span className="player-icon" aria-hidden="true">{opponentName.slice(0, 1).toUpperCase()}</span>
        </div>
        <div className={'choice-display' + (computerChoice ? '' : ' is-empty')} aria-live="polite">
          {computerChoice ? choiceIcons[computerChoice] : '?'}
        </div>
        <div className="choice-text">{computerChoice || (opponentMade ? 'Move locked' : 'Choice concealed')}</div>
      </div>
    </section>
  )
}
