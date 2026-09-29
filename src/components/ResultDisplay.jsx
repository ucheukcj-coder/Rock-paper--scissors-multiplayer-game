import React from 'react'

const choiceIcons = { Rock: '✊', Paper: '✋', Scissors: '✌' }

export default function ResultDisplay({ userChoice, computerChoice, result, opponentMade }) {
  const resultClass = result === 'You Win' ? 'win' : result === 'You Lose' ? 'lose' : result === 'Draw' ? 'draw' : ''

  return (
    <section className="match-stage" aria-label="Round matchup">
      <div className="player-panel opponent-panel">
        <div className="player-heading">
          <span className="player-icon" aria-hidden="true">♟</span>
          <div><h2 className="player-name">Opponent</h2><div className="player-caption">Guest player</div></div>
        </div>
        <div className={'choice-display' + (computerChoice ? '' : ' is-empty')} aria-live="polite">
          {computerChoice ? choiceIcons[computerChoice] : 'READY'}
        </div>
        <div className="choice-text">{computerChoice || 'Waiting for reveal'}</div>
      </div>
      <div className="versus-column">
        <div>
          <div className="result-label">Round result</div>
          <div id="result" className={'result-value ' + resultClass} aria-live="polite">{result || 'VS'}</div>
          <div className="opponent-action">{opponentMade && !computerChoice ? 'Opponent has picked' : ''}</div>
        </div>
      </div>
      <div className="player-panel user-panel">
        <div className="player-heading">
          <span className="player-icon" aria-hidden="true">●</span>
          <div><h2 className="player-name">You</h2><div className="player-caption">Your side</div></div>
        </div>
        <div className={'choice-display' + (userChoice ? '' : ' is-empty')} aria-live="polite">
          {userChoice ? choiceIcons[userChoice] : 'READY'}
        </div>
        <div className="choice-text">{userChoice || 'Make your move'}</div>
      </div>
    </section>
  )
}
